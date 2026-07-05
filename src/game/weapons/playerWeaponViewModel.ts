import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { publicAssetUrl, type WeaponDefinition } from './weaponManifest';
import type { WeaponViewPoseState } from './weaponViewPose';

export const PLAYER_WEAPON_VIEWMODEL_ASSET = {
  id: 'player.hero.gadget-gremlin.apose.animated',
  modelPath: 'assets/characters/meshy-gadget-gremlin/models/player.hero.gadget-gremlin.apose.animated.glb',
  modelBytes: 10_983_096,
  modelSha256: '80bf9362d7b452f94bcac5b439469b3e67cde1641a9956ad5927b22776c5be7b',
  clipCount: 10,
  observedTriangles: 81_375,
} as const;

const GUN_HOLD_BONE_POSE_DEGREES = {
  RightArm: { x: 36, y: -103, z: 72 },
  RightForeArm: { x: 0, y: 92, z: -35 },
} as const;

type ControlledBoneName = keyof typeof GUN_HOLD_BONE_POSE_DEGREES;

export interface PlayerWeaponViewModelSnapshot {
  assetId: string;
  modelPath: string;
  loaded: boolean;
  modelBytesLoaded: number;
  clipCount: number;
  observedTriangles: number;
  activeGrip: {
    weaponId: string;
    position: [number, number, number];
    rotation: [number, number, number];
    scale: number;
  } | null;
  bonePoseDegrees: typeof GUN_HOLD_BONE_POSE_DEGREES;
  assetLoadErrors: string[];
}

export class PlayerWeaponViewModel {
  readonly root = new THREE.Group();
  private readonly assetLoadErrors: string[] = [];
  private readonly clipTopPlane = new THREE.Plane();
  private readonly localClipTopPlane = new THREE.Plane(new THREE.Vector3(0, -1, 0), 0);
  private readonly clipNormalMatrix = new THREE.Matrix3();
  private readonly clippedMaterials: THREE.Material[] = [];
  private clippingEnabled = false;
  private model: THREE.Object3D | null = null;
  private activeGripSnapshot: PlayerWeaponViewModelSnapshot['activeGrip'] = null;

  constructor(private readonly loader: GLTFLoader) {
    this.root.name = 'player-weapon-viewmodel-root';
  }

  async load(): Promise<void> {
    try {
      const gltf = await this.loader.loadAsync(publicAssetUrl(PLAYER_WEAPON_VIEWMODEL_ASSET.modelPath));
      this.model = gltf.scene;
      this.model.name = PLAYER_WEAPON_VIEWMODEL_ASSET.id;
      normalizeModel(this.model);
      this.clippedMaterials.push(...collectViewModelClippingMaterials(this.model));
      applyGunHoldPose(this.model);
      this.root.add(this.model);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.assetLoadErrors.push(`${PLAYER_WEAPON_VIEWMODEL_ASSET.id}: ${message}`);
    }
  }

  update(
    weapon: WeaponDefinition,
    pose: WeaponViewPoseState,
    characterGripOverride?: WeaponDefinition['view']['characterGrip'],
  ): void {
    const grip = characterGripOverride ?? weapon.view.characterGrip;
    const blend = pose.aimBlend;
    const position = lerpTuple(grip.position, grip.aimPosition, blend);
    const rotation = lerpTuple(grip.rotation, grip.aimRotation, blend);
    const scale = grip.scale * lerp(1, grip.aimScaleMultiplier, blend);

    this.root.position.set(...position);
    this.root.rotation.set(...rotation);
    this.root.scale.setScalar(scale);
    this.updateClipPlane(grip.clipTopY);
    this.activeGripSnapshot = {
      weaponId: weapon.id,
      position: roundTuple(position),
      rotation: roundTuple(rotation),
      scale: roundMetric(scale),
    };
  }

  getSnapshot(): PlayerWeaponViewModelSnapshot {
    return {
      assetId: PLAYER_WEAPON_VIEWMODEL_ASSET.id,
      modelPath: PLAYER_WEAPON_VIEWMODEL_ASSET.modelPath,
      loaded: this.model !== null,
      modelBytesLoaded: this.model ? PLAYER_WEAPON_VIEWMODEL_ASSET.modelBytes : 0,
      clipCount: PLAYER_WEAPON_VIEWMODEL_ASSET.clipCount,
      observedTriangles: PLAYER_WEAPON_VIEWMODEL_ASSET.observedTriangles,
      activeGrip: this.activeGripSnapshot,
      bonePoseDegrees: GUN_HOLD_BONE_POSE_DEGREES,
      assetLoadErrors: [...this.assetLoadErrors],
    };
  }

  private updateClipPlane(clipTopY: number | null): void {
    if (clipTopY === null) {
      this.setClippingEnabled(false);
      return;
    }

    this.setClippingEnabled(true);
    this.root.updateMatrixWorld(true);
    this.localClipTopPlane.set(new THREE.Vector3(0, -1, 0), clipTopY);
    this.clipNormalMatrix.getNormalMatrix(this.root.matrixWorld);
    this.clipTopPlane.copy(this.localClipTopPlane).applyMatrix4(this.root.matrixWorld, this.clipNormalMatrix);
  }

  private setClippingEnabled(enabled: boolean): void {
    if (enabled === this.clippingEnabled) {
      return;
    }

    this.clippingEnabled = enabled;
    for (const material of this.clippedMaterials) {
      material.clippingPlanes = enabled ? [this.clipTopPlane] : null;
      material.needsUpdate = true;
    }
  }

  dispose(disposedGeometries: Set<THREE.BufferGeometry>, disposedMaterials: Set<THREE.Material>): void {
    disposeObject3D(this.root, disposedGeometries, disposedMaterials);
    this.root.clear();
    this.model = null;
  }
}

function normalizeModel(model: THREE.Object3D): void {
  model.traverse((object) => {
    object.frustumCulled = false;
    if (object instanceof THREE.Mesh) {
      object.castShadow = false;
      object.receiveShadow = false;
      object.renderOrder = 1;
    }
  });
}

function collectViewModelClippingMaterials(model: THREE.Object3D): THREE.Material[] {
  const materials: THREE.Material[] = [];
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }

    const meshMaterials = Array.isArray(object.material) ? object.material : [object.material];
    for (const material of meshMaterials) {
      material.clipIntersection = false;
      materials.push(material);
    }
  });
  return materials;
}

function applyGunHoldPose(model: THREE.Object3D): void {
  const bones = new Map<ControlledBoneName, THREE.Bone>();
  model.traverse((object) => {
    if (isBone(object) && object.name in GUN_HOLD_BONE_POSE_DEGREES) {
      bones.set(object.name as ControlledBoneName, object);
    }
  });

  for (const [boneName, pose] of Object.entries(GUN_HOLD_BONE_POSE_DEGREES) as Array<
    [ControlledBoneName, (typeof GUN_HOLD_BONE_POSE_DEGREES)[ControlledBoneName]]
  >) {
    const bone = bones.get(boneName);
    if (!bone) {
      continue;
    }

    bone.rotation.set(
      bone.rotation.x + THREE.MathUtils.degToRad(pose.x),
      bone.rotation.y + THREE.MathUtils.degToRad(pose.y),
      bone.rotation.z + THREE.MathUtils.degToRad(pose.z),
    );
  }
}

function isBone(object: THREE.Object3D): object is THREE.Bone {
  return (object as THREE.Bone).isBone === true;
}

function lerpTuple(
  start: readonly [number, number, number],
  end: readonly [number, number, number],
  amount: number,
): [number, number, number] {
  return [lerp(start[0], end[0], amount), lerp(start[1], end[1], amount), lerp(start[2], end[2], amount)];
}

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount;
}

function roundTuple(tuple: readonly [number, number, number]): [number, number, number] {
  return [roundMetric(tuple[0]), roundMetric(tuple[1]), roundMetric(tuple[2])];
}

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function disposeObject3D(
  object: THREE.Object3D,
  disposedGeometries: Set<THREE.BufferGeometry>,
  disposedMaterials: Set<THREE.Material>,
): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
      if (!disposedGeometries.has(child.geometry)) {
        child.geometry.dispose();
        disposedGeometries.add(child.geometry);
      }
      disposeMaterial(child.material, disposedMaterials);
    }
  });
}

function disposeMaterial(material: THREE.Material | THREE.Material[], disposedMaterials: Set<THREE.Material>): void {
  if (Array.isArray(material)) {
    for (const item of material) {
      disposeMaterial(item, disposedMaterials);
    }
    return;
  }

  if (disposedMaterials.has(material)) {
    return;
  }

  for (const value of Object.values(material)) {
    if (value instanceof THREE.Texture) {
      value.dispose();
    }
  }
  material.dispose();
  disposedMaterials.add(material);
}

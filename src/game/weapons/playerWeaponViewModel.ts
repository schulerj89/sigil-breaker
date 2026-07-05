import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import {
  PLAYER_CHARACTER_ASSET,
  clonePlayerCharacterScene,
  loadPlayerCharacterGltf,
} from '../playerCharacterAsset';
import type { WeaponDefinition } from './weaponManifest';
import type { WeaponViewPoseState } from './weaponViewPose';

export const PLAYER_WEAPON_VIEWMODEL_ASSET = {
  id: PLAYER_CHARACTER_ASSET.id,
  modelPath: PLAYER_CHARACTER_ASSET.modelPath,
  modelBytes: PLAYER_CHARACTER_ASSET.modelBytes,
  modelSha256: PLAYER_CHARACTER_ASSET.modelSha256,
  clipCount: PLAYER_CHARACTER_ASSET.clipCount,
  observedTriangles: PLAYER_CHARACTER_ASSET.observedTriangles,
} as const;

const GUN_HOLD_BONE_POSE_DEGREES = {
  RightArm: { x: 36, y: -103, z: 72 },
  RightForeArm: { x: 0, y: 92, z: -35 },
} as const;

const WEAPON_ARM_BONE_MASK = ['RightShoulder', 'RightArm', 'RightForeArm', 'RightHand'] as const;
const MIN_ALLOWED_BONE_WEIGHT = 0.42;
const PLAYER_ARM_RENDER_ORDER = 1;

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
  armMask: {
    enabled: boolean;
    sourceMeshCount: number;
    maskedMeshCount: number;
    sourceTriangles: number;
    visibleTriangles: number;
    allowedBones: readonly string[];
  };
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
  private armMaskSnapshot: PlayerWeaponViewModelSnapshot['armMask'] = {
    enabled: false,
    sourceMeshCount: 0,
    maskedMeshCount: 0,
    sourceTriangles: 0,
    visibleTriangles: 0,
    allowedBones: WEAPON_ARM_BONE_MASK,
  };

  constructor(private readonly loader: GLTFLoader) {
    this.root.name = 'player-weapon-viewmodel-root';
  }

  async load(): Promise<void> {
    try {
      const gltf = await loadPlayerCharacterGltf(this.loader);
      this.model = clonePlayerCharacterScene(gltf.scene);
      this.model.name = PLAYER_WEAPON_VIEWMODEL_ASSET.id;
      normalizeModel(this.model);
      this.armMaskSnapshot = applyWeaponArmMask(this.model);
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
      armMask: this.armMaskSnapshot,
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
      object.renderOrder = PLAYER_ARM_RENDER_ORDER;
    }
  });
}

function applyWeaponArmMask(model: THREE.Object3D): PlayerWeaponViewModelSnapshot['armMask'] {
  const allowedBones = new Set<string>(WEAPON_ARM_BONE_MASK);
  let sourceMeshCount = 0;
  let maskedMeshCount = 0;
  let sourceTriangles = 0;
  let visibleTriangles = 0;

  model.traverse((object) => {
    if (!isSkinnedMesh(object)) {
      return;
    }

    sourceMeshCount++;
    const originalGeometry = object.geometry;
    sourceTriangles += getTriangleCount(originalGeometry);
    const maskedGeometry = createBoneMaskedGeometry(object, allowedBones);
    if (!maskedGeometry) {
      object.visible = false;
      return;
    }

    object.geometry = maskedGeometry;
    object.frustumCulled = false;
    object.renderOrder = PLAYER_ARM_RENDER_ORDER;
    visibleTriangles += getTriangleCount(maskedGeometry);
    maskedMeshCount++;
  });

  return {
    enabled: maskedMeshCount > 0,
    sourceMeshCount,
    maskedMeshCount,
    sourceTriangles,
    visibleTriangles,
    allowedBones: WEAPON_ARM_BONE_MASK,
  };
}

function createBoneMaskedGeometry(
  mesh: THREE.SkinnedMesh,
  allowedBones: ReadonlySet<string>,
): THREE.BufferGeometry | null {
  const sourceGeometry = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone();
  const position = sourceGeometry.getAttribute('position');
  const skinIndex = sourceGeometry.getAttribute('skinIndex');
  const skinWeight = sourceGeometry.getAttribute('skinWeight');
  if (!position || !skinIndex || !skinWeight) {
    sourceGeometry.dispose();
    return null;
  }

  const keptVertexIndices: number[] = [];
  for (let vertexIndex = 0; vertexIndex < position.count; vertexIndex += 3) {
    const triangleVertices = [vertexIndex, vertexIndex + 1, vertexIndex + 2];
    const keepTriangle = triangleVertices.every((index) => {
      const allowedWeight = getAllowedSkinWeight(mesh.skeleton, skinIndex, skinWeight, index, allowedBones);
      return allowedWeight >= MIN_ALLOWED_BONE_WEIGHT;
    });
    if (keepTriangle) {
      keptVertexIndices.push(...triangleVertices);
    }
  }

  if (keptVertexIndices.length === 0) {
    sourceGeometry.dispose();
    return null;
  }

  const filteredGeometry = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(sourceGeometry.attributes)) {
    if (attribute instanceof THREE.BufferAttribute) {
      filteredGeometry.setAttribute(name, cloneAttributeForVertices(attribute, keptVertexIndices));
    }
  }

  filteredGeometry.computeBoundingBox();
  filteredGeometry.computeBoundingSphere();
  sourceGeometry.dispose();
  return filteredGeometry;
}

function cloneAttributeForVertices(
  attribute: THREE.BufferAttribute,
  vertexIndices: readonly number[],
): THREE.BufferAttribute {
  const ArrayType = attribute.array.constructor as new (length: number) => THREE.TypedArray;
  const values = new ArrayType(vertexIndices.length * attribute.itemSize);
  let targetOffset = 0;
  for (const vertexIndex of vertexIndices) {
    const sourceOffset = vertexIndex * attribute.itemSize;
    for (let itemOffset = 0; itemOffset < attribute.itemSize; itemOffset++) {
      values[targetOffset++] = attribute.array[sourceOffset + itemOffset] ?? 0;
    }
  }
  return new THREE.BufferAttribute(values, attribute.itemSize, attribute.normalized);
}

function getAllowedSkinWeight(
  skeleton: THREE.Skeleton,
  skinIndex: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  skinWeight: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  vertexIndex: number,
  allowedBones: ReadonlySet<string>,
): number {
  const jointIndices = [
    skinIndex.getX(vertexIndex),
    skinIndex.getY(vertexIndex),
    skinIndex.getZ(vertexIndex),
    skinIndex.getW(vertexIndex),
  ];
  const jointWeights = [
    skinWeight.getX(vertexIndex),
    skinWeight.getY(vertexIndex),
    skinWeight.getZ(vertexIndex),
    skinWeight.getW(vertexIndex),
  ];

  return jointIndices.reduce((total, jointIndex, index) => {
    const bone = skeleton.bones[Math.round(jointIndex)];
    return bone && allowedBones.has(bone.name) ? total + jointWeights[index] : total;
  }, 0);
}

function getTriangleCount(geometry: THREE.BufferGeometry): number {
  if (geometry.index) {
    return Math.floor(geometry.index.count / 3);
  }
  return Math.floor((geometry.getAttribute('position')?.count ?? 0) / 3);
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
      material.depthWrite = false;
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

function isSkinnedMesh(object: THREE.Object3D): object is THREE.SkinnedMesh {
  return (object as THREE.SkinnedMesh).isSkinnedMesh === true;
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

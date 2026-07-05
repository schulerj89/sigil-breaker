import * as THREE from 'three';
import { raycastLevel } from './levelMap';
import {
  PLAYER_CHARACTER_ASSET,
  clonePlayerCharacterScene,
  findPlayerCharacterClip,
  loadPlayerCharacterGltf,
} from './playerCharacterAsset';

const DEATH_CHARACTER_TARGET_HEIGHT = 1.78;
const DEATH_CHARACTER_SKINNED_SCALE_CORRECTION = 0.01;
const DEATH_ORBIT_RADIUS = 4.2;
const DEATH_CAMERA_HEIGHT = 1.55;
const DEATH_LOOK_TARGET_Y = 0.68;
const DEATH_ORBIT_SECONDS = 3.8;
const DEATH_ORBIT_HOLD_SECONDS = 1.45;
const DEATH_START_ANGLE_OFFSET = THREE.MathUtils.degToRad(135);
const DEATH_CAMERA_WALL_PADDING = 0.5;
const DEATH_MIN_CAMERA_DISTANCE = 2.35;
const DEATH_CAMERA_SEARCH_STEP = Math.PI / 8;
const LEVEL_RENDER_LAYER = 0;
const DEATH_CINEMATIC_RENDER_LAYER = 1;

export interface DeathCinematicOpenInput {
  playerPosition: readonly [number, number, number];
  yawRadians: number;
}

export interface DeathCinematicStageSnapshot {
  assetId: string;
  modelPath: string;
  loaded: boolean;
  modelBytesLoaded: number;
  clipId: 'out-of-hp';
  clipDurationSeconds: number;
  visible: boolean;
  phaseTimeSeconds: number;
  orbitAngleRadians: number;
  deathPosition: [number, number, number] | null;
  cameraPosition: [number, number, number] | null;
  modelBounds: {
    center: [number, number, number];
    size: [number, number, number];
  } | null;
  errors: string[];
}

export class DeathCinematicStage {
  private readonly root = new THREE.Group();
  private readonly modelRoot = new THREE.Group();
  private readonly lightRoot = new THREE.Group();
  private readonly errors: string[] = [];
  private readonly deathPosition = new THREE.Vector3();
  private model: THREE.Object3D | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private activeAction: THREE.AnimationAction | null = null;
  private loadPromise: Promise<void> | null = null;
  private clipDurationSeconds = 0;
  private visible = false;
  private phaseTimeSeconds = 0;
  private orbitAngleRadians = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly camera: THREE.PerspectiveCamera,
  ) {
    this.root.name = 'death-cinematic-world-root';
    this.modelRoot.name = 'death-cinematic-model-root';
    this.lightRoot.name = 'death-cinematic-light-root';
    this.lightRoot.add(...createDeathLights());
    setObjectLayer(this.root, DEATH_CINEMATIC_RENDER_LAYER);
    setObjectLayer(this.modelRoot, DEATH_CINEMATIC_RENDER_LAYER);
    setObjectLayer(this.lightRoot, DEATH_CINEMATIC_RENDER_LAYER);
    this.root.visible = false;
    this.root.add(this.modelRoot, this.lightRoot);
    this.scene.add(this.root);
  }

  load(): Promise<void> {
    this.loadPromise ??= loadPlayerCharacterGltf()
      .then((gltf) => {
        this.model = clonePlayerCharacterScene(gltf.scene);
        this.model.name = `${PLAYER_CHARACTER_ASSET.id}.death-cinematic`;
        normalizeDeathModel(this.model);
        setObjectLayer(this.model, DEATH_CINEMATIC_RENDER_LAYER);
        this.model.scale.setScalar(readDeathScale(this.model) * DEATH_CHARACTER_SKINNED_SCALE_CORRECTION);
        centerModelOnDeathOrigin(this.model);
        this.modelRoot.add(this.model);

        const clip = findPlayerCharacterClip(gltf.animations, 'out-of-hp');
        if (!clip) {
          this.errors.push(`${PLAYER_CHARACTER_ASSET.id}: missing out-of-hp clip`);
          return;
        }

        this.clipDurationSeconds = clip.duration;
        this.mixer = new THREE.AnimationMixer(this.model);
        this.activeAction = this.mixer.clipAction(clip);
        this.activeAction.clampWhenFinished = true;
        this.activeAction.reset().setLoop(THREE.LoopOnce, 1).play();
        this.activeAction.paused = true;
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.errors.push(`${PLAYER_CHARACTER_ASSET.id}: ${message}`);
      });

    return this.loadPromise;
  }

  open(input: DeathCinematicOpenInput): void {
    this.visible = true;
    this.root.visible = true;
    this.phaseTimeSeconds = 0;
    this.deathPosition.set(input.playerPosition[0], 0, input.playerPosition[2]);
    this.root.position.copy(this.deathPosition);
    this.lightRoot.position.set(0, 0, 0);
    this.orbitAngleRadians = input.yawRadians + DEATH_START_ANGLE_OFFSET;
    this.updateCamera();

    void this.load().then(() => {
      if (this.model) {
        this.model.rotation.y = input.yawRadians + Math.PI;
      }
      this.mixer?.setTime(0);
      if (this.activeAction) {
        this.activeAction.paused = false;
        this.activeAction.reset().setLoop(THREE.LoopOnce, 1).play();
      }
    });
  }

  close(): void {
    this.visible = false;
    this.root.visible = false;
    this.activeAction?.stop();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
    this.root.visible = visible;
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
  }

  update(deltaSeconds: number): void {
    if (!this.visible) {
      return;
    }

    this.phaseTimeSeconds += deltaSeconds;
    if (this.phaseTimeSeconds > DEATH_ORBIT_HOLD_SECONDS) {
      this.orbitAngleRadians += (deltaSeconds / DEATH_ORBIT_SECONDS) * Math.PI * 2;
    }
    this.mixer?.update(deltaSeconds);
    this.updateCamera();
  }

  render(renderer: THREE.WebGLRenderer): void {
    const previousAutoClear = renderer.autoClear;
    const previousLayerMask = this.camera.layers.mask;
    const previousBackground = this.scene.background;

    renderer.autoClear = true;
    this.camera.layers.set(LEVEL_RENDER_LAYER);
    renderer.render(this.scene, this.camera);

    renderer.autoClear = false;
    renderer.clearDepth();
    this.scene.background = null;
    this.camera.layers.set(DEATH_CINEMATIC_RENDER_LAYER);
    renderer.render(this.scene, this.camera);

    this.scene.background = previousBackground;
    renderer.autoClear = previousAutoClear;
    this.camera.layers.mask = previousLayerMask;
  }

  getSnapshot(): DeathCinematicStageSnapshot {
    return {
      assetId: PLAYER_CHARACTER_ASSET.id,
      modelPath: PLAYER_CHARACTER_ASSET.modelPath,
      loaded: this.model !== null,
      modelBytesLoaded: this.model ? PLAYER_CHARACTER_ASSET.modelBytes : 0,
      clipId: 'out-of-hp',
      clipDurationSeconds: roundMetric(this.clipDurationSeconds),
      visible: this.visible,
      phaseTimeSeconds: roundMetric(this.phaseTimeSeconds),
      orbitAngleRadians: roundMetric(this.orbitAngleRadians),
      deathPosition: this.visible ? vectorSnapshot(this.deathPosition) : null,
      cameraPosition: this.visible ? vectorSnapshot(this.camera.position) : null,
      modelBounds: this.visible ? objectBoundsSnapshot(this.modelRoot) : null,
      errors: [...this.errors],
    };
  }

  dispose(): void {
    this.activeAction?.stop();
    this.mixer?.stopAllAction();
    disposeObject3D(this.root);
    this.root.removeFromParent();
    this.model?.removeFromParent();
    this.model = null;
  }

  private updateCamera(): void {
    const lookTarget = new THREE.Vector3(
      this.deathPosition.x,
      DEATH_LOOK_TARGET_Y,
      this.deathPosition.z,
    );
    const placement = this.resolveCameraPlacement(this.orbitAngleRadians);
    this.camera.position.set(
      this.deathPosition.x + Math.cos(placement.angle) * placement.distance,
      DEATH_CAMERA_HEIGHT,
      this.deathPosition.z + Math.sin(placement.angle) * placement.distance,
    );
    this.camera.lookAt(lookTarget);
    this.camera.updateMatrixWorld();
  }

  private resolveCameraPlacement(preferredAngle: number): { angle: number; distance: number } {
    let bestAngle = preferredAngle;
    let bestClearance = 0;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const offset of createAngleSearchOffsets()) {
      const angle = preferredAngle + offset;
      const clearance = this.readClearance(angle);
      const score = clearance - Math.abs(offset) * 0.22;
      if (score > bestScore) {
        bestScore = score;
        bestAngle = angle;
        bestClearance = clearance;
      }
      if (Math.abs(offset) < 0.0001 && clearance >= DEATH_MIN_CAMERA_DISTANCE) {
        break;
      }
    }

    return {
      angle: bestAngle,
      distance: Math.max(1.55, Math.min(DEATH_ORBIT_RADIUS, bestClearance)),
    };
  }

  private readClearance(angle: number): number {
    const directionX = Math.cos(angle);
    const directionZ = Math.sin(angle);
    const hit = raycastLevel(
      this.deathPosition.x,
      this.deathPosition.z,
      directionX,
      directionZ,
      DEATH_ORBIT_RADIUS,
    );
    if (!hit) {
      return DEATH_ORBIT_RADIUS;
    }

    return Math.max(0, Math.min(DEATH_ORBIT_RADIUS, hit.distance - DEATH_CAMERA_WALL_PADDING));
  }

}

function createAngleSearchOffsets(): number[] {
  const offsets = [0];
  for (let step = 1; step <= 8; step++) {
    offsets.push(DEATH_CAMERA_SEARCH_STEP * step, -DEATH_CAMERA_SEARCH_STEP * step);
  }
  return offsets;
}

function createDeathLights(): THREE.Light[] {
  const key = new THREE.PointLight(0xffd181, 2.2, 7.5);
  key.position.set(-1.8, 2.9, 1.8);
  const rim = new THREE.PointLight(0x7cffd6, 1.65, 6.8);
  rim.position.set(1.8, 1.8, -1.4);
  return [key, rim];
}

function normalizeDeathModel(model: THREE.Object3D): void {
  model.traverse((object) => {
    object.frustumCulled = false;
    if (object instanceof THREE.Mesh) {
      object.visible = true;
      object.castShadow = false;
      object.receiveShadow = false;
      object.renderOrder = 10;
      object.material = Array.isArray(object.material)
        ? object.material.map((material) => createDeathDisplayMaterial(material))
        : createDeathDisplayMaterial(object.material);
    }
  });
}

function createDeathDisplayMaterial(source: THREE.Material): THREE.Material {
  const material = source.clone();
  material.name = source.name ? `${source.name}.death-display` : 'death-display-character-material';
  material.side = THREE.DoubleSide;
  material.depthTest = true;
  material.depthWrite = true;
  material.transparent = false;
  material.opacity = 1;
  material.clippingPlanes = null;
  material.clipIntersection = false;
  if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial) {
    material.roughness = Math.max(material.roughness, 0.66);
    material.metalness = Math.min(material.metalness, 0.12);
  }
  const textured = material as THREE.Material & { map?: THREE.Texture | null };
  if (textured.map) {
    textured.map.colorSpace = THREE.SRGBColorSpace;
    textured.map.minFilter = THREE.LinearFilter;
    textured.map.magFilter = THREE.LinearFilter;
    textured.map.needsUpdate = true;
  }
  material.needsUpdate = true;
  return material;
}

function setObjectLayer(object: THREE.Object3D, layer: number): void {
  object.traverse((child) => {
    child.layers.set(layer);
  });
}

function readDeathScale(model: THREE.Object3D): number {
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  return size.y > 0.0001 ? DEATH_CHARACTER_TARGET_HEIGHT / size.y : 1;
}

function centerModelOnDeathOrigin(model: THREE.Object3D): void {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(model);
  if (box.isEmpty()) {
    return;
  }

  const center = new THREE.Vector3();
  box.getCenter(center);
  model.position.x -= center.x;
  model.position.y -= box.min.y;
  model.position.z -= center.z;
}

function disposeObject3D(object: THREE.Object3D): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      for (const material of materials) {
        material.dispose();
      }
    }
  });
}

function vectorSnapshot(vector: THREE.Vector3): [number, number, number] {
  return [roundMetric(vector.x), roundMetric(vector.y), roundMetric(vector.z)];
}

function objectBoundsSnapshot(object: THREE.Object3D | null): DeathCinematicStageSnapshot['modelBounds'] {
  if (!object) {
    return null;
  }

  object.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(object);
  if (box.isEmpty()) {
    return null;
  }

  const center = new THREE.Vector3();
  const size = new THREE.Vector3();
  box.getCenter(center);
  box.getSize(size);
  return {
    center: vectorSnapshot(center),
    size: vectorSnapshot(size),
  };
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

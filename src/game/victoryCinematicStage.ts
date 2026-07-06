import * as THREE from 'three';
import { raycastLevel } from './levelMap';
import {
  PLAYER_CHARACTER_ASSET,
  clonePlayerCharacterScene,
  findPlayerCharacterClip,
  loadPlayerCharacterGltf,
} from './playerCharacterAsset';

const VICTORY_CHARACTER_TARGET_HEIGHT = 1.78;
const VICTORY_CHARACTER_SKINNED_SCALE_CORRECTION = 0.01;
const VICTORY_ORBIT_RADIUS = 4.6;
const VICTORY_CAMERA_HEIGHT = 1.65;
const VICTORY_LOOK_TARGET_Y = 0.78;
const VICTORY_ORBIT_SECONDS = 5.6;
const VICTORY_START_ANGLE_OFFSET = THREE.MathUtils.degToRad(128);
const VICTORY_CAMERA_WALL_PADDING = 0.48;
const VICTORY_MIN_CAMERA_DISTANCE = 2.45;
const VICTORY_CAMERA_SEARCH_STEP = Math.PI / 10;
const VICTORY_MODEL_FRONT_YAW_OFFSET = 0;
const LEVEL_RENDER_LAYER = 0;
const VICTORY_CINEMATIC_RENDER_LAYER = 1;

export interface VictoryCinematicOpenInput {
  playerPosition: readonly [number, number, number];
  yawRadians: number;
}

export interface VictoryCinematicStageSnapshot {
  assetId: string;
  modelPath: string;
  loaded: boolean;
  modelBytesLoaded: number;
  clipId: 'dance';
  clipDurationSeconds: number;
  visible: boolean;
  phaseTimeSeconds: number;
  orbitAngleRadians: number;
  celebrationPosition: [number, number, number] | null;
  cameraPosition: [number, number, number] | null;
  modelBounds: {
    center: [number, number, number];
    size: [number, number, number];
  } | null;
  errors: string[];
}

export class VictoryCinematicStage {
  private readonly root = new THREE.Group();
  private readonly modelRoot = new THREE.Group();
  private readonly lightRoot = new THREE.Group();
  private readonly errors: string[] = [];
  private readonly celebrationPosition = new THREE.Vector3();
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
    this.root.name = 'victory-cinematic-world-root';
    this.modelRoot.name = 'victory-cinematic-model-root';
    this.lightRoot.name = 'victory-cinematic-light-root';
    this.lightRoot.add(...createVictoryLights());
    setObjectLayer(this.root, VICTORY_CINEMATIC_RENDER_LAYER);
    setObjectLayer(this.modelRoot, VICTORY_CINEMATIC_RENDER_LAYER);
    setObjectLayer(this.lightRoot, VICTORY_CINEMATIC_RENDER_LAYER);
    this.root.visible = false;
    this.root.add(this.modelRoot, this.lightRoot);
    this.scene.add(this.root);
  }

  load(): Promise<void> {
    this.loadPromise ??= loadPlayerCharacterGltf()
      .then((gltf) => {
        this.model = clonePlayerCharacterScene(gltf.scene);
        this.model.name = `${PLAYER_CHARACTER_ASSET.id}.victory-cinematic`;
        normalizeVictoryModel(this.model);
        setObjectLayer(this.model, VICTORY_CINEMATIC_RENDER_LAYER);
        this.model.scale.setScalar(readVictoryScale(this.model) * VICTORY_CHARACTER_SKINNED_SCALE_CORRECTION);
        centerModelOnVictoryOrigin(this.model);
        this.modelRoot.add(this.model);

        const clip = findPlayerCharacterClip(gltf.animations, 'dance');
        if (!clip) {
          this.errors.push(`${PLAYER_CHARACTER_ASSET.id}: missing dance clip`);
          return;
        }

        this.clipDurationSeconds = clip.duration;
        this.mixer = new THREE.AnimationMixer(this.model);
        this.activeAction = this.mixer.clipAction(clip);
        this.activeAction.reset().setLoop(THREE.LoopRepeat, Number.POSITIVE_INFINITY).play();
        this.activeAction.paused = true;
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.errors.push(`${PLAYER_CHARACTER_ASSET.id}: ${message}`);
      });

    return this.loadPromise;
  }

  open(input: VictoryCinematicOpenInput): void {
    this.visible = true;
    this.root.visible = true;
    this.phaseTimeSeconds = 0;
    this.celebrationPosition.set(input.playerPosition[0], 0, input.playerPosition[2]);
    this.root.position.copy(this.celebrationPosition);
    this.orbitAngleRadians = input.yawRadians + VICTORY_START_ANGLE_OFFSET;
    this.updateCamera();

    void this.load().then(() => {
      if (this.model) {
        this.model.rotation.y = input.yawRadians + Math.PI;
      }
      this.mixer?.setTime(0);
      if (this.activeAction) {
        this.activeAction.paused = false;
        this.activeAction.reset().setLoop(THREE.LoopRepeat, Number.POSITIVE_INFINITY).play();
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
    this.orbitAngleRadians += (deltaSeconds / VICTORY_ORBIT_SECONDS) * Math.PI * 1.65;
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
    this.camera.layers.set(VICTORY_CINEMATIC_RENDER_LAYER);
    renderer.render(this.scene, this.camera);

    this.scene.background = previousBackground;
    renderer.autoClear = previousAutoClear;
    this.camera.layers.mask = previousLayerMask;
  }

  getSnapshot(): VictoryCinematicStageSnapshot {
    return {
      assetId: PLAYER_CHARACTER_ASSET.id,
      modelPath: PLAYER_CHARACTER_ASSET.modelPath,
      loaded: this.model !== null,
      modelBytesLoaded: this.model ? PLAYER_CHARACTER_ASSET.modelBytes : 0,
      clipId: 'dance',
      clipDurationSeconds: roundMetric(this.clipDurationSeconds),
      visible: this.visible,
      phaseTimeSeconds: roundMetric(this.phaseTimeSeconds),
      orbitAngleRadians: roundMetric(this.orbitAngleRadians),
      celebrationPosition: this.visible ? vectorSnapshot(this.celebrationPosition) : null,
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
      this.celebrationPosition.x,
      VICTORY_LOOK_TARGET_Y,
      this.celebrationPosition.z,
    );
    const placement = this.resolveCameraPlacement(this.orbitAngleRadians);
    this.camera.position.set(
      this.celebrationPosition.x + Math.cos(placement.angle) * placement.distance,
      VICTORY_CAMERA_HEIGHT,
      this.celebrationPosition.z + Math.sin(placement.angle) * placement.distance,
    );
    this.camera.lookAt(lookTarget);
    this.camera.updateMatrixWorld();
    this.faceModelTowardCamera();
  }

  private resolveCameraPlacement(preferredAngle: number): { angle: number; distance: number } {
    let bestAngle = preferredAngle;
    let bestClearance = 0;
    let bestScore = Number.NEGATIVE_INFINITY;

    for (const offset of createAngleSearchOffsets()) {
      const angle = preferredAngle + offset;
      const clearance = this.readClearance(angle);
      const score = clearance - Math.abs(offset) * 0.24;
      if (score > bestScore) {
        bestScore = score;
        bestAngle = angle;
        bestClearance = clearance;
      }
      if (Math.abs(offset) < 0.0001 && clearance >= VICTORY_MIN_CAMERA_DISTANCE) {
        break;
      }
    }

    return {
      angle: bestAngle,
      distance: Math.max(1.65, Math.min(VICTORY_ORBIT_RADIUS, bestClearance)),
    };
  }

  private readClearance(angle: number): number {
    const directionX = Math.cos(angle);
    const directionZ = Math.sin(angle);
    const hit = raycastLevel(
      this.celebrationPosition.x,
      this.celebrationPosition.z,
      directionX,
      directionZ,
      VICTORY_ORBIT_RADIUS,
    );
    if (!hit) {
      return VICTORY_ORBIT_RADIUS;
    }

    return Math.max(0, Math.min(VICTORY_ORBIT_RADIUS, hit.distance - VICTORY_CAMERA_WALL_PADDING));
  }

  private faceModelTowardCamera(): void {
    if (!this.model) {
      return;
    }

    const angleToCamera = Math.atan2(
      this.camera.position.x - this.celebrationPosition.x,
      this.camera.position.z - this.celebrationPosition.z,
    );
    this.model.rotation.y = angleToCamera + VICTORY_MODEL_FRONT_YAW_OFFSET;
  }
}

function createAngleSearchOffsets(): number[] {
  const offsets = [0];
  for (let step = 1; step <= 10; step++) {
    offsets.push(VICTORY_CAMERA_SEARCH_STEP * step, -VICTORY_CAMERA_SEARCH_STEP * step);
  }
  return offsets;
}

function createVictoryLights(): THREE.Light[] {
  const key = new THREE.PointLight(0xffd181, 2.35, 8.5);
  key.position.set(-1.7, 3.2, 1.5);
  const rift = new THREE.PointLight(0x78ffd7, 2.5, 8);
  rift.position.set(1.4, 1.8, -1.8);
  const fill = new THREE.HemisphereLight(0xbfffee, 0x101820, 0.8);
  return [key, rift, fill];
}

function normalizeVictoryModel(model: THREE.Object3D): void {
  model.traverse((object) => {
    object.frustumCulled = false;
    if (object instanceof THREE.Mesh) {
      object.visible = true;
      object.castShadow = false;
      object.receiveShadow = false;
      object.renderOrder = 10;
      object.material = Array.isArray(object.material)
        ? object.material.map((material) => createVictoryDisplayMaterial(material))
        : createVictoryDisplayMaterial(object.material);
    }
  });
}

function createVictoryDisplayMaterial(source: THREE.Material): THREE.Material {
  const material = source.clone();
  material.name = source.name ? `${source.name}.victory-display` : 'victory-display-character-material';
  material.side = THREE.DoubleSide;
  material.depthTest = true;
  material.depthWrite = true;
  material.transparent = false;
  material.opacity = 1;
  material.clippingPlanes = null;
  material.clipIntersection = false;
  if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial) {
    material.roughness = Math.max(material.roughness, 0.58);
    material.metalness = Math.min(material.metalness, 0.1);
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

function readVictoryScale(model: THREE.Object3D): number {
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  return size.y > 0.0001 ? VICTORY_CHARACTER_TARGET_HEIGHT / size.y : 1;
}

function centerModelOnVictoryOrigin(model: THREE.Object3D): void {
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

function objectBoundsSnapshot(object: THREE.Object3D | null): VictoryCinematicStageSnapshot['modelBounds'] {
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

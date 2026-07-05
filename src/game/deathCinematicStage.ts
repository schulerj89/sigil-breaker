import * as THREE from 'three';
import {
  PLAYER_CHARACTER_ASSET,
  clonePlayerCharacterScene,
  findPlayerCharacterClip,
  loadPlayerCharacterGltf,
} from './playerCharacterAsset';

const DEATH_CHARACTER_TARGET_HEIGHT = 1.78;
const DEATH_ORBIT_RADIUS = 3.55;
const DEATH_CAMERA_HEIGHT = 1.42;
const DEATH_LOOK_TARGET_Y = 0.58;
const DEATH_ORBIT_SECONDS = 3.8;
const DEATH_START_ANGLE = THREE.MathUtils.degToRad(42);

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
  errors: string[];
}

export class DeathCinematicStage {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(44, 1, 0.1, 80);
  private readonly modelRoot = new THREE.Group();
  private readonly errors: string[] = [];
  private model: THREE.Object3D | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private activeAction: THREE.AnimationAction | null = null;
  private loadPromise: Promise<void> | null = null;
  private clipDurationSeconds = 0;
  private visible = false;
  private phaseTimeSeconds = 0;
  private orbitAngleRadians = DEATH_START_ANGLE;

  constructor() {
    this.scene.name = 'death-cinematic-stage';
    this.scene.background = new THREE.Color(0x050708);
    this.scene.fog = new THREE.Fog(0x050708, 6, 16);
    this.modelRoot.name = 'death-cinematic-model-root';
    this.modelRoot.position.set(0, -0.9, 0);
    this.scene.add(this.modelRoot, createDeathFloor(), ...createDeathLights());
    this.resize(1, 1);
  }

  load(): Promise<void> {
    this.loadPromise ??= loadPlayerCharacterGltf()
      .then((gltf) => {
        this.model = clonePlayerCharacterScene(gltf.scene);
        this.model.name = `${PLAYER_CHARACTER_ASSET.id}.death-cinematic`;
        normalizeDeathModel(this.model);
        this.model.scale.setScalar(readDeathScale(this.model));
        this.model.rotation.y = THREE.MathUtils.degToRad(198);
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

  open(): void {
    this.visible = true;
    this.phaseTimeSeconds = 0;
    this.orbitAngleRadians = DEATH_START_ANGLE;
    void this.load().then(() => {
      this.mixer?.setTime(0);
      if (this.activeAction) {
        this.activeAction.paused = false;
        this.activeAction.reset().setLoop(THREE.LoopOnce, 1).play();
      }
    });
  }

  close(): void {
    this.visible = false;
    this.activeAction?.stop();
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
  }

  resize(width: number, height: number): void {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.updateCamera();
  }

  update(deltaSeconds: number): void {
    if (!this.visible) {
      return;
    }

    this.phaseTimeSeconds += deltaSeconds;
    this.orbitAngleRadians = DEATH_START_ANGLE + (this.phaseTimeSeconds / DEATH_ORBIT_SECONDS) * Math.PI * 2;
    this.mixer?.update(deltaSeconds);
    this.updateCamera();
  }

  render(renderer: THREE.WebGLRenderer): void {
    const localClippingEnabled = renderer.localClippingEnabled;
    renderer.localClippingEnabled = false;
    renderer.render(this.scene, this.camera);
    renderer.localClippingEnabled = localClippingEnabled;
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
      errors: [...this.errors],
    };
  }

  dispose(): void {
    this.activeAction?.stop();
    this.mixer?.stopAllAction();
    this.model?.removeFromParent();
    this.model = null;
    this.scene.clear();
  }

  private updateCamera(): void {
    const x = Math.cos(this.orbitAngleRadians) * DEATH_ORBIT_RADIUS;
    const z = Math.sin(this.orbitAngleRadians) * DEATH_ORBIT_RADIUS;
    this.camera.position.set(x, DEATH_CAMERA_HEIGHT, z);
    this.camera.lookAt(0, DEATH_LOOK_TARGET_Y, 0);
  }
}

function createDeathFloor(): THREE.Mesh {
  const geometry = new THREE.CircleGeometry(3.4, 48);
  const material = new THREE.MeshStandardMaterial({
    color: 0x0d1719,
    roughness: 0.78,
    metalness: 0.32,
    emissive: 0x052016,
    emissiveIntensity: 0.22,
  });
  const floor = new THREE.Mesh(geometry, material);
  floor.name = 'death-cinematic-floor';
  floor.rotation.x = -Math.PI / 2;
  return floor;
}

function createDeathLights(): THREE.Light[] {
  const ambient = new THREE.HemisphereLight(0xcdf8ee, 0x101010, 1.05);
  const key = new THREE.DirectionalLight(0xffd181, 2.2);
  key.position.set(-2.2, 4.2, 3.4);
  const rim = new THREE.DirectionalLight(0x7cffd6, 1.8);
  rim.position.set(3.6, 2.0, -2.4);
  const lowGlow = new THREE.PointLight(0x7dffbd, 2.1, 5.5);
  lowGlow.position.set(0.4, 0.25, 1.8);
  return [ambient, key, rim, lowGlow];
}

function normalizeDeathModel(model: THREE.Object3D): void {
  model.traverse((object) => {
    object.frustumCulled = false;
    if (object instanceof THREE.Mesh) {
      object.visible = true;
      object.castShadow = false;
      object.receiveShadow = false;
      object.renderOrder = 8;
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

function readDeathScale(model: THREE.Object3D): number {
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  return size.y > 0.0001 ? DEATH_CHARACTER_TARGET_HEIGHT / size.y : 1;
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

import * as THREE from 'three';
import {
  PLAYER_CHARACTER_ASSET,
  clonePlayerCharacterScene,
  findPlayerCharacterClip,
  loadPlayerCharacterGltf,
} from './playerCharacterAsset';
import { publicAssetUrl } from './assetUrls';

const TITLE_CHARACTER_TARGET_HEIGHT = 1.9;
const TITLE_CHARACTER_X = 2.16;
const TITLE_CHARACTER_Y = -0.78;
const TITLE_CHARACTER_Z = 1.12;

export interface TitleHeroStageSnapshot {
  assetId: string;
  modelPath: string;
  loaded: boolean;
  modelBytesLoaded: number;
  clipId: string;
  clipDurationSeconds: number;
  visible: boolean;
  errors: string[];
  bounds: {
    width: number;
    height: number;
    depth: number;
  } | null;
  screenBounds: {
    left: number;
    top: number;
    right: number;
    bottom: number;
  } | null;
}

export class TitleHeroStage {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 60);
  private readonly modelRoot = new THREE.Group();
  private readonly errors: string[] = [];
  private backgroundTexture: THREE.Texture | null = null;
  private model: THREE.Object3D | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private activeAction: THREE.AnimationAction | null = null;
  private loadPromise: Promise<void> | null = null;
  private clipDurationSeconds = 0;
  private bounds: TitleHeroStageSnapshot['bounds'] = null;
  private screenBounds: TitleHeroStageSnapshot['screenBounds'] = null;
  private visible = true;
  private viewportWidth = 1;
  private viewportHeight = 1;

  constructor(private readonly backgroundPath: string) {
    this.scene.name = 'title-hero-stage';
    this.scene.background = new THREE.Color(0x101417);
    this.scene.fog = new THREE.Fog(0x101417, 8, 22);
    this.modelRoot.name = 'title-hero-model-root';
    this.modelRoot.position.set(TITLE_CHARACTER_X, TITLE_CHARACTER_Y, TITLE_CHARACTER_Z);
    this.scene.add(this.modelRoot, ...createTitleLights());
    this.resize(1, 1);
  }

  load(): Promise<void> {
    this.loadPromise ??= Promise.all([loadPlayerCharacterGltf(), loadTitleBackgroundTexture(this.backgroundPath)])
      .then(([gltf, backgroundTexture]) => {
        this.backgroundTexture = backgroundTexture;
        this.scene.background = backgroundTexture;
        this.model = clonePlayerCharacterScene(gltf.scene);
        this.model.name = `${PLAYER_CHARACTER_ASSET.id}.title`;
        normalizeTitleModel(this.model);
        this.model.rotation.y = THREE.MathUtils.degToRad(-12);
        this.model.scale.setScalar(readTitleScale(this.model));
        this.modelRoot.add(this.model);

        const clip = findPlayerCharacterClip(gltf.animations, PLAYER_CHARACTER_ASSET.titleClipName);
        if (!clip) {
          this.errors.push(`${PLAYER_CHARACTER_ASSET.id}: missing ${PLAYER_CHARACTER_ASSET.titleClipName} clip`);
          return;
        }

        this.clipDurationSeconds = clip.duration;
        this.mixer = new THREE.AnimationMixer(this.model);
        this.activeAction = this.mixer.clipAction(clip);
        this.activeAction.reset().setLoop(THREE.LoopRepeat, Number.POSITIVE_INFINITY).play();
        this.bounds = readBounds(this.model);
        this.updateScreenBounds();
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        this.errors.push(`${PLAYER_CHARACTER_ASSET.id}: ${message}`);
      });

    return this.loadPromise;
  }

  setVisible(visible: boolean): void {
    this.visible = visible;
  }

  resize(width: number, height: number): void {
    const aspect = width / Math.max(1, height);
    this.camera.aspect = aspect;
    const narrowLandscapeShift = Math.max(0, 1.75 - aspect) * 1.5;
    this.modelRoot.position.x = TITLE_CHARACTER_X - narrowLandscapeShift;
    this.camera.position.set(0, 0.62, 4.45);
    this.camera.lookAt(0.96, 0.2, 0.28);
    this.camera.updateProjectionMatrix();
    this.viewportWidth = width;
    this.viewportHeight = height;
    this.updateScreenBounds();
  }

  update(deltaSeconds: number, elapsedSeconds: number): void {
    if (!this.visible) {
      return;
    }

    void elapsedSeconds;
    this.mixer?.update(deltaSeconds);
  }

  render(renderer: THREE.WebGLRenderer): void {
    const localClippingEnabled = renderer.localClippingEnabled;
    renderer.localClippingEnabled = false;
    renderer.render(this.scene, this.camera);
    renderer.localClippingEnabled = localClippingEnabled;
  }

  getSnapshot(): TitleHeroStageSnapshot {
    return {
      assetId: PLAYER_CHARACTER_ASSET.id,
      modelPath: PLAYER_CHARACTER_ASSET.modelPath,
      loaded: this.model !== null,
      modelBytesLoaded: this.model ? PLAYER_CHARACTER_ASSET.modelBytes : 0,
      clipId: PLAYER_CHARACTER_ASSET.titleClipName,
      clipDurationSeconds: roundMetric(this.clipDurationSeconds),
      visible: this.visible,
      errors: [...this.errors],
      bounds: this.bounds,
      screenBounds: this.screenBounds,
    };
  }

  dispose(): void {
    this.activeAction?.stop();
    this.mixer?.stopAllAction();
    this.model?.removeFromParent();
    this.model = null;
    this.scene.clear();
    this.backgroundTexture?.dispose();
    this.backgroundTexture = null;
  }

  private updateScreenBounds(): void {
    if (!this.model) {
      this.screenBounds = null;
      return;
    }

    this.modelRoot.updateMatrixWorld(true);
    this.camera.updateMatrixWorld(true);
    this.screenBounds = readScreenBounds(this.model, this.camera, this.viewportWidth, this.viewportHeight);
  }
}

async function loadTitleBackgroundTexture(path: string): Promise<THREE.Texture> {
  const texture = await new THREE.TextureLoader().loadAsync(publicAssetUrl(path));
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  return texture;
}

function createTitleLights(): THREE.Light[] {
  const ambient = new THREE.HemisphereLight(0xd7fff3, 0x141414, 1.25);
  const key = new THREE.DirectionalLight(0xffd080, 2.1);
  key.position.set(-2.8, 3.6, 4.4);
  const rim = new THREE.DirectionalLight(0x70f7ff, 1.45);
  rim.position.set(3.2, 2.2, -2.6);
  const fill = new THREE.PointLight(0x77ffc7, 2.2, 7);
  fill.position.set(1.45, 0.6, 1.8);
  return [ambient, key, rim, fill];
}

function normalizeTitleModel(model: THREE.Object3D): void {
  model.traverse((object) => {
    object.frustumCulled = false;
    if (object instanceof THREE.Mesh) {
      object.visible = true;
      object.castShadow = false;
      object.receiveShadow = false;
      object.renderOrder = 10;
      object.material = Array.isArray(object.material)
        ? object.material.map((material) => createTitleDisplayMaterial(material))
        : createTitleDisplayMaterial(object.material);
    }
  });
}

function createTitleDisplayMaterial(source: THREE.Material): THREE.Material {
  const material = source.clone();
  material.name = source.name ? `${source.name}.title-display` : 'title-display-character-material';
  material.side = THREE.DoubleSide;
  material.depthTest = true;
  material.depthWrite = true;
  material.transparent = false;
  material.opacity = 1;
  material.clippingPlanes = null;
  material.clipIntersection = false;
  if (material instanceof THREE.MeshStandardMaterial || material instanceof THREE.MeshPhysicalMaterial) {
    material.roughness = Math.max(material.roughness, 0.62);
    material.metalness = Math.min(material.metalness, 0.12);
  }
  const materialWithTexture = material as THREE.Material & {
    map?: THREE.Texture | null;
  };
  if (materialWithTexture.map) {
    materialWithTexture.map.colorSpace = THREE.SRGBColorSpace;
    materialWithTexture.map.minFilter = THREE.LinearFilter;
    materialWithTexture.map.magFilter = THREE.LinearFilter;
    materialWithTexture.map.needsUpdate = true;
  }
  material.needsUpdate = true;
  return material;
}

function readBounds(model: THREE.Object3D): TitleHeroStageSnapshot['bounds'] {
  model.updateMatrixWorld(true);
  const box = readWorldBounds(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  return {
    width: roundMetric(size.x),
    height: roundMetric(size.y),
    depth: roundMetric(size.z),
  };
}

function readTitleScale(model: THREE.Object3D): number {
  const box = readWorldBounds(model);
  const size = new THREE.Vector3();
  box.getSize(size);
  if (size.y <= 0.0001) {
    return 1;
  }
  return TITLE_CHARACTER_TARGET_HEIGHT / size.y;
}

function readScreenBounds(
  model: THREE.Object3D,
  camera: THREE.Camera,
  viewportWidth: number,
  viewportHeight: number,
): TitleHeroStageSnapshot['screenBounds'] {
  model.updateMatrixWorld(true);
  const box = readWorldBounds(model);
  if (box.isEmpty()) {
    return null;
  }

  const points = [
    new THREE.Vector3(box.min.x, box.min.y, box.min.z),
    new THREE.Vector3(box.min.x, box.min.y, box.max.z),
    new THREE.Vector3(box.min.x, box.max.y, box.min.z),
    new THREE.Vector3(box.min.x, box.max.y, box.max.z),
    new THREE.Vector3(box.max.x, box.min.y, box.min.z),
    new THREE.Vector3(box.max.x, box.min.y, box.max.z),
    new THREE.Vector3(box.max.x, box.max.y, box.min.z),
    new THREE.Vector3(box.max.x, box.max.y, box.max.z),
  ];

  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    point.project(camera);
    left = Math.min(left, (point.x * 0.5 + 0.5) * viewportWidth);
    right = Math.max(right, (point.x * 0.5 + 0.5) * viewportWidth);
    top = Math.min(top, (-point.y * 0.5 + 0.5) * viewportHeight);
    bottom = Math.max(bottom, (-point.y * 0.5 + 0.5) * viewportHeight);
  }

  return {
    left: roundMetric(left),
    top: roundMetric(top),
    right: roundMetric(right),
    bottom: roundMetric(bottom),
  };
}

function readWorldBounds(model: THREE.Object3D): THREE.Box3 {
  model.updateMatrixWorld(true);
  const box = new THREE.Box3();
  const point = new THREE.Vector3();
  model.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) {
      return;
    }

    const position = object.geometry.getAttribute('position');
    if (!position) {
      return;
    }

    if (object instanceof THREE.SkinnedMesh) {
      for (let index = 0; index < position.count; index += 1) {
        object.applyBoneTransform(index, point.fromBufferAttribute(position, index));
        object.localToWorld(point);
        box.expandByPoint(point);
      }
      return;
    }

    for (let index = 0; index < position.count; index += 1) {
      point.fromBufferAttribute(position, index);
      object.localToWorld(point);
      box.expandByPoint(point);
    }
  });
  return box;
}

function roundMetric(value: number): number {
  return Math.round(value * 100) / 100;
}

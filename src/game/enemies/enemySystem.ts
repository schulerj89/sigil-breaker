import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { Health, type HealthSnapshot } from '../health';
import { collidesWithLevel, tileToWorld } from '../levelMap';
import {
  ENEMY_ASSET_DEFINITIONS,
  publicAssetUrl,
  type EnemyAssetDefinition,
} from './enemyManifest';

export interface EnemySnapshot {
  id: string;
  assetId: string;
  label: string;
  position: [number, number, number];
  health: HealthSnapshot;
  assetLoaded: boolean;
}

export interface EnemySystemSnapshot {
  total: number;
  alive: number;
  destroyed: number;
  enemies: EnemySnapshot[];
  modelBytesLoaded: number;
  loadedAssetIds: string[];
  assetLoadErrors: string[];
}

export interface EnemyShotHit {
  enemyId: string;
  distanceUnits: number;
  point: [number, number, number];
  health: HealthSnapshot;
  destroyed: boolean;
}

interface EnemyDefinition {
  id: string;
  asset: EnemyAssetDefinition;
  column: number;
  row: number;
  maxHealth: number;
  color: number;
}

const ENEMY_HEIGHT_UNITS = 1.8;
const ENEMY_WIDTH_UNITS = 0.86;
const DEFAULT_ENEMIES: readonly EnemyDefinition[] = [
  {
    id: 'enemy.monster.mushnub.vanguard',
    asset: ENEMY_ASSET_DEFINITIONS[0],
    column: 6,
    row: 1,
    maxHealth: 68,
    color: 0x8fd14f,
  },
  {
    id: 'enemy.monster.pink-slime.lane-anchor',
    asset: ENEMY_ASSET_DEFINITIONS[1],
    column: 14,
    row: 2,
    maxHealth: 70,
    color: 0xf472b6,
  },
  {
    id: 'enemy.monster.goleling.crosswatch',
    asset: ENEMY_ASSET_DEFINITIONS[2],
    column: 30,
    row: 13,
    maxHealth: 120,
    color: 0xa3a3a3,
  },
];

interface RuntimeEnemy {
  id: string;
  asset: EnemyAssetDefinition;
  health: Health;
  group: THREE.Group;
  visualSlot: THREE.Group;
  proxy: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  position: THREE.Vector3;
  assetLoaded: boolean;
}

export class EnemySystem {
  private readonly loadingManager = new THREE.LoadingManager();
  private readonly loader = new GLTFLoader(this.loadingManager);
  private readonly root = new THREE.Group();
  private readonly raycaster = new THREE.Raycaster();
  private readonly geometry = new THREE.BoxGeometry(ENEMY_WIDTH_UNITS, ENEMY_HEIGHT_UNITS, ENEMY_WIDTH_UNITS);
  private readonly enemies: RuntimeEnemy[] = [];
  private readonly loadedAssetIds = new Set<string>();
  private readonly assetLoadErrors: string[] = [];

  constructor(scene: THREE.Scene) {
    this.root.name = 'enemy-system';
    scene.add(this.root);
    this.loadingManager.setURLModifier((url) => url);

    for (const definition of DEFAULT_ENEMIES) {
      this.enemies.push(this.createEnemy(definition));
    }

    void this.preloadEnemyModels();
  }

  resolveShotHit(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number, damage: number): EnemyShotHit | null {
    if (maxDistance <= 0 || damage <= 0) {
      return null;
    }

    const candidates = this.enemies.filter((enemy) => enemy.health.isAlive).map((enemy) => enemy.proxy);
    if (candidates.length === 0) {
      return null;
    }

    this.root.updateMatrixWorld(true);
    this.raycaster.set(origin, direction.clone().normalize());
    this.raycaster.near = 0;
    this.raycaster.far = maxDistance;
    const [hit] = this.raycaster.intersectObjects(candidates, false);
    const enemyId = hit?.object.userData.enemyId;
    if (!hit || typeof enemyId !== 'string') {
      return null;
    }

    const enemy = this.enemies.find((candidate) => candidate.id === enemyId);
    if (!enemy || !enemy.health.isAlive) {
      return null;
    }

    const health = enemy.health.damage(damage);
    const destroyed = !health.isAlive;
    if (destroyed) {
      enemy.group.visible = false;
    } else {
      const healthRatio = health.ratio;
      enemy.proxy.material.emissiveIntensity = 0.18 + (1 - healthRatio) * 0.38;
    }

    return {
      enemyId,
      distanceUnits: roundMetric(hit.distance),
      point: [roundMetric(hit.point.x), roundMetric(hit.point.y), roundMetric(hit.point.z)],
      health,
      destroyed,
    };
  }

  getSnapshot(): EnemySystemSnapshot {
    const enemies = this.enemies.map((enemy) => ({
      id: enemy.id,
      assetId: enemy.asset.id,
      label: enemy.asset.label,
      position: [roundMetric(enemy.position.x), roundMetric(enemy.position.y), roundMetric(enemy.position.z)] satisfies [
        number,
        number,
        number,
      ],
      health: enemy.health.getSnapshot(),
      assetLoaded: enemy.assetLoaded,
    }));
    const alive = enemies.filter((enemy) => enemy.health.isAlive).length;

    return {
      total: enemies.length,
      alive,
      destroyed: enemies.length - alive,
      enemies,
      modelBytesLoaded: [...this.loadedAssetIds].reduce((total, assetId) => {
        const asset = ENEMY_ASSET_DEFINITIONS.find((definition) => definition.id === assetId);
        return total + (asset?.modelBytes ?? 0);
      }, 0),
      loadedAssetIds: [...this.loadedAssetIds].sort(),
      assetLoadErrors: [...this.assetLoadErrors],
    };
  }

  dispose(): void {
    this.root.removeFromParent();
    this.geometry.dispose();
    for (const enemy of this.enemies) {
      enemy.proxy.material.dispose();
      disposeObject3D(enemy.visualSlot);
    }
    this.enemies.length = 0;
    this.loadedAssetIds.clear();
  }

  private createEnemy(definition: EnemyDefinition): RuntimeEnemy {
    const { worldX, worldZ } = tileToWorld(definition.column, definition.row);
    if (collidesWithLevel(worldX, worldZ, ENEMY_WIDTH_UNITS / 2)) {
      throw new Error(`Enemy ${definition.id} is placed inside level collision.`);
    }

    const material = new THREE.MeshStandardMaterial({
      color: definition.color,
      roughness: 0.62,
      metalness: 0.12,
      emissive: definition.color,
      emissiveIntensity: 0.18,
      transparent: true,
      opacity: 0.34,
    });
    const proxy = new THREE.Mesh(this.geometry, material);
    proxy.name = `${definition.id}-hit-proxy`;
    proxy.userData.enemyId = definition.id;
    proxy.position.y = ENEMY_HEIGHT_UNITS / 2;

    const visualSlot = new THREE.Group();
    visualSlot.name = `${definition.id}-visual-slot`;

    const group = new THREE.Group();
    group.name = definition.id;
    const position = new THREE.Vector3(worldX, 0, worldZ);
    group.position.copy(position);
    group.add(proxy, visualSlot);
    this.root.add(group);

    return {
      id: definition.id,
      asset: definition.asset,
      health: new Health(definition.maxHealth),
      group,
      visualSlot,
      proxy,
      position,
      assetLoaded: false,
    };
  }

  private async preloadEnemyModels(): Promise<void> {
    await Promise.all(this.enemies.map((enemy) => this.loadEnemyModel(enemy)));
  }

  private async loadEnemyModel(enemy: RuntimeEnemy): Promise<void> {
    try {
      const gltf = await this.loader.loadAsync(publicAssetUrl(enemy.asset.modelPath));
      const object = gltf.scene;
      object.name = enemy.asset.id;
      object.traverse((child) => {
        child.frustumCulled = false;
      });
      fitObjectToEnemyProxy(object, enemy.asset);
      enemy.visualSlot.add(object);
      enemy.proxy.material.opacity = 0;
      enemy.assetLoaded = true;
      this.loadedAssetIds.add(enemy.asset.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.assetLoadErrors.push(`${enemy.asset.id}: ${message}`);
    }
  }
}

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function fitObjectToEnemyProxy(object: THREE.Object3D, asset: EnemyAssetDefinition): void {
  object.rotation.y = asset.yawRadians;
  object.updateMatrixWorld(true);
  const initialBox = new THREE.Box3().setFromObject(object);
  const initialSize = initialBox.getSize(new THREE.Vector3());
  const scale = initialSize.y > 0 ? asset.targetHeightUnits / initialSize.y : 1;
  object.scale.multiplyScalar(scale);
  object.updateMatrixWorld(true);

  const fittedBox = new THREE.Box3().setFromObject(object);
  const center = fittedBox.getCenter(new THREE.Vector3());
  object.position.x -= center.x;
  object.position.z -= center.z;
  object.position.y -= fittedBox.min.y;
}

function disposeObject3D(object: THREE.Object3D): void {
  const disposedGeometries = new Set<THREE.BufferGeometry>();
  const disposedMaterials = new Set<THREE.Material>();
  object.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.geometry && !disposedGeometries.has(mesh.geometry)) {
      disposedGeometries.add(mesh.geometry);
      mesh.geometry.dispose();
    }

    const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
    for (const material of materials) {
      if (!disposedMaterials.has(material)) {
        disposedMaterials.add(material);
        material.dispose();
      }
    }
  });
}

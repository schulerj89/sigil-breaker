import * as THREE from 'three';
import { Health, type HealthSnapshot } from '../health';
import { collidesWithLevel, tileToWorld } from '../levelMap';

export interface CubeEnemySnapshot {
  id: string;
  position: [number, number, number];
  health: HealthSnapshot;
}

export interface CubeEnemySystemSnapshot {
  total: number;
  alive: number;
  destroyed: number;
  enemies: CubeEnemySnapshot[];
}

export interface EnemyShotHit {
  enemyId: string;
  distanceUnits: number;
  point: [number, number, number];
  health: HealthSnapshot;
  destroyed: boolean;
}

interface CubeEnemyDefinition {
  id: string;
  column: number;
  row: number;
  maxHealth: number;
  color: number;
}

const ENEMY_HEIGHT_UNITS = 1.8;
const ENEMY_WIDTH_UNITS = 0.86;
const DEFAULT_CUBE_ENEMIES: readonly CubeEnemyDefinition[] = [
  { id: 'enemy.cube.vanguard', column: 6, row: 1, maxHealth: 68, color: 0xff615e },
  { id: 'enemy.cube.lane-anchor', column: 14, row: 2, maxHealth: 82, color: 0xff8a3d },
  { id: 'enemy.cube.crosswatch', column: 30, row: 13, maxHealth: 96, color: 0xc084fc },
];

interface RuntimeCubeEnemy {
  id: string;
  health: Health;
  group: THREE.Group;
  mesh: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  position: THREE.Vector3;
}

export class CubeEnemySystem {
  private readonly root = new THREE.Group();
  private readonly raycaster = new THREE.Raycaster();
  private readonly geometry = new THREE.BoxGeometry(ENEMY_WIDTH_UNITS, ENEMY_HEIGHT_UNITS, ENEMY_WIDTH_UNITS);
  private readonly enemies: RuntimeCubeEnemy[] = [];

  constructor(scene: THREE.Scene) {
    this.root.name = 'cube-enemy-system';
    scene.add(this.root);

    for (const definition of DEFAULT_CUBE_ENEMIES) {
      this.enemies.push(this.createEnemy(definition));
    }
  }

  resolveShotHit(origin: THREE.Vector3, direction: THREE.Vector3, maxDistance: number, damage: number): EnemyShotHit | null {
    if (maxDistance <= 0 || damage <= 0) {
      return null;
    }

    const candidates = this.enemies.filter((enemy) => enemy.health.isAlive).map((enemy) => enemy.mesh);
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
      enemy.mesh.material.emissiveIntensity = 0.18 + (1 - healthRatio) * 0.38;
    }

    return {
      enemyId,
      distanceUnits: roundMetric(hit.distance),
      point: [roundMetric(hit.point.x), roundMetric(hit.point.y), roundMetric(hit.point.z)],
      health,
      destroyed,
    };
  }

  getSnapshot(): CubeEnemySystemSnapshot {
    const enemies = this.enemies.map((enemy) => ({
      id: enemy.id,
      position: [roundMetric(enemy.position.x), roundMetric(enemy.position.y), roundMetric(enemy.position.z)] satisfies [
        number,
        number,
        number,
      ],
      health: enemy.health.getSnapshot(),
    }));
    const alive = enemies.filter((enemy) => enemy.health.isAlive).length;

    return {
      total: enemies.length,
      alive,
      destroyed: enemies.length - alive,
      enemies,
    };
  }

  dispose(): void {
    this.root.removeFromParent();
    this.geometry.dispose();
    for (const enemy of this.enemies) {
      enemy.mesh.material.dispose();
    }
    this.enemies.length = 0;
  }

  private createEnemy(definition: CubeEnemyDefinition): RuntimeCubeEnemy {
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
    });
    const mesh = new THREE.Mesh(this.geometry, material);
    mesh.name = `${definition.id}-mesh`;
    mesh.userData.enemyId = definition.id;

    const group = new THREE.Group();
    group.name = definition.id;
    const position = new THREE.Vector3(worldX, ENEMY_HEIGHT_UNITS / 2, worldZ);
    group.position.copy(position);
    group.add(mesh);
    this.root.add(group);

    return {
      id: definition.id,
      health: new Health(definition.maxHealth),
      group,
      mesh,
      position,
    };
  }
}

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

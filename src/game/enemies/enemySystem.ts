import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinnedModel } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { Health, type HealthSnapshot } from '../health';
import { collidesWithLevel, getEnemySpawnTiles, raycastLevel, resolveLevelCollision, tileToWorld } from '../levelMap';
import {
  ENEMY_ASSET_DEFINITIONS,
  publicAssetUrl,
  type EnemyAssetDefinition,
} from './enemyManifest';

export type EnemyAiState = 'patrolling' | 'tracking' | 'returning';

export interface EnemySnapshot {
  id: string;
  assetId: string;
  label: string;
  marker: {
    column: number;
    row: number;
  };
  position: [number, number, number];
  origin: [number, number, number];
  health: HealthSnapshot;
  assetLoaded: boolean;
  state: EnemyAiState;
  behavior: string;
  speedUnitsPerSecond: number;
  facingYawRadians: number;
  detectRadiusUnits: number;
  loseRadiusUnits: number;
  projectileRangeUnits: number;
  projectileCooldownSeconds: number;
  debugVisible: boolean;
  attachments: {
    visual: [number, number, number];
    hitProxy: [number, number, number];
    hitFlash: [number, number, number];
    debug: [number, number, number];
  };
  modelBounds: {
    center: [number, number, number];
    size: [number, number, number];
  } | null;
}

export interface EnemyProjectileSnapshot {
  sequence: number;
  ownerEnemyId: string;
  position: [number, number, number];
  velocity: [number, number, number];
  damage: number;
  remainingLifetimeSeconds: number;
}

export interface EnemySystemSnapshot {
  total: number;
  alive: number;
  destroyed: number;
  enemyMarkerCount: number;
  enemies: EnemySnapshot[];
  projectiles: {
    active: number;
    pooled: number;
    fired: number;
    hitPlayer: number;
    hitWall: number;
    shotsBlockedByWall: number;
    list: EnemyProjectileSnapshot[];
  };
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

export interface EnemyPlayerDamageSource {
  enemyId: string;
  projectileSequence: number;
  position: [number, number, number];
}

export interface EnemySystemOptions {
  damagePlayer?: (amount: number, source: EnemyPlayerDamageSource) => HealthSnapshot;
}

type EnemyMotionStyle = 'mushroom-hop' | 'slime-sway' | 'golem-stomp';

interface EnemyBehaviorDefinition {
  id: string;
  speedUnitsPerSecond: number;
  turnResponse: number;
  detectRadiusUnits: number;
  loseRadiusUnits: number;
  stopDistanceUnits: number;
  patrolReachUnits: number;
  projectileDamage: number;
  projectileSpeedUnitsPerSecond: number;
  projectileCooldownSeconds: number;
  projectileRangeUnits: number;
  patrolOffsets: ReadonlyArray<readonly [number, number]>;
  motionStyle: EnemyMotionStyle;
}

interface EnemyDefinition {
  id: string;
  asset: EnemyAssetDefinition;
  column: number;
  row: number;
  maxHealth: number;
  color: number;
  behavior: EnemyBehaviorDefinition;
}

interface RuntimeEnemy {
  id: string;
  asset: EnemyAssetDefinition;
  behavior: EnemyBehaviorDefinition;
  marker: {
    column: number;
    row: number;
  };
  health: Health;
  group: THREE.Group;
  visualSlot: THREE.Group;
  debugGroup: THREE.Group;
  debugLines: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
  hitFlash: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  proxy: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>;
  modelObject: THREE.Object3D | null;
  origin: THREE.Vector3;
  position: THREE.Vector3;
  state: EnemyAiState;
  patrolIndex: number;
  facingYawRadians: number;
  time: number;
  hitFlashSeconds: number;
  projectileCooldownSeconds: number;
  assetLoaded: boolean;
}

interface RuntimeProjectile {
  sequence: number;
  ownerEnemyId: string;
  mesh: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  damage: number;
  remainingLifetimeSeconds: number;
}

const ENEMY_WIDTH_UNITS = 0.86;
const ENEMY_HIT_HEIGHT_UNITS = 2.35;
const ENEMY_HIT_WIDTH_UNITS = 2.15;
const ENEMY_COLLISION_RADIUS = ENEMY_WIDTH_UNITS / 2;
const ENEMY_SEPARATION_UNITS = 1.25;
const ENEMY_RETURN_REACHED_UNITS = 0.16;
const ENEMY_HIT_FLASH_SECONDS = 0.16;
const DEBUG_RING_SEGMENTS = 40;
const DEBUG_FRONT_CONE_RADIANS = Math.PI / 7;
const PLAYER_PROJECTILE_HIT_RADIUS_UNITS = 0.48;
const PROJECTILE_RADIUS_UNITS = 0.2;
const PROJECTILE_SPAWN_FORWARD_UNITS = 0.72;
const PROJECTILE_PLAYER_TARGET_Y = 1.35;
const PROJECTILE_LINE_OF_SIGHT_PADDING_UNITS = 0.35;
const FIRST_TRACKING_PROJECTILE_DELAY_SECONDS = 0.08;
const ROLE_NAMES = [
  'vanguard',
  'lane-anchor',
  'crosswatch',
  'north-sentinel',
  'splitter-guard',
  'east-watch',
  'west-roamer',
  'middle-roamer',
  'right-roamer',
  'lower-left',
  'lower-center',
  'lower-right',
  'rear-watch',
] as const;

const MUSHROOM_BEHAVIOR: EnemyBehaviorDefinition = {
  id: 'mushroom-hop-square',
  speedUnitsPerSecond: 1.6,
  turnResponse: 7,
  detectRadiusUnits: 6.2,
  loseRadiusUnits: 8,
  stopDistanceUnits: 0.82,
  patrolReachUnits: 0.18,
  projectileDamage: 7,
  projectileSpeedUnitsPerSecond: 7.2,
  projectileCooldownSeconds: 1.35,
  projectileRangeUnits: 8.8,
  patrolOffsets: [
    [-1.2, -0.95],
    [1.2, -0.95],
    [1.2, 0.95],
    [-1.2, 0.95],
  ],
  motionStyle: 'mushroom-hop',
};

const SLIME_BEHAVIOR: EnemyBehaviorDefinition = {
  id: 'slime-side-sway',
  speedUnitsPerSecond: 1.775,
  turnResponse: 8,
  detectRadiusUnits: 5.8,
  loseRadiusUnits: 7.4,
  stopDistanceUnits: 0.78,
  patrolReachUnits: 0.16,
  projectileDamage: 6,
  projectileSpeedUnitsPerSecond: 8.1,
  projectileCooldownSeconds: 1.12,
  projectileRangeUnits: 8.2,
  patrolOffsets: [
    [-1.45, 0],
    [1.45, 0],
  ],
  motionStyle: 'slime-sway',
};

const GOLEM_BEHAVIOR: EnemyBehaviorDefinition = {
  id: 'goleling-heavy-square',
  speedUnitsPerSecond: 1.275,
  turnResponse: 5.6,
  detectRadiusUnits: 6.8,
  loseRadiusUnits: 8.6,
  stopDistanceUnits: 0.95,
  patrolReachUnits: 0.22,
  projectileDamage: 10,
  projectileSpeedUnitsPerSecond: 6.2,
  projectileCooldownSeconds: 1.75,
  projectileRangeUnits: 9.4,
  patrolOffsets: [
    [-1.15, -1.15],
    [1.15, -1.15],
    [1.15, 1.15],
    [-1.15, 1.15],
  ],
  motionStyle: 'golem-stomp',
};

const BEHAVIOR_BY_ASSET_ID = new Map<string, EnemyBehaviorDefinition>([
  [ENEMY_ASSET_DEFINITIONS[0].id, MUSHROOM_BEHAVIOR],
  [ENEMY_ASSET_DEFINITIONS[1].id, SLIME_BEHAVIOR],
  [ENEMY_ASSET_DEFINITIONS[2].id, GOLEM_BEHAVIOR],
]);

const HEALTH_BY_ASSET_ID = new Map<string, number>([
  [ENEMY_ASSET_DEFINITIONS[0].id, 68],
  [ENEMY_ASSET_DEFINITIONS[1].id, 70],
  [ENEMY_ASSET_DEFINITIONS[2].id, 120],
]);

const COLOR_BY_ASSET_ID = new Map<string, number>([
  [ENEMY_ASSET_DEFINITIONS[0].id, 0x8fd14f],
  [ENEMY_ASSET_DEFINITIONS[1].id, 0xf472b6],
  [ENEMY_ASSET_DEFINITIONS[2].id, 0xa3a3a3],
]);

export class EnemySystem {
  private readonly loadingManager = new THREE.LoadingManager();
  private readonly loader = new GLTFLoader(this.loadingManager);
  private readonly root = new THREE.Group();
  private readonly projectileRoot = new THREE.Group();
  private readonly raycaster = new THREE.Raycaster();
  private readonly hitGeometry = new THREE.BoxGeometry(ENEMY_HIT_WIDTH_UNITS, ENEMY_HIT_HEIGHT_UNITS, ENEMY_HIT_WIDTH_UNITS);
  private readonly hitFlashGeometry = new THREE.SphereGeometry(0.92, 16, 8);
  private readonly projectileGeometry = new THREE.SphereGeometry(PROJECTILE_RADIUS_UNITS, 12, 8);
  private readonly projectileMaterial = new THREE.MeshBasicMaterial({
    color: 0xff3f8f,
    transparent: true,
    opacity: 0.96,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  private readonly enemies: RuntimeEnemy[] = [];
  private readonly projectiles: RuntimeProjectile[] = [];
  private readonly projectileMeshPool: Array<THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>> = [];
  private readonly modelTemplates = new Map<string, THREE.Object3D>();
  private readonly loadedAssetIds = new Set<string>();
  private readonly assetLoadErrors: string[] = [];
  private readonly target = new THREE.Vector3();
  private readonly player = new THREE.Vector3();
  private projectileSequence = 0;
  private projectilesFired = 0;
  private projectilesHitPlayer = 0;
  private projectilesHitWall = 0;
  private projectileShotsBlockedByWall = 0;

  constructor(scene: THREE.Scene, private readonly options: EnemySystemOptions = {}) {
    this.root.name = 'enemy-system';
    this.projectileRoot.name = 'enemy-projectiles';
    scene.add(this.root, this.projectileRoot);
    this.loadingManager.setURLModifier((url) => url);

    for (const definition of createEnemyDefinitions()) {
      this.enemies.push(this.createEnemy(definition));
    }

    void this.preloadEnemyModels();
  }

  update(deltaSeconds: number, playerPosition: readonly [number, number, number], debugVisible: boolean): void {
    const cappedDelta = Math.min(Math.max(deltaSeconds, 0), 0.08);
    this.player.set(playerPosition[0], 0, playerPosition[2]);

    for (const enemy of this.enemies) {
      if (!enemy.health.isAlive) {
        enemy.debugGroup.visible = false;
        continue;
      }

      enemy.time += cappedDelta;
      this.updateEnemyState(enemy);
      const target = this.resolveEnemyTarget(enemy);
      const moved = this.moveEnemyToward(enemy, target, cappedDelta);
      if (enemy.state === 'tracking' || moved) {
        this.faceEnemyToward(enemy, target.x, target.z, cappedDelta);
      }
      this.tryFireProjectile(enemy, cappedDelta);
      this.applyVisualMotion(enemy);
      this.updateHitFlash(enemy, cappedDelta);
      this.updateDebugVisuals(enemy, debugVisible);
    }

    this.updateProjectiles(cappedDelta, playerPosition);
    this.separateLivingEnemies();
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
    enemy.hitFlashSeconds = ENEMY_HIT_FLASH_SECONDS;
    enemy.hitFlash.visible = true;
    const destroyed = !health.isAlive;
    if (destroyed) {
      enemy.group.visible = false;
      enemy.debugGroup.visible = false;
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
    this.root.updateMatrixWorld(true);
    const enemies = this.enemies.map((enemy) => ({
      id: enemy.id,
      assetId: enemy.asset.id,
      label: enemy.asset.label,
      marker: enemy.marker,
      position: vectorSnapshot(enemy.position),
      origin: vectorSnapshot(enemy.origin),
      health: enemy.health.getSnapshot(),
      assetLoaded: enemy.assetLoaded,
      state: enemy.state,
      behavior: enemy.behavior.id,
      speedUnitsPerSecond: roundMetric(enemy.behavior.speedUnitsPerSecond),
      facingYawRadians: roundMetric(enemy.facingYawRadians),
      detectRadiusUnits: enemy.behavior.detectRadiusUnits,
      loseRadiusUnits: enemy.behavior.loseRadiusUnits,
      projectileRangeUnits: enemy.behavior.projectileRangeUnits,
      projectileCooldownSeconds: roundMetric(enemy.projectileCooldownSeconds),
      debugVisible: enemy.debugGroup.visible,
      attachments: {
        visual: objectWorldSnapshot(enemy.visualSlot),
        hitProxy: objectWorldSnapshot(enemy.proxy),
        hitFlash: objectWorldSnapshot(enemy.hitFlash),
        debug: objectWorldSnapshot(enemy.debugGroup),
      },
      modelBounds: objectBoundsSnapshot(enemy.modelObject),
    }));
    const alive = enemies.filter((enemy) => enemy.health.isAlive).length;

    return {
      total: enemies.length,
      alive,
      destroyed: enemies.length - alive,
      enemyMarkerCount: this.enemies.length,
      enemies,
      projectiles: {
        active: this.projectiles.length,
        pooled: this.projectileMeshPool.length,
        fired: this.projectilesFired,
        hitPlayer: this.projectilesHitPlayer,
        hitWall: this.projectilesHitWall,
        shotsBlockedByWall: this.projectileShotsBlockedByWall,
        list: this.projectiles.map((projectile) => ({
          sequence: projectile.sequence,
          ownerEnemyId: projectile.ownerEnemyId,
          position: vectorSnapshot(projectile.position),
          velocity: vectorSnapshot(projectile.velocity),
          damage: projectile.damage,
          remainingLifetimeSeconds: roundMetric(projectile.remainingLifetimeSeconds),
        })),
      },
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
    const disposedGeometries = new Set<THREE.BufferGeometry>();
    const disposedMaterials = new Set<THREE.Material>();
    for (const enemy of this.enemies) {
      disposeObject3D(enemy.group, disposedGeometries, disposedMaterials);
    }
    for (const template of this.modelTemplates.values()) {
      disposeObject3D(template, disposedGeometries, disposedMaterials);
    }
    this.projectileRoot.removeFromParent();
    this.projectiles.length = 0;
    this.projectileMeshPool.length = 0;
    this.projectileGeometry.dispose();
    this.projectileMaterial.dispose();
    this.enemies.length = 0;
    this.modelTemplates.clear();
    this.loadedAssetIds.clear();
  }

  private createEnemy(definition: EnemyDefinition): RuntimeEnemy {
    const { worldX, worldZ } = tileToWorld(definition.column, definition.row);
    if (collidesWithLevel(worldX, worldZ, ENEMY_COLLISION_RADIUS)) {
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
    const proxy = new THREE.Mesh(this.hitGeometry, material);
    proxy.name = `${definition.id}-hit-proxy`;
    proxy.userData.enemyId = definition.id;
    proxy.position.y = ENEMY_HIT_HEIGHT_UNITS / 2;

    const visualSlot = new THREE.Group();
    visualSlot.name = `${definition.id}-visual-slot`;

    const hitFlash = createHitFlash(this.hitFlashGeometry, definition.id, definition.asset.targetHeightUnits);
    visualSlot.add(hitFlash);
    const debug = createDebugVisuals(definition.id, definition.behavior);
    debug.group.visible = false;

    const group = new THREE.Group();
    group.name = definition.id;
    const position = new THREE.Vector3(worldX, 0, worldZ);
    group.position.copy(position);
    group.add(proxy, visualSlot, debug.group);
    this.root.add(group);

    return {
      id: definition.id,
      asset: definition.asset,
      behavior: definition.behavior,
      marker: {
        column: definition.column,
        row: definition.row,
      },
      health: new Health(definition.maxHealth),
      group,
      visualSlot,
      debugGroup: debug.group,
      debugLines: debug.lines,
      hitFlash,
      proxy,
      modelObject: null,
      origin: position.clone(),
      position,
      state: 'patrolling',
      patrolIndex: 0,
      facingYawRadians: 0,
      time: 0,
      hitFlashSeconds: 0,
      projectileCooldownSeconds: getInitialProjectileCooldown(definition.column, definition.row, definition.behavior),
      assetLoaded: false,
    };
  }

  private async preloadEnemyModels(): Promise<void> {
    await Promise.all(ENEMY_ASSET_DEFINITIONS.map((asset) => this.loadEnemyTemplate(asset)));
    for (const enemy of this.enemies) {
      this.attachEnemyModel(enemy);
    }
  }

  private async loadEnemyTemplate(asset: EnemyAssetDefinition): Promise<void> {
    if (this.modelTemplates.has(asset.id)) {
      return;
    }

    try {
      const gltf = await this.loader.loadAsync(publicAssetUrl(asset.modelPath));
      const object = gltf.scene;
      object.name = `${asset.id}-template`;
      object.traverse((child) => {
        child.frustumCulled = false;
      });
      fitObjectToEnemyProxy(object, asset);
      this.modelTemplates.set(asset.id, object);
      this.loadedAssetIds.add(asset.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.assetLoadErrors.push(`${asset.id}: ${message}`);
    }
  }

  private attachEnemyModel(enemy: RuntimeEnemy): void {
    const template = this.modelTemplates.get(enemy.asset.id);
    if (!template) {
      return;
    }

    const object = cloneSkinnedModel(template);
    object.name = `${enemy.id}-visual`;
    object.traverse((child) => {
      child.frustumCulled = false;
    });
    enemy.visualSlot.add(object);
    enemy.modelObject = object;
    enemy.proxy.material.opacity = 0;
    enemy.assetLoaded = true;
  }

  private updateEnemyState(enemy: RuntimeEnemy): void {
    const playerDistanceSq = flatDistanceSquared(enemy.position, this.player);
    if (playerDistanceSq <= enemy.behavior.detectRadiusUnits * enemy.behavior.detectRadiusUnits) {
      if (enemy.state !== 'tracking') {
        enemy.projectileCooldownSeconds = Math.min(
          enemy.projectileCooldownSeconds,
          FIRST_TRACKING_PROJECTILE_DELAY_SECONDS,
        );
      }
      enemy.state = 'tracking';
      return;
    }

    if (enemy.state === 'tracking' && playerDistanceSq > enemy.behavior.loseRadiusUnits * enemy.behavior.loseRadiusUnits) {
      enemy.state = 'returning';
      return;
    }

    if (
      enemy.state === 'returning' &&
      flatDistanceSquared(enemy.position, enemy.origin) <= ENEMY_RETURN_REACHED_UNITS * ENEMY_RETURN_REACHED_UNITS
    ) {
      enemy.state = 'patrolling';
      enemy.patrolIndex = 0;
    }
  }

  private resolveEnemyTarget(enemy: RuntimeEnemy): THREE.Vector3 {
    if (enemy.state === 'tracking') {
      return this.target.copy(this.player);
    }

    if (enemy.state === 'returning') {
      return this.target.copy(enemy.origin);
    }

    return this.resolvePatrolTarget(enemy);
  }

  private resolvePatrolTarget(enemy: RuntimeEnemy): THREE.Vector3 {
    for (let attempt = 0; attempt < enemy.behavior.patrolOffsets.length; attempt++) {
      const offset = enemy.behavior.patrolOffsets[enemy.patrolIndex % enemy.behavior.patrolOffsets.length];
      const targetX = enemy.origin.x + offset[0];
      const targetZ = enemy.origin.z + offset[1];
      if (!collidesWithLevel(targetX, targetZ, ENEMY_COLLISION_RADIUS)) {
        this.target.set(targetX, 0, targetZ);
        if (flatDistanceSquared(enemy.position, this.target) <= enemy.behavior.patrolReachUnits * enemy.behavior.patrolReachUnits) {
          enemy.patrolIndex = (enemy.patrolIndex + 1) % enemy.behavior.patrolOffsets.length;
        }
        return this.target;
      }

      enemy.patrolIndex = (enemy.patrolIndex + 1) % enemy.behavior.patrolOffsets.length;
    }

    return this.target.copy(enemy.origin);
  }

  private moveEnemyToward(enemy: RuntimeEnemy, target: THREE.Vector3, deltaSeconds: number): boolean {
    const deltaX = target.x - enemy.position.x;
    const deltaZ = target.z - enemy.position.z;
    const distance = Math.hypot(deltaX, deltaZ);
    const stopDistance = enemy.state === 'tracking' ? enemy.behavior.stopDistanceUnits : 0;
    if (distance <= Math.max(stopDistance, 0.001)) {
      return false;
    }

    const step = Math.min(enemy.behavior.speedUnitsPerSecond * deltaSeconds, distance - stopDistance);
    if (step <= 0) {
      return false;
    }

    const candidateX = enemy.position.x + (deltaX / distance) * step;
    const candidateZ = enemy.position.z + (deltaZ / distance) * step;
    const resolved = resolveLevelCollision(candidateX, candidateZ, ENEMY_COLLISION_RADIUS, 3);
    enemy.position.set(resolved.x, 0, resolved.z);
    enemy.group.position.copy(enemy.position);

    return step > 0.0001;
  }

  private faceEnemyToward(enemy: RuntimeEnemy, targetX: number, targetZ: number, deltaSeconds: number): void {
    const deltaX = targetX - enemy.position.x;
    const deltaZ = targetZ - enemy.position.z;
    if (Math.hypot(deltaX, deltaZ) <= 0.001) {
      return;
    }

    const targetYaw = Math.atan2(-deltaX, -deltaZ);
    enemy.facingYawRadians = rotateToward(
      enemy.facingYawRadians,
      targetYaw,
      1 - Math.exp(-enemy.behavior.turnResponse * deltaSeconds),
    );
    enemy.group.rotation.y = enemy.facingYawRadians;
  }

  private applyVisualMotion(enemy: RuntimeEnemy): void {
    const time = enemy.time;
    enemy.visualSlot.position.y = 0;
    enemy.visualSlot.scale.set(1, 1, 1);

    if (enemy.behavior.motionStyle === 'mushroom-hop') {
      const hop = Math.max(0, Math.sin(time * 5.8));
      enemy.visualSlot.position.y = hop * 0.16;
      enemy.visualSlot.scale.set(1 - hop * 0.03, 1 + hop * 0.06, 1 - hop * 0.03);
      return;
    }

    if (enemy.behavior.motionStyle === 'slime-sway') {
      const sway = Math.sin(time * 6.2);
      const squash = Math.cos(time * 5.4);
      enemy.visualSlot.position.y = 0.04 + Math.max(0, squash) * 0.035;
      enemy.visualSlot.scale.set(1 + sway * 0.07, 1 - Math.abs(squash) * 0.06, 1 + Math.abs(sway) * 0.05);
      return;
    }

    const step = Math.max(0, Math.sin(time * 4.1));
    enemy.visualSlot.position.y = step * 0.045;
  }

  private updateDebugVisuals(enemy: RuntimeEnemy, debugVisible: boolean): void {
    enemy.debugGroup.visible = debugVisible && enemy.health.isAlive;
    enemy.debugLines.material.color.setHex(enemy.state === 'tracking' ? 0xef4444 : 0x22c55e);
    enemy.debugLines.material.opacity = enemy.state === 'returning' ? 0.56 : 0.84;
  }

  private tryFireProjectile(enemy: RuntimeEnemy, deltaSeconds: number): void {
    enemy.projectileCooldownSeconds = Math.max(0, enemy.projectileCooldownSeconds - deltaSeconds);
    if (enemy.state !== 'tracking' || enemy.projectileCooldownSeconds > 0) {
      return;
    }

    const deltaX = this.player.x - enemy.position.x;
    const deltaZ = this.player.z - enemy.position.z;
    const flatDistance = Math.hypot(deltaX, deltaZ);
    if (flatDistance <= 0.001 || flatDistance > enemy.behavior.projectileRangeUnits) {
      return;
    }

    if (!this.hasLineOfSightToPlayer(enemy, deltaX, deltaZ, flatDistance)) {
      enemy.projectileCooldownSeconds = Math.min(enemy.behavior.projectileCooldownSeconds, 0.32);
      this.projectileShotsBlockedByWall++;
      return;
    }

    const direction = new THREE.Vector3(
      deltaX,
      PROJECTILE_PLAYER_TARGET_Y - enemy.asset.targetHeightUnits * 0.58,
      deltaZ,
    ).normalize();
    const position = new THREE.Vector3(
      enemy.position.x + (deltaX / flatDistance) * PROJECTILE_SPAWN_FORWARD_UNITS,
      enemy.asset.targetHeightUnits * 0.58,
      enemy.position.z + (deltaZ / flatDistance) * PROJECTILE_SPAWN_FORWARD_UNITS,
    );
    const velocity = direction.multiplyScalar(enemy.behavior.projectileSpeedUnitsPerSecond);
    const sequence = ++this.projectileSequence;
    const projectile: RuntimeProjectile = {
      sequence,
      ownerEnemyId: enemy.id,
      mesh: this.acquireProjectileMesh(sequence),
      position,
      velocity,
      damage: enemy.behavior.projectileDamage,
      remainingLifetimeSeconds: enemy.behavior.projectileRangeUnits / enemy.behavior.projectileSpeedUnitsPerSecond,
    };
    projectile.mesh.position.copy(position);
    this.projectiles.push(projectile);
    this.projectilesFired++;
    enemy.projectileCooldownSeconds = enemy.behavior.projectileCooldownSeconds;
  }

  private hasLineOfSightToPlayer(enemy: RuntimeEnemy, deltaX: number, deltaZ: number, flatDistance: number): boolean {
    const hit = raycastLevel(enemy.position.x, enemy.position.z, deltaX, deltaZ, flatDistance);
    return !hit || hit.distance >= flatDistance - PROJECTILE_LINE_OF_SIGHT_PADDING_UNITS;
  }

  private updateProjectiles(deltaSeconds: number, playerPosition: readonly [number, number, number]): void {
    for (let index = this.projectiles.length - 1; index >= 0; index--) {
      const projectile = this.projectiles[index];
      const previousX = projectile.position.x;
      const previousZ = projectile.position.z;
      projectile.remainingLifetimeSeconds -= deltaSeconds;
      projectile.position.addScaledVector(projectile.velocity, deltaSeconds);
      projectile.mesh.position.copy(projectile.position);

      if (this.projectileHitsPlayer(projectile, previousX, previousZ, playerPosition)) {
        this.projectilesHitPlayer++;
        this.options.damagePlayer?.(projectile.damage, {
          enemyId: projectile.ownerEnemyId,
          projectileSequence: projectile.sequence,
          position: vectorSnapshot(projectile.position),
        });
        this.releaseProjectile(index);
        continue;
      }

      if (
        projectile.remainingLifetimeSeconds <= 0 ||
        this.projectileHitsWall(projectile, previousX, previousZ)
      ) {
        this.projectilesHitWall += projectile.remainingLifetimeSeconds > 0 ? 1 : 0;
        this.releaseProjectile(index);
      }
    }
  }

  private projectileHitsPlayer(
    projectile: RuntimeProjectile,
    previousX: number,
    previousZ: number,
    playerPosition: readonly [number, number, number],
  ): boolean {
    return (
      flatSegmentDistanceSquared(
        playerPosition[0],
        playerPosition[2],
        previousX,
        previousZ,
        projectile.position.x,
        projectile.position.z,
      ) <= PLAYER_PROJECTILE_HIT_RADIUS_UNITS * PLAYER_PROJECTILE_HIT_RADIUS_UNITS
    );
  }

  private projectileHitsWall(projectile: RuntimeProjectile, previousX: number, previousZ: number): boolean {
    const deltaX = projectile.position.x - previousX;
    const deltaZ = projectile.position.z - previousZ;
    const distance = Math.hypot(deltaX, deltaZ);
    if (distance <= 0.0001) {
      return collidesWithLevel(projectile.position.x, projectile.position.z, PROJECTILE_RADIUS_UNITS);
    }

    return (
      raycastLevel(previousX, previousZ, deltaX, deltaZ, distance + PROJECTILE_RADIUS_UNITS) !== null ||
      collidesWithLevel(projectile.position.x, projectile.position.z, PROJECTILE_RADIUS_UNITS)
    );
  }

  private acquireProjectileMesh(sequence: number): THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> {
    const mesh = this.projectileMeshPool.pop() ?? new THREE.Mesh(this.projectileGeometry, this.projectileMaterial);
    mesh.name = `enemy-projectile-${sequence}`;
    mesh.visible = true;
    this.projectileRoot.add(mesh);
    return mesh;
  }

  private releaseProjectile(index: number): void {
    const [projectile] = this.projectiles.splice(index, 1);
    if (!projectile) {
      return;
    }

    projectile.mesh.visible = false;
    projectile.mesh.removeFromParent();
    this.projectileMeshPool.push(projectile.mesh);
  }

  private updateHitFlash(enemy: RuntimeEnemy, deltaSeconds: number): void {
    if (enemy.hitFlashSeconds <= 0) {
      enemy.hitFlash.visible = false;
      return;
    }

    enemy.hitFlashSeconds = Math.max(0, enemy.hitFlashSeconds - deltaSeconds);
    const ratio = enemy.hitFlashSeconds / ENEMY_HIT_FLASH_SECONDS;
    enemy.hitFlash.visible = ratio > 0;
    enemy.hitFlash.material.opacity = 0.46 * ratio;
    enemy.hitFlash.scale.setScalar(0.75 + (1 - ratio) * 0.36);
  }

  private separateLivingEnemies(): void {
    for (let firstIndex = 0; firstIndex < this.enemies.length; firstIndex++) {
      const first = this.enemies[firstIndex];
      if (!first.health.isAlive) {
        continue;
      }

      for (let secondIndex = firstIndex + 1; secondIndex < this.enemies.length; secondIndex++) {
        const second = this.enemies[secondIndex];
        if (!second.health.isAlive) {
          continue;
        }

        const deltaX = second.position.x - first.position.x;
        const deltaZ = second.position.z - first.position.z;
        const distance = Math.hypot(deltaX, deltaZ);
        if (distance >= ENEMY_SEPARATION_UNITS) {
          continue;
        }

        const fallbackAngle = (firstIndex * 1.73 + secondIndex * 0.91) % (Math.PI * 2);
        const normalX = distance > 0.001 ? deltaX / distance : Math.cos(fallbackAngle);
        const normalZ = distance > 0.001 ? deltaZ / distance : Math.sin(fallbackAngle);
        const push = (ENEMY_SEPARATION_UNITS - distance) * 0.5;
        this.tryMoveEnemyForSeparation(first, -normalX * push, -normalZ * push);
        this.tryMoveEnemyForSeparation(second, normalX * push, normalZ * push);
      }
    }
  }

  private tryMoveEnemyForSeparation(enemy: RuntimeEnemy, deltaX: number, deltaZ: number): void {
    const targetX = enemy.position.x + deltaX;
    const targetZ = enemy.position.z + deltaZ;
    const resolved = resolveLevelCollision(targetX, targetZ, ENEMY_COLLISION_RADIUS, 2);
    if (collidesWithLevel(resolved.x, resolved.z, ENEMY_COLLISION_RADIUS)) {
      return;
    }

    enemy.position.set(resolved.x, 0, resolved.z);
    enemy.group.position.copy(enemy.position);
  }
}

function createEnemyDefinitions(): EnemyDefinition[] {
  const spawns = getEnemySpawnTiles();
  if (spawns.length === 0) {
    throw new Error('Foundation level has no enemy spawn markers.');
  }

  return spawns.map((spawn, index) => {
    const asset = ENEMY_ASSET_DEFINITIONS[index % ENEMY_ASSET_DEFINITIONS.length];
    const role = ROLE_NAMES[index] ?? `marker-${index + 1}`;
    const behavior = BEHAVIOR_BY_ASSET_ID.get(asset.id) ?? MUSHROOM_BEHAVIOR;

    return {
      id: `${asset.id}.${role}`,
      asset,
      column: spawn.column,
      row: spawn.row,
      maxHealth: HEALTH_BY_ASSET_ID.get(asset.id) ?? 80,
      color: COLOR_BY_ASSET_ID.get(asset.id) ?? 0x9ca3af,
      behavior,
    };
  });
}

function getInitialProjectileCooldown(
  column: number,
  row: number,
  behavior: EnemyBehaviorDefinition,
): number {
  const stagger = ((column * 17 + row * 31) % 100) / 100;
  return 0.35 + stagger * behavior.projectileCooldownSeconds;
}

function createDebugVisuals(
  enemyId: string,
  behavior: EnemyBehaviorDefinition,
): {
  group: THREE.Group;
  lines: THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial>;
} {
  const positions: number[] = [];
  const y = 0.06;
  for (let index = 0; index < DEBUG_RING_SEGMENTS; index++) {
    const start = (index / DEBUG_RING_SEGMENTS) * Math.PI * 2;
    const end = ((index + 1) / DEBUG_RING_SEGMENTS) * Math.PI * 2;
    positions.push(
      Math.cos(start) * behavior.detectRadiusUnits,
      y,
      Math.sin(start) * behavior.detectRadiusUnits,
      Math.cos(end) * behavior.detectRadiusUnits,
      y,
      Math.sin(end) * behavior.detectRadiusUnits,
    );
  }

  const coneRange = Math.min(behavior.detectRadiusUnits * 0.54, 3.2);
  const coneLeftX = -Math.sin(DEBUG_FRONT_CONE_RADIANS) * coneRange;
  const coneRightX = Math.sin(DEBUG_FRONT_CONE_RADIANS) * coneRange;
  const coneZ = -Math.cos(DEBUG_FRONT_CONE_RADIANS) * coneRange;
  positions.push(
    0,
    y + 0.04,
    0,
    0,
    y + 0.04,
    -coneRange,
    0,
    y + 0.04,
    0,
    coneLeftX,
    y + 0.04,
    coneZ,
    0,
    y + 0.04,
    0,
    coneRightX,
    y + 0.04,
    coneZ,
  );

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  const material = new THREE.LineBasicMaterial({
    color: 0x22c55e,
    transparent: true,
    opacity: 0.84,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(geometry, material);
  lines.name = `${enemyId}-debug-radius-front`;

  const group = new THREE.Group();
  group.name = `${enemyId}-debug`;
  group.add(lines);

  return { group, lines };
}

function createHitFlash(
  geometry: THREE.SphereGeometry,
  enemyId: string,
  targetHeightUnits: number,
): THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial> {
  const material = new THREE.MeshBasicMaterial({
    color: 0xfff3a3,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = `${enemyId}-hit-flash`;
  mesh.position.y = targetHeightUnits * 0.55;
  mesh.visible = false;
  mesh.renderOrder = 6;

  return mesh;
}

function roundMetric(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function vectorSnapshot(vector: THREE.Vector3): [number, number, number] {
  return [roundMetric(vector.x), roundMetric(vector.y), roundMetric(vector.z)];
}

function objectWorldSnapshot(object: THREE.Object3D): [number, number, number] {
  return vectorSnapshot(object.getWorldPosition(new THREE.Vector3()));
}

function objectBoundsSnapshot(
  object: THREE.Object3D | null,
): { center: [number, number, number]; size: [number, number, number] } | null {
  if (!object) {
    return null;
  }

  const bounds = new THREE.Box3().setFromObject(object);
  if (bounds.isEmpty()) {
    return null;
  }

  return {
    center: vectorSnapshot(bounds.getCenter(new THREE.Vector3())),
    size: vectorSnapshot(bounds.getSize(new THREE.Vector3())),
  };
}

function flatDistanceSquared(first: THREE.Vector3, second: THREE.Vector3): number {
  const deltaX = first.x - second.x;
  const deltaZ = first.z - second.z;

  return deltaX * deltaX + deltaZ * deltaZ;
}

function flatSegmentDistanceSquared(
  pointX: number,
  pointZ: number,
  segmentStartX: number,
  segmentStartZ: number,
  segmentEndX: number,
  segmentEndZ: number,
): number {
  const segmentX = segmentEndX - segmentStartX;
  const segmentZ = segmentEndZ - segmentStartZ;
  const segmentLengthSq = segmentX * segmentX + segmentZ * segmentZ;
  if (segmentLengthSq <= 0.0001) {
    const deltaX = pointX - segmentEndX;
    const deltaZ = pointZ - segmentEndZ;
    return deltaX * deltaX + deltaZ * deltaZ;
  }

  const amount = clamp01(
    ((pointX - segmentStartX) * segmentX + (pointZ - segmentStartZ) * segmentZ) / segmentLengthSq,
  );
  const closestX = segmentStartX + segmentX * amount;
  const closestZ = segmentStartZ + segmentZ * amount;
  const deltaX = pointX - closestX;
  const deltaZ = pointZ - closestZ;
  return deltaX * deltaX + deltaZ * deltaZ;
}

function rotateToward(current: number, target: number, amount: number): number {
  const delta = Math.atan2(Math.sin(target - current), Math.cos(target - current));
  return current + delta * clamp01(amount);
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

function disposeObject3D(
  object: THREE.Object3D,
  disposedGeometries: Set<THREE.BufferGeometry>,
  disposedMaterials: Set<THREE.Material>,
): void {
  object.traverse((child) => {
    if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
      if (!disposedGeometries.has(child.geometry)) {
        disposedGeometries.add(child.geometry);
        child.geometry.dispose();
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

  disposedMaterials.add(material);
  material.dispose();
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

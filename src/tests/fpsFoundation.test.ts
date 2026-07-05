import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DEBUG_SCENE_ID, MOBILE_VIEWPORTS, PERFORMANCE_BUDGETS } from '../game/config';
import {
  FOUNDATION_MUSIC_ASSET,
  GAME_AUDIO_ASSETS,
  TITLE_MUSIC_ASSET,
  WEAPON_AUDIO_ASSETS,
} from '../game/audioManifest';
import { CHARACTER_VOICE_LINES, CHARACTER_VOICE_NAME } from '../game/characterVoice';
import { ENEMY_ASSET_DEFINITIONS, ENEMY_ASSET_SOURCE } from '../game/enemies/enemyManifest';
import { EnemySystem } from '../game/enemies/enemySystem';
import { BOSS_LEVEL_CONFIG, LEVEL_CONFIGS } from '../game/levelConfigs';
import {
  FOUNDATION_LEVEL_MAP,
  FOUNDATION_LEVEL_ID,
  LEVEL_CHUNK_LOAD_RADIUS,
  LEVEL_CHUNK_SIZE_TILES,
  LEVEL_HEIGHT_TILES,
  LEVEL_TILE_SIZE,
  LEVEL_WIDTH_TILES,
  type LevelTileSymbol,
  MIN_FOUNDATION_ENTRY_UNITS,
  MIN_FOUNDATION_ENTRY_SPLIT_AREA_UNITS,
  MIN_FOUNDATION_ENTRY_SPLIT_SIDE_UNITS,
  MIN_FOUNDATION_PASSAGE_UNITS,
  collidesWithLevel,
  getEnemySpawnTiles,
  getLevelTiles,
  getSpawnPosition,
  isSolidSymbol,
  raycastLevel,
  resolveLevelCollision,
  tileToWorld,
  worldToTile,
} from '../game/levelMap';
import { createLevelChunks, getActiveChunkIdsForTile } from '../game/levelStreaming';
import {
  FOUNDATION_COVER_HEIGHT_UNITS,
  FOUNDATION_ENVIRONMENT_TEXTURE_DECODED_BYTES,
  FOUNDATION_ENVIRONMENT_TEXTURE_SOURCE_BYTES,
  FOUNDATION_ROOF_HEIGHT_UNITS,
  FOUNDATION_WALL_HEIGHT_UNITS,
} from '../game/foundationLevelRuntime';
import {
  MOVE_SPEED_UNITS_PER_SECOND,
  PLAYER_COLLISION_RADIUS,
  collidesWithPlayerFootprint,
  collidesWithWeaponFootprint,
  getWeaponCollisionCenter,
} from '../game/fpsControls';
import { Health } from '../game/health';
import { getWeaponFootprintClearance } from '../game/weapons/weaponClearance';
import {
  MIN_SHOT_TRACER_DISTANCE_UNITS,
  WEAPON_WALL_IMPACT_INSET_UNITS,
  getWeaponMuzzleLocalOffset,
  getWeaponMuzzleCameraPosition,
  getWeaponRootCameraPosition,
  getWeaponRootCameraScale,
  getWeaponShotEffectPositions,
} from '../game/weapons/weaponViewPose';
import {
  getCameraSpaceShotDistance,
  getHorizontalRaycastDistance,
  getHorizontalShotDirectionLength,
} from '../game/weapons/weaponShotMath';
import {
  STARTING_WEAPON_DEFINITIONS,
  STARTING_WEAPON_IDS,
  WEAPON_ASSET_SOURCE,
  WEAPON_DEFINITIONS,
  publicAssetUrl,
  withAssetVersion,
} from '../game/weapons/weaponManifest';

describe('FPS foundation config', () => {
  it('keeps the bootstrap scene aligned with the mobile landscape gates', () => {
    expect(DEBUG_SCENE_ID).toBe('fps-level-foundation');
    expect(PERFORMANCE_BUDGETS.targetFps).toBe(60);
    expect(PERFORMANCE_BUDGETS.drawCallsMax).toBeLessThanOrEqual(90);
    expect(PERFORMANCE_BUDGETS.trianglesMax).toBeLessThanOrEqual(250_000);
    expect(PERFORMANCE_BUDGETS.initialScenePayloadMbMax).toBeLessThanOrEqual(40);
    expect(MOVE_SPEED_UNITS_PER_SECOND).toBeCloseTo(5.078125);
    expect(FOUNDATION_WALL_HEIGHT_UNITS).toBeCloseTo(3.84);
    expect(FOUNDATION_COVER_HEIGHT_UNITS).toBeCloseTo(1.15);
    expect(FOUNDATION_ROOF_HEIGHT_UNITS).toBeGreaterThan(FOUNDATION_WALL_HEIGHT_UNITS);
    expect(FOUNDATION_ENVIRONMENT_TEXTURE_SOURCE_BYTES).toBe(764_229);
    expect(FOUNDATION_ENVIRONMENT_TEXTURE_DECODED_BYTES).toBe(12_582_912);
  });

  it('tracks the required mobile landscape viewport set', () => {
    const viewportNames = MOBILE_VIEWPORTS.map((viewport) => viewport.name);

    expect(viewportNames).toEqual([
      'small-phone-landscape',
      'wide-phone-landscape',
      'modern-phone-landscape',
      'large-phone-landscape',
      'tablet-landscape',
    ]);
  });

  it('uses a valid 45 x 45 symbol map with boundary collision', () => {
    expect(FOUNDATION_LEVEL_ID).toBe('foundation-45x45');
    expect(FOUNDATION_LEVEL_MAP).toHaveLength(LEVEL_HEIGHT_TILES);
    expect(LEVEL_WIDTH_TILES).toBe(45);
    expect(LEVEL_HEIGHT_TILES).toBe(45);

    for (const row of FOUNDATION_LEVEL_MAP) {
      expect(row).toHaveLength(LEVEL_WIDTH_TILES);
    }

    const tiles = getLevelTiles();
    const enemySpawnTiles = getEnemySpawnTiles();
    const spawnTile = tiles.find((tile) => tile.symbol === 'S');
    const exitTile = tiles.find((tile) => tile.symbol === 'X');
    expect(tiles).toHaveLength(LEVEL_WIDTH_TILES * LEVEL_HEIGHT_TILES);
    expect(tiles.filter((tile) => tile.symbol === 'S')).toHaveLength(1);
    expect(tiles.filter((tile) => tile.symbol === 'X')).toHaveLength(1);
    expect(spawnTile).toMatchObject({ row: 1, column: 1 });
    expect(exitTile).toMatchObject({ row: LEVEL_HEIGHT_TILES - 2, column: LEVEL_WIDTH_TILES - 2 });
    expect(enemySpawnTiles).toHaveLength(12);
    expect(enemySpawnTiles[0]).toMatchObject({ row: 1, column: 12, symbol: 'E' });
    expect(enemySpawnTiles.slice(0, 3).map((tile) => `${tile.row}:${tile.column}`)).toEqual([
      '1:12',
      '5:32',
      '13:22',
    ]);
    for (let firstIndex = 0; firstIndex < enemySpawnTiles.length; firstIndex++) {
      for (let secondIndex = firstIndex + 1; secondIndex < enemySpawnTiles.length; secondIndex++) {
        const first = enemySpawnTiles[firstIndex];
        const second = enemySpawnTiles[secondIndex];
        expect(Math.hypot(first.column - second.column, first.row - second.row)).toBeGreaterThanOrEqual(5);
      }
    }

    for (let index = 0; index < LEVEL_WIDTH_TILES; index++) {
      expect(FOUNDATION_LEVEL_MAP[0][index]).toBe('#');
      expect(FOUNDATION_LEVEL_MAP[LEVEL_HEIGHT_TILES - 1][index]).toBe('#');
      expect(FOUNDATION_LEVEL_MAP[index][0]).toBe('#');
      expect(FOUNDATION_LEVEL_MAP[index][LEVEL_WIDTH_TILES - 1]).toBe('#');
    }

    const reachableTileKeys = collectReachableTileKeys(spawnTile?.row ?? 0, spawnTile?.column ?? 0);
    expect(
      tiles
        .filter((tile) => !isSolidSymbol(tile.symbol) && !reachableTileKeys.has(`${tile.row}:${tile.column}`))
        .map((tile) => `${tile.row}:${tile.column}:${tile.symbol}`),
    ).toEqual([]);
  });

  it('partitions the level into streamable chunks around the player', () => {
    const chunks = createLevelChunks(getLevelTiles());
    const spawnActiveChunkIds = getActiveChunkIdsForTile(1, 1);

    expect(LEVEL_CHUNK_SIZE_TILES).toBe(9);
    expect(LEVEL_CHUNK_LOAD_RADIUS).toBe(2);
    expect(chunks).toHaveLength(25);
    expect(chunks.reduce((total, chunk) => total + chunk.exitTiles.length, 0)).toBe(1);
    expect(spawnActiveChunkIds).toContain('0:0');
    expect(spawnActiveChunkIds).toHaveLength(9);
    expect(spawnActiveChunkIds.length).toBeLessThan(chunks.length);
  });

  it('registers a separate boss level JSON configuration', () => {
    const bossMap = BOSS_LEVEL_CONFIG.map;
    const spawn = findSymbolInMap(bossMap, 'S');
    const boss = findSymbolInMap(bossMap, 'B');
    const exit = findSymbolInMap(bossMap, 'X');
    const walkableTileCount = countWalkableTiles(bossMap);
    const reachableTileKeys = collectReachableTileKeysForMap(bossMap, spawn?.row ?? 0, spawn?.column ?? 0);

    expect(LEVEL_CONFIGS.map((level) => level.id)).toEqual(['foundation-45x45', 'boss-forge-31x31']);
    expect(BOSS_LEVEL_CONFIG.levelType).toBe('boss');
    expect(BOSS_LEVEL_CONFIG.dimensions).toEqual({ width: 31, height: 31 });
    expect(BOSS_LEVEL_CONFIG.streaming).toMatchObject({ chunkSizeTiles: 8, loadRadiusChunks: 2 });
    expect(bossMap).toHaveLength(BOSS_LEVEL_CONFIG.dimensions.height);
    expect(bossMap.every((row) => row.length === BOSS_LEVEL_CONFIG.dimensions.width)).toBe(true);
    expect(countSymbolInMap(bossMap, 'S')).toBe(1);
    expect(countSymbolInMap(bossMap, 'B')).toBe(1);
    expect(countSymbolInMap(bossMap, 'E')).toBe(6);
    expect(countSymbolInMap(bossMap, 'X')).toBe(1);
    expect(spawn).toEqual({ row: 2, column: 2 });
    expect(boss).toEqual({ row: 15, column: 15 });
    expect(exit).toEqual({ row: 28, column: 28 });
    expect(reachableTileKeys.size).toBe(walkableTileCount);
    expect(BOSS_LEVEL_CONFIG.objective).toMatchObject({
      type: 'defeat-boss',
      bossMarkerSymbol: 'B',
      exitUnlock: 'after-boss-defeated',
    });
    expect(BOSS_LEVEL_CONFIG.boss).toMatchObject({
      id: 'boss.sigil-warden.forge',
      label: 'SIGIL WARDEN',
      markerSymbol: 'B',
      assetId: 'enemy.monster.goleling',
      maxHealth: 720,
    });
    expect(BOSS_LEVEL_CONFIG.boss.phases.map((phase) => phase.startsAtHealthRatio)).toEqual([1, 0.65, 0.3]);
    expect(BOSS_LEVEL_CONFIG.reward.choiceCount).toBe(3);
    expect(BOSS_LEVEL_CONFIG.reward.powerupRangePercent).toEqual({ min: 5, max: 9 });
    expect(BOSS_LEVEL_CONFIG.reward.pool).toHaveLength(10);
  });

  it('keeps walkable lanes at least three units wide', () => {
    const minimumOpenTiles = Math.ceil(MIN_FOUNDATION_PASSAGE_UNITS / LEVEL_TILE_SIZE);
    const minimumEntryOpenTiles = Math.ceil(MIN_FOUNDATION_ENTRY_UNITS / LEVEL_TILE_SIZE);
    const minimumEntrySplitSideTiles = Math.ceil(MIN_FOUNDATION_ENTRY_SPLIT_SIDE_UNITS / LEVEL_TILE_SIZE);
    const minimumEntrySplitAreaTiles = Math.ceil(MIN_FOUNDATION_ENTRY_SPLIT_AREA_UNITS / LEVEL_TILE_SIZE);

    for (let row = 0; row < LEVEL_HEIGHT_TILES; row++) {
      for (let column = 0; column < LEVEL_WIDTH_TILES; column++) {
        const symbol = FOUNDATION_LEVEL_MAP[row][column] as LevelTileSymbol;
        if (isSolidSymbol(symbol)) {
          continue;
        }

        expect(countOpenRun(row, column, 0, -1) + 1 + countOpenRun(row, column, 0, 1)).toBeGreaterThanOrEqual(
          minimumOpenTiles,
        );
        expect(countOpenRun(row, column, -1, 0) + 1 + countOpenRun(row, column, 1, 0)).toBeGreaterThanOrEqual(
          minimumOpenTiles,
        );
      }
    }

    expect(minimumEntryOpenTiles).toBe(5);
    expect(minimumEntrySplitSideTiles).toBe(3);
    expect(minimumEntrySplitAreaTiles).toBe(6);
    expect(findNarrowBoundedSegments(minimumOpenTiles)).toEqual([]);
    expect(findNarrowBoundedWallEntries(minimumEntryOpenTiles, minimumOpenTiles)).toEqual([]);
    expect(
      findNarrowWallEntrySplitters(
        minimumEntryOpenTiles,
        minimumOpenTiles,
        minimumEntrySplitSideTiles,
        minimumEntrySplitAreaTiles,
      ),
    ).toEqual([]);
    expect(findDiagonalCornerCuts()).toEqual([]);
    expect(findCornerPinches()).toEqual([]);
    expect(worldToTile(12.1, -2.1)?.symbol).toBe('#');
    expect(worldToTile(12.2, 7.6)?.symbol).toBe('#');
    expect(worldToTile(-10, 17.8)).toMatchObject({ row: 40, column: 12, symbol: '.' });
    expect(worldToTile(-9.4, 17.2)).toMatchObject({ row: 39, column: 13, symbol: '.' });
    expect(worldToTile(8.2, 17.5)).toMatchObject({ row: 40, column: 30, symbol: '.' });
    expect(FOUNDATION_LEVEL_MAP[30].slice(15, 23)).toBe('........');
    expect(FOUNDATION_LEVEL_MAP[39].slice(8, 15)).toBe('.......');
    expect(FOUNDATION_LEVEL_MAP[39].slice(26, 33)).toBe('.......');
  });

  it('keeps spawn open while treating boundaries as solid', () => {
    const spawn = getSpawnPosition();

    expect(collidesWithLevel(spawn.x, spawn.z, 0.24)).toBe(false);
    expect(collidesWithLevel(-22.6, 0, 0.24)).toBe(true);
    expect(collidesWithLevel(22.6, 0, 0.24)).toBe(true);

    const wallHit = raycastLevel(spawn.x, spawn.z, -1, 0, 8);
    expect(wallHit?.tile).toMatchObject({ column: 0, row: 1, symbol: '#' });
    expect(wallHit?.distance).toBeCloseTo(0.5);
  });

  it('uses a small CC0 external weapon set for the test level', () => {
    const weaponIds = WEAPON_DEFINITIONS.map((weapon) => weapon.id);
    const totalModelBytes = WEAPON_DEFINITIONS.reduce((total, weapon) => total + weapon.modelBytes, 0);
    const clearance = getWeaponFootprintClearance();
    const muzzleColors = new Set(WEAPON_DEFINITIONS.map((weapon) => weapon.effects.muzzleColor));
    const tracerColors = new Set(WEAPON_DEFINITIONS.map((weapon) => weapon.effects.tracerColor));

    expect(WEAPON_ASSET_SOURCE.license).toBe('Creative Commons Zero, CC0');
    expect(WEAPON_ASSET_SOURCE.attributionRequired).toBe(false);
    expect(WEAPON_DEFINITIONS).toHaveLength(5);
    expect(STARTING_WEAPON_IDS).toEqual(['weapon.blaster.spark', 'weapon.blaster.bore']);
    expect(STARTING_WEAPON_DEFINITIONS.map((weapon) => weapon.id)).toEqual([...STARTING_WEAPON_IDS]);
    expect(new Set(weaponIds).size).toBe(WEAPON_DEFINITIONS.length);
    expect(totalModelBytes).toBeLessThan(1_000_000);
    expect(muzzleColors.size).toBe(WEAPON_DEFINITIONS.length);
    expect(tracerColors.size).toBe(WEAPON_DEFINITIONS.length);

    for (const weapon of WEAPON_DEFINITIONS) {
      expect(weapon.modelPath).toMatch(/^assets\/weapons\/kenney-blaster-kit\/models\/.+\.glb$/);
      expect(weapon.previewPath).toMatch(/^assets\/weapons\/kenney-blaster-kit\/previews\/.+\.png$/);
      expect(weapon.magazineSize).toBeGreaterThan(0);
      expect(weapon.damage).toBeGreaterThan(0);
      expect(weapon.fireIntervalMs).toBeGreaterThan(100);
      expect(weapon.recoilKick).toBeGreaterThan(0);
      expect(weapon.rangeUnits).toBeGreaterThan(12);
      expect(weapon.view.position[0]).toBeGreaterThanOrEqual(0.52);
      expect(weapon.view.aimPosition[0]).toBeLessThan(weapon.view.position[0]);
      expect(Math.abs(weapon.view.aimPosition[0])).toBeLessThanOrEqual(0.02);
      expect(weapon.view.aimScaleMultiplier).toBeGreaterThanOrEqual(1);
      expect(clearance.rightOffset).toBeGreaterThanOrEqual(weapon.view.position[0]);
      expect(clearance.forwardOffset).toBeGreaterThanOrEqual(Math.abs(weapon.view.position[2]));
      expect(weapon.view.rotation[1]).toBeCloseTo(0);
      expect(getWeaponMuzzleLocalOffset(weapon.view)).toHaveLength(3);
      expect(weapon.view.muzzleLocalOffset[2]).toBeGreaterThan(-0.65);
      expect(weapon.view.muzzleLocalOffset[2]).toBeLessThan(-0.35);
      expect(weapon.effects.muzzleScale).toBeGreaterThan(0.8);
      expect(weapon.effects.impactScale).toBeGreaterThan(0.8);
      expect(weapon.effects.tracerOpacity).toBeGreaterThan(0.75);
      expect(weapon.effects.flashMs).toBeGreaterThan(45);
      expect(weapon.effects.feedbackMs).toBeGreaterThan(75);
    }
  });

  it('registers a small CC0 external enemy set for the foundation level', () => {
    const enemyIds = ENEMY_ASSET_DEFINITIONS.map((enemy) => enemy.id);
    const totalEnemyModelBytes = ENEMY_ASSET_DEFINITIONS.reduce((total, enemy) => total + enemy.modelBytes, 0);

    expect(ENEMY_ASSET_SOURCE.license).toBe('Public Domain, CC0');
    expect(ENEMY_ASSET_SOURCE.attributionRequired).toBe(false);
    expect(ENEMY_ASSET_DEFINITIONS).toHaveLength(3);
    expect(enemyIds).toEqual(['enemy.monster.mushnub', 'enemy.monster.pink-slime', 'enemy.monster.goleling']);
    expect(new Set(enemyIds).size).toBe(ENEMY_ASSET_DEFINITIONS.length);
    expect(totalEnemyModelBytes).toBe(347_884);
    expect(totalEnemyModelBytes).toBeLessThan(1_000_000);

    for (const enemy of ENEMY_ASSET_DEFINITIONS) {
      expect(enemy.modelPath).toMatch(/^assets\/enemies\/quaternius-monsters\/models\/.+\.glb$/);
      expect(enemy.modelSha256).toMatch(/^[a-f0-9]{64}$/);
      expect(enemy.modelBytes).toBeGreaterThan(50_000);
      expect(enemy.targetHeightUnits).toBeGreaterThan(1);
      expect(enemy.targetHeightUnits).toBeLessThanOrEqual(1.8);
      expect(enemy.yawRadians).toBeCloseTo(Math.PI);
      expect(enemy.sourceUrl).toMatch(/^https:\/\/poly\.pizza\/m\//);
    }
  });

  it('provides reusable clamped health for players and enemies', () => {
    const health = new Health(100);
    const changes: string[] = [];
    health.onChange((change) => changes.push(`${change.reason}:${change.current.current}`));

    expect(health.getSnapshot()).toEqual({
      current: 100,
      max: 100,
      ratio: 1,
      isAlive: true,
    });
    expect(health.damage(35)).toMatchObject({ current: 65, ratio: 0.65, isAlive: true });
    expect(health.heal(20)).toMatchObject({ current: 85, ratio: 0.85, isAlive: true });
    expect(health.damage(200)).toMatchObject({ current: 0, ratio: 0, isAlive: false });
    expect(health.heal(10)).toMatchObject({ current: 0, ratio: 0, isAlive: false });
    expect(health.reset()).toMatchObject({ current: 100, ratio: 1, isAlive: true });
    expect(changes).toEqual(['damage:65', 'heal:85', 'damage:0', 'reset:100']);
  });

  it('lets weapon rays damage and destroy visible external enemies before a wall hit', () => {
    const scene = new THREE.Scene();
    const enemies = new EnemySystem(scene);
    const enemyCount = getEnemySpawnTiles().length;
    const origin = new THREE.Vector3(-21, 1.62, -21);
    const direction = new THREE.Vector3(1, 0.035, 0);

    const firstHit = enemies.resolveShotHit(origin, direction, 12, 34);
    expect(firstHit).toMatchObject({
      enemyId: 'enemy.monster.mushnub.vanguard',
      destroyed: false,
      health: {
        current: 34,
        max: 68,
        ratio: 0.5,
        isAlive: true,
      },
    });
    expect(scene.getObjectByName('enemy.monster.mushnub.vanguard-hit-flash')?.visible).toBe(true);

    const secondHit = enemies.resolveShotHit(origin, direction, 12, 34);
    expect(secondHit).toMatchObject({
      enemyId: 'enemy.monster.mushnub.vanguard',
      destroyed: true,
      health: {
        current: 0,
        max: 68,
        ratio: 0,
        isAlive: false,
      },
    });
    expect(enemies.getSnapshot()).toMatchObject({
      total: enemyCount,
      alive: enemyCount - 1,
      destroyed: 1,
    });

    enemies.dispose();
  });

  it('spawns enemies from E markers and updates patrol, tracking, return, and debug state', () => {
    const scene = new THREE.Scene();
    const enemies = new EnemySystem(scene);
    const spawns = getEnemySpawnTiles();
    const initialSnapshot = enemies.getSnapshot();
    const first = initialSnapshot.enemies[0];
    const firstOrigin = tileToWorld(spawns[0].column, spawns[0].row);

    expect(initialSnapshot.total).toBe(spawns.length);
    expect(initialSnapshot.enemyMarkerCount).toBe(spawns.length);
    expect(first).toMatchObject({
      id: 'enemy.monster.mushnub.vanguard',
      marker: { row: spawns[0].row, column: spawns[0].column },
      origin: [firstOrigin.worldX, 0, firstOrigin.worldZ],
      position: [firstOrigin.worldX, 0, firstOrigin.worldZ],
      state: 'patrolling',
      speedUnitsPerSecond: 1.6,
      debugVisible: false,
    });
    expect(Math.hypot(first.origin[0] + 21, first.origin[2] + 21)).toBeGreaterThan(9);
    expectEnemyAttachmentsAligned(first);

    for (let frame = 0; frame < 15; frame++) {
      enemies.update(0.05, [22, 1.62, 21], true);
    }

    const allPatrolSnapshot = enemies.getSnapshot();
    const movedEnemyIds = allPatrolSnapshot.enemies
      .filter((enemy, index) => {
        const start = initialSnapshot.enemies[index];
        return Math.hypot(enemy.position[0] - start.position[0], enemy.position[2] - start.position[2]) > 0.25;
      })
      .map((enemy) => enemy.id);
    expect(movedEnemyIds).toHaveLength(spawns.length);
    for (const enemy of allPatrolSnapshot.enemies) {
      expectEnemyAttachmentsAligned(enemy);
    }

    for (let frame = 0; frame < 5; frame++) {
      enemies.update(0.05, [22, 1.62, 21], true);
    }

    const patrolSnapshot = enemies.getSnapshot().enemies[0];
    expect(patrolSnapshot.state).toBe('patrolling');
    expect(patrolSnapshot.debugVisible).toBe(true);
    expect(
      Math.hypot(patrolSnapshot.position[0] - first.position[0], patrolSnapshot.position[2] - first.position[2]),
    ).toBeGreaterThan(0.45);

    enemies.update(0.2, [first.origin[0] - 3, 1.62, first.origin[2]], true);
    const trackingSnapshot = enemies.getSnapshot().enemies[0];
    expect(trackingSnapshot.state).toBe('tracking');
    expect(trackingSnapshot.debugVisible).toBe(true);
    expect(trackingSnapshot.position[0]).toBeLessThan(patrolSnapshot.position[0]);
    expect(Math.abs(trackingSnapshot.facingYawRadians)).toBeGreaterThan(0.01);
    expect(trackingSnapshot.speedUnitsPerSecond).toBeCloseTo(1.6);

    for (let frame = 0; frame < 140; frame++) {
      enemies.update(0.05, [22, 1.62, 21], false);
    }

    const returnedSnapshot = enemies.getSnapshot().enemies[0];
    expect(returnedSnapshot.state).toBe('patrolling');
    expect(returnedSnapshot.debugVisible).toBe(false);
    expect(
      Math.hypot(
        returnedSnapshot.position[0] - returnedSnapshot.origin[0],
        returnedSnapshot.position[2] - returnedSnapshot.origin[2],
      ),
    ).toBeLessThanOrEqual(1.7);

    enemies.dispose();
  });

  it('lets tracking enemies fire visible projectiles that damage the player', () => {
    const scene = new THREE.Scene();
    const playerHealth = new Health(100);
    const damageEvents: number[] = [];
    const projectileSoundEvents: string[] = [];
    const enemies = new EnemySystem(scene, {
      damagePlayer: (amount) => {
        damageEvents.push(amount);
        return playerHealth.damage(amount);
      },
      playProjectileSound: (source) => {
        projectileSoundEvents.push(`${source.enemyId}:${source.projectileSequence}`);
      },
    });
    const firstEnemy = enemies.getSnapshot().enemies[0];
    const playerPosition: [number, number, number] = [firstEnemy.origin[0] - 5.8, 1.62, firstEnemy.origin[2]];

    let sawActiveProjectile = false;
    let firstFiredFrame: number | null = null;
    for (let frame = 0; frame < 160 && damageEvents.length === 0; frame++) {
      enemies.update(0.05, playerPosition, true);
      const projectileSnapshot = enemies.getSnapshot().projectiles;
      sawActiveProjectile = sawActiveProjectile || projectileSnapshot.active > 0;
      if (firstFiredFrame === null && projectileSnapshot.fired > 0) {
        firstFiredFrame = frame;
      }
    }

    const snapshot = enemies.getSnapshot();
    expect(snapshot.enemies[0].state).toBe('tracking');
    expect(snapshot.enemies[0].projectileRangeUnits).toBeGreaterThanOrEqual(8.8);
    expect(firstFiredFrame).not.toBeNull();
    expect(firstFiredFrame ?? Number.POSITIVE_INFINITY).toBeLessThanOrEqual(3);
    expect(snapshot.projectiles.fired).toBeGreaterThan(0);
    expect(snapshot.projectiles.hitPlayer).toBeGreaterThan(0);
    expect(snapshot.projectiles.pooled).toBeGreaterThan(0);
    expect(projectileSoundEvents).toHaveLength(snapshot.projectiles.fired);
    expect(sawActiveProjectile).toBe(true);
    expect(damageEvents).toEqual(expect.arrayContaining([7]));
    expect(playerHealth.getSnapshot().current).toBeLessThan(100);
    expect(scene.getObjectByName('enemy-projectiles')).not.toBeNull();

    enemies.dispose();
  });

  it('registers generated ElevenLabs audio for the foundation level', () => {
    const audioIds = GAME_AUDIO_ASSETS.map((asset) => asset.id).sort();
    const totalAudioBytes = GAME_AUDIO_ASSETS.reduce((total, asset) => total + asset.bytes, 0);
    const voiceAudioBytes = CHARACTER_VOICE_LINES.reduce((total, asset) => total + asset.bytes, 0);

    expect(audioIds).toEqual([
      'audio.music.foundation.elevenlabs',
      'audio.music.title.industrial-guitar.elevenlabs',
      'audio.weapon.bore.elevenlabs',
      'audio.weapon.rift.elevenlabs',
      'audio.weapon.spark.elevenlabs',
      'audio.weapon.torch.elevenlabs',
      'audio.weapon.vault.elevenlabs',
    ]);
    expect(WEAPON_AUDIO_ASSETS.sidearm.path).toBe('assets/audio/elevenlabs-foundation/spark-sidearm.mp3');
    expect(WEAPON_AUDIO_ASSETS.scatter.path).toBe('assets/audio/elevenlabs-foundation/bore-scatter.mp3');
    expect(WEAPON_AUDIO_ASSETS.heavy.path).toBe('assets/audio/elevenlabs-foundation/vault-heavy.mp3');
    expect(WEAPON_AUDIO_ASSETS.precision.path).toBe('assets/audio/elevenlabs-foundation/rift-precision.mp3');
    expect(WEAPON_AUDIO_ASSETS.burst.path).toBe('assets/audio/elevenlabs-foundation/torch-burst.mp3');
    expect(WEAPON_AUDIO_ASSETS.heavy.volume).toBe(1.8);
    expect(FOUNDATION_MUSIC_ASSET.path).toBe(
      'assets/audio/elevenlabs-foundation/foundation-combat-loop-long.mp3',
    );
    expect(FOUNDATION_MUSIC_ASSET.kind).toBe('music');
    expect(TITLE_MUSIC_ASSET.path).toBe('assets/audio/elevenlabs-foundation/title-industrial-guitar-loop.mp3');
    expect(TITLE_MUSIC_ASSET.kind).toBe('music');
    expect(TITLE_MUSIC_ASSET.volume).toBe(0.46);
    expect(totalAudioBytes).toBe(2_299_502);
    expect(totalAudioBytes).toBeLessThan(5_000_000);
    expect(CHARACTER_VOICE_NAME).toBe('Glyph');
    expect(CHARACTER_VOICE_LINES).toHaveLength(7);
    expect(CHARACTER_VOICE_LINES.map((line) => line.id)).toEqual([
      'audio.voice.glyph.catchphrase.service.elevenlabs',
      'audio.voice.glyph.level-complete.rift-sealed.elevenlabs',
      'audio.voice.glyph.level-complete.slick.elevenlabs',
      'audio.voice.glyph.encouragement.keep-moving.elevenlabs',
      'audio.voice.glyph.encouragement.sparks-up.elevenlabs',
      'audio.voice.glyph.fail.reboot.elevenlabs',
      'audio.voice.glyph.fail.stars.elevenlabs',
    ]);
    expect(CHARACTER_VOICE_LINES.every((line) => line.path.startsWith('assets/audio/elevenlabs-foundation/glyph-'))).toBe(
      true,
    );
    expect(CHARACTER_VOICE_LINES.every((line) => line.text.startsWith('['))).toBe(true);
    expect(voiceAudioBytes).toBe(246_482);
  });

  it('derives shot effects from each weapon view pose', () => {
    const neutralPose = { recoil: 0, wallAvoidance: 0, aimBlend: 0 };
    const aimPose = { recoil: 0, wallAvoidance: 0, aimBlend: 1 };
    const wallPose = { recoil: 0.08, wallAvoidance: 0.65, aimBlend: 0 };
    const muzzleOffsets = new Set(WEAPON_DEFINITIONS.map((weapon) => getWeaponMuzzleLocalOffset(weapon.view).join(',')));
    const spark = getWeaponById('weapon.blaster.spark');
    const bore = getWeaponById('weapon.blaster.bore');
    const vault = getWeaponById('weapon.blaster.vault');
    const sparkRoot = getWeaponRootCameraPosition(spark.view, neutralPose);
    const boreRoot = getWeaponRootCameraPosition(bore.view, neutralPose);
    const vaultRoot = getWeaponRootCameraPosition(vault.view, neutralPose);
    const sparkMuzzle = getWeaponMuzzleCameraPosition(spark.view, neutralPose);
    const boreMuzzle = getWeaponMuzzleCameraPosition(bore.view, neutralPose);
    const vaultMuzzle = getWeaponMuzzleCameraPosition(vault.view, neutralPose);

    expect(muzzleOffsets.size).toBe(WEAPON_DEFINITIONS.length);
    expect(bore.view.position[1]).toBeLessThan(spark.view.position[1]);
    expect(vault.view.position[1]).toBeLessThan(bore.view.position[1]);
    expect(spark.view.muzzleLocalOffset[0]).toBeGreaterThan(0);
    expect(bore.view.muzzleLocalOffset[0]).toBeLessThan(spark.view.muzzleLocalOffset[0]);
    expect(vault.view.muzzleLocalOffset[0]).toBeLessThan(spark.view.muzzleLocalOffset[0]);
    expect(boreMuzzle[0]).toBeLessThan(boreRoot[0]);
    expect(vaultMuzzle[0]).toBeLessThan(vaultRoot[0]);
    expect(boreMuzzle[1] - boreRoot[1]).toBeGreaterThan(sparkMuzzle[1] - sparkRoot[1]);
    expect(vaultMuzzle[1] - vaultRoot[1]).toBeGreaterThan(sparkMuzzle[1] - sparkRoot[1]);
    expect(spark.effects.projectile).toMatchObject({
      shape: 'bolt',
      radius: 0.028,
      length: 0.82,
    });
    expect(bore.effects.projectile).toMatchObject({
      shape: 'orb',
      radius: 0.105,
      length: 0,
    });
    expect(spark.effects.projectile.radius).toBeLessThan(bore.effects.projectile.radius);

    for (const weapon of WEAPON_DEFINITIONS) {
      const root = getWeaponRootCameraPosition(weapon.view, neutralPose);
      const aimRoot = getWeaponRootCameraPosition(weapon.view, aimPose);
      const muzzle = getWeaponMuzzleCameraPosition(weapon.view, neutralPose);
      const aimMuzzle = getWeaponMuzzleCameraPosition(weapon.view, aimPose);
      const closeEffects = getWeaponShotEffectPositions(weapon.view, 0.35, neutralPose);
      const shiftedView = {
        ...weapon.view,
        position: [
          weapon.view.position[0] + 0.3,
          weapon.view.position[1] - 0.1,
          weapon.view.position[2] - 0.2,
        ] satisfies [number, number, number],
      };
      const shiftedMuzzle = getWeaponMuzzleCameraPosition(shiftedView, neutralPose);
      const wallMuzzle = getWeaponMuzzleCameraPosition(weapon.view, wallPose);

      if (weapon.id === 'weapon.blaster.spark') {
        expect(muzzle[0]).toBeGreaterThan(root[0]);
      } else {
        expect(muzzle[0]).toBeLessThan(root[0]);
      }
      expect(muzzle[2]).toBeLessThan(root[2]);
      expect(aimRoot[0]).toBeLessThan(root[0]);
      expect(Math.abs(aimRoot[0])).toBeLessThanOrEqual(0.02);
      expect(Math.abs(aimMuzzle[0])).toBeLessThan(0.12);
      expect(getWeaponRootCameraScale(weapon.view, aimPose)).toBeGreaterThanOrEqual(
        getWeaponRootCameraScale(weapon.view, neutralPose),
      );
      expectTupleClose(closeEffects.muzzle, muzzle);
      expectTupleClose(closeEffects.tracerEnd, [0, 0, -MIN_SHOT_TRACER_DISTANCE_UNITS]);
      expectTupleClose(closeEffects.wallImpact, [0, 0, -0.35 + WEAPON_WALL_IMPACT_INSET_UNITS]);
      expect(shiftedMuzzle[0] - muzzle[0]).toBeCloseTo(0.3);
      expect(shiftedMuzzle[1] - muzzle[1]).toBeCloseTo(-0.1);
      expect(shiftedMuzzle[2] - muzzle[2]).toBeCloseTo(-0.2);
      expect(wallMuzzle[1]).not.toBeCloseTo(muzzle[1]);
      expect(wallMuzzle[2]).not.toBeCloseTo(muzzle[2]);
    }
  });

  it('converts flat wall ray hits into camera-space tracer distances', () => {
    const levelWallDistance = 10;
    const levelAim = getHorizontalShotDirectionLength(1, 0);
    const pitchedAim = getHorizontalShotDirectionLength(Math.SQRT1_2, 0);

    expect(getHorizontalRaycastDistance(20, levelAim)).toBeCloseTo(20);
    expect(getCameraSpaceShotDistance(levelWallDistance, levelAim)).toBeCloseTo(levelWallDistance);
    expect(getHorizontalRaycastDistance(20, pitchedAim)).toBeCloseTo(20 * Math.SQRT1_2);
    expect(getCameraSpaceShotDistance(levelWallDistance * Math.SQRT1_2, pitchedAim)).toBeCloseTo(levelWallDistance);
  });

  it('keeps weapon clearance visual without making it a movement blocker', () => {
    const yawFacingEast = -Math.PI / 2;
    const nearEastBoundaryX = 20.4;
    const topLaneZ = -21;
    const weaponCenter = getWeaponCollisionCenter(nearEastBoundaryX, topLaneZ, yawFacingEast);

    expect(collidesWithLevel(nearEastBoundaryX, topLaneZ, PLAYER_COLLISION_RADIUS)).toBe(false);
    expect(weaponCenter.x).toBeGreaterThan(nearEastBoundaryX);
    expect(collidesWithWeaponFootprint(nearEastBoundaryX, topLaneZ, yawFacingEast)).toBe(true);
    expect(collidesWithPlayerFootprint(nearEastBoundaryX, topLaneZ, yawFacingEast)).toBe(false);
  });

  it('keeps player body collision independent from camera yaw', () => {
    const samplePositions = [
      getSpawnPosition(),
      { x: -10, z: 17.8 },
      { x: -9.4, z: 17.2 },
      { x: 8.2, z: 17.5 },
      { x: -21.35, z: -21 },
    ];
    const yaws = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

    for (const position of samplePositions) {
      const bodyCollision = collidesWithLevel(position.x, position.z, PLAYER_COLLISION_RADIUS);

      for (const yaw of yaws) {
        expect(collidesWithPlayerFootprint(position.x, position.z, yaw)).toBe(bodyCollision);
      }
    }
  });

  it('resolves player body overlap out of wall tiles', () => {
    const wallCenter = tileToWorld(0, 1);
    const resolved = resolveLevelCollision(wallCenter.worldX, wallCenter.worldZ, PLAYER_COLLISION_RADIUS);

    expect(resolved.collided).toBe(true);
    expect(resolved.iterations).toBeGreaterThan(0);
    expect(collidesWithLevel(resolved.x, resolved.z, PLAYER_COLLISION_RADIUS)).toBe(false);
    expect(worldToTile(resolved.x, resolved.z)?.symbol).toBe('S');
  });

  it('slides along wall contact instead of freezing tangential movement', () => {
    let player = { x: -21.19, z: -21 };
    const startZ = player.z;

    for (let frame = 0; frame < 45; frame++) {
      const resolved = resolveLevelCollision(player.x - 0.08, player.z + 0.035, PLAYER_COLLISION_RADIUS);
      player = { x: resolved.x, z: resolved.z };

      expect(collidesWithLevel(player.x, player.z, PLAYER_COLLISION_RADIUS)).toBe(false);
    }

    expect(player.x).toBeCloseTo(-21.2, 2);
    expect(player.z).toBeGreaterThan(startZ + 1.2);
  });

  it('keeps structural entry lanes clear for the player body', () => {
    const minimumEntryOpenTiles = Math.ceil(MIN_FOUNDATION_ENTRY_UNITS / LEVEL_TILE_SIZE);
    const minimumWallRunTiles = Math.ceil(MIN_FOUNDATION_PASSAGE_UNITS / LEVEL_TILE_SIZE);
    const entries = findStructuralWallBandEntries(minimumWallRunTiles).filter(
      (entry) => entry.length >= minimumEntryOpenTiles,
    );

    expect(entries.length).toBeGreaterThan(0);

    for (const entry of entries) {
      if (entry.axis === 'row') {
        const centerColumn = Math.floor((entry.start + entry.end) / 2);
        const rows = [entry.row, entry.row - 1, entry.row + 1].filter((row) => isOpenAt(row, centerColumn));
        expect(rows).toContain(entry.row);

        for (const row of rows) {
          const point = tileToWorld(centerColumn, row);
          expect(collidesWithLevel(point.worldX, point.worldZ, PLAYER_COLLISION_RADIUS)).toBe(false);
          expect(resolveLevelCollision(point.worldX, point.worldZ, PLAYER_COLLISION_RADIUS).collided).toBe(false);
        }
      } else {
        const centerRow = Math.floor((entry.start + entry.end) / 2);
        const columns = [entry.column, entry.column - 1, entry.column + 1].filter((column) =>
          isOpenAt(centerRow, column),
        );
        expect(columns).toContain(entry.column);

        for (const column of columns) {
          const point = tileToWorld(column, centerRow);
          expect(collidesWithLevel(point.worldX, point.worldZ, PLAYER_COLLISION_RADIUS)).toBe(false);
          expect(resolveLevelCollision(point.worldX, point.worldZ, PLAYER_COLLISION_RADIUS).collided).toBe(false);
        }
      }
    }
  });

  it('cache-busts public asset URLs with the current build id', () => {
    expect(publicAssetUrl('assets/weapons/example.glb')).toMatch(
      /assets\/weapons\/example\.glb\?assetBuild=.+/,
    );
    expect(withAssetVersion('Textures/colormap.png')).toMatch(/^Textures\/colormap\.png\?assetBuild=.+/);
    expect(publicAssetUrl('assets/environment/kenney-prototype-textures/textures/floor-grid-steel.png')).toMatch(
      /assets\/environment\/kenney-prototype-textures\/textures\/floor-grid-steel\.png\?assetBuild=.+/,
    );
    expect(publicAssetUrl('assets/audio/elevenlabs-foundation/spark-sidearm.mp3')).toMatch(
      /assets\/audio\/elevenlabs-foundation\/spark-sidearm\.mp3\?assetBuild=.+/,
    );
    expect(publicAssetUrl('assets/title/gadget-rift-title-bg.webp')).toMatch(
      /assets\/title\/gadget-rift-title-bg\.webp\?assetBuild=.+/,
    );
    expect(publicAssetUrl('assets/audio/elevenlabs-foundation/glyph-at-your-service.mp3')).toMatch(
      /assets\/audio\/elevenlabs-foundation\/glyph-at-your-service\.mp3\?assetBuild=.+/,
    );
    expect(withAssetVersion('Textures/colormap.png?assetBuild=already')).toBe(
      'Textures/colormap.png?assetBuild=already',
    );
    expect(withAssetVersion('data:application/octet-stream;base64,AA==')).toBe(
      'data:application/octet-stream;base64,AA==',
    );
  });
});

function countOpenRun(row: number, column: number, rowStep: number, columnStep: number): number {
  let openTiles = 0;
  let nextRow = row + rowStep;
  let nextColumn = column + columnStep;

  while (
    nextRow >= 0 &&
    nextRow < LEVEL_HEIGHT_TILES &&
    nextColumn >= 0 &&
    nextColumn < LEVEL_WIDTH_TILES &&
    !isSolidSymbol(FOUNDATION_LEVEL_MAP[nextRow][nextColumn] as LevelTileSymbol)
  ) {
    openTiles++;
    nextRow += rowStep;
    nextColumn += columnStep;
  }

  return openTiles;
}

function findNarrowBoundedSegments(minimumOpenTiles: number): Array<Record<string, number | string>> {
  const segments: Array<Record<string, number | string>> = [];

  for (let row = 0; row < LEVEL_HEIGHT_TILES; row++) {
    let start: number | null = null;
    for (let column = 0; column <= LEVEL_WIDTH_TILES; column++) {
      const isOpen =
        column < LEVEL_WIDTH_TILES && !isSolidSymbol(FOUNDATION_LEVEL_MAP[row][column] as LevelTileSymbol);
      if (isOpen && start === null) {
        start = column;
      }
      if ((!isOpen || column === LEVEL_WIDTH_TILES) && start !== null) {
        const end = column - 1;
        const bounded =
          start > 0 &&
          end < LEVEL_WIDTH_TILES - 1 &&
          isSolidSymbol(FOUNDATION_LEVEL_MAP[row][start - 1] as LevelTileSymbol) &&
          isSolidSymbol(FOUNDATION_LEVEL_MAP[row][end + 1] as LevelTileSymbol);
        if (bounded && end - start + 1 < minimumOpenTiles) {
          segments.push({ axis: 'row', row, start, end });
        }
        start = null;
      }
    }
  }

  for (let column = 0; column < LEVEL_WIDTH_TILES; column++) {
    let start: number | null = null;
    for (let row = 0; row <= LEVEL_HEIGHT_TILES; row++) {
      const isOpen =
        row < LEVEL_HEIGHT_TILES && !isSolidSymbol(FOUNDATION_LEVEL_MAP[row][column] as LevelTileSymbol);
      if (isOpen && start === null) {
        start = row;
      }
      if ((!isOpen || row === LEVEL_HEIGHT_TILES) && start !== null) {
        const end = row - 1;
        const bounded =
          start > 0 &&
          end < LEVEL_HEIGHT_TILES - 1 &&
          isSolidSymbol(FOUNDATION_LEVEL_MAP[start - 1][column] as LevelTileSymbol) &&
          isSolidSymbol(FOUNDATION_LEVEL_MAP[end + 1][column] as LevelTileSymbol);
        if (bounded && end - start + 1 < minimumOpenTiles) {
          segments.push({ axis: 'column', column, start, end });
        }
        start = null;
      }
    }
  }

  return segments;
}

function findNarrowBoundedWallEntries(
  minimumEntryOpenTiles: number,
  minimumWallRunTiles: number,
): WallBandEntry[] {
  return findStructuralWallBandEntries(minimumWallRunTiles).filter(
    (entry) => entry.length < minimumEntryOpenTiles,
  );
}

function countStructuralWallRun(row: number, column: number, rowStep: number, columnStep: number): number {
  let count = 0;
  let nextRow = row;
  let nextColumn = column;

  while (
    nextRow >= 0 &&
    nextRow < LEVEL_HEIGHT_TILES &&
    nextColumn >= 0 &&
    nextColumn < LEVEL_WIDTH_TILES &&
    FOUNDATION_LEVEL_MAP[nextRow][nextColumn] === '#'
  ) {
    count++;
    nextRow += rowStep;
    nextColumn += columnStep;
  }

  return count;
}

type WallBandEntry =
  | { axis: 'row'; row: number; start: number; end: number; length: number }
  | { axis: 'column'; column: number; start: number; end: number; length: number };

function findNarrowWallEntrySplitters(
  minimumEntryOpenTiles: number,
  minimumWallRunTiles: number,
  minimumEntrySplitSideTiles: number,
  minimumEntrySplitAreaTiles: number,
): Array<Record<string, number | string>> {
  const splitters: Array<Record<string, number | string>> = [];
  const entries = findStructuralWallBandEntries(minimumWallRunTiles).filter(
    (entry) => entry.length >= minimumEntryOpenTiles,
  );

  for (const entry of entries) {
    if (entry.axis === 'row') {
      splitters.push(...findRowEntrySplitters(entry, minimumEntrySplitSideTiles, minimumEntrySplitAreaTiles));
    } else {
      splitters.push(...findColumnEntrySplitters(entry, minimumEntrySplitSideTiles, minimumEntrySplitAreaTiles));
    }
  }

  return splitters;
}

function findStructuralWallBandEntries(minimumWallRunTiles: number): WallBandEntry[] {
  const entries: WallBandEntry[] = [];

  for (let row = 0; row < LEVEL_HEIGHT_TILES; row++) {
    let start: number | null = null;
    for (let column = 0; column <= LEVEL_WIDTH_TILES; column++) {
      const isWall = column < LEVEL_WIDTH_TILES && FOUNDATION_LEVEL_MAP[row][column] === '#';
      if (!isWall && column < LEVEL_WIDTH_TILES && start === null) {
        start = column;
      }
      if ((isWall || column === LEVEL_WIDTH_TILES) && start !== null) {
        const end = column - 1;
        const bounded =
          start > 0 &&
          end < LEVEL_WIDTH_TILES - 1 &&
          FOUNDATION_LEVEL_MAP[row][start - 1] === '#' &&
          FOUNDATION_LEVEL_MAP[row][end + 1] === '#';
        if (
          bounded &&
          countStructuralWallRun(row, start - 1, 0, -1) >= minimumWallRunTiles &&
          countStructuralWallRun(row, end + 1, 0, 1) >= minimumWallRunTiles
        ) {
          entries.push({ axis: 'row', row, start, end, length: end - start + 1 });
        }
        start = null;
      }
    }
  }

  for (let column = 0; column < LEVEL_WIDTH_TILES; column++) {
    let start: number | null = null;
    for (let row = 0; row <= LEVEL_HEIGHT_TILES; row++) {
      const isWall = row < LEVEL_HEIGHT_TILES && FOUNDATION_LEVEL_MAP[row][column] === '#';
      if (!isWall && row < LEVEL_HEIGHT_TILES && start === null) {
        start = row;
      }
      if ((isWall || row === LEVEL_HEIGHT_TILES) && start !== null) {
        const end = row - 1;
        const bounded =
          start > 0 &&
          end < LEVEL_HEIGHT_TILES - 1 &&
          FOUNDATION_LEVEL_MAP[start - 1][column] === '#' &&
          FOUNDATION_LEVEL_MAP[end + 1][column] === '#';
        if (
          bounded &&
          countStructuralWallRun(start - 1, column, -1, 0) >= minimumWallRunTiles &&
          countStructuralWallRun(end + 1, column, 1, 0) >= minimumWallRunTiles
        ) {
          entries.push({ axis: 'column', column, start, end, length: end - start + 1 });
        }
        start = null;
      }
    }
  }

  return entries;
}

function findRowEntrySplitters(
  entry: Extract<WallBandEntry, { axis: 'row' }>,
  minimumEntrySplitSideTiles: number,
  minimumEntrySplitAreaTiles: number,
): Array<Record<string, number | string>> {
  const splitters: Array<Record<string, number | string>> = [];

  for (const adjacentRow of [entry.row - 1, entry.row + 1]) {
    if (adjacentRow < 0 || adjacentRow >= LEVEL_HEIGHT_TILES) {
      continue;
    }

    const awayRow = adjacentRow < entry.row ? adjacentRow - 1 : adjacentRow + 1;
    for (let column = entry.start + 1; column <= entry.end - 1; column++) {
      if (
        FOUNDATION_LEVEL_MAP[adjacentRow][column] !== '#' ||
        !isOpenAt(entry.row, column) ||
        !isStructuralWallAt(awayRow, column) ||
        !isOpenAt(adjacentRow, column - 1) ||
        !isOpenAt(adjacentRow, column + 1)
      ) {
        continue;
      }

      const leftClearance = countOpenInRowSegment(adjacentRow, column - 1, -1, entry.start, entry.end);
      const rightClearance = countOpenInRowSegment(adjacentRow, column + 1, 1, entry.start, entry.end);
      if (
        leftClearance < minimumEntrySplitSideTiles ||
        rightClearance < minimumEntrySplitSideTiles ||
        leftClearance + rightClearance < minimumEntrySplitAreaTiles
      ) {
        splitters.push({ axis: 'row', row: entry.row, adjacentRow, splitterColumn: column });
      }
    }
  }

  return splitters;
}

function findColumnEntrySplitters(
  entry: Extract<WallBandEntry, { axis: 'column' }>,
  minimumEntrySplitSideTiles: number,
  minimumEntrySplitAreaTiles: number,
): Array<Record<string, number | string>> {
  const splitters: Array<Record<string, number | string>> = [];

  for (const adjacentColumn of [entry.column - 1, entry.column + 1]) {
    if (adjacentColumn < 0 || adjacentColumn >= LEVEL_WIDTH_TILES) {
      continue;
    }

    const awayColumn = adjacentColumn < entry.column ? adjacentColumn - 1 : adjacentColumn + 1;
    for (let row = entry.start + 1; row <= entry.end - 1; row++) {
      if (
        FOUNDATION_LEVEL_MAP[row][adjacentColumn] !== '#' ||
        !isOpenAt(row, entry.column) ||
        !isStructuralWallAt(row, awayColumn) ||
        !isOpenAt(row - 1, adjacentColumn) ||
        !isOpenAt(row + 1, adjacentColumn)
      ) {
        continue;
      }

      const upperClearance = countOpenInColumnSegment(adjacentColumn, row - 1, -1, entry.start, entry.end);
      const lowerClearance = countOpenInColumnSegment(adjacentColumn, row + 1, 1, entry.start, entry.end);
      if (
        upperClearance < minimumEntrySplitSideTiles ||
        lowerClearance < minimumEntrySplitSideTiles ||
        upperClearance + lowerClearance < minimumEntrySplitAreaTiles
      ) {
        splitters.push({ axis: 'column', column: entry.column, adjacentColumn, splitterRow: row });
      }
    }
  }

  return splitters;
}

function countOpenInRowSegment(row: number, column: number, columnStep: number, start: number, end: number): number {
  let count = 0;
  let nextColumn = column;

  while (nextColumn >= start && nextColumn <= end && isOpenAt(row, nextColumn)) {
    count++;
    nextColumn += columnStep;
  }

  return count;
}

function countOpenInColumnSegment(column: number, row: number, rowStep: number, start: number, end: number): number {
  let count = 0;
  let nextRow = row;

  while (nextRow >= start && nextRow <= end && isOpenAt(nextRow, column)) {
    count++;
    nextRow += rowStep;
  }

  return count;
}

function isOpenAt(row: number, column: number): boolean {
  return (
    row >= 0 &&
    row < LEVEL_HEIGHT_TILES &&
    column >= 0 &&
    column < LEVEL_WIDTH_TILES &&
    !isSolidSymbol(FOUNDATION_LEVEL_MAP[row][column] as LevelTileSymbol)
  );
}

function isStructuralWallAt(row: number, column: number): boolean {
  return (
    row >= 0 &&
    row < LEVEL_HEIGHT_TILES &&
    column >= 0 &&
    column < LEVEL_WIDTH_TILES &&
    FOUNDATION_LEVEL_MAP[row][column] === '#'
  );
}

function findDiagonalCornerCuts(): Array<Record<string, number | string>> {
  const cuts: Array<Record<string, number | string>> = [];

  for (let row = 0; row < LEVEL_HEIGHT_TILES - 1; row++) {
    for (let column = 0; column < LEVEL_WIDTH_TILES - 1; column++) {
      const topLeftSolid = isSolidSymbol(FOUNDATION_LEVEL_MAP[row][column] as LevelTileSymbol);
      const topRightSolid = isSolidSymbol(FOUNDATION_LEVEL_MAP[row][column + 1] as LevelTileSymbol);
      const bottomLeftSolid = isSolidSymbol(FOUNDATION_LEVEL_MAP[row + 1][column] as LevelTileSymbol);
      const bottomRightSolid = isSolidSymbol(FOUNDATION_LEVEL_MAP[row + 1][column + 1] as LevelTileSymbol);

      if (topLeftSolid && bottomRightSolid && !topRightSolid && !bottomLeftSolid) {
        cuts.push({ row, column, pattern: 'solid NW/SE' });
      }
      if (topRightSolid && bottomLeftSolid && !topLeftSolid && !bottomRightSolid) {
        cuts.push({ row, column, pattern: 'solid NE/SW' });
      }
    }
  }

  return cuts;
}

function findCornerPinches(): Array<Record<string, number | string>> {
  const pinches: Array<Record<string, number | string>> = [];
  const patterns = [
    {
      pattern: 'east wall plus northwest corner',
      cardinal: [0, 1],
      diagonal: [-1, -1],
      openA: [-1, 0],
      openB: [0, -1],
    },
    {
      pattern: 'east wall plus southwest corner',
      cardinal: [0, 1],
      diagonal: [1, -1],
      openA: [1, 0],
      openB: [0, -1],
    },
    {
      pattern: 'west wall plus northeast corner',
      cardinal: [0, -1],
      diagonal: [-1, 1],
      openA: [-1, 0],
      openB: [0, 1],
    },
    {
      pattern: 'west wall plus southeast corner',
      cardinal: [0, -1],
      diagonal: [1, 1],
      openA: [1, 0],
      openB: [0, 1],
    },
    {
      pattern: 'north wall plus southeast corner',
      cardinal: [-1, 0],
      diagonal: [1, 1],
      openA: [0, 1],
      openB: [1, 0],
    },
    {
      pattern: 'north wall plus southwest corner',
      cardinal: [-1, 0],
      diagonal: [1, -1],
      openA: [0, -1],
      openB: [1, 0],
    },
    {
      pattern: 'south wall plus northeast corner',
      cardinal: [1, 0],
      diagonal: [-1, 1],
      openA: [0, 1],
      openB: [-1, 0],
    },
    {
      pattern: 'south wall plus northwest corner',
      cardinal: [1, 0],
      diagonal: [-1, -1],
      openA: [0, -1],
      openB: [-1, 0],
    },
  ] as const;

  for (let row = 1; row < LEVEL_HEIGHT_TILES - 1; row++) {
    for (let column = 1; column < LEVEL_WIDTH_TILES - 1; column++) {
      const symbol = FOUNDATION_LEVEL_MAP[row][column] as LevelTileSymbol;
      if (isSolidSymbol(symbol)) {
        continue;
      }

      for (const pattern of patterns) {
        if (
          isSolidAtOffset(row, column, pattern.cardinal) &&
          isSolidAtOffset(row, column, pattern.diagonal) &&
          !isSolidAtOffset(row, column, pattern.openA) &&
          !isSolidAtOffset(row, column, pattern.openB)
        ) {
          pinches.push({ row, column, pattern: pattern.pattern });
        }
      }
    }
  }

  return pinches;
}

function isSolidAtOffset(row: number, column: number, offset: readonly [number, number]): boolean {
  return isSolidSymbol(FOUNDATION_LEVEL_MAP[row + offset[0]][column + offset[1]] as LevelTileSymbol);
}

function collectReachableTileKeys(startRow: number, startColumn: number): Set<string> {
  const queue = [{ row: startRow, column: startColumn }];
  const visited = new Set([`${startRow}:${startColumn}`]);

  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    for (const [rowStep, columnStep] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      const row = current.row + rowStep;
      const column = current.column + columnStep;
      const key = `${row}:${column}`;
      if (
        row < 0 ||
        row >= LEVEL_HEIGHT_TILES ||
        column < 0 ||
        column >= LEVEL_WIDTH_TILES ||
        visited.has(key) ||
        isSolidSymbol(FOUNDATION_LEVEL_MAP[row][column] as LevelTileSymbol)
      ) {
        continue;
      }

      visited.add(key);
      queue.push({ row, column });
    }
  }

  return visited;
}

function collectReachableTileKeysForMap(map: readonly string[], startRow: number, startColumn: number): Set<string> {
  const queue = [{ row: startRow, column: startColumn }];
  const visited = new Set([`${startRow}:${startColumn}`]);

  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    for (const [rowStep, columnStep] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ] as const) {
      const row = current.row + rowStep;
      const column = current.column + columnStep;
      const key = `${row}:${column}`;
      if (
        row < 0 ||
        row >= map.length ||
        column < 0 ||
        column >= map[row].length ||
        visited.has(key) ||
        isSolidSymbol(map[row][column] as LevelTileSymbol)
      ) {
        continue;
      }

      visited.add(key);
      queue.push({ row, column });
    }
  }

  return visited;
}

function findSymbolInMap(map: readonly string[], symbol: string): { row: number; column: number } | null {
  for (let row = 0; row < map.length; row++) {
    const column = map[row].indexOf(symbol);
    if (column !== -1) {
      return { row, column };
    }
  }

  return null;
}

function countSymbolInMap(map: readonly string[], symbol: string): number {
  return map.reduce((total, row) => total + [...row].filter((tile) => tile === symbol).length, 0);
}

function countWalkableTiles(map: readonly string[]): number {
  return map.reduce(
    (total, row) => total + [...row].filter((symbol) => !isSolidSymbol(symbol as LevelTileSymbol)).length,
    0,
  );
}

function expectTupleClose(actual: readonly [number, number, number], expected: readonly [number, number, number]): void {
  expect(actual[0]).toBeCloseTo(expected[0]);
  expect(actual[1]).toBeCloseTo(expected[1]);
  expect(actual[2]).toBeCloseTo(expected[2]);
}

function getWeaponById(id: string) {
  const weapon = WEAPON_DEFINITIONS.find((definition) => definition.id === id);
  if (!weapon) {
    throw new Error(`Missing weapon definition ${id}`);
  }

  return weapon;
}

type EnemySnapshotForTest = ReturnType<EnemySystem['getSnapshot']>['enemies'][number];

function expectEnemyAttachmentsAligned(enemy: EnemySnapshotForTest): void {
  for (const attachment of Object.values(enemy.attachments)) {
    expect(attachment[0]).toBeCloseTo(enemy.position[0], 3);
    expect(attachment[2]).toBeCloseTo(enemy.position[2], 3);
  }
}

import { describe, expect, it } from 'vitest';
import { DEBUG_SCENE_ID, MOBILE_VIEWPORTS, PERFORMANCE_BUDGETS } from '../game/config';
import {
  FOUNDATION_LEVEL_MAP,
  FOUNDATION_LEVEL_ID,
  LEVEL_CHUNK_LOAD_RADIUS,
  LEVEL_CHUNK_SIZE_TILES,
  LEVEL_HEIGHT_TILES,
  LEVEL_TILE_SIZE,
  LEVEL_WIDTH_TILES,
  type LevelTileSymbol,
  MIN_FOUNDATION_PASSAGE_UNITS,
  collidesWithLevel,
  getLevelTiles,
  getSpawnPosition,
  isSolidSymbol,
  raycastLevel,
  worldToTile,
} from '../game/levelMap';
import { createLevelChunks, getActiveChunkIdsForTile } from '../game/levelStreaming';
import {
  MOVE_SPEED_UNITS_PER_SECOND,
  PLAYER_COLLISION_RADIUS,
  collidesWithPlayerFootprint,
  getWeaponCollisionCenter,
} from '../game/fpsControls';
import { getWeaponFootprintClearance } from '../game/weapons/weaponClearance';
import { WEAPON_ASSET_SOURCE, WEAPON_DEFINITIONS, publicAssetUrl, withAssetVersion } from '../game/weapons/weaponManifest';

describe('FPS foundation config', () => {
  it('keeps the bootstrap scene aligned with the mobile landscape gates', () => {
    expect(DEBUG_SCENE_ID).toBe('fps-level-foundation');
    expect(PERFORMANCE_BUDGETS.targetFps).toBe(60);
    expect(PERFORMANCE_BUDGETS.drawCallsMax).toBeLessThanOrEqual(90);
    expect(PERFORMANCE_BUDGETS.trianglesMax).toBeLessThanOrEqual(250_000);
    expect(PERFORMANCE_BUDGETS.initialScenePayloadMbMax).toBeLessThanOrEqual(40);
    expect(MOVE_SPEED_UNITS_PER_SECOND).toBeCloseTo(4.0625);
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
    expect(tiles).toHaveLength(LEVEL_WIDTH_TILES * LEVEL_HEIGHT_TILES);
    expect(tiles.filter((tile) => tile.symbol === 'S')).toHaveLength(1);
    expect(tiles.filter((tile) => tile.symbol === 'E')).toHaveLength(1);

    for (let index = 0; index < LEVEL_WIDTH_TILES; index++) {
      expect(FOUNDATION_LEVEL_MAP[0][index]).toBe('#');
      expect(FOUNDATION_LEVEL_MAP[LEVEL_HEIGHT_TILES - 1][index]).toBe('#');
      expect(FOUNDATION_LEVEL_MAP[index][0]).toBe('#');
      expect(FOUNDATION_LEVEL_MAP[index][LEVEL_WIDTH_TILES - 1]).toBe('#');
    }
  });

  it('partitions the level into streamable chunks around the player', () => {
    const chunks = createLevelChunks(getLevelTiles());
    const spawnActiveChunkIds = getActiveChunkIdsForTile(1, 1);

    expect(LEVEL_CHUNK_SIZE_TILES).toBe(9);
    expect(LEVEL_CHUNK_LOAD_RADIUS).toBe(2);
    expect(chunks).toHaveLength(25);
    expect(spawnActiveChunkIds).toContain('0:0');
    expect(spawnActiveChunkIds).toHaveLength(9);
    expect(spawnActiveChunkIds.length).toBeLessThan(chunks.length);
  });

  it('keeps walkable lanes at least three units wide', () => {
    const minimumOpenTiles = Math.ceil(MIN_FOUNDATION_PASSAGE_UNITS / LEVEL_TILE_SIZE);

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

    expect(findNarrowBoundedSegments(minimumOpenTiles)).toEqual([]);
    expect(findDiagonalCornerCuts()).toEqual([]);
    expect(findCornerPinches()).toEqual([]);
    expect(worldToTile(12.1, -2.1)?.symbol).toBe('#');
    expect(worldToTile(12.2, 7.6)?.symbol).toBe('#');
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

    expect(WEAPON_ASSET_SOURCE.license).toBe('Creative Commons Zero, CC0');
    expect(WEAPON_ASSET_SOURCE.attributionRequired).toBe(false);
    expect(WEAPON_DEFINITIONS).toHaveLength(3);
    expect(new Set(weaponIds).size).toBe(WEAPON_DEFINITIONS.length);
    expect(totalModelBytes).toBeLessThan(1_000_000);

    for (const weapon of WEAPON_DEFINITIONS) {
      expect(weapon.modelPath).toMatch(/^assets\/weapons\/kenney-blaster-kit\/models\/.+\.glb$/);
      expect(weapon.previewPath).toMatch(/^assets\/weapons\/kenney-blaster-kit\/previews\/.+\.png$/);
      expect(weapon.magazineSize).toBeGreaterThan(0);
      expect(weapon.fireIntervalMs).toBeGreaterThan(100);
      expect(weapon.recoilKick).toBeGreaterThan(0);
      expect(weapon.rangeUnits).toBeGreaterThan(12);
      expect(weapon.view.position[0]).toBeGreaterThanOrEqual(0.52);
      expect(clearance.rightOffset).toBeGreaterThanOrEqual(weapon.view.position[0]);
      expect(clearance.forwardOffset).toBeGreaterThanOrEqual(Math.abs(weapon.view.position[2]));
      expect(weapon.view.rotation[1]).toBeCloseTo(0);
    }
  });

  it('extends player collision with a right-handed weapon footprint', () => {
    const yawFacingEast = -Math.PI / 2;
    const nearEastBoundaryX = 20.4;
    const topLaneZ = -21;
    const weaponCenter = getWeaponCollisionCenter(nearEastBoundaryX, topLaneZ, yawFacingEast);

    expect(collidesWithLevel(nearEastBoundaryX, topLaneZ, PLAYER_COLLISION_RADIUS)).toBe(false);
    expect(weaponCenter.x).toBeGreaterThan(nearEastBoundaryX);
    expect(collidesWithPlayerFootprint(nearEastBoundaryX, topLaneZ, yawFacingEast)).toBe(true);
  });

  it('cache-busts public asset URLs with the current build id', () => {
    expect(publicAssetUrl('assets/weapons/example.glb')).toMatch(
      /assets\/weapons\/example\.glb\?assetBuild=.+/,
    );
    expect(withAssetVersion('Textures/colormap.png')).toMatch(/^Textures\/colormap\.png\?assetBuild=.+/);
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

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
} from '../game/levelMap';
import { createLevelChunks, getActiveChunkIdsForTile } from '../game/levelStreaming';

describe('FPS foundation config', () => {
  it('keeps the bootstrap scene aligned with the mobile landscape gates', () => {
    expect(DEBUG_SCENE_ID).toBe('fps-level-foundation');
    expect(PERFORMANCE_BUDGETS.targetFps).toBe(60);
    expect(PERFORMANCE_BUDGETS.drawCallsMax).toBeLessThanOrEqual(90);
    expect(PERFORMANCE_BUDGETS.trianglesMax).toBeLessThanOrEqual(250_000);
    expect(PERFORMANCE_BUDGETS.initialScenePayloadMbMax).toBeLessThanOrEqual(40);
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
  });

  it('keeps spawn open while treating boundaries as solid', () => {
    const spawn = getSpawnPosition();

    expect(collidesWithLevel(spawn.x, spawn.z, 0.24)).toBe(false);
    expect(collidesWithLevel(-22.6, 0, 0.24)).toBe(true);
    expect(collidesWithLevel(22.6, 0, 0.24)).toBe(true);
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

import { describe, expect, it } from 'vitest';
import { DEBUG_SCENE_ID, MOBILE_VIEWPORTS, PERFORMANCE_BUDGETS } from '../game/config';
import {
  FOUNDATION_LEVEL_MAP,
  LEVEL_HEIGHT_TILES,
  LEVEL_WIDTH_TILES,
  collidesWithLevel,
  getLevelTiles,
  getSpawnPosition,
} from '../game/levelMap';

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

  it('uses a valid 20 x 20 symbol map with boundary collision', () => {
    expect(FOUNDATION_LEVEL_MAP).toHaveLength(LEVEL_HEIGHT_TILES);
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

  it('keeps spawn open while treating boundaries as solid', () => {
    const spawn = getSpawnPosition();

    expect(collidesWithLevel(spawn.x, spawn.z, 0.24)).toBe(false);
    expect(collidesWithLevel(-10.1, 0, 0.24)).toBe(true);
    expect(collidesWithLevel(10.1, 0, 0.24)).toBe(true);
  });
});

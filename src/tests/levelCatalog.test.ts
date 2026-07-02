import { describe, expect, it } from 'vitest';
import { levelCatalog } from '../content/levelCatalog';

describe('levelCatalog', () => {
  it('loads ordered tutorial levels with metadata', () => {
    expect(levelCatalog).toHaveLength(12);
    expect(levelCatalog.map((entry) => entry.order)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(levelCatalog.map((entry) => entry.id)).toEqual([
      'tutorial-01',
      'tutorial-02',
      'tutorial-03',
      'tutorial-04',
      'tutorial-05',
      'tutorial-06',
      'tutorial-07',
      'tutorial-08',
      'tutorial-09',
      'tutorial-10',
      'tutorial-11',
      'tutorial-12',
    ]);
  });

  it('parses every catalog level into a consistent 8x8 grid', () => {
    for (const entry of levelCatalog) {
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.lesson.length).toBeGreaterThan(0);
      expect(entry.level.width).toBe(8);
      expect(entry.level.height).toBe(8);
      expect(entry.level.playerStart).toBeDefined();
      expect(entry.level.exits.length).toBeGreaterThan(0);
    }
  });
});

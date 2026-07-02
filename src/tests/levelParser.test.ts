import { describe, expect, it } from 'vitest';
import { LevelParseError, parseLevel } from '../core/levelParser';
import type { LevelDefinition } from '../core/levelTypes';
import tutorialLevel from '../content/levels/tutorial-01.json';

describe('parseLevel', () => {
  it('parses the tutorial level dimensions and entities', () => {
    const parsed = parseLevel(tutorialLevel as LevelDefinition);

    expect(parsed.width).toBe(8);
    expect(parsed.height).toBe(8);
    expect(parsed.playerStart).toEqual({ x: 1, y: 1 });
    expect(parsed.crates).toEqual([]);
    expect(parsed.pressurePlates).toEqual([]);
    expect(parsed.doors).toEqual([]);
    expect(parsed.exits).toEqual([{ x: 6, y: 1 }]);
  });

  it('requires exactly one player start', () => {
    expect(() =>
      parseLevel({
        id: 'missing-player',
        name: 'Missing Player',
        map: ['###', '#.#', '###'],
      }),
    ).toThrow(/expected exactly one player start, found 0/);

    expect(() =>
      parseLevel({
        id: 'two-players',
        name: 'Two Players',
        map: ['####', '#PP#', '####'],
      }),
    ).toThrow(/expected exactly one player start, found 2/);
  });

  it('reports unknown symbols with row and column', () => {
    expect(() =>
      parseLevel({
        id: 'unknown-symbol',
        name: 'Unknown Symbol',
        map: ['###', '#PX', '###'],
      }),
    ).toThrow(LevelParseError);

    expect(() =>
      parseLevel({
        id: 'unknown-symbol',
        name: 'Unknown Symbol',
        map: ['###', '#PX', '###'],
      }),
    ).toThrow(/unknown symbol "X" at row 2, column 3/);
  });

  it('requires every row to have a consistent width', () => {
    expect(() =>
      parseLevel({
        id: 'ragged',
        name: 'Ragged',
        map: ['####', '#P#', '####'],
      }),
    ).toThrow(/row 2 has width 3, expected 4/);
  });
});

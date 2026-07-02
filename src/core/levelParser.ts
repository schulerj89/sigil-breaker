import type {
  Door,
  LevelDefinition,
  ParsedLevel,
  PressurePlate,
  TerrainTile,
} from './levelTypes';
import type { Position } from './grid';

const symbolDescriptions: Record<string, string> = {
  '#': 'wall',
  '.': 'floor',
  P: 'player',
  C: 'crate',
  R: 'red pressure plate',
  D: 'red door',
  E: 'exit',
};

export class LevelParseError extends Error {
  constructor(
    message: string,
    readonly levelId: string,
  ) {
    super(`Level "${levelId}" is invalid: ${message}`);
    this.name = 'LevelParseError';
  }
}

export function parseLevel(definition: LevelDefinition): ParsedLevel {
  const { id, name, map } = definition;

  if (map.length === 0) {
    throw new LevelParseError('map must contain at least one row', id);
  }

  const width = map[0]?.length ?? 0;
  if (width === 0) {
    throw new LevelParseError('map rows must not be empty', id);
  }

  const tiles: TerrainTile[][] = [];
  const crates: Position[] = [];
  const pressurePlates: PressurePlate[] = [];
  const doors: Door[] = [];
  const exits: Position[] = [];
  const playerStarts: Position[] = [];

  map.forEach((row, y) => {
    if (row.length !== width) {
      throw new LevelParseError(
        `row ${y + 1} has width ${row.length}, expected ${width}`,
        id,
      );
    }

    const parsedRow: TerrainTile[] = [];
    [...row].forEach((symbol, x) => {
      if (!(symbol in symbolDescriptions)) {
        throw new LevelParseError(
          `unknown symbol "${symbol}" at row ${y + 1}, column ${x + 1}`,
          id,
        );
      }

      const position = { x, y };
      parsedRow.push(tileForSymbol(symbol));

      if (symbol === 'P') {
        playerStarts.push(position);
      }

      if (symbol === 'C') {
        crates.push(position);
      }

      if (symbol === 'R') {
        pressurePlates.push({ position, color: 'red' });
      }

      if (symbol === 'D') {
        doors.push({ position, color: 'red' });
      }

      if (symbol === 'E') {
        exits.push(position);
      }
    });

    tiles.push(parsedRow);
  });

  if (playerStarts.length !== 1) {
    throw new LevelParseError(
      `expected exactly one player start, found ${playerStarts.length}`,
      id,
    );
  }

  return {
    id,
    name,
    width,
    height: map.length,
    tiles,
    playerStart: playerStarts[0],
    crates,
    pressurePlates,
    doors,
    exits,
  };
}

function tileForSymbol(symbol: string): TerrainTile {
  switch (symbol) {
    case '#':
      return { kind: 'wall' };
    case 'R':
      return { kind: 'pressurePlate', color: 'red' };
    case 'D':
      return { kind: 'door', color: 'red' };
    case 'E':
      return { kind: 'exit' };
    case '.':
    case 'P':
    case 'C':
      return { kind: 'floor' };
    default:
      throw new Error(`Unsupported parsed symbol: ${symbol}`);
  }
}

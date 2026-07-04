import * as THREE from 'three';

export const LEVEL_TILE_SIZE = 1;
export const LEVEL_WIDTH_TILES = 34;
export const LEVEL_HEIGHT_TILES = 34;
export const MIN_FOUNDATION_PASSAGE_UNITS = 3;
export const LEVEL_WORLD_WIDTH = LEVEL_WIDTH_TILES * LEVEL_TILE_SIZE;
export const LEVEL_WORLD_DEPTH = LEVEL_HEIGHT_TILES * LEVEL_TILE_SIZE;

export const FOUNDATION_LEVEL_MAP = [
  '##################################',
  '#S...............#..............E#',
  '#................#...............#',
  '#................#...............#',
  '#................#...............#',
  '#....C...........#..........C....#',
  '#................#...............#',
  '#................#...............#',
  '#................#...............#',
  '#############.....################',
  '#.........#.............#........#',
  '#.........#.............#........#',
  '#.........#.............#........#',
  '#.........#.............#........#',
  '#....C....#......C......#...C....#',
  '#.........#.............#........#',
  '#.........#.............#........#',
  '#.........#.............#........#',
  '######.....############.....######',
  '#.......#.............#..........#',
  '#.......#.............#..........#',
  '#.......#.............#..........#',
  '#.......#.............#..........#',
  '#.......#......C......#......C...#',
  '#.......#.............#..........#',
  '#.......#.............#..........#',
  '#.......#.............#..........#',
  '#############.....#######.....####',
  '#................................#',
  '#................................#',
  '#................................#',
  '#................................#',
  '#................................#',
  '##################################',
] as const;

export type LevelTileSymbol = '#' | '.' | 'S' | 'E' | 'C';

export interface LevelTile {
  column: number;
  row: number;
  symbol: LevelTileSymbol;
  solid: boolean;
  worldX: number;
  worldZ: number;
}

export function getLevelTiles(): LevelTile[] {
  const tiles: LevelTile[] = [];

  for (let row = 0; row < FOUNDATION_LEVEL_MAP.length; row++) {
    const line = FOUNDATION_LEVEL_MAP[row];
    for (let column = 0; column < line.length; column++) {
      const symbol = line[column] as LevelTileSymbol;
      tiles.push({
        column,
        row,
        symbol,
        solid: isSolidSymbol(symbol),
        ...tileToWorld(column, row),
      });
    }
  }

  return tiles;
}

export function getSpawnPosition(): THREE.Vector3 {
  const spawnTile = getLevelTiles().find((tile) => tile.symbol === 'S');
  if (!spawnTile) {
    throw new Error('Foundation level is missing an S spawn tile.');
  }

  return new THREE.Vector3(spawnTile.worldX, 0, spawnTile.worldZ);
}

export function collidesWithLevel(worldX: number, worldZ: number, radius: number): boolean {
  const samples = [
    [worldX - radius, worldZ - radius],
    [worldX + radius, worldZ - radius],
    [worldX - radius, worldZ + radius],
    [worldX + radius, worldZ + radius],
    [worldX, worldZ - radius],
    [worldX, worldZ + radius],
    [worldX - radius, worldZ],
    [worldX + radius, worldZ],
  ];

  return samples.some(([sampleX, sampleZ]) => isSolidAtWorld(sampleX, sampleZ));
}

export function isSolidAtWorld(worldX: number, worldZ: number): boolean {
  const tile = worldToTile(worldX, worldZ);
  if (!tile) {
    return true;
  }

  return isSolidSymbol(tile.symbol);
}

export function worldToTile(
  worldX: number,
  worldZ: number,
): { column: number; row: number; symbol: LevelTileSymbol } | null {
  const column = Math.floor((worldX + LEVEL_WORLD_WIDTH / 2) / LEVEL_TILE_SIZE);
  const row = Math.floor((worldZ + LEVEL_WORLD_DEPTH / 2) / LEVEL_TILE_SIZE);

  if (row < 0 || row >= LEVEL_HEIGHT_TILES || column < 0 || column >= LEVEL_WIDTH_TILES) {
    return null;
  }

  return {
    column,
    row,
    symbol: FOUNDATION_LEVEL_MAP[row][column] as LevelTileSymbol,
  };
}

export function tileToWorld(column: number, row: number): { worldX: number; worldZ: number } {
  return {
    worldX: (column + 0.5) * LEVEL_TILE_SIZE - LEVEL_WORLD_WIDTH / 2,
    worldZ: (row + 0.5) * LEVEL_TILE_SIZE - LEVEL_WORLD_DEPTH / 2,
  };
}

export function isSolidSymbol(symbol: LevelTileSymbol): boolean {
  return symbol === '#' || symbol === 'C';
}

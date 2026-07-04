import * as THREE from 'three';
import foundationLevelData from './foundationLevelMap.json';

export const FOUNDATION_LEVEL_ID = foundationLevelData.id;
export const LEVEL_TILE_SIZE = foundationLevelData.tileSize;
export const LEVEL_WIDTH_TILES = foundationLevelData.dimensions.width;
export const LEVEL_HEIGHT_TILES = foundationLevelData.dimensions.height;
export const MIN_FOUNDATION_PASSAGE_UNITS = foundationLevelData.minPassageUnits;
export const LEVEL_CHUNK_SIZE_TILES = foundationLevelData.streaming.chunkSizeTiles;
export const LEVEL_CHUNK_LOAD_RADIUS = foundationLevelData.streaming.loadRadiusChunks;
export const LEVEL_WORLD_WIDTH = LEVEL_WIDTH_TILES * LEVEL_TILE_SIZE;
export const LEVEL_WORLD_DEPTH = LEVEL_HEIGHT_TILES * LEVEL_TILE_SIZE;

export const FOUNDATION_LEVEL_MAP: readonly string[] = foundationLevelData.map;

export type LevelTileSymbol = '#' | '.' | 'S' | 'E' | 'C';

export interface LevelTile {
  column: number;
  row: number;
  symbol: LevelTileSymbol;
  solid: boolean;
  worldX: number;
  worldZ: number;
}

export interface LevelRaycastHit {
  distance: number;
  point: [number, number];
  tile: {
    column: number;
    row: number;
    symbol: LevelTileSymbol;
  } | null;
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

export function raycastLevel(
  originX: number,
  originZ: number,
  directionX: number,
  directionZ: number,
  maxDistance: number,
): LevelRaycastHit | null {
  const directionLength = Math.hypot(directionX, directionZ);
  if (directionLength <= 0.0001 || maxDistance <= 0) {
    return null;
  }

  const normalizedX = directionX / directionLength;
  const normalizedZ = directionZ / directionLength;
  const startTile = worldToTile(originX, originZ);
  if (!startTile) {
    return {
      distance: 0,
      point: [originX, originZ],
      tile: null,
    };
  }

  if (isSolidSymbol(startTile.symbol)) {
    return {
      distance: 0,
      point: [originX, originZ],
      tile: startTile,
    };
  }

  let column = startTile.column;
  let row = startTile.row;
  const stepColumn = normalizedX > 0 ? 1 : -1;
  const stepRow = normalizedZ > 0 ? 1 : -1;
  const levelMinX = -LEVEL_WORLD_WIDTH / 2;
  const levelMinZ = -LEVEL_WORLD_DEPTH / 2;
  const nextBoundaryX = levelMinX + (normalizedX > 0 ? column + 1 : column) * LEVEL_TILE_SIZE;
  const nextBoundaryZ = levelMinZ + (normalizedZ > 0 ? row + 1 : row) * LEVEL_TILE_SIZE;
  let nextTileBoundaryDistanceX =
    Math.abs(normalizedX) <= 0.0001 ? Number.POSITIVE_INFINITY : (nextBoundaryX - originX) / normalizedX;
  let nextTileBoundaryDistanceZ =
    Math.abs(normalizedZ) <= 0.0001 ? Number.POSITIVE_INFINITY : (nextBoundaryZ - originZ) / normalizedZ;
  const tileDistanceX =
    Math.abs(normalizedX) <= 0.0001 ? Number.POSITIVE_INFINITY : LEVEL_TILE_SIZE / Math.abs(normalizedX);
  const tileDistanceZ =
    Math.abs(normalizedZ) <= 0.0001 ? Number.POSITIVE_INFINITY : LEVEL_TILE_SIZE / Math.abs(normalizedZ);

  while (true) {
    const nextDistance = Math.min(nextTileBoundaryDistanceX, nextTileBoundaryDistanceZ);
    if (nextDistance > maxDistance) {
      return null;
    }

    if (nextTileBoundaryDistanceX < nextTileBoundaryDistanceZ) {
      column += stepColumn;
      nextTileBoundaryDistanceX += tileDistanceX;
    } else {
      row += stepRow;
      nextTileBoundaryDistanceZ += tileDistanceZ;
    }

    const pointX = originX + normalizedX * nextDistance;
    const pointZ = originZ + normalizedZ * nextDistance;
    const tile =
      row < 0 || row >= LEVEL_HEIGHT_TILES || column < 0 || column >= LEVEL_WIDTH_TILES
        ? null
        : {
            column,
            row,
            symbol: FOUNDATION_LEVEL_MAP[row][column] as LevelTileSymbol,
          };

    if (!tile || isSolidSymbol(tile.symbol)) {
      return {
        distance: nextDistance,
        point: [pointX, pointZ],
        tile,
      };
    }
  }
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

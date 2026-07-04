import * as THREE from 'three';
import foundationLevelData from './foundationLevelMap.json';

export const FOUNDATION_LEVEL_ID = foundationLevelData.id;
export const LEVEL_TILE_SIZE = foundationLevelData.tileSize;
export const LEVEL_WIDTH_TILES = foundationLevelData.dimensions.width;
export const LEVEL_HEIGHT_TILES = foundationLevelData.dimensions.height;
export const MIN_FOUNDATION_PASSAGE_UNITS = foundationLevelData.minPassageUnits;
export const MIN_FOUNDATION_ENTRY_UNITS = foundationLevelData.minEntryUnits;
export const MIN_FOUNDATION_ENTRY_SPLIT_SIDE_UNITS = foundationLevelData.minEntrySplitSideUnits;
export const MIN_FOUNDATION_ENTRY_SPLIT_AREA_UNITS = foundationLevelData.minEntrySplitAreaUnits;
export const LEVEL_CHUNK_SIZE_TILES = foundationLevelData.streaming.chunkSizeTiles;
export const LEVEL_CHUNK_LOAD_RADIUS = foundationLevelData.streaming.loadRadiusChunks;
export const LEVEL_WORLD_WIDTH = LEVEL_WIDTH_TILES * LEVEL_TILE_SIZE;
export const LEVEL_WORLD_DEPTH = LEVEL_HEIGHT_TILES * LEVEL_TILE_SIZE;
const LEVEL_MIN_X = -LEVEL_WORLD_WIDTH / 2;
const LEVEL_MAX_X = LEVEL_WORLD_WIDTH / 2;
const LEVEL_MIN_Z = -LEVEL_WORLD_DEPTH / 2;
const LEVEL_MAX_Z = LEVEL_WORLD_DEPTH / 2;
const COLLISION_EPSILON = 0.0001;
const DEFAULT_COLLISION_RESOLUTION_ITERATIONS = 5;

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

export interface LevelCollisionResolution {
  x: number;
  z: number;
  collided: boolean;
  iterations: number;
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
  return isOutsideLevelFootprint(worldX, worldZ, radius) || getLevelCollisionCorrection(worldX, worldZ, radius) !== null;
}

export function resolveLevelCollision(
  worldX: number,
  worldZ: number,
  radius: number,
  maxIterations = DEFAULT_COLLISION_RESOLUTION_ITERATIONS,
): LevelCollisionResolution {
  let x = worldX;
  let z = worldZ;
  let collided = false;
  let iterations = 0;

  for (let index = 0; index < maxIterations; index++) {
    const correction = getLevelCollisionCorrection(x, z, radius);
    if (!correction) {
      break;
    }

    x += correction.x;
    z += correction.z;
    collided = true;
    iterations = index + 1;
  }

  const clampedX = clamp(x, LEVEL_MIN_X + LEVEL_TILE_SIZE + radius, LEVEL_MAX_X - LEVEL_TILE_SIZE - radius);
  const clampedZ = clamp(z, LEVEL_MIN_Z + LEVEL_TILE_SIZE + radius, LEVEL_MAX_Z - LEVEL_TILE_SIZE - radius);
  if (clampedX !== x || clampedZ !== z) {
    x = clampedX;
    z = clampedZ;
    collided = true;
  }

  return {
    x,
    z,
    collided,
    iterations,
  };
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
  const nextBoundaryX = LEVEL_MIN_X + (normalizedX > 0 ? column + 1 : column) * LEVEL_TILE_SIZE;
  const nextBoundaryZ = LEVEL_MIN_Z + (normalizedZ > 0 ? row + 1 : row) * LEVEL_TILE_SIZE;
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
  const column = Math.floor((worldX - LEVEL_MIN_X) / LEVEL_TILE_SIZE);
  const row = Math.floor((worldZ - LEVEL_MIN_Z) / LEVEL_TILE_SIZE);

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
    worldX: LEVEL_MIN_X + (column + 0.5) * LEVEL_TILE_SIZE,
    worldZ: LEVEL_MIN_Z + (row + 0.5) * LEVEL_TILE_SIZE,
  };
}

export function isSolidSymbol(symbol: LevelTileSymbol): boolean {
  return symbol === '#' || symbol === 'C';
}

function getLevelCollisionCorrection(
  worldX: number,
  worldZ: number,
  radius: number,
): { x: number; z: number; depth: number } | null {
  if (radius <= 0) {
    return null;
  }

  let deepestCorrection: { x: number; z: number; depth: number } | null = null;
  const minColumn = Math.max(0, Math.floor((worldX - radius - LEVEL_MIN_X) / LEVEL_TILE_SIZE));
  const maxColumn = Math.min(LEVEL_WIDTH_TILES - 1, Math.floor((worldX + radius - LEVEL_MIN_X) / LEVEL_TILE_SIZE));
  const minRow = Math.max(0, Math.floor((worldZ - radius - LEVEL_MIN_Z) / LEVEL_TILE_SIZE));
  const maxRow = Math.min(LEVEL_HEIGHT_TILES - 1, Math.floor((worldZ + radius - LEVEL_MIN_Z) / LEVEL_TILE_SIZE));

  for (let row = minRow; row <= maxRow; row++) {
    for (let column = minColumn; column <= maxColumn; column++) {
      if (!isSolidSymbol(FOUNDATION_LEVEL_MAP[row][column] as LevelTileSymbol)) {
        continue;
      }

      const correction = getCircleTileCorrection(worldX, worldZ, radius, column, row);
      if (correction && (!deepestCorrection || correction.depth > deepestCorrection.depth)) {
        deepestCorrection = correction;
      }
    }
  }

  return deepestCorrection;
}

function getCircleTileCorrection(
  worldX: number,
  worldZ: number,
  radius: number,
  column: number,
  row: number,
): { x: number; z: number; depth: number } | null {
  const tileMinX = LEVEL_MIN_X + column * LEVEL_TILE_SIZE;
  const tileMaxX = tileMinX + LEVEL_TILE_SIZE;
  const tileMinZ = LEVEL_MIN_Z + row * LEVEL_TILE_SIZE;
  const tileMaxZ = tileMinZ + LEVEL_TILE_SIZE;

  if (worldX > tileMinX && worldX < tileMaxX && worldZ > tileMinZ && worldZ < tileMaxZ) {
    return getInsideSolidTileCorrection(worldX, worldZ, radius, column, row, tileMinX, tileMaxX, tileMinZ, tileMaxZ);
  }

  const closestX = clamp(worldX, tileMinX, tileMaxX);
  const closestZ = clamp(worldZ, tileMinZ, tileMaxZ);
  const deltaX = worldX - closestX;
  const deltaZ = worldZ - closestZ;
  const distanceSquared = deltaX * deltaX + deltaZ * deltaZ;
  const radiusSquared = radius * radius;

  if (distanceSquared >= radiusSquared) {
    return null;
  }

  if (distanceSquared <= COLLISION_EPSILON) {
    const edgeNormal = getEdgeNormal(worldX, worldZ, tileMinX, tileMaxX, tileMinZ, tileMaxZ);
    return {
      x: edgeNormal.x * (radius + COLLISION_EPSILON),
      z: edgeNormal.z * (radius + COLLISION_EPSILON),
      depth: radius,
    };
  }

  const distance = Math.sqrt(distanceSquared);
  const depth = radius - distance + COLLISION_EPSILON;
  return {
    x: (deltaX / distance) * depth,
    z: (deltaZ / distance) * depth,
    depth,
  };
}

function getInsideSolidTileCorrection(
  worldX: number,
  worldZ: number,
  radius: number,
  column: number,
  row: number,
  tileMinX: number,
  tileMaxX: number,
  tileMinZ: number,
  tileMaxZ: number,
): { x: number; z: number; depth: number } {
  const candidates: Array<{ x: number; z: number; depth: number }> = [];

  if (isOpenTile(row, column - 1)) {
    const x = tileMinX - radius - worldX - COLLISION_EPSILON;
    candidates.push({ x, z: 0, depth: Math.abs(x) });
  }
  if (isOpenTile(row, column + 1)) {
    const x = tileMaxX + radius - worldX + COLLISION_EPSILON;
    candidates.push({ x, z: 0, depth: Math.abs(x) });
  }
  if (isOpenTile(row - 1, column)) {
    const z = tileMinZ - radius - worldZ - COLLISION_EPSILON;
    candidates.push({ x: 0, z, depth: Math.abs(z) });
  }
  if (isOpenTile(row + 1, column)) {
    const z = tileMaxZ + radius - worldZ + COLLISION_EPSILON;
    candidates.push({ x: 0, z, depth: Math.abs(z) });
  }

  if (candidates.length > 0) {
    return candidates.reduce((best, candidate) => (candidate.depth < best.depth ? candidate : best));
  }

  return getNearestTileEdgeCorrection(worldX, worldZ, radius, tileMinX, tileMaxX, tileMinZ, tileMaxZ);
}

function getNearestTileEdgeCorrection(
  worldX: number,
  worldZ: number,
  radius: number,
  tileMinX: number,
  tileMaxX: number,
  tileMinZ: number,
  tileMaxZ: number,
): { x: number; z: number; depth: number } {
  const corrections = [
    { x: tileMinX - radius - worldX - COLLISION_EPSILON, z: 0 },
    { x: tileMaxX + radius - worldX + COLLISION_EPSILON, z: 0 },
    { x: 0, z: tileMinZ - radius - worldZ - COLLISION_EPSILON },
    { x: 0, z: tileMaxZ + radius - worldZ + COLLISION_EPSILON },
  ];

  return corrections
    .map((correction) => ({
      ...correction,
      depth: Math.hypot(correction.x, correction.z),
    }))
    .reduce((best, correction) => (correction.depth < best.depth ? correction : best));
}

function getEdgeNormal(
  worldX: number,
  worldZ: number,
  tileMinX: number,
  tileMaxX: number,
  tileMinZ: number,
  tileMaxZ: number,
): { x: number; z: number } {
  let normalX = 0;
  let normalZ = 0;

  if (worldX <= tileMinX) {
    normalX = -1;
  } else if (worldX >= tileMaxX) {
    normalX = 1;
  }

  if (worldZ <= tileMinZ) {
    normalZ = -1;
  } else if (worldZ >= tileMaxZ) {
    normalZ = 1;
  }

  const length = Math.hypot(normalX, normalZ);
  if (length > 0) {
    return {
      x: normalX / length,
      z: normalZ / length,
    };
  }

  return getEdgeNormalFromTileCenter(worldX, worldZ, tileMinX, tileMaxX, tileMinZ, tileMaxZ);
}

function getEdgeNormalFromTileCenter(
  worldX: number,
  worldZ: number,
  tileMinX: number,
  tileMaxX: number,
  tileMinZ: number,
  tileMaxZ: number,
): { x: number; z: number } {
  const centerX = (tileMinX + tileMaxX) / 2;
  const centerZ = (tileMinZ + tileMaxZ) / 2;
  const deltaX = worldX - centerX;
  const deltaZ = worldZ - centerZ;
  const length = Math.hypot(deltaX, deltaZ);

  if (length > 0) {
    return {
      x: deltaX / length,
      z: deltaZ / length,
    };
  }

  return { x: 1, z: 0 };
}

function isOpenTile(row: number, column: number): boolean {
  return (
    row >= 0 &&
    row < LEVEL_HEIGHT_TILES &&
    column >= 0 &&
    column < LEVEL_WIDTH_TILES &&
    !isSolidSymbol(FOUNDATION_LEVEL_MAP[row][column] as LevelTileSymbol)
  );
}

function isOutsideLevelFootprint(worldX: number, worldZ: number, radius: number): boolean {
  return (
    worldX - radius < LEVEL_MIN_X ||
    worldX + radius > LEVEL_MAX_X ||
    worldZ - radius < LEVEL_MIN_Z ||
    worldZ + radius > LEVEL_MAX_Z
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

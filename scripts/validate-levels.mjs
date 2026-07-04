#!/usr/bin/env node
/* global console, process */

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ALLOWED_SYMBOLS = new Set(['#', '.', 'S', 'E', 'C']);
const SOLID_SYMBOLS = new Set(['#', 'C']);

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const defaultLevelPath = path.join(repoRoot, 'src', 'game', 'foundationLevelMap.json');
const levelPath = process.argv[2] ? path.resolve(process.argv[2]) : defaultLevelPath;

const level = JSON.parse(await readFile(levelPath, 'utf8'));
const result = validateLevel(level);

if (result.errors.length > 0) {
  console.error(`Level QA failed for ${levelPath}`);
  for (const error of result.errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    [
      `Level QA passed for ${level.id}`,
      `${result.width}x${result.height}`,
      `min lane ${level.minPassageUnits}u`,
      `${result.chunkColumns}x${result.chunkRows} chunks`,
      `${result.walkableTiles} walkable tiles`,
      'spawn can reach exit',
    ].join(' | '),
  );
}

function validateLevel(levelData) {
  const errors = [];
  const map = Array.isArray(levelData.map) ? levelData.map : [];
  const width = Number(levelData.dimensions?.width);
  const height = Number(levelData.dimensions?.height);
  const tileSize = Number(levelData.tileSize);
  const minPassageUnits = Number(levelData.minPassageUnits);
  const chunkSizeTiles = Number(levelData.streaming?.chunkSizeTiles);
  const minimumOpenTiles = Math.ceil(minPassageUnits / tileSize);

  if (!levelData.id || typeof levelData.id !== 'string') {
    errors.push('Level is missing a string id.');
  }

  if (!Number.isInteger(width) || width <= 0 || !Number.isInteger(height) || height <= 0) {
    errors.push('Level dimensions must be positive integers.');
  }

  if (!Number.isFinite(tileSize) || tileSize <= 0) {
    errors.push('tileSize must be a positive number.');
  }

  if (!Number.isFinite(minPassageUnits) || minPassageUnits <= 0) {
    errors.push('minPassageUnits must be a positive number.');
  }

  if (!Number.isInteger(chunkSizeTiles) || chunkSizeTiles <= 0) {
    errors.push('streaming.chunkSizeTiles must be a positive integer.');
  }

  if (map.length !== height) {
    errors.push(`Map height ${map.length} does not match declared height ${height}.`);
  }

  let spawnCount = 0;
  let exitCount = 0;
  let walkableTiles = 0;
  const narrowTiles = [];

  for (let row = 0; row < map.length; row++) {
    const line = map[row];
    if (typeof line !== 'string') {
      errors.push(`Row ${row} is not a string.`);
      continue;
    }

    if (line.length !== width) {
      errors.push(`Row ${row} has width ${line.length}; expected ${width}.`);
    }

    for (let column = 0; column < line.length; column++) {
      const symbol = line[column];
      if (!ALLOWED_SYMBOLS.has(symbol)) {
        errors.push(`Row ${row}, column ${column} uses unsupported symbol "${symbol}".`);
        continue;
      }

      if (symbol === 'S') {
        spawnCount++;
      } else if (symbol === 'E') {
        exitCount++;
      }

      if (!SOLID_SYMBOLS.has(symbol)) {
        walkableTiles++;
        const horizontalRun = countOpenRun(map, row, column, 0, -1) + 1 + countOpenRun(map, row, column, 0, 1);
        const verticalRun = countOpenRun(map, row, column, -1, 0) + 1 + countOpenRun(map, row, column, 1, 0);
        if (horizontalRun < minimumOpenTiles || verticalRun < minimumOpenTiles) {
          narrowTiles.push({ row, column, symbol, horizontalRun, verticalRun });
        }
      }
    }
  }

  if (spawnCount !== 1) {
    errors.push(`Expected exactly one spawn tile; found ${spawnCount}.`);
  }

  if (exitCount !== 1) {
    errors.push(`Expected exactly one exit tile; found ${exitCount}.`);
  }

  errors.push(...validateBoundary(map, width, height));

  if (narrowTiles.length > 0) {
    const preview = narrowTiles
      .slice(0, 12)
      .map((tile) => `(${tile.row},${tile.column}) h${tile.horizontalRun}/v${tile.verticalRun}`)
      .join(', ');
    errors.push(
      `Found ${narrowTiles.length} walkable tile(s) below ${minimumOpenTiles} open tiles in either axis: ${preview}`,
    );
  }

  if (spawnCount === 1 && exitCount === 1 && !spawnCanReachExit(map)) {
    errors.push('Spawn cannot reach exit through walkable tiles.');
  }

  return {
    errors,
    width,
    height,
    walkableTiles,
    chunkColumns: Number.isInteger(chunkSizeTiles) ? Math.ceil(width / chunkSizeTiles) : 0,
    chunkRows: Number.isInteger(chunkSizeTiles) ? Math.ceil(height / chunkSizeTiles) : 0,
  };
}

function validateBoundary(map, width, height) {
  const errors = [];
  if (map.length !== height || !Number.isInteger(width) || !Number.isInteger(height)) {
    return errors;
  }

  for (let column = 0; column < width; column++) {
    if (map[0]?.[column] !== '#') {
      errors.push(`Top boundary column ${column} must be "#".`);
    }
    if (map[height - 1]?.[column] !== '#') {
      errors.push(`Bottom boundary column ${column} must be "#".`);
    }
  }

  for (let row = 0; row < height; row++) {
    if (map[row]?.[0] !== '#') {
      errors.push(`Left boundary row ${row} must be "#".`);
    }
    if (map[row]?.[width - 1] !== '#') {
      errors.push(`Right boundary row ${row} must be "#".`);
    }
  }

  return errors;
}

function countOpenRun(map, row, column, rowStep, columnStep) {
  let openTiles = 0;
  let nextRow = row + rowStep;
  let nextColumn = column + columnStep;

  while (
    nextRow >= 0 &&
    nextRow < map.length &&
    nextColumn >= 0 &&
    nextColumn < map[nextRow].length &&
    !SOLID_SYMBOLS.has(map[nextRow][nextColumn])
  ) {
    openTiles++;
    nextRow += rowStep;
    nextColumn += columnStep;
  }

  return openTiles;
}

function spawnCanReachExit(map) {
  const spawn = findSymbol(map, 'S');
  const exit = findSymbol(map, 'E');
  if (!spawn || !exit) {
    return false;
  }

  const queue = [spawn];
  const visited = new Set([toKey(spawn.row, spawn.column)]);

  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
    if (current.row === exit.row && current.column === exit.column) {
      return true;
    }

    for (const [rowStep, columnStep] of [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ]) {
      const next = {
        row: current.row + rowStep,
        column: current.column + columnStep,
      };
      const key = toKey(next.row, next.column);
      if (
        next.row < 0 ||
        next.row >= map.length ||
        next.column < 0 ||
        next.column >= map[next.row].length ||
        visited.has(key) ||
        SOLID_SYMBOLS.has(map[next.row][next.column])
      ) {
        continue;
      }

      visited.add(key);
      queue.push(next);
    }
  }

  return false;
}

function findSymbol(map, symbol) {
  for (let row = 0; row < map.length; row++) {
    const column = map[row].indexOf(symbol);
    if (column !== -1) {
      return { row, column };
    }
  }

  return null;
}

function toKey(row, column) {
  return `${row}:${column}`;
}

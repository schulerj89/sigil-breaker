#!/usr/bin/env node
/* global console, process */

import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ALLOWED_SYMBOLS = new Set(['#', '.', 'S', 'E', 'B', 'C', 'X']);
const SOLID_SYMBOLS = new Set(['#', 'C']);
const STRUCTURAL_WALL_SYMBOL = '#';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '..');
const gameDir = path.join(repoRoot, 'src', 'game');
const levelPaths = process.argv.length > 2
  ? process.argv.slice(2).map((levelPath) => path.resolve(levelPath))
  : await findDefaultLevelPaths();

let hasFailure = false;
for (const levelPath of levelPaths) {
  const level = JSON.parse(await readFile(levelPath, 'utf8'));
  const result = validateLevel(level);

  if (result.errors.length > 0) {
    hasFailure = true;
    console.error(`Level QA failed for ${levelPath}`);
    for (const error of result.errors) {
      console.error(`- ${error}`);
    }
  } else {
    console.log(
      [
        `Level QA passed for ${level.id}`,
        `${result.width}x${result.height}`,
        `min lane ${level.minPassageUnits}u`,
        `min entry ${level.minEntryUnits ?? level.minPassageUnits}u`,
        `${result.chunkColumns}x${result.chunkRows} chunks`,
        `${result.walkableTiles} walkable tiles`,
        `${result.enemyMarkerCount} enemy markers`,
        `${result.bossMarkerCount} boss markers`,
        'spawn can reach exit',
        'all walkable tiles reachable',
      ].join(' | '),
    );
  }
}

if (hasFailure) {
  process.exitCode = 1;
}

async function findDefaultLevelPaths() {
  const entries = await readdir(gameDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('LevelMap.json'))
    .map((entry) => path.join(gameDir, entry.name))
    .sort();
}

function validateLevel(levelData) {
  const errors = [];
  const map = Array.isArray(levelData.map) ? levelData.map : [];
  const width = Number(levelData.dimensions?.width);
  const height = Number(levelData.dimensions?.height);
  const tileSize = Number(levelData.tileSize);
  const minPassageUnits = Number(levelData.minPassageUnits);
  const minEntryUnits = Number(levelData.minEntryUnits ?? levelData.minPassageUnits);
  const minEntrySplitSideUnits = Number(levelData.minEntrySplitSideUnits ?? levelData.minPassageUnits);
  const minEntrySplitAreaUnits = Number(levelData.minEntrySplitAreaUnits ?? minEntrySplitSideUnits * 2);
  const chunkSizeTiles = Number(levelData.streaming?.chunkSizeTiles);
  const minimumOpenTiles = Math.ceil(minPassageUnits / tileSize);
  const minimumEntryOpenTiles = Math.ceil(minEntryUnits / tileSize);
  const minimumEntrySplitSideTiles = Math.ceil(minEntrySplitSideUnits / tileSize);
  const minimumEntrySplitAreaTiles = Math.ceil(minEntrySplitAreaUnits / tileSize);

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

  if (!Number.isFinite(minEntryUnits) || minEntryUnits <= 0) {
    errors.push('minEntryUnits must be a positive number when provided.');
  }

  if (Number.isFinite(minEntryUnits) && Number.isFinite(minPassageUnits) && minEntryUnits < minPassageUnits) {
    errors.push('minEntryUnits must be greater than or equal to minPassageUnits.');
  }

  if (!Number.isFinite(minEntrySplitSideUnits) || minEntrySplitSideUnits <= 0) {
    errors.push('minEntrySplitSideUnits must be a positive number when provided.');
  }

  if (!Number.isFinite(minEntrySplitAreaUnits) || minEntrySplitAreaUnits <= 0) {
    errors.push('minEntrySplitAreaUnits must be a positive number when provided.');
  }

  if (
    Number.isFinite(minEntrySplitAreaUnits) &&
    Number.isFinite(minEntrySplitSideUnits) &&
    minEntrySplitAreaUnits < minEntrySplitSideUnits * 2
  ) {
    errors.push('minEntrySplitAreaUnits must be at least double minEntrySplitSideUnits.');
  }

  if (!Number.isInteger(chunkSizeTiles) || chunkSizeTiles <= 0) {
    errors.push('streaming.chunkSizeTiles must be a positive integer.');
  }

  if (map.length !== height) {
    errors.push(`Map height ${map.length} does not match declared height ${height}.`);
  }

  let spawnCount = 0;
  let exitCount = 0;
  let enemyMarkerCount = 0;
  let bossMarkerCount = 0;
  let walkableTiles = 0;
  const narrowTiles = [];
  const narrowSegments = [];
  const narrowWallBandEntries = [];
  const narrowWallBandEntrySplitters = [];
  const diagonalCornerCuts = [];
  const cornerPinches = [];
  const unreachableWalkableTiles = [];

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
        enemyMarkerCount++;
      } else if (symbol === 'B') {
        bossMarkerCount++;
      } else if (symbol === 'X') {
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
    errors.push(`Expected exactly one exit tile marked X; found ${exitCount}.`);
  }

  if (enemyMarkerCount <= 0) {
    errors.push('Expected at least one enemy marker tile marked E.');
  }

  if (bossMarkerCount > 0 && levelData.levelType !== 'boss') {
    errors.push('B boss markers are only allowed when levelType is "boss".');
  }

  if (levelData.levelType === 'boss') {
    errors.push(...validateBossConfig(levelData, bossMarkerCount));
  } else if (levelData.boss) {
    errors.push('Non-boss levels must not define a boss configuration.');
  }

  errors.push(...validateBoundary(map, width, height));
  narrowSegments.push(...findNarrowSegments(map, minimumOpenTiles));
  narrowWallBandEntries.push(...findNarrowWallBandEntries(map, minimumEntryOpenTiles, minimumOpenTiles));
  narrowWallBandEntrySplitters.push(
    ...findNarrowWallBandEntrySplitters(
      map,
      minimumEntryOpenTiles,
      minimumOpenTiles,
      minimumEntrySplitSideTiles,
      minimumEntrySplitAreaTiles,
    ),
  );
  diagonalCornerCuts.push(...findDiagonalCornerCuts(map));
  cornerPinches.push(...findCornerPinches(map));

  if (narrowTiles.length > 0) {
    const preview = narrowTiles
      .slice(0, 12)
      .map((tile) => `(${tile.row},${tile.column}) h${tile.horizontalRun}/v${tile.verticalRun}`)
      .join(', ');
    errors.push(
      `Found ${narrowTiles.length} walkable tile(s) below ${minimumOpenTiles} open tiles in either axis: ${preview}`,
    );
  }

  if (narrowSegments.length > 0) {
    const preview = narrowSegments
      .slice(0, 12)
      .map((segment) =>
        segment.axis === 'row'
          ? `row ${segment.row} columns ${segment.start}-${segment.end} len ${segment.length}`
          : `column ${segment.column} rows ${segment.start}-${segment.end} len ${segment.length}`,
      )
      .join(', ');
    errors.push(`Found ${narrowSegments.length} bounded open segment(s) below ${minimumOpenTiles} tiles: ${preview}`);
  }

  if (narrowWallBandEntries.length > 0) {
    const preview = narrowWallBandEntries
      .slice(0, 12)
      .map((entry) =>
        entry.axis === 'row'
          ? `row ${entry.row} columns ${entry.start}-${entry.end} len ${entry.length}`
          : `column ${entry.column} rows ${entry.start}-${entry.end} len ${entry.length}`,
      )
      .join(', ');
    errors.push(
      `Found ${narrowWallBandEntries.length} structural wall-band entr${narrowWallBandEntries.length === 1 ? 'y' : 'ies'} below ${minimumEntryOpenTiles} tiles: ${preview}`,
    );
  }

  if (narrowWallBandEntrySplitters.length > 0) {
    const preview = narrowWallBandEntrySplitters
      .slice(0, 12)
      .map(formatWallBandEntrySplitter)
      .join(', ');
    errors.push(
      `Found ${narrowWallBandEntrySplitters.length} structural entry splitter(s) below side ${minimumEntrySplitSideTiles} / combined ${minimumEntrySplitAreaTiles} open tiles: ${preview}`,
    );
  }

  if (diagonalCornerCuts.length > 0) {
    const preview = diagonalCornerCuts
      .slice(0, 12)
      .map((cut) => `2x2 at row ${cut.row}, column ${cut.column} ${cut.pattern}`)
      .join(', ');
    errors.push(`Found ${diagonalCornerCuts.length} one-tile diagonal corner cut(s): ${preview}`);
  }

  if (cornerPinches.length > 0) {
    const preview = cornerPinches
      .slice(0, 12)
      .map((pinch) => `row ${pinch.row}, column ${pinch.column} ${pinch.pattern}`)
      .join(', ');
    errors.push(`Found ${cornerPinches.length} one-tile corner pinch point(s): ${preview}`);
  }

  if (spawnCount === 1) {
    unreachableWalkableTiles.push(...findUnreachableWalkableTiles(map));
  }
  if (unreachableWalkableTiles.length > 0) {
    const preview = unreachableWalkableTiles
      .slice(0, 12)
      .map((tile) => `(${tile.row},${tile.column}) ${tile.symbol}`)
      .join(', ');
    errors.push(`Found ${unreachableWalkableTiles.length} walkable tile(s) unreachable from spawn: ${preview}`);
  }

  if (spawnCount === 1 && exitCount === 1 && !spawnCanReachExit(map)) {
    errors.push('Spawn cannot reach exit through walkable tiles.');
  }

  return {
    errors,
    width,
    height,
    walkableTiles,
    enemyMarkerCount,
    bossMarkerCount,
    chunkColumns: Number.isInteger(chunkSizeTiles) ? Math.ceil(width / chunkSizeTiles) : 0,
    chunkRows: Number.isInteger(chunkSizeTiles) ? Math.ceil(height / chunkSizeTiles) : 0,
  };
}

function validateBossConfig(levelData, bossMarkerCount) {
  const errors = [];
  const boss = levelData.boss;
  const objective = levelData.objective;
  const reward = levelData.reward;

  if (bossMarkerCount !== 1) {
    errors.push(`Boss levels require exactly one boss marker tile marked B; found ${bossMarkerCount}.`);
  }

  if (!boss || typeof boss !== 'object') {
    errors.push('Boss levels require a boss configuration object.');
    return errors;
  }

  if (!boss.id || typeof boss.id !== 'string') {
    errors.push('Boss configuration requires a string id.');
  }
  if (!boss.label || typeof boss.label !== 'string') {
    errors.push('Boss configuration requires a string label.');
  }
  if (boss.markerSymbol !== 'B') {
    errors.push('Boss configuration markerSymbol must be "B".');
  }
  if (!boss.assetId || typeof boss.assetId !== 'string') {
    errors.push('Boss configuration requires a string assetId.');
  }
  if (!Number.isFinite(Number(boss.maxHealth)) || Number(boss.maxHealth) <= 0) {
    errors.push('Boss configuration maxHealth must be a positive number.');
  }
  if (!Array.isArray(boss.phases) || boss.phases.length < 2) {
    errors.push('Boss configuration requires at least two phases.');
  } else {
    let previousRatio = Number.POSITIVE_INFINITY;
    for (const [index, phase] of boss.phases.entries()) {
      const ratio = Number(phase?.startsAtHealthRatio);
      if (!phase?.id || typeof phase.id !== 'string') {
        errors.push(`Boss phase ${index} requires a string id.`);
      }
      if (!Number.isFinite(ratio) || ratio < 0 || ratio > 1) {
        errors.push(`Boss phase ${phase?.id ?? index} startsAtHealthRatio must be between 0 and 1.`);
      }
      if (ratio > previousRatio) {
        errors.push('Boss phase startsAtHealthRatio values must be in descending order.');
      }
      previousRatio = ratio;
    }
  }

  if (!objective || objective.type !== 'defeat-boss' || objective.bossMarkerSymbol !== 'B') {
    errors.push('Boss levels require objective.type "defeat-boss" and objective.bossMarkerSymbol "B".');
  }

  if (!reward || typeof reward !== 'object') {
    errors.push('Boss levels require a reward configuration object.');
  } else {
    const choiceCount = Number(reward.choiceCount);
    const min = Number(reward.powerupRangePercent?.min);
    const max = Number(reward.powerupRangePercent?.max);
    if (!Number.isInteger(choiceCount) || choiceCount < 2) {
      errors.push('Boss reward choiceCount must be an integer of at least 2.');
    }
    if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max < min) {
      errors.push('Boss reward powerupRangePercent must define a positive min and max >= min.');
    }
    if (!Array.isArray(reward.pool) || reward.pool.length < 10) {
      errors.push('Boss reward pool must include at least 10 powerup ids.');
    }
  }

  return errors;
}

function findUnreachableWalkableTiles(map) {
  const spawn = findSymbol(map, 'S');
  if (!spawn) {
    return [];
  }

  const reachable = collectReachableWalkableTiles(map, spawn);
  const unreachable = [];
  for (let row = 0; row < map.length; row++) {
    for (let column = 0; column < map[row].length; column++) {
      const symbol = map[row][column];
      if (!SOLID_SYMBOLS.has(symbol) && !reachable.has(toKey(row, column))) {
        unreachable.push({ row, column, symbol });
      }
    }
  }

  return unreachable;
}

function findNarrowSegments(map, minimumOpenTiles) {
  const segments = [];
  const height = map.length;
  const width = map[0]?.length ?? 0;

  for (let row = 0; row < height; row++) {
    let start = null;
    for (let column = 0; column <= width; column++) {
      const isOpen = column < width && !SOLID_SYMBOLS.has(map[row][column]);
      if (isOpen && start === null) {
        start = column;
      }
      if ((!isOpen || column === width) && start !== null) {
        const end = column - 1;
        const isBounded = start > 0 && end < width - 1 && SOLID_SYMBOLS.has(map[row][start - 1]) && SOLID_SYMBOLS.has(map[row][end + 1]);
        if (isBounded && end - start + 1 < minimumOpenTiles) {
          segments.push({ axis: 'row', row, start, end, length: end - start + 1 });
        }
        start = null;
      }
    }
  }

  for (let column = 0; column < width; column++) {
    let start = null;
    for (let row = 0; row <= height; row++) {
      const isOpen = row < height && !SOLID_SYMBOLS.has(map[row][column]);
      if (isOpen && start === null) {
        start = row;
      }
      if ((!isOpen || row === height) && start !== null) {
        const end = row - 1;
        const isBounded = start > 0 && end < height - 1 && SOLID_SYMBOLS.has(map[start - 1][column]) && SOLID_SYMBOLS.has(map[end + 1][column]);
        if (isBounded && end - start + 1 < minimumOpenTiles) {
          segments.push({ axis: 'column', column, start, end, length: end - start + 1 });
        }
        start = null;
      }
    }
  }

  return segments;
}

function findNarrowWallBandEntries(map, minimumEntryOpenTiles, minimumWallRunTiles) {
  return findStructuralWallBandEntries(map, minimumWallRunTiles).filter(
    (entry) => entry.length < minimumEntryOpenTiles,
  );
}

function findNarrowWallBandEntrySplitters(
  map,
  minimumEntryOpenTiles,
  minimumWallRunTiles,
  minimumEntrySplitSideTiles,
  minimumEntrySplitAreaTiles,
) {
  const splitters = [];
  const entries = findStructuralWallBandEntries(map, minimumWallRunTiles).filter(
    (entry) => entry.length >= minimumEntryOpenTiles,
  );

  for (const entry of entries) {
    if (entry.axis === 'row') {
      splitters.push(
        ...findRowEntrySplitters(map, entry, minimumEntrySplitSideTiles, minimumEntrySplitAreaTiles),
      );
    } else {
      splitters.push(
        ...findColumnEntrySplitters(map, entry, minimumEntrySplitSideTiles, minimumEntrySplitAreaTiles),
      );
    }
  }

  return splitters;
}

function findStructuralWallBandEntries(map, minimumWallRunTiles) {
  const entries = [];
  const height = map.length;
  const width = map[0]?.length ?? 0;

  for (let row = 0; row < height; row++) {
    let start = null;
    for (let column = 0; column <= width; column++) {
      const isWall = column < width && map[row][column] === STRUCTURAL_WALL_SYMBOL;
      if (!isWall && column < width && start === null) {
        start = column;
      }
      if ((isWall || column === width) && start !== null) {
        const end = column - 1;
        const isBoundedByWalls =
          start > 0 &&
          end < width - 1 &&
          map[row][start - 1] === STRUCTURAL_WALL_SYMBOL &&
          map[row][end + 1] === STRUCTURAL_WALL_SYMBOL;
        const wallRunBefore = countStructuralWallRun(map, row, start - 1, 0, -1);
        const wallRunAfter = countStructuralWallRun(map, row, end + 1, 0, 1);
        if (isBoundedByWalls && wallRunBefore >= minimumWallRunTiles && wallRunAfter >= minimumWallRunTiles) {
          entries.push({ axis: 'row', row, start, end, length: end - start + 1 });
        }
        start = null;
      }
    }
  }

  for (let column = 0; column < width; column++) {
    let start = null;
    for (let row = 0; row <= height; row++) {
      const isWall = row < height && map[row][column] === STRUCTURAL_WALL_SYMBOL;
      if (!isWall && row < height && start === null) {
        start = row;
      }
      if ((isWall || row === height) && start !== null) {
        const end = row - 1;
        const isBoundedByWalls =
          start > 0 &&
          end < height - 1 &&
          map[start - 1][column] === STRUCTURAL_WALL_SYMBOL &&
          map[end + 1][column] === STRUCTURAL_WALL_SYMBOL;
        const wallRunBefore = countStructuralWallRun(map, start - 1, column, -1, 0);
        const wallRunAfter = countStructuralWallRun(map, end + 1, column, 1, 0);
        if (isBoundedByWalls && wallRunBefore >= minimumWallRunTiles && wallRunAfter >= minimumWallRunTiles) {
          entries.push({ axis: 'column', column, start, end, length: end - start + 1 });
        }
        start = null;
      }
    }
  }

  return entries;
}

function findRowEntrySplitters(map, entry, minimumEntrySplitSideTiles, minimumEntrySplitAreaTiles) {
  const splitters = [];

  for (const adjacentRow of [entry.row - 1, entry.row + 1]) {
    if (adjacentRow < 0 || adjacentRow >= map.length) {
      continue;
    }

    const awayRow = adjacentRow < entry.row ? adjacentRow - 1 : adjacentRow + 1;
    for (let column = entry.start + 1; column <= entry.end - 1; column++) {
      if (
        map[adjacentRow][column] !== STRUCTURAL_WALL_SYMBOL ||
        !isOpenTile(map, entry.row, column) ||
        !isStructuralWallAt(map, awayRow, column) ||
        !isOpenTile(map, adjacentRow, column - 1) ||
        !isOpenTile(map, adjacentRow, column + 1)
      ) {
        continue;
      }

      const leftClearance = countOpenInRowSegment(map, adjacentRow, column - 1, -1, entry.start, entry.end);
      const rightClearance = countOpenInRowSegment(map, adjacentRow, column + 1, 1, entry.start, entry.end);
      if (
        leftClearance < minimumEntrySplitSideTiles ||
        rightClearance < minimumEntrySplitSideTiles ||
        leftClearance + rightClearance < minimumEntrySplitAreaTiles
      ) {
        splitters.push({
          axis: 'row',
          row: entry.row,
          start: entry.start,
          end: entry.end,
          adjacentRow,
          splitterColumn: column,
          leftClearance,
          rightClearance,
          combinedClearance: leftClearance + rightClearance,
        });
      }
    }
  }

  return splitters;
}

function findColumnEntrySplitters(map, entry, minimumEntrySplitSideTiles, minimumEntrySplitAreaTiles) {
  const splitters = [];

  for (const adjacentColumn of [entry.column - 1, entry.column + 1]) {
    if (adjacentColumn < 0 || adjacentColumn >= (map[0]?.length ?? 0)) {
      continue;
    }

    const awayColumn = adjacentColumn < entry.column ? adjacentColumn - 1 : adjacentColumn + 1;
    for (let row = entry.start + 1; row <= entry.end - 1; row++) {
      if (
        map[row][adjacentColumn] !== STRUCTURAL_WALL_SYMBOL ||
        !isOpenTile(map, row, entry.column) ||
        !isStructuralWallAt(map, row, awayColumn) ||
        !isOpenTile(map, row - 1, adjacentColumn) ||
        !isOpenTile(map, row + 1, adjacentColumn)
      ) {
        continue;
      }

      const upperClearance = countOpenInColumnSegment(map, adjacentColumn, row - 1, -1, entry.start, entry.end);
      const lowerClearance = countOpenInColumnSegment(map, adjacentColumn, row + 1, 1, entry.start, entry.end);
      if (
        upperClearance < minimumEntrySplitSideTiles ||
        lowerClearance < minimumEntrySplitSideTiles ||
        upperClearance + lowerClearance < minimumEntrySplitAreaTiles
      ) {
        splitters.push({
          axis: 'column',
          column: entry.column,
          start: entry.start,
          end: entry.end,
          adjacentColumn,
          splitterRow: row,
          upperClearance,
          lowerClearance,
          combinedClearance: upperClearance + lowerClearance,
        });
      }
    }
  }

  return splitters;
}

function formatWallBandEntrySplitter(splitter) {
  if (splitter.axis === 'row') {
    return (
      `row ${splitter.row} columns ${splitter.start}-${splitter.end}, ` +
      `adjacent row ${splitter.adjacentRow} splitter column ${splitter.splitterColumn} ` +
      `left/right ${splitter.leftClearance}/${splitter.rightClearance}`
    );
  }

  return (
    `column ${splitter.column} rows ${splitter.start}-${splitter.end}, ` +
    `adjacent column ${splitter.adjacentColumn} splitter row ${splitter.splitterRow} ` +
    `upper/lower ${splitter.upperClearance}/${splitter.lowerClearance}`
  );
}

function countStructuralWallRun(map, row, column, rowStep, columnStep) {
  let count = 0;
  let nextRow = row;
  let nextColumn = column;

  while (
    nextRow >= 0 &&
    nextRow < map.length &&
    nextColumn >= 0 &&
    nextColumn < map[nextRow].length &&
    map[nextRow][nextColumn] === STRUCTURAL_WALL_SYMBOL
  ) {
    count++;
    nextRow += rowStep;
    nextColumn += columnStep;
  }

  return count;
}

function countOpenInRowSegment(map, row, column, columnStep, start, end) {
  let count = 0;
  let nextColumn = column;

  while (nextColumn >= start && nextColumn <= end && isOpenTile(map, row, nextColumn)) {
    count++;
    nextColumn += columnStep;
  }

  return count;
}

function countOpenInColumnSegment(map, column, row, rowStep, start, end) {
  let count = 0;
  let nextRow = row;

  while (nextRow >= start && nextRow <= end && isOpenTile(map, nextRow, column)) {
    count++;
    nextRow += rowStep;
  }

  return count;
}

function isOpenTile(map, row, column) {
  return (
    row >= 0 &&
    row < map.length &&
    column >= 0 &&
    column < map[row].length &&
    !SOLID_SYMBOLS.has(map[row][column])
  );
}

function isStructuralWallAt(map, row, column) {
  return (
    row >= 0 &&
    row < map.length &&
    column >= 0 &&
    column < map[row].length &&
    map[row][column] === STRUCTURAL_WALL_SYMBOL
  );
}

function findDiagonalCornerCuts(map) {
  const cuts = [];
  const height = map.length;
  const width = map[0]?.length ?? 0;

  for (let row = 0; row < height - 1; row++) {
    for (let column = 0; column < width - 1; column++) {
      const topLeftSolid = SOLID_SYMBOLS.has(map[row][column]);
      const topRightSolid = SOLID_SYMBOLS.has(map[row][column + 1]);
      const bottomLeftSolid = SOLID_SYMBOLS.has(map[row + 1][column]);
      const bottomRightSolid = SOLID_SYMBOLS.has(map[row + 1][column + 1]);

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

function findCornerPinches(map) {
  const pinches = [];
  const height = map.length;
  const width = map[0]?.length ?? 0;
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
  ];

  for (let row = 1; row < height - 1; row++) {
    for (let column = 1; column < width - 1; column++) {
      if (SOLID_SYMBOLS.has(map[row][column])) {
        continue;
      }

      for (const pattern of patterns) {
        const [cardinalRow, cardinalColumn] = pattern.cardinal;
        const [diagonalRow, diagonalColumn] = pattern.diagonal;
        const [openARow, openAColumn] = pattern.openA;
        const [openBRow, openBColumn] = pattern.openB;
        if (
          SOLID_SYMBOLS.has(map[row + cardinalRow][column + cardinalColumn]) &&
          SOLID_SYMBOLS.has(map[row + diagonalRow][column + diagonalColumn]) &&
          !SOLID_SYMBOLS.has(map[row + openARow][column + openAColumn]) &&
          !SOLID_SYMBOLS.has(map[row + openBRow][column + openBColumn])
        ) {
          pinches.push({ row, column, pattern: pattern.pattern });
        }
      }
    }
  }

  return pinches;
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
  const exit = findSymbol(map, 'X');
  if (!spawn || !exit) {
    return false;
  }

  return collectReachableWalkableTiles(map, spawn).has(toKey(exit.row, exit.column));
}

function collectReachableWalkableTiles(map, start) {
  const queue = [start];
  const visited = new Set([toKey(start.row, start.column)]);

  for (let index = 0; index < queue.length; index++) {
    const current = queue[index];
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

  return visited;
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

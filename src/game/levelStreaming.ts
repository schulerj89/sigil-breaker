import {
  LEVEL_CHUNK_LOAD_RADIUS,
  LEVEL_CHUNK_SIZE_TILES,
  LEVEL_HEIGHT_TILES,
  LEVEL_WIDTH_TILES,
  type LevelTile,
} from './levelMap';

export interface LevelChunk {
  id: string;
  chunkColumn: number;
  chunkRow: number;
  startColumn: number;
  startRow: number;
  endColumn: number;
  endRow: number;
  tiles: LevelTile[];
  wallTiles: LevelTile[];
  coverTiles: LevelTile[];
  exitTiles: LevelTile[];
}

export interface LevelStreamingSnapshot {
  chunkSizeTiles: number;
  chunkLoadRadius: number;
  chunkColumns: number;
  chunkRows: number;
  totalChunks: number;
  activeChunks: number;
  loadedChunks: number;
  queuedChunks: number;
  loadedWallTiles: number;
  loadedCoverTiles: number;
  loadedExitTiles: number;
  activeChunkIds: string[];
  loadedChunkIds: string[];
  sharedGeometryBytes: number;
  instanceMatrixBytes: number;
  runtimeBytesEstimate: number;
}

export function createLevelChunks(tiles: readonly LevelTile[]): LevelChunk[] {
  const chunkColumns = getLevelChunkColumns();
  const chunkRows = getLevelChunkRows();
  const chunksById = new Map<string, LevelChunk>();

  for (let chunkRow = 0; chunkRow < chunkRows; chunkRow++) {
    for (let chunkColumn = 0; chunkColumn < chunkColumns; chunkColumn++) {
      const id = getLevelChunkId(chunkColumn, chunkRow);
      chunksById.set(id, {
        id,
        chunkColumn,
        chunkRow,
        startColumn: chunkColumn * LEVEL_CHUNK_SIZE_TILES,
        startRow: chunkRow * LEVEL_CHUNK_SIZE_TILES,
        endColumn: Math.min(LEVEL_WIDTH_TILES - 1, (chunkColumn + 1) * LEVEL_CHUNK_SIZE_TILES - 1),
        endRow: Math.min(LEVEL_HEIGHT_TILES - 1, (chunkRow + 1) * LEVEL_CHUNK_SIZE_TILES - 1),
        tiles: [],
        wallTiles: [],
        coverTiles: [],
        exitTiles: [],
      });
    }
  }

  for (const tile of tiles) {
    const chunk = chunksById.get(getTileChunkId(tile.column, tile.row));
    if (!chunk) {
      continue;
    }

    chunk.tiles.push(tile);
    if (tile.symbol === '#') {
      chunk.wallTiles.push(tile);
    } else if (tile.symbol === 'C') {
      chunk.coverTiles.push(tile);
    } else if (tile.symbol === 'E') {
      chunk.exitTiles.push(tile);
    }
  }

  return [...chunksById.values()];
}

export function getActiveChunkIdsForTile(column: number, row: number): string[] {
  const chunkColumns = getLevelChunkColumns();
  const chunkRows = getLevelChunkRows();
  const centerChunkColumn = clamp(Math.floor(column / LEVEL_CHUNK_SIZE_TILES), 0, chunkColumns - 1);
  const centerChunkRow = clamp(Math.floor(row / LEVEL_CHUNK_SIZE_TILES), 0, chunkRows - 1);
  const activeIds: string[] = [];

  for (
    let chunkRow = Math.max(0, centerChunkRow - LEVEL_CHUNK_LOAD_RADIUS);
    chunkRow <= Math.min(chunkRows - 1, centerChunkRow + LEVEL_CHUNK_LOAD_RADIUS);
    chunkRow++
  ) {
    for (
      let chunkColumn = Math.max(0, centerChunkColumn - LEVEL_CHUNK_LOAD_RADIUS);
      chunkColumn <= Math.min(chunkColumns - 1, centerChunkColumn + LEVEL_CHUNK_LOAD_RADIUS);
      chunkColumn++
    ) {
      activeIds.push(getLevelChunkId(chunkColumn, chunkRow));
    }
  }

  return activeIds;
}

export function getTileChunkId(column: number, row: number): string {
  return getLevelChunkId(Math.floor(column / LEVEL_CHUNK_SIZE_TILES), Math.floor(row / LEVEL_CHUNK_SIZE_TILES));
}

export function getLevelChunkColumns(): number {
  return Math.ceil(LEVEL_WIDTH_TILES / LEVEL_CHUNK_SIZE_TILES);
}

export function getLevelChunkRows(): number {
  return Math.ceil(LEVEL_HEIGHT_TILES / LEVEL_CHUNK_SIZE_TILES);
}

export function getLevelChunkId(chunkColumn: number, chunkRow: number): string {
  return `${chunkColumn}:${chunkRow}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

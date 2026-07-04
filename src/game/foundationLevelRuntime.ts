import * as THREE from 'three';
import {
  LEVEL_CHUNK_LOAD_RADIUS,
  LEVEL_CHUNK_SIZE_TILES,
  LEVEL_HEIGHT_TILES,
  LEVEL_TILE_SIZE,
  LEVEL_WIDTH_TILES,
  getLevelTiles,
  worldToTile,
} from './levelMap';
import {
  createLevelChunks,
  getActiveChunkIdsForTile,
  getLevelChunkColumns,
  getLevelChunkRows,
  type LevelChunk,
  type LevelStreamingSnapshot,
} from './levelStreaming';

const MATRIX_BYTES = 16 * Float32Array.BYTES_PER_ELEMENT;
export const FOUNDATION_WALL_HEIGHT_UNITS = 3.2;
export const FOUNDATION_COVER_HEIGHT_UNITS = 1.15;

export interface FoundationLevelRuntime {
  update: (playerPosition: readonly [number, number, number]) => void;
  getSnapshot: () => LevelStreamingSnapshot;
  dispose: () => void;
}

export function createFoundationLevelRuntime(
  scene: THREE.Scene,
  track: <Resource extends { dispose: () => void }>(resource: Resource) => Resource,
): FoundationLevelRuntime {
  const ambient = new THREE.HemisphereLight(0xd8fff0, 0x1b1410, 1.4);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xffefc2, 2.2);
  keyLight.position.set(5, 8, 7);
  scene.add(keyLight);

  const levelWidth = LEVEL_WIDTH_TILES * LEVEL_TILE_SIZE;
  const levelDepth = LEVEL_HEIGHT_TILES * LEVEL_TILE_SIZE;

  const floorGeometry = track(new THREE.PlaneGeometry(levelWidth, levelDepth, 1, 1));
  const floorMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0x1b2621,
      roughness: 0.82,
      metalness: 0.04,
    }),
  );
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const grid = new THREE.GridHelper(levelWidth, LEVEL_WIDTH_TILES, 0x6ee7b7, 0x334155);
  grid.position.y = 0.01;
  track(grid.geometry);
  if (Array.isArray(grid.material)) {
    for (const material of grid.material) {
      track(material);
    }
  } else {
    track(grid.material);
  }
  scene.add(grid);

  const wallGeometry = track(new THREE.BoxGeometry(LEVEL_TILE_SIZE, FOUNDATION_WALL_HEIGHT_UNITS, LEVEL_TILE_SIZE));
  const wallMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0x263c46,
      roughness: 0.74,
    }),
  );
  const coverGeometry = track(new THREE.BoxGeometry(LEVEL_TILE_SIZE, FOUNDATION_COVER_HEIGHT_UNITS, LEVEL_TILE_SIZE));
  const coverMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0x3f5560,
      roughness: 0.66,
    }),
  );
  const exitGeometry = track(new THREE.CylinderGeometry(0.36, 0.36, 0.08, 20));
  const exitMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0x256d5a,
      emissive: 0x0b332a,
      roughness: 0.35,
    }),
  );
  const sharedGeometryBytes =
    estimateGeometryBytes(floorGeometry) +
    estimateGeometryBytes(grid.geometry) +
    estimateGeometryBytes(wallGeometry) +
    estimateGeometryBytes(coverGeometry) +
    estimateGeometryBytes(exitGeometry);

  const chunks = createLevelChunks(getLevelTiles());
  const chunksById = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const loadedChunks = new Map<string, THREE.Group>();
  const activeChunkIds = new Set<string>();

  return {
    update: (playerPosition) => {
      const playerTile = worldToTile(playerPosition[0], playerPosition[2]);
      if (!playerTile) {
        return;
      }

      const nextActiveIds = new Set(getActiveChunkIdsForTile(playerTile.column, playerTile.row));
      for (const [chunkId, group] of loadedChunks) {
        group.visible = nextActiveIds.has(chunkId);
      }

      for (const chunkId of nextActiveIds) {
        let group = loadedChunks.get(chunkId);
        if (!group) {
          const chunk = chunksById.get(chunkId);
          if (!chunk) {
            continue;
          }

          group = createChunkGroup(
            chunk,
            wallGeometry,
            wallMaterial,
            coverGeometry,
            coverMaterial,
            exitGeometry,
            exitMaterial,
          );
          loadedChunks.set(chunkId, group);
          scene.add(group);
        }

        group.visible = true;
      }

      activeChunkIds.clear();
      for (const chunkId of nextActiveIds) {
        activeChunkIds.add(chunkId);
      }
    },
    getSnapshot: () => {
      const loadedChunkList = [...loadedChunks.keys()].sort();
      const activeChunkList = [...activeChunkIds].sort();
      let loadedWallTiles = 0;
      let loadedCoverTiles = 0;
      let loadedExitTiles = 0;

      for (const chunkId of loadedChunkList) {
        const chunk = chunksById.get(chunkId);
        if (!chunk) {
          continue;
        }

        loadedWallTiles += chunk.wallTiles.length;
        loadedCoverTiles += chunk.coverTiles.length;
        loadedExitTiles += chunk.exitTiles.length;
      }

      const instanceMatrixBytes = (loadedWallTiles + loadedCoverTiles + loadedExitTiles) * MATRIX_BYTES;

      return {
        chunkSizeTiles: LEVEL_CHUNK_SIZE_TILES,
        chunkLoadRadius: LEVEL_CHUNK_LOAD_RADIUS,
        chunkColumns: getLevelChunkColumns(),
        chunkRows: getLevelChunkRows(),
        totalChunks: chunks.length,
        activeChunks: activeChunkList.length,
        loadedChunks: loadedChunkList.length,
        queuedChunks: 0,
        loadedWallTiles,
        loadedCoverTiles,
        loadedExitTiles,
        activeChunkIds: activeChunkList,
        loadedChunkIds: loadedChunkList,
        sharedGeometryBytes,
        instanceMatrixBytes,
        runtimeBytesEstimate: sharedGeometryBytes + instanceMatrixBytes,
      };
    },
    dispose: () => {
      for (const group of loadedChunks.values()) {
        group.removeFromParent();
      }
      loadedChunks.clear();
      activeChunkIds.clear();
    },
  };
}

function createChunkGroup(
  chunk: LevelChunk,
  wallGeometry: THREE.BufferGeometry,
  wallMaterial: THREE.Material,
  coverGeometry: THREE.BufferGeometry,
  coverMaterial: THREE.Material,
  exitGeometry: THREE.BufferGeometry,
  exitMaterial: THREE.Material,
): THREE.Group {
  const group = new THREE.Group();
  group.name = `foundation-chunk-${chunk.id}`;

  if (chunk.wallTiles.length > 0) {
    const wallMesh = new THREE.InstancedMesh(wallGeometry, wallMaterial, chunk.wallTiles.length);
    wallMesh.name = `foundation-walls-${chunk.id}`;
    setTileInstances(wallMesh, chunk.wallTiles, FOUNDATION_WALL_HEIGHT_UNITS / 2);
    group.add(wallMesh);
  }

  if (chunk.coverTiles.length > 0) {
    const coverMesh = new THREE.InstancedMesh(coverGeometry, coverMaterial, chunk.coverTiles.length);
    coverMesh.name = `foundation-cover-${chunk.id}`;
    setTileInstances(coverMesh, chunk.coverTiles, FOUNDATION_COVER_HEIGHT_UNITS / 2);
    group.add(coverMesh);
  }

  for (const tile of chunk.exitTiles) {
    const exitMarker = new THREE.Mesh(exitGeometry, exitMaterial);
    exitMarker.name = `foundation-exit-${chunk.id}`;
    exitMarker.position.set(tile.worldX, 0.04, tile.worldZ);
    group.add(exitMarker);
  }

  return group;
}

function setTileInstances(mesh: THREE.InstancedMesh, tiles: LevelChunk['tiles'], y: number): void {
  const matrix = new THREE.Matrix4();
  tiles.forEach((tile, index) => {
    matrix.makeTranslation(tile.worldX, y, tile.worldZ);
    mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

function estimateGeometryBytes(geometry: THREE.BufferGeometry): number {
  let bytes = 0;
  for (const attribute of Object.values(geometry.attributes)) {
    bytes += attribute.array.byteLength;
  }
  if (geometry.index) {
    bytes += geometry.index.array.byteLength;
  }

  return bytes;
}

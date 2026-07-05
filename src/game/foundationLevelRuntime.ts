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
import { publicAssetUrl } from './assetUrls';

const MATRIX_BYTES = 16 * Float32Array.BYTES_PER_ELEMENT;
export const FOUNDATION_WALL_HEIGHT_UNITS = 3.84;
export const FOUNDATION_COVER_HEIGHT_UNITS = 1.15;
export const FOUNDATION_ROOF_HEIGHT_UNITS = 3.92;
export const FOUNDATION_ENVIRONMENT_TEXTURE_SOURCE_BYTES = 764_229;
export const FOUNDATION_ENVIRONMENT_TEXTURE_DECODED_BYTES = 3 * 1024 * 1024 * 4;

interface EnvironmentTextureDefinition {
  id: string;
  path: string;
  repeat: [number, number];
}

const FOUNDATION_ENVIRONMENT_TEXTURES = {
  floor: {
    id: 'environment.foundation.floor-grid-steel',
    path: 'assets/environment/kenney-prototype-textures/textures/floor-grid-steel.png',
    repeat: [6, 6],
  },
  wall: {
    id: 'environment.foundation.wall-panel-steel',
    path: 'assets/environment/kenney-prototype-textures/textures/wall-panel-steel.png',
    repeat: [1, 1],
  },
  roof: {
    id: 'environment.foundation.roof-flat-steel',
    path: 'assets/environment/kenney-prototype-textures/textures/roof-flat-steel.png',
    repeat: [5, 5],
  },
} as const satisfies Record<string, EnvironmentTextureDefinition>;

export interface FoundationLevelRuntime {
  update: (playerPosition: readonly [number, number, number]) => void;
  getSnapshot: () => LevelStreamingSnapshot;
  dispose: () => void;
}

export function createFoundationLevelRuntime(
  scene: THREE.Scene,
  track: <Resource extends { dispose: () => void }>(resource: Resource) => Resource,
): FoundationLevelRuntime {
  const ambient = new THREE.HemisphereLight(0xdce8f2, 0x15191d, 0.82);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xe9f3ff, 1.35);
  keyLight.position.set(5, 8, 7);
  scene.add(keyLight);

  const levelWidth = LEVEL_WIDTH_TILES * LEVEL_TILE_SIZE;
  const levelDepth = LEVEL_HEIGHT_TILES * LEVEL_TILE_SIZE;
  const textureLoader = new THREE.TextureLoader();
  const loadedTextureAssetIds = new Set<string>();
  const assetLoadErrors: string[] = [];
  const floorTexture = loadEnvironmentTexture(
    textureLoader,
    FOUNDATION_ENVIRONMENT_TEXTURES.floor,
    track,
    loadedTextureAssetIds,
    assetLoadErrors,
  );
  const wallTexture = loadEnvironmentTexture(
    textureLoader,
    FOUNDATION_ENVIRONMENT_TEXTURES.wall,
    track,
    loadedTextureAssetIds,
    assetLoadErrors,
  );
  const roofTexture = loadEnvironmentTexture(
    textureLoader,
    FOUNDATION_ENVIRONMENT_TEXTURES.roof,
    track,
    loadedTextureAssetIds,
    assetLoadErrors,
  );

  const floorGeometry = track(new THREE.PlaneGeometry(levelWidth, levelDepth, 1, 1));
  const floorMaterial = track(
    new THREE.MeshBasicMaterial({
      color: 0xa8b6b8,
      map: floorTexture,
    }),
  );
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const roofGeometry = track(new THREE.PlaneGeometry(levelWidth, levelDepth, 1, 1));
  const roofMaterial = track(
    new THREE.MeshBasicMaterial({
      color: 0x8d9ba0,
      map: roofTexture,
      side: THREE.FrontSide,
    }),
  );
  const roof = new THREE.Mesh(roofGeometry, roofMaterial);
  roof.name = 'foundation-roof';
  roof.position.y = FOUNDATION_ROOF_HEIGHT_UNITS;
  roof.rotation.x = Math.PI / 2;
  scene.add(roof);

  const wallGeometry = track(new THREE.BoxGeometry(LEVEL_TILE_SIZE, FOUNDATION_WALL_HEIGHT_UNITS, LEVEL_TILE_SIZE));
  const wallMaterial = track(
    new THREE.MeshBasicMaterial({
      color: 0xb6c5c7,
      map: wallTexture,
    }),
  );
  const coverGeometry = track(new THREE.BoxGeometry(LEVEL_TILE_SIZE, FOUNDATION_COVER_HEIGHT_UNITS, LEVEL_TILE_SIZE));
  const coverMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0x596a70,
      roughness: 0.48,
      metalness: 0.54,
    }),
  );
  const exitGeometry = track(new THREE.CylinderGeometry(0.36, 0.36, 0.08, 20));
  const exitRingGeometry = track(new THREE.TorusGeometry(0.56, 0.035, 10, 36));
  const exitCoreGeometry = track(new THREE.IcosahedronGeometry(0.22, 1));
  const exitMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0x256d5a,
      emissive: 0x0b332a,
      roughness: 0.35,
    }),
  );
  const exitRingMaterial = track(
    new THREE.MeshBasicMaterial({
      color: 0x74ffd4,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const exitCoreMaterial = track(
    new THREE.MeshBasicMaterial({
      color: 0xc9ffe9,
      transparent: true,
      opacity: 0.74,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  const sharedGeometryBytes =
    estimateGeometryBytes(floorGeometry) +
    estimateGeometryBytes(roofGeometry) +
    estimateGeometryBytes(wallGeometry) +
    estimateGeometryBytes(coverGeometry) +
    estimateGeometryBytes(exitGeometry) +
    estimateGeometryBytes(exitRingGeometry) +
    estimateGeometryBytes(exitCoreGeometry);

  const chunks = createLevelChunks(getLevelTiles());
  const chunksById = new Map(chunks.map((chunk) => [chunk.id, chunk]));
  const loadedChunks = new Map<string, THREE.Group>();
  const activeChunkIds = new Set<string>();
  const staticSceneObjects = [ambient, keyLight, floor, roof];

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
            exitRingGeometry,
            exitCoreGeometry,
            exitMaterial,
            exitRingMaterial,
            exitCoreMaterial,
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
        loadedTextureAssetIds: [...loadedTextureAssetIds].sort(),
        assetLoadErrors: [...assetLoadErrors],
        activeChunkIds: activeChunkList,
        loadedChunkIds: loadedChunkList,
        sharedGeometryBytes,
        instanceMatrixBytes,
        runtimeBytesEstimate:
          sharedGeometryBytes +
          instanceMatrixBytes +
          FOUNDATION_ENVIRONMENT_TEXTURE_SOURCE_BYTES +
          FOUNDATION_ENVIRONMENT_TEXTURE_DECODED_BYTES,
      };
    },
    dispose: () => {
      for (const group of loadedChunks.values()) {
        disposeChunkGroup(group);
        group.removeFromParent();
      }
      loadedChunks.clear();
      activeChunkIds.clear();

      for (const object of staticSceneObjects) {
        object.removeFromParent();
      }
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
  exitRingGeometry: THREE.BufferGeometry,
  exitCoreGeometry: THREE.BufferGeometry,
  exitMaterial: THREE.Material,
  exitRingMaterial: THREE.Material,
  exitCoreMaterial: THREE.Material,
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
    const exitMarker = createExitRiftMarker(
      exitGeometry,
      exitRingGeometry,
      exitCoreGeometry,
      exitMaterial,
      exitRingMaterial,
      exitCoreMaterial,
    );
    exitMarker.name = `foundation-exit-${chunk.id}`;
    exitMarker.position.set(tile.worldX, 0, tile.worldZ);
    group.add(exitMarker);
  }

  return group;
}

function createExitRiftMarker(
  exitGeometry: THREE.BufferGeometry,
  exitRingGeometry: THREE.BufferGeometry,
  exitCoreGeometry: THREE.BufferGeometry,
  exitMaterial: THREE.Material,
  exitRingMaterial: THREE.Material,
  exitCoreMaterial: THREE.Material,
): THREE.Group {
  const marker = new THREE.Group();
  const pad = new THREE.Mesh(exitGeometry, exitMaterial);
  pad.name = 'foundation-exit-rift-pad';
  pad.position.y = 0.04;
  marker.add(pad);

  const ringA = new THREE.Mesh(exitRingGeometry, exitRingMaterial);
  ringA.name = 'foundation-exit-rift-ring-a';
  ringA.position.y = 0.92;
  ringA.rotation.y = Math.PI / 7;
  marker.add(ringA);

  const ringB = new THREE.Mesh(exitRingGeometry, exitRingMaterial);
  ringB.name = 'foundation-exit-rift-ring-b';
  ringB.position.y = 0.92;
  ringB.rotation.x = Math.PI / 2;
  ringB.rotation.z = Math.PI / 9;
  marker.add(ringB);

  const core = new THREE.Mesh(exitCoreGeometry, exitCoreMaterial);
  core.name = 'foundation-exit-rift-core';
  core.position.y = 0.92;
  marker.add(core);

  return marker;
}

function setTileInstances(mesh: THREE.InstancedMesh, tiles: LevelChunk['tiles'], y: number): void {
  const matrix = new THREE.Matrix4();
  tiles.forEach((tile, index) => {
    matrix.makeTranslation(tile.worldX, y, tile.worldZ);
    mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

function disposeChunkGroup(group: THREE.Group): void {
  group.traverse((object) => {
    if (object instanceof THREE.InstancedMesh) {
      object.dispose();
    }
  });
}

function loadEnvironmentTexture(
  loader: THREE.TextureLoader,
  definition: EnvironmentTextureDefinition,
  track: <Resource extends { dispose: () => void }>(resource: Resource) => Resource,
  loadedTextureAssetIds: Set<string>,
  assetLoadErrors: string[],
): THREE.Texture {
  const texture = track(
    loader.load(
      publicAssetUrl(definition.path),
      () => {
        loadedTextureAssetIds.add(definition.id);
      },
      undefined,
      (error) => {
        const message = error instanceof Error ? error.message : String(error);
        assetLoadErrors.push(`${definition.id}: ${message}`);
      },
    ),
  );
  texture.name = definition.id;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(...definition.repeat);
  texture.anisotropy = 4;

  return texture;
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

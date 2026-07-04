import type { WebGLRenderer } from 'three';
import { DEBUG_SCENE_ID, PERFORMANCE_BUDGETS, type CameraMode } from './config';
import type { FpsControllerSnapshot } from './fpsControls';
import {
  FOUNDATION_LEVEL_MAP,
  LEVEL_HEIGHT_TILES,
  LEVEL_TILE_SIZE,
  LEVEL_WIDTH_TILES,
} from './levelMap';

export interface DebugSnapshot {
  buildId: string;
  scene: {
    sceneId: string;
    phase: 'gameplay';
    cameraMode: CameraMode;
    playerPosition: [number, number, number];
    yawRadians: number;
    pitchRadians: number;
  };
  level: {
    id: string;
    widthUnits: number;
    depthUnits: number;
    tileSize: number;
    map: readonly string[];
  };
  device: {
    orientation: 'landscape' | 'portrait';
    viewport: {
      width: number;
      height: number;
      deviceScaleFactor: number;
    };
    visibleBrowser: boolean;
  };
  rendererMetrics: {
    fps: number;
    calls: number;
    triangles: number;
    geometries: number;
    textures: number;
  };
  memoryMetrics: {
    jsHeapMb: number | null;
    decodedTextureMbEstimate: number;
    loadedAssetIds: string[];
    activeSceneRoots: number;
  };
  assetLoadErrors: string[];
  controls: {
    orientationLock: 'landscape';
    primaryInput: 'touch';
    touchShellReady: boolean;
    lookActive: boolean;
    movePointerActive: boolean;
    moveVector: [number, number];
    keyboardVector: [number, number];
    buttons: string[];
  };
  budgets: typeof PERFORMANCE_BUDGETS;
}

export interface DebugApi {
  getSnapshot: () => DebugSnapshot;
}

export function createDebugApi(
  renderer: WebGLRenderer,
  getFps: () => number,
  getControllerSnapshot: () => FpsControllerSnapshot,
): DebugApi {
  return {
    getSnapshot: () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const controllerSnapshot = getControllerSnapshot();

      return {
        buildId: __SIGILBREAKER_BUILD_ID__,
        scene: {
          sceneId: DEBUG_SCENE_ID,
          phase: 'gameplay',
          cameraMode: 'gameplay',
          playerPosition: controllerSnapshot.player.position,
          yawRadians: controllerSnapshot.player.yawRadians,
          pitchRadians: controllerSnapshot.player.pitchRadians,
        },
        level: {
          id: 'foundation-20x20',
          widthUnits: LEVEL_WIDTH_TILES * LEVEL_TILE_SIZE,
          depthUnits: LEVEL_HEIGHT_TILES * LEVEL_TILE_SIZE,
          tileSize: LEVEL_TILE_SIZE,
          map: FOUNDATION_LEVEL_MAP,
        },
        device: {
          orientation: viewportWidth >= viewportHeight ? 'landscape' : 'portrait',
          viewport: {
            width: viewportWidth,
            height: viewportHeight,
            deviceScaleFactor: window.devicePixelRatio,
          },
          visibleBrowser: document.visibilityState === 'visible',
        },
        rendererMetrics: {
          fps: roundMetric(getFps()),
          calls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
        },
        memoryMetrics: {
          jsHeapMb: readHeapMb(),
          decodedTextureMbEstimate: 0,
          loadedAssetIds: [],
          activeSceneRoots: 1,
        },
        assetLoadErrors: [],
        controls: {
          orientationLock: 'landscape',
          primaryInput: 'touch',
          touchShellReady: true,
          lookActive: controllerSnapshot.controls.lookActive,
          movePointerActive: controllerSnapshot.controls.movePointerActive,
          moveVector: controllerSnapshot.controls.moveVector,
          keyboardVector: controllerSnapshot.controls.keyboardVector,
          buttons: ['fire', 'reload', 'dash', 'interact', 'weapon-swap', 'pause'],
        },
        budgets: PERFORMANCE_BUDGETS,
      };
    },
  };
}

function readHeapMb(): number | null {
  const performanceWithMemory = performance as Performance & {
    memory?: {
      usedJSHeapSize: number;
    };
  };

  if (!performanceWithMemory.memory) {
    return null;
  }

  return roundMetric(performanceWithMemory.memory.usedJSHeapSize / 1_048_576);
}

function roundMetric(value: number): number {
  return Math.round(value * 10) / 10;
}

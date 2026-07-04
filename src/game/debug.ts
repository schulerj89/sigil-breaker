import type { PerspectiveCamera, WebGLRenderer } from 'three';
import { DEBUG_SCENE_ID, PERFORMANCE_BUDGETS, type CameraMode } from './config';

export interface DebugSnapshot {
  buildId: string;
  scene: {
    sceneId: string;
    phase: 'bootstrap';
    cameraMode: CameraMode;
    playerPosition: [number, number, number];
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
    buttons: string[];
  };
  budgets: typeof PERFORMANCE_BUDGETS;
}

export interface DebugApi {
  getSnapshot: () => DebugSnapshot;
}

export function createDebugApi(
  renderer: WebGLRenderer,
  camera: PerspectiveCamera,
  getFps: () => number,
): DebugApi {
  return {
    getSnapshot: () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      return {
        buildId: __SIGILBREAKER_BUILD_ID__,
        scene: {
          sceneId: DEBUG_SCENE_ID,
          phase: 'bootstrap',
          cameraMode: 'gameplay',
          playerPosition: [
            roundMetric(camera.position.x),
            roundMetric(camera.position.y),
            roundMetric(camera.position.z),
          ],
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


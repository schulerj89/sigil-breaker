import type { WebGLRenderer } from 'three';
import { DEBUG_SCENE_ID, PERFORMANCE_BUDGETS, type CameraMode } from './config';
import type { FpsControllerSnapshot } from './fpsControls';
import {
  FOUNDATION_LEVEL_MAP,
  FOUNDATION_LEVEL_ID,
  LEVEL_HEIGHT_TILES,
  LEVEL_TILE_SIZE,
  LEVEL_WIDTH_TILES,
} from './levelMap';
import type { LevelStreamingSnapshot } from './levelStreaming';
import type { MobileZoomGuardSnapshot } from './mobileZoomGuard';
import type { WeaponSystemSnapshot } from './weapons/weaponSystem';

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
    streaming: LevelStreamingSnapshot;
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
    levelRuntimeBytesEstimate: number;
    chunkInstanceMatrixBytes: number;
    weaponModelBytesLoaded: number;
    loadedAssetIds: string[];
    activeSceneRoots: number;
  };
  assetLoadErrors: string[];
  weapon: WeaponSystemSnapshot;
  controls: {
    orientationLock: 'landscape';
    primaryInput: 'touch';
    touchShellReady: boolean;
    viewportScale: number;
    preventedZoomGestures: number;
    preventedMultiTouchStarts: number;
    preventedMultiTouchMoves: number;
    preventedWheelZooms: number;
    preventedDoubleTaps: number;
    lastPreventedZoomAt: number;
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
  getLevelStreamingSnapshot: () => LevelStreamingSnapshot,
  getWeaponSnapshot: () => WeaponSystemSnapshot,
  getZoomGuardSnapshot: () => MobileZoomGuardSnapshot,
): DebugApi {
  return {
    getSnapshot: () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const controllerSnapshot = getControllerSnapshot();
      const levelStreamingSnapshot = getLevelStreamingSnapshot();
      const weaponSnapshot = getWeaponSnapshot();
      const zoomGuardSnapshot = getZoomGuardSnapshot();

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
          id: FOUNDATION_LEVEL_ID,
          widthUnits: LEVEL_WIDTH_TILES * LEVEL_TILE_SIZE,
          depthUnits: LEVEL_HEIGHT_TILES * LEVEL_TILE_SIZE,
          tileSize: LEVEL_TILE_SIZE,
          map: FOUNDATION_LEVEL_MAP,
          streaming: levelStreamingSnapshot,
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
          levelRuntimeBytesEstimate: levelStreamingSnapshot.runtimeBytesEstimate,
          chunkInstanceMatrixBytes: levelStreamingSnapshot.instanceMatrixBytes,
          weaponModelBytesLoaded: weaponSnapshot.modelBytesLoaded,
          loadedAssetIds: weaponSnapshot.loadedAssetIds,
          activeSceneRoots: 1 + levelStreamingSnapshot.activeChunks,
        },
        assetLoadErrors: weaponSnapshot.assetLoadErrors,
        weapon: weaponSnapshot,
        controls: {
          orientationLock: 'landscape',
          primaryInput: 'touch',
          touchShellReady: true,
          viewportScale: zoomGuardSnapshot.viewportScale,
          preventedZoomGestures: zoomGuardSnapshot.preventedZoomGestures,
          preventedMultiTouchStarts: zoomGuardSnapshot.preventedMultiTouchStarts,
          preventedMultiTouchMoves: zoomGuardSnapshot.preventedMultiTouchMoves,
          preventedWheelZooms: zoomGuardSnapshot.preventedWheelZooms,
          preventedDoubleTaps: zoomGuardSnapshot.preventedDoubleTaps,
          lastPreventedZoomAt: zoomGuardSnapshot.lastPreventedZoomAt,
          lookActive: controllerSnapshot.controls.lookActive,
          movePointerActive: controllerSnapshot.controls.movePointerActive,
          moveVector: controllerSnapshot.controls.moveVector,
          keyboardVector: controllerSnapshot.controls.keyboardVector,
          buttons: ['hold-fire-aim', 'weapon-cycle', 'weapon-select'],
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

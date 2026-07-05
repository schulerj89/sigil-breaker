import type { WebGLRenderer } from 'three';
import { DEBUG_SCENE_ID, PERFORMANCE_BUDGETS, type CameraMode, type GamePhase } from './config';
import { FOUNDATION_ENVIRONMENT_TEXTURE_DECODED_BYTES } from './foundationLevelRuntime';
import type { FpsControllerSnapshot } from './fpsControls';
import type { EnemySystemSnapshot } from './enemies/enemySystem';
import type { HealthSnapshot } from './health';
import type { DeathCinematicStageSnapshot } from './deathCinematicStage';
import {
  FOUNDATION_LEVEL_MAP,
  FOUNDATION_LEVEL_ID,
  LEVEL_HEIGHT_TILES,
  LEVEL_TILE_SIZE,
  LEVEL_WIDTH_TILES,
} from './levelMap';
import type { LevelStreamingSnapshot } from './levelStreaming';
import type { MobileZoomGuardSnapshot } from './mobileZoomGuard';
import type { TitleHeroStageSnapshot } from './titleHeroStage';
import type { WeaponSystemSnapshot } from './weapons/weaponSystem';

export interface DebugSnapshot {
  buildId: string;
  scene: {
    sceneId: string;
    phase: GamePhase;
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
    enemyModelBytesLoaded: number;
    loadedAssetIds: string[];
    activeSceneRoots: number;
  };
  assetLoadErrors: string[];
  weapon: WeaponSystemSnapshot;
  player: {
    health: HealthSnapshot;
  };
  enemies: EnemySystemSnapshot;
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
  ui: {
    debugVisible: boolean;
    phase: GamePhase;
    loading: UiLoadingSnapshot;
    titleHero: TitleHeroStageSnapshot;
    deathCinematic: DeathCinematicStageSnapshot;
  };
  budgets: typeof PERFORMANCE_BUDGETS;
}

export interface UiLoadingSnapshot {
  ready: boolean;
  loadedAssets: number;
  expectedAssets: number;
  titleBackgroundLoaded: boolean;
  titleBackgroundAssetId: string;
  titleHeroLoaded: boolean;
  titleHeroAssetId: string;
  assetLoadErrors: string[];
}

export interface UiSnapshot {
  debugVisible: boolean;
  phase: GamePhase;
  loading: UiLoadingSnapshot;
  titleHero: TitleHeroStageSnapshot;
  deathCinematic: DeathCinematicStageSnapshot;
}

export interface DebugApi {
  getSnapshot: () => DebugSnapshot;
  setPlayerPose: (pose: { x: number; z: number; yawRadians?: number; pitchRadians?: number }) => boolean;
  damagePlayerForQa: (amount: number) => boolean;
}

export function createDebugApi(
  renderer: WebGLRenderer,
  getFps: () => number,
  getControllerSnapshot: () => FpsControllerSnapshot,
  getLevelStreamingSnapshot: () => LevelStreamingSnapshot,
  getWeaponSnapshot: () => WeaponSystemSnapshot,
  getPlayerHealthSnapshot: () => HealthSnapshot,
  getEnemySnapshot: () => EnemySystemSnapshot,
  getZoomGuardSnapshot: () => MobileZoomGuardSnapshot,
  getUiSnapshot: () => UiSnapshot,
  setPlayerPose: (pose: { x: number; z: number; yawRadians?: number; pitchRadians?: number }) => void,
  damagePlayer: (amount: number) => void,
): DebugApi {
  return {
    setPlayerPose: (pose) => {
      if (!new URLSearchParams(window.location.search).has('qaCapture')) {
        return false;
      }

      setPlayerPose(pose);
      return true;
    },
    damagePlayerForQa: (amount) => {
      if (!new URLSearchParams(window.location.search).has('qaCapture')) {
        return false;
      }

      damagePlayer(amount);
      return true;
    },
    getSnapshot: () => {
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const controllerSnapshot = getControllerSnapshot();
      const levelStreamingSnapshot = getLevelStreamingSnapshot();
      const weaponSnapshot = getWeaponSnapshot();
      const playerHealthSnapshot = getPlayerHealthSnapshot();
      const enemySnapshot = getEnemySnapshot();
      const zoomGuardSnapshot = getZoomGuardSnapshot();
      const uiSnapshot = getUiSnapshot();
      const loadedAssetIds = [
        ...levelStreamingSnapshot.loadedTextureAssetIds,
        ...weaponSnapshot.loadedAssetIds,
        ...enemySnapshot.loadedAssetIds,
      ].sort();
      const assetLoadErrors = [
        ...levelStreamingSnapshot.assetLoadErrors,
        ...weaponSnapshot.assetLoadErrors,
        ...enemySnapshot.assetLoadErrors,
        ...uiSnapshot.titleHero.errors,
        ...uiSnapshot.loading.assetLoadErrors.filter((error) => error.startsWith('ui.')),
      ];

      return {
        buildId: __SIGILBREAKER_BUILD_ID__,
        scene: {
          sceneId: DEBUG_SCENE_ID,
          phase: uiSnapshot.phase,
          cameraMode: getCameraMode(uiSnapshot.phase),
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
          decodedTextureMbEstimate: roundMetric(FOUNDATION_ENVIRONMENT_TEXTURE_DECODED_BYTES / 1_048_576),
          levelRuntimeBytesEstimate: levelStreamingSnapshot.runtimeBytesEstimate,
          chunkInstanceMatrixBytes: levelStreamingSnapshot.instanceMatrixBytes,
          weaponModelBytesLoaded: weaponSnapshot.modelBytesLoaded,
          enemyModelBytesLoaded: enemySnapshot.modelBytesLoaded,
          loadedAssetIds,
          activeSceneRoots: 1 + levelStreamingSnapshot.activeChunks,
        },
        assetLoadErrors,
        weapon: weaponSnapshot,
        player: {
          health: playerHealthSnapshot,
        },
        enemies: enemySnapshot,
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
          buttons: [
            'title-start',
            'hero-lab',
            'voice-lab',
            'hold-fire-aim',
            'weapon-cycle',
            'music-toggle',
            'debug-toggle',
            'debug-death',
            'debug-death-gameplay',
          ],
        },
        ui: uiSnapshot,
        budgets: PERFORMANCE_BUDGETS,
      };
    },
  };
}

function getCameraMode(phase: GamePhase): CameraMode {
  if (phase === 'gameplay') {
    return 'gameplay';
  }

  if (phase === 'death-cinematic') {
    return 'death';
  }

  return 'title';
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

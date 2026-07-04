import * as THREE from 'three';
import { DEBUG_SCENE_ID, GAME_TITLE, PERFORMANCE_BUDGETS } from './config';
import { createDebugApi, type DebugApi } from './debug';
import { createFoundationLevelRuntime } from './foundationLevelRuntime';
import { FpsControls } from './fpsControls';
import { LEVEL_HEIGHT_TILES, LEVEL_WIDTH_TILES } from './levelMap';

export interface SigilbreakerApp {
  dispose: () => void;
  debug: DebugApi;
}

declare global {
  interface Window {
    __SIGILBREAKER_DEBUG__?: DebugApi;
  }
}

export function createGame(root: HTMLElement): SigilbreakerApp {
  root.innerHTML = createShellMarkup();

  const canvas = root.querySelector<HTMLCanvasElement>('.game-canvas');
  if (!canvas) {
    throw new Error('Missing game canvas.');
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: import.meta.env.DEV,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x0d1012, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, PERFORMANCE_BUDGETS.maxDevicePixelRatio));

  const scene = new THREE.Scene();
  scene.name = DEBUG_SCENE_ID;
  scene.background = new THREE.Color(0x0d1012);
  scene.fog = new THREE.Fog(0x0d1012, 12, 30);

  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 180);

  const disposables: Array<{ dispose: () => void }> = [];
  const track = <Resource extends { dispose: () => void }>(resource: Resource): Resource => {
    disposables.push(resource);
    return resource;
  };

  const levelRuntime = createFoundationLevelRuntime(scene, track);
  const controls = new FpsControls(root, camera);
  levelRuntime.update(controls.getSnapshot().player.position);

  let animationFrame = 0;
  let lastTime = performance.now();
  let lastHudUpdate = 0;
  let fps = PERFORMANCE_BUDGETS.targetFps;

  const debug = createDebugApi(renderer, () => fps, () => controls.getSnapshot(), () => levelRuntime.getSnapshot());
  window.__SIGILBREAKER_DEBUG__ = debug;

  const resize = (): void => {
    const width = Math.max(1, root.clientWidth);
    const height = Math.max(1, root.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, PERFORMANCE_BUDGETS.maxDevicePixelRatio));
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const animate = (now: number): void => {
    const deltaSeconds = Math.min(0.1, (now - lastTime) / 1000);
    lastTime = now;
    fps = fps * 0.9 + (1 / Math.max(deltaSeconds, 0.001)) * 0.1;

    controls.update(deltaSeconds);
    levelRuntime.update(controls.getSnapshot().player.position);
    renderer.render(scene, camera);

    if (now - lastHudUpdate >= 250) {
      lastHudUpdate = now;
      updateDebugHud(root, debug);
    }

    animationFrame = window.requestAnimationFrame(animate);
  };

  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(root);
  window.addEventListener('orientationchange', resize);
  animationFrame = window.requestAnimationFrame(animate);

  return {
    debug,
    dispose: () => {
      window.cancelAnimationFrame(animationFrame);
      controls.dispose();
      levelRuntime.dispose();
      resizeObserver.disconnect();
      window.removeEventListener('orientationchange', resize);
      scene.traverse((object) => {
        object.removeFromParent();
      });
      for (const disposable of disposables) {
        disposable.dispose();
      }
      renderer.dispose();
      if (window.__SIGILBREAKER_DEBUG__ === debug) {
        delete window.__SIGILBREAKER_DEBUG__;
      }
      root.replaceChildren();
    },
  };
}

function createShellMarkup(): string {
  return `
    <div class="game-shell">
      <canvas class="game-canvas" aria-label="${GAME_TITLE} prototype render"></canvas>
      <div class="look-zone" aria-hidden="true"></div>
      <div class="hud" aria-hidden="true">
        <div class="hud__left">
          <span class="hud__badge">${LEVEL_WIDTH_TILES} x ${LEVEL_HEIGHT_TILES}</span>
          <span class="hud__badge hud__badge--hp">HP 100</span>
        </div>
        <div class="hud__center">
          <span class="hud__badge hud__badge--metric" data-debug-fps>FPS --</span>
          <span class="hud__badge hud__badge--metric" data-debug-memory>JS --</span>
          <span class="hud__badge hud__badge--metric" data-debug-level-memory>LVL --</span>
          <span class="hud__badge hud__badge--metric" data-debug-chunks>CH --</span>
        </div>
        <div class="hud__right">
          <span class="hud__badge hud__badge--ammo">30 / 90</span>
          <span class="hud__badge hud__badge--build">${__SIGILBREAKER_BUILD_ID__}</span>
        </div>
      </div>
      <div class="crosshair" aria-hidden="true"></div>
      <div class="touch-zones" aria-hidden="true">
        <div class="stick" data-move-stick>
          <div class="stick__knob" data-stick-knob></div>
        </div>
        <div class="action-pad">
          <div class="action-button" data-action-button>R</div>
          <div class="action-button action-button--fire" data-action-button>F</div>
          <div class="action-button" data-action-button>D</div>
          <div class="action-button" data-action-button>I</div>
          <div class="action-button" data-action-button>W</div>
          <div class="action-button" data-action-button>P</div>
        </div>
      </div>
      <div class="rotate-prompt">ROTATE DEVICE</div>
    </div>
  `;
}

function updateDebugHud(root: HTMLElement, debug: DebugApi): void {
  const snapshot = debug.getSnapshot();
  setHudText(root, '[data-debug-fps]', `FPS ${Math.round(snapshot.rendererMetrics.fps)}`);
  setHudText(root, '[data-debug-memory]', `JS ${formatMaybeMb(snapshot.memoryMetrics.jsHeapMb)}`);
  setHudText(root, '[data-debug-level-memory]', `LVL ${formatBytes(snapshot.memoryMetrics.levelRuntimeBytesEstimate)}`);
  setHudText(
    root,
    '[data-debug-chunks]',
    `CH ${snapshot.level.streaming.activeChunks}/${snapshot.level.streaming.loadedChunks}`,
  );
}

function setHudText(root: HTMLElement, selector: string, text: string): void {
  const element = root.querySelector<HTMLElement>(selector);
  if (element) {
    element.textContent = text;
  }
}

function formatMaybeMb(value: number | null): string {
  if (value === null) {
    return '--';
  }

  return `${Math.round(value)}M`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes}B`;
  }

  if (bytes < 1_048_576) {
    return `${Math.round(bytes / 1024)}K`;
  }

  return `${Math.round(bytes / 1_048_576)}M`;
}

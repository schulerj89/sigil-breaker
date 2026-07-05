import * as THREE from 'three';
import { publicAssetUrl } from './assetUrls';
import { DEBUG_SCENE_ID, GAME_TITLE, PERFORMANCE_BUDGETS, type GamePhase } from './config';
import { createDebugApi, type DebugApi, type UiLoadingSnapshot } from './debug';
import { EnemySystem } from './enemies/enemySystem';
import { createFoundationLevelRuntime, type FoundationLevelRuntime } from './foundationLevelRuntime';
import { FpsControls } from './fpsControls';
import { Health } from './health';
import { LEVEL_HEIGHT_TILES, LEVEL_WIDTH_TILES } from './levelMap';
import { createMobileZoomGuard } from './mobileZoomGuard';
import { WEAPON_DEFINITIONS } from './weapons/weaponManifest';
import { WeaponSystem } from './weapons/weaponSystem';

export interface SigilbreakerApp {
  dispose: () => void;
  debug: DebugApi;
}

const TITLE_BACKGROUND_ASSET_ID = 'ui.title.background.sigilbreaker.generated';
const TITLE_BACKGROUND_PATH = 'assets/title/sigilbreaker-title-bg.webp';
const EXPECTED_GAMEPLAY_ASSET_COUNT = 17;
const EXPECTED_BOOT_ASSET_COUNT = EXPECTED_GAMEPLAY_ASSET_COUNT + 1;

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
    preserveDrawingBuffer: shouldPreserveDrawingBuffer(),
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x0d1012, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, PERFORMANCE_BUDGETS.maxDevicePixelRatio));

  const scene = new THREE.Scene();
  scene.name = DEBUG_SCENE_ID;
  scene.background = new THREE.Color(0x0d1012);
  scene.fog = new THREE.Fog(0x0d1012, 12, 30);

  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 180);
  scene.add(camera);

  const disposables: Array<{ dispose: () => void }> = [];
  const track = <Resource extends { dispose: () => void }>(resource: Resource): Resource => {
    disposables.push(resource);
    return resource;
  };

  const levelRuntime = createFoundationLevelRuntime(scene, track);
  const zoomGuard = track(createMobileZoomGuard(root));
  const controls = new FpsControls(root, camera);
  const playerHealth = new Health(100);
  const enemySystem = new EnemySystem(scene, {
    damagePlayer: (amount) => playerHealth.damage(amount),
  });
  const weaponSystem = new WeaponSystem(root, camera, {
    resolveTargetHit: (request) => enemySystem.resolveShotHit(
      request.origin,
      request.direction,
      request.maxDistance,
      request.damage,
    ),
  });
  levelRuntime.update(controls.getSnapshot().player.position);

  let animationFrame = 0;
  let lastTime = performance.now();
  let lastHudUpdate = 0;
  let fps = PERFORMANCE_BUDGETS.targetFps;
  let debugVisible = true;
  let gamePhase: GamePhase = 'loading';
  let titleBackgroundLoaded = false;
  let titleBackgroundError: string | null = null;

  const debug = createDebugApi(
    renderer,
    () => fps,
    () => controls.getSnapshot(),
    () => levelRuntime.getSnapshot(),
    () => weaponSystem.getSnapshot(),
    () => playerHealth.getSnapshot(),
    () => enemySystem.getSnapshot(),
    () => zoomGuard.getSnapshot(),
    () => ({
      debugVisible,
      phase: gamePhase,
      loading: readLoadingSnapshot(
        levelRuntime,
        weaponSystem,
        enemySystem,
        titleBackgroundLoaded,
        titleBackgroundError,
      ),
    }),
    (pose) => controls.setPose(pose),
  );
  window.__SIGILBREAKER_DEBUG__ = debug;

  const shell = root.querySelector<HTMLElement>('.game-shell');
  const titleBackgroundUrl = publicAssetUrl(TITLE_BACKGROUND_PATH);
  shell?.style.setProperty('--title-background-image', `url("${titleBackgroundUrl}")`);
  const titleBackgroundImage = new Image();
  titleBackgroundImage.onload = () => {
    titleBackgroundLoaded = true;
  };
  titleBackgroundImage.onerror = () => {
    titleBackgroundError = `${TITLE_BACKGROUND_ASSET_ID}: failed to load`;
  };
  titleBackgroundImage.src = titleBackgroundUrl;

  const debugToggle = root.querySelector<HTMLButtonElement>('[data-debug-toggle]');
  const titleStartButton = root.querySelector<HTMLButtonElement>('[data-title-start]');
  const loadingScreen = root.querySelector<HTMLElement>('[data-loading-screen]');
  const titleScreen = root.querySelector<HTMLElement>('[data-title-screen]');
  const applyGamePhase = (): void => {
    if (shell) {
      shell.dataset.gamePhase = gamePhase;
    }
    if (titleStartButton) {
      titleStartButton.disabled = gamePhase !== 'title';
    }
    loadingScreen?.setAttribute('aria-hidden', String(gamePhase !== 'loading'));
    titleScreen?.setAttribute('aria-hidden', String(gamePhase !== 'title'));
  };
  const startGameplay = (): void => {
    if (gamePhase !== 'title') {
      return;
    }
    gamePhase = 'gameplay';
    applyGamePhase();
  };
  const onTitleStartPointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    startGameplay();
  };
  const onTitleStartClick = (event: MouseEvent): void => {
    event.preventDefault();
    startGameplay();
  };
  const updateDebugVisibility = (): void => {
    shell?.classList.toggle('game-shell--debug-hidden', !debugVisible);
    if (debugToggle) {
      debugToggle.setAttribute('aria-pressed', String(!debugVisible));
      debugToggle.setAttribute('aria-label', debugVisible ? 'Hide debug HUD' : 'Show debug HUD');
      debugToggle.textContent = debugVisible ? 'DBG' : 'HUD';
    }
  };
  const onDebugTogglePointerDown = (event: PointerEvent): void => {
    event.preventDefault();
    debugVisible = !debugVisible;
    updateDebugVisibility();
  };
  titleStartButton?.addEventListener('pointerdown', onTitleStartPointerDown);
  titleStartButton?.addEventListener('click', onTitleStartClick);
  debugToggle?.addEventListener('pointerdown', onDebugTogglePointerDown);
  applyGamePhase();
  updateDebugVisibility();

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

    if (gamePhase === 'gameplay') {
      controls.update(deltaSeconds);
      enemySystem.update(deltaSeconds, controls.getSnapshot().player.position, debugVisible);
    }
    weaponSystem.update(deltaSeconds, now);
    levelRuntime.update(controls.getSnapshot().player.position);
    renderer.render(scene, camera);

    if (now - lastHudUpdate >= 250) {
      lastHudUpdate = now;
      updateDebugHud(root, debug);
      const loadingSnapshot = readLoadingSnapshot(
        levelRuntime,
        weaponSystem,
        enemySystem,
        titleBackgroundLoaded,
        titleBackgroundError,
      );
      updateLoadingScreen(root, loadingSnapshot);
      if (gamePhase === 'loading' && loadingSnapshot.ready) {
        gamePhase = 'title';
        applyGamePhase();
      }
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
      weaponSystem.dispose();
      enemySystem.dispose();
      levelRuntime.dispose();
      titleBackgroundImage.onload = null;
      titleBackgroundImage.onerror = null;
      debugToggle?.removeEventListener('pointerdown', onDebugTogglePointerDown);
      titleStartButton?.removeEventListener('pointerdown', onTitleStartPointerDown);
      titleStartButton?.removeEventListener('click', onTitleStartClick);
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
    <div class="game-shell" data-game-phase="loading">
      <canvas class="game-canvas" aria-label="${GAME_TITLE} prototype render"></canvas>
      <div class="look-zone" aria-hidden="true"></div>
      <div class="hud">
        <div class="hud__left">
          <span class="hud__badge" data-debug-ui>${LEVEL_WIDTH_TILES} x ${LEVEL_HEIGHT_TILES}</span>
          <div class="health-meter" data-health-meter>
            <span class="health-meter__label" data-health-label>HP</span>
            <span class="health-meter__track" aria-hidden="true">
              <span class="health-meter__fill" data-health-fill></span>
            </span>
            <span class="health-meter__value" data-health-value>100 / 100</span>
          </div>
        </div>
        <div class="hud__center">
          <span class="hud__badge hud__badge--metric" data-debug-ui data-debug-fps>FPS --</span>
          <span class="hud__badge hud__badge--metric hud__badge--coords" data-debug-ui data-debug-coordinates>XYZ -- -- --</span>
          <span class="hud__badge hud__badge--metric" data-debug-ui data-debug-memory>JS --</span>
          <span class="hud__badge hud__badge--metric" data-debug-ui data-debug-level-memory>LVL --</span>
          <span class="hud__badge hud__badge--metric" data-debug-ui data-debug-chunks>CH --</span>
        </div>
        <div class="hud__right">
          <button
            class="hud__icon-button hud__icon-button--debug"
            type="button"
            data-ui-control
            data-debug-toggle
            aria-label="Hide debug HUD"
            aria-pressed="false"
          >DBG</button>
          <button
            class="hud__icon-button hud__icon-button--music"
            type="button"
            data-ui-control
            data-music-toggle
            aria-label="Mute music"
            aria-pressed="false"
          >
            <span class="music-icon" aria-hidden="true"></span>
          </button>
          <span class="hud__badge hud__badge--weapon" data-debug-ui data-weapon-label>${WEAPON_DEFINITIONS[0].label}</span>
          <span class="hud__badge hud__badge--ammo" data-debug-ui data-weapon-ammo>-- / --</span>
          <span class="hud__badge hud__badge--build" data-debug-ui>${__SIGILBREAKER_BUILD_ID__}</span>
        </div>
      </div>
      <div class="crosshair" aria-hidden="true"></div>
      <div class="loading-screen" data-loading-screen role="status" aria-live="polite">
        <div class="loading-screen__content">
          <div class="loading-screen__brand">SIGILBREAKER</div>
          <div class="loading-screen__label">LOADING ASSETS</div>
          <div class="loading-screen__bar" aria-hidden="true">
            <span class="loading-screen__fill" data-loading-fill></span>
          </div>
          <div class="loading-screen__count" data-loading-count>0 / ${EXPECTED_BOOT_ASSET_COUNT}</div>
        </div>
      </div>
      <div class="title-screen" data-title-screen aria-hidden="true">
        <div class="title-screen__copy">
          <h1 class="title-screen__title">SIGILBREAKER</h1>
          <p class="title-screen__tagline">BREACH THE STEEL SIGIL</p>
          <button
            class="title-screen__start"
            type="button"
            data-ui-control
            data-title-start
            disabled
          >START</button>
        </div>
      </div>
      <div class="touch-zones">
        <div class="stick" data-move-stick>
          <div class="stick__knob" data-stick-knob></div>
        </div>
        <div class="action-pad action-pad--combat">
          <button
            class="action-button action-button--weapon-cycle"
            type="button"
            data-ui-control
            data-action-button
            data-weapon-cycle-button
            aria-label="Switch weapon"
          >
            <span class="gun-icon" aria-hidden="true"></span>
          </button>
          <button
            class="action-button action-button--fire"
            type="button"
            data-ui-control
            data-action-button
            data-fire-button
            aria-label="Hold to aim and fire"
          >
            <span class="reticle-icon" aria-hidden="true"></span>
          </button>
        </div>
      </div>
      <div class="rotate-prompt" role="status" aria-live="polite">
        <div class="rotate-prompt__content">
          <div class="rotate-prompt__icon" aria-hidden="true">
            <span class="rotate-prompt__phone"></span>
          </div>
          <div class="rotate-prompt__label">ROTATE TO LANDSCAPE</div>
        </div>
      </div>
    </div>
  `;
}

function readLoadingSnapshot(
  levelRuntime: FoundationLevelRuntime,
  weaponSystem: WeaponSystem,
  enemySystem: EnemySystem,
  titleBackgroundLoaded: boolean,
  titleBackgroundError: string | null,
): UiLoadingSnapshot {
  const levelSnapshot = levelRuntime.getSnapshot();
  const weaponSnapshot = weaponSystem.getSnapshot();
  const enemySnapshot = enemySystem.getSnapshot();
  const loadedGameplayAssetIds = new Set([
    ...levelSnapshot.loadedTextureAssetIds,
    ...weaponSnapshot.loadedAssetIds,
    ...enemySnapshot.loadedAssetIds,
  ]);
  const assetLoadErrors = [
    ...levelSnapshot.assetLoadErrors,
    ...weaponSnapshot.assetLoadErrors,
    ...enemySnapshot.assetLoadErrors,
  ];
  if (titleBackgroundError) {
    assetLoadErrors.push(titleBackgroundError);
  }
  const loadedAssets = loadedGameplayAssetIds.size + (titleBackgroundLoaded ? 1 : 0);
  const ready =
    loadedAssets >= EXPECTED_BOOT_ASSET_COUNT &&
    assetLoadErrors.length === 0 &&
    weaponSnapshot.modelBytesLoaded > 0 &&
    enemySnapshot.modelBytesLoaded > 0 &&
    titleBackgroundLoaded;

  return {
    ready,
    loadedAssets,
    expectedAssets: EXPECTED_BOOT_ASSET_COUNT,
    titleBackgroundLoaded,
    titleBackgroundAssetId: TITLE_BACKGROUND_ASSET_ID,
    assetLoadErrors,
  };
}

function updateLoadingScreen(root: HTMLElement, snapshot: UiLoadingSnapshot): void {
  const count = root.querySelector<HTMLElement>('[data-loading-count]');
  const fill = root.querySelector<HTMLElement>('[data-loading-fill]');
  if (count) {
    count.textContent = snapshot.assetLoadErrors.length > 0
      ? 'LOAD ISSUE'
      : `${snapshot.loadedAssets} / ${snapshot.expectedAssets}`;
  }
  if (fill) {
    fill.style.width = `${Math.max(0, Math.min(1, snapshot.loadedAssets / snapshot.expectedAssets)) * 100}%`;
  }
}

function shouldPreserveDrawingBuffer(): boolean {
  return import.meta.env.DEV || new URLSearchParams(window.location.search).has('qaCapture');
}

function updateDebugHud(root: HTMLElement, debug: DebugApi): void {
  const snapshot = debug.getSnapshot();
  setHudText(root, '[data-debug-fps]', `FPS ${Math.round(snapshot.rendererMetrics.fps)}`);
  setHudText(root, '[data-debug-coordinates]', formatCoordinates(snapshot.scene.playerPosition));
  setHudText(root, '[data-debug-memory]', `JS ${formatMaybeMb(snapshot.memoryMetrics.jsHeapMb)}`);
  setHudText(root, '[data-debug-level-memory]', `LVL ${formatBytes(snapshot.memoryMetrics.levelRuntimeBytesEstimate)}`);
  setHudText(root, '[data-weapon-label]', snapshot.weapon.activeWeaponLabel);
  setHudText(
    root,
    '[data-weapon-ammo]',
    snapshot.weapon.isReloading ? 'LOAD' : `${snapshot.weapon.ammoInMagazine} / ${snapshot.weapon.magazineSize}`,
  );
  setHudText(
    root,
    '[data-debug-chunks]',
    `CH ${snapshot.level.streaming.activeChunks}/${snapshot.level.streaming.loadedChunks}`,
  );
  setHudText(
    root,
    '[data-health-value]',
    `${Math.round(snapshot.player.health.current)} / ${Math.round(snapshot.player.health.max)}`,
  );
  setHudWidth(root, '[data-health-fill]', `${Math.max(0, Math.min(1, snapshot.player.health.ratio)) * 100}%`);
}

function setHudText(root: HTMLElement, selector: string, text: string): void {
  const element = root.querySelector<HTMLElement>(selector);
  if (element) {
    element.textContent = text;
  }
}

function setHudWidth(root: HTMLElement, selector: string, width: string): void {
  const element = root.querySelector<HTMLElement>(selector);
  if (element) {
    element.style.width = width;
  }
}

function formatMaybeMb(value: number | null): string {
  if (value === null) {
    return '--';
  }

  return `${Math.round(value)}M`;
}

function formatCoordinates(position: readonly [number, number, number]): string {
  return `XYZ ${formatCoordinate(position[0])} ${formatCoordinate(position[1])} ${formatCoordinate(position[2])}`;
}

function formatCoordinate(value: number): string {
  return value.toFixed(1);
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

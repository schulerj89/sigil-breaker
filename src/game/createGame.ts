import * as THREE from 'three';
import { DEBUG_SCENE_ID, GAME_TITLE, PERFORMANCE_BUDGETS } from './config';
import { createDebugApi, type DebugApi } from './debug';
import { FpsControls } from './fpsControls';
import {
  LEVEL_HEIGHT_TILES,
  LEVEL_TILE_SIZE,
  LEVEL_WIDTH_TILES,
  getLevelTiles,
} from './levelMap';

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
  scene.fog = new THREE.Fog(0x0d1012, 12, 32);

  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 180);

  const disposables: Array<{ dispose: () => void }> = [];
  const track = <Resource extends { dispose: () => void }>(resource: Resource): Resource => {
    disposables.push(resource);
    return resource;
  };

  buildFoundationLevel(scene, track);
  const controls = new FpsControls(root, camera);

  let animationFrame = 0;
  let lastTime = performance.now();
  let fps = PERFORMANCE_BUDGETS.targetFps;

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
    renderer.render(scene, camera);
    animationFrame = window.requestAnimationFrame(animate);
  };

  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(root);
  window.addEventListener('orientationchange', resize);
  animationFrame = window.requestAnimationFrame(animate);

  const debug = createDebugApi(renderer, () => fps, () => controls.getSnapshot());
  window.__SIGILBREAKER_DEBUG__ = debug;

  return {
    debug,
    dispose: () => {
      window.cancelAnimationFrame(animationFrame);
      controls.dispose();
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
          <span class="hud__badge">20 x 20</span>
          <span class="hud__badge hud__badge--hp">HP 100</span>
        </div>
        <div class="hud__center">
          <span class="hud__badge">FPS TEST</span>
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

function buildFoundationLevel(
  scene: THREE.Scene,
  track: <Resource extends { dispose: () => void }>(resource: Resource) => Resource,
): void {
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

  const wallGeometry = track(new THREE.BoxGeometry(LEVEL_TILE_SIZE, 2.4, LEVEL_TILE_SIZE));
  const wallMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0x263c46,
      roughness: 0.74,
    }),
  );
  const coverGeometry = track(new THREE.BoxGeometry(LEVEL_TILE_SIZE, 1.15, LEVEL_TILE_SIZE));
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

  const wallTiles = getLevelTiles().filter((tile) => tile.symbol === '#');
  const wallMesh = new THREE.InstancedMesh(wallGeometry, wallMaterial, wallTiles.length);
  wallMesh.name = 'foundation-walls';
  wallTiles.forEach((tile, index) => {
    const matrix = new THREE.Matrix4().makeTranslation(tile.worldX, 1.2, tile.worldZ);
    wallMesh.setMatrixAt(index, matrix);
  });
  wallMesh.instanceMatrix.needsUpdate = true;
  scene.add(wallMesh);

  const coverTiles = getLevelTiles().filter((tile) => tile.symbol === 'C');
  const coverMesh = new THREE.InstancedMesh(coverGeometry, coverMaterial, coverTiles.length);
  coverMesh.name = 'foundation-cover';
  coverTiles.forEach((tile, index) => {
    const matrix = new THREE.Matrix4().makeTranslation(tile.worldX, 0.575, tile.worldZ);
    coverMesh.setMatrixAt(index, matrix);
  });
  coverMesh.instanceMatrix.needsUpdate = true;
  scene.add(coverMesh);

  for (const tile of getLevelTiles()) {
    if (tile.symbol !== 'E') {
      continue;
    }

    const exitMarker = new THREE.Mesh(exitGeometry, exitMaterial);
    exitMarker.position.set(tile.worldX, 0.04, tile.worldZ);
    scene.add(exitMarker);
  }
}

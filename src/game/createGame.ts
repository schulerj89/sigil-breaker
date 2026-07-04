import * as THREE from 'three';
import { DEBUG_SCENE_ID, GAME_TITLE, PERFORMANCE_BUDGETS } from './config';
import { createDebugApi, type DebugApi } from './debug';

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
  scene.fog = new THREE.Fog(0x0d1012, 24, 72);

  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 180);
  camera.position.set(0, 1.7, 8);
  camera.lookAt(0, 1.25, 0);

  const disposables: Array<{ dispose: () => void }> = [];
  const track = <Resource extends { dispose: () => void }>(resource: Resource): Resource => {
    disposables.push(resource);
    return resource;
  };

  buildDebugArena(scene, track);

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

    scene.rotation.y = Math.sin(now * 0.00015) * 0.015;
    renderer.render(scene, camera);
    animationFrame = window.requestAnimationFrame(animate);
  };

  resize();
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(root);
  window.addEventListener('orientationchange', resize);
  animationFrame = window.requestAnimationFrame(animate);

  const debug = createDebugApi(renderer, camera, () => fps);
  window.__SIGILBREAKER_DEBUG__ = debug;

  return {
    debug,
    dispose: () => {
      window.cancelAnimationFrame(animationFrame);
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
      <div class="hud" aria-hidden="true">
        <div class="hud__left">
          <span class="hud__badge">L1</span>
          <span class="hud__badge hud__badge--hp">HP 100</span>
        </div>
        <div class="hud__center">
          <span class="hud__badge">READY</span>
        </div>
        <div class="hud__right">
          <span class="hud__badge hud__badge--ammo">30 / 90</span>
          <span class="hud__badge hud__badge--build">${__SIGILBREAKER_BUILD_ID__}</span>
        </div>
      </div>
      <div class="crosshair" aria-hidden="true"></div>
      <div class="touch-zones" aria-hidden="true">
        <div class="stick"></div>
        <div class="action-pad">
          <div class="action-button">R</div>
          <div class="action-button action-button--fire">F</div>
          <div class="action-button">D</div>
          <div class="action-button">I</div>
          <div class="action-button">W</div>
          <div class="action-button">P</div>
        </div>
      </div>
      <div class="rotate-prompt">ROTATE DEVICE</div>
    </div>
  `;
}

function buildDebugArena(
  scene: THREE.Scene,
  track: <Resource extends { dispose: () => void }>(resource: Resource) => Resource,
): void {
  const ambient = new THREE.HemisphereLight(0xd8fff0, 0x1b1410, 1.4);
  scene.add(ambient);

  const keyLight = new THREE.DirectionalLight(0xffefc2, 2.2);
  keyLight.position.set(5, 8, 7);
  scene.add(keyLight);

  const floorGeometry = track(new THREE.PlaneGeometry(42, 42, 1, 1));
  const floorMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0x1e2a25,
      roughness: 0.82,
      metalness: 0.04,
    }),
  );
  const floor = new THREE.Mesh(floorGeometry, floorMaterial);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const grid = new THREE.GridHelper(42, 42, 0x6ee7b7, 0x334155);
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

  const markerGeometry = track(new THREE.BoxGeometry(1, 1, 1));
  const coverMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0x2f4653,
      roughness: 0.65,
    }),
  );
  const targetMaterial = track(
    new THREE.MeshStandardMaterial({
      color: 0x8b3131,
      roughness: 0.54,
      emissive: 0x210505,
    }),
  );

  const placements = [
    { x: -5, z: -5, h: 1.4, material: coverMaterial },
    { x: 5, z: -5, h: 1.4, material: coverMaterial },
    { x: -7, z: 1, h: 2.2, material: coverMaterial },
    { x: 7, z: 1, h: 2.2, material: coverMaterial },
    { x: 0, z: -10, h: 2.6, material: targetMaterial },
  ];

  for (const placement of placements) {
    const marker = new THREE.Mesh(markerGeometry, placement.material);
    marker.position.set(placement.x, placement.h / 2, placement.z);
    marker.scale.set(1.6, placement.h, 1.6);
    scene.add(marker);
  }
}

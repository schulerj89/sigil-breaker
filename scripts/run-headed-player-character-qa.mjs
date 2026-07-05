/* global console, process, URL, window */

import { chromium } from '@playwright/test';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

const HOST = '127.0.0.1';
const VIEWPORT = { width: 844, height: 390 };
const RUN_ID = process.env.RUN_ID ?? '20260705-main-character-concepts';
const OUTPUT_DIR = resolve('artifacts', 'sub-agents', RUN_ID, 'asset-playground-qa-agent');
const CHARACTER_ROOT = 'public/assets/characters/meshy-gadget-gremlin';
const MODEL_PATH = `${CHARACTER_ROOT}/models/player.hero.gadget-gremlin.apose.animated.glb`;
const CLIPS = [
  {
    id: 'idle',
    screenshot: 'player-character-idle.png',
  },
  {
    id: 'gun-hold',
    screenshot: 'player-character-gun-hold.png',
  },
  {
    id: 'dance',
    screenshot: 'player-character-dance.png',
  },
  {
    id: 'out-of-hp',
    screenshot: 'player-character-out-of-hp.png',
  },
];

await mkdir(OUTPUT_DIR, { recursive: true });

const port = await getFreePort();
const server = createStaticServer(process.cwd());
await new Promise((resolveServer) => server.listen(port, HOST, resolveServer));

const target = `http://${HOST}:${port}/__player_character_qa.html`;
const report = {
  runId: RUN_ID,
  headless: false,
  target,
  viewport: VIEWPORT,
  modelPath: MODEL_PATH,
  clips: CLIPS,
  screenshots: [],
  consoleMessages: [],
  failedRequests: [],
  ignoredFailedRequests: [],
  characterGlbRequests: [],
  snapshots: [],
  budgetWarnings: [],
  passed: false,
};

let browser;

try {
  browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();

  page.on('console', (message) => {
    if (message.type() === 'error') {
      report.consoleMessages.push({ type: message.type(), text: message.text() });
    }
  });

  page.on('requestfailed', (request) => {
    const failedRequest = {
      url: request.url(),
      failure: request.failure()?.errorText ?? 'request failed',
    };

    if (failedRequest.url.endsWith('.glb') && failedRequest.failure === 'net::ERR_ABORTED') {
      report.ignoredFailedRequests.push(failedRequest);
    } else {
      report.failedRequests.push(failedRequest);
    }
  });
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.endsWith('.glb')) {
      report.characterGlbRequests.push(request.url());
    }
  });

  await page.goto(target, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__PLAYER_CHARACTER_QA__?.ready === true, null, { timeout: 45_000 });
  await delay(400);
  await capture(page, 'player-character-rigged-front.png');

  for (const clip of CLIPS) {
    await page.evaluate((clipId) => window.__PLAYER_CHARACTER_QA__.playClip(clipId), clip.id);
    await page.waitForFunction(
      (clipId) => window.__PLAYER_CHARACTER_QA__?.snapshot?.activeClipId === clipId,
      clip.id,
      { timeout: 45_000 },
    );
    await delay(850);
    await capture(page, clip.screenshot);
  }

  const snapshot = await page.evaluate(() => window.__PLAYER_CHARACTER_QA__.snapshot);
  report.snapshots.push(snapshot);
  addBudgetWarnings();

  const errors = [
    ...report.consoleMessages.map((message) => `console error: ${message.text}`),
    ...report.failedRequests.map((request) => `failed request: ${request.url} ${request.failure}`),
  ];

  if (!snapshot?.bounds?.size || snapshot.bounds.size[1] <= 0.5) {
    errors.push('character bounds were missing or too small');
  }

  if (snapshot?.renderer?.calls > 12) {
    errors.push(`character playground draw calls too high: ${snapshot.renderer.calls}`);
  }
  if (new Set(report.characterGlbRequests.map((url) => new URL(url).pathname)).size !== 1) {
    errors.push(`expected one character GLB request path, saw ${report.characterGlbRequests.length}`);
  }

  report.passed = errors.length === 0;
  await writeReport();

  if (errors.length > 0) {
    throw new Error(`Headed player-character QA failed:\n${errors.join('\n')}`);
  }

  console.log(`Headed player-character QA passed. Artifacts: ${OUTPUT_DIR}`);

  async function capture(pageInstance, name) {
    await pageInstance.screenshot({
      path: resolve(OUTPUT_DIR, name),
      fullPage: false,
    });
    report.screenshots.push(name);
    report.snapshots.push(await pageInstance.evaluate(() => window.__PLAYER_CHARACTER_QA__.snapshot));
  }
} finally {
  await writeReport();
  if (browser) {
    await browser.close();
  }
  await new Promise((resolveClose) => server.close(resolveClose));
}

function addBudgetWarnings() {
  const maxTriangles = Math.max(...report.snapshots.map((snapshot) => snapshot.renderer?.triangles ?? 0));
  if (maxTriangles > 45_000) {
    report.budgetWarnings.push(`triangle count ${maxTriangles} exceeds 45000 target for gameplay integration`);
  }

  const largestGlbBytes = statSync(resolve(MODEL_PATH)).size;
  if (largestGlbBytes > 6_000_000) {
    report.budgetWarnings.push(`combined runtime GLB ${largestGlbBytes}B exceeds 6000000B target`);
  }

  report.budgetWarnings.push('gun-hold animation is visually inspected but not accepted as final two-hand blaster pose');
}

async function writeReport() {
  await writeFile(resolve(OUTPUT_DIR, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
}

function createStaticServer(rootDir) {
  const root = resolve(rootDir);

  return createServer((request, response) => {
    const requestUrl = new URL(request.url ?? '/', `http://${HOST}`);
    if (requestUrl.pathname === '/__player_character_qa.html') {
      sendHtml(response, buildPageHtml());
      return;
    }

    if (requestUrl.pathname === '/favicon.ico') {
      sendText(response, 204, '');
      return;
    }

    const filePath = resolve(root, `.${decodeURIComponent(requestUrl.pathname)}`);
    if (!filePath.startsWith(root + sep) || !existsSync(filePath) || !statSync(filePath).isFile()) {
      sendText(response, 404, 'Not found');
      return;
    }

    response.writeHead(200, {
      'Content-Type': contentTypeFor(filePath),
      'Cache-Control': 'no-store',
    });
    createReadStream(filePath).pipe(response);
  });
}

function buildPageHtml() {
  const clipEntries = CLIPS.map((clip) => `{ id: ${JSON.stringify(clip.id)} }`).join(',');

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Player Character QA</title>
  <style>
    html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #101419; color: #dce7ea; font-family: Arial, sans-serif; }
    canvas { display: block; width: 100vw; height: 100vh; }
    .hud { position: fixed; left: 12px; top: 12px; padding: 8px 10px; background: rgba(10, 14, 18, 0.72); border: 1px solid rgba(105, 255, 198, 0.5); font-weight: 700; font-size: 12px; letter-spacing: 0; }
  </style>
  <script type="importmap">
    {
      "imports": {
        "three": "/node_modules/three/build/three.module.js",
        "three/addons/": "/node_modules/three/examples/jsm/"
      }
    }
  </script>
</head>
<body>
  <div class="hud" id="hud">Loading player character...</div>
  <script type="module">
    import * as THREE from 'three';
    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

    const modelPath = ${JSON.stringify(`/${MODEL_PATH}`)};
    const clipEntries = [${clipEntries}];
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x101419);
    const camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.05, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(renderer.domElement);

    const ambient = new THREE.HemisphereLight(0xd7f7ff, 0x1d2228, 2.8);
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(3, 5, 4);
    scene.add(ambient, key);

    const grid = new THREE.GridHelper(4, 8, 0x5ce0bf, 0x293842);
    grid.position.y = -0.01;
    scene.add(grid);

    const loader = new GLTFLoader();
    const clock = new THREE.Clock();
    const root = new THREE.Group();
    scene.add(root);

    let model = null;
    let mixer = null;
    let activeClipId = 'rigged';
    let currentAnimations = [];
    const hud = document.getElementById('hud');
    const bounds = new THREE.Box3();
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    window.__PLAYER_CHARACTER_QA__ = {
      ready: false,
      snapshot: null,
      playClip: async (clipId) => {
        playClip(clipId);
      },
    };

    await loadGltf(modelPath);
    activeClipId = 'rigged';
    window.__PLAYER_CHARACTER_QA__.ready = true;

    function animate() {
      const delta = Math.min(clock.getDelta(), 0.05);
      if (mixer) {
        mixer.update(delta);
      }
      model?.rotation.set(0, Math.sin(performance.now() * 0.00045) * 0.08, 0);
      renderer.render(scene, camera);
      updateSnapshot();
      requestAnimationFrame(animate);
    }
    animate();

    async function loadGltf(url) {
      const gltf = await loader.loadAsync(url);
      disposeRoot(root);
      root.clear();
      model = gltf.scene;
      model.traverse((object) => {
        if (object.isMesh) {
          object.frustumCulled = false;
        }
      });
      root.add(model);
      fitModel();
      mixer = null;
      currentAnimations = gltf.animations;
      if (gltf.animations.length > 0) {
        mixer = new THREE.AnimationMixer(model);
        playClip('idle');
      }
      hud.textContent = activeClipId + ' | clips ' + gltf.animations.length;
      updateSnapshot();
    }

    function playClip(clipId) {
      const clip = currentAnimations.find((animation) => animation.name === clipId);
      if (!clip || !mixer || !model) {
        throw new Error('Missing embedded character animation clip: ' + clipId);
      }

      mixer.stopAllAction();
      const action = mixer.clipAction(clip, model);
      action.reset().play();
      activeClipId = clipId;
      hud.textContent = activeClipId + ' | clips ' + currentAnimations.length;
      updateSnapshot();
    }

    function fitModel() {
      bounds.setFromObject(model);
      bounds.getSize(size);
      bounds.getCenter(center);
      root.position.x -= center.x;
      root.position.z -= center.z;
      root.position.y -= bounds.min.y;
      const height = Math.max(size.y, 1);
      const distance = Math.max(3.2, height * 2.15);
      camera.position.set(0, height * 0.62, distance);
      camera.lookAt(0, height * 0.62, 0);
    }

    function updateSnapshot() {
      if (model) {
        bounds.setFromObject(model);
        bounds.getSize(size);
        bounds.getCenter(center);
      }
      window.__PLAYER_CHARACTER_QA__.snapshot = {
        activeClipId,
        bounds: {
          center: [center.x, center.y, center.z],
          size: [size.x, size.y, size.z],
        },
        renderer: {
          calls: renderer.info.render.calls,
          triangles: renderer.info.render.triangles,
          geometries: renderer.info.memory.geometries,
          textures: renderer.info.memory.textures,
        },
        animationClips: currentAnimations.map((clip) => ({ name: clip.name, duration: clip.duration })),
      };
    }

    function disposeRoot(group) {
      group.traverse((object) => {
        if (object.isMesh) {
          object.geometry?.dispose?.();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const material of materials) {
            for (const value of Object.values(material)) {
              if (value?.isTexture) {
                value.dispose();
              }
            }
            material?.dispose?.();
          }
        }
      });
    }

    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  </script>
</body>
</html>`;
}

function sendHtml(response, html) {
  response.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(html);
}

function sendText(response, status, text) {
  response.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(text);
}

function contentTypeFor(filePath) {
  switch (extname(filePath)) {
    case '.css':
      return 'text/css; charset=utf-8';
    case '.glb':
      return 'model/gltf-binary';
    case '.html':
      return 'text/html; charset=utf-8';
    case '.js':
      return 'text/javascript; charset=utf-8';
    case '.json':
      return 'application/json; charset=utf-8';
    case '.png':
      return 'image/png';
    default:
      return 'application/octet-stream';
  }
}

async function getFreePort() {
  return new Promise((resolvePort, rejectPort) => {
    const probe = createServer();
    probe.once('error', rejectPort);
    probe.listen(0, HOST, () => {
      const address = probe.address();
      probe.close(() => {
        resolvePort(typeof address === 'object' && address ? address.port : 0);
      });
    });
  });
}

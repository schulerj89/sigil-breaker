/* global console, process, URL */

import { chromium } from '@playwright/test';
import { Buffer } from 'node:buffer';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';

const HOST = '127.0.0.1';
const DEFAULT_PORT = 4299;
const VIEWPORT = { width: 1180, height: 720 };
const CHARACTER_ROOT = 'public/assets/characters/meshy-gadget-gremlin';
const MODEL_PATH = `${CHARACTER_ROOT}/models/player.hero.gadget-gremlin.apose.animated.glb`;
const POSE_PATH = `${CHARACTER_ROOT}/poses/gun-hold-draft.json`;
const OUTPUT_DIR = resolve('artifacts', 'sub-agents', '20260705-player-pose-harness', 'asset-playground-qa-agent');
const CONTROLLED_BONES = [
  'Spine',
  'Spine01',
  'Spine02',
  'LeftShoulder',
  'LeftArm',
  'LeftForeArm',
  'LeftHand',
  'RightShoulder',
  'RightArm',
  'RightForeArm',
  'RightHand',
  'neck',
  'Head',
];

await mkdir(OUTPUT_DIR, { recursive: true });
await mkdir(resolve(CHARACTER_ROOT, 'poses'), { recursive: true });

const port = await findPort(DEFAULT_PORT);
const server = createPoseServer(process.cwd());
await new Promise((resolveServer) => server.listen(port, HOST, resolveServer));

const target = `http://${HOST}:${port}/__player_pose_harness.html`;
const browser = await chromium.launch({ headless: false });
const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 1,
});
const page = await context.newPage();

page.on('console', (message) => {
  console.log(`[browser:${message.type()}] ${message.text()}`);
});

await page.goto(target, { waitUntil: 'domcontentloaded' });
console.log(`Player pose harness running at ${target}`);
console.log(`Use Save Pose in the browser to write ${POSE_PATH}`);
console.log('Close the browser window or press Ctrl+C in this terminal to stop.');

page.on('close', async () => {
  await shutdown();
});

process.on('SIGINT', async () => {
  await shutdown();
});

process.on('SIGTERM', async () => {
  await shutdown();
});

await new Promise(() => {});

async function shutdown() {
  try {
    await browser.close();
  } catch {
    // Browser may already be closed.
  }
  await new Promise((resolveClose) => server.close(resolveClose));
  process.exit(0);
}

function createPoseServer(rootDir) {
  const root = resolve(rootDir);

  return createServer(async (request, response) => {
    const requestUrl = new URL(request.url ?? '/', `http://${HOST}`);

    if (request.method === 'GET' && requestUrl.pathname === '/__player_pose_harness.html') {
      sendHtml(response, await buildPageHtml());
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/__save_pose') {
      const body = await readRequestBody(request);
      const pose = JSON.parse(body);
      const savedAt = new Date().toISOString();
      const payload = {
        schemaVersion: '1.0.0',
        assetId: 'player.hero.gadget-gremlin.apose',
        poseId: 'gun-hold-draft',
        savedAt,
        modelPath: MODEL_PATH,
        coordinateSystem: 'three-js-radians-local-bone-euler-XYZ',
        notes: [
          'Draft still pose authored in the player pose harness.',
          'Use for visual staging only until animation/optimization agents convert it into a runtime pose or clip.',
        ],
        ...pose,
      };
      await writeFile(resolve(POSE_PATH), `${JSON.stringify(payload, null, 2)}\n`);
      await writeFile(resolve(OUTPUT_DIR, 'latest-gun-hold-pose.json'), `${JSON.stringify(payload, null, 2)}\n`);
      sendJson(response, { ok: true, path: POSE_PATH, artifactPath: 'artifacts/sub-agents/20260705-player-pose-harness/asset-playground-qa-agent/latest-gun-hold-pose.json' });
      return;
    }

    if (request.method === 'POST' && requestUrl.pathname === '/__save_screenshot') {
      const body = await readRequestBody(request);
      const { dataUrl } = JSON.parse(body);
      const base64 = dataUrl.replace(/^data:image\/png;base64,/, '');
      await writeFile(resolve(OUTPUT_DIR, 'latest-gun-hold-pose.png'), Buffer.from(base64, 'base64'));
      sendJson(response, { ok: true, artifactPath: 'artifacts/sub-agents/20260705-player-pose-harness/asset-playground-qa-agent/latest-gun-hold-pose.png' });
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

async function buildPageHtml() {
  const existingPose = existsSync(resolve(POSE_PATH)) ? await readFile(resolve(POSE_PATH), 'utf8') : 'null';

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>Player Pose Harness</title>
  <style>
    :root { color-scheme: dark; font-family: Arial, sans-serif; background: #0d1116; color: #e7eef2; }
    * { box-sizing: border-box; }
    html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; }
    body { display: grid; grid-template-columns: minmax(0, 1fr) 420px; }
    canvas { display: block; width: 100%; height: 100vh; }
    aside { height: 100vh; overflow: auto; border-left: 1px solid rgba(95, 255, 204, 0.35); background: #111820; padding: 12px; }
    h1 { margin: 0 0 10px; font-size: 18px; letter-spacing: 0; }
    h2 { margin: 16px 0 8px; font-size: 14px; color: #9debd6; }
    .row { display: grid; grid-template-columns: 110px 1fr 48px; gap: 8px; align-items: center; margin: 6px 0; font-size: 12px; }
    input[type="range"] { width: 100%; }
    button { min-height: 36px; border: 1px solid rgba(95, 255, 204, 0.45); background: #17232c; color: #e7eef2; font-weight: 700; }
    button:active { background: #22333f; }
    .toolbar { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; position: sticky; top: -12px; padding: 12px 0; background: #111820; z-index: 2; }
    textarea { width: 100%; min-height: 220px; background: #071014; color: #d7f5ef; border: 1px solid rgba(95, 255, 204, 0.35); font-family: Consolas, monospace; font-size: 11px; }
    .status { margin: 8px 0 0; color: #a8b8bd; font-size: 12px; min-height: 18px; }
    .scene-hud { position: fixed; left: 12px; top: 12px; padding: 8px 10px; background: rgba(8, 12, 16, 0.72); border: 1px solid rgba(95, 255, 204, 0.45); font-size: 13px; font-weight: 700; }
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
  <main>
    <div class="scene-hud" id="sceneHud">Loading rig...</div>
  </main>
  <aside>
    <h1>Gun Hold Pose Harness</h1>
    <div class="toolbar">
      <button id="savePose">Save Pose</button>
      <button id="saveShot">Save Screenshot</button>
      <button id="resetPose">Reset</button>
      <button id="mirrorPose">Mirror Arms</button>
    </div>
    <div class="status" id="status">Load the rig, move sliders, then save.</div>
    <h2>Scene</h2>
    <label class="row"><span>Yaw</span><input data-scene="yaw" type="range" min="-180" max="180" step="1" value="0"><output>0</output></label>
    <label class="row"><span>Zoom</span><input data-scene="zoom" type="range" min="220" max="520" step="5" value="330"><output>330</output></label>
    <h2>Bones</h2>
    <div id="controls"></div>
    <h2>Pose JSON</h2>
    <textarea id="poseJson" spellcheck="false"></textarea>
  </aside>
  <script type="module">
    import * as THREE from 'three';
    import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

    const modelPath = ${JSON.stringify(`/${MODEL_PATH}`)};
    const controlledBones = ${JSON.stringify(CONTROLLED_BONES)};
    const existingPose = ${existingPose};
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0d1116);
    const camera = new THREE.PerspectiveCamera(42, window.innerWidth / Math.max(window.innerHeight, 1), 0.05, 100);
    const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    renderer.setSize(window.innerWidth - 420, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.querySelector('main').appendChild(renderer.domElement);

    const ambient = new THREE.HemisphereLight(0xd7f7ff, 0x1d2228, 2.8);
    const key = new THREE.DirectionalLight(0xffffff, 3);
    key.position.set(3, 5, 4);
    scene.add(ambient, key);

    const grid = new THREE.GridHelper(4, 8, 0x5ce0bf, 0x293842);
    grid.position.y = -0.01;
    scene.add(grid);

    const root = new THREE.Group();
    scene.add(root);
    const loader = new GLTFLoader();
    const bounds = new THREE.Box3();
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    const bones = new Map();
    const baseRotations = {};
    const pose = {
      bones: Object.fromEntries(controlledBones.map((name) => [name, { x: 0, y: 0, z: 0 }])),
      scene: { yawDegrees: 0, zoom: 330 },
    };

    const controls = document.getElementById('controls');
    const poseJson = document.getElementById('poseJson');
    const status = document.getElementById('status');
    const sceneHud = document.getElementById('sceneHud');

    buildControls();
    await loadModel();
    if (existingPose?.bones) {
      for (const [boneName, values] of Object.entries(existingPose.bones)) {
        if (pose.bones[boneName]) {
          pose.bones[boneName] = { ...pose.bones[boneName], ...values };
        }
      }
      if (existingPose.scene) {
        pose.scene = { ...pose.scene, ...existingPose.scene };
      }
      syncInputsFromPose();
    }
    applyPose();
    animate();

    document.getElementById('savePose').addEventListener('click', async () => {
      const response = await fetch('/__save_pose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(currentPayload()),
      });
      const result = await response.json();
      status.textContent = result.ok ? 'Saved ' + result.path : 'Save failed';
    });

    document.getElementById('saveShot').addEventListener('click', async () => {
      const response = await fetch('/__save_screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl: renderer.domElement.toDataURL('image/png') }),
      });
      const result = await response.json();
      status.textContent = result.ok ? 'Saved ' + result.artifactPath : 'Screenshot failed';
    });

    document.getElementById('resetPose').addEventListener('click', () => {
      for (const values of Object.values(pose.bones)) {
        values.x = 0;
        values.y = 0;
        values.z = 0;
      }
      syncInputsFromPose();
      applyPose();
    });

    document.getElementById('mirrorPose').addEventListener('click', () => {
      for (const leftName of controlledBones.filter((name) => name.startsWith('Left'))) {
        const rightName = leftName.replace('Left', 'Right');
        if (pose.bones[rightName]) {
          pose.bones[rightName] = {
            x: pose.bones[leftName].x,
            y: -pose.bones[leftName].y,
            z: -pose.bones[leftName].z,
          };
        }
      }
      syncInputsFromPose();
      applyPose();
    });

    function buildControls() {
      for (const boneName of controlledBones) {
        const header = document.createElement('h2');
        header.textContent = boneName;
        controls.appendChild(header);
        for (const axis of ['x', 'y', 'z']) {
          const label = document.createElement('label');
          label.className = 'row';
          label.innerHTML = '<span>' + axis.toUpperCase() + '</span><input type="range" min="-120" max="120" step="1" value="0"><output>0</output>';
          const input = label.querySelector('input');
          const output = label.querySelector('output');
          input.dataset.bone = boneName;
          input.dataset.axis = axis;
          input.addEventListener('input', () => {
            pose.bones[boneName][axis] = Number(input.value);
            output.value = input.value;
            applyPose();
          });
          controls.appendChild(label);
        }
      }

      for (const input of document.querySelectorAll('[data-scene]')) {
        const output = input.parentElement.querySelector('output');
        input.addEventListener('input', () => {
          pose.scene[input.dataset.scene === 'yaw' ? 'yawDegrees' : 'zoom'] = Number(input.value);
          output.value = input.value;
          applyPose();
        });
      }
    }

    async function loadModel() {
      const gltf = await loader.loadAsync(modelPath);
      root.add(gltf.scene);
      gltf.scene.traverse((object) => {
        if (object.isBone) {
          bones.set(object.name, object);
          baseRotations[object.name] = {
            x: object.rotation.x,
            y: object.rotation.y,
            z: object.rotation.z,
          };
        }
        if (object.isMesh) {
          object.frustumCulled = false;
        }
      });
      bounds.setFromObject(gltf.scene);
      bounds.getSize(size);
      bounds.getCenter(center);
      root.position.x -= center.x;
      root.position.z -= center.z;
      root.position.y -= bounds.min.y;
      sceneHud.textContent = 'Rig loaded | bones ' + bones.size;
    }

    function syncInputsFromPose() {
      for (const input of document.querySelectorAll('[data-bone]')) {
        input.value = pose.bones[input.dataset.bone][input.dataset.axis];
        input.parentElement.querySelector('output').value = input.value;
      }
      for (const input of document.querySelectorAll('[data-scene]')) {
        input.value = input.dataset.scene === 'yaw' ? pose.scene.yawDegrees : pose.scene.zoom;
        input.parentElement.querySelector('output').value = input.value;
      }
    }

    function applyPose() {
      for (const [boneName, values] of Object.entries(pose.bones)) {
        const bone = bones.get(boneName);
        const base = baseRotations[boneName];
        if (!bone || !base) {
          continue;
        }
        bone.rotation.set(
          base.x + THREE.MathUtils.degToRad(values.x),
          base.y + THREE.MathUtils.degToRad(values.y),
          base.z + THREE.MathUtils.degToRad(values.z),
        );
      }
      root.rotation.y = THREE.MathUtils.degToRad(pose.scene.yawDegrees);
      updateCamera();
      poseJson.value = JSON.stringify(currentPayload(), null, 2);
    }

    function updateCamera() {
      const height = 1.45;
      const distance = pose.scene.zoom / 100;
      camera.position.set(0, height * 0.62, distance);
      camera.lookAt(0, height * 0.62, 0);
      camera.aspect = Math.max(window.innerWidth - 420, 1) / Math.max(window.innerHeight, 1);
      camera.updateProjectionMatrix();
    }

    function currentPayload() {
      const handPositions = {};
      for (const handName of ['LeftHand', 'RightHand']) {
        const bone = bones.get(handName);
        if (bone) {
          const position = new THREE.Vector3();
          bone.getWorldPosition(position);
          handPositions[handName] = [round(position.x), round(position.y), round(position.z)];
        }
      }
      return {
        bones: pose.bones,
        scene: pose.scene,
        handWorldPositions: handPositions,
      };
    }

    function animate() {
      renderer.render(scene, camera);
      requestAnimationFrame(animate);
    }

    function round(value) {
      return Math.round(value * 10000) / 10000;
    }

    window.addEventListener('resize', () => {
      renderer.setSize(Math.max(window.innerWidth - 420, 1), window.innerHeight);
      updateCamera();
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

function sendJson(response, payload) {
  response.writeHead(200, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  response.end(JSON.stringify(payload));
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

function readRequestBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', () => resolveBody(Buffer.concat(chunks).toString('utf8')));
    request.on('error', rejectBody);
  });
}

async function findPort(preferredPort) {
  if (await canListen(preferredPort)) {
    return preferredPort;
  }

  return new Promise((resolvePort, rejectPort) => {
    const probe = createServer();
    probe.once('error', rejectPort);
    probe.listen(0, HOST, () => {
      const address = probe.address();
      probe.close(() => resolvePort(typeof address === 'object' && address ? address.port : preferredPort + 1));
    });
  });
}

function canListen(port) {
  return new Promise((resolveCanListen) => {
    const probe = createServer();
    probe.once('error', () => resolveCanListen(false));
    probe.listen(port, HOST, () => {
      probe.close(() => resolveCanListen(true));
    });
  });
}

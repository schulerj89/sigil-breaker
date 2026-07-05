/* global console, fetch, process, window */

import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const EXPECTED_ENEMY_COUNT = 12;
const VIEWPORT = { width: 844, height: 390 };
const RUN_ID = process.env.RUN_ID ?? '20260704-enemy-headed';
const OUTPUT_DIR = resolve('artifacts', 'sub-agents', RUN_ID, 'smoke-qa-agent');
const HOST = '127.0.0.1';
const MOVEMENT_SAMPLE_MS = 1200;
const MOVEMENT_SAMPLE_INTERVAL_MS = 200;
const MIN_MOVEMENT_UNITS = 0.2;
const MAX_ATTACHMENT_OFFSET_UNITS = 0.15;
const MAX_MODEL_OFFSET_UNITS = 0.35;

await mkdir(OUTPUT_DIR, { recursive: true });

const port = await getFreePort();
const server = spawn(process.execPath, ['scripts/serve-pages-preview.mjs'], {
  env: {
    ...process.env,
    HOST,
    PORT: String(port),
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

const target = `http://${HOST}:${port}/sigil-breaker/?qaCapture=1&headedEnemyQa=1`;
const report = {
  runId: RUN_ID,
  headless: false,
  target,
  buildId: null,
  screenshots: [],
  enemyCount: 0,
  movement: [],
  stationary: [],
  attachmentOffsets: [],
  detached: [],
  modelBoundOffsets: [],
  detachedModels: [],
  posedFarCapture: null,
  consoleMessages: [],
  failedRequests: [],
  passed: false,
};

let browser;

try {
  await waitForServer(target);
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
      report.consoleMessages.push({
        type: message.type(),
        text: message.text(),
      });
    }
  });

  page.on('requestfailed', (request) => {
    report.failedRequests.push({
      url: request.url(),
      failure: request.failure()?.errorText ?? 'request failed',
    });
  });

  await page.goto(target, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.game-canvas', { state: 'visible', timeout: 30_000 });
  await waitForEnemyAssets(page);

  let before = await readDebugSnapshot(page);
  report.buildId = before.buildId;
  report.enemyCount = before.enemies.total;
  await takeScreenshot(page, 'headed-enemy-initial.png');

  const samples = [before];
  for (let elapsed = MOVEMENT_SAMPLE_INTERVAL_MS; elapsed <= MOVEMENT_SAMPLE_MS; elapsed += MOVEMENT_SAMPLE_INTERVAL_MS) {
    await delay(MOVEMENT_SAMPLE_INTERVAL_MS);
    samples.push(await readDebugSnapshot(page));
  }

  const after = samples[samples.length - 1];
  await takeScreenshot(page, 'headed-enemy-after-1200ms.png');

  report.movement = buildMovementReport(samples);
  report.stationary = report.movement
    .filter((enemy) => enemy.movedUnits < MIN_MOVEMENT_UNITS)
    .map((enemy) => enemy.id);
  report.attachmentOffsets = after.enemies.enemies.map((enemy) => ({
    id: enemy.id,
    offsets: Object.fromEntries(
      Object.entries(enemy.attachments).map(([name, position]) => [name, flatOffset(position, enemy.position)]),
    ),
  }));
  report.detached = report.attachmentOffsets
    .filter((enemy) => Object.values(enemy.offsets).some((offset) => offset > MAX_ATTACHMENT_OFFSET_UNITS))
    .map((enemy) => enemy.id);
  report.modelBoundOffsets = after.enemies.enemies.map((enemy) => ({
    id: enemy.id,
    offset: enemy.modelBounds ? flatOffset(enemy.modelBounds.center, enemy.position) : Number.POSITIVE_INFINITY,
    size: enemy.modelBounds?.size ?? null,
  }));
  report.detachedModels = report.modelBoundOffsets
    .filter((enemy) => enemy.offset > MAX_MODEL_OFFSET_UNITS || enemy.size === null || enemy.size[1] <= 1)
    .map((enemy) => enemy.id);

  const firstEnemy = after.enemies.enemies[0];
  const poseAccepted = await page.evaluate((enemyPosition) => {
    return window.__SIGILBREAKER_DEBUG__?.setPlayerPose({
      x: enemyPosition[0] - 9.25,
      z: enemyPosition[2] - 0.03,
      yawRadians: -1.57,
      pitchRadians: -0.08,
    });
  }, firstEnemy.position);
  await delay(250);
  const posed = await readDebugSnapshot(page);
  const posedFirstEnemy = posed.enemies.enemies[0];
  await takeScreenshot(page, 'headed-first-enemy-posed-far.png');

  const closePoseAccepted = await page.evaluate((enemyPosition) => {
    return window.__SIGILBREAKER_DEBUG__?.setPlayerPose({
      x: enemyPosition[0] - 4.35,
      z: enemyPosition[2] - 0.02,
      yawRadians: -1.57,
      pitchRadians: -0.1,
    });
  }, posedFirstEnemy.position);
  await delay(450);
  const closePosed = await readDebugSnapshot(page);
  const closePosedFirstEnemy = closePosed.enemies.enemies[0];
  await takeScreenshot(page, 'headed-first-enemy-facing-close.png');

  report.posedFarCapture = {
    screenshot: 'headed-first-enemy-posed-far.png',
    poseAccepted: Boolean(poseAccepted),
    playerPosition: posed.scene.playerPosition,
    yawRadians: posed.scene.yawRadians,
    pitchRadians: posed.scene.pitchRadians,
    firstEnemy: posedFirstEnemy,
    modelOffsetUnits: posedFirstEnemy.modelBounds
      ? flatOffset(posedFirstEnemy.modelBounds.center, posedFirstEnemy.position)
      : Number.POSITIVE_INFINITY,
    playerEnemyDistanceUnits: flatOffset(posed.scene.playerPosition, posedFirstEnemy.position),
  };
  report.posedCloseCapture = {
    screenshot: 'headed-first-enemy-facing-close.png',
    poseAccepted: Boolean(closePoseAccepted),
    playerPosition: closePosed.scene.playerPosition,
    yawRadians: closePosed.scene.yawRadians,
    pitchRadians: closePosed.scene.pitchRadians,
    firstEnemy: closePosedFirstEnemy,
    modelOffsetUnits: closePosedFirstEnemy.modelBounds
      ? flatOffset(closePosedFirstEnemy.modelBounds.center, closePosedFirstEnemy.position)
      : Number.POSITIVE_INFINITY,
    playerEnemyDistanceUnits: flatOffset(closePosed.scene.playerPosition, closePosedFirstEnemy.position),
  };

  const errors = [
    ...report.stationary.map((id) => `stationary enemy ${id}`),
    ...report.detached.map((id) => `detached attachment ${id}`),
    ...report.detachedModels.map((id) => `detached model ${id}`),
    ...report.consoleMessages.map((message) => `console error: ${message.text}`),
    ...report.failedRequests.map((request) => `failed request: ${request.url} ${request.failure}`),
  ];

  if (!poseAccepted) {
    errors.push('debug pose hook rejected the headed QA camera pose');
  }

  if (!closePoseAccepted) {
    errors.push('debug pose hook rejected the headed QA close-facing camera pose');
  }

  if (report.enemyCount !== EXPECTED_ENEMY_COUNT) {
    errors.push(`expected ${EXPECTED_ENEMY_COUNT} enemies, found ${report.enemyCount}`);
  }

  report.passed = errors.length === 0;
  await writeReport();

  if (errors.length > 0) {
    throw new Error(`Headed enemy QA failed:\n${errors.join('\n')}`);
  }

  console.log(`Headed enemy QA passed: ${report.enemyCount} enemies moved and stayed visually attached.`);
  console.log(`Artifacts: ${OUTPUT_DIR}`);

  async function takeScreenshot(pageInstance, name) {
    await pageInstance.screenshot({
      path: resolve(OUTPUT_DIR, name),
      fullPage: false,
    });
    report.screenshots.push(name);
  }
} finally {
  await writeReport();
  if (browser) {
    await browser.close();
  }
  server.kill();
}

async function getFreePort() {
  const probe = createServer();
  await new Promise((resolvePromise, rejectPromise) => {
    probe.once('error', rejectPromise);
    probe.listen(0, HOST, resolvePromise);
  });

  const address = probe.address();
  if (address === null || typeof address === 'string') {
    probe.close();
    throw new Error('Unable to reserve a local preview port.');
  }

  const port = address.port;
  await new Promise((resolvePromise) => probe.close(resolvePromise));
  return port;
}

async function waitForServer(url) {
  const deadline = Date.now() + 10_000;
  let lastError;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      const body = await response.text();
      if (response.ok && body.includes('/sigil-breaker/assets/')) {
        return;
      }
      lastError = new Error(`Preview server responded ${response.status}.`);
    } catch (error) {
      lastError = error;
    }

    await delay(100);
  }

  throw lastError ?? new Error('Timed out waiting for preview server.');
}

async function waitForEnemyAssets(page) {
  await page.waitForFunction(
    (expectedEnemyCount) => {
      const snapshot = window.__SIGILBREAKER_DEBUG__?.getSnapshot();

      return (
        snapshot !== undefined &&
        snapshot.assetLoadErrors.length === 0 &&
        snapshot.enemies.total === expectedEnemyCount &&
        snapshot.enemies.enemies.every((enemy) => enemy.assetLoaded && enemy.modelBounds !== null)
      );
    },
    EXPECTED_ENEMY_COUNT,
    { timeout: 30_000 },
  );
}

async function readDebugSnapshot(page) {
  const snapshot = await page.evaluate(() => window.__SIGILBREAKER_DEBUG__?.getSnapshot());
  if (!snapshot) {
    throw new Error('Missing window.__SIGILBREAKER_DEBUG__ snapshot.');
  }

  return snapshot;
}

function buildMovementReport(samples) {
  const before = samples[0];
  const after = samples[samples.length - 1];

  return after.enemies.enemies.map((enemy, index) => {
    const previous = before.enemies.enemies[index];
    const movedUnits = Math.max(
      ...samples.map((snapshot) => flatOffset(snapshot.enemies.enemies[index].position, previous.position)),
    );

    return {
      id: enemy.id,
      marker: enemy.marker,
      origin: enemy.origin,
      before: previous.position,
      after: enemy.position,
      movedUnits,
      finalMovedUnits: flatOffset(enemy.position, previous.position),
      originDistanceUnits: flatOffset(enemy.position, enemy.origin),
      state: enemy.state,
    };
  });
}

function flatOffset(first, second) {
  return roundMetric(Math.hypot(first[0] - second[0], first[2] - second[2]));
}

function roundMetric(value) {
  return Math.round(value * 1000) / 1000;
}

async function writeReport() {
  await writeFile(resolve(OUTPUT_DIR, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
}

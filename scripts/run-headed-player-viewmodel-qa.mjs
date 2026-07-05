/* global console, fetch, process, window */

import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';

const VIEWPORT = { width: 844, height: 390 };
const RUN_ID = process.env.RUN_ID ?? '20260705-player-viewmodel';
const OUTPUT_DIR = resolve('artifacts', 'sub-agents', RUN_ID, 'asset-playground-qa-agent');
const HOST = '127.0.0.1';
const EXPECTED_VIEWMODEL_ID = 'player.hero.gadget-gremlin.apose.animated';
const WEAPON_COUNT = 5;

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

const tuningParam = process.env.VIEWMODEL_TUNING === '1' ? '&viewmodelTuning=1' : '';
const target = `http://${HOST}:${port}/sigil-breaker/?qaCapture=1&headedPlayerViewmodelQa=1${tuningParam}`;
const report = {
  runId: RUN_ID,
  headless: false,
  target,
  buildId: null,
  screenshots: [],
  weaponSnapshots: [],
  tuningToggleVerified: false,
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
    const url = request.url();
    const failure = request.failure()?.errorText ?? 'request failed';
    if (
      failure === 'net::ERR_ABORTED' &&
      (url.includes('/assets/audio/elevenlabs-foundation/') ||
        url.includes('/assets/characters/meshy-gadget-gremlin/models/player.hero.gadget-gremlin.apose.animated.glb'))
    ) {
      return;
    }
    report.failedRequests.push({ url, failure });
  });

  await page.goto(target, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.game-canvas', { state: 'visible', timeout: 30_000 });
  await waitForTitleReady(page);
  await page.locator('[data-title-start]').click();
  await waitForViewModel(page);
  if (process.env.VIEWMODEL_TUNING === '1') {
    await verifyTunerToggle(page);
  }

  const initial = await readDebugSnapshot(page);
  report.buildId = initial.buildId;

  for (let index = 0; index < WEAPON_COUNT; index++) {
    await delay(250);
    await captureWeapon(page, `weapon-${index + 1}-idle.png`);
    await holdFire(page);
    await captureWeapon(page, `weapon-${index + 1}-held-fire.png`);
    if (index < WEAPON_COUNT - 1) {
      await page.locator('[data-weapon-cycle-button]').click();
      await delay(250);
    }
  }

  const errors = [
    ...report.consoleMessages.map((message) => `console error: ${message.text}`),
    ...report.failedRequests.map((request) => `failed request: ${request.url} ${request.failure}`),
  ];

  for (const snapshot of report.weaponSnapshots) {
    if (!snapshot.playerViewModel.loaded) {
      errors.push(`viewmodel not loaded for ${snapshot.activeWeaponId}`);
    }
    if (snapshot.playerViewModel.assetId !== EXPECTED_VIEWMODEL_ID) {
      errors.push(`unexpected viewmodel asset ${snapshot.playerViewModel.assetId}`);
    }
    if (snapshot.playerViewModel.activeGrip?.weaponId !== snapshot.activeWeaponId) {
      errors.push(`active grip mismatch for ${snapshot.activeWeaponId}`);
    }
    if (snapshot.screenshot.endsWith('-idle.png') && snapshot.playerViewModel.activeGrip?.position?.[1] < -0.8) {
      errors.push(`viewmodel arm hidden after switch for ${snapshot.activeWeaponId}`);
    }
    if (snapshot.assetLoadErrors.length > 0) {
      errors.push(`weapon asset load error for ${snapshot.activeWeaponId}: ${snapshot.assetLoadErrors.join(', ')}`);
    }
  }

  const uniqueWeapons = new Set(report.weaponSnapshots.map((snapshot) => snapshot.activeWeaponId));
  if (uniqueWeapons.size !== WEAPON_COUNT) {
    errors.push(`expected ${WEAPON_COUNT} weapon view captures, found ${uniqueWeapons.size}`);
  }

  report.passed = errors.length === 0;
  await writeReport();

  if (errors.length > 0) {
    throw new Error(`Headed player viewmodel QA failed:\n${errors.join('\n')}`);
  }

  console.log(`Headed player viewmodel QA passed. Artifacts: ${OUTPUT_DIR}`);

  async function captureWeapon(pageInstance, name) {
    const snapshot = await readDebugSnapshot(pageInstance);
    await pageInstance.screenshot({
      path: resolve(OUTPUT_DIR, name),
      fullPage: false,
    });
    report.screenshots.push(name);
    report.weaponSnapshots.push({
      screenshot: name,
      activeWeaponId: snapshot.weapon.activeWeaponId,
      aimBlend: snapshot.weapon.aimBlend,
      rendererMetrics: snapshot.rendererMetrics,
      playerViewModel: snapshot.weapon.playerViewModel,
      assetLoadErrors: snapshot.weapon.assetLoadErrors,
    });
  }
} finally {
  await writeReport();
  if (browser) {
    await browser.close();
  }
  server.kill();
}

async function holdFire(page) {
  const button = page.locator('[data-fire-button]');
  const box = await button.boundingBox();
  if (!box) {
    throw new Error('Missing fire button bounds.');
  }

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await delay(320);
  await page.mouse.up();
  await delay(160);
}

async function waitForTitleReady(page) {
  await page.waitForFunction(
    () => {
      const snapshot = window.__SIGILBREAKER_DEBUG__?.getSnapshot();
      return snapshot?.scene.phase === 'title' && snapshot.ui.loading.ready === true;
    },
    undefined,
    { timeout: 45_000 },
  );
}

async function waitForViewModel(page) {
  await page.waitForFunction(
    (expectedAssetId) => {
      const snapshot = window.__SIGILBREAKER_DEBUG__?.getSnapshot();
      return (
        snapshot?.scene.phase === 'gameplay' &&
        snapshot.weapon.playerViewModel.loaded === true &&
        snapshot.weapon.playerViewModel.assetId === expectedAssetId &&
        snapshot.weapon.playerViewModel.activeGrip !== null &&
        snapshot.weapon.assetLoadErrors.length === 0
      );
    },
    EXPECTED_VIEWMODEL_ID,
    { timeout: 45_000 },
  );
}

async function verifyTunerToggle(page) {
  const toggle = page.locator('.viewmodel-tuner-toggle');
  await toggle.click();
  await page.waitForFunction(
    () => window.__SIGILBREAKER_DEBUG__?.getSnapshot().weapon.playerViewModelTuner.panelVisible === false,
    undefined,
    { timeout: 5000 },
  );
  await toggle.click();
  await page.waitForFunction(
    () => window.__SIGILBREAKER_DEBUG__?.getSnapshot().weapon.playerViewModelTuner.panelVisible === true,
    undefined,
    { timeout: 5000 },
  );
  report.tuningToggleVerified = true;
}

async function readDebugSnapshot(page) {
  const snapshot = await page.evaluate(() => window.__SIGILBREAKER_DEBUG__?.getSnapshot());
  if (!snapshot) {
    throw new Error('Missing window.__SIGILBREAKER_DEBUG__ snapshot.');
  }
  return snapshot;
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

async function writeReport() {
  await writeFile(resolve(OUTPUT_DIR, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
}

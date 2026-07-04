import { expect, test, type Page } from '@playwright/test';

test.setTimeout(180_000);

const FULL_INTERACTION_PROJECT = 'chromium-modern-phone-landscape';
const EXPECTED_LOADED_ASSET_IDS = [
  'audio.music.foundation.elevenlabs',
  'audio.weapon.bore.elevenlabs',
  'audio.weapon.spark.elevenlabs',
  'audio.weapon.vault.elevenlabs',
  'environment.foundation.floor-grid-steel',
  'environment.foundation.roof-flat-steel',
  'environment.foundation.wall-panel-steel',
  'weapon.blaster.bore',
  'weapon.blaster.spark',
  'weapon.blaster.vault',
] as const;

interface DebugSnapshot {
  buildId: string;
  scene: {
    playerPosition: [number, number, number];
  };
  level: {
    id: string;
    widthUnits: number;
    depthUnits: number;
    tileSize: number;
    map: readonly string[];
    streaming: {
      loadedTextureAssetIds: string[];
      assetLoadErrors: string[];
    };
  };
  device: {
    orientation: 'landscape' | 'portrait';
    viewport: {
      width: number;
      height: number;
    };
  };
  rendererMetrics: {
    fps: number;
    calls: number;
    triangles: number;
    geometries: number;
    textures: number;
  };
  memoryMetrics: {
    loadedAssetIds: string[];
    weaponModelBytesLoaded: number;
  };
  assetLoadErrors: string[];
  weapon: {
    activeWeaponId: string;
    activeWeaponLabel: string;
    ammoInMagazine: number;
    magazineSize: number;
    isFireHeld: boolean;
    aimBlend: number;
    cameraFovDegrees: number;
    shotCount: number;
    effectPose: {
      muzzle: [number, number, number];
      tracerEnd: [number, number, number];
      wallImpact: [number, number, number];
    };
    lastShot: {
      blockedByWall: boolean;
      distanceUnits: number;
      tile: [number, number] | null;
    } | null;
    audio: {
      musicMuted: boolean;
      musicPlaying: boolean;
      unlocked: boolean;
      loadedAssetIds: string[];
      assetLoadErrors: string[];
      assetBytesLoaded: number;
    };
  };
  controls: {
    viewportScale: number;
    preventedZoomGestures: number;
    preventedMultiTouchStarts: number;
    preventedMultiTouchMoves: number;
    preventedWheelZooms: number;
    preventedDoubleTaps: number;
    lookActive: boolean;
    movePointerActive: boolean;
    moveVector: [number, number];
  };
  budgets: {
    drawCallsMax: number;
    trianglesMax: number;
    geometriesMax: number;
    texturesMax: number;
  };
}

test('mobile landscape foundation exposes QA metrics and cache-busted weapon assets', async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];

  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error' && !isIgnorableHeadlessThreeShaderValidation(text)) {
      consoleErrors.push(text);
    }
  });

  page.on('requestfailed', (request) => {
    failedRequests.push(`${request.url()} ${request.failure()?.errorText ?? 'request failed'}`);
  });

  await page.goto('/sigil-breaker/?qaCapture=1', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.game-canvas')).toBeVisible();
  await expect(page.locator('[data-debug-coordinates]')).toHaveText(
    /^XYZ -?\d+\.\d -?\d+\.\d -?\d+\.\d$/,
  );

  await page.waitForFunction(() => {
    const snapshot = window.__SIGILBREAKER_DEBUG__?.getSnapshot();

    return (
      snapshot !== undefined &&
      snapshot.assetLoadErrors.length === 0 &&
      snapshot.memoryMetrics.loadedAssetIds.length === 10 &&
      snapshot.rendererMetrics.textures >= 4 &&
      snapshot.memoryMetrics.weaponModelBytesLoaded > 0
    );
  });

  const snapshot = await page.evaluate<DebugSnapshot | undefined>(() => window.__SIGILBREAKER_DEBUG__?.getSnapshot());
  expect(snapshot).toBeDefined();

  const debugSnapshot = snapshot as DebugSnapshot;
  const viewport = page.viewportSize();
  expect(debugSnapshot.buildId).toMatch(/^\d{14}$/);
  expect(debugSnapshot.device.orientation).toBe('landscape');
  expect(debugSnapshot.device.viewport).toMatchObject(viewport ?? {});
  expect(debugSnapshot.level).toMatchObject({
    id: 'foundation-45x45',
    widthUnits: 45,
    depthUnits: 45,
  });
  expect(debugSnapshot.assetLoadErrors).toEqual([]);
  expect(debugSnapshot.memoryMetrics.loadedAssetIds).toEqual([...EXPECTED_LOADED_ASSET_IDS]);
  expect(debugSnapshot.level.streaming.loadedTextureAssetIds).toEqual([
    'environment.foundation.floor-grid-steel',
    'environment.foundation.roof-flat-steel',
    'environment.foundation.wall-panel-steel',
  ]);
  expect(debugSnapshot.level.streaming.assetLoadErrors).toEqual([]);
  expect(debugSnapshot.rendererMetrics.calls).toBeGreaterThan(0);
  expect(debugSnapshot.rendererMetrics.triangles).toBeGreaterThan(0);
  expect(debugSnapshot.rendererMetrics.textures).toBeGreaterThanOrEqual(4);
  expect(debugSnapshot.rendererMetrics.calls).toBeLessThanOrEqual(debugSnapshot.budgets.drawCallsMax);
  expect(debugSnapshot.rendererMetrics.triangles).toBeLessThanOrEqual(debugSnapshot.budgets.trianglesMax);
  expect(debugSnapshot.rendererMetrics.geometries).toBeLessThanOrEqual(debugSnapshot.budgets.geometriesMax);
  expect(debugSnapshot.rendererMetrics.textures).toBeLessThanOrEqual(debugSnapshot.budgets.texturesMax);
  expect(debugSnapshot.weapon.activeWeaponId).toBe('weapon.blaster.spark');
  expect(debugSnapshot.weapon.activeWeaponLabel).toBe('SPARK');
  expect(debugSnapshot.weapon.ammoInMagazine).toBe(debugSnapshot.weapon.magazineSize);
  expect(debugSnapshot.weapon.isFireHeld).toBe(false);
  expect(debugSnapshot.weapon.aimBlend).toBe(0);
  expect(debugSnapshot.weapon.cameraFovDegrees).toBeCloseTo(70);
  expect(debugSnapshot.weapon.audio.loadedAssetIds).toEqual([
    'audio.music.foundation.elevenlabs',
    'audio.weapon.bore.elevenlabs',
    'audio.weapon.spark.elevenlabs',
    'audio.weapon.vault.elevenlabs',
  ]);
  expect(debugSnapshot.weapon.audio.assetLoadErrors).toEqual([]);
  expect(debugSnapshot.weapon.audio.assetBytesLoaded).toBe(439_869);
  expect(debugSnapshot.weapon.audio.musicMuted).toBe(false);
  expect(debugSnapshot.controls.viewportScale).toBe(1);

  const coordinateText = await page.locator('[data-debug-coordinates]').textContent();
  expect(coordinateText).toBe(formatCoordinates(debugSnapshot.scene.playerPosition));
  await expectHudToFit(page);
  await expectControlsToFit(page);
  await expect(page.locator('[data-fire-button]')).not.toHaveText(/F/);
  await expect(page.locator('[data-fire-button] .reticle-icon')).toBeVisible();
  await expect(page.locator('[data-music-toggle] .music-icon')).toBeVisible();
  await expect(page.locator('[data-music-toggle]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('.rotate-prompt')).toBeHidden();
  await expect(page.locator('[data-weapon-cycle-button]')).toHaveCount(0);
  await expectViewportScaleLocked(page);

  await expect.poll(async () => (await page.evaluate(readCanvasSamples)).nonBlankSamples).toBeGreaterThan(0);

  const canvasReadback = await page.evaluate(readCanvasSamples);
  expect(canvasReadback.supported).toBe(true);
  expect(canvasReadback.nonBlankSamples).toBeGreaterThan(0);

  const assetResources = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((url) => url.includes('/assets/weapons/kenney-blaster-kit/'))
      .sort(),
  );
  const previewUrls = assetResources.filter((url) => url.includes('/previews/'));
  const modelUrls = assetResources.filter((url) => url.endsWith('.glb?assetBuild=' + debugSnapshot.buildId));
  const textureUrls = assetResources.filter((url) => url.includes('/Textures/colormap.png'));
  const environmentTextureUrls = await page.evaluate(() =>
    performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((url) => url.includes('/assets/environment/kenney-prototype-textures/textures/'))
      .sort(),
  );

  expect(previewUrls).toHaveLength(3);
  expect(modelUrls).toHaveLength(3);
  expect(textureUrls.length).toBeGreaterThanOrEqual(1);
  expect(environmentTextureUrls).toHaveLength(3);

  const audioUrls = await page.evaluate((buildId) =>
    performance
      .getEntriesByType('resource')
      .map((entry) => entry.name)
      .filter((url) => url.includes('/assets/audio/elevenlabs-foundation/') && url.endsWith('.mp3?assetBuild=' + buildId))
      .sort(),
    debugSnapshot.buildId,
  );
  const audioFileNames = [...new Set(audioUrls.map((url) => new URL(url).pathname.split('/').pop() ?? ''))].sort();
  expect(audioFileNames).toEqual([
    'bore-scatter.mp3',
    'foundation-combat-loop.mp3',
    'spark-sidearm.mp3',
    'vault-heavy.mp3',
  ]);

  for (const url of [...previewUrls, ...modelUrls, ...textureUrls, ...environmentTextureUrls, ...audioUrls]) {
    expect(new URL(url).searchParams.get('assetBuild')).toBe(debugSnapshot.buildId);
  }

  if (testInfo.project.name === FULL_INTERACTION_PROJECT) {
    await verifyRestartLoopDoesNotGrowRendererMetrics(page, debugSnapshot);
  }

  const preShotSnapshot = await readDebugSnapshot(page);
  const isFullInteractionProject = testInfo.project.name === FULL_INTERACTION_PROJECT;
  const expectedShotCountFloor = isFullInteractionProject
    ? preShotSnapshot.weapon.shotCount + 1
    : preShotSnapshot.weapon.shotCount;
  const shotSnapshot = await holdFireButtonUntilShotCount(page, expectedShotCountFloor);
  expect(shotSnapshot.weapon.shotCount).toBeGreaterThan(preShotSnapshot.weapon.shotCount);
  expect(shotSnapshot.weapon.ammoInMagazine).toBeLessThan(preShotSnapshot.weapon.ammoInMagazine);
  expect(shotSnapshot.weapon.isFireHeld).toBe(true);

  if (isFullInteractionProject) {
    expect(shotSnapshot.weapon.shotCount).toBeGreaterThan(preShotSnapshot.weapon.shotCount + 1);
    expect(shotSnapshot.weapon.aimBlend).toBeGreaterThan(0.75);
    expect(shotSnapshot.weapon.cameraFovDegrees).toBeLessThan(preShotSnapshot.weapon.cameraFovDegrees);
    expect(Math.abs(shotSnapshot.weapon.effectPose.muzzle[0])).toBeLessThan(0.16);
    expect(shotSnapshot.weapon.effectPose.muzzle[0]).toBeLessThan(preShotSnapshot.weapon.effectPose.muzzle[0]);
    expect(shotSnapshot.weapon.effectPose.muzzle[2]).toBeLessThan(-1);
    expect(shotSnapshot.weapon.effectPose.tracerEnd[0]).toBe(0);
    expect(shotSnapshot.weapon.effectPose.tracerEnd[1]).toBe(0);
    expect(shotSnapshot.weapon.effectPose.tracerEnd[2]).toBeLessThan(shotSnapshot.weapon.effectPose.muzzle[2]);
    if (shotSnapshot.weapon.lastShot?.blockedByWall) {
      expect(shotSnapshot.weapon.effectPose.wallImpact[2]).toBeCloseTo(
        -shotSnapshot.weapon.lastShot.distanceUnits + 0.04,
        1,
      );
    }
  }
  await expect.poll(async () => (await readDebugSnapshot(page)).weapon.isFireHeld).toBe(false);
  const releasedShotCount = (await readDebugSnapshot(page)).weapon.shotCount;
  await page.waitForTimeout(220);
  expect((await readDebugSnapshot(page)).weapon.shotCount).toBe(releasedShotCount);

  await page.locator('[data-music-toggle]').click();
  await expect.poll(async () => (await readDebugSnapshot(page)).weapon.audio.musicMuted).toBe(true);
  await expect(page.locator('[data-music-toggle]')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('[data-music-toggle]').click();
  await expect.poll(async () => (await readDebugSnapshot(page)).weapon.audio.musicMuted).toBe(false);

  if (testInfo.project.name !== FULL_INTERACTION_PROJECT) {
    expect(consoleErrors).toEqual([]);
    expect(failedRequests).toEqual([]);
    return;
  }

  await page.locator('.game-canvas').click({ position: { x: 12, y: 12 } });
  await driveUntil(page, 'KeyA', (routeSnapshot) => routeSnapshot.scene.playerPosition[2] < -21.15, 2500);
  const wallPushStart = await readDebugSnapshot(page);
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(350);
  await page.keyboard.up('KeyA');
  const wallPushEnd = await readDebugSnapshot(page);
  expectPlayerFootprintClear(wallPushEnd);
  expect(wallPushEnd.scene.playerPosition[2]).toBeLessThan(-21.1);
  expect(wallPushEnd.scene.playerPosition[2]).toBeGreaterThanOrEqual(wallPushStart.scene.playerPosition[2] - 0.05);

  await driveUntil(page, 'KeyD', (routeSnapshot) => routeSnapshot.scene.playerPosition[2] > -20.6, 2500);
  await driveUntil(page, 'KeyW', (routeSnapshot) => routeSnapshot.scene.playerPosition[0] > -19.8, 6000);
  const routeSnapshot = await readDebugSnapshot(page);
  expectPlayerFootprintClear(routeSnapshot);
  expect(routeSnapshot.scene.playerPosition[0]).toBeGreaterThan(-19.8);
  expect(routeSnapshot.scene.playerPosition[2]).toBeGreaterThan(-20.6);
  await verifyZoomGesturesAreBlocked(page);
  await verifyPortraitRotatePrompt(page);

  expect(consoleErrors).toEqual([]);
  expect(failedRequests).toEqual([]);
});

function formatCoordinates(position: readonly [number, number, number]): string {
  return `XYZ ${position[0].toFixed(1)} ${position[1].toFixed(1)} ${position[2].toFixed(1)}`;
}

function readCanvasSamples(): { supported: boolean; nonBlankSamples: number } {
  const canvas = document.querySelector('.game-canvas');
  const gl = canvas instanceof HTMLCanvasElement ? canvas.getContext('webgl2') ?? canvas.getContext('webgl') : null;

  if (!gl) {
    return { supported: false, nonBlankSamples: 0 };
  }

  const samplePoints = [
    [1, 1],
    [Math.floor(gl.drawingBufferWidth / 2), Math.floor(gl.drawingBufferHeight / 2)],
    [Math.floor(gl.drawingBufferWidth / 2), Math.floor(gl.drawingBufferHeight * 0.8)],
  ] as const;
  const pixel = new Uint8Array(4);
  let nonBlankSamples = 0;

  for (const [x, y] of samplePoints) {
    gl.readPixels(x, y, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);
    if (pixel[0] > 0 || pixel[1] > 0 || pixel[2] > 0) {
      nonBlankSamples++;
    }
  }

  return { supported: true, nonBlankSamples };
}

async function readDebugSnapshot(page: Page): Promise<DebugSnapshot> {
  const snapshot = await page.evaluate<DebugSnapshot | undefined>(() => window.__SIGILBREAKER_DEBUG__?.getSnapshot());
  expect(snapshot).toBeDefined();
  return snapshot as DebugSnapshot;
}

async function verifyRestartLoopDoesNotGrowRendererMetrics(page: Page, baseline: DebugSnapshot): Promise<void> {
  for (let index = 0; index < 5; index++) {
    await page.evaluate(() => {
      if (!window.__SIGILBREAKER_RESTART__) {
        throw new Error('Missing QA restart hook.');
      }

      window.__SIGILBREAKER_RESTART__();
    });
    await waitForSceneAssets(page);
    const snapshot = await readDebugSnapshot(page);

    expect(snapshot.assetLoadErrors).toEqual([]);
    expect(snapshot.memoryMetrics.loadedAssetIds).toEqual(baseline.memoryMetrics.loadedAssetIds);
    expect(snapshot.rendererMetrics.calls).toBeLessThanOrEqual(snapshot.budgets.drawCallsMax);
    expect(snapshot.rendererMetrics.triangles).toBeLessThanOrEqual(snapshot.budgets.trianglesMax);
    expect(snapshot.rendererMetrics.geometries).toBeLessThanOrEqual(snapshot.budgets.geometriesMax);
    expect(snapshot.rendererMetrics.textures).toBeLessThanOrEqual(snapshot.budgets.texturesMax);
  }
}

async function waitForSceneAssets(page: Page): Promise<void> {
  await page.waitForFunction((expectedAssetCount) => {
    const snapshot = window.__SIGILBREAKER_DEBUG__?.getSnapshot();

    return (
      snapshot !== undefined &&
      snapshot.assetLoadErrors.length === 0 &&
      snapshot.memoryMetrics.loadedAssetIds.length === expectedAssetCount &&
      snapshot.memoryMetrics.weaponModelBytesLoaded > 0 &&
      snapshot.rendererMetrics.geometries > 0 &&
      snapshot.rendererMetrics.textures >= 4
    );
  }, EXPECTED_LOADED_ASSET_IDS.length);
}

async function verifyPortraitRotatePrompt(page: Page): Promise<void> {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.rotate-prompt')).toBeVisible();
  const promptFit = await page.evaluate(() => {
    const prompt = document.querySelector<HTMLElement>('.rotate-prompt');
    const icon = document.querySelector<HTMLElement>('.rotate-prompt__icon');
    const label = document.querySelector<HTMLElement>('.rotate-prompt__label');

    if (!prompt || !icon || !label) {
      return {
        present: false,
        coversViewport: false,
        iconVisible: false,
        labelFits: false,
      };
    }

    const promptRect = prompt.getBoundingClientRect();
    const iconRect = icon.getBoundingClientRect();

    return {
      present: true,
      coversViewport:
        promptRect.left <= 0 &&
        promptRect.top <= 0 &&
        promptRect.right >= window.innerWidth &&
        promptRect.bottom >= window.innerHeight,
      iconVisible: iconRect.width >= 100 && iconRect.height >= 80,
      labelFits: label.scrollWidth <= label.clientWidth + 1 && label.scrollHeight <= label.clientHeight + 1,
    };
  });

  expect(promptFit.present).toBe(true);
  expect(promptFit.coversViewport).toBe(true);
  expect(promptFit.iconVisible).toBe(true);
  expect(promptFit.labelFits).toBe(true);

  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.locator('.rotate-prompt')).toBeHidden();
}

async function holdFireButtonUntilShotCount(page: Page, expectedShotCountFloor: number): Promise<DebugSnapshot> {
  const point = await readElementCenter(page, '[data-fire-button]');
  let snapshot: DebugSnapshot | null = null;

  try {
    await page.mouse.move(point.x, point.y);
    await page.mouse.down();
    await expect
      .poll(
        async () => {
          snapshot = await readDebugSnapshot(page);
          return snapshot.weapon.shotCount;
        },
        { timeout: 3000, intervals: [50, 80, 100] },
      )
      .toBeGreaterThan(expectedShotCountFloor);
    snapshot = await readDebugSnapshot(page);
  } finally {
    await page.mouse.up();
  }

  expect(snapshot).not.toBeNull();
  return snapshot as DebugSnapshot;
}

async function verifyZoomGesturesAreBlocked(page: Page): Promise<void> {
  const start = await readDebugSnapshot(page);

  await simulateDoubleTap(page);
  await expect
    .poll(async () => (await readDebugSnapshot(page)).controls.preventedDoubleTaps)
    .toBeGreaterThan(start.controls.preventedDoubleTaps);
  await expectViewportScaleLocked(page);

  const afterDoubleTap = await readDebugSnapshot(page);
  await simulatePinch(page);
  await expect
    .poll(async () => (await readDebugSnapshot(page)).controls.preventedMultiTouchStarts)
    .toBeGreaterThan(afterDoubleTap.controls.preventedMultiTouchStarts);
  await expect
    .poll(async () => (await readDebugSnapshot(page)).controls.preventedMultiTouchMoves)
    .toBeGreaterThan(afterDoubleTap.controls.preventedMultiTouchMoves);
  await expectViewportScaleLocked(page);

  const afterPinch = await readDebugSnapshot(page);
  const gestureResult = await dispatchSyntheticWebKitGesture(page);
  expect(gestureResult.every((eventResult) => eventResult.defaultPrevented)).toBe(true);
  await expect
    .poll(async () => (await readDebugSnapshot(page)).controls.preventedZoomGestures)
    .toBeGreaterThanOrEqual(afterPinch.controls.preventedZoomGestures + 3);
  await expectViewportScaleLocked(page);

  const afterGesture = await readDebugSnapshot(page);
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -320);
  await page.keyboard.up('Control');
  await expect
    .poll(async () => (await readDebugSnapshot(page)).controls.preventedWheelZooms)
    .toBeGreaterThan(afterGesture.controls.preventedWheelZooms);
  await expectViewportScaleLocked(page);

  await verifySimultaneousMoveAimFire(page);
  await expectViewportScaleLocked(page);
}

async function simulateDoubleTap(page: Page): Promise<void> {
  const point = await readGesturePoint(page);
  const client = await page.context().newCDPSession(page);

  try {
    for (const id of [21, 22]) {
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchStart',
        touchPoints: [{ x: point.x, y: point.y, radiusX: 4, radiusY: 4, id }],
      });
      await client.send('Input.dispatchTouchEvent', {
        type: 'touchEnd',
        touchPoints: [],
      });
      await page.waitForTimeout(80);
    }
  } finally {
    await client.detach();
  }

  await page.mouse.dblclick(point.x, point.y);
}

async function simulatePinch(page: Page): Promise<void> {
  const point = await readGesturePoint(page);
  const client = await page.context().newCDPSession(page);

  try {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: point.x - 18, y: point.y, radiusX: 4, radiusY: 4, id: 1 },
        { x: point.x + 18, y: point.y, radiusX: 4, radiusY: 4, id: 2 },
      ],
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: point.x - 46, y: point.y, radiusX: 4, radiusY: 4, id: 1 },
        { x: point.x + 46, y: point.y, radiusX: 4, radiusY: 4, id: 2 },
      ],
    });
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
  } finally {
    await client.detach();
  }
}

async function dispatchSyntheticWebKitGesture(
  page: Page,
): Promise<Array<{ type: string; defaultPrevented: boolean; dispatchResult: boolean }>> {
  return page.evaluate(() =>
    ['gesturestart', 'gesturechange', 'gestureend'].map((type) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      const dispatchResult = window.dispatchEvent(event);

      return {
        type,
        defaultPrevented: event.defaultPrevented,
        dispatchResult,
      };
    }),
  );
}

async function verifySimultaneousMoveAimFire(page: Page): Promise<void> {
  const start = await readDebugSnapshot(page);
  const points = await readCombatTouchPoints(page);
  const client = await page.context().newCDPSession(page);

  try {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: points.stick.x, y: points.stick.y, radiusX: 4, radiusY: 4, id: 11 },
        { x: points.look.x, y: points.look.y, radiusX: 4, radiusY: 4, id: 12 },
      ],
    });
    await expect.poll(async () => (await readDebugSnapshot(page)).controls.movePointerActive).toBe(true);
    await expect.poll(async () => (await readDebugSnapshot(page)).controls.lookActive).toBe(true);

    await client.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [
        { x: points.stick.x + 30, y: points.stick.y, radiusX: 4, radiusY: 4, id: 11 },
        { x: points.look.x + 36, y: points.look.y, radiusX: 4, radiusY: 4, id: 12 },
      ],
    });
    await expect
      .poll(async () => Math.hypot(...(await readDebugSnapshot(page)).controls.moveVector))
      .toBeGreaterThan(0.2);

    await client.send('Input.dispatchTouchEvent', {
      type: 'touchStart',
      touchPoints: [
        { x: points.stick.x + 30, y: points.stick.y, radiusX: 4, radiusY: 4, id: 11 },
        { x: points.look.x + 36, y: points.look.y, radiusX: 4, radiusY: 4, id: 12 },
        { x: points.fire.x, y: points.fire.y, radiusX: 4, radiusY: 4, id: 13 },
      ],
    });

    await expect
      .poll(async () => (await readDebugSnapshot(page)).weapon.shotCount)
      .toBeGreaterThan(start.weapon.shotCount);
    const activeSnapshot = await readDebugSnapshot(page);
    expect(activeSnapshot.controls.movePointerActive).toBe(true);
    expect(activeSnapshot.controls.lookActive).toBe(true);
    expect(activeSnapshot.weapon.isFireHeld).toBe(true);
    expect(activeSnapshot.weapon.aimBlend).toBeGreaterThan(0.2);
    expect(activeSnapshot.weapon.cameraFovDegrees).toBeLessThan(start.weapon.cameraFovDegrees);
    expect(Math.hypot(...activeSnapshot.controls.moveVector)).toBeGreaterThan(0.2);
  } finally {
    await client.send('Input.dispatchTouchEvent', {
      type: 'touchEnd',
      touchPoints: [],
    });
    await client.detach();
  }

  await expect.poll(async () => (await readDebugSnapshot(page)).weapon.isFireHeld).toBe(false);
  await expect.poll(async () => (await readDebugSnapshot(page)).controls.lookActive).toBe(false);
}

async function readGesturePoint(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => ({
    x: Math.round(window.innerWidth * 0.66),
    y: Math.round(window.innerHeight * 0.54),
  }));
}

async function readCombatTouchPoints(page: Page): Promise<{
  stick: { x: number; y: number };
  look: { x: number; y: number };
  fire: { x: number; y: number };
}> {
  return page.evaluate(() => {
    const stick = document.querySelector('[data-move-stick]')?.getBoundingClientRect();
    const fire = document.querySelector('[data-fire-button]')?.getBoundingClientRect();

    if (!stick || !fire) {
      throw new Error('Missing combat touch controls.');
    }

    return {
      stick: {
        x: Math.round(stick.left + stick.width / 2),
        y: Math.round(stick.top + stick.height / 2),
      },
      look: {
        x: Math.round(window.innerWidth * 0.66),
        y: Math.round(window.innerHeight * 0.42),
      },
      fire: {
        x: Math.round(fire.left + fire.width / 2),
        y: Math.round(fire.top + fire.height / 2),
      },
    };
  });
}

async function readElementCenter(page: Page, selector: string): Promise<{ x: number; y: number }> {
  return page.evaluate((targetSelector) => {
    const rect = document.querySelector(targetSelector)?.getBoundingClientRect();

    if (!rect) {
      throw new Error(`Missing element ${targetSelector}.`);
    }

    return {
      x: Math.round(rect.left + rect.width / 2),
      y: Math.round(rect.top + rect.height / 2),
    };
  }, selector);
}

async function expectViewportScaleLocked(page: Page): Promise<void> {
  await expect.poll(async () => page.evaluate(() => window.visualViewport?.scale ?? 1)).toBeCloseTo(1, 2);
  const snapshot = await readDebugSnapshot(page);
  expect(snapshot.controls.viewportScale).toBe(1);
}

async function driveUntil(
  page: Page,
  key: string,
  isDone: (snapshot: DebugSnapshot) => boolean,
  timeout: number,
): Promise<void> {
  await page.keyboard.down(key);
  try {
    await expect
      .poll(
        async () => {
          const snapshot = await readDebugSnapshot(page);
          expectPlayerFootprintClear(snapshot);
          return isDone(snapshot);
        },
        { timeout, intervals: [100] },
      )
      .toBe(true);
  } finally {
    await page.keyboard.up(key);
  }
}

function expectPlayerFootprintClear(snapshot: DebugSnapshot): void {
  const [x, , z] = snapshot.scene.playerPosition;
  const radius = 0.28;
  const samples = [
    [x - radius, z - radius],
    [x + radius, z - radius],
    [x - radius, z + radius],
    [x + radius, z + radius],
    [x, z - radius],
    [x, z + radius],
    [x - radius, z],
    [x + radius, z],
  ] as const;

  expect(samples.filter(([sampleX, sampleZ]) => isSolidAtSnapshotWorld(snapshot, sampleX, sampleZ))).toEqual([]);
}

function isSolidAtSnapshotWorld(snapshot: DebugSnapshot, worldX: number, worldZ: number): boolean {
  const column = Math.floor((worldX + snapshot.level.widthUnits / 2) / snapshot.level.tileSize);
  const row = Math.floor((worldZ + snapshot.level.depthUnits / 2) / snapshot.level.tileSize);

  if (row < 0 || row >= snapshot.level.map.length || column < 0 || column >= snapshot.level.map[row].length) {
    return true;
  }

  const symbol = snapshot.level.map[row][column];
  return symbol === '#' || symbol === 'C';
}

function isIgnorableHeadlessThreeShaderValidation(message: string): boolean {
  return (
    message.includes('THREE.WebGLProgram: Shader Error') &&
    message.includes('VALIDATE_STATUS false') &&
    message.trim().endsWith('Program Info Log:')
  );
}

async function expectHudToFit(page: Page): Promise<void> {
  const hudFit = await page.evaluate(() => {
    const leftElement = document.querySelector('.hud__left');
    const centerElement = document.querySelector('.hud__center');
    const rightElement = document.querySelector('.hud__right');
    const badges = [...document.querySelectorAll<HTMLElement>('.hud__badge')];

    if (!leftElement || !centerElement || !rightElement) {
      return {
        groupsPresent: false,
        leftCenterGap: Number.NEGATIVE_INFINITY,
        centerRightGap: Number.NEGATIVE_INFINITY,
        groupsWithinViewport: false,
        overflowingBadges: [],
      };
    }

    const left = leftElement.getBoundingClientRect();
    const center = centerElement.getBoundingClientRect();
    const right = rightElement.getBoundingClientRect();

    return {
      groupsPresent: true,
      leftCenterGap: center.left - left.right,
      centerRightGap: right.left - center.right,
      groupsWithinViewport:
        left.left >= 0 &&
        center.left >= 0 &&
        right.left >= 0 &&
        left.right <= window.innerWidth &&
        center.right <= window.innerWidth &&
        right.right <= window.innerWidth,
      overflowingBadges: badges
        .filter((badge) => badge.scrollWidth > badge.clientWidth + 1 || badge.scrollHeight > badge.clientHeight + 1)
        .map((badge) => badge.textContent?.trim() ?? badge.className),
    };
  });

  expect(hudFit.groupsPresent).toBe(true);
  expect(hudFit.leftCenterGap).toBeGreaterThanOrEqual(0);
  expect(hudFit.centerRightGap).toBeGreaterThanOrEqual(0);
  expect(hudFit.groupsWithinViewport).toBe(true);
  expect(hudFit.overflowingBadges).toEqual([]);
}

async function expectControlsToFit(page: Page): Promise<void> {
  const controlFit = await page.evaluate(() => {
    const selectors = {
      stick: '[data-move-stick]',
      fire: '[data-fire-button]',
    } as const;
    const rects = Object.fromEntries(
      Object.entries(selectors).map(([key, selector]) => {
        const rect = document.querySelector(selector)?.getBoundingClientRect();

        return [
          key,
          rect
            ? {
                left: rect.left,
                top: rect.top,
                right: rect.right,
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height,
              }
            : null,
        ];
      }),
    ) as Record<keyof typeof selectors, DOMRectLike | null>;

    const allPresent = Object.values(rects).every((rect) => rect !== null);
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const withinViewport = Object.values(rects).every(
      (rect) =>
        rect !== null &&
        rect.left >= 0 &&
        rect.top >= 0 &&
        rect.right <= viewport.width &&
        rect.bottom <= viewport.height,
    );
    const undersizedTargets = Object.entries(rects)
      .filter(([, rect]) => rect === null || rect.width < 44 || rect.height < 44)
      .map(([key]) => key);

    return {
      allPresent,
      withinViewport,
      undersizedTargets,
      stickOverlapsFire: rects.stick !== null && rects.fire !== null && rectsOverlap(rects.stick, rects.fire),
    };

    function rectsOverlap(first: DOMRectLike, second: DOMRectLike): boolean {
      return first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top;
    }
  });

  expect(controlFit.allPresent).toBe(true);
  expect(controlFit.withinViewport).toBe(true);
  expect(controlFit.undersizedTargets).toEqual([]);
  expect(controlFit.stickOverlapsFire).toBe(false);
}

interface DOMRectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

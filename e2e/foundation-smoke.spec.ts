import { expect, test, type Page } from '@playwright/test';

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
  };
}

test('mobile landscape foundation exposes QA metrics and cache-busted weapon assets', async ({ page }) => {
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

  await page.goto('/sigil-breaker/?qaCapture=1', { waitUntil: 'networkidle' });
  await expect(page.locator('.game-canvas')).toBeVisible();
  await expect(page.locator('[data-debug-coordinates]')).toHaveText(
    /^XYZ -?\d+\.\d -?\d+\.\d -?\d+\.\d$/,
  );

  await page.waitForFunction(() => {
    const snapshot = window.__SIGILBREAKER_DEBUG__?.getSnapshot();

    return (
      snapshot !== undefined &&
      snapshot.assetLoadErrors.length === 0 &&
      snapshot.memoryMetrics.loadedAssetIds.length === 3 &&
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
  expect(debugSnapshot.memoryMetrics.loadedAssetIds).toEqual([
    'weapon.blaster.bore',
    'weapon.blaster.spark',
    'weapon.blaster.vault',
  ]);
  expect(debugSnapshot.rendererMetrics.calls).toBeGreaterThan(0);
  expect(debugSnapshot.rendererMetrics.triangles).toBeGreaterThan(0);
  expect(debugSnapshot.weapon.activeWeaponId).toBe('weapon.blaster.spark');
  expect(debugSnapshot.weapon.activeWeaponLabel).toBe('SPARK');
  expect(debugSnapshot.weapon.ammoInMagazine).toBe(debugSnapshot.weapon.magazineSize);

  const coordinateText = await page.locator('[data-debug-coordinates]').textContent();
  expect(coordinateText).toBe(formatCoordinates(debugSnapshot.scene.playerPosition));
  await expectHudToFit(page);

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

  expect(previewUrls).toHaveLength(3);
  expect(modelUrls).toHaveLength(3);
  expect(textureUrls.length).toBeGreaterThanOrEqual(1);

  for (const url of [...previewUrls, ...modelUrls, ...textureUrls]) {
    expect(new URL(url).searchParams.get('assetBuild')).toBe(debugSnapshot.buildId);
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
  await driveUntil(page, 'KeyW', (routeSnapshot) => routeSnapshot.scene.playerPosition[0] > -19.8, 3000);
  const routeSnapshot = await readDebugSnapshot(page);
  expectPlayerFootprintClear(routeSnapshot);
  expect(routeSnapshot.scene.playerPosition[0]).toBeGreaterThan(-19.8);
  expect(routeSnapshot.scene.playerPosition[2]).toBeGreaterThan(-20.6);

  await page.locator('[data-fire-button]').click();
  await expect
    .poll(async () => (await page.evaluate(() => window.__SIGILBREAKER_DEBUG__?.getSnapshot().weapon.shotCount)) ?? 0)
    .toBeGreaterThan(debugSnapshot.weapon.shotCount);
  const shotSnapshot = (await page.evaluate<DebugSnapshot | undefined>(
    () => window.__SIGILBREAKER_DEBUG__?.getSnapshot(),
  )) as DebugSnapshot;
  expect(shotSnapshot.weapon.ammoInMagazine).toBe(debugSnapshot.weapon.ammoInMagazine - 1);
  expect(shotSnapshot.weapon.effectPose.muzzle[0]).toBeGreaterThan(0.5);
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

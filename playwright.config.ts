import { defineConfig } from '@playwright/test';

const env = readEnvironment();
const isCi = env.CI === 'true';
const configuredWorkers = Number.parseInt(env.PLAYWRIGHT_WORKERS ?? '2', 10);
const workerCount = Number.isFinite(configuredWorkers) && configuredWorkers > 0 ? configuredWorkers : 2;
const keepHeavyArtifacts = env.PLAYWRIGHT_HEAVY_ARTIFACTS === '1';

export default defineConfig({
  testDir: './e2e',
  workers: workerCount,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: isCi && !keepHeavyArtifacts ? 'off' : 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: keepHeavyArtifacts ? 'retain-on-failure' : 'off',
  },
  webServer: {
    command: 'npm run preview:pages',
    url: 'http://127.0.0.1:4173/sigil-breaker/',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  projects: [
    ...[
      { name: 'small-phone-landscape', width: 667, height: 375 },
      { name: 'wide-phone-landscape', width: 740, height: 360 },
      { name: 'modern-phone-landscape', width: 844, height: 390 },
      { name: 'large-phone-landscape', width: 932, height: 430 },
      { name: 'tablet-landscape', width: 1024, height: 768 },
    ].map((viewport) => ({
      name: `chromium-${viewport.name}`,
      use: {
        browserName: 'chromium' as const,
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: viewport.width >= 1024 ? 2 : 3,
        isMobile: viewport.width < 1024,
        hasTouch: true,
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 ' +
          '(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
      },
    })),
  ],
});

function readEnvironment(): Record<string, string | undefined> {
  const globalWithProcess = globalThis as typeof globalThis & {
    process?: {
      env?: Record<string, string | undefined>;
    };
  };

  return globalWithProcess.process?.env ?? {};
}

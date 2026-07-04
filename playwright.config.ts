import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  workers: 1,
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
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

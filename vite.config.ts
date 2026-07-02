import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';

const buildId = createBuildId();

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/sigil-breaker/' : './',
  define: {
    __SIGILBREAKER_BUILD_ID__: JSON.stringify(command === 'build' ? buildId : 'dev'),
  },
  plugins: command === 'build' ? [versionManifestPlugin(buildId)] : [],
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
  },
}));

function createBuildId(): string {
  return new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
}

function versionManifestPlugin(id: string): Plugin {
  return {
    name: 'sigilbreaker-version-manifest',
    generateBundle(): void {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: JSON.stringify(
          {
            buildId: id,
            builtAt: new Date().toISOString(),
          },
          undefined,
          2,
        ),
      });
    },
  };
}

import { defineConfig } from 'vitest/config';

export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/sigil-breaker/' : './',
  test: {
    environment: 'node',
    include: ['src/tests/**/*.test.ts'],
  },
}));

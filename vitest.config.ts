import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The solver tests are pure logic with no CSS. Without an explicit empty
  // postcss config here, Vitest discovers the app's Tailwind postcss.config.mjs
  // and fails trying to load it.
  css: { postcss: { plugins: [] } },
  test: {
    include: ['lib/**/*.test.ts', 'app/**/*.test.ts'],
  },
});

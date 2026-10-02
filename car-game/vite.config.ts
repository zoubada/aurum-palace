import { cpSync, existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';

/**
 * Game data files (car models, circuit tiles) live in /assets and are fetched at run time by
 * relative URL (assets/…). The dev server serves them from the project root; the build copies
 * them next to the game.
 */
function copyGameAssets(): Plugin {
  return {
    name: 'copy-game-assets',
    apply: 'build',
    closeBundle() {
      for (const dir of ['tracks', 'cars']) {
        if (existsSync(`assets/${dir}`)) cpSync(`assets/${dir}`, `dist/assets/${dir}`, { recursive: true, filter: (src) => !/\.gitkeep$|README\.md$/.test(src) });
      }
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [copyGameAssets()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Whole-lap simulations take a few seconds each (more on a busy machine).
    testTimeout: 120000,
  },
});

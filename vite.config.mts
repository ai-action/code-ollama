import { chmod } from 'node:fs/promises';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  build: {
    target: 'node24',
    lib: {
      entry: 'src/cli.tsx',
      formats: ['es'],
      fileName: 'cli',
    },
    rollupOptions: {
      external: ['cac', 'ink', 'react'],
    },
  },

  plugins: [
    {
      name: 'chmod-bin',
      closeBundle: async () => {
        await chmod('dist/cli.js', 0o755);
      },
    },
  ],

  test: {
    globals: true,
    exclude: ['dist/**', 'node_modules/**'],
    coverage: {
      include: ['src'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
      thresholds: {
        100: true,
      },
    },
  },
});

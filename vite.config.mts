import { chmod } from 'node:fs/promises';
import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },

  build: {
    target: 'node24',
    ssr: 'src/cli.ts',
    rolldownOptions: {
      output: {
        entryFileNames: 'cli.js',
      },
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
    unstubGlobals: true,
    coverage: {
      include: ['src'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/**/index.ts',
        'src/types/',
      ],
      thresholds: {
        100: true,
      },
    },
  },
});

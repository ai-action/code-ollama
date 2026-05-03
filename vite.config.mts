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
    rolldownOptions: {
      external: [
        '@inkjs/ui',
        'cac',
        'ink',
        'node:fs',
        'node:os',
        'node:path',
        'ollama',
        'react',
      ],
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
    coverage: {
      include: ['src'],
      exclude: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'src/**/index.ts'],
      thresholds: {
        100: true,
      },
    },
  },
});

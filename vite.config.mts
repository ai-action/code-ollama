import { chmod } from 'node:fs/promises';
import { resolve } from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@modelcontextprotocol/sdk/client/stdio':
        '@modelcontextprotocol/sdk/client/stdio.js',
      '@modelcontextprotocol/sdk/client/streamableHttp':
        '@modelcontextprotocol/sdk/client/streamableHttp.js',
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
    retry: process.env.CI === 'true' ? 2 : 0,
    coverage: {
      include: ['src'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/*.test.tsx',
        'src/**/types.ts',
        'src/**/index.ts',
        'src/components/ModelManager/test-utils.tsx',
        'src/types/',
      ],
      thresholds: {
        100: true,
      },
    },
  },
});

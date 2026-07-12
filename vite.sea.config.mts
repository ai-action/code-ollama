import { defineConfig } from 'vite';

import { alias } from './vite.config.mts';

export default defineConfig({
  resolve: {
    alias,
  },

  ssr: {
    noExternal: true,
  },

  build: {
    emptyOutDir: true,
    outDir: 'dist/sea',
    ssr: 'src/cli.ts',
    target: 'node25',
    rolldownOptions: {
      external: ['@napi-rs/keyring'],
      output: {
        codeSplitting: false,
        entryFileNames: 'cli.js',
        format: 'esm',
      },
    },
  },
});

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  publicDir: false,
  build: {
    emptyOutDir: false,
    outDir: 'dist',
    rollupOptions: {
      input: resolve(root, 'src/content/index.ts'),
      output: {
        format: 'iife',
        name: 'unusedGitLabPipelinePrefill',
        extend: true,
        entryFileNames: 'gitlab-pipeline-prefill-content.js',
        inlineDynamicImports: true,
      },
    },
  },
});

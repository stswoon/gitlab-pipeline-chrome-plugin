import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from '@rsbuild/core'
import { pluginReact } from '@rsbuild/plugin-react'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [pluginReact()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
    },
  },
  dev: {
    writeToDisk: true,
    hmr: false,
    liveReload: false,
  },
  server: {
    publicDir: {
      copyOnBuild: false,
    },
  },
  environments: {
    popup: {
      source: {
        entry: {
          index: './src/popup/main.tsx',
        },
      },
      html: {
        template: './index.html',
      },
      output: {
        target: 'web',
        filenameHash: false,
        assetPrefix: './',
        cleanDistPath: {
          enable: true,
          keep: [/gitlab-pipeline-prefill-chrome-plugin-content\.js$/],
        },
        copy: [
          { from: 'public' },
          { from: 'manifest.json', to: 'manifest.json' },
        ],
      },
      performance: {
        chunkSplit: {
          strategy: 'all-in-one',
        },
      },
    },
    content: {
      source: {
        entry: {
          content: {
            import: './src/content/index.ts',
            html: false,
          },
        },
      },
      output: {
        target: 'web',
        filenameHash: false,
        filename: {
          js: 'gitlab-pipeline-prefill-chrome-plugin-content.js',
        },
        distPath: {
          js: '',
        },
        cleanDistPath: false,
      },
      performance: {
        chunkSplit: {
          strategy: 'all-in-one',
        },
      },
    },
  },
})

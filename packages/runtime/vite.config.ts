import { readFile } from 'node:fs/promises';
import {
  dirname,
  join,
} from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const taffyWasmGluePath = fileURLToPath(import.meta.resolve('taffy-layout/wasm'));
const taffyWasmBinaryPath = join(dirname(taffyWasmGluePath), 'taffy_wasm_bg.wasm');

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: {
        'host/index': 'src/host/index.ts',
        'index': 'src/index.ts',
      },
      formats: [
        'es',
      ],
    },
    minify: false,
    outDir: 'lib',
    rollupOptions: {
      external: [
        '@bsgames/cue-style-schema',
        '@cyclonium/core/framework',
        '@cyclonium/core/legacy-decorator',
        '@vue/runtime-core',
        'cc',
        'cc/env',
        'taffy-layout/wasm',
        /\?wasm-binary$/,
      ],
      output: {
        entryFileNames: '[name].js',
        preserveModules: true,
        preserveModulesRoot: 'src',
      },
    },
    sourcemap: true,
  },
  plugins: [
    {
      apply: 'build',
      name: 'cue:emit-taffy-wasm',
      async buildStart() {
        this.emitFile({
          fileName: 'render/taffy_wasm_bg.wasm',
          source: await readFile(taffyWasmBinaryPath),
          type: 'asset',
        });
      },
    },
  ],
});

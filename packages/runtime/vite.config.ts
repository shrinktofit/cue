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
      apply: 'serve',
      load(id) {
        if (id !== '\0cue:taffy-wasm-binary') {
          return undefined;
        }
        return [
          'import { readFileSync } from \'node:fs\';',
          `export default readFileSync(${JSON.stringify(taffyWasmBinaryPath)});`,
        ].join('\n');
      },
      name: 'cue:load-taffy-wasm-for-tests',
      resolveId(id) {
        return id.endsWith('taffy_wasm_bg.wasm?wasm-binary')
          ? '\0cue:taffy-wasm-binary'
          : undefined;
      },
    },
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

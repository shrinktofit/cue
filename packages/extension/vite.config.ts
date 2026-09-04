import { builtinModules } from 'node:module';

import useEditorModules from '@cyclonium/cc-extension-utils/vite-plugins/use-editor-modules';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    emptyOutDir: true,
    lib: {
      entry: {
        hooks: './src/hooks.ts',
        main: './src/main.ts',
      },
      fileName: (_format, entryName) => `${entryName}.cjs`,
      formats: [
        'cjs',
      ],
    },
    minify: false,
    outDir: './dist',
    rollupOptions: {
      external: [
        ...builtinModules,
        /^node:.*/,
      ],
    },
    sourcemap: 'inline',
  },
  plugins: [
    useEditorModules(),
  ],
});

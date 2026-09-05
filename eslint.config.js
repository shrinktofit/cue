// @ts-check

import { defineConfig, globalIgnores } from 'eslint/config';
import node from '@shrinktofit/eslint-config/node';
import stf from '@shrinktofit/eslint-config';
import vue from 'eslint-plugin-vue';
import globals from 'globals';
import vueParser from 'vue-eslint-parser';

export default defineConfig([
  globalIgnores([
    '**/lib/',
    '**/lib-types/',
    '**/dist/',
    '**/coverage/',
    '**/test/fixtures/',
  ]),
  {
    settings: {
      node: {
        version: '>=26.0.0',
      },
    },
  },
  ...stf.configs.recommended,
  ...stf.configs.conventions,
  ...node.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        projectService: {
          allowDefaultProject: [
            'packages/*/vite.config.ts',
          ],
        },
      },
    },
  },
  {
    files: [
      '**/*.vue',
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        Editor: 'readonly',
      },
      parser: vueParser,
      parserOptions: {
        extraFileExtensions: [
          '.vue',
        ],
        parser: '@typescript-eslint/parser',
      },
    },
  },
]);

/// <reference types="@cyclonium/cc-extension-utils/types/vite-plugins/contribution-modules" />

import { dirname } from 'node:path';
import {
  mergeContributions,
  type ExtensionContributions,
} from '@cyclonium/cc-extension-utils/extension';

export function register(info: {
  contributions?: ExtensionContributions;
}): void {
  mergeContributions(info.contributions ??= {}, {
    'asset-db': {
      mounts: [
        {
          name: 'Cue-Runtime',
          path: dirname(require.resolve('@bsgames/cue/assets-meta')),
          readonly: true,
        },
      ],
    },
  } as unknown as ExtensionContributions);
}

export {};

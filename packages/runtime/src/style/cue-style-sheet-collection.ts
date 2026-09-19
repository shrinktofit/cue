import {
  cueStyleSchemaVersion,
  type CueStyleSheet,
} from '@bsgames/cue-style-schema';
// eslint-disable-next-line vue/prefer-import-from-vue -- Cue intentionally targets Vue's custom-renderer runtime.
import { getCurrentInstance } from '@vue/runtime-core';
// eslint-disable-next-line vue/prefer-import-from-vue -- Cue intentionally targets Vue's custom-renderer runtime.
import type { App, Component } from '@vue/runtime-core';

export interface CueStyleSheetCollection {
  readonly revision: number;
  readonly styleSheets: readonly CueStyleSheet[];

  clear(): void;
}

export function trackCueStyleSheets(app: App): CueStyleSheetCollection {
  const counts = new Map<CueStyleSheet, number>();
  let revision = 0;
  const styleSheets: CueStyleSheet[] = [];
  const styleSheetsByInstance = new WeakMap<object, readonly CueStyleSheet[]>();

  app.mixin({
    beforeCreate() {
      const instance = getCurrentInstance();
      if (!instance) {
        return;
      }
      const componentStyleSheets = readComponentStyleSheets(instance.type);
      styleSheetsByInstance.set(instance, componentStyleSheets);
      for (const styleSheet of componentStyleSheets) {
        const count = counts.get(styleSheet) ?? 0;
        if (count === 0) {
          styleSheets.push(styleSheet);
          revision++;
        }
        counts.set(styleSheet, count + 1);
      }
    },
    beforeUnmount() {
      const instance = getCurrentInstance();
      if (!instance) {
        return;
      }
      const componentStyleSheets = styleSheetsByInstance.get(instance) ?? [];
      styleSheetsByInstance.delete(instance);
      for (const styleSheet of componentStyleSheets) {
        const count = counts.get(styleSheet);
        if (count === undefined) {
          continue;
        }
        if (count > 1) {
          counts.set(styleSheet, count - 1);
          continue;
        }
        counts.delete(styleSheet);
        const index = styleSheets.indexOf(styleSheet);
        if (index >= 0) {
          styleSheets.splice(index, 1);
          revision++;
        }
      }
    },
  });

  return {
    get revision() { return revision; },
    get styleSheets() {
      return styleSheets;
    },
    clear() {
      counts.clear();
      styleSheets.length = 0;
      revision++;
    },
  };
}

function readComponentStyleSheets(
  component: Component,
): readonly CueStyleSheet[] {
  if (
    (typeof component !== 'object' || component === null)
    && typeof component !== 'function'
  ) {
    return [];
  }
  const styleSheets = (
    component as { __cueStyleSheets?: unknown }
  ).__cueStyleSheets;
  if (styleSheets === undefined) {
    return [];
  }
  if (!Array.isArray(styleSheets)) {
    throw new TypeError('Cue component style metadata must be an array.');
  }
  for (const styleSheet of styleSheets) {
    const version = styleSheet && typeof styleSheet === 'object'
      ? (styleSheet as { version?: unknown }).version
      : undefined;
    if (version !== cueStyleSchemaVersion) {
      throw new Error('Unsupported Cue style schema version: ' + String(version) + '.');
    }
  }
  return styleSheets as CueStyleSheet[];
}

export {};

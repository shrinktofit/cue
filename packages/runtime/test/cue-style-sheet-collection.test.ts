import {
  CueDisplay,
  cueStyleSchemaVersion,
  type CueStyleSheet,
} from '@bsgames/cue-style-schema';
// eslint-disable-next-line vue/prefer-import-from-vue -- Test the same renderer-only runtime consumed by Cue.
import { defineComponent, h, nextTick, ref } from '@vue/runtime-core';
import { describe, expect, test } from 'vitest';
import { CueRootElement } from '../src/element/cue-root-element.js';
import { trackCueStyleSheets } from '../src/style/cue-style-sheet-collection.js';
import { createCueRenderer } from '../src/vue/create-cue-renderer.js';

const childStyleSheet: CueStyleSheet = {
  rules: [
    {
      declarations: {
        display: CueDisplay.flex,
      },
      selectors: [
        [
          'child',
        ],
      ],
    },
  ],
  version: cueStyleSchemaVersion,
};

describe('trackCueStyleSheets', () => {
  test('tracks styles from nested and dynamically mounted components', async () => {
    const child = Object.assign(
      defineComponent(() => () => h('div', {
        class: 'child',
      })),
      {
        __cueStyleSheets: [
          childStyleSheet,
        ],
      },
    );
    const childVisible = ref(true);
    const root = defineComponent(() => () => childVisible.value
      ? h(child)
      : null);
    const app = createCueRenderer().createApp(root);
    const collection = trackCueStyleSheets(app);

    app.mount(new CueRootElement());
    expect(collection.styleSheets).toEqual([
      childStyleSheet,
    ]);

    childVisible.value = false;
    await nextTick();
    expect(collection.styleSheets).toEqual([]);

    childVisible.value = true;
    await nextTick();
    expect(collection.styleSheets).toEqual([
      childStyleSheet,
    ]);

    app.unmount();
    expect(collection.styleSheets).toEqual([]);
  });

  test('keeps shared styles until the last component instance unmounts', async () => {
    const child = Object.assign(
      defineComponent(() => () => h('div')),
      {
        __cueStyleSheets: [
          childStyleSheet,
        ],
      },
    );
    const childCount = ref(2);
    const root = defineComponent(() => () => Array.from(
      {
        length: childCount.value,
      },
      (_, index) => h(child, {
        key: index,
      }),
    ));
    const app = createCueRenderer().createApp(root);
    const collection = trackCueStyleSheets(app);

    app.mount(new CueRootElement());
    expect(collection.styleSheets).toEqual([
      childStyleSheet,
    ]);

    childCount.value = 1;
    await nextTick();
    expect(collection.styleSheets).toEqual([
      childStyleSheet,
    ]);

    childCount.value = 0;
    await nextTick();
    expect(collection.styleSheets).toEqual([]);
  });
});

export {};

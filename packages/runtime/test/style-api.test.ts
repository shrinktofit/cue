import { describe, expect, it } from 'vitest';
import type { CueStyleSheet } from '@bsgames/cue-style-schema';
import {
  createCueRenderer,
  CueElement,
  CueRootElement,
  DivElement,
  h,
  Length,
  nextTick,
  shallowRef,
  watchEffect,
} from '../src/index.js';
import { computeCueElementStyle } from '../src/style/compute-cue-element-style.js';

describe('Typed element style API', () => {
  it('updates properties without initialization and removes individual overrides', () => {
    /// @case Assign pixel/percentage lengths and structured colors, then clear width.
    /// @expect Updates apply without a CSS parser and clearing one property preserves the others.
    const element = new DivElement();
    element.style.width = 40;
    element.style.height = Length.px(30);
    element.style.backgroundColor = { red: 255, green: 0, blue: 0, alpha: 1 };
    expect(computeCueElementStyle(element, [])).toMatchObject({ width: 40, height: 30 });
    element.style.width = Length.percent(75);
    expect(computeCueElementStyle(element, []).width).toBe('75%');
    element.style.width = undefined;
    expect(computeCueElementStyle(element, [])).toMatchObject({
      width: 'auto', height: 30,
      backgroundColor: { red: 255, green: 0, blue: 0, alpha: 1 },
    });
    expect(computeCueElementStyle(new DivElement(), []).height).toBe('auto');
  });

  it('preserves stylesheet importance and restores class values on removal', () => {
    /// @case A typed override competes with normal and important stylesheet declarations.
    /// @expect API values beat normal rules, not important rules; undefined restores the class.
    const root = new CueRootElement();
    const renderer = createCueRenderer();
    renderer.render(h('div', { class: 'card strong' }), root);
    const element = root.children[0] as CueElement;
    const sheet: CueStyleSheet = {
      version: 1,
      rules: [{
        selectors: [[{ type: 'class', name: 'card' }, { type: 'class', name: 'strong' }]],
        declarations: { width: 10 },
        importantDeclarations: { height: 30 },
      }],
    };
    element.style.width = 40;
    element.style.height = 70;
    expect(computeCueElementStyle(element, [sheet])).toMatchObject({ width: 40, height: 30 });
    element.style.width = undefined;
    expect(computeCueElementStyle(element, [sheet]).width).toBe(10);
    renderer.render(null, root);
  });

  it('keeps font names opaque and converts nested typed lengths', () => {
    /// @case A font name contains CSS punctuation alongside structured transforms and radii.
    /// @expect Names are data, never CSS; nested percentage and pixel values retain their units.
    const element = new DivElement();
    element.style.fontFamily = ['a;b: "font"'];
    element.style.fontSize = 24;
    element.style.lineHeight = Length.px(32);
    element.style.borderTopLeftRadius = [Length.percent(50), Length.px(8)];
    element.style.transform = [{ type: 'translate', x: Length.percent(25), y: 10 }];
    expect(computeCueElementStyle(element, [])).toMatchObject({
      fontFamily: ['a;b: "font"'], fontSize: 24, lineHeight: 32,
      borderTopLeftRadius: ['50%', 8], transform: [{ type: 'translate', x: '25%', y: 10 }],
    });
  });

  it('follows reactive values through a Vue template ref', async () => {
    /// @case A mounted element receives progress updates and then clears its width override.
    /// @expect Its width follows watchEffect without remounting or parsing CSS.
    const progress = shallowRef<number | undefined>(25);
    const target = shallowRef<CueElement>();
    const root = new CueRootElement();
    const app = createCueRenderer().createApp({
      setup() {
        watchEffect(() => {
          if (target.value) {
            target.value.style.width = progress.value === undefined
              ? undefined
              : Length.percent(progress.value);
          }
        });
        return () => h('div', { ref: target });
      },
    });
    app.mount(root);
    await nextTick();
    const element = root.children[0] as CueElement;
    expect(computeCueElementStyle(element, []).width).toBe('25%');
    progress.value = 80;
    await nextTick();
    expect(computeCueElementStyle(element, []).width).toBe('80%');
    progress.value = undefined;
    await nextTick();
    expect(computeCueElementStyle(element, []).width).toBe('auto');
    app.unmount();
  });

  it.each(['width: 20px', { width: '20px' }])('rejects runtime CSS style props: %j', (style) => {
    /// @case A render function bypasses the compiler and passes a CSS style prop.
    /// @expect Unsupported input is reported, not silently parsed or ignored.
    expect(() => createCueRenderer().render(h('div', { style }), new CueRootElement()))
      .toThrow('CueElement.style');
  });
});

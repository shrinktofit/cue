import { describe, expect, it } from 'vitest';
import {
  CueElement,
  CueRootElement,
  createCueRenderer,
  defineComponent,
  DivElement,
  globalElementRegistry,
  h,
  nextTick,
  ref,
  Text,
} from '../src/index.js';

describe('createCueRenderer', () => {
  it('mounts and updates Vue output as a stable CueElement tree', async () => {
    /// @case
    /// A Vue component renders a builtin div containing a locally registered custom element.
    /// @expect
    /// Reactive updates preserve element identity while updating properties and text.
    class CooldownRingElement extends CueElement {}

    globalElementRegistry.define('cooldown-ring', CooldownRingElement);
    const renderer = createCueRenderer();
    const root = new CueRootElement();
    const count = ref(1);
    const component = defineComponent(() => () => h('div', [
      h('cooldown-ring', {
        value: count.value,
      }, String(count.value)),
    ]));
    const app = renderer.createApp(component);

    app.mount(root);

    const container = root.children[0];
    expect(container).toBeInstanceOf(DivElement);
    if (!(container instanceof DivElement)) {
      return;
    }
    const ring = container.children[0];
    expect(ring).toBeInstanceOf(CooldownRingElement);
    if (!(ring instanceof CooldownRingElement)) {
      return;
    }
    expect(ring.children[0]).toBeInstanceOf(Text);
    expect((ring.children[0] as Text).data).toBe('1');

    count.value = 2;
    await nextTick();

    expect(container.children[0]).toBe(ring);
    expect((ring.children[0] as Text).data).toBe('2');

    app.unmount();
    expect(root.children).toEqual([]);
  });

  it('uses globalElementRegistry for custom host elements', () => {
    /// @case
    /// A custom element is registered in the module-level global registry and rendered.
    /// @expect
    /// The default renderer creates that registered CueElement implementation.
    class GlobalBadgeElement extends CueElement {}

    globalElementRegistry.define('cue-test-global-badge', GlobalBadgeElement);
    const renderer = createCueRenderer();
    const root = new CueRootElement();

    renderer.render(h('cue-test-global-badge'), root);

    expect(root.children[0]).toBeInstanceOf(GlobalBadgeElement);
  });

  it('reorders keyed children without recreating them', () => {
    /// @case
    /// Vue changes the order of two keyed builtin elements.
    /// @expect
    /// The CueElement tree order changes while both host element identities are retained.
    const renderer = createCueRenderer();
    const root = new CueRootElement();

    renderer.render(h('div', [
      h('div', {
        key: 'first',
      }, 'first'),
      h('div', {
        key: 'second',
      }, 'second'),
    ]), root);

    const container = root.children[0];
    if (!(container instanceof DivElement)) {
      throw new TypeError('Expected the renderer to create a DivElement container.');
    }
    const [first, second] = container.children;

    renderer.render(h('div', [
      h('div', {
        key: 'second',
      }, 'second'),
      h('div', {
        key: 'first',
      }, 'first'),
    ]), root);

    expect(container.children).toEqual([second, first]);
  });

  it('reports unknown host elements', () => {
    /// @case
    /// Vue attempts to render a host tag absent from the selected registry chain.
    /// @expect
    /// Rendering fails with the unknown tag in the error message.
    const renderer = createCueRenderer();
    const root = new CueRootElement();

    expect(() => renderer.render(h('missing-element'), root))
      .toThrow('Element "missing-element" is not registered.');
  });
});

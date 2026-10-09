import { beforeAll, describe, expect, it } from 'vitest';
import type { SpriteFrame } from 'cc';
import { createCueRenderer, CueImageElement, CueObjectFit, CueRootElement, DivElement, h, Length } from '../src/index.js';
import { CueLayout, createCuePaintList, initializeCueLayout, type CueTextMeasurer } from '../src/render/create-cue-paint-list.js';

const measurer: CueTextMeasurer = {
  measureWidth: () => 0,
  metrics: () => ({ ascent: 12, descent: 4, xHeight: 8, lineHeight: 16 }),
  layout: () => ({ width: 0, height: 0, lines: [] }),
};

describe('object-fit on rendered cue-image elements', () => {
  beforeAll(initializeCueLayout);

  it.each([
    ['wide', 200, 100, 120, 120, 120, 60, 0, 30],
    ['tall', 100, 200, 120, 120, 60, 120, 30, 0],
    ['small', 20, 10, 120, 120, 120, 60, 0, 30],
    ['square', 100, 100, 120, 120, 120, 120, 0, 0],
    ['rectangular box', 100, 200, 160, 80, 40, 80, 60, 0],
  ] as const)('contains a %s image without changing its layout box', (_name, sourceWidth, sourceHeight, width, height, paintedWidth, paintedHeight, offsetX, offsetY) => {
    /// @case A fixed-size image element contains a differently shaped or smaller SpriteFrame.
    /// @expect Its pixels fit proportionally and center in the content box, including upscaling; hit/layout bounds stay unchanged.
    const root = new CueRootElement();
    createCueRenderer().render(h('cue-image', { src: 'uuid:icon' }), root);
    const image = root.children[0] as CueImageElement;
    Object.assign(image.style, { display: 'block', width, height, objectFit: 'contain' });
    const resource = { rect: { width: sourceWidth, height: sourceHeight } } as SpriteFrame;
    const list = createCuePaintList(root, [], measurer, () => resource, () => undefined);
    expect(list.commands.find((command) => command.kind === 'image')?.paint).toMatchObject({
      width: paintedWidth, height: paintedHeight, x: offsetX, y: -offsetY,
    });
    expect(list.hitRegions.find((region) => region.element === image)).toMatchObject({ x: 0, y: 0, width, height });
    expect([image.clientWidth, image.clientHeight]).toEqual([width, height]);
  });

  it.each([undefined, CueObjectFit.fill])('keeps %s fitting stretched and non-inherited', (objectFit) => {
    /// @case A parent requests contain, but its image has no fit declaration or explicitly requests fill.
    /// @expect The image uses the initial non-inherited fill behavior.
    const root = new CueRootElement();
    const parent = new DivElement();
    Object.assign(parent.style, { objectFit: 'contain' });
    root.insertBefore(parent);
    createCueRenderer().render(h('cue-image', { src: 'uuid:icon' }), parent);
    const image = parent.children[0] as CueImageElement;
    Object.assign(image.style, { display: 'block', width: 120, height: 100, objectFit });
    const resource = { rect: { width: 200, height: 50 } } as SpriteFrame;
    const list = createCuePaintList(root, [], measurer, () => resource, () => undefined);
    expect(list.commands.find((command) => command.kind === 'image')?.paint).toMatchObject({ width: 120, height: 100, x: 0, y: -0 });
  });

  it('fits inside the content box, excluding asymmetric padding and borders', () => {
    /// @case A border-box image has unequal padding and a visible border.
    /// @expect Contain uses only the content area; background, border and hit bounds retain the full box.
    const root = new CueRootElement();
    createCueRenderer().render(h('cue-image', { src: 'uuid:icon' }), root);
    const image = root.children[0] as CueImageElement;
    Object.assign(image.style, {
      display: 'block', objectFit: 'contain', boxSizing: 'border-box', width: 150, height: 130,
      borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 5, borderBottomWidth: 5,
      borderLeftStyle: 'solid', borderRightStyle: 'solid', borderTopStyle: 'solid', borderBottomStyle: 'solid',
      paddingLeft: 10, paddingRight: 30, paddingTop: 20, paddingBottom: 0,
    });
    const resource = { rect: { width: 200, height: 100 } } as SpriteFrame;
    const list = createCuePaintList(root, [], measurer, () => resource, () => undefined);
    expect(list.commands.find((command) => command.kind === 'image')?.paint).toMatchObject({ width: 100, height: 50, x: 15, y: -50 });
    expect(list.hitRegions.find((region) => region.element === image)).toMatchObject({ width: 150, height: 130 });
  });

  it('refits after loading, source changes, container resizing and typed overrides', () => {
    /// @case A retained document loads a wide image, swaps it for a tall one, resizes the viewport, then toggles fit.
    /// @expect Rendering follows current resource and content dimensions without remounting or manual image dimensions.
    const root = new CueRootElement();
    const renderer = createCueRenderer();
    renderer.render(h('cue-image', { src: 'uuid:wide' }), root);
    const image = root.children[0] as CueImageElement;
    Object.assign(image.style, { display: 'block', width: Length.percent(100), height: 100, objectFit: 'contain' });
    const resources = new Map<string, SpriteFrame>();
    const layout = new CueLayout(root, measurer, (source) => resources.get(source), () => undefined);
    try {
      expect(layout.update([], { width: 100, height: 200 }).commands.some((command) => command.kind === 'image')).toBe(false);
      resources.set('uuid:wide', { rect: { width: 200, height: 100 } } as SpriteFrame);
      resources.set('uuid:tall', { rect: { width: 100, height: 200 } } as SpriteFrame);
      expect(layout.update([], { width: 100, height: 200 }, 1).commands.find((command) => command.kind === 'image')?.paint)
        .toMatchObject({ width: 100, height: 50, x: 0, y: -25 });
      renderer.render(h('cue-image', { src: 'uuid:tall' }), root);
      expect(root.children[0]).toBe(image);
      expect(layout.update([], { width: 100, height: 200 }, 1).commands.find((command) => command.kind === 'image')?.paint)
        .toMatchObject({ width: 50, height: 100, x: 25, y: -0 });
      expect(layout.update([], { width: 200, height: 200 }, 1).commands.find((command) => command.kind === 'image')?.paint)
        .toMatchObject({ width: 50, height: 100, x: 75, y: -0 });
      image.style.objectFit = CueObjectFit.fill;
      expect(layout.update([], { width: 200, height: 200 }, 1).commands.find((command) => command.kind === 'image')?.paint)
        .toMatchObject({ width: 200, height: 100, x: 0, y: -0 });
    } finally {
      layout.dispose();
    }
  });
});

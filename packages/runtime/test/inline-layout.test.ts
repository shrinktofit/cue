import { beforeAll, describe, expect, it } from 'vitest';
import { BrElement, CueButtonElement, CueDisplay, CueRootElement, CueSelectElement, DivElement, SpanElement, Text, Length } from '../src/index.js';
import { createCuePaintList, initializeCueLayout, type CueTextMeasurer } from '../src/render/create-cue-paint-list.js';

const measurer: CueTextMeasurer = {
  metrics: () => ({ ascent: 15, descent: 5, xHeight: 8, lineHeight: 20 }),
  layout: (text) => ({ width: text.length * 8, height: 20, lines: [{ text, width: text.length * 8 }] }),
};

describe('inline formatting in rendered controls', () => {
  beforeAll(initializeCueLayout);

  it('centers direct button text without changing its author children', () => {
    /// @case A default button contains one bare text node in a taller flex box.
    /// @expect Its text line is vertically centered and the author tree is unchanged.
    const root = new CueRootElement();
    const button = new CueButtonElement();
    const text = new Text('Launch');
    button.insertBefore(text);
    root.insertBefore(button);
    const list = createCuePaintList(root, [], measurer, () => undefined, () => undefined, { width: 300, height: 200 });
    const box = list.hitRegions.find((region) => region.element === button)!;
    const command = list.commands.find((entry) => entry.kind === 'text')!;
    expect(-command.paint.y + command.paint.height / 2).toBe(box.y + box.height / 2);
    expect(button.children).toEqual([text]);
  });

  it('centers the select label after its height changes', () => {
    /// @case A select uses its default appearance with an author height override.
    /// @expect The label remains vertically centered rather than using a fixed top offset.
    const root = new CueRootElement();
    const select = new CueSelectElement();
    select.style.height = 80;
    root.insertBefore(select);
    const list = createCuePaintList(root, [], measurer, () => undefined, () => undefined, { width: 400, height: 200 });
    const box = list.hitRegions.find((region) => region.element === select)!;
    const command = list.commands.find((entry) => entry.kind === 'text' && entry.paint.lines[0]?.text === 'Select…')!;
    expect(-command.paint.y + command.paint.height / 2).toBe(box.y + box.height / 2);
  });

  it.each([false, true])('preserves fractional button text widths inside inline-block: %s', (nested) => {
    /// @case A centered button label has a fractional advance; its width changes from ample to constrained and back.
    /// @expect It wraps only when space is actually insufficient, and the entire text block stays vertically centered.
    const root = new CueRootElement();
    const button = new CueButtonElement();
    Object.assign(button.style, { minWidth: 0, minHeight: 0, height: 60 });
    button.insertBefore(new Text('click / hover'));
    if (nested) {
      const block = new DivElement();
      const atomic = new SpanElement();
      atomic.style.display = CueDisplay.inlineBlock;
      atomic.insertBefore(button);
      block.insertBefore(atomic);
      root.insertBefore(block);
    } else {
      root.insertBefore(button);
    }
    const fractionalMeasurer: CueTextMeasurer = {
      metrics: (style) => measurer.metrics(style),
      layout: (text) => ({ width: text.length * 8.1875, height: 20, lines: [{ text, width: text.length * 8.1875 }] }),
    };
    for (const [width, lines] of [
      [160, ['click / hover']],
      [161, ['click / hover']],
      [96, ['click /', 'hover']],
      [162, ['click / hover']],
    ] as const) {
      button.style.width = width;
      const list = createCuePaintList(root, [], fractionalMeasurer, () => undefined, () => undefined, { width: 300, height: 200 });
      const box = list.hitRegions.find((region) => region.element === button)!;
      const paints = list.commands.filter((entry) => entry.kind === 'text').map((entry) => entry.paint);
      expect(paints.flatMap((paint) => paint.lines.map((line) => line.text))).toEqual(lines);
      const top = Math.min(...paints.map((paint) => -paint.y));
      const bottom = Math.max(...paints.map((paint) => -paint.y + paint.height));
      expect(bottom - top).toBe(lines.length * 20);
      expect((top + bottom) / 2).toBeCloseTo(box.y + box.height / 2);
    }
  });

  it('collapses whitespace across nested spans without inserting word breaks', () => {
    /// @case Bare text and nested spans split both whitespace and an unbreakable word.
    /// @expect Spaces collapse across element boundaries, and a span boundary does not permit wrapping.
    const root = new CueRootElement();
    const block = new DivElement();
    block.style.width = 56;
    block.insertBefore(new Text('  one  '));
    const span = new SpanElement();
    span.insertBefore(new Text(' two'));
    const nested = new SpanElement();
    nested.insertBefore(new Text('three  '));
    span.insertBefore(nested);
    block.insertBefore(span);
    root.insertBefore(block);
    const list = createCuePaintList(root, [], measurer, () => undefined, () => undefined);
    const texts = list.commands.filter((entry) => entry.kind === 'text').map((entry) => entry.paint);
    expect(texts.map((paint) => paint.lines[0]!.text)).toEqual(['one', 'two', 'three']);
    const one = texts.find((paint) => paint.lines[0]!.text === 'one')!;
    const two = texts.find((paint) => paint.lines[0]!.text === 'two')!;
    const three = texts.find((paint) => paint.lines[0]!.text === 'three')!;
    expect(-two.y).toBe(-one.y + 20);
    expect(three.y).toBe(two.y);
    expect(three.x).toBe(two.x + 24);
  });

  it('builds anonymous blocks around text separated by a block child', () => {
    /// @case A block interrupts the surrounding bare text flow.
    /// @expect Text before and after occupies distinct lines around the real block.
    const root = new CueRootElement();
    const parent = new DivElement();
    parent.insertBefore(new Text('before'));
    const block = new DivElement();
    block.style.height = 30;
    parent.insertBefore(block);
    parent.insertBefore(new Text('after'));
    root.insertBefore(parent);
    const list = createCuePaintList(root, [], measurer, () => undefined, () => undefined);
    const texts = list.commands.filter((entry) => entry.kind === 'text').map((entry) => entry.paint);
    expect(-texts[1]!.y + texts[0]!.y).toBe(50);
    expect(parent.children).toHaveLength(3);
  });

  it('places br and an inline-block inside the line flow', () => {
    /// @case Text surrounds a sized inline-block, followed by a forced break.
    /// @expect The atomic box participates in the line and the next text starts on a new line.
    const root = new CueRootElement();
    const parent = new DivElement();
    parent.style.width = 200;
    parent.insertBefore(new Text('A'));
    const atomic = new SpanElement();
    Object.assign(atomic.style, { display: CueDisplay.inlineBlock, width: 30, height: 40, marginLeft: 4, marginRight: 6 });
    atomic.insertBefore(new Text('B'));
    parent.insertBefore(atomic);
    parent.insertBefore(new Text('C'));
    parent.insertBefore(new BrElement());
    parent.insertBefore(new Text('D'));
    root.insertBefore(parent);
    const list = createCuePaintList(root, [], measurer, () => undefined, () => undefined);
    const box = list.hitRegions.find((entry) => entry.element === atomic)!;
    expect(box.x).toBe(12);
    expect(box.width).toBe(30);
    expect(box.height).toBe(40);
    const c = list.commands.find((entry) => entry.kind === 'text' && entry.paint.lines[0]?.text === 'C')!;
    const d = list.commands.find((entry) => entry.kind === 'text' && entry.paint.lines[0]?.text === 'D')!;
    expect(c.paint.x).toBe(48);
    expect(d.paint.x).toBe(0);
    expect(d.paint.y).toBeLessThan(c.paint.y);
    atomic.style.width = Length.px(50);
    const changed = createCuePaintList(root, [], measurer, () => undefined, () => undefined);
    const nextC = changed.commands.find((entry) => entry.kind === 'text' && entry.paint.lines[0]?.text === 'C')!;
    expect(nextC.paint.x).toBe(68);
  });

  it('retains author opacity when a block interrupts an inline ancestor', () => {
    /// @case A translucent span surrounds text, a block child, and more text.
    /// @expect Anonymous formatting boxes do not sever the shared opacity chain.
    const root = new CueRootElement();
    const parent = new DivElement();
    const span = new SpanElement();
    span.style.cueOpacity = 0.5;
    span.insertBefore(new Text('A'));
    const block = new DivElement();
    block.insertBefore(new Text('B'));
    span.insertBefore(block);
    span.insertBefore(new Text('C'));
    parent.insertBefore(span);
    root.insertBefore(parent);
    const list = createCuePaintList(root, [], measurer, () => undefined, () => undefined);
    expect(list.commands.filter((entry) => entry.kind === 'text').map((entry) => entry.paint.opacity)).toEqual([0.5, 0.5, 0.5]);
    span.style.cueOpacity = 0;
    const invisible = createCuePaintList(root, [], measurer, () => undefined, () => undefined);
    expect(invisible.commands.filter((entry) => entry.kind === 'text')).toEqual([]);
    expect(invisible.hitRegions.some((region) => region.element === block)).toBe(true);
  });

  it('keeps inline pointer targets under a fully transparent ancestor', () => {
    /// @case A parent becomes fully transparent without changing its descendants.
    /// @expect The inline span retains the same hit regions, but produces no text draw.
    const root = new CueRootElement();
    const parent = new DivElement();
    const span = new SpanElement();
    span.insertBefore(new Text('target'));
    parent.insertBefore(span);
    root.insertBefore(parent);
    const visible = createCuePaintList(root, [], measurer, () => undefined, () => undefined);
    parent.style.cueOpacity = 0;
    const invisible = createCuePaintList(root, [], measurer, () => undefined, () => undefined);
    expect(invisible.hitRegions).toEqual(visible.hitRegions);
    expect(invisible.commands.filter((entry) => entry.kind === 'text')).toEqual([]);
  });
});

export {};

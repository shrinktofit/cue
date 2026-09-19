import { beforeAll, describe, expect, it } from 'vitest';
import type { SpriteFrame } from 'cc';
import { CueRootElement, DivElement, SpanElement, Text, CueImageElement, CuePosition, CueDisplay, CueTextInputElement, CueNumberInputElement, Length } from '../src/index.js';
import { applyCueTextInputEdit, updateCueTextInputLayout } from '../src/builtin-controls/text-input/cue-editable-input-element.js';
import { patchCueElementProperty } from '../src/element/cue-element.js';
import { CueLayout, createCuePaintList, initializeCueLayout, type CueTextMeasurer } from '../src/render/create-cue-paint-list.js';

const fixedMeasurer: CueTextMeasurer = {
  measureWidth: (text) => text.length * 8,
  metrics: () => ({ ascent: 15, descent: 5, xHeight: 8, lineHeight: 20 }),
  layout: (text) => ({ width: text.length * 8, height: 20, lines: [{ text, width: text.length * 8 }] }),
};

describe('retained document layout', () => {
  beforeAll(initializeCueLayout);

  it('matches a fresh layout after geometry, inheritance, viewport and tree changes', () => {
    /// @case A retained nested inline/block tree undergoes normal author mutations.
    /// @expect Every resulting paint and hit region agrees with an independently rebuilt formatting tree.
    const root = new CueRootElement();
    const block = new DivElement();
    block.style.width = Length.percent(100);
    const atomic = new SpanElement();
    atomic.style.display = CueDisplay.inlineBlock;
    const nested = new DivElement();
    const text = new Text('alpha beta gamma');
    nested.insertBefore(text);
    atomic.insertBefore(nested);
    block.insertBefore(new Text('before '));
    block.insertBefore(atomic);
    block.insertBefore(new Text(' after'));
    root.insertBefore(block);
    const sibling = new DivElement();
    sibling.insertBefore(new Text('sibling'));
    root.insertBefore(sibling);
    let viewport = { width: 300, height: 200 };
    let fontRevision = 0;
    const measurer = {
      ...fixedMeasurer,
      get fontRevision() {
        return fontRevision;
      },
      measureWidth: (text: string) => text.length * (8 + fontRevision),
    };
    const layout = new CueLayout(root, measurer, () => undefined, () => undefined);
    try {
      expect(layout.update([], viewport)).toEqual(createCuePaintList(root, [], measurer, () => undefined, () => undefined, viewport));
      for (const change of [
        () => { nested.style.width = 50; },
        () => { nested.style.width = 240; },
        () => { text.data = 'changed text inside atomic'; },
        () => { block.style.fontSize = 28; },
        () => { block.style.lineHeight = Length.px(36); },
        () => { fontRevision++; },
        () => { viewport = { width: 180, height: 300 }; },
        () => { atomic.style.display = CueDisplay.inline; },
        () => { block.style.display = CueDisplay.flex; },
        () => { atomic.style.order = -1; },
        () => { atomic.style.transform = [{ type: 'translate', x: 10, y: 5 }]; },
        () => { sibling.insertBefore(atomic); },
        () => { sibling.removeChild(atomic); },
        () => { root.removeChild(sibling); },
        () => { root.insertBefore(sibling, block); },
      ]) {
        change();
        expect(layout.update([], viewport)).toEqual(createCuePaintList(root, [], measurer, () => undefined, () => undefined, viewport));
      }
    } finally {
      layout.dispose();
    }
  });

  it('does not remeasure atomic text on paint-only updates or an unchanged sibling', () => {
    /// @case Atomic inline text is recolored, then an unrelated block changes its text.
    /// @expect Neither update measures the unchanged atomic content.
    const measured: string[] = [];
    const measurer = { ...fixedMeasurer, measureWidth: (text: string) => {
      measured.push(text);
      return text.length * 8;
    } };
    const root = new CueRootElement();
    const block = new DivElement();
    const atomic = new SpanElement();
    atomic.style.display = CueDisplay.inlineBlock;
    atomic.insertBefore(new Text('UNCHANGED'));
    block.insertBefore(atomic);
    const sibling = new DivElement();
    const text = new Text('old');
    sibling.insertBefore(text);
    root.insertBefore(block);
    root.insertBefore(sibling);
    const layout = new CueLayout(root, measurer, () => undefined, () => undefined);
    try {
      layout.update([]);
      measured.length = 0;
      atomic.style.color = { red: 255, green: 0, blue: 0, alpha: 1 };
      layout.update([]);
      expect(measured).toEqual([]);
      text.data = 'new text';
      layout.update([]);
      expect(measured.length).toBeGreaterThan(0);
      expect(measured.some((value) => value.includes('U'))).toBe(false);
    } finally {
      layout.dispose();
    }
  });

  it('switches between loaded image sources and clears the intrinsic size when src is removed', () => {
    /// @case An image changes A -> B -> unset without any asynchronous asset arrival.
    /// @expect Both the painted resource and its intrinsic dimensions follow src immediately.
    const root = new CueRootElement();
    const image = new CueImageElement();
    image.style.display = CueDisplay.block;
    root.insertBefore(image);
    const first = { rect: { width: 40, height: 20 } } as SpriteFrame;
    const second = { rect: { width: 80, height: 30 } } as SpriteFrame;
    const layout = new CueLayout(root, fixedMeasurer, (src) => src === 'a.png' ? first : second, () => undefined);
    try {
      let previous: string | undefined;
      for (const [src, resource, height] of [['a.png', first, 20], ['b.png', second, 30], [undefined, undefined, 0]] as const) {
        patchCueElementProperty(image, 'src', previous, src);
        previous = src;
        const paint = layout.update([]);
        expect(paint.commands.find((command) => command.kind === 'image')?.paint.spriteFrame).toBe(resource);
        expect(paint.hitRegions.find((region) => region.element === image)?.height ?? 0).toBe(height);
      }
    } finally {
      layout.dispose();
    }
  });

  it('invalidates editing presentation for direct value, placeholder, password and multiline setters', () => {
    /// @case A settled input is edited through its native API without moving the selection.
    /// @expect Each presentation change wakes the host; equivalent assignments remain no-ops.
    const root = new CueRootElement();
    const input = new CueTextInputElement();
    input.value = 'old';
    root.insertBefore(input);
    const layout = new CueLayout(root, fixedMeasurer, () => undefined, () => undefined);
    const settle = () => {
      layout.update([]);
      updateCueTextInputLayout(input, layout.computedStyle(input), fixedMeasurer);
      return layout.update([]);
    };
    try {
      for (const [change, expected] of [
        [() => { input.value = 'new'; }, 'new'],
        [() => { input.password = true; }, '•••'],
        [() => { input.password = false; }, 'new'],
        [() => { applyCueTextInputEdit(input, 'ime', 0, 0, true); }, 'ime'],
      ] as const) {
        const before = settle();
        change();
        expect(layout.update([])).not.toBe(before);
        expect(settle().commands.filter((command) => command.kind === 'text').flatMap((command) => command.paint.lines.map((line) => line.text))).toEqual([expected]);
      }
      applyCueTextInputEdit(input, '', 0, 0, false);
      input.placeholder = 'hint';
      const beforePlaceholder = settle();
      input.placeholder = 'new hint';
      expect(layout.update([])).not.toBe(beforePlaceholder);
      expect(settle().commands.find((command) => command.kind === 'text')?.paint.lines[0]?.text).toBe('new hint');
      const beforeMultiline = settle();
      input.multiline = true;
      expect(layout.update([])).not.toBe(beforeMultiline);
      const stable = settle();
      input.multiline = true;
      input.placeholder = 'new hint';
      expect(layout.update([])).toBe(stable);
    } finally {
      layout.dispose();
    }
  });

  it('wakes a settled number input after direct value and step changes', () => {
    /// @case NumberInput changes its number without changing its collapsed selection.
    /// @expect Value and step APIs both refresh the rendered text.
    const root = new CueRootElement();
    const input = new CueNumberInputElement();
    input.value = 10;
    root.insertBefore(input);
    const layout = new CueLayout(root, fixedMeasurer, () => undefined, () => undefined);
    try {
      layout.update([]);
      updateCueTextInputLayout(input, layout.computedStyle(input), fixedMeasurer);
      const before = layout.update([]);
      input.value = 20;
      expect(layout.update([])).not.toBe(before);
      updateCueTextInputLayout(input, layout.computedStyle(input), fixedMeasurer);
      const afterValue = layout.update([]);
      input.stepUp();
      expect(layout.update([])).not.toBe(afterValue);
      updateCueTextInputLayout(input, layout.computedStyle(input), fixedMeasurer);
      expect(layout.update([]).commands.find((command) => command.kind === 'text')?.paint.lines[0]?.text).toBe('21');
    } finally {
      layout.dispose();
    }
  });

  it('restores the static position when absolute insets become auto', () => {
    /// @case An absolute child of an offset static wrapper clears explicit left/top.
    /// @expect The placeholder follows its normal-flow location, including the wrapper offset.
    const root = new CueRootElement();
    const container = new DivElement();
    Object.assign(container.style, { position: CuePosition.relative, width: 300, height: 160, paddingTop: 1 });
    const wrapper = new DivElement();
    Object.assign(wrapper.style, { marginLeft: 70, marginTop: 39, width: 100 });
    const block = new DivElement();
    Object.assign(block.style, { width: 40, height: 30 });
    const absolute = new DivElement();
    Object.assign(absolute.style, { position: CuePosition.absolute, left: 0, top: 0, width: 60, height: 20 });
    wrapper.insertBefore(block);
    wrapper.insertBefore(absolute);
    container.insertBefore(wrapper);
    root.insertBefore(container);
    const layout = new CueLayout(root, fixedMeasurer, () => undefined, () => undefined);
    try {
      layout.update([]);
      delete absolute.style.left;
      delete absolute.style.top;
      expect(layout.update([]).hitRegions.find((region) => region.element === absolute)).toMatchObject({ x: 70, y: 70 });
    } finally {
      layout.dispose();
    }
  });

  it('reuses static output and repaints colors without measuring text again', () => {
    /// @case Render text, leave it unchanged, change its color, then change its content.
    /// @expect Static output is reused; a paint-only update never measures text; content does.
    let measurements = 0;
    const measurer: CueTextMeasurer = {
      measureWidth: (text) => {
        measurements++;
        return text.length * 8;
      },
      metrics: () => ({ ascent: 15, descent: 5, xHeight: 8, lineHeight: 20 }),
      layout: (text) => ({ width: text.length * 8, height: 20, lines: [{ text, width: text.length * 8 }] }),
    };
    const root = new CueRootElement();
    const box = new DivElement();
    const text = new Text('Hello world');
    box.insertBefore(text);
    root.insertBefore(box);
    const layout = new CueLayout(root, measurer, () => undefined, () => undefined);
    try {
      const first = layout.update([]);
      measurements = 0;
      expect(layout.update([])).toBe(first);
      expect(measurements).toBe(0);
      box.style.color = { red: 255, green: 0, blue: 0, alpha: 1 };
      const painted = layout.update([]);
      expect(painted.commands.find((command) => command.kind === 'text')?.paint.style.color.red).toBe(255);
      expect(measurements).toBe(0);
      text.data = 'Different text';
      expect(layout.update([]).commands.find((command) => command.kind === 'text')?.paint.lines[0]?.text).toBe('Different text');
      expect(measurements).toBeGreaterThan(0);
    } finally {
      layout.dispose();
    }
  });
});

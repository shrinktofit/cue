import {
  CuePseudoClass,
  CueSelectorCombinator,
  type CueSelector,
  type CueStyleSheet,
} from '@bsgames/cue-style-schema';
import { describe, expect, it } from 'vitest';
import { CueElement, patchCueElementProperty, setCueElementDefaultStyle, setCueElementState } from '../src/element/cue-element.js';
import { DivElement } from '../src/element/div-element.js';
import { computeCueElementStyle } from '../src/style/compute-cue-element-style.js';

class SliderElement extends CueElement {
  constructor() {
    super('cue-slider');
  }
}

describe('control CSS identity, state and cascade', () => {
  it('rejects obsolete class-string IR instead of matching it as a universal selector', () => {
    /// @case A stale stylesheet still contains the previous class-string selector representation.
    /// @expect The runtime requires recompilation and never silently applies the obsolete rule to every element.
    const stale = { version: 1, rules: [{ selectors: [['old']], declarations: { width: 99 } }] } as unknown as CueStyleSheet;
    expect(() => computeCueElementStyle(new DivElement(), [stale])).toThrow('recompile');
  });

  it('matches compound host selectors and child parts against the real tree', () => {
    /// @case A styled, hovered slider owns a thumb with its stable public class.
    /// @expect Type, ID, class, state and child combinator all constrain the same real nodes.
    const slider = new SliderElement();
    patchCueElementProperty(slider, 'id', undefined, 'volume');
    patchCueElementProperty(slider, 'class', undefined, 'primary');
    setCueElementState(slider, 'hover', true);
    const thumb = new DivElement();
    patchCueElementProperty(thumb, 'class', undefined, 'cue-slider-thumb');
    slider.insertBefore(thumb);
    const sheet: CueStyleSheet = { version: 1, rules: [{
      selectors: [[
        { type: 'type', name: 'cue-slider' },
        { type: 'id', name: 'volume' },
        { type: 'class', name: 'primary' },
        { type: 'pseudo-class', kind: CuePseudoClass.hover },
        { type: 'combinator', value: CueSelectorCombinator.child },
        { type: 'class', name: 'cue-slider-thumb' },
      ]],
      declarations: { width: 31 },
    }] };
    expect(computeCueElementStyle(thumb, [sheet]).width).toBe(31);
    setCueElementState(slider, 'hover', false);
    expect(computeCueElementStyle(thumb, [sheet]).width).toBe('auto');
  });

  it('backtracks ancestor matches for a descendant following a child combinator', () => {
    /// @case The nearest matching ancestor fails its own parent condition but a higher one satisfies it.
    /// @expect Descendant matching considers that higher ancestor, as Web CSS does.
    const nodes = ['a', 'b', 'gap', 'b', 'c'].map((className) => {
      const element = new DivElement();
      patchCueElementProperty(element, 'class', undefined, className);
      return element;
    });
    for (let index = 1; index < nodes.length; index++) {
      nodes[index - 1]!.insertBefore(nodes[index]!);
    }
    const sheet: CueStyleSheet = { version: 1, rules: [{
      selectors: [[
        { type: 'class', name: 'a' },
        { type: 'combinator', value: CueSelectorCombinator.child },
        { type: 'class', name: 'b' },
        { type: 'combinator', value: CueSelectorCombinator.descendant },
        { type: 'class', name: 'c' },
      ]], declarations: { width: 42 },
    }] };
    expect(computeCueElementStyle(nodes[4]!, [sheet]).width).toBe(42);
  });

  it('compares specificity lexicographically and only counts matching list entries', () => {
    /// @case An ID competes with many repeated classes, and a selector list also contains an unmatched ID.
    /// @expect IDs outrank any number of classes, while unmatched list entries add no specificity.
    const element = new SliderElement();
    patchCueElementProperty(element, 'id', undefined, 'volume');
    patchCueElementProperty(element, 'class', undefined, 'primary');
    const classes: CueSelector = Array.from({ length: 12 }, () => ({ type: 'class', name: 'primary' }));
    const sheet: CueStyleSheet = { version: 1, rules: [
      { selectors: [[{ type: 'id', name: 'volume' }]], declarations: { width: 10 } },
      { selectors: [classes], declarations: { width: 20, height: 20 } },
      { selectors: [[{ type: 'id', name: 'absent' }], [{ type: 'type', name: 'cue-slider' }]], declarations: { width: 30, height: 30 } },
    ] };
    expect(computeCueElementStyle(element, [sheet])).toMatchObject({ width: 10, height: 20 });
  });

  it('lets author universal rules override builtin defaults and important rules override inline values', () => {
    /// @case A builtin default, author universal declaration, typed inline value and important rule compete.
    /// @expect Defaults always lose to author declarations; importance precedes inline priority.
    const element = new SliderElement();
    setCueElementDefaultStyle(element, { width: 100, height: 20 });
    const sheet: CueStyleSheet = { version: 1, rules: [{
      selectors: [[{ type: 'universal' }]], declarations: { width: 40 }, importantDeclarations: { height: 30 },
    }] };
    expect(computeCueElementStyle(element, [])).toMatchObject({ width: 100, height: 20 });
    expect(computeCueElementStyle(element, [sheet])).toMatchObject({ width: 40, height: 30 });
    element.style.width = 50;
    element.style.height = 60;
    expect(computeCueElementStyle(element, [sheet])).toMatchObject({ width: 50, height: 30 });
  });

  it.each(Object.values(CuePseudoClass))('matches live %s state without inferring it from attributes', (kind) => {
    /// @case A supported pseudo-class changes on an element between style computations.
    /// @expect The current state controls matching and clearing it restores the prior style.
    const element = new SliderElement();
    const sheet: CueStyleSheet = { version: 1, rules: [{
      selectors: [[{ type: 'pseudo-class', kind }]], declarations: { width: 15 },
    }] };
    expect(computeCueElementStyle(element, [sheet]).width).toBe('auto');
    setCueElementState(element, kind, true);
    expect(computeCueElementStyle(element, [sheet]).width).toBe(15);
    setCueElementState(element, kind, false);
    expect(computeCueElementStyle(element, [sheet]).width).toBe('auto');
  });
});

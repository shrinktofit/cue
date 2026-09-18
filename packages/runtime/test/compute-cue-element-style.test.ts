import {
  CueBorderStyle,
  CueColorKeyword,
  CueLineHeightKeyword,
  CueTextAlign,
  CueWhiteSpace,
  cueStyleSchemaVersion,
  type CueStyleSheet,
} from '@bsgames/cue-style-schema';
import { describe, expect, test } from 'vitest';
import { DivElement } from '../src/element/div-element.js';
import { patchCueElementProperty } from '../src/element/cue-element.js';
import {
  computeCueElementStyle,
  initialCueTextStyle,
} from '../src/style/compute-cue-element-style.js';

const styleSheet: CueStyleSheet = {
  rules: [
    {
      declarations: {
        color: {
          alpha: 0.75,
          blue: 30,
          green: 20,
          red: 10,
        },
        fontFamily: [
          'Inter',
          'sans-serif',
        ],
        fontSize: 24,
        fontWeight: 700,
        cueTextStrokeWidth: 2,
        cueTextStrokeColor: CueColorKeyword.currentColor,
        lineHeight: 30,
        textAlign: CueTextAlign.center,
        whiteSpace: CueWhiteSpace.preWrap,
      },
      selectors: [
        [
          'parent',
        ],
      ],
    },
    {
      declarations: {
        color: {
          alpha: 1,
          blue: 60,
          green: 50,
          red: 40,
        },
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

describe('computeCueElementStyle', () => {
  test('uses Web CSS initial values for supported inherited text properties', () => {
    /// @case
    /// A new element has no text declarations or inherited parent style.
    /// @expect
    /// Standard text defaults and the disabled Cue stroke defaults are applied.
    const style = computeCueElementStyle(new DivElement(), []);

    expect({
      color: style.color,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      fontWeight: style.fontWeight,
      cueTextStrokeWidth: style.cueTextStrokeWidth,
      cueTextStrokeColor: style.cueTextStrokeColor,
      lineHeight: style.lineHeight,
      textAlign: style.textAlign,
      whiteSpace: style.whiteSpace,
    }).toEqual(initialCueTextStyle);
    expect(style.lineHeight).toBe(CueLineHeightKeyword.normal);
    expect(style.textAlign).toBe(CueTextAlign.start);
    expect(style.whiteSpace).toBe(CueWhiteSpace.normal);
  });

  test('inherits text properties and lets matching declarations override them', () => {
    /// @case
    /// A child overrides its color beneath a parent with bold outlined text.
    /// @expect
    /// It inherits the parent's weight, stroke width, and computed stroke color.
    const parent = new DivElement();
    patchCueElementProperty(parent, 'class', undefined, 'parent');
    const parentStyle = computeCueElementStyle(parent, [styleSheet]);
    const child = new DivElement();
    patchCueElementProperty(child, 'class', undefined, 'child');

    const childStyle = computeCueElementStyle(
      child,
      [styleSheet],
      parentStyle,
    );

    expect(childStyle).toMatchObject({
      color: {
        alpha: 1,
        blue: 60,
        green: 50,
        red: 40,
      },
      fontFamily: [
        'Inter',
        'sans-serif',
      ],
      fontSize: 24,
      fontWeight: 700,
      cueTextStrokeWidth: 2,
      cueTextStrokeColor: {
        alpha: 0.75,
        blue: 30,
        green: 20,
        red: 10,
      },
      lineHeight: 30,
      textAlign: CueTextAlign.center,
      whiteSpace: CueWhiteSpace.preWrap,
    });
  });

  test('computes currentColor for each border side after color cascade', () => {
    /// @case
    /// A rule changes color and uses the CSS initial currentColor border color with one visible side.
    /// @expect
    /// The computed border color follows the element's computed color.
    const element = new DivElement();
    patchCueElementProperty(element, 'class', undefined, 'bordered');
    const color = {
      alpha: 0.8,
      blue: 90,
      green: 60,
      red: 30,
    };

    const style = computeCueElementStyle(element, [{
      rules: [{
        declarations: {
          borderTopColor: CueColorKeyword.currentColor,
          borderTopStyle: CueBorderStyle.solid,
          borderTopWidth: 4,
          color,
        },
        selectors: [['bordered']],
      }],
      version: cueStyleSchemaVersion,
    }]);

    expect(style.borderTopColor).toEqual(color);
    expect(style.borderTopStyle).toBe(CueBorderStyle.solid);
    expect(style.borderTopWidth).toBe(4);
  });
});

export {};

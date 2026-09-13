import {
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
    const style = computeCueElementStyle(new DivElement(), []);

    expect({
      color: style.color,
      fontFamily: style.fontFamily,
      fontSize: style.fontSize,
      lineHeight: style.lineHeight,
      textAlign: style.textAlign,
      whiteSpace: style.whiteSpace,
    }).toEqual(initialCueTextStyle);
    expect(style.lineHeight).toBe(CueLineHeightKeyword.normal);
    expect(style.textAlign).toBe(CueTextAlign.start);
    expect(style.whiteSpace).toBe(CueWhiteSpace.normal);
  });

  test('inherits text properties and lets matching declarations override them', () => {
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
      lineHeight: 30,
      textAlign: CueTextAlign.center,
      whiteSpace: CueWhiteSpace.preWrap,
    });
  });
});

export {};

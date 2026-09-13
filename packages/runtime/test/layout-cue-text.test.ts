import { CueWhiteSpace } from '@bsgames/cue-style-schema';
import {
  describe,
  expect,
  test,
} from 'vitest';
import { layoutCueTextLines } from '../src/text/layout-cue-text.js';

const measureMonospaceWidth = (text: string): number => [...text].length;

describe('layoutCueTextLines', () => {
  test.each([
    {
      availableWidth: 8,
      expectedLines: [
        'Hello',
        'world 中文',
        '测试。',
      ],
      name: 'normal collapses whitespace and wraps at Unicode opportunities',
      text: '  Hello   world\n中文测试。  ',
      whiteSpace: CueWhiteSpace.normal,
    },
    {
      availableWidth: 2,
      expectedLines: [
        'Hello world Cue',
      ],
      name: 'nowrap collapses whitespace without soft wrapping',
      text: '  Hello   world\nCue  ',
      whiteSpace: CueWhiteSpace.nowrap,
    },
    {
      availableWidth: 4,
      expectedLines: [
        ' A  B',
        'C       D ',
      ],
      name: 'pre preserves spaces and hard line breaks without soft wrapping',
      text: ' A  B\nC\tD ',
      whiteSpace: CueWhiteSpace.pre,
    },
    {
      availableWidth: 4,
      expectedLines: [
        ' A  ',
        'B C ',
      ],
      name: 'pre-wrap preserves whitespace and adds soft wrapping',
      text: ' A  B C ',
      whiteSpace: CueWhiteSpace.preWrap,
    },
    {
      availableWidth: 2,
      expectedLines: [
        'A',
        'B',
        'C',
        'D',
      ],
      name: 'pre-line collapses spaces while preserving hard line breaks',
      text: ' A  B\n C D ',
      whiteSpace: CueWhiteSpace.preLine,
    },
  ])('$name', ({
    availableWidth,
    expectedLines,
    text,
    whiteSpace,
  }) => {
    /// @case Text contains spaces and segment breaks under one supported Web CSS white-space mode.
    /// @expect The resulting lines preserve, collapse, and wrap whitespace according to that mode.
    const lines = layoutCueTextLines(
      text,
      whiteSpace,
      availableWidth,
      measureMonospaceWidth,
    );

    expect(lines.map((line) => line.text)).toEqual(expectedLines);
  });

  test('keeps an unbreakable word intact when it is wider than the line', () => {
    /// @case A normal-wrapping line contains a word wider than the available inline size.
    /// @expect The word overflows intact because overflow-wrap does not default to anywhere.
    const lines = layoutCueTextLines(
      'superlong word',
      CueWhiteSpace.normal,
      4,
      measureMonospaceWidth,
    );

    expect(lines.map((line) => line.text)).toEqual([
      'superlong',
      'word',
    ]);
  });

  test('does not collapse or trim a non-breaking space', () => {
    /// @case Normal white-space processing receives NBSP at both line edges.
    /// @expect NBSP remains measurable content because Web CSS does not classify it as collapsible space.
    const lines = layoutCueTextLines(
      '\u00a0Cue\u00a0',
      CueWhiteSpace.normal,
      undefined,
      measureMonospaceWidth,
    );

    expect(lines.map((line) => line.text)).toEqual([
      '\u00a0Cue\u00a0',
    ]);
  });
});

export {};

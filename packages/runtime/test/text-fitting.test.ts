import { beforeAll, describe, expect, it } from 'vitest';
import {
  BrElement,
  CueRootElement,
  CueDisplay,
  CueTextFit,
  CueWhiteSpace,
  DivElement,
  SpanElement,
  Text,
  Length,
} from '../src/index.js';
import {
  CueLayout,
  createCuePaintList,
  initializeCueLayout,
  type CueTextMeasurer,
} from '../src/render/create-cue-paint-list.js';

const measurer: CueTextMeasurer = {
  measureWidth: (text, style) =>
    ([...new Intl.Segmenter().segment(text)].length * style.fontSize) / 2,
  metrics: (style) => ({
    ascent: style.fontSize * 0.75,
    descent: style.fontSize * 0.25,
    xHeight: style.fontSize / 2,
    lineHeight: typeof style.lineHeight === 'number' ? style.lineHeight : style.fontSize,
  }),
  layout: () => {
    throw new Error('Inline text must use the shared line formatter.');
  },
};

describe('text wrapping and fitting in rendered elements', () => {
  beforeAll(initializeCueLayout);

  it.each([
    [
      { overflowWrap: 'anywhere' },
      [
        'a',
        'bcde',
        'f',
      ],
    ],
    [{ wordBreak: 'break-all' }, ['a bc', 'def']],
    [{ overflowWrap: 'normal' }, ['a', 'bcdef']],
    [{ overflowWrap: 'anywhere', whiteSpace: 'nowrap' }, ['a bcdef']],
    [{ wordBreak: 'break-all', whiteSpace: 'pre' }, ['a bcdef']],
  ])('distinguishes emergency breaking from break-all: %j', (style, expected) => {
    /// @case A long word follows a short word in a four-character-wide box.
    /// @expect Anywhere prefers the space; break-all fills the line; nowrap/pre prohibit soft
    /// wrapping.
    const root = new CueRootElement();
    const block = new DivElement();
    Object.assign(block.style, { width: 32, ...style });
    block.insertBefore(new Text('a bcdef'));
    root.insertBefore(block);
    const list = createCuePaintList(
      root,
      [],
      measurer,
      () => undefined,
      () => undefined,
    );
    expect(
      list.commands
        .filter((entry) => entry.kind === 'text')
        .map((entry) => entry.paint.lines[0]!.text),
    ).toEqual(expected);
  });

  it('breaks long words across spans without splitting grapheme clusters', () => {
    /// @case An inherited emergency-break style applies to emoji and combining characters across
    /// inline boxes.
    /// @expect Each grapheme remains whole and the span boundary does not disable emergency
    /// wrapping.
    const root = new CueRootElement();
    const block = new DivElement();
    Object.assign(block.style, { width: 8, overflowWrap: 'anywhere' });
    block.insertBefore(new Text('a\u0301'));
    const span = new SpanElement();
    span.insertBefore(new Text('👩‍👩‍👧‍👦B'));
    block.insertBefore(span);
    root.insertBefore(block);
    const paints = createCuePaintList(
      root,
      [],
      measurer,
      () => undefined,
      () => undefined,
    )
      .commands.filter((entry) => entry.kind === 'text')
      .map((entry) => entry.paint);
    expect(paints.map((paint) => paint.lines[0]!.text)).toEqual([
      'a\u0301',
      '👩‍👩‍👧‍👦',
      'B',
    ]);
    expect(paints.map((paint) => -paint.y)).toEqual([
      0,
      16,
      32,
    ]);
  });

  it('fits text after wrapping without changing the specified font size', () => {
    /// @case A nowrap label is resized from half its natural width to wider than its text.
    /// @expect Used font size shrinks and recovers; author font size is unchanged and shrink
    /// never grows text.
    const root = new CueRootElement();
    const block = new DivElement();
    Object.assign(block.style, {
      width: 24,
      fontSize: 16,
      whiteSpace: 'nowrap',
      textFit: 'shrink',
    });
    block.insertBefore(new Text('abcdef'));
    root.insertBefore(block);
    for (const [width, fontSize] of [
      [24, 8],
      [96, 16],
    ] as const) {
      block.style.width = width;
      const paint = createCuePaintList(
        root,
        [],
        measurer,
        () => undefined,
        () => undefined,
      ).commands.find((entry) => entry.kind === 'text')!.paint;
      expect(paint.style.fontSize).toBe(fontSize);
      expect(paint.width).toBe(fontSize * 3);
      expect(block.style.fontSize).toBe(16);
    }
  });

  it.each([undefined, 24])(
    'uses one fitting factor across lines with line-height %s',
    (lineHeight) => {
      /// @case Preserved lines have different lengths, with one line overflowing.
      /// @expect Both lines shrink consistently, while the explicit line-height remains unchanged.
      const root = new CueRootElement();
      const block = new DivElement();
      Object.assign(block.style, {
        width: 24,
        whiteSpace: 'pre',
        textFit: 'shrink',
      });
      block.style.lineHeight
        = lineHeight === undefined ? undefined : Length.px(lineHeight);
      block.insertBefore(new Text('abcdef\nabc'));
      root.insertBefore(block);
      const paints = createCuePaintList(
        root,
        [],
        measurer,
        () => undefined,
        () => undefined,
      )
        .commands.filter((entry) => entry.kind === 'text')
        .map((entry) => entry.paint);
      expect(paints.map((paint) => paint.style.fontSize)).toEqual([8, 8]);
      expect(paints.map((paint) => paint.width)).toEqual([24, 12]);
      expect(paints[1]!.y).toBe(paints[0]!.y - (lineHeight ?? 8));
    },
  );

  it('fits inline text but not padding or atomic boxes', () => {
    /// @case A nowrap line includes a padded span and a fixed-size inline-block.
    /// @expect Only text shrinks; fixed edges/atomic geometry consume their original share of the
    /// line.
    const root = new CueRootElement();
    const block = new DivElement();
    Object.assign(block.style, {
      width: 40,
      whiteSpace: 'nowrap',
      textFit: 'shrink',
    });
    const span = new SpanElement();
    Object.assign(span.style, { paddingLeft: 4, paddingRight: 4 });
    span.insertBefore(new Text('abcd'));
    const atomic = new SpanElement();
    Object.assign(atomic.style, {
      display: CueDisplay.inlineBlock,
      width: 16,
      height: 20,
    });
    block.insertBefore(span);
    block.insertBefore(atomic);
    root.insertBefore(block);
    const list = createCuePaintList(
      root,
      [],
      measurer,
      () => undefined,
      () => undefined,
    );
    const paint = list.commands.find((entry) => entry.kind === 'text')!.paint;
    expect(paint.style.fontSize).toBe(8);
    expect(paint.x).toBe(4);
    expect(paint.width).toBe(16);
    expect(list.hitRegions.find((entry) => entry.element === atomic)).toMatchObject({
      x: 24,
      width: 16,
      height: 20,
    });
  });

  it('keeps natural wrap opportunities ahead of shrink and excludes trailing whitespace', () => {
    /// @case Text fits when wrapped, or has preserved whitespace beyond its last visible character.
    /// @expect Normal wrapping precedes fitting, and trailing whitespace does not cause extra
    /// shrink.
    const root = new CueRootElement();
    const block = new DivElement();
    Object.assign(block.style, { width: 24, textFit: 'shrink' });
    const text = new Text('abc def');
    block.insertBefore(text);
    root.insertBefore(block);
    let paints = createCuePaintList(
      root,
      [],
      measurer,
      () => undefined,
      () => undefined,
    )
      .commands.filter((entry) => entry.kind === 'text')
      .map((entry) => entry.paint);
    expect(paints.map((paint) => [paint.lines[0]!.text, paint.style.fontSize])).toEqual([
      ['abc', 16],
      ['def', 16],
    ]);
    block.style.whiteSpace = CueWhiteSpace.pre;
    text.data = 'abcdef    ';
    paints = createCuePaintList(
      root,
      [],
      measurer,
      () => undefined,
      () => undefined,
    )
      .commands.filter((entry) => entry.kind === 'text')
      .map((entry) => entry.paint);
    expect(paints[0]!.style.fontSize).toBe(8);
  });

  it('invalidates fitted geometry and retains fresh colors through style changes', () => {
    /// @case A retained layout toggles fitting, then recolors the fitted run and clears the
    /// override.
    /// @expect Used font and color reflect each update without mutating the source font or
    /// keeping stale cached runs.
    const root = new CueRootElement();
    const block = new DivElement();
    Object.assign(block.style, { width: 24, whiteSpace: 'nowrap' });
    block.insertBefore(new Text('abcdef'));
    root.insertBefore(block);
    const layout = new CueLayout(
      root,
      measurer,
      () => undefined,
      () => undefined,
    );
    try {
      expect(
        layout.update([]).commands.find((entry) => entry.kind === 'text')!.paint.style
          .fontSize,
      ).toBe(16);
      block.style.textFit = CueTextFit.shrink;
      expect(
        layout.update([]).commands.find((entry) => entry.kind === 'text')!.paint.style
          .fontSize,
      ).toBe(8);
      block.style.color = {
        red: 255,
        green: 0,
        blue: 0,
        alpha: 1,
      };
      expect(
        layout.update([]).commands.find((entry) => entry.kind === 'text')!.paint.style,
      ).toMatchObject({ fontSize: 8, color: block.style.color });
      block.style.textFit = undefined;
      expect(
        layout.update([]).commands.find((entry) => entry.kind === 'text')!.paint.style
          .fontSize,
      ).toBe(16);
    } finally {
      layout.dispose();
    }
  });

  it('keeps flex automatic minimum sizes independent of text fitting', () => {
    /// @case A flex item with an unbreakable label retains its automatic minimum width, then
    /// explicitly permits shrinking.
    /// @expect text-fit does not erase min-content width; min-width:0 permits fitting within the
    /// narrow flex container.
    const root = new CueRootElement();
    const flex = new DivElement();
    Object.assign(flex.style, { display: CueDisplay.flex, width: 24 });
    const block = new DivElement();
    Object.assign(block.style, {
      whiteSpace: CueWhiteSpace.nowrap,
      textFit: CueTextFit.shrink,
    });
    block.insertBefore(new Text('abcdef'));
    flex.insertBefore(block);
    root.insertBefore(flex);
    for (const [
      minWidth,
      expectedWidth,
      fontSize,
    ] of [
        [
          undefined,
          48,
          16,
        ],
        [
          0,
          24,
          8,
        ],
      ] as const) {
      block.style.minWidth = minWidth;
      const list = createCuePaintList(
        root,
        [],
        measurer,
        () => undefined,
        () => undefined,
      );
      expect(list.hitRegions.find((region) => region.element === block)!.width).toBe(
        expectedWidth,
      );
      expect(
        list.commands.find((entry) => entry.kind === 'text')!.paint.style.fontSize,
      ).toBe(fontSize);
      expect(list.hitRegions.find((region) => region.element === block)!.height).toBe(
        fontSize,
      );
    }
  });

  it('does not shrink text to zero because another line has an oversized atomic box', () => {
    /// @case One forced line contains only an oversized inline-block; another contains shrinkable
    /// text.
    /// @expect A line with no scalable parts has factor one and cannot force the text on other
    /// lines to disappear.
    const root = new CueRootElement();
    const block = new DivElement();
    Object.assign(block.style, {
      width: 24,
      whiteSpace: CueWhiteSpace.pre,
      textFit: CueTextFit.shrink,
    });
    const atomic = new SpanElement();
    Object.assign(atomic.style, {
      display: CueDisplay.inlineBlock,
      width: 80,
      minWidth: 80,
      height: 20,
    });
    block.insertBefore(atomic);
    block.insertBefore(new BrElement());
    block.insertBefore(new Text('abcdef'));
    root.insertBefore(block);
    const list = createCuePaintList(
      root,
      [],
      measurer,
      () => undefined,
      () => undefined,
    );
    expect(
      list.commands.find((entry) => entry.kind === 'text')?.paint.style.fontSize,
    ).toBe(8);
    expect(list.hitRegions.find((region) => region.element === atomic)!.width).toBe(80);
  });

  it.each([{ overflowWrap: 'anywhere' }, { wordBreak: 'break-all' }])(
    'wraps outside a nowrap span according to its ancestor: %j',
    (style) => {
      /// @case A nowrap span is surrounded by text in a parent that permits word breaking.
      /// @expect The span stays whole, but both outside boundaries can wrap according to the
      /// common ancestor.
      const root = new CueRootElement();
      const block = new DivElement();
      Object.assign(block.style, { width: 24, ...style });
      block.insertBefore(new Text('a'));
      const span = new SpanElement();
      span.style.whiteSpace = CueWhiteSpace.nowrap;
      span.insertBefore(new Text('bcde'));
      block.insertBefore(span);
      block.insertBefore(new Text('fg'));
      root.insertBefore(block);
      const paints = createCuePaintList(
        root,
        [],
        measurer,
        () => undefined,
        () => undefined,
      )
        .commands.filter((entry) => entry.kind === 'text')
        .map((entry) => entry.paint);
      expect(paints.map((paint) => [paint.lines[0]!.text, -paint.y])).toEqual([
        ['a', 0],
        ['bcde', 16],
        ['fg', 32],
      ]);
    },
  );

  it.each(
    [{ overflowWrap: 'anywhere' }, { wordBreak: 'break-all' }].flatMap((style) =>
      [8, 16].map((width) => ({ style, width })),
    ),
  )(
    'does not split one boundary twice around an empty inline: %j',
    ({ style, width }) => {
      /// @case An empty padded span sits between letters in a one- or two-character-wide block.
      /// @expect That text boundary is a single break opportunity; the decoration does not
      /// acquire its own extra line.
      const root = new CueRootElement();
      const block = new DivElement();
      Object.assign(block.style, { width, ...style });
      block.insertBefore(new Text('ab'));
      const empty = new SpanElement();
      Object.assign(empty.style, { paddingLeft: 4, paddingRight: 4 });
      block.insertBefore(empty);
      block.insertBefore(new Text('c'));
      root.insertBefore(block);
      const list = createCuePaintList(
        root,
        [],
        measurer,
        () => undefined,
        () => undefined,
      );
      expect(
        list.commands
          .filter((entry) => entry.kind === 'text')
          .map((entry) => [entry.paint.lines[0]!.text, -entry.paint.y]),
      ).toEqual(
        width === 8
          ? [
            ['a', 0],
            ['b', 16],
            ['c', 32],
          ]
          : [
            ['ab', 0],
            ['c', 16],
          ],
      );
      expect(list.hitRegions.find((region) => region.element === block)!.height).toBe(
        width === 8 ? 48 : 32,
      );
    },
  );

  it.each([{ overflowWrap: 'anywhere' }, { wordBreak: 'break-all' }])(
    'distinguishes normal and emergency breaks before a padded whitespace run: %j',
    (style) => {
      /// @case A collapsible-space-only span has padding after two letters in a
      /// two-character-wide block.
      /// @expect break-all reserves the inline edges at a normal break; anywhere does not
      /// prematurely split a word before its trailing space.
      const root = new CueRootElement();
      const block = new DivElement();
      Object.assign(block.style, { width: 16, ...style });
      block.insertBefore(new Text('ab'));
      const span = new SpanElement();
      Object.assign(span.style, { paddingLeft: 4, paddingRight: 4 });
      span.insertBefore(new Text(' '));
      block.insertBefore(span);
      block.insertBefore(new Text('cdef'));
      root.insertBefore(block);
      const list = createCuePaintList(
        root,
        [],
        measurer,
        () => undefined,
        () => undefined,
      );
      expect(
        list.commands
          .filter((entry) => entry.kind === 'text')
          .map((entry) => [entry.paint.lines[0]!.text, -entry.paint.y]),
      ).toEqual(
        style.wordBreak === 'break-all'
          ? [
            ['a', 0],
            ['b', 16],
            ['cd', 32],
            ['ef', 48],
          ]
          : [
            ['ab', 0],
            ['cd', 16],
            ['ef', 32],
          ],
      );
      expect(list.hitRegions.find((region) => region.element === block)!.height).toBe(
        style.wordBreak === 'break-all' ? 64 : 48,
      );
    },
  );
});

export {};

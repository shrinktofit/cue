import {
  CueBorderStyle,
  CueDisplay,
  CueAlignItems,
  CueJustifyContent,
  CuePosition,
  cueStyleSchemaVersion,
  type CueStyleDeclarations,
  type CueStyleSheet,
} from '@bsgames/cue-style-schema';
import {
  beforeAll,
  describe,
  expect,
  test,
} from 'vitest';
import { patchCueElementProperty } from '../src/element/cue-element.js';
import { CueRootElement } from '../src/element/cue-root-element.js';
import { DivElement } from '../src/element/div-element.js';
import { Text } from '../src/element/text.js';
import { CueImageElement } from '../src/element/cue-image-element.js';
import {
  createCuePaintList,
  CuePaintCommandKind,
  initializeCueLayout,
  type CueTextMeasurer,
} from '../src/render/create-cue-paint-list.js';
import { transformCuePaintPoint } from '../src/render/cue-affine-transform.js';

beforeAll(initializeCueLayout);

describe('CSS relative and absolute box positioning', () => {
  test.each([
    { display: CueDisplay.block, position: CuePosition.absolute, x: 10, y: -5 },
    { display: CueDisplay.flex, position: CuePosition.static, x: 0, y: 0 },
  ])('blockifies an inline replaced element in $display / $position layout', ({ display, position, x, y }) => {
    /// @case
    /// A cue-image has no authored display and is absolutely positioned or is a flex item.
    /// @expect
    /// CSS blockification permits layout instead of rejecting the inline initial display.
    const root = new CueRootElement();
    const container = element('container');
    const image = new CueImageElement();
    patchCueElementProperty(image, 'class', undefined, 'image');
    container.insertBefore(image);
    root.insertBefore(container);

    expect(boxes(root, {
      container: { display, height: 100, position: CuePosition.relative, width: 300 },
      image: { height: 10, left: 10, position, top: 5, width: 20 },
    }).at(-1)).toEqual({ height: 10, width: 20, x, y });
  });

  test('relative offsets move descendants while preserving sibling flow and ignore static insets', () => {
    /// @case
    /// Move the first flex item with relative insets; give a static sibling insets too.
    /// @expect
    /// Only the relative item and its child move; the sibling keeps its original slot.
    const root = new CueRootElement();
    const container = element('container');
    const first = element('first');
    first.insertBefore(element('child'));
    container.insertBefore(first);
    container.insertBefore(element('second'));
    root.insertBefore(container);

    expect(boxes(root, {
      child: { height: 5, width: 5 },
      container: { display: CueDisplay.flex, height: 100, width: 300 },
      first: { height: 40, left: 15, position: CuePosition.relative, top: -10, width: 80 },
      second: { height: 40, left: 99, top: 99, width: 60 },
    })).toEqual([
      { height: 100, width: 300, x: 0, y: 0 },
      { height: 40, width: 60, x: 80, y: 0 },
      { height: 40, width: 80, x: 15, y: 10 },
      { height: 5, width: 5, x: 15, y: 10 },
    ]);
  });

  test('absolute children use the containing padding box and do not consume flex space', () => {
    /// @case
    /// Put a percentage-sized overlay between two flex items in a padded, bordered parent.
    /// @expect
    /// Insets and percentages use the padding box, while normal siblings remain adjacent.
    const root = new CueRootElement();
    const container = element('container');
    container.insertBefore(element('first'));
    container.insertBefore(element('overlay'));
    container.insertBefore(element('second'));
    root.insertBefore(container);

    expect(boxes(root, {
      container: {
        borderBottomStyle: CueBorderStyle.solid,
        borderBottomWidth: 5,
        borderLeftStyle: CueBorderStyle.solid,
        borderLeftWidth: 5,
        borderRightStyle: CueBorderStyle.solid,
        borderRightWidth: 5,
        borderTopStyle: CueBorderStyle.solid,
        borderTopWidth: 5,
        display: CueDisplay.flex,
        height: 100,
        paddingBottom: 10,
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 10,
        position: CuePosition.relative,
        width: 200,
      },
      first: { height: 20, width: 30 },
      overlay: { height: '50%', left: '10%', position: CuePosition.absolute, top: '25%', width: '50%' },
      second: { height: 20, width: 40 },
    })).toEqual([
      { height: 130, width: 230, x: 0, y: 0 },
      { height: 20, width: 30, x: 15, y: -15 },
      { height: 20, width: 40, x: 45, y: -15 },
      { height: 60, width: 110, x: 27, y: -35 },
    ]);
  });

  test('absolute positioning crosses static ancestors and opposing insets stretch auto dimensions', () => {
    /// @case
    /// An absolute box lives inside an offset static wrapper below a positioned ancestor.
    /// @expect
    /// The ancestor supplies both position and available size; the wrapper supplies neither.
    const root = new CueRootElement();
    const container = element('container');
    const wrapper = element('wrapper');
    wrapper.insertBefore(element('overlay'));
    container.insertBefore(wrapper);
    root.insertBefore(container);

    expect(boxes(root, {
      container: { height: 160, position: CuePosition.relative, width: 300 },
      overlay: { bottom: 20, left: 10, position: CuePosition.absolute, right: 30, top: 15 },
      wrapper: { height: 50, marginLeft: 70, marginTop: 40, width: 100 },
    })).toEqual([
      { height: 160, width: 300, x: 0, y: 0 },
      { height: 50, width: 100, x: 70, y: -40 },
      { height: 125, width: 260, x: 10, y: -15 },
    ]);
  });

  test('nested absolute elements establish their own containing blocks', () => {
    /// @case
    /// Anchor a parent to the lower right, then anchor its child to the upper left.
    /// @expect
    /// The child insets use the absolute parent, not the outer positioned element.
    const root = new CueRootElement();
    const container = element('container');
    const overlay = element('overlay');
    overlay.insertBefore(element('child'));
    container.insertBefore(overlay);
    root.insertBefore(container);

    expect(boxes(root, {
      child: { height: 10, left: 6, position: CuePosition.absolute, top: 8, width: 20 },
      container: { height: 160, position: CuePosition.relative, width: 300 },
      overlay: { bottom: 15, height: 60, position: CuePosition.absolute, right: 25, width: 100 },
    })).toEqual([
      { height: 160, width: 300, x: 0, y: 0 },
      { height: 60, width: 100, x: 175, y: -85 },
      { height: 10, width: 20, x: 181, y: -93 },
    ]);
  });

  test('auto insets preserve the static position through a static block ancestor', () => {
    /// @case
    /// Place an all-auto absolute child after normal content inside an offset wrapper.
    /// @expect
    /// It appears at its original insertion position without increasing wrapper height.
    const root = new CueRootElement();
    const container = element('container');
    const wrapper = element('wrapper');
    wrapper.insertBefore(element('first'));
    wrapper.insertBefore(element('overlay'));
    container.insertBefore(wrapper);
    root.insertBefore(container);

    expect(boxes(root, {
      container: { height: 160, paddingTop: 1, position: CuePosition.relative, width: 300 },
      first: { height: 30, width: 40 },
      overlay: { height: 20, position: CuePosition.absolute, width: 60 },
      wrapper: { marginLeft: 70, marginTop: 39, width: 100 },
    })).toEqual([
      { height: 161, width: 300, x: 0, y: 0 },
      { height: 30, width: 100, x: 70, y: -40 },
      { height: 30, width: 40, x: 70, y: -40 },
      { height: 20, width: 60, x: 70, y: -70 },
    ]);
  });

  test('sizing changes and inserting normal content recompute the absolute layout', () => {
    /// @case
    /// Resize a positioned container and insert a sibling before its absolute child.
    /// @expect
    /// A percentage-sized right-anchored child follows its containing block and stays out of flow.
    const root = new CueRootElement();
    const container = element('container');
    const overlay = element('overlay');
    container.insertBefore(overlay);
    root.insertBefore(container);
    const styles = {
      container: { height: 100, position: CuePosition.relative, width: 200 },
      inserted: { height: 20, width: 50 },
      overlay: { height: 20, position: CuePosition.absolute, right: 10, top: 5, width: '50%' },
    } as const;

    expect(boxes(root, styles)).toEqual([
      { height: 100, width: 200, x: 0, y: 0 },
      { height: 20, width: 100, x: 90, y: -5 },
    ]);
    container.insertBefore(element('inserted'), overlay);
    expect(boxes(root, {
      ...styles,
      container: { ...styles.container, width: 320 },
    })).toEqual([
      { height: 100, width: 320, x: 0, y: 0 },
      { height: 20, width: 50, x: 0, y: 0 },
      { height: 20, width: 160, x: 150, y: -5 },
    ]);
  });

  test('auto insets honor the original flex alignment across static ancestors', () => {
    /// @case
    /// Center a fixed-size absolute child in a static flex wrapper.
    /// @expect
    /// Static placement uses the flex wrapper while sizing uses the positioned ancestor.
    const root = new CueRootElement();
    const container = element('container');
    const wrapper = element('wrapper');
    wrapper.insertBefore(element('overlay'));
    container.insertBefore(wrapper);
    root.insertBefore(container);

    expect(boxes(root, {
      container: { height: 160, paddingTop: 1, position: CuePosition.relative, width: 300 },
      overlay: { height: 20, position: CuePosition.absolute, width: 60 },
      wrapper: {
        alignItems: CueAlignItems.center,
        display: CueDisplay.flex,
        height: 80,
        justifyContent: CueJustifyContent.center,
        marginLeft: 70,
        marginTop: 39,
        width: 100,
      },
    })).toEqual([
      { height: 161, width: 300, x: 0, y: 0 },
      { height: 80, width: 100, x: 70, y: -40 },
      { height: 20, width: 60, x: 90, y: -70 },
    ]);
  });

  test('percentage margins use the absolute containing block during static placement', () => {
    /// @case
    /// An all-auto absolute box has percentage margins inside a narrower static wrapper.
    /// @expect
    /// Its margins use the positioned ancestor width, not the wrapper width.
    const root = new CueRootElement();
    const container = element('container');
    const wrapper = element('wrapper');
    wrapper.insertBefore(element('overlay'));
    container.insertBefore(wrapper);
    root.insertBefore(container);

    expect(boxes(root, {
      container: { height: 160, paddingTop: 1, position: CuePosition.relative, width: 300 },
      overlay: { height: 20, marginLeft: '10%', marginTop: '10%', position: CuePosition.absolute, width: 60 },
      wrapper: { height: 40, marginLeft: 70, marginTop: 39, width: 100 },
    })).toEqual([
      { height: 161, width: 300, x: 0, y: 0 },
      { height: 40, width: 100, x: 70, y: -40 },
      { height: 20, width: 60, x: 100, y: -70 },
    ]);
  });

  test('auto width fits the containing space remaining after its static position', () => {
    /// @case
    /// Wrappable text with auto width starts inside an offset static wrapper.
    /// @expect
    /// Its shrink-to-fit width stops at the containing block end instead of overflowing it.
    const root = new CueRootElement();
    const container = element('container');
    const wrapper = element('wrapper');
    const overlay = element('overlay');
    overlay.insertBefore(new Text('字'.repeat(10)));
    wrapper.insertBefore(overlay);
    container.insertBefore(wrapper);
    root.insertBefore(container);

    expect(boxes(root, {
      container: { height: 160, position: CuePosition.relative, width: 300 },
      overlay: { position: CuePosition.absolute },
      wrapper: { height: 40, marginLeft: 70, width: 100 },
    }, undefined, {
      metrics: () => ({ ascent: 15, descent: 5, xHeight: 8, lineHeight: 20 }),
      layout: (text) => ({ height: 20, lines: [{ text, width: text.length * 40 }], width: text.length * 40 }),
    })).toEqual([
      { height: 160, width: 300, x: 0, y: 0 },
      { height: 40, width: 100, x: 70, y: 0 },
      { height: 40, width: 230, x: 70, y: 0 },
    ]);
  });

  test('one auto axis retains insertion position through multiple static ancestors', () => {
    /// @case
    /// An absolute box has left set but vertical insets auto inside two static wrappers.
    /// @expect
    /// Horizontal position uses the containing block; vertical position uses the original flow location.
    const root = new CueRootElement();
    const container = element('container');
    const wrapper = element('wrapper');
    const inner = element('inner');
    inner.insertBefore(element('first'));
    inner.insertBefore(element('overlay'));
    wrapper.insertBefore(inner);
    container.insertBefore(wrapper);
    root.insertBefore(container);

    expect(boxes(root, {
      container: { height: 160, paddingTop: 1, position: CuePosition.relative, width: 300 },
      first: { height: 30, width: 40 },
      inner: { paddingTop: 10, width: 80 },
      overlay: { height: 20, left: 10, position: CuePosition.absolute, width: 60 },
      wrapper: { marginLeft: 70, marginTop: 39, width: 100 },
    })).toEqual([
      { height: 161, width: 300, x: 0, y: 0 },
      { height: 40, width: 100, x: 70, y: -40 },
      { height: 40, width: 80, x: 70, y: -40 },
      { height: 30, width: 40, x: 70, y: -50 },
      { height: 20, width: 60, x: 10, y: -80 },
    ]);
  });

  test.each([
    { contentWidth: 400, height: 40, width: 240, x: 0, y: -20 },
    { contentWidth: 40, height: 20, width: 40, x: 100, y: -30 },
  ])('centered static placement shrink-wraps $contentWidth px of content', ({ contentWidth, ...expected }) => {
    /// @case
    /// Auto-width text belongs to a centered static flex wrapper inside a larger positioned ancestor.
    /// @expect
    /// Long text fits symmetrically around the static center; short text retains its intrinsic width.
    const root = new CueRootElement();
    const container = element('container');
    const wrapper = element('wrapper');
    const overlay = element('overlay');
    overlay.insertBefore(new Text('字'.repeat(contentWidth / 40)));
    wrapper.insertBefore(overlay);
    container.insertBefore(wrapper);
    root.insertBefore(container);

    expect(boxes(root, {
      container: { height: 160, position: CuePosition.relative, width: 300 },
      overlay: { position: CuePosition.absolute },
      wrapper: {
        alignItems: CueAlignItems.center,
        display: CueDisplay.flex,
        height: 80,
        justifyContent: CueJustifyContent.center,
        marginLeft: 70,
        width: 100,
      },
    }, undefined, {
      metrics: () => ({ ascent: 15, descent: 5, xHeight: 8, lineHeight: 20 }),
      layout: (text) => ({ height: 20, lines: [{ text, width: text.length * 40 }], width: text.length * 40 }),
    }).at(-1)).toEqual(expected);
  });

  test('a single authored inset reduces auto-width available space', () => {
    /// @case
    /// A direct absolute text child has a 70px left inset in a 300px containing block.
    /// @expect
    /// Its auto width measures against 230px and the inset remains 70px after measurement.
    const root = new CueRootElement();
    const container = element('container');
    const overlay = element('overlay');
    overlay.insertBefore(new Text('字'.repeat(10)));
    container.insertBefore(overlay);
    root.insertBefore(container);

    expect(boxes(root, {
      container: { height: 160, position: CuePosition.relative, width: 300 },
      overlay: { left: 70, position: CuePosition.absolute, top: 0 },
    }, undefined, {
      metrics: () => ({ ascent: 15, descent: 5, xHeight: 8, lineHeight: 20 }),
      layout: (text) => ({ height: 20, lines: [{ text, width: text.length * 40 }], width: text.length * 40 }),
    }).at(-1)).toEqual({ height: 40, width: 230, x: 70, y: 0 });
  });

  test('a transformed static ancestor establishes an absolute containing block', () => {
    /// @case
    /// A static wrapper has a translation and contains a lower-right anchored absolute child.
    /// @expect
    /// The child anchors to the wrapper and inherits its transform once.
    const root = new CueRootElement();
    const container = element('container');
    const wrapper = element('wrapper');
    wrapper.insertBefore(element('overlay'));
    container.insertBefore(wrapper);
    root.insertBefore(container);

    expect(boxes(root, {
      container: { height: 160, paddingTop: 1, position: CuePosition.relative, width: 300 },
      overlay: { bottom: 6, height: 10, position: CuePosition.absolute, right: 5, width: 20 },
      wrapper: {
        height: 60,
        marginLeft: 70,
        marginTop: 39,
        transform: [{ type: 'translate', x: 30, y: 20 }],
        width: 100,
      },
    })).toEqual([
      { height: 161, width: 300, x: 0, y: 0 },
      { height: 60, width: 100, x: 100, y: -60 },
      { height: 10, width: 20, x: 175, y: -104 },
    ]);
  });

  test('unpositioned ancestry anchors an absolute box to the document viewport', () => {
    /// @case
    /// A static wrapper contains a percentage-sized absolute child with right and bottom insets.
    /// @expect
    /// The initial containing block is the supplied document viewport.
    const root = new CueRootElement();
    const wrapper = element('wrapper');
    wrapper.insertBefore(element('overlay'));
    root.insertBefore(wrapper);

    expect(boxes(root, {
      overlay: { bottom: 10, height: '25%', position: CuePosition.absolute, right: 20, width: '50%' },
      wrapper: { height: 60, marginLeft: 40, width: 100 },
    }, { height: 240, width: 400 })).toEqual([
      { height: 60, width: 100, x: 40, y: 0 },
      { height: 60, width: 200, x: 180, y: -170 },
    ]);
  });
});

function element(className: string): DivElement {
  const result = new DivElement();
  patchCueElementProperty(result, 'class', undefined, className);
  return result;
}

function boxes(
  root: CueRootElement,
  declarations: Readonly<Record<string, CueStyleDeclarations>>,
  viewport?: { height: number; width: number },
  textMeasurer: CueTextMeasurer = { metrics: () => ({ ascent: 0, descent: 0, xHeight: 0, lineHeight: 0 }), layout: () => ({ height: 0, lines: [], width: 0 }) },
): Array<{ height: number; width: number; x: number; y: number }> {
  const styleSheet: CueStyleSheet = {
    rules: Object.entries(declarations).map(([className, style]) => ({
      declarations: {
        backgroundColor: { alpha: 1, blue: 0, green: 0, red: 255 },
        ...style,
      },
      selectors: [[{ type: 'class', name: className }]],
    })),
    version: cueStyleSchemaVersion,
  };
  return createCuePaintList(
    root,
    [styleSheet],
    textMeasurer,
    () => undefined,
    () => undefined,
    viewport,
  ).commands.flatMap((command) => {
    if (command.kind !== CuePaintCommandKind.rect) {
      return [];
    }
    const [x, y] = transformCuePaintPoint(command.paint.transform, command.paint.x, command.paint.y);
    return [{ height: command.paint.height, width: command.paint.width, x: x + 0, y: y + 0 }];
  });
}

export {};

import {
  CueDisplay,
  CueOverflow,
  CuePosition,
  cueStyleSchemaVersion,
  type CueColor,
  type CueStyleSheet,
} from '@bsgames/cue-style-schema';
import {
  beforeAll,
  describe,
  expect,
  test,
} from 'vitest';
import { CueRootElement } from '../src/element/cue-root-element.js';
import { DivElement } from '../src/element/div-element.js';
import { patchCueElementProperty } from '../src/element/cue-element.js';
import {
  createCuePaintList,
  CuePaintCommandKind,
  initializeCueLayout,
  type CueTextMeasurer,
} from '../src/render/create-cue-paint-list.js';

const red: CueColor = {
  alpha: 1,
  blue: 0,
  green: 0,
  red: 255,
};
const blue: CueColor = {
  alpha: 1,
  blue: 255,
  green: 0,
  red: 0,
};
const green: CueColor = {
  alpha: 1,
  blue: 0,
  green: 255,
  red: 0,
};

const styleSheet: CueStyleSheet = {
  rules: [
    {
      declarations: {
        display: CueDisplay.flex,
        height: 40,
        overflowX: CueOverflow.hidden,
        overflowY: CueOverflow.hidden,
        width: 80,
      },
      selectors: [[{ type: 'class', name: 'container' }]],
    },
    {
      declarations: {
        backgroundColor: red,
        display: CueDisplay.block,
        height: 10,
        width: 10,
        zIndex: 2,
      },
      selectors: [[{ type: 'class', name: 'high' }]],
    },
    {
      declarations: {
        backgroundColor: blue,
        display: CueDisplay.block,
        height: 10,
        width: 10,
        zIndex: -1,
      },
      selectors: [[{ type: 'class', name: 'low' }]],
    },
    {
      declarations: {
        backgroundColor: green,
        display: CueDisplay.block,
        height: 10,
        cueOpacity: 0,
        width: 10,
      },
      selectors: [[{ type: 'class', name: 'hidden' }]],
    },
  ],
  version: cueStyleSchemaVersion,
};

const textMeasurer: CueTextMeasurer = {
  layout: () => ({
    height: 0,
    lines: [],
    width: 0,
  }),
};

beforeAll(async () => {
  await initializeCueLayout();
});

describe('createCuePaintList', () => {
  test.each([
    { display: CueDisplay.block, position: CuePosition.relative },
    { display: CueDisplay.block, position: CuePosition.absolute },
    { display: CueDisplay.flex, position: CuePosition.relative },
    { display: CueDisplay.flex, position: CuePosition.absolute },
  ])('paints $position auto-level siblings after $display normal flow', ({ display, position }) => {
    /// @case
    /// A positioned box precedes a normal-flow box and overlaps its layout area.
    /// @expect
    /// The normal-flow box paints first; relative and absolute auto-level boxes remain on top.
    const root = new CueRootElement();
    const container = elementWithClass('container');
    container.insertBefore(elementWithClass('positioned'));
    container.insertBefore(elementWithClass('normal'));
    root.insertBefore(container);

    const paintList = createCuePaintList(root, [{
      rules: [
        { declarations: { display, height: 100, position: CuePosition.relative, width: 200 }, selectors: [[{ type: 'class', name: 'container' }]] },
        { declarations: { backgroundColor: red, height: 40, left: 20, position, top: 20, width: 40 }, selectors: [[{ type: 'class', name: 'positioned' }]] },
        { declarations: { backgroundColor: blue, height: 40, width: 40 }, selectors: [[{ type: 'class', name: 'normal' }]] },
      ],
      version: cueStyleSchemaVersion,
    }], textMeasurer, () => undefined, () => undefined);

    expect(paintList.commands.flatMap((command) => command.kind === CuePaintCommandKind.rect
      ? [command.paint.color]
      : [])).toEqual([blue, red]);
  });

  test.each([CueDisplay.block, CueDisplay.flex])('orders %s siblings by CSS paint phase and stable integer z-index', (display) => {
    /// @case
    /// Mix negative, normal, auto, zero and positive levels, with a static box declaring z-index:0.
    /// @expect
    /// Normal flow precedes positioned zero levels; static z-index participates only for flex items.
    const root = new CueRootElement();
    const container = elementWithClass('container');
    const cases = [
      { color: 1, name: 'positive-high', position: CuePosition.relative, zIndex: 3 },
      { color: 2, name: 'positioned-auto', position: CuePosition.relative, zIndex: 'auto' as const },
      { color: 3, name: 'static-zero', position: CuePosition.static, zIndex: 0 },
      { color: 4, name: 'normal', position: CuePosition.static, zIndex: 'auto' as const },
      { color: 5, name: 'negative', position: CuePosition.relative, zIndex: -1 },
      { color: 6, name: 'positioned-zero', position: CuePosition.absolute, zIndex: 0 },
      { color: 7, name: 'positive-low', position: CuePosition.relative, zIndex: 1 },
    ];
    for (const entry of cases) {
      container.insertBefore(elementWithClass(entry.name));
    }
    root.insertBefore(container);
    const paintList = createCuePaintList(root, [{
      rules: [
        { declarations: { display, height: 100, position: CuePosition.relative, width: 500 }, selectors: [[{ type: 'class', name: 'container' }]] },
        ...cases.map((entry) => ({
          declarations: {
            backgroundColor: { alpha: 1, blue: 0, green: 0, red: entry.color },
            height: 20,
            position: entry.position,
            width: 20,
            zIndex: entry.zIndex,
          },
          selectors: [[{ type: 'class', name: entry.name }]],
        })),
      ],
      version: cueStyleSchemaVersion,
    }], textMeasurer, () => undefined, () => undefined);

    expect(paintList.commands.flatMap((command) => command.kind === CuePaintCommandKind.rect
      ? [command.paint.color.red]
      : [])).toEqual(display === CueDisplay.flex
      ? [5, 4, 2, 3, 6, 7, 1]
      : [5, 3, 4, 2, 6, 7, 1]);
  });

  test('clips descendants, applies flex-item z-index order, and skips zero Cue-opacity subtrees', () => {
    const root = new CueRootElement();
    const container = elementWithClass('container');
    container.insertBefore(elementWithClass('high'));
    container.insertBefore(elementWithClass('hidden'));
    container.insertBefore(elementWithClass('low'));
    root.insertBefore(container);

    const paintList = createCuePaintList(
      root,
      [styleSheet],
      textMeasurer,
      () => undefined,
      () => undefined,
    );

    expect(paintList.commands.map((command) => command.kind)).toEqual([
      CuePaintCommandKind.clipEnter,
      CuePaintCommandKind.rect,
      CuePaintCommandKind.rect,
      CuePaintCommandKind.clipExit,
    ]);
    const colors = paintList.commands
      .filter((command) => command.kind === CuePaintCommandKind.rect)
      .map((command) => command.paint.color);
    expect(colors).toEqual([
      blue,
      red,
    ]);
  });

  test('multiplies ancestor and child Cue opacity without group compositing', () => {
    const root = new CueRootElement();
    const parent = elementWithClass('faded-parent');
    parent.insertBefore(elementWithClass('faded-child'));
    root.insertBefore(parent);
    const fadeStyleSheet: CueStyleSheet = {
      rules: [
        {
          declarations: {
            backgroundColor: red,
            cueOpacity: 0.5,
            display: CueDisplay.flex,
            height: 40,
            width: 80,
          },
          selectors: [[{ type: 'class', name: 'faded-parent' }]],
        },
        {
          declarations: {
            backgroundColor: blue,
            cueOpacity: 0.5,
            display: CueDisplay.block,
            height: 20,
            width: 20,
          },
          selectors: [[{ type: 'class', name: 'faded-child' }]],
        },
      ],
      version: cueStyleSchemaVersion,
    };

    const paintList = createCuePaintList(
      root,
      [fadeStyleSheet],
      textMeasurer,
      () => undefined,
      () => undefined,
    );
    const paints = paintList.commands
      .filter((command) => command.kind === CuePaintCommandKind.rect)
      .map((command) => ({
        color: command.paint.color,
        opacity: command.paint.opacity,
      }));

    expect(paints).toEqual([
      { color: red, opacity: 0.5 },
      { color: blue, opacity: 0.25 },
    ]);
  });
});

function elementWithClass(className: string): DivElement {
  const element = new DivElement();
  patchCueElementProperty(element, 'class', undefined, className);
  return element;
}

export {};

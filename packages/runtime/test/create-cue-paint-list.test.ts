import {
  CueDisplay,
  CueOverflow,
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
      selectors: [['container']],
    },
    {
      declarations: {
        backgroundColor: red,
        display: CueDisplay.block,
        height: 10,
        width: 10,
        zIndex: 2,
      },
      selectors: [['high']],
    },
    {
      declarations: {
        backgroundColor: blue,
        display: CueDisplay.block,
        height: 10,
        width: 10,
        zIndex: -1,
      },
      selectors: [['low']],
    },
    {
      declarations: {
        backgroundColor: green,
        display: CueDisplay.block,
        height: 10,
        cueOpacity: 0,
        width: 10,
      },
      selectors: [['hidden']],
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
          selectors: [['faded-parent']],
        },
        {
          declarations: {
            backgroundColor: blue,
            cueOpacity: 0.5,
            display: CueDisplay.block,
            height: 20,
            width: 20,
          },
          selectors: [['faded-child']],
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

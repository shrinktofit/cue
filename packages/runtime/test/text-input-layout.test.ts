import {
  CueLineHeightKeyword,
  CueTextAlign,
  cueStyleSchemaVersion,
  type CueStyleSheet,
} from '@bsgames/cue-style-schema';
import { beforeAll, describe, expect, it } from 'vitest';
import { CueTextInputElement } from '../src/builtin-controls/text-input/cue-text-input-element.js';
import { updateCueTextInputLayout } from '../src/builtin-controls/text-input/cue-editable-input-element.js';
import { CueRootElement } from '../src/element/cue-root-element.js';
import { DivElement } from '../src/element/div-element.js';
import { CueFocusController } from '../src/input/cue-focus-controller.js';
import { Length } from '../src/style/length.js';
import { computeCueElementStyle } from '../src/style/compute-cue-element-style.js';
import {
  createCuePaintList,
  CuePaintCommandKind,
  initializeCueLayout,
  type CueTextMeasurer,
} from '../src/render/create-cue-paint-list.js';
import { layoutCueTextLines } from '../src/text/layout-cue-text.js';

const normalColor = { red: 240, green: 240, blue: 240, alpha: 1 };
const placeholderColor = { red: 250, green: 160, blue: 30, alpha: 1 };
const styleSheets: CueStyleSheet[] = [{
  version: cueStyleSchemaVersion,
  rules: [
    {
      selectors: [[{ type: 'class', name: 'cue-input-text' }]],
      declarations: { color: normalColor, fontSize: 16, lineHeight: 20 },
    },
    {
      selectors: [[{ type: 'class', name: 'cue-input-placeholder' }]],
      declarations: { color: placeholderColor, fontSize: 32, lineHeight: 48 },
    },
  ],
}];

const textMeasurer: CueTextMeasurer = {
  metrics: (style) => ({ ascent: style.fontSize * 0.8, descent: style.fontSize * 0.2, xHeight: style.fontSize / 2, lineHeight: style.lineHeight === CueLineHeightKeyword.normal ? style.fontSize * 1.2 : style.lineHeight }),
  layout(text, style, availableWidth) {
    const lines = layoutCueTextLines(text, style.whiteSpace, availableWidth, (line) => line.length * style.fontSize / 2);
    return {
      lines,
      height: lines.length * (style.lineHeight === CueLineHeightKeyword.normal ? style.fontSize * 1.2 : style.lineHeight),
      width: Math.max(0, ...lines.map((line) => line.width)),
    };
  },
};

beforeAll(async () => {
  await initializeCueLayout();
});

describe('Text input CSS and editing geometry in rendered output', () => {
  it('lets author CSS override the default translucent placeholder skin', () => {
    /// @case
    /// A placeholder theme requests full opacity after first rendering with the default skin.
    /// @expect
    /// Default translucency remains available but is not forced through a high-priority inline override.
    const root = new CueRootElement();
    const input = new CueTextInputElement();
    input.placeholder = 'hint';
    root.insertBefore(input);
    const initial = paintInputCommands(root, input, styleSheets)
      .find((command) => command.kind === CuePaintCommandKind.text);
    expect(initial?.paint.opacity).toBe(0.55);
    const themed = paintInputCommands(root, input, [...styleSheets, {
      version: cueStyleSchemaVersion,
      rules: [{
        selectors: [[{ type: 'class', name: 'cue-input-placeholder' }]],
        declarations: { cueOpacity: 1 },
      }],
    }]).find((command) => command.kind === CuePaintCommandKind.text);
    expect(themed?.paint.opacity).toBe(1);
  });

  it('uses placeholder typography and color only while the input is empty', () => {
    /// @case
    /// A themed input alternates between its placeholder and an actual value, then becomes empty again.
    /// @expect
    /// Production text paints use the placeholder theme and line height only for the placeholder.
    const root = new CueRootElement();
    const input = new CueTextInputElement();
    input.style.height = 100;
    input.placeholder = 'hint';
    root.insertBefore(input);
    expect(paintInput(root, input)).toEqual([
      { text: 'hint', fontSize: 32, height: 48, color: placeholderColor },
    ]);
    input.value = 'text';
    expect(paintInput(root, input)).toEqual([
      { text: 'text', fontSize: 16, height: 20, color: normalColor },
    ]);
    input.value = '';
    expect(paintInput(root, input)).toEqual([
      { text: 'hint', fontSize: 32, height: 48, color: placeholderColor },
    ]);
  });

  it('measures and wraps a multiline placeholder with its own CSS font metrics', () => {
    /// @case
    /// The placeholder uses a larger font than entered text in the same narrow multiline input.
    /// @expect
    /// Every placeholder line receives its theme, and changing to actual text reflows using normal metrics.
    const root = new CueRootElement();
    const input = new CueTextInputElement();
    input.style.width = 100;
    input.style.height = 200;
    input.multiline = true;
    input.placeholder = 'aa bb cc';
    root.insertBefore(input);
    expect(paintInput(root, input)).toEqual([
      { text: 'aa ', fontSize: 32, height: 48, color: placeholderColor },
      { text: 'bb cc', fontSize: 32, height: 48, color: placeholderColor },
    ]);
    input.value = 'aa bb cc';
    expect(paintInput(root, input)).toEqual([
      { text: 'aa bb cc', fontSize: 16, height: 20, color: normalColor },
    ]);
  });

  it('positions text using percentage padding computed from the containing block', () => {
    /// @case
    /// A 240px input has padding-left:10% inside a 400px parent.
    /// @expect
    /// The rendered text begins after 40px padding plus the 1px border, not 10% of the input width.
    const root = new CueRootElement();
    const container = new DivElement();
    container.style.width = 400;
    container.style.height = 100;
    root.insertBefore(container);
    const input = new CueTextInputElement();
    input.style.paddingLeft = Length.percent(10);
    input.value = 'text';
    container.insertBefore(input);
    const text = paintInputCommands(root, input, styleSheets)
      .find((command) => command.kind === CuePaintCommandKind.text);
    expect(text?.paint.x).toBe(41);
  });

  it('keeps the caret aligned with a centered text part using a custom font size', () => {
    /// @case
    /// CSS gives the text part a 32px centered font while the input host retains its default 16px font.
    /// @expect
    /// The actual caret paint ends at the visible text edge and uses the same 48px line height.
    const root = new CueRootElement();
    const input = new CueTextInputElement();
    input.style.height = 100;
    input.value = 'abcd';
    root.insertBefore(input);
    const focus = new CueFocusController(root);
    try {
      input.focus();
      input.setSelectionRange(4, 4);
      const commands = paintInputCommands(root, input, [{
        version: cueStyleSchemaVersion,
        rules: [
          {
            selectors: [[{ type: 'class', name: 'cue-input-text' }]],
            declarations: { fontSize: 32, lineHeight: 48, textAlign: CueTextAlign.center },
          },
          {
            selectors: [[{ type: 'class', name: 'cue-input-caret' }]],
            declarations: { backgroundColor: { red: 0, green: 255, blue: 0, alpha: 1 } },
          },
        ],
      }]);
      const text = commands.find((command) => command.kind === CuePaintCommandKind.text);
      const caret = commands.find((command) => command.kind === CuePaintCommandKind.rect
        && command.paint.color.red === 0 && command.paint.color.green === 255);
      expect(text?.paint.style.fontSize).toBe(32);
      expect(text?.paint.x).toBe(88);
      expect(text?.paint.lines).toEqual([{ text: 'abcd', x: 0 }]);
      expect(caret?.paint.x).toBe(152);
      expect(caret?.paint.height).toBe(48);
    } finally {
      focus.dispose();
    }
  });
});

function paintInput(root: CueRootElement, input: CueTextInputElement) {
  return paintInputCommands(root, input, styleSheets)
    .filter((command) => command.kind === CuePaintCommandKind.text)
    .map(({ paint }) => ({
      text: paint.lines.map((line) => line.text).join('\n'),
      fontSize: paint.style.fontSize,
      height: paint.height,
      color: paint.style.color,
    }));
}

function paintInputCommands(root: CueRootElement, input: CueTextInputElement, sheets: readonly CueStyleSheet[]) {
  // Exercise the same measured-layout / control-update / paint sequence as CueDocument.
  createCuePaintList(root, sheets, textMeasurer);
  updateCueTextInputLayout(input, computeCueElementStyle(input, sheets), textMeasurer, sheets);
  return createCuePaintList(root, sheets, textMeasurer).commands;
}

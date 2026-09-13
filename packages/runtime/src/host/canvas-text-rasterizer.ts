import {
  CueLineHeightKeyword,
} from '@bsgames/cue-style-schema';
import type {
  CuePaintText,
  CueTextMeasurer,
} from '../render/create-cue-paint-list.js';
import type { ComputedCueTextStyle } from '../style/compute-cue-element-style.js';
import {
  layoutCueTextLines,
  type CueTextLayout,
} from '../text/layout-cue-text.js';

export interface RasterizedCueText {
  canvas: HTMLCanvasElement;
}

const genericFontFamilies = new Set([
  'cursive',
  'emoji',
  'fangsong',
  'fantasy',
  'math',
  'monospace',
  'sans-serif',
  'serif',
  'system-ui',
  'ui-monospace',
  'ui-rounded',
  'ui-sans-serif',
  'ui-serif',
]);

export class CanvasTextRasterizer implements CueTextMeasurer {
  constructor(readPixelScale: () => number) {
    this.#readPixelScale = readPixelScale;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Cue text rendering requires a Canvas 2D context.');
    }
    this.#measurementContext = context;
  }

  get pixelScale(): number {
    return this.#readPixelScale();
  }

  layout(
    text: string,
    style: ComputedCueTextStyle,
    availableWidth?: number,
  ): CueTextLayout {
    const context = this.#measurementContext;
    context.font = toCanvasFont(style);
    const lines = layoutCueTextLines(
      text,
      style.whiteSpace,
      availableWidth,
      (line) => context.measureText(line).width,
    );
    return {
      height: usedLineHeight(style) * lines.length,
      lines,
      width: Math.max(0, ...lines.map((line) => line.width)),
    };
  }

  rasterize(paintText: CuePaintText): RasterizedCueText {
    const { style } = paintText;
    const pixelScale = this.pixelScale;
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.ceil(paintText.width * pixelScale));
    canvas.height = Math.max(1, Math.ceil(paintText.height * pixelScale));
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Cue text rendering requires a Canvas 2D context.');
    }

    context.scale(pixelScale, pixelScale);
    context.clearRect(0, 0, paintText.width, paintText.height);
    context.fillStyle = toCanvasColor(style);
    context.font = toCanvasFont(style);
    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
    const lineHeight = usedLineHeight(style);
    for (const [lineIndex, line] of paintText.lines.entries()) {
      const metrics = context.measureText(line.text.length > 0 ? line.text : 'M');
      const ascent = metrics.actualBoundingBoxAscent || style.fontSize * 0.8;
      const descent = metrics.actualBoundingBoxDescent || style.fontSize * 0.2;
      const baseline = lineIndex * lineHeight
        + (lineHeight - ascent - descent) / 2
        + ascent;
      context.fillText(
        line.text,
        line.x,
        baseline,
      );
    }
    return {
      canvas,
    };
  }

  readonly #measurementContext: CanvasRenderingContext2D;
  readonly #readPixelScale: () => number;
}

function toCanvasColor(style: ComputedCueTextStyle): string {
  const { alpha, blue, green, red } = style.color;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function toCanvasFont(style: ComputedCueTextStyle): string {
  return `${style.fontSize}px ${style.fontFamily
    .map((family) => genericFontFamilies.has(family)
      ? family
      : JSON.stringify(family))
    .join(', ')}`;
}

function usedLineHeight(style: ComputedCueTextStyle): number {
  return style.lineHeight === CueLineHeightKeyword.normal
    ? style.fontSize * 1.2
    : style.lineHeight;
}

export {};

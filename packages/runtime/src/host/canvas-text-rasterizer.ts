import {
  CueLineHeightKeyword,
  type CueColor,
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
import { cueFontRevision } from './load-cue-font.js';

export interface RasterizedCueText {
  canvas: HTMLCanvasElement;
  /** Canvas-local bounds, including glyph overhang and stroke; layout is unchanged. */
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
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

  get fontRevision(): number {
    return cueFontRevision;
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
    const measurementContext = this.#measurementContext;
    measurementContext.font = toCanvasFont(style);
    measurementContext.textAlign = 'left';
    measurementContext.textBaseline = 'alphabetic';
    const fontMetrics = measurementContext.measureText('Mg');
    const lineHeight = usedLineHeight(style);
    const firstBaseline = (lineHeight
      - fontMetrics.fontBoundingBoxAscent
      - fontMetrics.fontBoundingBoxDescent) / 2
      + fontMetrics.fontBoundingBoxAscent;
    const inkPadding = style.cueTextStrokeWidth / 2 + 1 / pixelScale;
    let left = 0;
    let top = 0;
    let right = paintText.width;
    let bottom = paintText.height;
    for (const [lineIndex, line] of paintText.lines.entries()) {
      if (line.text.length === 0) {
        continue;
      }
      const metrics = measurementContext.measureText(line.text);
      const baseline = firstBaseline + lineIndex * lineHeight;
      left = Math.min(left, line.x - metrics.actualBoundingBoxLeft - inkPadding);
      right = Math.max(right, line.x + metrics.actualBoundingBoxRight + inkPadding);
      top = Math.min(top, baseline - metrics.actualBoundingBoxAscent - inkPadding);
      bottom = Math.max(bottom, baseline + metrics.actualBoundingBoxDescent + inkPadding);
    }
    left = Math.floor(left * pixelScale);
    top = Math.floor(top * pixelScale);
    right = Math.ceil(right * pixelScale);
    bottom = Math.ceil(bottom * pixelScale);
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, right - left);
    canvas.height = Math.max(1, bottom - top);
    const bounds = {
      height: canvas.height / pixelScale,
      width: canvas.width / pixelScale,
      x: left / pixelScale,
      y: top / pixelScale,
    };
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Cue text rendering requires a Canvas 2D context.');
    }

    context.scale(pixelScale, pixelScale);
    context.translate(-bounds.x, -bounds.y);
    context.fillStyle = toCanvasColor(style.color);
    context.strokeStyle = toCanvasColor(style.cueTextStrokeColor);
    context.lineWidth = style.cueTextStrokeWidth;
    context.lineJoin = 'round';
    context.font = toCanvasFont(style);
    context.textAlign = 'left';
    context.textBaseline = 'alphabetic';
    for (const [lineIndex, line] of paintText.lines.entries()) {
      const baseline = firstBaseline + lineIndex * lineHeight;
      if (style.cueTextStrokeWidth > 0) {
        context.strokeText(line.text, line.x, baseline);
      }
      context.fillText(
        line.text,
        line.x,
        baseline,
      );
    }
    return {
      bounds,
      canvas,
    };
  }

  readonly #measurementContext: CanvasRenderingContext2D;
  readonly #readPixelScale: () => number;
}

function toCanvasColor(color: CueColor): string {
  const { alpha, blue, green, red } = color;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function toCanvasFont(style: ComputedCueTextStyle): string {
  return `${style.fontWeight} ${style.fontSize}px ${style.fontFamily
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

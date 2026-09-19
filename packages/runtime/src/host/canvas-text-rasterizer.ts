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
  cueTextBaseline,
  type CueTextLayout,
  type CueFontMetrics,
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
    context.fontKerning = 'normal';
    this.#measurementContext = context;
  }

  get pixelScale(): number {
    return this.#readPixelScale();
  }

  get fontRevision(): number {
    return cueFontRevision;
  }

  metrics(style: ComputedCueTextStyle): CueFontMetrics {
    const context = this.#useFont(style);
    const key = this.#font + '|' + usedLineHeight(style);
    const cached = this.#metrics.get(key);
    if (cached) return cached;
    context.textBaseline = 'alphabetic';
    const metrics = context.measureText('Mg');
    const result = {
      ascent: metrics.fontBoundingBoxAscent,
      descent: metrics.fontBoundingBoxDescent,
      xHeight: context.measureText('x').actualBoundingBoxAscent,
      lineHeight: usedLineHeight(style),
    };
    if (this.#metrics.size >= 128) this.#metrics.delete(this.#metrics.keys().next().value!);
    this.#metrics.set(key, result);
    return result;
  }

  measureWidth(text: string, style: ComputedCueTextStyle): number {
    if (text.length === 0) return 0;
    const context = this.#useFont(style);
    const key = this.#font + '|' + text;
    const cached = this.#widths.get(key);
    if (cached !== undefined) {
      this.#widths.delete(key);
      this.#widths.set(key, cached);
      return cached;
    }
    const width = context.measureText(text).width;
    // Bound retained strings as well as entry count, including arbitrary user input.
    if (key.length <= 8192) {
      while (this.#widths.size >= 4096 || this.#widthCharacters + key.length > 262144) {
        const oldest = this.#widths.keys().next().value!;
        this.#widthCharacters -= oldest.length;
        this.#widths.delete(oldest);
      }
      this.#widths.set(key, width);
      this.#widthCharacters += key.length;
    }
    return width;
  }

  layout(
    text: string,
    style: ComputedCueTextStyle,
    availableWidth?: number,
  ): CueTextLayout {
    const lines = layoutCueTextLines(
      text,
      style.whiteSpace,
      availableWidth,
      (line) => this.measureWidth(line, style),
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
    this.#useFont(style);
    measurementContext.textAlign = 'left';
    measurementContext.textBaseline = 'alphabetic';
    const lineHeight = usedLineHeight(style);
    const firstBaseline = cueTextBaseline(this.metrics(style));
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
    context.fontKerning = 'normal';
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
  readonly #widths = new Map<string, number>();
  readonly #metrics = new Map<string, CueFontMetrics>();
  #widthCharacters = 0;
  #font = '';
  #fontRevision = -1;

  #useFont(style: ComputedCueTextStyle): CanvasRenderingContext2D {
    if (this.#fontRevision !== this.fontRevision) {
      this.#widths.clear();
      this.#metrics.clear();
      this.#widthCharacters = 0;
      this.#fontRevision = this.fontRevision;
    }
    const font = toCanvasFont(style);
    if (font !== this.#font) {
      this.#measurementContext.font = font;
      this.#font = font;
    }
    return this.#measurementContext;
  }
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

import {
  CueBorderStyle,
  CueOverflowWrap,
  CueTextAlign,
  CueTextFit,
  CueVerticalAlign,
  CueWhiteSpace,
  CueWordBreak,
} from '@bsgames/cue-style-schema';
import { LineBreaker } from 'css-line-break';
import type { CueTextMeasurer } from '../render/create-cue-paint-list.js';
import type { ComputedCueElementStyle } from '../style/compute-cue-element-style.js';
import { cueTextBaseline, type CueFontMetrics } from './layout-cue-text.js';

export interface CueInlineBox<Value> {
  value: Value;
  style: ComputedCueElementStyle;
  parent?: CueInlineBox<Value>;
}

export interface CueInlineAtomicSize {
  width: number;
  height: number;
  baseline: number;
}

export type CueInlineItem<Value>
  = | {
    kind: 'text';
    box: CueInlineBox<Value>;
    text: string;
  }
  | {
    kind: 'start' | 'end' | 'break' | 'out-of-flow';
    box: CueInlineBox<Value>;
  }
  | {
    kind: 'atomic';
    box: CueInlineBox<Value>;
    measure: (
      width: number | undefined,
      height: number | undefined,
    ) => CueInlineAtomicSize;
  };

export interface CueInlineFragment<Value> {
  line: number;
  box: CueInlineBox<Value>;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
  /** Used font size multiplier; never written back to computed/author styles. */
  fontScale?: number;
  atomic?: boolean;
  outOfFlow?: boolean;
  first: boolean;
  last: boolean;
}

export interface CueInlineLayout<Value> {
  width: number;
  height: number;
  firstBaseline: number;
  lastBaseline: number;
  fragments: Array<CueInlineFragment<Value>>;
}

interface InlineToken<Value> {
  box: CueInlineBox<Value>;
  kind: CueInlineItem<Value>['kind'];
  text: string;
  collapsible: boolean;
  hanging: boolean;
  wrap: boolean;
  breakAfter: boolean;
  emergencyBreakAfter?: boolean;
  emptyInlineEdge?: boolean;
  collapsibleInlineEdge?: boolean;
  size?: CueInlineAtomicSize;
}

interface PositionedToken<Value> {
  token: InlineToken<Value>;
  x: number;
  width: number;
  text: string;
}

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** Constraint-independent text preparation plus bounded intrinsic/line-layout reuse. */
export class CueInlineFormatting<Value> {
  constructor(
    private readonly _root: CueInlineBox<Value>,
    private readonly _items: ReadonlyArray<CueInlineItem<Value>>,
    private readonly _measurer: CueTextMeasurer,
  ) {
    this.#cacheable = !_items.some((item) => item.kind === 'atomic');
  }

  layout(width?: number, height?: number, fit = true): CueInlineLayout<Value> {
    // Atomic measurement positions a separate Taffy tree. It must run even if
    // this constraint was seen before but a different one was measured since.
    if (!this.#cacheable) {
      return layoutCueInline(this._root, this._items, this._measurer, width, height, fit);
    }
    const key = JSON.stringify([
      width,
      height,
      fit,
    ]);
    const cached = this.#layouts.get(key);
    if (cached) {
      return cached;
    }
    this.#tokens ??= normalizeInlineContent(this._items);
    const result = layoutInlineTokens(
      this._root,
      this.#tokens,
      this._measurer,
      width,
      fit,
    );
    if (this.#layouts.size >= 16) {
      this.#layouts.delete(this.#layouts.keys().next().value!);
    }
    this.#layouts.set(key, result);
    return result;
  }

  clear(): void {
    this.#tokens = undefined;
    this.#layouts.clear();
  }

  readonly #cacheable: boolean;
  readonly #layouts = new Map<string, CueInlineLayout<Value>>();
  #tokens: Array<InlineToken<Value>> | undefined;
}

/** Horizontal LTR inline formatting. Boxes are independent of the author tree. */
export function layoutCueInline<Value>(
  root: CueInlineBox<Value>,
  items: ReadonlyArray<CueInlineItem<Value>>,
  measurer: CueTextMeasurer,
  availableWidth?: number,
  availableHeight?: number,
  fit = true,
): CueInlineLayout<Value> {
  const tokens = normalizeInlineContent(items, availableWidth, availableHeight);
  return layoutInlineTokens(root, tokens, measurer, availableWidth, fit);
}

function layoutInlineTokens<Value>(
  root: CueInlineBox<Value>,
  tokens: ReadonlyArray<InlineToken<Value>>,
  measurer: CueTextMeasurer,
  availableWidth?: number,
  fit = true,
): CueInlineLayout<Value> {
  const output: CueInlineLayout<Value> = {
    width: 0,
    height: 0,
    firstBaseline: 0,
    lastBaseline: 0,
    fragments: [],
  };
  let fontScale = 1;
  const usedStyles = new Map<CueInlineBox<Value>, ComputedCueElementStyle>();
  const usedStyle = (box: CueInlineBox<Value>): ComputedCueElementStyle => {
    if (fontScale === 1) {
      return box.style;
    }
    let style = usedStyles.get(box);
    if (!style) {
      style = { ...box.style, fontSize: box.style.fontSize * fontScale };
      usedStyles.set(box, style);
    }
    return style;
  };
  const widths = new Map<CueInlineBox<Value>, Map<string, number>>();
  const measureWidth = (text: string, box: CueInlineBox<Value>): number => {
    if (text.length === 0 || fontScale === 0) {
      return 0;
    }
    let cache = widths.get(box);
    if (!cache) {
      widths.set(box, (cache = new Map()));
    }
    let width = cache.get(text);
    if (width === undefined) {
      width = measurer.measureWidth(text, usedStyle(box));
      cache.set(text, width);
    }
    return width;
  };
  const fontMetrics = new Map<CueInlineBox<Value>, CueFontMetrics>();
  const metrics = (box: CueInlineBox<Value>): CueFontMetrics => {
    let value = fontMetrics.get(box);
    if (!value) {
      value
        = fontScale === 0
          ? {
            ascent: 0,
            descent: 0,
            xHeight: 0,
            lineHeight:
                typeof box.style.lineHeight === 'number' ? box.style.lineHeight : 0,
          }
          : measurer.metrics(usedStyle(box));
      fontMetrics.set(box, value);
    }
    return value;
  };
  let line: Array<InlineToken<Value>> = [];
  let lastBreak = 0;
  let lastEmergencyBreak = 0;
  let lineIndex = 0;
  const lines: Array<{ tokens: Array<InlineToken<Value>>; forced: boolean }> = [];

  const positionLine = (
    input: ReadonlyArray<InlineToken<Value>>,
  ): Array<PositionedToken<Value>> => {
    const positioned: Array<PositionedToken<Value>> = [];
    let x = 0;
    let prefix = '';
    let previousBox: CueInlineBox<Value> | undefined;
    let hasContent = false;
    let lastContent = input.length - 1;
    while (
      lastContent >= 0
      && (input[lastContent]!.collapsible
        || input[lastContent]!.kind === 'end'
        || input[lastContent]!.kind === 'start')
    ) {
      lastContent--;
    }
    for (const [index, token] of input.entries()) {
      let text = token.text;
      let width = 0;
      if (token.kind === 'start' || token.kind === 'end') {
        const style = token.box.style;
        const start = token.kind === 'start';
        width
          = length(start ? style.marginLeft : style.marginRight, availableWidth ?? 0)
            + length(start ? style.paddingLeft : style.paddingRight, availableWidth ?? 0)
            + (start
              ? border(style.borderLeftStyle, style.borderLeftWidth)
              : border(style.borderRightStyle, style.borderRightWidth));
      } else if (token.kind === 'atomic') {
        width = token.size!.width;
        hasContent = true;
      } else if (token.kind === 'text') {
        if (token.collapsible && (!hasContent || index > lastContent)) {
          text = '';
        }
        if (token.text === '\t') {
          const stop = measureWidth('        ', token.box);
          width = stop === 0 ? 0 : (Math.floor(x / stop) + 1) * stop - x;
          text = '';
        } else {
          if (previousBox !== token.box) {
            prefix = '';
          }
          width
            = measureWidth(prefix + text, token.box) - measureWidth(prefix, token.box);
          prefix += text;
        }
        if (!token.collapsible && text.length > 0) {
          hasContent = true;
        }
      }
      positioned.push({
        token,
        x,
        width,
        text,
      });
      x += width;
      previousBox = token.kind === 'text' ? token.box : undefined;
    }
    return positioned;
  };

  // Width probing advances through the line once. Final placement still applies
  // line-edge whitespace rules, but wrapping no longer repositions every prefix.
  let probeX = 0;
  let probeEnd = 0;
  let probePrefix = '';
  let probeBox: CueInlineBox<Value> | undefined;
  let probeContent = false;
  let probeTrailingSpace = 0;
  const probeToken = (token: InlineToken<Value>): void => {
    let width = 0;
    if (token.kind === 'text') {
      const text = token.collapsible && !probeContent ? '' : token.text;
      if (token.text === '\t') {
        const stop = measureWidth('        ', token.box);
        width = stop === 0 ? 0 : (Math.floor(probeX / stop) + 1) * stop - probeX;
      } else {
        if (probeBox !== token.box) {
          probePrefix = '';
        }
        width
          = measureWidth(probePrefix + text, token.box)
            - measureWidth(probePrefix, token.box);
        probePrefix += text;
      }
      if (!token.collapsible && text.length > 0) {
        probeContent = true;
      }
    } else if (token.kind === 'atomic') {
      width = token.size!.width;
      probeContent = true;
    } else if (token.kind === 'start' || token.kind === 'end') {
      const style = token.box.style;
      const start = token.kind === 'start';
      width
        = length(start ? style.marginLeft : style.marginRight, availableWidth ?? 0)
          + length(start ? style.paddingLeft : style.paddingRight, availableWidth ?? 0)
          + (start
            ? border(style.borderLeftStyle, style.borderLeftWidth)
            : border(style.borderRightStyle, style.borderRightWidth));
    }
    probeX += width;
    if (token.collapsible) {
      probeTrailingSpace += width;
    } else if (token.kind !== 'start' && token.kind !== 'end') {
      probeTrailingSpace = 0;
    }
    if (!token.collapsible && !token.hanging && !token.emptyInlineEdge && width !== 0) {
      probeEnd = probeX - probeTrailingSpace;
    }
    probeBox = token.kind === 'text' ? token.box : undefined;
  };
  const probeLine = (): void => {
    probeX = 0;
    probeEnd = 0;
    probePrefix = '';
    probeBox = undefined;
    probeContent = false;
    probeTrailingSpace = 0;
    for (const token of line) {
      probeToken(token);
    }
  };

  const usedWidth = (positioned: ReadonlyArray<PositionedToken<Value>>): number => {
    let end = positioned.length - 1;
    while (end >= 0 && (positioned[end]!.token.hanging || positioned[end]!.width === 0)) {
      end--;
    }
    return end < 0 ? 0 : positioned[end]!.x + positioned[end]!.width;
  };

  const finishLine = (
    input: ReadonlyArray<InlineToken<Value>>,
    forced: boolean,
  ): void => {
    const positioned = positionLine(input);
    if (
      !forced
      && !positioned.some(
        (part) =>
          part.text.length > 0 || part.width !== 0 || part.token.kind === 'atomic',
      )
    ) {
      return;
    }
    const width = usedWidth(positioned);
    const offset
      = root.style.textAlign === CueTextAlign.center
        ? ((availableWidth ?? width) - width) / 2
        : root.style.textAlign === CueTextAlign.right
          || root.style.textAlign === CueTextAlign.end
          ? (availableWidth ?? width) - width
          : 0;
    const boxes = new Set<CueInlineBox<Value>>([root]);
    const atomicSizes = new Map<CueInlineBox<Value>, CueInlineAtomicSize>();
    for (const part of positioned) {
      for (
        let box: CueInlineBox<Value> | undefined
          = part.token.kind === 'out-of-flow' ? part.token.box.parent : part.token.box;
        box;
        box = box.parent
      ) {
        boxes.add(box);
      }
      if (part.token.size) {
        atomicSizes.set(part.token.box, part.token.size);
      }
    }
    const extents = new Map<CueInlineBox<Value>, { above: number; below: number }>();
    for (const box of boxes) {
      const size = atomicSizes.get(box);
      const font = metrics(box);
      const baseline = cueTextBaseline(font);
      extents.set(
        box,
        size
          ? { above: size.baseline, below: size.height - size.baseline }
          : { above: baseline, below: font.lineHeight - baseline },
      );
    }
    const baselineShift = (
      box: CueInlineBox<Value>,
      own: { above: number; below: number },
    ): number => {
      const parent = box.parent ?? root;
      const font = metrics(parent);
      switch (box.style.verticalAlign) {
      case CueVerticalAlign.middle:
        return (own.above - own.below - font.xHeight) / 2;
      case CueVerticalAlign.textTop:
        return own.above - font.ascent;
      case CueVerticalAlign.textBottom:
        return font.descent - own.below;
      case CueVerticalAlign.sub:
        return parent.style.fontSize / 5 + 1;
      case CueVerticalAlign.super:
        return -(parent.style.fontSize / 3 + 1);
      case CueVerticalAlign.baseline:
      case CueVerticalAlign.top:
      case CueVerticalAlign.bottom:
        return 0;
      default:
        return -length(box.style.verticalAlign, metrics(box).lineHeight);
      }
    };
    // Alignment uses the aligned subtree; glyph rasterization still uses the
    // individual box's font metrics. Top/bottom descendants align to the line.
    const alignedExtents = new Map<
      CueInlineBox<Value>,
      { above: number; below: number }
    >();
    const subtreeExtents = (
      box: CueInlineBox<Value>,
    ): { above: number; below: number } => {
      const cached = alignedExtents.get(box);
      if (cached) {
        return cached;
      }
      const bounds = { ...extents.get(box)! };
      for (const child of boxes) {
        if (
          child.parent !== box
          || child.style.verticalAlign === CueVerticalAlign.top
          || child.style.verticalAlign === CueVerticalAlign.bottom
        ) {
          continue;
        }
        const size = subtreeExtents(child);
        const shift = baselineShift(child, size);
        bounds.above = Math.max(bounds.above, size.above - shift);
        bounds.below = Math.max(bounds.below, size.below + shift);
      }
      alignedExtents.set(box, bounds);
      return bounds;
    };
    // Top/bottom align an entire aligned subtree, not each glyph independently.
    const groups = new Map<
      CueInlineBox<Value>,
      {
        top: number;
        bottom: number;
        offset: number;
      }
    >();
    const baselines = new Map<CueInlineBox<Value>, number>([[root, 0]]);
    const groupOf = new Map<CueInlineBox<Value>, CueInlineBox<Value>>([[root, root]]);
    groups.set(root, {
      top: -extents.get(root)!.above,
      bottom: extents.get(root)!.below,
      offset: 0,
    });
    const placeBox = (box: CueInlineBox<Value>): number => {
      const existing = baselines.get(box);
      if (existing !== undefined) {
        return existing;
      }
      const parent = box.parent ?? root;
      const parentBaseline = placeBox(parent);
      const align = box.style.verticalAlign;
      const own = extents.get(box)!;
      let group = groupOf.get(parent)!;
      let baseline = parentBaseline;
      if (align === CueVerticalAlign.top || align === CueVerticalAlign.bottom) {
        group = box;
        baseline = 0;
        groups.set(box, {
          top: -own.above,
          bottom: own.below,
          offset: 0,
        });
      } else {
        baseline += baselineShift(box, subtreeExtents(box));
      }
      baselines.set(box, baseline);
      groupOf.set(box, group);
      const bounds = groups.get(group)!;
      bounds.top = Math.min(bounds.top, baseline - own.above);
      bounds.bottom = Math.max(bounds.bottom, baseline + own.below);
      return baseline;
    };
    for (const box of boxes) {
      placeBox(box);
    }
    const main = groups.get(root)!;
    const height = Math.max(
      main.bottom - main.top,
      ...[...groups.values()].map((group) => group.bottom - group.top),
    );
    // Keep baseline-aligned content in its natural position, allocating extra
    // height above it for bottom-aligned subtrees and below for top-aligned ones.
    let top = main.top;
    for (const [box, bounds] of groups) {
      if (box.style.verticalAlign === CueVerticalAlign.bottom) {
        top = Math.min(top, main.bottom - (bounds.bottom - bounds.top));
      }
    }
    for (const [box, bounds] of groups) {
      bounds.offset
        = box === root
          ? -top
          : (box.style.verticalAlign === CueVerticalAlign.top
            ? -bounds.top
            : height - bounds.bottom) + (baselines.get(box.parent ?? root) ?? 0);
    }
    const baselineY = (box: CueInlineBox<Value>): number =>
      output.height + baselines.get(box)! + groups.get(groupOf.get(box)!)!.offset;
    const ranges = new Map<
      CueInlineBox<Value>,
      {
        left: number;
        right: number;
        first: boolean;
        last: boolean;
      }
    >();
    let previousText: CueInlineFragment<Value> | undefined;
    for (const part of positioned) {
      const { token } = part;
      if (token.kind === 'out-of-flow') {
        output.fragments.push({
          line: lineIndex,
          box: token.box,
          x: offset + part.x,
          y: output.height,
          width: 0,
          height: 0,
          outOfFlow: true,
          first: true,
          last: true,
        });
        continue;
      }
      const baseline = baselineY(token.box);
      if (token.kind === 'atomic') {
        output.fragments.push({
          line: lineIndex,
          box: token.box,
          x: offset + part.x,
          y: baseline - token.size!.baseline,
          width: part.width,
          height: token.size!.height,
          atomic: true,
          first: true,
          last: true,
        });
      } else if (part.text.length > 0) {
        const y = baseline - extents.get(token.box)!.above;
        if (
          previousText?.box === token.box
          && previousText.y === y
          && Math.abs(previousText.x + previousText.width - offset - part.x) < 0.001
        ) {
          previousText.text += part.text;
          previousText.width += part.width;
        } else {
          previousText = {
            line: lineIndex,
            box: token.box,
            x: offset + part.x,
            y,
            width: part.width,
            height: metrics(token.box).lineHeight,
            text: part.text,
            fontScale,
            first: true,
            last: true,
          };
          output.fragments.push(previousText);
        }
      }
      if (token.kind !== 'text') {
        previousText = undefined;
      }
      for (
        let box: CueInlineBox<Value> | undefined
          = token.kind === 'atomic' ? token.box.parent : token.box;
        box && box !== root;
        box = box.parent
      ) {
        const range = ranges.get(box) ?? {
          left: part.x,
          right: part.x,
          first: false,
          last: false,
        };
        range.left = Math.min(range.left, part.x);
        range.right = Math.max(range.right, part.x + part.width);
        range.first ||= token.box === box && token.kind === 'start';
        range.last ||= token.box === box && token.kind === 'end';
        ranges.set(box, range);
      }
    }
    for (const [box, range] of ranges) {
      const style = box.style;
      const marginLeft = range.first ? length(style.marginLeft, availableWidth ?? 0) : 0;
      const marginRight = range.last ? length(style.marginRight, availableWidth ?? 0) : 0;
      const topPadding
        = length(style.paddingTop, availableWidth ?? 0)
          + border(style.borderTopStyle, style.borderTopWidth);
      const bottomPadding
        = length(style.paddingBottom, availableWidth ?? 0)
          + border(style.borderBottomStyle, style.borderBottomWidth);
      const font = metrics(box);
      output.fragments.push({
        line: lineIndex,
        box,
        x: offset + range.left + marginLeft,
        y: baselineY(box) - font.ascent - topPadding,
        width: range.right - range.left - marginLeft - marginRight,
        height: font.ascent + font.descent + topPadding + bottomPadding,
        first: range.first,
        last: range.last,
      });
    }
    if (output.height === 0) {
      output.firstBaseline = baselineY(root);
    }
    output.lastBaseline = baselineY(root);
    output.width = Math.max(output.width, width);
    output.height += height;
    lineIndex++;
  };

  for (const token of tokens) {
    if (token.kind === 'break') {
      lines.push({ tokens: [...line, token], forced: true });
      line = [];
      lastBreak = 0;
      lastEmergencyBreak = 0;
      probeLine();
      continue;
    }
    line.push(token);
    probeToken(token);
    while (availableWidth !== undefined && probeEnd > availableWidth) {
      // A collapsible run can still supply its own normal break. Its inline
      // edges may use an existing normal break, but must not prematurely split
      // the preceding word via overflow-wrap's emergency opportunities.
      if (lastBreak === 0 && (token.collapsible || token.collapsibleInlineEdge)) {
        break;
      }
      const breakAt = lastBreak || lastEmergencyBreak;
      if (breakAt === 0 || breakAt >= line.length) {
        break;
      }
      lines.push({ tokens: line.slice(0, breakAt), forced: false });
      line = line.slice(breakAt);
      lastBreak = 0;
      lastEmergencyBreak = 0;
      probeLine();
      for (let index = 0; index < line.length - 1; index++) {
        if (line[index]!.wrap && line[index]!.breakAfter) {
          lastBreak = index + 1;
        }
        if (line[index]!.wrap && line[index]!.emergencyBreakAfter) {
          lastEmergencyBreak = index + 1;
        }
      }
    }
    if (token.breakAfter && token.wrap) {
      lastBreak = line.length;
    }
    if (token.emergencyBreakAfter && token.wrap) {
      lastEmergencyBreak = line.length;
    }
  }
  lines.push({ tokens: line, forced: false });
  // CSS Text 5: wrap at the computed size first, then fit all lines with the
  // smallest factor. Atomic boxes and inline edges keep their original sizes.
  if (fit && root.style.textFit === CueTextFit.shrink && availableWidth !== undefined) {
    let factor = 1;
    const fittingLines: Array<{
      tokens: Array<InlineToken<Value>>;
      lastContent: number;
    }> = [];
    for (const { tokens } of lines) {
      const positioned = positionLine(tokens);
      let lastContent = positioned.length - 1;
      while (
        lastContent >= 0
        && (positioned[lastContent]!.token.kind === 'start'
          || positioned[lastContent]!.token.kind === 'end'
          || positioned[lastContent]!.token.kind === 'break'
          || positioned[lastContent]!.token.kind === 'out-of-flow'
          || (/^[ \t]*$/u.test(positioned[lastContent]!.text)
            && positioned[lastContent]!.token.kind === 'text'))
      ) {
        lastContent--;
      }
      let scalable = 0;
      let fixed = 0;
      for (const [index, part] of positioned.entries()) {
        if (part.token.kind === 'text') {
          if (index <= lastContent) {
            scalable += part.width;
          }
        } else {
          fixed += part.width;
        }
      }
      if (scalable > 0) {
        fittingLines.push({ tokens, lastContent });
        factor = Math.min(factor, Math.max(0, (availableWidth - fixed) / scalable));
      }
    }
    // The ratio is based on the original advances; measurement/rasterization
    // now use the same smaller font, retaining explicit pixel line-height.
    fontScale = factor;
    widths.clear();
    if (fontScale > 0 && fontScale < 1) {
      // Font hinting/optical sizing can make the ratio estimate overflow. Keep
      // the largest fitting measured candidate instead of assuming linearity.
      let lower = 0;
      let upper = factor;
      for (let attempt = 0; attempt < 16; attempt++) {
        const overflows = fittingLines.some(
          ({ tokens, lastContent }) =>
            positionLine(tokens).reduce(
              (width, part, index) =>
                width
                + (part.token.kind !== 'text' || index <= lastContent ? part.width : 0),
              0,
            ) > availableWidth,
        );
        if (attempt === 0 && !overflows) {
          break;
        }
        if (overflows) {
          upper = fontScale;
        } else {
          lower = fontScale;
        }
        fontScale = attempt === 15 ? lower : (lower + upper) / 2;
        usedStyles.clear();
        widths.clear();
      }
    }
  }
  for (const { tokens, forced } of lines) {
    finishLine(tokens, forced);
  }
  return output;
}

function normalizeInlineContent<Value>(
  items: ReadonlyArray<CueInlineItem<Value>>,
  width?: number,
  height?: number,
): Array<InlineToken<Value>> {
  const tokens: Array<InlineToken<Value>> = [];
  let previousSpace = false;
  let previousCarriageReturn = false;
  for (const item of items) {
    const whiteSpace = item.box.style.whiteSpace;
    const collapse
      = whiteSpace === CueWhiteSpace.normal
        || whiteSpace === CueWhiteSpace.nowrap
        || whiteSpace === CueWhiteSpace.preLine;
    const wrap = whiteSpace !== CueWhiteSpace.nowrap && whiteSpace !== CueWhiteSpace.pre;
    if (item.kind !== 'text') {
      tokens.push({
        box: item.box,
        kind: item.kind,
        text: item.kind === 'atomic' ? '\ufffc' : item.kind === 'break' ? '\n' : '',
        collapsible: false,
        hanging: false,
        wrap,
        breakAfter: false,
        ...(item.kind === 'atomic' ? { size: item.measure(width, height) } : {}),
      });
      if (item.kind === 'break' || item.kind === 'atomic') {
        previousSpace = false;
      }
      continue;
    }
    for (const grapheme of graphemes.segment(item.text)) {
      let text = grapheme.segment;
      if (text === '\n' && previousCarriageReturn) {
        previousCarriageReturn = false;
        continue;
      }
      previousCarriageReturn = text === '\r';
      text = text.replace(/\r\n?|\f/gu, '\n');
      if (
        text === '\n'
        && whiteSpace !== CueWhiteSpace.normal
        && whiteSpace !== CueWhiteSpace.nowrap
      ) {
        tokens.push({
          box: item.box,
          kind: 'break',
          text: '\n',
          collapsible: false,
          hanging: false,
          wrap,
          breakAfter: false,
        });
        previousSpace = false;
        continue;
      }
      const collapsible = collapse && /^[ \t\n]$/u.test(text);
      if (collapsible && previousSpace) {
        continue;
      }
      previousSpace = collapsible;
      tokens.push({
        box: item.box,
        kind: 'text',
        text: collapsible ? ' ' : text,
        collapsible,
        hanging: whiteSpace === CueWhiteSpace.preWrap && /^[ \t]$/u.test(text),
        wrap,
        breakAfter: false,
      });
    }
  }
  const text = tokens.map((token) => token.text).join('');
  const contentBoxes = new Set<CueInlineBox<Value>>();
  const nonCollapsibleBoxes = new Set<CueInlineBox<Value>>();
  for (const token of tokens) {
    if (token.kind === 'text' || token.kind === 'atomic' || token.kind === 'break') {
      for (let box: CueInlineBox<Value> | undefined = token.box; box; box = box.parent) {
        contentBoxes.add(box);
        if (!token.collapsible) {
          nonCollapsibleBoxes.add(box);
        }
      }
    }
  }
  for (const token of tokens) {
    // Empty inline decorations occupy horizontal space but do not themselves
    // trigger backtracking into preceding text. The next glyph tests that space.
    token.emptyInlineEdge
      = (token.kind === 'start' || token.kind === 'end') && !contentBoxes.has(token.box);
    token.collapsibleInlineEdge
      = (token.kind === 'start' || token.kind === 'end')
        && !nonCollapsibleBoxes.has(token.box);
  }
  const breaksByMode = new Map<CueWordBreak, Set<number>>();
  for (const mode of new Set(tokens.map((token) => token.box.style.wordBreak))) {
    const breaks = new Set<number>();
    const breaker = LineBreaker(text, { lineBreak: 'normal', wordBreak: mode });
    let offset = 0;
    for (let result = breaker.next(); !result.done; result = breaker.next()) {
      offset += result.value.slice().length;
      breaks.add(offset);
    }
    breaksByMode.set(mode, breaks);
  }
  const graphemeEnds = new Set(
    [...graphemes.segment(text)].map((part) => part.index + part.segment.length),
  );
  const boundaries = new Map<number, { index: number; content: InlineToken<Value> }>();
  let offset = 0;
  let previousContent: InlineToken<Value> | undefined;
  for (const [index, token] of tokens.entries()) {
    offset += token.text.length;
    if (token.text.length > 0) {
      previousContent = token;
    }
    if (
      previousContent
      && graphemeEnds.has(offset)
      && (token.text.length > 0 || token.kind === 'end')
    ) {
      // A text boundary may span several end/empty-inline tokens. It remains
      // one opportunity, at the outer margin edge, not an extra empty line.
      boundaries.set(offset, { index, content: previousContent });
    }
  }
  const nextContent: Array<InlineToken<Value> | undefined> = [];
  let next: InlineToken<Value> | undefined;
  for (let index = tokens.length - 1; index >= 0; index--) {
    nextContent[index] = next;
    if (tokens[index]!.text.length > 0) {
      next = tokens[index];
    }
  }
  for (const [offset, { index, content }] of boundaries) {
    const token = tokens[index]!;
    token.breakAfter = breaksByMode.get(content.box.style.wordBreak)!.has(offset);
    token.emergencyBreakAfter
      = content.kind === 'text'
        && content.box.style.overflowWrap === CueOverflowWrap.anywhere;
    // Disappearing spaces use their own white-space. Character boundaries use
    // the nearest common ancestor, including the outside of a nowrap span.
    let owner = content.box;
    const following = nextContent[index];
    if (!content.collapsible && following) {
      const ancestors = new Set<CueInlineBox<Value>>();
      for (
        let box: CueInlineBox<Value> | undefined = following.box;
        box;
        box = box.parent
      ) {
        ancestors.add(box);
      }
      while (owner.parent && !ancestors.has(owner)) {
        owner = owner.parent;
      }
    }
    token.wrap
      = owner.style.whiteSpace !== CueWhiteSpace.nowrap
        && owner.style.whiteSpace !== CueWhiteSpace.pre;
  }
  return tokens;
}

function length(value: number | string, basis: number): number {
  return value === 'auto'
    ? 0
    : typeof value === 'number'
      ? value
      : (Number.parseFloat(value) * basis) / 100;
}

function border(style: CueBorderStyle, width: number): number {
  return style === CueBorderStyle.solid ? width : 0;
}

export {};

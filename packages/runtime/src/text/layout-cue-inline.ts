import { CueBorderStyle, CueTextAlign, CueVerticalAlign, CueWhiteSpace } from '@bsgames/cue-style-schema';
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

export type CueInlineItem<Value> = {
  kind: 'text';
  box: CueInlineBox<Value>;
  text: string;
} | {
  kind: 'start' | 'end' | 'break' | 'out-of-flow';
  box: CueInlineBox<Value>;
} | {
  kind: 'atomic';
  box: CueInlineBox<Value>;
  measure: (width: number | undefined, height: number | undefined) => CueInlineAtomicSize;
};

export interface CueInlineFragment<Value> {
  line: number;
  box: CueInlineBox<Value>;
  x: number;
  y: number;
  width: number;
  height: number;
  text?: string;
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
  size?: CueInlineAtomicSize;
}

interface PositionedToken<Value> {
  token: InlineToken<Value>;
  x: number;
  width: number;
  text: string;
}

const graphemes = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

/** Horizontal LTR inline formatting. Boxes are independent of the author tree. */
export function layoutCueInline<Value>(
  root: CueInlineBox<Value>,
  items: ReadonlyArray<CueInlineItem<Value>>,
  measurer: CueTextMeasurer,
  availableWidth?: number,
  availableHeight?: number,
): CueInlineLayout<Value> {
  const tokens = normalizeInlineContent(items, availableWidth, availableHeight);
  const output: CueInlineLayout<Value> = { width: 0, height: 0, firstBaseline: 0, lastBaseline: 0, fragments: [] };
  const measureWidth = (text: string, box: CueInlineBox<Value>): number => measurer.layout(text, { ...box.style, whiteSpace: CueWhiteSpace.pre }).width;
  const fontMetrics = new Map<CueInlineBox<Value>, CueFontMetrics>();
  const metrics = (box: CueInlineBox<Value>): CueFontMetrics => {
    let value = fontMetrics.get(box);
    if (!value) {
      value = measurer.metrics(box.style);
      fontMetrics.set(box, value);
    }
    return value;
  };
  let line: Array<InlineToken<Value>> = [];
  let lastBreak = 0;
  let lineIndex = 0;

  const positionLine = (input: ReadonlyArray<InlineToken<Value>>): Array<PositionedToken<Value>> => {
    const positioned: Array<PositionedToken<Value>> = [];
    let x = 0;
    let prefix = '';
    let previousBox: CueInlineBox<Value> | undefined;
    let hasContent = false;
    let lastContent = input.length - 1;
    while (lastContent >= 0 && (input[lastContent]!.collapsible || input[lastContent]!.kind === 'end' || input[lastContent]!.kind === 'start')) {
      lastContent--;
    }
    for (const [index, token] of input.entries()) {
      let text = token.text;
      let width = 0;
      if (token.kind === 'start' || token.kind === 'end') {
        const style = token.box.style;
        const start = token.kind === 'start';
        width = length(start ? style.marginLeft : style.marginRight, availableWidth ?? 0)
          + length(start ? style.paddingLeft : style.paddingRight, availableWidth ?? 0)
          + (start ? border(style.borderLeftStyle, style.borderLeftWidth) : border(style.borderRightStyle, style.borderRightWidth));
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
          width = measureWidth(prefix + text, token.box) - measureWidth(prefix, token.box);
          prefix += text;
        }
        if (!token.collapsible && text.length > 0) {
          hasContent = true;
        }
      }
      positioned.push({ token, x, width, text });
      x += width;
      previousBox = token.kind === 'text' ? token.box : undefined;
    }
    return positioned;
  };

  const usedWidth = (positioned: ReadonlyArray<PositionedToken<Value>>): number => {
    let end = positioned.length - 1;
    while (end >= 0 && (positioned[end]!.token.hanging || positioned[end]!.width === 0)) {
      end--;
    }
    return end < 0 ? 0 : positioned[end]!.x + positioned[end]!.width;
  };

  const finishLine = (input: ReadonlyArray<InlineToken<Value>>, forced: boolean): void => {
    const positioned = positionLine(input);
    if (!forced && !positioned.some((part) => part.text.length > 0 || part.width !== 0 || part.token.kind === 'atomic')) {
      return;
    }
    const width = usedWidth(positioned);
    const offset = root.style.textAlign === CueTextAlign.center
      ? ((availableWidth ?? width) - width) / 2
      : root.style.textAlign === CueTextAlign.right || root.style.textAlign === CueTextAlign.end ? (availableWidth ?? width) - width : 0;
    const boxes = new Set<CueInlineBox<Value>>([root]);
    const atomicSizes = new Map<CueInlineBox<Value>, CueInlineAtomicSize>();
    for (const part of positioned) {
      for (let box: CueInlineBox<Value> | undefined = part.token.kind === 'out-of-flow' ? part.token.box.parent : part.token.box; box; box = box.parent) {
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
      extents.set(box, size
        ? { above: size.baseline, below: size.height - size.baseline }
        : { above: baseline, below: font.lineHeight - baseline });
    }
    const baselineShift = (box: CueInlineBox<Value>, own: { above: number; below: number }): number => {
      const parent = box.parent ?? root;
      const font = metrics(parent);
      switch (box.style.verticalAlign) {
      case CueVerticalAlign.middle: return (own.above - own.below - font.xHeight) / 2;
      case CueVerticalAlign.textTop: return own.above - font.ascent;
      case CueVerticalAlign.textBottom: return font.descent - own.below;
      case CueVerticalAlign.sub: return parent.style.fontSize / 5 + 1;
      case CueVerticalAlign.super: return -(parent.style.fontSize / 3 + 1);
      case CueVerticalAlign.baseline:
      case CueVerticalAlign.top:
      case CueVerticalAlign.bottom: return 0;
      default: return -length(box.style.verticalAlign, metrics(box).lineHeight);
      }
    };
    // Alignment uses the aligned subtree; glyph rasterization still uses the
    // individual box's font metrics. Top/bottom descendants align to the line.
    const alignedExtents = new Map<CueInlineBox<Value>, { above: number; below: number }>();
    const subtreeExtents = (box: CueInlineBox<Value>): { above: number; below: number } => {
      const cached = alignedExtents.get(box);
      if (cached) return cached;
      const bounds = { ...extents.get(box)! };
      for (const child of boxes) {
        if (child.parent !== box || child.style.verticalAlign === CueVerticalAlign.top || child.style.verticalAlign === CueVerticalAlign.bottom) continue;
        const size = subtreeExtents(child);
        const shift = baselineShift(child, size);
        bounds.above = Math.max(bounds.above, size.above - shift);
        bounds.below = Math.max(bounds.below, size.below + shift);
      }
      alignedExtents.set(box, bounds);
      return bounds;
    };
    // Top/bottom align an entire aligned subtree, not each glyph independently.
    const groups = new Map<CueInlineBox<Value>, { top: number; bottom: number; offset: number }>();
    const baselines = new Map<CueInlineBox<Value>, number>([[root, 0]]);
    const groupOf = new Map<CueInlineBox<Value>, CueInlineBox<Value>>([[root, root]]);
    groups.set(root, { top: -extents.get(root)!.above, bottom: extents.get(root)!.below, offset: 0 });
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
        groups.set(box, { top: -own.above, bottom: own.below, offset: 0 });
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
    const height = Math.max(main.bottom - main.top, ...[...groups.values()].map((group) => group.bottom - group.top));
    // Keep baseline-aligned content in its natural position, allocating extra
    // height above it for bottom-aligned subtrees and below for top-aligned ones.
    let top = main.top;
    for (const [box, bounds] of groups) {
      if (box.style.verticalAlign === CueVerticalAlign.bottom) {
        top = Math.min(top, main.bottom - (bounds.bottom - bounds.top));
      }
    }
    for (const [box, bounds] of groups) {
      bounds.offset = box === root
        ? -top
        : (box.style.verticalAlign === CueVerticalAlign.top ? -bounds.top : height - bounds.bottom) + (baselines.get(box.parent ?? root) ?? 0);
    }
    const baselineY = (box: CueInlineBox<Value>): number => output.height + baselines.get(box)! + groups.get(groupOf.get(box)!)!.offset;
    const ranges = new Map<CueInlineBox<Value>, { left: number; right: number; first: boolean; last: boolean }>();
    let previousText: CueInlineFragment<Value> | undefined;
    for (const part of positioned) {
      const { token } = part;
      if (token.kind === 'out-of-flow') {
        output.fragments.push({ line: lineIndex, box: token.box, x: offset + part.x, y: output.height, width: 0, height: 0, outOfFlow: true, first: true, last: true });
        continue;
      }
      const baseline = baselineY(token.box);
      if (token.kind === 'atomic') {
        output.fragments.push({ line: lineIndex, box: token.box, x: offset + part.x, y: baseline - token.size!.baseline, width: part.width, height: token.size!.height, atomic: true, first: true, last: true });
      } else if (part.text.length > 0) {
        const y = baseline - extents.get(token.box)!.above;
        if (previousText?.box === token.box && previousText.y === y && Math.abs(previousText.x + previousText.width - offset - part.x) < 0.001) {
          previousText.text += part.text;
          previousText.width += part.width;
        } else {
          previousText = { line: lineIndex, box: token.box, x: offset + part.x, y, width: part.width, height: metrics(token.box).lineHeight, text: part.text, first: true, last: true };
          output.fragments.push(previousText);
        }
      }
      if (token.kind !== 'text') {
        previousText = undefined;
      }
      for (let box: CueInlineBox<Value> | undefined = token.kind === 'atomic' ? token.box.parent : token.box; box && box !== root; box = box.parent) {
        const range = ranges.get(box) ?? { left: part.x, right: part.x, first: false, last: false };
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
      const topPadding = length(style.paddingTop, availableWidth ?? 0) + border(style.borderTopStyle, style.borderTopWidth);
      const bottomPadding = length(style.paddingBottom, availableWidth ?? 0) + border(style.borderBottomStyle, style.borderBottomWidth);
      const font = metrics(box);
      output.fragments.push({ line: lineIndex, box, x: offset + range.left + marginLeft, y: baselineY(box) - font.ascent - topPadding, width: range.right - range.left - marginLeft - marginRight, height: font.ascent + font.descent + topPadding + bottomPadding, first: range.first, last: range.last });
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
      finishLine([...line, token], true);
      line = [];
      lastBreak = 0;
      continue;
    }
    line.push(token);
    if (availableWidth !== undefined && lastBreak > 0 && lastBreak < line.length && usedWidth(positionLine(line)) > availableWidth) {
      finishLine(line.slice(0, lastBreak), false);
      line = line.slice(lastBreak);
      lastBreak = 0;
    }
    if (token.breakAfter && token.wrap) {
      lastBreak = line.length;
    }
  }
  finishLine(line, false);
  return output;
}

function normalizeInlineContent<Value>(items: ReadonlyArray<CueInlineItem<Value>>, width?: number, height?: number): Array<InlineToken<Value>> {
  const tokens: Array<InlineToken<Value>> = [];
  let previousSpace = false;
  let previousCarriageReturn = false;
  for (const item of items) {
    const whiteSpace = item.box.style.whiteSpace;
    const collapse = whiteSpace === CueWhiteSpace.normal || whiteSpace === CueWhiteSpace.nowrap || whiteSpace === CueWhiteSpace.preLine;
    const wrap = whiteSpace !== CueWhiteSpace.nowrap && whiteSpace !== CueWhiteSpace.pre;
    if (item.kind !== 'text') {
      tokens.push({ box: item.box, kind: item.kind, text: item.kind === 'atomic' ? '\ufffc' : item.kind === 'break' ? '\n' : '', collapsible: false, hanging: false, wrap, breakAfter: false, ...(item.kind === 'atomic' ? { size: item.measure(width, height) } : {}) });
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
      if (text === '\n' && whiteSpace !== CueWhiteSpace.normal && whiteSpace !== CueWhiteSpace.nowrap) {
        tokens.push({ box: item.box, kind: 'break', text: '\n', collapsible: false, hanging: false, wrap, breakAfter: false });
        previousSpace = false;
        continue;
      }
      const collapsible = collapse && /^[ \t\n]$/u.test(text);
      if (collapsible && previousSpace) {
        continue;
      }
      previousSpace = collapsible;
      tokens.push({ box: item.box, kind: 'text', text: collapsible ? ' ' : text, collapsible, hanging: whiteSpace === CueWhiteSpace.preWrap && /^[ \t]$/u.test(text), wrap, breakAfter: false });
    }
  }
  const text = tokens.map((token) => token.text).join('');
  const breaks = new Set<number>();
  const breaker = LineBreaker(text, { lineBreak: 'normal', wordBreak: 'normal' });
  let offset = 0;
  for (let result = breaker.next(); !result.done; result = breaker.next()) {
    offset += result.value.slice().length;
    breaks.add(offset);
  }
  offset = 0;
  for (const [index, token] of tokens.entries()) {
    offset += token.text.length;
    token.breakAfter = breaks.has(offset) && (token.text.length > 0 || token.kind === 'end');
    if (tokens[index + 1]?.kind === 'end') {
      token.breakAfter = false;
    }
  }
  return tokens;
}

function length(value: number | string, basis: number): number {
  return value === 'auto' ? 0 : typeof value === 'number' ? value : Number.parseFloat(value) * basis / 100;
}

function border(style: CueBorderStyle, width: number): number {
  return style === CueBorderStyle.solid ? width : 0;
}

export {};

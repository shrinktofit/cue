import { LineBreaker } from 'css-line-break';

export interface EditableTextPosition {
  offset: number;
  x: number;
}

export interface EditableTextLine {
  text: string;
  start: number;
  end: number;
  width: number;
  positions: readonly EditableTextPosition[];
}

export interface EditableTextLayout {
  lines: readonly EditableTextLine[];
  lineHeight: number;
  width: number;
  height: number;
}

const graphemeSegmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

export function snapEditableTextOffset(text: string, offset: number): number {
  const clamped = Math.max(0, Math.min(text.length, Math.trunc(offset)));
  for (const segment of graphemeSegmenter.segment(text)) {
    const end = segment.index + segment.segment.length;
    if (clamped < end) {
      return clamped - segment.index < end - clamped ? segment.index : end;
    }
  }
  return text.length;
}

/** Logical LTR caret positions. Bidi visual reordering is not implemented. */
export function layoutEditableText(
  text: string,
  width: number,
  lineHeight: number,
  multiline: boolean,
  password: boolean,
  measureWidth: (text: string) => number,
): EditableTextLayout {
  const lines: EditableTextLine[] = [];
  let paragraphStart = 0;
  for (const paragraph of text.split('\n')) {
    const segments = [...graphemeSegmenter.segment(paragraph)];
    const breakOffsets = new Set<number>();
    const breaker = LineBreaker(paragraph, { lineBreak: 'normal', wordBreak: 'normal' });
    let breakOffset = 0;
    for (let result = breaker.next(); !result.done; result = breaker.next()) {
      breakOffset += result.value.slice().length;
      breakOffsets.add(breakOffset);
    }
    let cursor = 0;
    do {
      const start = cursor;
      let lastBreak = cursor;
      let displayed = '';
      const displayParts: string[] = [];
      while (cursor < segments.length) {
        const segment = segments[cursor]!;
        let part = password ? '•' : segment.segment;
        if (part === '\t') {
          const spaceWidth = measureWidth(' ');
          const tabWidth = measureWidth('        ');
          const currentWidth = measureWidth(displayed);
          part = ' '.repeat(spaceWidth > 0
            ? Math.max(1, Math.ceil(((Math.floor(currentWidth / tabWidth) + 1) * tabWidth - currentWidth) / spaceWidth))
            : 8);
        }
        if (multiline && cursor > start && measureWidth(displayed + part) > width) {
          if (lastBreak > start) {
            cursor = lastBreak;
            displayParts.length = cursor - start;
            displayed = displayParts.join('');
          }
          break;
        }
        displayParts.push(part);
        displayed += part;
        ++cursor;
        if (breakOffsets.has(segment.index + segment.segment.length)) {
          lastBreak = cursor;
        }
      }
      const lineStart = paragraphStart + (segments[start]?.index ?? paragraph.length);
      const positions: EditableTextPosition[] = [{ offset: lineStart, x: 0 }];
      let prefix = '';
      for (let index = start; index < cursor; ++index) {
        prefix += displayParts[index - start];
        const segment = segments[index]!;
        positions.push({
          offset: paragraphStart + segment.index + segment.segment.length,
          x: measureWidth(prefix),
        });
      }
      lines.push({
        text: displayed,
        start: lineStart,
        end: positions.at(-1)!.offset,
        width: measureWidth(displayed),
        positions,
      });
    } while (cursor < segments.length);
    paragraphStart += paragraph.length + 1;
  }
  return {
    lines,
    lineHeight,
    width: Math.max(0, ...lines.map((line) => line.width)),
    height: lineHeight * lines.length,
  };
}

export function editableTextCaret(
  layout: EditableTextLayout,
  offset: number,
): { x: number; y: number; line: number } {
  const lineIndex = Math.max(0, layout.lines.findIndex((line, index) => (
    offset >= line.start && (offset < line.end || index === layout.lines.length - 1
      || offset < layout.lines[index + 1]!.start)
  )));
  const line = layout.lines[lineIndex]!;
  const position = line.positions.find((entry) => entry.offset >= offset) ?? line.positions.at(-1)!;
  return { x: position.x, y: lineIndex * layout.lineHeight, line: lineIndex };
}

export function editableTextOffsetAt(layout: EditableTextLayout, x: number, y: number): number {
  const line = layout.lines[Math.max(0, Math.min(layout.lines.length - 1, Math.floor(y / layout.lineHeight)))]!;
  for (let index = 0; index < line.positions.length - 1; ++index) {
    const current = line.positions[index]!;
    const next = line.positions[index + 1]!;
    if (x < (current.x + next.x) / 2) {
      return current.offset;
    }
  }
  return line.end;
}

export {};

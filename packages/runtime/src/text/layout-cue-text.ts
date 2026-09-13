import { CueWhiteSpace } from '@bsgames/cue-style-schema';
import { LineBreaker } from 'css-line-break';

export interface CueTextLineLayout {
  text: string;
  width: number;
}

export interface CueTextLayout {
  height: number;
  lines: readonly CueTextLineLayout[];
  width: number;
}

export type MeasureCueTextWidth = (text: string) => number;

interface PreparedCueText {
  collapseLineEdgeSpaces: boolean;
  paragraphs: readonly string[];
  wrap: boolean;
}

export function layoutCueTextLines(
  text: string,
  whiteSpace: CueWhiteSpace,
  availableWidth: number | undefined,
  measureWidth: MeasureCueTextWidth,
): readonly CueTextLineLayout[] {
  const prepared = prepareCueText(text, whiteSpace);
  if (prepared.paragraphs.length === 0) {
    return [];
  }
  return prepared.paragraphs.flatMap((paragraph) => (
    prepared.wrap && availableWidth !== undefined
      ? wrapParagraph(
        paragraph,
        Math.max(0, availableWidth),
        prepared.collapseLineEdgeSpaces,
        measureWidth,
      )
      : [createLine(paragraph, measureWidth)]
  ));
}

function prepareCueText(
  text: string,
  whiteSpace: CueWhiteSpace,
): PreparedCueText {
  const normalizedText = text.replace(/\r\n?|\f/gu, '\n');
  switch (whiteSpace) {
  case CueWhiteSpace.normal:
  case CueWhiteSpace.nowrap: {
    const collapsedText = collapseWhiteSpace(normalizedText);
    return {
      collapseLineEdgeSpaces: true,
      paragraphs: collapsedText.length > 0 ? [collapsedText] : [],
      wrap: whiteSpace === CueWhiteSpace.normal,
    };
  }
  case CueWhiteSpace.pre:
  case CueWhiteSpace.preWrap:
    return {
      collapseLineEdgeSpaces: false,
      paragraphs: normalizedText.split('\n'),
      wrap: whiteSpace === CueWhiteSpace.preWrap,
    };
  case CueWhiteSpace.preLine: {
    const paragraphs = normalizedText
      .split('\n')
      .map((paragraph) => collapseHorizontalWhiteSpace(paragraph));
    return {
      collapseLineEdgeSpaces: true,
      paragraphs: normalizedText.includes('\n') || paragraphs.some(Boolean)
        ? paragraphs
        : [],
      wrap: true,
    };
  }
  }
  throw new Error(`Unsupported white-space value: ${String(whiteSpace)}`);
}

function collapseWhiteSpace(text: string): string {
  return trimCollapsibleSpaces(text.replace(/[ \t\n]+/gu, ' '));
}

function collapseHorizontalWhiteSpace(text: string): string {
  return trimCollapsibleSpaces(text.replace(/[ \t]+/gu, ' '));
}

function wrapParagraph(
  paragraph: string,
  availableWidth: number,
  collapseLineEdgeSpaces: boolean,
  measureWidth: MeasureCueTextWidth,
): CueTextLineLayout[] {
  if (paragraph.length === 0) {
    return [createLine('', measureWidth)];
  }

  const segments = collectLineBreakSegments(paragraph);
  const lines: CueTextLineLayout[] = [];
  let line = '';
  for (const segment of segments) {
    const candidate = line + segment;
    if (
      line.length > 0
      && createLine(candidate, measureWidth).width > availableWidth
    ) {
      lines.push(createLine(
        collapseLineEdgeSpaces ? trimTrailingCollapsibleSpaces(line) : line,
        measureWidth,
      ));
      line = collapseLineEdgeSpaces
        ? trimLeadingCollapsibleSpaces(segment)
        : segment;
    } else {
      line = candidate;
    }
  }
  lines.push(createLine(
    collapseLineEdgeSpaces ? trimTrailingCollapsibleSpaces(line) : line,
    measureWidth,
  ));
  return lines;
}

function collectLineBreakSegments(text: string): string[] {
  const segments: string[] = [];
  const iterator = LineBreaker(text, {
    lineBreak: 'normal',
    wordBreak: 'normal',
  });
  for (let result = iterator.next(); !result.done; result = iterator.next()) {
    segments.push(result.value.slice());
  }
  return segments;
}

function trimCollapsibleSpaces(text: string): string {
  return trimTrailingCollapsibleSpaces(trimLeadingCollapsibleSpaces(text));
}

function trimLeadingCollapsibleSpaces(text: string): string {
  return text.replace(/^ +/u, '');
}

function trimTrailingCollapsibleSpaces(text: string): string {
  return text.replace(/ +$/u, '');
}

function createLine(
  text: string,
  measureWidth: MeasureCueTextWidth,
): CueTextLineLayout {
  const expandedText = expandTabs(text, measureWidth);
  return {
    text: expandedText,
    width: measureWidth(expandedText),
  };
}

function expandTabs(
  text: string,
  measureWidth: MeasureCueTextWidth,
): string {
  if (!text.includes('\t')) {
    return text;
  }
  const spaceWidth = measureWidth(' ');
  const tabWidth = measureWidth('        ');
  if (spaceWidth <= 0 || tabWidth <= 0) {
    return text.replaceAll('\t', '        ');
  }

  let expandedText = '';
  for (const character of text) {
    if (character !== '\t') {
      expandedText += character;
      continue;
    }
    const currentWidth = measureWidth(expandedText);
    const nextTabStop = (Math.floor(currentWidth / tabWidth) + 1) * tabWidth;
    const spaceCount = Math.max(
      1,
      Math.ceil((nextTabStop - currentWidth) / spaceWidth),
    );
    expandedText += ' '.repeat(spaceCount);
  }
  return expandedText;
}

export {};

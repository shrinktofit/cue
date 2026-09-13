import {
  CueAlignContent,
  CueAlignItems,
  CueAlignSelf,
  CueBorderStyle,
  CueBoxSizing,
  CueDisplay,
  CueFlexDirection,
  CueFlexWrap,
  CueJustifyContent,
  CueMaxDimensionKeyword,
  CueTextAlign,
  type CueColor,
  type CueDimension,
  type CueLengthPercentage,
  type CueMaxDimension,
  type CueStyleSheet,
} from '@bsgames/cue-style-schema';
import initializeTaffy, {
  AlignContent,
  AlignItems,
  AlignSelf,
  BoxSizing,
  Display,
  FlexDirection,
  FlexWrap,
  JustifyContent,
  Style,
  TaffyTree,
  type Dimension,
  type LengthPercentage,
  type MeasureFunction,
  type Point,
  type Size,
  type StylePropertyValues,
} from 'taffy-layout/wasm';
import { CueElement } from '../element/cue-element.js';
import { Text } from '../element/text.js';
import {
  computeCueElementStyle,
  type ComputedCueElementStyle,
  type ComputedCueTextStyle,
  initialCueTextStyle,
} from '../style/compute-cue-element-style.js';
import type { CueTextLayout } from '../text/layout-cue-text.js';

export interface CuePaintRect {
  borderColor: CueColor;
  borderWidth: number;
  color: CueColor;
  height: number;
  radii: readonly [number, number, number, number];
  width: number;
  x: number;
  y: number;
}

export interface CuePaintText {
  element: CueElement;
  height: number;
  lines: readonly CuePaintTextLine[];
  style: ComputedCueTextStyle;
  width: number;
  x: number;
  y: number;
}

export interface CuePaintTextLine {
  text: string;
  x: number;
}

export interface CuePaintList {
  rects: CuePaintRect[];
  texts: CuePaintText[];
}

export interface CueTextMeasurer {
  layout(
    text: string,
    style: ComputedCueTextStyle,
    availableWidth?: number,
  ): CueTextLayout;
}

interface CueLayoutRecord {
  children: CueLayoutRecord[];
  element: CueElement;
  node: bigint;
  style: ComputedCueElementStyle;
  text?: string;
}

interface CueTextLayoutContext {
  style: ComputedCueTextStyle;
  text: string;
}

const alignContentByCueValue: Record<CueAlignContent, AlignContent> = {
  [CueAlignContent.center]: AlignContent.Center,
  [CueAlignContent.end]: AlignContent.End,
  [CueAlignContent.flexEnd]: AlignContent.FlexEnd,
  [CueAlignContent.flexStart]: AlignContent.FlexStart,
  [CueAlignContent.spaceAround]: AlignContent.SpaceAround,
  [CueAlignContent.spaceBetween]: AlignContent.SpaceBetween,
  [CueAlignContent.spaceEvenly]: AlignContent.SpaceEvenly,
  [CueAlignContent.start]: AlignContent.Start,
  [CueAlignContent.stretch]: AlignContent.Stretch,
};
const alignItemsByCueValue: Record<CueAlignItems, AlignItems> = {
  [CueAlignItems.baseline]: AlignItems.Baseline,
  [CueAlignItems.center]: AlignItems.Center,
  [CueAlignItems.end]: AlignItems.End,
  [CueAlignItems.flexEnd]: AlignItems.FlexEnd,
  [CueAlignItems.flexStart]: AlignItems.FlexStart,
  [CueAlignItems.start]: AlignItems.Start,
  [CueAlignItems.stretch]: AlignItems.Stretch,
};
const alignSelfByCueValue: Record<CueAlignSelf, AlignSelf> = {
  [CueAlignSelf.auto]: AlignSelf.Auto,
  [CueAlignSelf.baseline]: AlignSelf.Baseline,
  [CueAlignSelf.center]: AlignSelf.Center,
  [CueAlignSelf.end]: AlignSelf.End,
  [CueAlignSelf.flexEnd]: AlignSelf.FlexEnd,
  [CueAlignSelf.flexStart]: AlignSelf.FlexStart,
  [CueAlignSelf.start]: AlignSelf.Start,
  [CueAlignSelf.stretch]: AlignSelf.Stretch,
};
const boxSizingByCueValue: Record<CueBoxSizing, BoxSizing> = {
  [CueBoxSizing.borderBox]: BoxSizing.BorderBox,
  [CueBoxSizing.contentBox]: BoxSizing.ContentBox,
};
const displayByCueValue: Record<CueDisplay, Display> = {
  [CueDisplay.block]: Display.Block,
  [CueDisplay.flex]: Display.Flex,
};
const flexDirectionByCueValue: Record<CueFlexDirection, FlexDirection> = {
  [CueFlexDirection.column]: FlexDirection.Column,
  [CueFlexDirection.columnReverse]: FlexDirection.ColumnReverse,
  [CueFlexDirection.row]: FlexDirection.Row,
  [CueFlexDirection.rowReverse]: FlexDirection.RowReverse,
};
const flexWrapByCueValue: Record<CueFlexWrap, FlexWrap> = {
  [CueFlexWrap.nowrap]: FlexWrap.NoWrap,
  [CueFlexWrap.wrap]: FlexWrap.Wrap,
  [CueFlexWrap.wrapReverse]: FlexWrap.WrapReverse,
};
const justifyContentByCueValue: Record<CueJustifyContent, JustifyContent> = {
  [CueJustifyContent.center]: JustifyContent.Center,
  [CueJustifyContent.end]: JustifyContent.End,
  [CueJustifyContent.flexEnd]: JustifyContent.FlexEnd,
  [CueJustifyContent.flexStart]: JustifyContent.FlexStart,
  [CueJustifyContent.spaceAround]: JustifyContent.SpaceAround,
  [CueJustifyContent.spaceBetween]: JustifyContent.SpaceBetween,
  [CueJustifyContent.spaceEvenly]: JustifyContent.SpaceEvenly,
  [CueJustifyContent.start]: JustifyContent.Start,
  [CueJustifyContent.stretch]: JustifyContent.Stretch,
};

let cueLayoutInitialization: Promise<void> | undefined;
let cueLayoutInitialized = false;

export function initializeCueLayout(): Promise<void> {
  cueLayoutInitialization ??= import('./taffy_wasm_bg.wasm?wasm-binary')
    .then(async ({ default: taffyWasmBinary }) => {
      await initializeTaffy({
        module_or_path: taffyWasmBinary,
      });
      cueLayoutInitialized = true;
    });
  return cueLayoutInitialization;
}

export function createCuePaintList(
  root: CueElement,
  styleSheets: readonly CueStyleSheet[],
  textMeasurer: CueTextMeasurer,
): CuePaintList {
  if (!cueLayoutInitialized) {
    throw new Error('Cue layout must be initialized before computing a paint list.');
  }

  const tree = new TaffyTree();
  try {
    const rootText = root.children
      .filter((node) => node instanceof Text)
      .map((node) => node.data)
      .join('');
    if (hasNonCollapsibleText(rootText)) {
      throw new Error('Direct text children of CueRootElement are not supported yet.');
    }
    const children = root.children.flatMap((node) => node instanceof CueElement
      ? [createLayoutRecord(
        tree,
        node,
        styleSheets,
        initialCueTextStyle,
      )]
      : []);
    children.sort((left, right) => left.style.order - right.style.order);
    const rootStyle = new Style();
    let rootNode: bigint;
    try {
      rootNode = tree.newWithChildren(
        rootStyle,
        children.map((child) => child.node),
      );
    } finally {
      rootStyle.free();
    }
    tree.computeLayoutWithMeasure(
      rootNode,
      {
        height: 'max-content',
        width: 'max-content',
      },
      createMeasureFunction(textMeasurer),
    );

    const paintList: CuePaintList = {
      rects: [],
      texts: [],
    };
    appendPaintCommands(tree, children, 0, 0, textMeasurer, paintList);
    return paintList;
  } finally {
    tree.free();
  }
}

function createLayoutRecord(
  tree: TaffyTree,
  element: CueElement,
  styleSheets: readonly CueStyleSheet[],
  inheritedTextStyle: ComputedCueTextStyle,
): CueLayoutRecord {
  const style = computeCueElementStyle(
    element,
    styleSheets,
    inheritedTextStyle,
  );
  const elementChildren = element.children.filter(
    (node) => node instanceof CueElement,
  );
  const directText = element.children
    .filter((node) => node instanceof Text)
    .map((node) => node.data)
    .join('');
  if (elementChildren.length > 0 && hasNonCollapsibleText(directText)) {
    throw new Error(
      `Mixed text and element children in <${element.tagName}> require an inline formatting context, which is not supported yet.`,
    );
  }
  const children = elementChildren.map((child) => createLayoutRecord(
    tree,
    child,
    styleSheets,
    style,
  ));
  children.sort((left, right) => left.style.order - right.style.order);
  const text = elementChildren.length === 0 && directText.length > 0
    ? directText
    : undefined;
  const taffyStyle = createTaffyStyle(element, style);
  let node: bigint;
  try {
    node = text === undefined
      ? tree.newWithChildren(
        taffyStyle,
        children.map((child) => child.node),
      )
      : tree.newLeafWithContext(taffyStyle, {
        style,
        text,
      } satisfies CueTextLayoutContext);
  } finally {
    taffyStyle.free();
  }
  return {
    children,
    element,
    node,
    style,
    ...(text === undefined ? {} : { text }),
  };
}

function hasNonCollapsibleText(text: string): boolean {
  return /[^ \t\r\n\f]/u.test(text);
}

function createMeasureFunction(
  textMeasurer: CueTextMeasurer,
): MeasureFunction {
  return (
    knownDimensions,
    availableSpace,
    _node,
    context,
  ) => {
    const textContext = context as CueTextLayoutContext | undefined;
    if (!textContext) {
      return {
        height: knownDimensions.height ?? 0,
        width: knownDimensions.width ?? 0,
      };
    }
    const textLayout = textMeasurer.layout(
      textContext.text,
      textContext.style,
      knownDimensions.width ?? textAvailableWidth(availableSpace.width),
    );
    return {
      height: knownDimensions.height ?? textLayout.height,
      width: knownDimensions.width ?? textLayout.width,
    };
  };
}

function textAvailableWidth(
  availableWidth: number | 'max-content' | 'min-content',
): number | undefined {
  if (typeof availableWidth === 'number') {
    return availableWidth;
  }
  return availableWidth === 'min-content' ? 0 : undefined;
}

function createTaffyStyle(
  element: CueElement,
  style: ComputedCueElementStyle,
): Style {
  if (style.display === undefined) {
    throw new Error(
      `CSS initial value "display: inline" is not supported for <${element.tagName}> yet. Declare "display: block" or "display: flex".`,
    );
  }
  const borderWidth = style.borderStyle === CueBorderStyle.solid
    ? style.borderWidth
    : 0;
  const properties: StylePropertyValues = {
    border: {
      bottom: borderWidth,
      left: borderWidth,
      right: borderWidth,
      top: borderWidth,
    },
    boxSizing: boxSizingByCueValue[style.boxSizing],
    display: displayByCueValue[style.display],
    flexBasis: toTaffyDimension(style.flexBasis),
    flexDirection: flexDirectionByCueValue[style.flexDirection],
    flexGrow: style.flexGrow,
    flexShrink: style.flexShrink,
    flexWrap: flexWrapByCueValue[style.flexWrap],
    gap: {
      height: toTaffyLengthPercentage(style.rowGap),
      width: toTaffyLengthPercentage(style.columnGap),
    },
    margin: {
      bottom: style.marginBottom,
      left: style.marginLeft,
      right: style.marginRight,
      top: style.marginTop,
    },
    maxSize: {
      height: toTaffyMaxDimension(style.maxHeight),
      width: toTaffyMaxDimension(style.maxWidth),
    },
    minSize: {
      height: toTaffyDimension(style.minHeight),
      width: toTaffyDimension(style.minWidth),
    },
    padding: {
      bottom: toTaffyLengthPercentage(style.paddingBottom),
      left: toTaffyLengthPercentage(style.paddingLeft),
      right: toTaffyLengthPercentage(style.paddingRight),
      top: toTaffyLengthPercentage(style.paddingTop),
    },
    size: {
      height: toTaffyDimension(style.height),
      width: toTaffyDimension(style.width),
    },
  };
  if (style.alignContent !== undefined) {
    properties.alignContent = alignContentByCueValue[style.alignContent];
  }
  if (style.alignItems !== undefined) {
    properties.alignItems = alignItemsByCueValue[style.alignItems];
  }
  if (style.alignSelf !== undefined) {
    properties.alignSelf = alignSelfByCueValue[style.alignSelf];
  }
  if (style.justifyContent !== undefined) {
    properties.justifyContent = justifyContentByCueValue[style.justifyContent];
  }
  return new Style(properties);
}

function toTaffyDimension(value: CueDimension): Dimension {
  return value;
}

function toTaffyMaxDimension(value: CueMaxDimension): Dimension {
  return value === CueMaxDimensionKeyword.none ? 'auto' : value;
}

function toTaffyLengthPercentage(
  value: CueLengthPercentage,
): LengthPercentage {
  return value;
}

function appendPaintCommands(
  tree: TaffyTree,
  records: readonly CueLayoutRecord[],
  parentX: number,
  parentY: number,
  textMeasurer: CueTextMeasurer,
  paintList: CuePaintList,
): void {
  for (const record of records) {
    const layout = tree.getLayout(record.node);
    let x: number;
    let y: number;
    let width: number;
    let height: number;
    let contentX: number;
    let contentY: number;
    let contentWidth: number;
    try {
      const position = layout.position as Point<number>;
      const size = layout.size as Size<number>;
      x = parentX + position.x;
      y = parentY + position.y;
      width = size.width;
      height = size.height;
      contentX = x + layout.borderLeft + layout.paddingLeft;
      contentY = y + layout.borderTop + layout.paddingTop;
      contentWidth = Math.max(
        0,
        width
        - layout.borderLeft
        - layout.borderRight
        - layout.paddingLeft
        - layout.paddingRight,
      );
    } finally {
      layout.free();
    }

    const borderWidth = record.style.borderStyle === CueBorderStyle.solid
      ? record.style.borderWidth
      : 0;
    if (
      width > 0
      && height > 0
      && (
        record.style.backgroundColor.alpha > 0
        || (
          borderWidth > 0
          && record.style.borderColor.alpha > 0
        )
      )
    ) {
      paintList.rects.push({
        borderColor: record.style.borderColor,
        borderWidth,
        color: record.style.backgroundColor,
        height,
        radii: record.style.borderRadius,
        width,
        x,
        y: -y,
      });
    }
    if (record.text !== undefined && record.style.color.alpha > 0) {
      const textLayout = textMeasurer.layout(
        record.text,
        record.style,
        contentWidth,
      );
      const paintGeometry = createTextPaintGeometry(
        textLayout,
        record.style.textAlign,
        contentWidth,
      );
      if (
        paintGeometry.width > 0
        && textLayout.height > 0
        && paintGeometry.lines.some((line) => line.text.length > 0)
      ) {
        paintList.texts.push({
          element: record.element,
          height: textLayout.height,
          lines: paintGeometry.lines,
          style: record.style,
          width: paintGeometry.width,
          x: contentX + paintGeometry.x,
          y: -contentY,
        });
      }
    }
    appendPaintCommands(
      tree,
      record.children,
      x,
      y,
      textMeasurer,
      paintList,
    );
  }
}

interface CueTextPaintGeometry {
  lines: readonly CuePaintTextLine[];
  width: number;
  x: number;
}

function createTextPaintGeometry(
  textLayout: CueTextLayout,
  textAlign: CueTextAlign,
  contentWidth: number,
): CueTextPaintGeometry {
  if (textLayout.lines.length === 0) {
    return {
      lines: [],
      width: 0,
      x: 0,
    };
  }
  const lineOffsets = textLayout.lines.map((line) => textAlignmentOffset(
    textAlign,
    contentWidth,
    line.width,
  ));
  const left = Math.min(...lineOffsets);
  const right = Math.max(...textLayout.lines.map(
    (line, index) => (lineOffsets[index] ?? 0) + line.width,
  ));
  return {
    lines: textLayout.lines.map((line, index) => ({
      text: line.text,
      x: (lineOffsets[index] ?? 0) - left,
    })),
    width: Math.max(0, right - left),
    x: left,
  };
}

function textAlignmentOffset(
  textAlign: CueTextAlign,
  contentWidth: number,
  textWidth: number,
): number {
  switch (textAlign) {
  case CueTextAlign.center:
    return (contentWidth - textWidth) / 2;
  case CueTextAlign.end:
  case CueTextAlign.right:
    return contentWidth - textWidth;
  case CueTextAlign.left:
  case CueTextAlign.start:
    return 0;
  }
}

export {};

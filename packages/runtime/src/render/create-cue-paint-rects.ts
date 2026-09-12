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
  type Point,
  type Size,
  type StylePropertyValues,
} from 'taffy-layout/wasm';
import { CueElement } from '../element/cue-element.js';
import {
  computeCueElementStyle,
  type ComputedCueElementStyle,
} from '../style/compute-cue-element-style.js';

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

interface CueLayoutRecord {
  children: CueLayoutRecord[];
  node: bigint;
  style: ComputedCueElementStyle;
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

export function createCuePaintRects(
  root: CueElement,
  styleSheets: readonly CueStyleSheet[],
): CuePaintRect[] {
  if (!cueLayoutInitialized) {
    throw new Error('Cue layout must be initialized before computing paint rectangles.');
  }

  const tree = new TaffyTree();
  try {
    const children = root.children.flatMap((node) => node instanceof CueElement
      ? [createLayoutRecord(tree, node, styleSheets)]
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
    tree.computeLayout(rootNode, {
      height: 'max-content',
      width: 'max-content',
    });

    const paintRects: CuePaintRect[] = [];
    appendPaintRects(tree, children, 0, 0, paintRects);
    return paintRects;
  } finally {
    tree.free();
  }
}

function createLayoutRecord(
  tree: TaffyTree,
  element: CueElement,
  styleSheets: readonly CueStyleSheet[],
): CueLayoutRecord {
  const children = element.children.flatMap((node) => node instanceof CueElement
    ? [createLayoutRecord(tree, node, styleSheets)]
    : []);
  children.sort((left, right) => left.style.order - right.style.order);
  const style = computeCueElementStyle(element, styleSheets);
  const taffyStyle = createTaffyStyle(element, style);
  let node: bigint;
  try {
    node = tree.newWithChildren(
      taffyStyle,
      children.map((child) => child.node),
    );
  } finally {
    taffyStyle.free();
  }
  return {
    children,
    node,
    style,
  };
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

function appendPaintRects(
  tree: TaffyTree,
  records: readonly CueLayoutRecord[],
  parentX: number,
  parentY: number,
  paintRects: CuePaintRect[],
): void {
  for (const record of records) {
    const layout = tree.getLayout(record.node);
    let x: number;
    let y: number;
    let width: number;
    let height: number;
    try {
      const position = layout.position as Point<number>;
      const size = layout.size as Size<number>;
      x = parentX + position.x;
      y = parentY + position.y;
      width = size.width;
      height = size.height;
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
      paintRects.push({
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
    appendPaintRects(tree, record.children, x, y, paintRects);
  }
}

export {};

import {
  CueAlignItems,
  CueDisplay,
  CueFlexDirection,
  CueJustifyContent,
  type CueColor,
  type CueStyleSheet,
} from '@bsgames/cue-style-schema';
import initializeTaffy, {
  AlignItems,
  Display,
  FlexDirection,
  JustifyContent,
  Style,
  TaffyTree,
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

const alignItemsByCueValue: Record<CueAlignItems, AlignItems> = {
  [CueAlignItems.center]: AlignItems.Center,
  [CueAlignItems.end]: AlignItems.End,
  [CueAlignItems.flexEnd]: AlignItems.FlexEnd,
  [CueAlignItems.flexStart]: AlignItems.FlexStart,
  [CueAlignItems.start]: AlignItems.Start,
  [CueAlignItems.stretch]: AlignItems.Stretch,
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
  const properties: StylePropertyValues = {
    display: displayByCueValue[style.display],
    flexDirection: flexDirectionByCueValue[style.flexDirection],
    gap: {
      height: style.gap.row,
      width: style.gap.column,
    },
    size: {
      height: style.height ?? 'auto',
      width: style.width ?? 'auto',
    },
  };
  if (style.alignItems !== undefined) {
    properties.alignItems = alignItemsByCueValue[style.alignItems];
  }
  if (style.justifyContent !== undefined) {
    properties.justifyContent = justifyContentByCueValue[style.justifyContent];
  }
  return new Style(properties);
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

    if (width > 0 && height > 0 && record.style.backgroundColor.alpha > 0) {
      paintRects.push({
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

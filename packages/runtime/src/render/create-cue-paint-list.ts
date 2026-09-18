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
  CueOverflow,
  CuePosition,
  CueTextAlign,
  type CueColor,
  type CueDimension,
  type CueLengthPercentage,
  type CueLinearGradient,
  type CueMaxDimension,
  type CueStyleSheet,
} from '@bsgames/cue-style-schema';
import type { SpriteFrame, Texture2D } from 'cc';
import initializeTaffy, {
  AlignContent,
  AlignItems,
  AlignSelf,
  BoxSizing,
  Display,
  FlexDirection,
  FlexWrap,
  JustifyContent,
  Position,
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
import {
  CueImageElement,
  getCueImageSource,
} from '../element/cue-image-element.js';
import { Text } from '../element/text.js';
import {
  computeCueElementStyle,
  type ComputedCueElementStyle,
  type ComputedCueTextStyle,
  initialCueTextStyle,
} from '../style/compute-cue-element-style.js';
import type { CueTextLayout } from '../text/layout-cue-text.js';
import {
  createCueElementTransform,
  identityCueAffineTransform,
  type CueAffineTransform,
} from './cue-affine-transform.js';

export interface CuePaintRect {
  borderColors: readonly [CueColor, CueColor, CueColor, CueColor];
  borderWidths: readonly [number, number, number, number];
  clipDepth: number;
  color: CueColor;
  opacity: number;
  gradient?: CueLinearGradient;
  gradientArea?: {
    height: number;
    width: number;
    x: number;
    y: number;
  };
  transform: CueAffineTransform;
  height: number;
  radii: readonly [
    readonly [number, number],
    readonly [number, number],
    readonly [number, number],
    readonly [number, number],
  ];
  width: number;
  x: number;
  y: number;
}

export interface CuePaintImage {
  clipDepth: number;
  element: CueImageElement;
  height: number;
  opacity: number;
  spriteFrame: SpriteFrame;
  transform: CueAffineTransform;
  width: number;
  x: number;
  y: number;
}

export interface CuePaintBackground {
  clipDepth: number;
  element: CueElement;
  height: number;
  opacity: number;
  radii: CuePaintRect['radii'];
  texture: Texture2D;
  transform: CueAffineTransform;
  width: number;
  x: number;
  y: number;
  imageOffsetX: number;
  imageOffsetY: number;
}

export interface CuePaintShadow {
  blur: number;
  clipDepth: number;
  color: CueColor;
  height: number;
  opacity: number;
  inset: boolean;
  radii: CuePaintRect['radii'];
  spread: number;
  transform: CueAffineTransform;
  width: number;
  x: number;
  xOffset: number;
  y: number;
  yOffset: number;
}

export interface CuePaintText {
  clipDepth: number;
  element: CueElement;
  height: number;
  opacity: number;
  lines: readonly CuePaintTextLine[];
  style: ComputedCueTextStyle;
  transform: CueAffineTransform;
  width: number;
  x: number;
  y: number;
}

export interface CuePaintTextLine {
  text: string;
  x: number;
}

export interface CuePaintList {
  commands: CuePaintCommand[];
}

export enum CuePaintCommandKind {
  background = 'background',
  clipEnter = 'clip-enter',
  clipExit = 'clip-exit',
  image = 'image',
  rect = 'rect',
  shadow = 'shadow',
  text = 'text',
}

export type CuePaintCommand = {
  kind: CuePaintCommandKind.background;
  paint: CuePaintBackground;
} | {
  kind: CuePaintCommandKind.clipEnter;
  paint: CuePaintRect;
} | {
  kind: CuePaintCommandKind.clipExit;
  paint: CuePaintRect;
} | {
  kind: CuePaintCommandKind.image;
  paint: CuePaintImage;
} | {
  kind: CuePaintCommandKind.rect;
  paint: CuePaintRect;
} | {
  kind: CuePaintCommandKind.shadow;
  paint: CuePaintShadow;
} | {
  kind: CuePaintCommandKind.text;
  paint: CuePaintText;
};

export type CueImageSourceLookup = (
  source: string,
) => SpriteFrame | undefined;

export type CueBackgroundSourceLookup = (
  source: string,
) => Texture2D | undefined;

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
  layoutChildren: bigint[];
  layoutParent: CueLayoutRecord | undefined;
  node: bigint;
  parent: CueLayoutRecord | undefined;
  position: Point<number>;
  staticPositionNode?: bigint;
  style: ComputedCueElementStyle;
  image?: SpriteFrame;
  text?: string;
}

interface CueTextLayoutContext {
  kind: CueIntrinsicContentKind.text;
  style: ComputedCueTextStyle;
  text: string;
}

interface CueImageLayoutContext {
  height: number;
  kind: CueIntrinsicContentKind.image;
  width: number;
}

type CueIntrinsicLayoutContext = CueImageLayoutContext | CueTextLayoutContext;

enum CueIntrinsicContentKind {
  image = 'image',
  text = 'text',
}

enum StaticPositionAlignment {
  start = 0,
  center = 0.5,
  end = 1,
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
  imageSourceLookup: CueImageSourceLookup,
  backgroundSourceLookup: CueBackgroundSourceLookup,
  viewport?: Size<number>,
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
        imageSourceLookup,
      )]
      : []);
    const rootStyle = new Style(viewport === undefined ? {} : { size: viewport });
    let rootNode: bigint;
    try {
      rootNode = tree.newWithChildren(
        rootStyle,
        children.map((child) => child.node),
      );
    } finally {
      rootStyle.free();
    }
    const layoutChildren = children.map((child) => child.node);
    const absoluteRecords: CueLayoutRecord[] = [];
    connectLayoutChildren(tree, children, undefined, undefined, layoutChildren, absoluteRecords);
    tree.setChildren(rootNode, layoutChildren);
    const availableSpace = viewport ?? {
      height: 'max-content' as const,
      width: 'max-content' as const,
    };
    const measureFunction = createMeasureFunction(textMeasurer);
    tree.computeLayoutWithMeasure(
      rootNode,
      availableSpace,
      measureFunction,
    );
    if (absoluteRecords.some((record) => record.staticPositionNode !== undefined)) {
      updateStaticPositionPlaceholders(tree, absoluteRecords);
      tree.computeLayoutWithMeasure(rootNode, availableSpace, measureFunction);
    }
    updateLayoutPositions(tree, children);
    for (const record of absoluteRecords) {
      if (
        record.style.width !== 'auto'
        || (record.style.left !== 'auto' && record.style.right !== 'auto')
      ) {
        continue;
      }
      const layout = tree.getLayout(record.node);
      const containingLayout = tree.getLayout(record.layoutParent?.node ?? rootNode);
      const sizingStyle = createTaffyStyle(record.element, record.style);
      try {
        const containingWidth = containingLayout.width - containingLayout.borderLeft - containingLayout.borderRight;
        const containingHeight = containingLayout.height - containingLayout.borderTop - containingLayout.borderBottom;
        const alignment = staticHorizontalAlignment(record);
        const anchor = record.position.x
          + layout.width * alignment
          - (record.layoutParent?.position.x ?? 0)
          - containingLayout.borderLeft;
        const remainingStart = anchor - layout.marginLeft;
        const remainingEnd = containingWidth - anchor - layout.marginRight;
        const availableWidth = Math.max(0,
          record.style.left !== 'auto'
            ? containingWidth - pixelLength(record.style.left, containingWidth) - layout.marginLeft - layout.marginRight
            : record.style.right !== 'auto'
              ? containingWidth - pixelLength(record.style.right, containingWidth) - layout.marginLeft - layout.marginRight
              : alignment === StaticPositionAlignment.center
                ? 2 * Math.min(remainingStart, remainingEnd)
                : alignment === StaticPositionAlignment.end ? remainingStart : remainingEnd);
        // Taffy's block absolute sizing does not subtract insets from available
        // space. Measure this subtree with CSS shrink-to-fit space, retaining the
        // real containing block as the basis for its percentage box properties.
        sizingStyle.size = { height: pixelDimension(record.style.height, containingHeight), width: 'auto' };
        sizingStyle.minSize = {
          height: pixelDimension(record.style.minHeight, containingHeight),
          width: pixelDimension(record.style.minWidth, containingWidth),
        };
        sizingStyle.maxSize = {
          height: pixelDimension(record.style.maxHeight, containingHeight),
          width: pixelDimension(record.style.maxWidth, containingWidth),
        };
        sizingStyle.padding = {
          bottom: layout.paddingBottom,
          left: layout.paddingLeft,
          right: layout.paddingRight,
          top: layout.paddingTop,
        };
        sizingStyle.margin = { bottom: 0, left: 0, right: 0, top: 0 };
        sizingStyle.inset = { bottom: 'auto', left: 'auto', right: 'auto', top: 'auto' };
        tree.setStyle(record.node, sizingStyle);
        const measurementContainerStyle = new Style({
          display: Display.Block,
          size: { height: containingHeight, width: availableWidth },
        });
        const parentNode = record.layoutParent?.node ?? rootNode;
        tree.removeChild(parentNode, record.node);
        const measurementNode = tree.newWithChildren(measurementContainerStyle, [record.node]);
        const finalStyle = createTaffyStyle(record.element, record.style);
        try {
          tree.computeLayoutWithMeasure(measurementNode, { height: containingHeight, width: availableWidth }, measureFunction);
          const intrinsicLayout = tree.getLayout(record.node);
          try {
            finalStyle.width = record.style.boxSizing === CueBoxSizing.borderBox
              ? intrinsicLayout.width
              : Math.max(0, intrinsicLayout.width
              - intrinsicLayout.paddingLeft - intrinsicLayout.paddingRight
              - intrinsicLayout.borderLeft - intrinsicLayout.borderRight);
          } finally {
            intrinsicLayout.free();
          }
          tree.removeChild(measurementNode, record.node);
          tree.setChildren(parentNode, record.layoutParent?.layoutChildren ?? layoutChildren);
          tree.setStyle(record.node, finalStyle);
        } finally {
          tree.remove(measurementNode);
          measurementContainerStyle.free();
          finalStyle.free();
        }
      } finally {
        sizingStyle.free();
        containingLayout.free();
        layout.free();
      }
      tree.computeLayoutWithMeasure(rootNode, availableSpace, measureFunction);
      updateStaticPositionPlaceholders(tree, absoluteRecords);
      tree.computeLayoutWithMeasure(rootNode, availableSpace, measureFunction);
      updateLayoutPositions(tree, children);
    }

    const paintList: CuePaintList = {
      commands: [],
    };
    appendPaintCommands(
      tree,
      paintOrderedChildren(children, false),
      textMeasurer,
      backgroundSourceLookup,
      identityCueAffineTransform,
      0,
      1,
      paintList,
    );
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
  imageSourceLookup: CueImageSourceLookup,
  isFlexItem = false,
): CueLayoutRecord {
  const style = computeCueElementStyle(
    element,
    styleSheets,
    inheritedTextStyle,
  );
  if (style.display === undefined && (style.position === CuePosition.absolute || isFlexItem)) {
    style.display = CueDisplay.block;
  }
  const elementChildren = element.children.filter(
    (node) => node instanceof CueElement,
  );
  const directText = element.children
    .filter((node) => node instanceof Text)
    .map((node) => node.data)
    .join('');
  if (
    element instanceof CueImageElement
    && (elementChildren.length > 0 || hasNonCollapsibleText(directText))
  ) {
    throw new Error('<cue-image> is a replaced element and cannot have children.');
  }
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
    imageSourceLookup,
    style.display === CueDisplay.flex,
  ));
  if (style.display === CueDisplay.flex) {
    children.sort((left, right) => left.style.order - right.style.order);
  }
  const text = !(element instanceof CueImageElement)
    && elementChildren.length === 0
    && directText.length > 0
    ? directText
    : undefined;
  const image = element instanceof CueImageElement
    ? imageForSource(element, imageSourceLookup)
    : undefined;
  const taffyStyle = createTaffyStyle(element, style);
  let node: bigint;
  try {
    if (image) {
      node = tree.newLeafWithContext(taffyStyle, {
        height: image.rect.height,
        kind: CueIntrinsicContentKind.image,
        width: image.rect.width,
      } satisfies CueImageLayoutContext);
    } else if (text !== undefined) {
      node = tree.newLeafWithContext(taffyStyle, {
        kind: CueIntrinsicContentKind.text,
        style,
        text,
      } satisfies CueTextLayoutContext);
    } else {
      node = tree.newWithChildren(
        taffyStyle,
        children.map((child) => child.node),
      );
    }
  } finally {
    taffyStyle.free();
  }
  return {
    children,
    element,
    layoutChildren: children.map((child) => child.node),
    layoutParent: undefined,
    node,
    parent: undefined,
    position: { x: 0, y: 0 },
    style,
    ...(image === undefined ? {} : { image }),
    ...(text === undefined ? {} : { text }),
  };
}

function connectLayoutChildren(
  tree: TaffyTree,
  children: readonly CueLayoutRecord[],
  parent: CueLayoutRecord | undefined,
  containingBlock: CueLayoutRecord | undefined,
  rootChildren: bigint[],
  absoluteRecords: CueLayoutRecord[],
): void {
  for (const record of children) {
    record.parent = parent;
    record.layoutParent = parent;
    if (record.style.position === CuePosition.absolute) {
      absoluteRecords.push(record);
      record.layoutParent = containingBlock;
      if (parent !== containingBlock) {
        const parentChildren = parent?.layoutChildren ?? rootChildren;
        const index = parentChildren.indexOf(record.node);
        if (
          (record.style.left === 'auto' && record.style.right === 'auto')
          || (record.style.top === 'auto' && record.style.bottom === 'auto')
        ) {
          // A static-position placeholder must remain in the original formatting
          // context even though the box is sized by a different containing block.
          const placeholderStyle = new Style({ position: Position.Absolute });
          try {
            record.staticPositionNode = tree.newLeaf(placeholderStyle);
          } finally {
            placeholderStyle.free();
          }
          parentChildren.splice(index, 1, record.staticPositionNode);
        } else {
          parentChildren.splice(index, 1);
        }
        (containingBlock?.layoutChildren ?? rootChildren).push(record.node);
      }
    }
    connectLayoutChildren(
      tree,
      record.children,
      record,
      record.style.position !== CuePosition.static || record.style.transform.length > 0
        ? record
        : containingBlock,
      rootChildren,
      absoluteRecords,
    );
    tree.setChildren(record.node, record.layoutChildren);
  }
}

function updateLayoutPositions(
  tree: TaffyTree,
  records: readonly CueLayoutRecord[],
): void {
  for (const record of records) {
    const layout = tree.getLayout(record.node);
    try {
      record.position = {
        x: (record.layoutParent?.position.x ?? 0) + layout.x,
        y: (record.layoutParent?.position.y ?? 0) + layout.y,
      };
    } finally {
      layout.free();
    }
    if (record.staticPositionNode !== undefined) {
      const staticLayout = tree.getLayout(record.staticPositionNode);
      try {
        if (record.style.left === 'auto' && record.style.right === 'auto') {
          record.position.x = (record.parent?.position.x ?? 0) + staticLayout.x;
        }
        if (record.style.top === 'auto' && record.style.bottom === 'auto') {
          record.position.y = (record.parent?.position.y ?? 0) + staticLayout.y;
        }
      } finally {
        staticLayout.free();
      }
    }
    updateLayoutPositions(tree, record.children);
  }
}

function updateStaticPositionPlaceholders(
  tree: TaffyTree,
  records: readonly CueLayoutRecord[],
): void {
  for (const record of records) {
    if (record.staticPositionNode === undefined) {
      continue;
    }
    const layout = tree.getLayout(record.node);
    const placeholderStyle = new Style({
      alignSelf: alignSelfByCueValue[record.style.alignSelf ?? CueAlignSelf.auto],
      boxSizing: BoxSizing.BorderBox,
      margin: {
        bottom: layout.marginBottom,
        left: layout.marginLeft,
        right: layout.marginRight,
        top: layout.marginTop,
      },
      position: Position.Absolute,
      size: layout.size as Size<number>,
    });
    try {
      tree.setStyle(record.staticPositionNode, placeholderStyle);
    } finally {
      placeholderStyle.free();
      layout.free();
    }
  }
}

function staticHorizontalAlignment(record: CueLayoutRecord): StaticPositionAlignment {
  const parentStyle = record.parent?.style;
  if (parentStyle?.display !== CueDisplay.flex) {
    return StaticPositionAlignment.start;
  }
  const isRow = parentStyle.flexDirection === CueFlexDirection.row
    || parentStyle.flexDirection === CueFlexDirection.rowReverse;
  const reverse = isRow
    ? parentStyle.flexDirection === CueFlexDirection.rowReverse
    : parentStyle.flexWrap === CueFlexWrap.wrapReverse;
  const alignment = isRow
    ? parentStyle.justifyContent
    : record.style.alignSelf === undefined || record.style.alignSelf === CueAlignSelf.auto
      ? parentStyle.alignItems
      : record.style.alignSelf;
  switch (alignment) {
  case CueJustifyContent.center:
  case CueJustifyContent.spaceAround:
  case CueJustifyContent.spaceEvenly:
    return StaticPositionAlignment.center;
  case CueJustifyContent.end:
    return StaticPositionAlignment.end;
  case CueJustifyContent.start:
    return StaticPositionAlignment.start;
  case CueJustifyContent.flexEnd:
    return reverse ? StaticPositionAlignment.start : StaticPositionAlignment.end;
  default:
    return reverse ? StaticPositionAlignment.end : StaticPositionAlignment.start;
  }
}

function imageForSource(
  element: CueImageElement,
  imageSourceLookup: CueImageSourceLookup,
): SpriteFrame | undefined {
  const source = getCueImageSource(element);
  return source === undefined ? undefined : imageSourceLookup(source);
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
    const intrinsicContext = context as CueIntrinsicLayoutContext | undefined;
    if (!intrinsicContext) {
      return {
        height: knownDimensions.height ?? 0,
        width: knownDimensions.width ?? 0,
      };
    }
    if (intrinsicContext.kind === CueIntrinsicContentKind.image) {
      return measureImage(
        intrinsicContext,
        knownDimensions.width,
        knownDimensions.height,
      );
    }
    const textLayout = textMeasurer.layout(
      intrinsicContext.text,
      intrinsicContext.style,
      // Taffy passes border-box known dimensions but content-box available space.
      // It applies known dimensions itself after measuring the intrinsic content.
      textAvailableWidth(availableSpace.width),
    );
    return {
      height: textLayout.height,
      width: textLayout.width,
    };
  };
}

function measureImage(
  context: CueImageLayoutContext,
  knownWidth: number | undefined,
  knownHeight: number | undefined,
): Size<number> {
  if (knownWidth !== undefined && knownHeight !== undefined) {
    return {
      height: knownHeight,
      width: knownWidth,
    };
  }
  if (knownWidth !== undefined) {
    return {
      height: context.width > 0
        ? knownWidth * context.height / context.width
        : 0,
      width: knownWidth,
    };
  }
  if (knownHeight !== undefined) {
    return {
      height: knownHeight,
      width: context.height > 0
        ? knownHeight * context.width / context.height
        : 0,
    };
  }
  return {
    height: context.height,
    width: context.width,
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
  const properties: StylePropertyValues = {
    border: {
      bottom: borderWidth(style.borderBottomStyle, style.borderBottomWidth),
      left: borderWidth(style.borderLeftStyle, style.borderLeftWidth),
      right: borderWidth(style.borderRightStyle, style.borderRightWidth),
      top: borderWidth(style.borderTopStyle, style.borderTopWidth),
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
    position: style.position === CuePosition.absolute ? Position.Absolute : Position.Relative,
    size: {
      height: toTaffyDimension(style.height),
      width: toTaffyDimension(style.width),
    },
  };
  if (style.position !== CuePosition.static) {
    properties.inset = {
      bottom: style.bottom,
      left: style.left,
      right: style.right,
      top: style.top,
    };
  }
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

function borderWidth(style: CueBorderStyle, width: number): number {
  return style === CueBorderStyle.solid ? width : 0;
}

function toTaffyDimension(value: CueDimension): Dimension {
  return value;
}

function pixelDimension(value: CueDimension | CueMaxDimension, basis: number): Dimension {
  return value === 'auto' || value === CueMaxDimensionKeyword.none ? 'auto' : pixelLength(value, basis);
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
  textMeasurer: CueTextMeasurer,
  backgroundSourceLookup: CueBackgroundSourceLookup,
  parentTransform: CueAffineTransform,
  clipDepth: number,
  parentOpacity: number,
  paintList: CuePaintList,
): void {
  for (const record of records) {
    const opacity = parentOpacity * record.style.cueOpacity;
    if (opacity === 0) {
      continue;
    }
    const layout = tree.getLayout(record.node);
    let x: number;
    let y: number;
    let width: number;
    let height: number;
    let contentX: number;
    let contentY: number;
    let contentWidth: number;
    let contentHeight: number;
    try {
      const size = layout.size as Size<number>;
      x = record.position.x;
      y = record.position.y;
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
      contentHeight = Math.max(
        0,
        height
        - layout.borderTop
        - layout.borderBottom
        - layout.paddingTop
        - layout.paddingBottom,
      );
    } finally {
      layout.free();
    }

    const transform = createCueElementTransform(
      parentTransform,
      record.style.transform,
      record.style.transformOrigin,
      x,
      y,
      width,
      height,
    );

    const borderWidths = [
      borderWidth(record.style.borderTopStyle, record.style.borderTopWidth),
      borderWidth(record.style.borderRightStyle, record.style.borderRightWidth),
      borderWidth(record.style.borderBottomStyle, record.style.borderBottomWidth),
      borderWidth(record.style.borderLeftStyle, record.style.borderLeftWidth),
    ] as const;
    const borderColors = [
      record.style.borderTopColor,
      record.style.borderRightColor,
      record.style.borderBottomColor,
      record.style.borderLeftColor,
    ] as const;
    const radii = [
      cornerRadii(record.style.borderTopLeftRadius, width, height),
      cornerRadii(record.style.borderTopRightRadius, width, height),
      cornerRadii(record.style.borderBottomRightRadius, width, height),
      cornerRadii(record.style.borderBottomLeftRadius, width, height),
    ] as const;
    const source = record.style.backgroundImage;
    const backgroundGradient = typeof source === 'object' ? source : undefined;
    const backgroundTexture = typeof source === 'string' && source !== 'none'
      ? backgroundSourceLookup(source)
      : undefined;
    const shadows = [...record.style.boxShadow].reverse();
    const visibleBorder = borderWidths.some((value, index) => (
      value > 0 && (borderColors[index]?.alpha ?? 0) > 0
    ));
    const insetShadow = shadows.some((shadow) => shadow.inset);
    for (const shadow of shadows.filter((item) => !item.inset)) {
      paintList.commands.push({
        kind: CuePaintCommandKind.shadow,
        paint: {
          blur: shadow.blur,
          clipDepth,
          color: shadow.color,
          height,
          opacity,
          inset: shadow.inset,
          radii,
          spread: shadow.spread,
          transform,
          width,
          x,
          xOffset: shadow.xOffset,
          y: -y,
          yOffset: shadow.yOffset,
        },
      });
    }
    if (
      width > 0
      && height > 0
      && (
        record.style.backgroundColor.alpha > 0
        || (!backgroundTexture && !backgroundGradient && !insetShadow && visibleBorder)
      )
    ) {
      paintList.commands.push({
        kind: CuePaintCommandKind.rect,
        paint: {
          borderColors: backgroundTexture || backgroundGradient || insetShadow
            ? [transparentColor, transparentColor, transparentColor, transparentColor]
            : borderColors,
          borderWidths: backgroundTexture || backgroundGradient || insetShadow
            ? [0, 0, 0, 0]
            : borderWidths,
          color: record.style.backgroundColor,
          clipDepth,
          opacity,
          transform,
          height,
          radii,
          width,
          x,
          y: -y,
        },
      });
    }
    if (backgroundGradient && width > 0 && height > 0) {
      paintList.commands.push({
        kind: CuePaintCommandKind.rect,
        paint: {
          borderColors: [transparentColor, transparentColor, transparentColor, transparentColor],
          borderWidths: [0, 0, 0, 0],
          clipDepth,
          color: transparentColor,
          gradient: backgroundGradient,
          opacity,
          gradientArea: {
            height: Math.max(0, height - borderWidths[0] - borderWidths[2]),
            width: Math.max(0, width - borderWidths[1] - borderWidths[3]),
            x: borderWidths[3],
            y: borderWidths[0],
          },
          transform,
          height,
          radii,
          width,
          x,
          y: -y,
        },
      });
    }
    if (backgroundTexture && width > 0 && height > 0) {
      paintList.commands.push({
        kind: CuePaintCommandKind.background,
        paint: {
          element: record.element,
          clipDepth,
          height,
          opacity,
          imageOffsetX: borderWidths[3],
          imageOffsetY: borderWidths[0],
          radii,
          texture: backgroundTexture,
          transform,
          width,
          x,
          y: -y,
        },
      });
    }
    for (const shadow of shadows.filter((item) => item.inset)) {
      paintList.commands.push({
        kind: CuePaintCommandKind.shadow,
        paint: {
          blur: shadow.blur,
          clipDepth,
          color: shadow.color,
          height,
          opacity,
          inset: shadow.inset,
          radii,
          spread: shadow.spread,
          transform,
          width,
          x,
          xOffset: shadow.xOffset,
          y: -y,
          yOffset: shadow.yOffset,
        },
      });
    }
    if ((backgroundTexture || backgroundGradient || insetShadow) && visibleBorder && width > 0 && height > 0) {
      paintList.commands.push({
        kind: CuePaintCommandKind.rect,
        paint: {
          borderColors,
          borderWidths,
          clipDepth,
          color: transparentColor,
          opacity,
          transform,
          height,
          radii,
          width,
          x,
          y: -y,
        },
      });
    }
    const outlineWidth = borderWidth(
      record.style.outlineStyle,
      record.style.outlineWidth,
    );
    const outlineOffset = record.style.outlineOffset;
    if (
      width > 0
      && height > 0
      && outlineWidth > 0
      && record.style.outlineColor.alpha > 0
    ) {
      paintList.commands.push({
        kind: CuePaintCommandKind.rect,
        paint: {
          borderColors: [
            record.style.outlineColor,
            record.style.outlineColor,
            record.style.outlineColor,
            record.style.outlineColor,
          ],
          borderWidths: [
            outlineWidth,
            outlineWidth,
            outlineWidth,
            outlineWidth,
          ],
          color: {
            alpha: 0,
            blue: 0,
            green: 0,
            red: 0,
          },
          clipDepth,
          opacity,
          transform,
          height: height + (outlineWidth + outlineOffset) * 2,
          radii: [
            outlineRadius(record.style.borderTopLeftRadius, width, height, outlineWidth + outlineOffset),
            outlineRadius(record.style.borderTopRightRadius, width, height, outlineWidth + outlineOffset),
            outlineRadius(record.style.borderBottomRightRadius, width, height, outlineWidth + outlineOffset),
            outlineRadius(record.style.borderBottomLeftRadius, width, height, outlineWidth + outlineOffset),
          ],
          width: width + (outlineWidth + outlineOffset) * 2,
          x: x - outlineWidth - outlineOffset,
          y: -y + outlineWidth + outlineOffset,
        },
      });
    }
    const clipsContents = record.style.overflowX !== CueOverflow.visible
      && record.style.overflowY !== CueOverflow.visible;
    const contentClipDepth = clipsContents ? clipDepth + 1 : clipDepth;
    let clipRect: CuePaintRect | undefined;
    if (clipsContents && width > 0 && height > 0) {
      const clipWidth = Math.max(0, width - borderWidths[1] - borderWidths[3]);
      const clipHeight = Math.max(0, height - borderWidths[0] - borderWidths[2]);
      clipRect = {
        borderColors: [transparentColor, transparentColor, transparentColor, transparentColor],
        borderWidths: [0, 0, 0, 0],
        clipDepth,
        color: opaqueWhite,
        height: clipHeight,
        opacity: 1,
        radii: [
          insetRadius(radii[0], borderWidths[3], borderWidths[0]),
          insetRadius(radii[1], borderWidths[1], borderWidths[0]),
          insetRadius(radii[2], borderWidths[1], borderWidths[2]),
          insetRadius(radii[3], borderWidths[3], borderWidths[2]),
        ],
        transform,
        width: clipWidth,
        x: x + borderWidths[3],
        y: -y - borderWidths[0],
      };
      paintList.commands.push({
        kind: CuePaintCommandKind.clipEnter,
        paint: clipRect,
      });
    }
    if (record.image && contentWidth > 0 && contentHeight > 0) {
      paintList.commands.push({
        kind: CuePaintCommandKind.image,
        paint: {
          element: record.element,
          clipDepth: contentClipDepth,
          height: contentHeight,
          opacity,
          spriteFrame: record.image,
          transform,
          width: contentWidth,
          x: contentX,
          y: -contentY,
        },
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
        paintList.commands.push({
          kind: CuePaintCommandKind.text,
          paint: {
            element: record.element,
            clipDepth: contentClipDepth,
            height: textLayout.height,
            opacity,
            lines: paintGeometry.lines,
            style: record.style,
            transform,
            width: paintGeometry.width,
            x: contentX + paintGeometry.x,
            y: -contentY,
          },
        });
      }
    }
    appendPaintCommands(
      tree,
      paintOrderedChildren(record.children, record.style.display === CueDisplay.flex),
      textMeasurer,
      backgroundSourceLookup,
      transform,
      contentClipDepth,
      opacity,
      paintList,
    );
    if (clipRect) {
      paintList.commands.push({
        kind: CuePaintCommandKind.clipExit,
        paint: clipRect,
      });
    }
  }
}

function paintOrderedChildren(
  children: readonly CueLayoutRecord[],
  isFlexContainer: boolean,
): CueLayoutRecord[] {
  return [...children].sort((left, right) => {
    const leftPositioned = left.style.position !== CuePosition.static;
    const rightPositioned = right.style.position !== CuePosition.static;
    const leftZIndex = numericZIndex(isFlexContainer || leftPositioned ? left.style.zIndex : 'auto');
    const rightZIndex = numericZIndex(isFlexContainer || rightPositioned ? right.style.zIndex : 'auto');
    if (leftZIndex !== rightZIndex || leftZIndex !== 0) {
      return leftZIndex - rightZIndex;
    }
    // Normal-flow boxes paint before positioned auto/zero boxes. A flex item's
    // explicit z-index:0 also establishes the zero-level stacking phase.
    const leftZeroLevel = leftPositioned || (isFlexContainer && left.style.zIndex !== 'auto');
    const rightZeroLevel = rightPositioned || (isFlexContainer && right.style.zIndex !== 'auto');
    return Number(leftZeroLevel) - Number(rightZeroLevel);
  });
}

function numericZIndex(value: number | 'auto'): number {
  return value === 'auto' ? 0 : value;
}

const transparentColor: CueColor = {
  alpha: 0,
  blue: 0,
  green: 0,
  red: 0,
};

const opaqueWhite: CueColor = {
  alpha: 1,
  blue: 255,
  green: 255,
  red: 255,
};

function insetRadius(
  radius: readonly [number, number],
  horizontalInset: number,
  verticalInset: number,
): readonly [number, number] {
  return [
    Math.max(0, radius[0] - horizontalInset),
    Math.max(0, radius[1] - verticalInset),
  ];
}

function cornerRadii(
  radius: readonly [CueLengthPercentage, CueLengthPercentage],
  width: number,
  height: number,
): readonly [number, number] {
  return [
    Math.max(0, pixelLength(radius[0], width)),
    Math.max(0, pixelLength(radius[1], height)),
  ];
}

function outlineRadius(
  radius: readonly [CueLengthPercentage, CueLengthPercentage],
  width: number,
  height: number,
  outlineWidth: number,
): readonly [number, number] {
  const [horizontal, vertical] = cornerRadii(radius, width, height);
  return [horizontal + outlineWidth, vertical + outlineWidth];
}

function pixelLength(value: CueLengthPercentage, basis: number): number {
  return typeof value === 'number'
    ? value
    : Number.parseFloat(value) * basis / 100;
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

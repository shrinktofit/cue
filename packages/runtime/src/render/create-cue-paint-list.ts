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
  CuePointerEvents,
  CuePosition,
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
import { CueElement, setCueElementClientSize, setCueElementContentBox } from '../element/cue-element.js';
import { cueTopLayerElements } from './cue-top-layer.js';
import {
  CueImageElement,
  getCueImageSource,
} from '../element/cue-image-element.js';
import { Text } from '../element/text.js';
import { BrElement } from '../element/br-element.js';
import { layoutCueInline, type CueInlineBox, type CueInlineItem, type CueInlineLayout } from '../text/layout-cue-inline.js';
import type { CueHitRegion, CueHitShape } from '../input/cue-hit-region.js';
import {
  computeCueElementStyle,
  createInitialCueElementStyle,
  type ComputedCueElementStyle,
  type ComputedCueTextStyle,
  initialCueTextStyle,
} from '../style/compute-cue-element-style.js';
import type { CueFontMetrics, CueTextLayout } from '../text/layout-cue-text.js';
import {
  createCueElementTransform,
  identityCueAffineTransform,
  multiplyCueAffineTransforms,
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
  hitRegions: CueHitRegion[];
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
  readonly fontRevision?: number;
  metrics(style: ComputedCueTextStyle): CueFontMetrics;
  layout(
    text: string,
    style: ComputedCueTextStyle,
    availableWidth?: number,
  ): CueTextLayout;
}

interface CueLayoutRecord {
  tree: TaffyTree;
  inlineAncestors?: Array<CueInlineBox<CueLayoutRecord>> | undefined;
  paintOffset?: Point<number>;
  inlineContainingBox?: CueInlineBox<CueLayoutRecord>;
  absolutePortals?: CueLayoutRecord[];
  anonymous?: boolean;
  inline?: {
    box: CueInlineBox<CueLayoutRecord>;
    items: Array<CueInlineItem<CueLayoutRecord>>;
    layout: (width?: number, height?: number) => CueInlineLayout<CueLayoutRecord>;
  } | undefined;
  inlineLayout?: CueInlineLayout<CueLayoutRecord> | undefined;
  fragment?: { x: number; y: number; width: number; height: number };
  preparedText?: CuePaintText;
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
}

interface CueTextLayoutContext {
  kind: CueIntrinsicContentKind.text;
  layout: (width?: number, height?: number) => CueInlineLayout<CueLayoutRecord>;
}

interface CueLayoutEnvironment {
  styleSheets: readonly CueStyleSheet[];
  imageSourceLookup: CueImageSourceLookup;
  textMeasurer: CueTextMeasurer;
  trees: TaffyTree[];
  absolutePortals: Array<{ record: CueLayoutRecord; parent: CueLayoutRecord; containingBlock: CueLayoutRecord | undefined }>;
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
  [CueDisplay.inline]: Display.Block,
  [CueDisplay.inlineBlock]: Display.Block,
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
  // Layout uses fractional CSS pixels, not device pixels. Rounding before the
  // final inline pass can wrap text that was measured and aligned as one line.
  tree.disableRounding();
  const environment: CueLayoutEnvironment = { styleSheets, imageSourceLookup, textMeasurer, trees: [tree], absolutePortals: [] };
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
        initialCueTextStyle,
        environment,
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
    const portals = connectAbsolutePortals(tree, environment, layoutChildren, absoluteRecords);
    const positionedRecords = [...children, ...portals];
    tree.setChildren(rootNode, layoutChildren);
    const availableSpace = viewport ?? {
      height: 'max-content' as const,
      width: 'max-content' as const,
    };
    const measureFunction = createMeasureFunction();
    tree.computeLayoutWithMeasure(
      rootNode,
      availableSpace,
      measureFunction,
    );
    if (absoluteRecords.some((record) => record.staticPositionNode !== undefined)) {
      updateStaticPositionPlaceholders(tree, absoluteRecords);
      tree.computeLayoutWithMeasure(rootNode, availableSpace, measureFunction);
    }
    updateLayoutPositions(tree, positionedRecords);
    for (const record of absoluteRecords) {
      if (
        record.style.width !== 'auto'
        || (record.style.left !== 'auto' && record.style.right !== 'auto')
      ) {
        continue;
      }
      const layout = tree.getLayout(record.node);
      const containingLayout = tree.getLayout(record.layoutParent?.node ?? rootNode);
      const sizingStyle = createTaffyStyle(record.style);
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
        const finalStyle = createTaffyStyle(record.style);
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
      updateLayoutPositions(tree, positionedRecords);
    }

    const paintList: CuePaintList = {
      commands: [],
      hitRegions: [],
    };
    const rootLayout = tree.getLayout(rootNode);
    try {
      setCueElementClientSize(root, rootLayout.width, rootLayout.height);
    } finally {
      rootLayout.free();
    }
    const topLayer: Array<() => void> = [];
    appendPaintCommands(
      tree,
      paintOrderedChildren(children, false),
      textMeasurer,
      backgroundSourceLookup,
      identityCueAffineTransform,
      0,
      1,
      paintList,
      [],
      topLayer,
    );
    for (const paint of topLayer) {
      paint();
    }
    return paintList;
  } finally {
    for (const layoutTree of environment.trees) {
      layoutTree.free();
    }
  }
}

function createLayoutRecord(
  tree: TaffyTree,
  element: CueElement,
  inheritedTextStyle: ComputedCueTextStyle,
  environment: CueLayoutEnvironment,
  isFlexItem = false,
  computedStyle?: ComputedCueElementStyle,
  containingBlock?: CueLayoutRecord,
): CueLayoutRecord {
  const style = computedStyle ?? computeCueElementStyle(element, environment.styleSheets, inheritedTextStyle);
  if ((style.display === CueDisplay.inline || style.display === CueDisplay.inlineBlock) && (style.position === CuePosition.absolute || isFlexItem)) {
    style.display = CueDisplay.block;
  }
  const record: CueLayoutRecord = {
    tree, children: [], element, layoutChildren: [], layoutParent: undefined,
    node: 0n, parent: undefined, position: { x: 0, y: 0 }, style,
  };
  if (
    element instanceof CueImageElement
    && element.children.some((child) => child instanceof CueElement || (child instanceof Text && hasNonCollapsibleText(child.data)))
  ) {
    throw new Error('<cue-image> is a replaced element and cannot have children.');
  }
  const image = element instanceof CueImageElement
    ? imageForSource(element, environment.imageSourceLookup)
    : undefined;
  if (image) record.image = image;
  const rootBox: CueInlineBox<CueLayoutRecord> = { value: record, style };
  const childContainingBlock = style.position !== CuePosition.static || style.transform.length > 0 ? record : containingBlock;
  let items: Array<CueInlineItem<CueLayoutRecord>> = [];
  const attachInline = (target: CueLayoutRecord, content: Array<CueInlineItem<CueLayoutRecord>>): void => {
    target.inline = { box: rootBox, items: content, layout: (width, height) => {
      const containingHeight = height ?? (typeof style.height === 'number'
        ? Math.max(typeof style.minHeight === 'number' ? style.minHeight : 0, Math.min(typeof style.maxHeight === 'number' ? style.maxHeight : Infinity, style.height))
        - (style.boxSizing === CueBoxSizing.borderBox ? pixelLength(style.paddingTop, width ?? 0) + pixelLength(style.paddingBottom, width ?? 0) + borderWidth(style.borderTopStyle, style.borderTopWidth) + borderWidth(style.borderBottomStyle, style.borderBottomWidth) : 0)
        : undefined);
      return layoutCueInline(rootBox, content, environment.textMeasurer, width, containingHeight);
    } };
  };
  const flush = (): void => {
    if (items.length === 0) {
      return;
    }
    const anonymousStyle = createInitialCueElementStyle(style);
    anonymousStyle.display = CueDisplay.block;
    const anonymous: CueLayoutRecord = {
      tree, element, style: anonymousStyle, anonymous: true, node: 0n, children: [], layoutChildren: [],
      layoutParent: undefined, parent: undefined, position: { x: 0, y: 0 },
    };
    attachInline(anonymous, items);
    const nodeStyle = createTaffyStyle(anonymousStyle);
    anonymous.node = tree.newLeafWithContext(nodeStyle, { kind: CueIntrinsicContentKind.text, layout: anonymous.inline!.layout } satisfies CueTextLayoutContext);
    nodeStyle.free();
    record.children.push(anonymous);
    items = [];
  };
  const collect = (parent: CueElement, parentBox: CueInlineBox<CueLayoutRecord>): void => {
    for (const child of parent.children) {
      if (child instanceof Text) {
        items.push({ kind: 'text', text: child.data, box: parentBox });
      } else if (child instanceof CueElement) {
        const childStyle = computeCueElementStyle(child, environment.styleSheets, parentBox.style);
        if (childStyle.position === CuePosition.absolute || childStyle.display === CueDisplay.block || childStyle.display === CueDisplay.flex) {
          if (childStyle.position !== CuePosition.absolute) flush();
          const childTree = childStyle.position === CuePosition.absolute ? childContainingBlock?.tree ?? environment.trees[0]! : tree;
          const childRecord = createLayoutRecord(childTree, child, parentBox.style, environment, false, childStyle, childContainingBlock);
          if (childTree !== tree) environment.absolutePortals.push({ record: childRecord, parent: record, containingBlock: childContainingBlock });
          childRecord.inlineAncestors = [];
          for (let ancestor = parentBox; ancestor !== rootBox; ancestor = ancestor.parent!) {
            childRecord.inlineAncestors.unshift(ancestor);
            if (!childRecord.inlineContainingBox && ancestor.style.position !== CuePosition.static) childRecord.inlineContainingBox = ancestor;
          }
          if (childStyle.position === CuePosition.absolute) items.push({ kind: 'out-of-flow', box: { value: childRecord, style: parentBox.style, parent: parentBox } });
          record.children.push(childRecord);
        } else {
          const inlineRecord: CueLayoutRecord = {
            tree, element: child, style: childStyle, node: 0n, children: [], layoutChildren: [],
            layoutParent: undefined, parent: record, position: { x: 0, y: 0 },
          };
          const box: CueInlineBox<CueLayoutRecord> = { value: inlineRecord, style: childStyle, parent: parentBox };
          if (child instanceof BrElement) {
            items.push({ kind: 'break', box });
          } else if (childStyle.display === CueDisplay.inlineBlock || child instanceof CueImageElement) {
            const atomicTree = new TaffyTree();
            // Atomic inline boxes participate in the same fractional line flow.
            atomicTree.disableRounding();
            environment.trees.push(atomicTree);
            const atomic = createLayoutRecord(atomicTree, child, parentBox.style, environment, false, childStyle, childContainingBlock);
            box.value = atomic;
            const containerStyle = new Style({ alignItems: AlignItems.FlexStart });
            const container = atomicTree.newWithChildren(containerStyle, [atomic.node]);
            containerStyle.free();
            const absolute: CueLayoutRecord[] = [];
            const children = [atomic.node];
            connectLayoutChildren(atomicTree, [atomic], undefined, undefined, children, absolute);
            const portals = connectAbsolutePortals(atomicTree, environment, children, absolute);
            atomicTree.setChildren(container, children);
            items.push({ kind: 'atomic', box, measure: (width, height) => {
              const sizing = new Style({ alignItems: AlignItems.FlexStart, size: { width: width ?? 'auto', height: height ?? 'auto' } });
              atomicTree.setStyle(container, sizing);
              sizing.free();
              atomicTree.computeLayoutWithMeasure(container, { width: width ?? 'max-content', height: 'max-content' }, createMeasureFunction());
              updateLayoutPositions(atomicTree, [atomic, ...portals]);
              const layout = atomicTree.getLayout(atomic.node);
              try {
                const baseline = lastInlineBaseline(atomic);
                return {
                  width: layout.width + layout.marginLeft + layout.marginRight,
                  height: layout.height + layout.marginTop + layout.marginBottom,
                  baseline: childStyle.overflowX !== CueOverflow.visible || childStyle.overflowY !== CueOverflow.visible || baseline === undefined
                    ? layout.height + layout.marginTop + layout.marginBottom
                    : layout.marginTop + baseline,
                };
              } finally {
                layout.free();
              }
            } });
          } else {
            items.push({ kind: 'start', box });
            collect(child, box);
            items.push({ kind: 'end', box });
          }
        }
      }
    }
  };
  if (!(element instanceof CueImageElement)) {
    if (style.display === CueDisplay.flex) {
      for (const child of element.children) {
        if (child instanceof Text) {
          items.push({ kind: 'text', box: rootBox, text: child.data });
        } else if (child instanceof CueElement) {
          if (items.some((item) => item.kind === 'text' && hasNonCollapsibleText(item.text))) {
            flush();
          }
          items = [];
          record.children.push(createLayoutRecord(tree, child, style, environment, true, undefined, childContainingBlock));
        }
      }
      if (items.some((item) => item.kind === 'text' && hasNonCollapsibleText(item.text))) {
        flush();
      }
      record.children.sort((left, right) => left.style.order - right.style.order);
    } else {
      collect(element, rootBox);
      if (record.children.length === 0 && items.length > 0 && !environment.absolutePortals.some((portal) => portal.containingBlock === record)) {
        attachInline(record, items);
      } else {
        flush();
      }
    }
  }
  const taffyStyle = createTaffyStyle(style);
  try {
    if (image) {
      record.node = tree.newLeafWithContext(taffyStyle, {
        height: image.rect.height,
        kind: CueIntrinsicContentKind.image,
        width: image.rect.width,
      } satisfies CueImageLayoutContext);
    } else if (record.inline) {
      record.node = tree.newLeafWithContext(taffyStyle, { kind: CueIntrinsicContentKind.text, layout: record.inline.layout } satisfies CueTextLayoutContext);
    } else {
      record.node = tree.newWithChildren(
        taffyStyle,
        record.children.filter((child) => child.tree === tree).map((child) => child.node),
      );
    }
  } finally {
    taffyStyle.free();
  }
  record.layoutChildren = record.children.filter((child) => child.tree === tree).map((child) => child.node);
  return record;
}

function lastInlineBaseline(record: CueLayoutRecord): number | undefined {
  const layout = record.tree.getLayout(record.node);
  try {
    if (record.inlineLayout && record.inlineLayout.height > 0) {
      return layout.borderTop + layout.paddingTop + record.inlineLayout.lastBaseline;
    }
    const last = [...record.children].reverse().find((child) => child.style.position !== CuePosition.absolute);
    if (last) {
      const baseline = lastInlineBaseline(last);
      return baseline === undefined ? undefined : last.position.y - record.position.y + baseline;
    }
    return undefined;
  } finally {
    layout.free();
  }
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
    if (record.tree !== tree) continue;
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
    if (record.tree !== tree) continue;
    const layout = tree.getLayout(record.node);
    try {
      record.position = {
        x: (record.layoutParent?.position.x ?? 0) + layout.x,
        y: (record.layoutParent?.position.y ?? 0) + layout.y,
      };
      if (record.inline) {
        record.inlineLayout = record.inline.layout(Math.max(0, layout.width - layout.paddingLeft - layout.paddingRight - layout.borderLeft - layout.borderRight), record.style.height === 'auto' ? undefined : Math.max(0, layout.height - layout.paddingTop - layout.paddingBottom - layout.borderTop - layout.borderBottom));
      }
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

function createMeasureFunction(): MeasureFunction {
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
    const width = textAvailableWidth(availableSpace.width);
    const textLayout = intrinsicContext.layout(
      // Taffy passes border-box known dimensions but content-box available space.
      // It applies known dimensions itself after measuring the intrinsic content.
      width,
      knownDimensions.height,
    );
    return {
      height: textLayout.height,
      // A shrink-to-fit box uses the available width clamped by its intrinsic
      // min/max sizes, not the advance of the longest already-wrapped line.
      width: width === undefined ? textLayout.width : Math.max(intrinsicContext.layout(0).width, Math.min(width, intrinsicContext.layout().width)),
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
  style: ComputedCueElementStyle,
): Style {
  const properties: StylePropertyValues = {
    border: {
      bottom: borderWidth(style.borderBottomStyle, style.borderBottomWidth),
      left: borderWidth(style.borderLeftStyle, style.borderLeftWidth),
      right: borderWidth(style.borderRightStyle, style.borderRightWidth),
      top: borderWidth(style.borderTopStyle, style.borderTopWidth),
    },
    boxSizing: boxSizingByCueValue[style.boxSizing],
    display: displayByCueValue[style.display ?? CueDisplay.inline],
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
  hitClips: readonly CueHitShape[],
  topLayer: Array<() => void>,
  paintingTopLayer = false,
): void {
  for (const record of records) {
    if (record.inlineAncestors?.length) {
      let inheritedTransform = parentTransform;
      let inheritedOpacity = parentOpacity;
      for (const ancestor of record.inlineAncestors) {
        const offset = inlineRelativeOffset(ancestor);
        inheritedTransform = multiplyCueAffineTransforms(inheritedTransform, [1, 0, 0, 1, offset.x, offset.y]);
        inheritedOpacity *= ancestor.style.cueOpacity;
      }
      appendPaintCommands(tree, [{ ...record, inlineAncestors: undefined }], textMeasurer, backgroundSourceLookup, inheritedTransform, clipDepth, inheritedOpacity, paintList, hitClips, topLayer, paintingTopLayer);
      continue;
    }
    if (record.tree !== tree) {
      appendPaintCommands(record.tree, [record], textMeasurer, backgroundSourceLookup, parentTransform, clipDepth, parentOpacity, paintList, hitClips, topLayer, paintingTopLayer);
      continue;
    }
    if (record.preparedText) {
      if (record.preparedText.style.color.alpha > 0 && parentOpacity > 0) {
        paintList.commands.push({ kind: CuePaintCommandKind.text, paint: { ...record.preparedText, opacity: parentOpacity, clipDepth, transform: parentTransform } });
      }
      continue;
    }
    if (!paintingTopLayer && cueTopLayerElements.has(record.element)) {
      topLayer.push(() => appendPaintCommands(tree, [record], textMeasurer, backgroundSourceLookup, parentTransform, 0, parentOpacity, paintList, [], topLayer, true));
      continue;
    }
    const opacity = parentOpacity * record.style.cueOpacity;
    const layout = record.fragment
      ? {
        ...record.fragment,
        borderLeft: 0, borderRight: 0, borderTop: 0, borderBottom: 0,
        paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0,
      }
      : tree.getLayout(record.node);
    let x: number;
    let y: number;
    let width: number;
    let height: number;
    let contentX: number;
    let contentY: number;
    let contentWidth: number;
    let contentHeight: number;
    try {
      x = record.fragment?.x ?? record.position.x;
      y = record.fragment?.y ?? record.position.y;
      width = layout.width;
      height = layout.height;
      if (!record.anonymous && !record.fragment) setCueElementClientSize(
        record.element,
        Math.max(0, width - layout.borderLeft - layout.borderRight),
        Math.max(0, height - layout.borderTop - layout.borderBottom),
      );
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
      if (!record.anonymous && !record.fragment) setCueElementContentBox(record.element, { x: layout.paddingLeft, y: layout.paddingTop, width: contentWidth, height: contentHeight });
    } finally {
      if ('free' in layout) layout.free();
    }

    if (record.anonymous) {
      appendPaintCommands(tree, inlinePaintRecords(record, contentX, contentY), textMeasurer, backgroundSourceLookup, parentTransform, clipDepth, parentOpacity, paintList, hitClips, topLayer);
      continue;
    }

    const transform = createCueElementTransform(
      record.paintOffset ? multiplyCueAffineTransforms(parentTransform, [1, 0, 0, 1, record.paintOffset.x, record.paintOffset.y]) : parentTransform,
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
    paintList.hitRegions.push({
      element: record.element,
      enabled: record.style.pointerEvents === CuePointerEvents.auto,
      clips: hitClips,
      borderLeft: borderWidths[3],
      borderTop: borderWidths[0],
      transform,
      radii,
      width,
      height,
      x,
      y,
    });
    const clipsContents = record.style.overflowX !== CueOverflow.visible
      && record.style.overflowY !== CueOverflow.visible;
    const contentClipDepth = clipsContents ? clipDepth + 1 : clipDepth;
    let clipRect: CuePaintRect | undefined;
    if (clipsContents && width > 0 && height > 0) {
      clipRect = {
        borderColors: [transparentColor, transparentColor, transparentColor, transparentColor],
        borderWidths: [0, 0, 0, 0],
        clipDepth,
        color: opaqueWhite,
        height: Math.max(0, height - borderWidths[0] - borderWidths[2]),
        opacity: 1,
        radii: [
          insetRadius(radii[0], borderWidths[3], borderWidths[0]),
          insetRadius(radii[1], borderWidths[1], borderWidths[0]),
          insetRadius(radii[2], borderWidths[1], borderWidths[2]),
          insetRadius(radii[3], borderWidths[3], borderWidths[2]),
        ],
        transform,
        width: Math.max(0, width - borderWidths[1] - borderWidths[3]),
        x: x + borderWidths[3],
        y: -y - borderWidths[0],
      };
    }
    // Hit regions use top-down layout coordinates; paint commands use Y-up coordinates.
    const contentHitClips = clipRect
      ? [...hitClips, { ...clipRect, y: -clipRect.y }]
      : hitClips;
    if (opacity === 0) {
      // Opacity affects painting, not the CSS pointer target or its descendants.
      appendPaintCommands(tree, inlinePaintRecords(record, contentX, contentY), textMeasurer, backgroundSourceLookup, transform, contentClipDepth, opacity, paintList, contentHitClips, topLayer);
      appendPaintCommands(
        tree,
        paintOrderedChildren(record.children, record.style.display === CueDisplay.flex),
        textMeasurer,
        backgroundSourceLookup,
        transform,
        contentClipDepth,
        opacity,
        paintList,
        contentHitClips,
        topLayer,
      );
      continue;
    }
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
    if (clipRect) {
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
    appendPaintCommands(tree, inlinePaintRecords(record, contentX, contentY), textMeasurer, backgroundSourceLookup, transform, contentClipDepth, opacity, paintList, contentHitClips, topLayer);
    appendPaintCommands(
      tree,
      paintOrderedChildren(record.children, record.style.display === CueDisplay.flex),
      textMeasurer,
      backgroundSourceLookup,
      transform,
      contentClipDepth,
      opacity,
      paintList,
      contentHitClips,
      topLayer,
    );
    if (clipRect) {
      paintList.commands.push({
        kind: CuePaintCommandKind.clipExit,
        paint: clipRect,
      });
    }
  }
}

function inlinePaintRecords(record: CueLayoutRecord, x: number, y: number): CueLayoutRecord[] {
  const fragments = record.inlineLayout?.fragments;
  if (!fragments) {
    return [];
  }
  const output: CueLayoutRecord[] = [];
  const decorations = new Map<number, Map<CueInlineBox<CueLayoutRecord>, CueLayoutRecord>>();
  for (const fragment of fragments) {
    if (fragment.text !== undefined || fragment.atomic || fragment.outOfFlow) continue;
    let line = decorations.get(fragment.line);
    if (!line) {
      line = new Map();
      decorations.set(fragment.line, line);
    }
    const style = { ...fragment.box.style, transform: [], overflowX: CueOverflow.visible, overflowY: CueOverflow.visible, borderLeftWidth: fragment.first ? fragment.box.style.borderLeftWidth : 0, borderRightWidth: fragment.last ? fragment.box.style.borderRightWidth : 0 };
    line.set(fragment.box, {
      ...fragment.box.value, style, children: [], inline: undefined, inlineLayout: undefined,
      paintOffset: inlineRelativeOffset(fragment.box),
      fragment: { x: x + fragment.x, y: y + fragment.y, width: fragment.width, height: fragment.height },
    });
  }
  const attached = new Set<CueLayoutRecord>();
  const parentFor = (box: CueInlineBox<CueLayoutRecord> | undefined, line: number): CueLayoutRecord[] => {
    const parent = box ? decorations.get(line)?.get(box) : undefined;
    if (!parent || !box) return output;
    if (!attached.has(parent)) {
      parentFor(box.parent, line).push(parent);
      attached.add(parent);
    }
    return parent.children;
  };
  const attach = (child: CueLayoutRecord, box: CueInlineBox<CueLayoutRecord> | undefined, line: number): void => {
    parentFor(box, line).push(child);
  };
  for (const fragment of fragments) {
    const value = fragment.box.value;
    if (fragment.outOfFlow) {
      const layout = value.tree.getLayout(value.node);
      try {
        const containing = fragments.filter((part) => part.box === value.inlineContainingBox && part.text === undefined && !part.atomic && !part.outOfFlow);
        const first = containing[0];
        const last = containing.at(-1);
        const cbX = first ? x + first.x : 0;
        const cbY = first ? y + first.y : 0;
        const cbWidth = first && last ? last.x + last.width - first.x : 0;
        const cbHeight = first && last ? last.y + last.height - first.y : 0;
        const targetX = value.style.left === 'auto' && value.style.right === 'auto'
          ? x + fragment.x + layout.marginLeft
          : first ? cbX + (value.style.left !== 'auto' ? pixelLength(value.style.left, cbWidth) + layout.marginLeft : value.style.right !== 'auto' ? cbWidth - pixelLength(value.style.right, cbWidth) - layout.width - layout.marginRight : 0) : value.position.x;
        const targetY = value.style.top === 'auto' && value.style.bottom === 'auto'
          ? y + fragment.y + layout.marginTop
          : first ? cbY + (value.style.top !== 'auto' ? pixelLength(value.style.top, cbHeight) + layout.marginTop : value.style.bottom !== 'auto' ? cbHeight - pixelLength(value.style.bottom, cbHeight) - layout.height - layout.marginBottom : 0) : value.position.y;
        shiftLayoutPositions(value, targetX - value.position.x, targetY - value.position.y);
      } finally {
        layout.free();
      }
    } else if (fragment.atomic) {
      const layout = value.tree.getLayout(value.node);
      try {
        shiftLayoutPositions(value, x + fragment.x + layout.marginLeft - value.position.x, y + fragment.y + layout.marginTop - value.position.y);
      } finally {
        layout.free();
      }
      attach(value, fragment.box.parent, fragment.line);
    } else if (fragment.text !== undefined && fragment.width > 0) {
      attach({
        ...value, children: [], inline: undefined, inlineLayout: undefined, inlineAncestors: undefined,
        preparedText: {
          element: value.element, x: x + fragment.x, y: -(y + fragment.y), width: fragment.width, height: fragment.height,
          lines: [{ text: fragment.text, x: 0 }], style: fragment.box.style,
          opacity: 1, clipDepth: 0, transform: identityCueAffineTransform,
        },
      }, fragment.box, fragment.line);
    }
  }
  for (const [line, boxes] of decorations) {
    for (const box of boxes.keys()) parentFor(box, line);
  }
  return output;
}

function shiftLayoutPositions(record: CueLayoutRecord, x: number, y: number): void {
  record.position.x += x;
  record.position.y += y;
  for (const child of record.children) {
    if (child.tree === record.tree) shiftLayoutPositions(child, x, y);
  }
  for (const portal of record.absolutePortals ?? []) shiftLayoutPositions(portal, x, y);
}

function connectAbsolutePortals(tree: TaffyTree, environment: CueLayoutEnvironment, rootChildren: bigint[], absoluteRecords: CueLayoutRecord[]): CueLayoutRecord[] {
  const records: CueLayoutRecord[] = [];
  for (const { record, parent, containingBlock } of environment.absolutePortals) {
    if (record.tree !== tree) continue;
    record.parent = parent;
    record.layoutParent = containingBlock;
    if (containingBlock) (containingBlock.absolutePortals ??= []).push(record);
    (containingBlock?.layoutChildren ?? rootChildren).push(record.node);
    connectLayoutChildren(tree, record.children, record, record, rootChildren, absoluteRecords);
    tree.setChildren(record.node, record.layoutChildren);
    if (containingBlock) tree.setChildren(containingBlock.node, containingBlock.layoutChildren);
    absoluteRecords.push(record);
    records.push(record);
  }
  return records;
}

function inlineRelativeOffset(box: CueInlineBox<CueLayoutRecord>): Point<number> {
  if (box.style.position !== CuePosition.relative) return { x: 0, y: 0 };
  let root = box;
  while (root.parent) root = root.parent;
  const layout = root.value.tree.getLayout(root.value.node);
  try {
    const width = layout.width - layout.borderLeft - layout.borderRight - layout.paddingLeft - layout.paddingRight;
    const height = layout.height - layout.borderTop - layout.borderBottom - layout.paddingTop - layout.paddingBottom;
    return {
      x: box.style.left !== 'auto' ? pixelLength(box.style.left, width) : box.style.right !== 'auto' ? -pixelLength(box.style.right, width) : 0,
      y: box.style.top !== 'auto' ? pixelLength(box.style.top, height) : box.style.bottom !== 'auto' ? -pixelLength(box.style.bottom, height) : 0,
    };
  } finally {
    layout.free();
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

export {};

export const cueStyleSchemaVersion = 1;

export enum CueAlignContent {
  center = 'center',
  end = 'end',
  flexEnd = 'flex-end',
  flexStart = 'flex-start',
  spaceAround = 'space-around',
  spaceBetween = 'space-between',
  spaceEvenly = 'space-evenly',
  start = 'start',
  stretch = 'stretch',
}

export enum CueAlignItems {
  baseline = 'baseline',
  center = 'center',
  end = 'end',
  flexEnd = 'flex-end',
  flexStart = 'flex-start',
  start = 'start',
  stretch = 'stretch',
}

export enum CueAlignSelf {
  auto = 'auto',
  baseline = 'baseline',
  center = 'center',
  end = 'end',
  flexEnd = 'flex-end',
  flexStart = 'flex-start',
  start = 'start',
  stretch = 'stretch',
}

export enum CueBorderStyle {
  none = 'none',
  solid = 'solid',
}

export enum CueColorKeyword {
  currentColor = 'currentColor',
}

export enum CueBoxSizing {
  borderBox = 'border-box',
  contentBox = 'content-box',
}

export enum CueDimensionKeyword {
  auto = 'auto',
}

export enum CueDisplay {
  block = 'block',
  flex = 'flex',
}

export enum CueFlexDirection {
  column = 'column',
  columnReverse = 'column-reverse',
  row = 'row',
  rowReverse = 'row-reverse',
}

export enum CueFlexWrap {
  nowrap = 'nowrap',
  wrap = 'wrap',
  wrapReverse = 'wrap-reverse',
}

export enum CueJustifyContent {
  center = 'center',
  end = 'end',
  flexEnd = 'flex-end',
  flexStart = 'flex-start',
  spaceAround = 'space-around',
  spaceBetween = 'space-between',
  spaceEvenly = 'space-evenly',
  start = 'start',
  stretch = 'stretch',
}

export enum CueLineHeightKeyword {
  normal = 'normal',
}

export enum CueTextAlign {
  center = 'center',
  end = 'end',
  left = 'left',
  right = 'right',
  start = 'start',
}

export enum CueWhiteSpace {
  normal = 'normal',
  nowrap = 'nowrap',
  pre = 'pre',
  preLine = 'pre-line',
  preWrap = 'pre-wrap',
}

export enum CueMaxDimensionKeyword {
  none = 'none',
}

export enum CueOverflow {
  clip = 'clip',
  hidden = 'hidden',
  visible = 'visible',
}

export enum CueStyleProperty {
  alignContent = 'alignContent',
  alignItems = 'alignItems',
  alignSelf = 'alignSelf',
  backgroundColor = 'backgroundColor',
  backgroundImage = 'backgroundImage',
  borderBottomColor = 'borderBottomColor',
  borderBottomLeftRadius = 'borderBottomLeftRadius',
  borderBottomRightRadius = 'borderBottomRightRadius',
  borderBottomStyle = 'borderBottomStyle',
  borderBottomWidth = 'borderBottomWidth',
  borderLeftColor = 'borderLeftColor',
  borderLeftStyle = 'borderLeftStyle',
  borderLeftWidth = 'borderLeftWidth',
  borderRightColor = 'borderRightColor',
  borderRightStyle = 'borderRightStyle',
  borderRightWidth = 'borderRightWidth',
  borderTopColor = 'borderTopColor',
  borderTopLeftRadius = 'borderTopLeftRadius',
  borderTopRightRadius = 'borderTopRightRadius',
  borderTopStyle = 'borderTopStyle',
  borderTopWidth = 'borderTopWidth',
  boxSizing = 'boxSizing',
  boxShadow = 'boxShadow',
  columnGap = 'columnGap',
  cueOpacity = 'cueOpacity',
  color = 'color',
  display = 'display',
  flexBasis = 'flexBasis',
  flexDirection = 'flexDirection',
  flexGrow = 'flexGrow',
  flexShrink = 'flexShrink',
  flexWrap = 'flexWrap',
  fontFamily = 'fontFamily',
  fontSize = 'fontSize',
  height = 'height',
  justifyContent = 'justifyContent',
  lineHeight = 'lineHeight',
  marginBottom = 'marginBottom',
  marginLeft = 'marginLeft',
  marginRight = 'marginRight',
  marginTop = 'marginTop',
  maxHeight = 'maxHeight',
  maxWidth = 'maxWidth',
  minHeight = 'minHeight',
  minWidth = 'minWidth',
  order = 'order',
  outlineColor = 'outlineColor',
  outlineOffset = 'outlineOffset',
  outlineStyle = 'outlineStyle',
  outlineWidth = 'outlineWidth',
  overflowX = 'overflowX',
  overflowY = 'overflowY',
  paddingBottom = 'paddingBottom',
  paddingLeft = 'paddingLeft',
  paddingRight = 'paddingRight',
  paddingTop = 'paddingTop',
  rowGap = 'rowGap',
  textAlign = 'textAlign',
  transform = 'transform',
  transformOrigin = 'transformOrigin',
  whiteSpace = 'whiteSpace',
  width = 'width',
  zIndex = 'zIndex',
}

export interface CueColor {
  alpha: number;
  blue: number;
  green: number;
  red: number;
}

export type CueColorValue = CueColor | CueColorKeyword;
export interface CueBoxShadow {
  blur: number;
  color: CueColorValue;
  inset: boolean;
  spread: number;
  xOffset: number;
  yOffset: number;
}

export interface CueLinearGradient {
  direction: 'top' | 'right' | 'bottom' | 'left';
  endColor: CueColor;
  startColor: CueColor;
  type: 'linear-gradient';
}

export type CueTransformFunction = {
  angle: number;
  type: 'rotate';
} | {
  x: CueLengthPercentage;
  y: CueLengthPercentage;
  type: 'translate';
} | {
  x: number;
  y: number;
  type: 'scale';
} | {
  xAngle: number;
  yAngle: number;
  type: 'skew';
} | {
  a: number;
  b: number;
  c: number;
  d: number;
  e: number;
  f: number;
  type: 'matrix';
};

export type CueClassSelector = readonly string[];
export type CueLengthPercentage = number | `${number}%`;
export type CueDimension = CueLengthPercentage | CueDimensionKeyword;
export type CueMargin = CueLengthPercentage | CueDimensionKeyword;
export type CueMaxDimension = CueLengthPercentage | CueMaxDimensionKeyword;
export type CueLineHeight = number | CueLineHeightKeyword;
export type CueCornerRadius = readonly [CueLengthPercentage, CueLengthPercentage];

export interface CueStyleDeclarations {
  [CueStyleProperty.alignContent]?: CueAlignContent;
  [CueStyleProperty.alignItems]?: CueAlignItems;
  [CueStyleProperty.alignSelf]?: CueAlignSelf;
  [CueStyleProperty.backgroundColor]?: CueColor;
  [CueStyleProperty.backgroundImage]?: string | CueLinearGradient;
  [CueStyleProperty.borderBottomColor]?: CueColorValue;
  [CueStyleProperty.borderBottomLeftRadius]?: CueCornerRadius;
  [CueStyleProperty.borderBottomRightRadius]?: CueCornerRadius;
  [CueStyleProperty.borderBottomStyle]?: CueBorderStyle;
  [CueStyleProperty.borderBottomWidth]?: number;
  [CueStyleProperty.borderLeftColor]?: CueColorValue;
  [CueStyleProperty.borderLeftStyle]?: CueBorderStyle;
  [CueStyleProperty.borderLeftWidth]?: number;
  [CueStyleProperty.borderRightColor]?: CueColorValue;
  [CueStyleProperty.borderRightStyle]?: CueBorderStyle;
  [CueStyleProperty.borderRightWidth]?: number;
  [CueStyleProperty.borderTopColor]?: CueColorValue;
  [CueStyleProperty.borderTopLeftRadius]?: CueCornerRadius;
  [CueStyleProperty.borderTopRightRadius]?: CueCornerRadius;
  [CueStyleProperty.borderTopStyle]?: CueBorderStyle;
  [CueStyleProperty.borderTopWidth]?: number;
  [CueStyleProperty.boxSizing]?: CueBoxSizing;
  [CueStyleProperty.boxShadow]?: readonly CueBoxShadow[];
  [CueStyleProperty.columnGap]?: CueLengthPercentage;
  [CueStyleProperty.cueOpacity]?: number;
  [CueStyleProperty.color]?: CueColor;
  [CueStyleProperty.display]?: CueDisplay;
  [CueStyleProperty.flexBasis]?: CueDimension;
  [CueStyleProperty.flexDirection]?: CueFlexDirection;
  [CueStyleProperty.flexGrow]?: number;
  [CueStyleProperty.flexShrink]?: number;
  [CueStyleProperty.flexWrap]?: CueFlexWrap;
  [CueStyleProperty.fontFamily]?: readonly string[];
  [CueStyleProperty.fontSize]?: number;
  [CueStyleProperty.height]?: CueDimension;
  [CueStyleProperty.justifyContent]?: CueJustifyContent;
  [CueStyleProperty.lineHeight]?: CueLineHeight;
  [CueStyleProperty.marginBottom]?: CueMargin;
  [CueStyleProperty.marginLeft]?: CueMargin;
  [CueStyleProperty.marginRight]?: CueMargin;
  [CueStyleProperty.marginTop]?: CueMargin;
  [CueStyleProperty.maxHeight]?: CueMaxDimension;
  [CueStyleProperty.maxWidth]?: CueMaxDimension;
  [CueStyleProperty.minHeight]?: CueDimension;
  [CueStyleProperty.minWidth]?: CueDimension;
  [CueStyleProperty.order]?: number;
  [CueStyleProperty.outlineColor]?: CueColorValue;
  [CueStyleProperty.outlineOffset]?: number;
  [CueStyleProperty.outlineStyle]?: CueBorderStyle;
  [CueStyleProperty.outlineWidth]?: number;
  [CueStyleProperty.overflowX]?: CueOverflow;
  [CueStyleProperty.overflowY]?: CueOverflow;
  [CueStyleProperty.paddingBottom]?: CueLengthPercentage;
  [CueStyleProperty.paddingLeft]?: CueLengthPercentage;
  [CueStyleProperty.paddingRight]?: CueLengthPercentage;
  [CueStyleProperty.paddingTop]?: CueLengthPercentage;
  [CueStyleProperty.rowGap]?: CueLengthPercentage;
  [CueStyleProperty.textAlign]?: CueTextAlign;
  [CueStyleProperty.transform]?: readonly CueTransformFunction[];
  [CueStyleProperty.transformOrigin]?: readonly [CueLengthPercentage, CueLengthPercentage];
  [CueStyleProperty.whiteSpace]?: CueWhiteSpace;
  [CueStyleProperty.width]?: CueDimension;
  [CueStyleProperty.zIndex]?: number | 'auto';
}

export interface CueStyleRule {
  declarations?: CueStyleDeclarations;
  importantDeclarations?: CueStyleDeclarations;
  selectors: readonly CueClassSelector[];
}

export interface CueStyleSheet {
  rules: readonly CueStyleRule[];
  version: typeof cueStyleSchemaVersion;
}

export {};

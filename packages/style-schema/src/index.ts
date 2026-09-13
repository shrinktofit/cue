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

export enum CueStyleProperty {
  alignContent = 'alignContent',
  alignItems = 'alignItems',
  alignSelf = 'alignSelf',
  backgroundColor = 'backgroundColor',
  borderColor = 'borderColor',
  borderRadius = 'borderRadius',
  borderStyle = 'borderStyle',
  borderWidth = 'borderWidth',
  boxSizing = 'boxSizing',
  columnGap = 'columnGap',
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
  paddingBottom = 'paddingBottom',
  paddingLeft = 'paddingLeft',
  paddingRight = 'paddingRight',
  paddingTop = 'paddingTop',
  rowGap = 'rowGap',
  textAlign = 'textAlign',
  whiteSpace = 'whiteSpace',
  width = 'width',
}

export interface CueColor {
  alpha: number;
  blue: number;
  green: number;
  red: number;
}

export type CueClassSelector = readonly string[];
export type CueLengthPercentage = number | `${number}%`;
export type CueDimension = CueLengthPercentage | CueDimensionKeyword;
export type CueMargin = CueLengthPercentage | CueDimensionKeyword;
export type CueMaxDimension = CueLengthPercentage | CueMaxDimensionKeyword;
export type CueLineHeight = number | CueLineHeightKeyword;

export interface CueStyleDeclarations {
  [CueStyleProperty.alignContent]?: CueAlignContent;
  [CueStyleProperty.alignItems]?: CueAlignItems;
  [CueStyleProperty.alignSelf]?: CueAlignSelf;
  [CueStyleProperty.backgroundColor]?: CueColor;
  [CueStyleProperty.borderColor]?: CueColor;
  [CueStyleProperty.borderRadius]?: readonly [number, number, number, number];
  [CueStyleProperty.borderStyle]?: CueBorderStyle;
  [CueStyleProperty.borderWidth]?: number;
  [CueStyleProperty.boxSizing]?: CueBoxSizing;
  [CueStyleProperty.columnGap]?: CueLengthPercentage;
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
  [CueStyleProperty.paddingBottom]?: CueLengthPercentage;
  [CueStyleProperty.paddingLeft]?: CueLengthPercentage;
  [CueStyleProperty.paddingRight]?: CueLengthPercentage;
  [CueStyleProperty.paddingTop]?: CueLengthPercentage;
  [CueStyleProperty.rowGap]?: CueLengthPercentage;
  [CueStyleProperty.textAlign]?: CueTextAlign;
  [CueStyleProperty.whiteSpace]?: CueWhiteSpace;
  [CueStyleProperty.width]?: CueDimension;
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

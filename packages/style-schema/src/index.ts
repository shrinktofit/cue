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
  display = 'display',
  flexBasis = 'flexBasis',
  flexDirection = 'flexDirection',
  flexGrow = 'flexGrow',
  flexShrink = 'flexShrink',
  flexWrap = 'flexWrap',
  height = 'height',
  justifyContent = 'justifyContent',
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
  [CueStyleProperty.display]?: CueDisplay;
  [CueStyleProperty.flexBasis]?: CueDimension;
  [CueStyleProperty.flexDirection]?: CueFlexDirection;
  [CueStyleProperty.flexGrow]?: number;
  [CueStyleProperty.flexShrink]?: number;
  [CueStyleProperty.flexWrap]?: CueFlexWrap;
  [CueStyleProperty.height]?: CueDimension;
  [CueStyleProperty.justifyContent]?: CueJustifyContent;
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

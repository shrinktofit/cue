export const cueStyleSchemaVersion = 1;

export enum CueAlignItems {
  center = 'center',
  end = 'end',
  flexEnd = 'flex-end',
  flexStart = 'flex-start',
  start = 'start',
  stretch = 'stretch',
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

export enum CueStyleProperty {
  alignItems = 'alignItems',
  backgroundColor = 'backgroundColor',
  borderRadius = 'borderRadius',
  display = 'display',
  flexDirection = 'flexDirection',
  gap = 'gap',
  height = 'height',
  justifyContent = 'justifyContent',
  width = 'width',
}

export interface CueColor {
  alpha: number;
  blue: number;
  green: number;
  red: number;
}

export type CueClassSelector = readonly string[];

export interface CueGap {
  column: number;
  row: number;
}

export interface CueStyleDeclarations {
  [CueStyleProperty.alignItems]?: CueAlignItems;
  [CueStyleProperty.backgroundColor]?: CueColor;
  [CueStyleProperty.borderRadius]?: readonly [number, number, number, number];
  [CueStyleProperty.display]?: CueDisplay;
  [CueStyleProperty.flexDirection]?: CueFlexDirection;
  [CueStyleProperty.gap]?: CueGap;
  [CueStyleProperty.height]?: number;
  [CueStyleProperty.justifyContent]?: CueJustifyContent;
  [CueStyleProperty.width]?: number;
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

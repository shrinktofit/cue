import { Buffer } from 'node:buffer';

import {
  cueStyleSchemaVersion,
  CueAlignContent,
  CueAlignItems,
  CueAlignSelf,
  CueBorderStyle,
  CueBoxSizing,
  CueDimensionKeyword,
  CueDisplay,
  CueFlexDirection,
  CueFlexWrap,
  CueJustifyContent,
  CueLineHeightKeyword,
  CueMaxDimensionKeyword,
  CueStyleProperty,
  CueTextAlign,
  CueWhiteSpace,
  type CueClassSelector,
  type CueColor,
  type CueDimension,
  type CueLengthPercentage,
  type CueLineHeight,
  type CueMargin,
  type CueMaxDimension,
  type CueStyleDeclarations,
  type CueStyleRule,
  type CueStyleSheet,
} from '@bsgames/cue-style-schema';
import {
  transform,
  type AlignContent,
  type AlignItems,
  type AlignSelf,
  type BorderColor,
  type BorderRadius,
  type BorderSideWidth,
  type BorderStyle,
  type BorderWidth,
  type CssColor,
  type Declaration,
  type DimensionPercentageFor_LengthValue,
  type Display,
  type Flex,
  type FlexDirection,
  type FlexFlow,
  type FlexWrap,
  type FontFamily,
  type FontSize,
  type Gap,
  type GapValue,
  type GenericBorderFor_LineStyle,
  type JustifyContent,
  type LengthPercentageOrAuto,
  type LineHeight,
  type Margin,
  type MaxSize,
  type Padding,
  type TextAlign,
  type WhiteSpace,
  type Selector,
  type Size,
  type StyleSheet,
} from 'lightningcss';

export interface CompileCueStyleResult {
  errors: Error[];
  styleSheet?: CueStyleSheet;
}

export function compileCueStyle(
  styleSources: readonly string[],
  filename: string,
): CompileCueStyleResult {
  const errors: Error[] = [];
  const rules: CueStyleRule[] = [];

  for (const [styleIndex, source] of styleSources.entries()) {
    let ast: StyleSheet | undefined;
    try {
      transform({
        code: Buffer.from(source),
        filename: filename + '?style=' + styleIndex,
        visitor: {
          StyleSheetExit(styleSheet) {
            ast = styleSheet;
          },
        },
      });
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
      continue;
    }

    if (!ast) {
      errors.push(new Error('Lightning CSS did not provide a stylesheet AST.'));
      continue;
    }
    rules.push(...compileRules(ast));
  }

  return errors.length > 0
    ? {
      errors,
    }
    : {
      errors,
      styleSheet: {
        rules,
        version: cueStyleSchemaVersion,
      },
    };
}

function compileRules(styleSheet: StyleSheet): CueStyleRule[] {
  const rules: CueStyleRule[] = [];
  for (const rule of styleSheet.rules) {
    if (rule.type !== 'style') {
      continue;
    }

    const declarations = compileDeclarations(
      rule.value.declarations?.declarations ?? [],
    );
    const importantDeclarations = compileDeclarations(
      rule.value.declarations?.importantDeclarations ?? [],
    );
    if (
      Object.keys(declarations).length === 0
      && Object.keys(importantDeclarations).length === 0
    ) {
      continue;
    }

    const selectors = rule.value.selectors.flatMap(
      (selector): CueClassSelector[] => {
        const classes = readClassSelector(selector);
        return classes
          ? [
            classes,
          ]
          : [];
      },
    );
    if (selectors.length === 0) {
      continue;
    }
    rules.push({
      ...(Object.keys(declarations).length > 0
        ? {
          declarations,
        }
        : {}),
      ...(Object.keys(importantDeclarations).length > 0
        ? {
          importantDeclarations,
        }
        : {}),
      selectors,
    });
  }
  return rules;
}

function compileDeclarations(
  declarations: readonly Declaration[],
): CueStyleDeclarations {
  const compiledDeclarations: CueStyleDeclarations = {};
  for (const declaration of declarations) {
    switch (declaration.property) {
    case 'align-content': {
      const value = readAlignContent(declaration.value);
      if (value) {
        compiledDeclarations[CueStyleProperty.alignContent] = value;
      }
      break;
    }
    case 'align-items': {
      const value = readAlignItems(declaration.value);
      if (value) {
        compiledDeclarations[CueStyleProperty.alignItems] = value;
      }
      break;
    }
    case 'align-self': {
      const value = readAlignSelf(declaration.value);
      if (value) {
        compiledDeclarations[CueStyleProperty.alignSelf] = value;
      }
      break;
    }
    case 'width':
    case 'height':
    case 'min-width':
    case 'min-height': {
      const value = readDimension(declaration.value);
      if (value !== undefined) {
        compiledDeclarations[sizePropertyByCssName[declaration.property]] = value;
      }
      break;
    }
    case 'max-width':
    case 'max-height': {
      const value = readMaxDimension(declaration.value);
      if (value !== undefined) {
        compiledDeclarations[maxSizePropertyByCssName[declaration.property]] = value;
      }
      break;
    }
    case 'background-color': {
      const value = readColor(declaration.value);
      if (value) {
        compiledDeclarations[CueStyleProperty.backgroundColor] = value;
      }
      break;
    }
    case 'color': {
      const value = readColor(declaration.value);
      if (value) {
        compiledDeclarations[CueStyleProperty.color] = value;
      }
      break;
    }
    case 'border': {
      writeBorder(compiledDeclarations, declaration.value);
      break;
    }
    case 'border-color': {
      const value = readUniformBorderColor(declaration.value);
      if (value) {
        compiledDeclarations[CueStyleProperty.borderColor] = value;
      }
      break;
    }
    case 'border-radius': {
      const value = readBorderRadius(declaration.value);
      if (value) {
        compiledDeclarations[CueStyleProperty.borderRadius] = value;
      }
      break;
    }
    case 'border-style': {
      const value = readUniformBorderStyle(declaration.value);
      if (value) {
        compiledDeclarations[CueStyleProperty.borderStyle] = value;
      }
      break;
    }
    case 'border-width': {
      const value = readUniformBorderWidth(declaration.value);
      if (value !== undefined) {
        compiledDeclarations[CueStyleProperty.borderWidth] = value;
      }
      break;
    }
    case 'box-sizing':
      compiledDeclarations[CueStyleProperty.boxSizing]
        = declaration.value === 'border-box'
          ? CueBoxSizing.borderBox
          : CueBoxSizing.contentBox;
      break;
    case 'display': {
      const value = readDisplay(declaration.value);
      if (value) {
        compiledDeclarations[CueStyleProperty.display] = value;
      }
      break;
    }
    case 'flex': {
      writeFlex(compiledDeclarations, declaration.value);
      break;
    }
    case 'flex-basis': {
      const value = readLengthPercentageOrAuto(declaration.value);
      if (value !== undefined) {
        compiledDeclarations[CueStyleProperty.flexBasis] = value;
      }
      break;
    }
    case 'flex-direction':
      compiledDeclarations[CueStyleProperty.flexDirection]
        = readFlexDirection(declaration.value);
      break;
    case 'flex-flow':
      writeFlexFlow(compiledDeclarations, declaration.value);
      break;
    case 'flex-grow':
      compiledDeclarations[CueStyleProperty.flexGrow] = declaration.value;
      break;
    case 'flex-shrink':
      compiledDeclarations[CueStyleProperty.flexShrink] = declaration.value;
      break;
    case 'flex-wrap':
      compiledDeclarations[CueStyleProperty.flexWrap]
        = readFlexWrap(declaration.value);
      break;
    case 'font-family': {
      const value = readFontFamily(declaration.value);
      if (value) {
        compiledDeclarations[CueStyleProperty.fontFamily] = value;
      }
      break;
    }
    case 'font-size': {
      const value = readFontSize(declaration.value);
      if (value !== undefined) {
        compiledDeclarations[CueStyleProperty.fontSize] = value;
      }
      break;
    }
    case 'gap': {
      writeGap(compiledDeclarations, declaration.value);
      break;
    }
    case 'column-gap':
    case 'row-gap': {
      const value = readGapValue(declaration.value);
      if (value !== undefined) {
        compiledDeclarations[
          declaration.property === 'column-gap'
            ? CueStyleProperty.columnGap
            : CueStyleProperty.rowGap
        ] = value;
      }
      break;
    }
    case 'justify-content': {
      const value = readJustifyContent(declaration.value);
      if (value) {
        compiledDeclarations[CueStyleProperty.justifyContent] = value;
      }
      break;
    }
    case 'line-height': {
      const value = readLineHeight(declaration.value);
      if (value !== undefined) {
        compiledDeclarations[CueStyleProperty.lineHeight] = value;
      }
      break;
    }
    case 'text-align': {
      const value = readTextAlign(declaration.value);
      if (value !== undefined) {
        compiledDeclarations[CueStyleProperty.textAlign] = value;
      }
      break;
    }
    case 'white-space': {
      const value = readWhiteSpace(declaration.value);
      if (value !== undefined) {
        compiledDeclarations[CueStyleProperty.whiteSpace] = value;
      }
      break;
    }
    case 'margin':
      writeMargin(compiledDeclarations, declaration.value);
      break;
    case 'margin-bottom':
    case 'margin-left':
    case 'margin-right':
    case 'margin-top': {
      const value = readLengthPercentageOrAuto(declaration.value);
      if (value !== undefined) {
        compiledDeclarations[marginPropertyByCssName[declaration.property]] = value;
      }
      break;
    }
    case 'order':
      compiledDeclarations[CueStyleProperty.order] = declaration.value;
      break;
    case 'padding':
      writePadding(compiledDeclarations, declaration.value);
      break;
    case 'padding-bottom':
    case 'padding-left':
    case 'padding-right':
    case 'padding-top': {
      const value = readPadding(declaration.value);
      if (value !== undefined) {
        compiledDeclarations[paddingPropertyByCssName[declaration.property]] = value;
      }
      break;
    }
    default:
      break;
    }
  }
  return compiledDeclarations;
}

const sizePropertyByCssName = {
  'height': CueStyleProperty.height,
  'min-height': CueStyleProperty.minHeight,
  'min-width': CueStyleProperty.minWidth,
  'width': CueStyleProperty.width,
} as const;

const maxSizePropertyByCssName = {
  'max-height': CueStyleProperty.maxHeight,
  'max-width': CueStyleProperty.maxWidth,
} as const;

const marginPropertyByCssName = {
  'margin-bottom': CueStyleProperty.marginBottom,
  'margin-left': CueStyleProperty.marginLeft,
  'margin-right': CueStyleProperty.marginRight,
  'margin-top': CueStyleProperty.marginTop,
} as const;

const paddingPropertyByCssName = {
  'padding-bottom': CueStyleProperty.paddingBottom,
  'padding-left': CueStyleProperty.paddingLeft,
  'padding-right': CueStyleProperty.paddingRight,
  'padding-top': CueStyleProperty.paddingTop,
} as const;

function readAlignContent(
  alignContent: AlignContent,
): CueAlignContent | undefined {
  if (alignContent.type === 'normal') {
    return CueAlignContent.stretch;
  }
  if (
    alignContent.type !== 'content-distribution'
    && alignContent.type !== 'content-position'
  ) {
    return undefined;
  }
  switch (alignContent.value) {
  case 'center':
    return CueAlignContent.center;
  case 'end':
    return CueAlignContent.end;
  case 'flex-end':
    return CueAlignContent.flexEnd;
  case 'flex-start':
    return CueAlignContent.flexStart;
  case 'space-around':
    return CueAlignContent.spaceAround;
  case 'space-between':
    return CueAlignContent.spaceBetween;
  case 'space-evenly':
    return CueAlignContent.spaceEvenly;
  case 'start':
    return CueAlignContent.start;
  case 'stretch':
    return CueAlignContent.stretch;
  }
}

function readAlignItems(alignItems: AlignItems): CueAlignItems | undefined {
  if (alignItems.type === 'normal' || alignItems.type === 'stretch') {
    return CueAlignItems.stretch;
  }
  if (
    alignItems.type === 'baseline-position'
    && alignItems.value === 'first'
  ) {
    return CueAlignItems.baseline;
  }
  if (alignItems.type !== 'self-position' || alignItems.overflow) {
    return undefined;
  }
  switch (alignItems.value) {
  case 'center':
    return CueAlignItems.center;
  case 'end':
    return CueAlignItems.end;
  case 'flex-end':
    return CueAlignItems.flexEnd;
  case 'flex-start':
    return CueAlignItems.flexStart;
  case 'start':
    return CueAlignItems.start;
  default:
    return undefined;
  }
}

function readAlignSelf(alignSelf: AlignSelf): CueAlignSelf | undefined {
  if (alignSelf.type === 'auto') {
    return CueAlignSelf.auto;
  }
  if (alignSelf.type === 'normal' || alignSelf.type === 'stretch') {
    return CueAlignSelf.stretch;
  }
  if (
    alignSelf.type === 'baseline-position'
    && alignSelf.value === 'first'
  ) {
    return CueAlignSelf.baseline;
  }
  if (alignSelf.type !== 'self-position' || alignSelf.overflow) {
    return undefined;
  }
  switch (alignSelf.value) {
  case 'center':
    return CueAlignSelf.center;
  case 'end':
    return CueAlignSelf.end;
  case 'flex-end':
    return CueAlignSelf.flexEnd;
  case 'flex-start':
    return CueAlignSelf.flexStart;
  case 'start':
    return CueAlignSelf.start;
  default:
    return undefined;
  }
}

function readClassSelector(selector: Selector): string[] | undefined {
  const classes: string[] = [];
  for (const component of selector) {
    if (component.type !== 'class') {
      return undefined;
    }
    classes.push(component.name);
  }
  return classes.length > 0 ? classes : undefined;
}

function readDimension(size: Size): CueDimension | undefined {
  if (size.type === 'auto') {
    return CueDimensionKeyword.auto;
  }
  return size.type === 'length-percentage'
    ? readLengthPercentage(size.value)
    : undefined;
}

function readMaxDimension(size: MaxSize): CueMaxDimension | undefined {
  if (size.type === 'none') {
    return CueMaxDimensionKeyword.none;
  }
  return size.type === 'length-percentage'
    ? readLengthPercentage(size.value)
    : undefined;
}

function readDisplay(display: Display): CueDisplay | undefined {
  if (
    display.type !== 'pair'
    || display.isListItem
    || display.outside !== 'block'
  ) {
    return undefined;
  }
  switch (display.inside.type) {
  case 'flex':
    return CueDisplay.flex;
  case 'flow':
    return CueDisplay.block;
  default:
    return undefined;
  }
}

function readFlexDirection(flexDirection: FlexDirection): CueFlexDirection {
  switch (flexDirection) {
  case 'column':
    return CueFlexDirection.column;
  case 'column-reverse':
    return CueFlexDirection.columnReverse;
  case 'row-reverse':
    return CueFlexDirection.rowReverse;
  case 'row':
    return CueFlexDirection.row;
  }
}

function readFlexWrap(flexWrap: FlexWrap): CueFlexWrap {
  switch (flexWrap) {
  case 'nowrap':
    return CueFlexWrap.nowrap;
  case 'wrap':
    return CueFlexWrap.wrap;
  case 'wrap-reverse':
    return CueFlexWrap.wrapReverse;
  }
}

const unsupportedFontFamilyKeywords = new Set([
  'default',
  'inherit',
  'initial',
  'revert',
  'revert-layer',
  'unset',
]);

function readFontFamily(
  fontFamilies: readonly FontFamily[],
): readonly string[] | undefined {
  const families = fontFamilies.map((family) => family.toString());
  return families.length > 0
    && families.every((family) => !unsupportedFontFamilyKeywords.has(family))
    ? families
    : undefined;
}

function readFontSize(fontSize: FontSize): number | undefined {
  return fontSize.type === 'length'
    ? readPixelLength(fontSize.value)
    : undefined;
}

function readLineHeight(lineHeight: LineHeight): CueLineHeight | undefined {
  if (lineHeight.type === 'normal') {
    return CueLineHeightKeyword.normal;
  }
  return lineHeight.type === 'length'
    ? readPixelLength(lineHeight.value)
    : undefined;
}

function readTextAlign(textAlign: TextAlign): CueTextAlign | undefined {
  switch (textAlign) {
  case 'center':
    return CueTextAlign.center;
  case 'end':
    return CueTextAlign.end;
  case 'left':
    return CueTextAlign.left;
  case 'right':
    return CueTextAlign.right;
  case 'start':
    return CueTextAlign.start;
  default:
    return undefined;
  }
}

function readWhiteSpace(whiteSpace: WhiteSpace): CueWhiteSpace | undefined {
  switch (whiteSpace) {
  case 'normal':
    return CueWhiteSpace.normal;
  case 'nowrap':
    return CueWhiteSpace.nowrap;
  case 'pre':
    return CueWhiteSpace.pre;
  case 'pre-line':
    return CueWhiteSpace.preLine;
  case 'pre-wrap':
    return CueWhiteSpace.preWrap;
  case 'break-spaces':
    return undefined;
  }
}

function writeFlex(
  declarations: CueStyleDeclarations,
  flex: Flex,
): void {
  const basis = readLengthPercentageOrAuto(flex.basis);
  if (basis === undefined) {
    return;
  }
  declarations[CueStyleProperty.flexBasis] = basis;
  declarations[CueStyleProperty.flexGrow] = flex.grow;
  declarations[CueStyleProperty.flexShrink] = flex.shrink;
}

function writeFlexFlow(
  declarations: CueStyleDeclarations,
  flexFlow: FlexFlow,
): void {
  declarations[CueStyleProperty.flexDirection]
    = readFlexDirection(flexFlow.direction);
  declarations[CueStyleProperty.flexWrap] = readFlexWrap(flexFlow.wrap);
}

function writeGap(
  declarations: CueStyleDeclarations,
  gap: Gap,
): void {
  const column = readGapValue(gap.column);
  const row = readGapValue(gap.row);
  if (column === undefined || row === undefined) {
    return;
  }
  declarations[CueStyleProperty.columnGap] = column;
  declarations[CueStyleProperty.rowGap] = row;
}

function readGapValue(gap: GapValue): CueLengthPercentage | undefined {
  if (gap.type === 'normal') {
    return 0;
  }
  return readLengthPercentage(gap.value);
}

function readJustifyContent(
  justifyContent: JustifyContent,
): CueJustifyContent | undefined {
  if (justifyContent.type === 'normal') {
    return CueJustifyContent.start;
  }
  if (
    (
      justifyContent.type !== 'content-distribution'
      && justifyContent.type !== 'content-position'
    )
    || (
      justifyContent.type === 'content-position'
      && justifyContent.overflow
    )
  ) {
    return undefined;
  }
  switch (justifyContent.value) {
  case 'center':
    return CueJustifyContent.center;
  case 'end':
    return CueJustifyContent.end;
  case 'flex-end':
    return CueJustifyContent.flexEnd;
  case 'flex-start':
    return CueJustifyContent.flexStart;
  case 'space-around':
    return CueJustifyContent.spaceAround;
  case 'space-between':
    return CueJustifyContent.spaceBetween;
  case 'space-evenly':
    return CueJustifyContent.spaceEvenly;
  case 'start':
    return CueJustifyContent.start;
  case 'stretch':
    return CueJustifyContent.stretch;
  }
}

function writeMargin(
  declarations: CueStyleDeclarations,
  margin: Margin,
): void {
  const bottom = readLengthPercentageOrAuto(margin.bottom);
  const left = readLengthPercentageOrAuto(margin.left);
  const right = readLengthPercentageOrAuto(margin.right);
  const top = readLengthPercentageOrAuto(margin.top);
  if (
    bottom === undefined
    || left === undefined
    || right === undefined
    || top === undefined
  ) {
    return;
  }
  declarations[CueStyleProperty.marginBottom] = bottom;
  declarations[CueStyleProperty.marginLeft] = left;
  declarations[CueStyleProperty.marginRight] = right;
  declarations[CueStyleProperty.marginTop] = top;
}

function writePadding(
  declarations: CueStyleDeclarations,
  padding: Padding,
): void {
  const bottom = readPadding(padding.bottom);
  const left = readPadding(padding.left);
  const right = readPadding(padding.right);
  const top = readPadding(padding.top);
  if (
    bottom === undefined
    || left === undefined
    || right === undefined
    || top === undefined
  ) {
    return;
  }
  declarations[CueStyleProperty.paddingBottom] = bottom;
  declarations[CueStyleProperty.paddingLeft] = left;
  declarations[CueStyleProperty.paddingRight] = right;
  declarations[CueStyleProperty.paddingTop] = top;
}

function readPadding(
  value: LengthPercentageOrAuto,
): CueLengthPercentage | undefined {
  return value.type === 'length-percentage'
    ? readLengthPercentage(value.value)
    : undefined;
}

function readLengthPercentageOrAuto(
  value: LengthPercentageOrAuto,
): CueMargin | undefined {
  return value.type === 'auto'
    ? CueDimensionKeyword.auto
    : readLengthPercentage(value.value);
}

function readLengthPercentage(
  value: DimensionPercentageFor_LengthValue,
): CueLengthPercentage | undefined {
  if (value.type === 'percentage') {
    const percentage = Math.round(value.value * 100_000_000) / 1_000_000;
    return `${percentage}%`;
  }
  return readPixelLength(value);
}

function readPixelLength(
  length: DimensionPercentageFor_LengthValue,
): number | undefined {
  if (length.type !== 'dimension' || length.value.unit !== 'px') {
    return undefined;
  }
  return length.value.value;
}

function writeBorder(
  declarations: CueStyleDeclarations,
  border: GenericBorderFor_LineStyle,
): void {
  const color = readColor(border.color);
  const style = readBorderStyle(border.style);
  const width = readBorderWidth(border.width);
  if (!color || !style || width === undefined) {
    return;
  }
  declarations[CueStyleProperty.borderColor] = color;
  declarations[CueStyleProperty.borderStyle] = style;
  declarations[CueStyleProperty.borderWidth] = width;
}

function readUniformBorderColor(
  borderColor: BorderColor,
): CueColor | undefined {
  const colors = [
    readColor(borderColor.top),
    readColor(borderColor.right),
    readColor(borderColor.bottom),
    readColor(borderColor.left),
  ];
  const first = colors[0];
  return first && colors.every((color) => color && colorsEqual(color, first))
    ? first
    : undefined;
}

function readUniformBorderStyle(
  borderStyle: BorderStyle,
): CueBorderStyle | undefined {
  if (
    borderStyle.top !== borderStyle.right
    || borderStyle.top !== borderStyle.bottom
    || borderStyle.top !== borderStyle.left
  ) {
    return undefined;
  }
  return readBorderStyle(borderStyle.top);
}

function readUniformBorderWidth(
  borderWidth: BorderWidth,
): number | undefined {
  const widths = [
    readBorderWidth(borderWidth.top),
    readBorderWidth(borderWidth.right),
    readBorderWidth(borderWidth.bottom),
    readBorderWidth(borderWidth.left),
  ];
  const first = widths[0];
  return first !== undefined && widths.every((width) => width === first)
    ? first
    : undefined;
}

function readBorderStyle(style: string): CueBorderStyle | undefined {
  switch (style) {
  case 'none':
  case 'hidden':
    return CueBorderStyle.none;
  case 'solid':
    return CueBorderStyle.solid;
  default:
    return undefined;
  }
}

function readBorderWidth(width: BorderSideWidth): number | undefined {
  switch (width.type) {
  case 'thin':
    return 1;
  case 'medium':
    return 3;
  case 'thick':
    return 5;
  case 'length':
    return width.value.type === 'value' && width.value.value.unit === 'px'
      ? width.value.value.value
      : undefined;
  }
}

function readColor(color: CssColor): CueColor | undefined {
  if (typeof color !== 'object' || color.type !== 'rgb') {
    return undefined;
  }
  return {
    alpha: color.alpha,
    blue: color.b,
    green: color.g,
    red: color.r,
  };
}

function colorsEqual(left: CueColor, right: CueColor): boolean {
  return left.alpha === right.alpha
    && left.blue === right.blue
    && left.green === right.green
    && left.red === right.red;
}

function readBorderRadius(
  borderRadius: BorderRadius,
): readonly [number, number, number, number] | undefined {
  const corners = [
    borderRadius.topLeft,
    borderRadius.topRight,
    borderRadius.bottomRight,
    borderRadius.bottomLeft,
  ] as const;
  const radii: number[] = [];
  for (const [horizontal, vertical] of corners) {
    const horizontalPixels = readPixelLength(horizontal);
    const verticalPixels = readPixelLength(vertical);
    if (
      horizontalPixels === undefined
      || verticalPixels === undefined
      || horizontalPixels !== verticalPixels
    ) {
      return undefined;
    }
    radii.push(horizontalPixels);
  }
  return radii as unknown as readonly [number, number, number, number];
}

export {};

import colorNames from 'color-name';
import {
  CueAlignContent,
  CueAlignItems,
  CueAlignSelf,
  CueBorderStyle,
  CueBoxSizing,
  CueColorKeyword,
  CueDimensionKeyword,
  CueDisplay,
  CueFlexDirection,
  CueFlexWrap,
  CueJustifyContent,
  CueLineHeightKeyword,
  CueMaxDimensionKeyword,
  CueOverflow,
  CuePointerEvents,
  CuePosition,
  CueStyleProperty,
  CueTextAlign,
  CueWhiteSpace,
  type CueClassSelector,
  type CueBoxShadow,
  type CueColor,
  type CueCornerRadius,
  type CueDimension,
  type CueLengthPercentage,
  type CueLinearGradient,
  type CueTransformFunction,
  type CueLineHeight,
  type CueMargin,
  type CueMaxDimension,
  type CueStyleDeclarations,
  type CueStyleRule,
} from '@bsgames/cue-style-schema';
import type {
  AlignContent,
  AlignItems,
  AlignSelf,
  Angle,
  BorderColor,
  BorderRadius,
  BorderSideWidth,
  BorderStyle,
  BorderWidth,
  BoxShadow,
  CssColor,
  Declaration,
  DimensionPercentageFor_LengthValue,
  Display,
  Flex,
  FlexDirection,
  FlexFlow,
  FlexWrap,
  FontFamily,
  FontSize,
  Gap,
  GapValue,
  GenericBorderFor_LineStyle,
  Image,
  JustifyContent,
  LengthPercentageOrAuto,
  LineHeight,
  Length,
  Margin,
  MaxSize,
  GenericBorderFor_OutlineStyleAnd_11,
  OutlineStyle,
  Padding,
  Position,
  TextAlign,
  Transform as CssTransform,
  TokenOrValue,
  WhiteSpace,
  Selector,
  Size,
  StyleSheet,
} from 'lightningcss';

export type CanonicalizeCueImageSource = (
  source: string,
  filename: string,
) => { ok: true; source: string } | { ok: false; error: Error | string };

export function compileCueStyleRules(
  styleSheet: StyleSheet,
  filename: string,
  canonicalizeBackgroundImageSource: CanonicalizeCueImageSource | undefined,
  errors: Error[],
): CueStyleRule[] {
  const rules: CueStyleRule[] = [];
  for (const rule of styleSheet.rules) {
    if (rule.type !== 'style') {
      continue;
    }

    const declarations = compileCueStyleDeclarations(
      rule.value.declarations?.declarations ?? [],
      filename,
      canonicalizeBackgroundImageSource,
      errors,
    );
    const importantDeclarations = compileCueStyleDeclarations(
      rule.value.declarations?.importantDeclarations ?? [],
      filename,
      canonicalizeBackgroundImageSource,
      errors,
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

export function compileCueStyleDeclarations(
  declarations: readonly Declaration[],
  filename: string,
  canonicalizeBackgroundImageSource: CanonicalizeCueImageSource | undefined,
  errors: Error[],
): CueStyleDeclarations {
  const compiledDeclarations: CueStyleDeclarations = {};
  for (const declaration of declarations) {
    switch (declaration.property) {
    case 'position':
      if (
        declaration.value.type === 'static'
        || declaration.value.type === 'relative'
        || declaration.value.type === 'absolute'
      ) {
        compiledDeclarations.position = CuePosition[declaration.value.type];
      } else {
        errors.push(new SyntaxError('Cue supports position: static, relative, or absolute.'));
      }
      break;
    case 'top':
    case 'right':
    case 'bottom':
    case 'left': {
      const value = readLengthPercentageOrAuto(declaration.value);
      if (value !== undefined) {
        compiledDeclarations[declaration.property] = value;
      }
      break;
    }
    case 'inset':
      for (const side of ['top', 'right', 'bottom', 'left'] as const) {
        const value = readLengthPercentageOrAuto(declaration.value[side]);
        if (value !== undefined) {
          compiledDeclarations[side] = value;
        }
      }
      break;
    case 'font-weight': {
      if (declaration.value.type !== 'absolute') {
        errors.push(new SyntaxError('Cue supports font-weight: normal, bold, or a number from 1 to 1000.'));
        break;
      }
      const value = declaration.value.value;
      const weight = value.type === 'normal'
        ? 400
        : value.type === 'bold' ? 700 : value.value;
      if (!Number.isFinite(weight) || weight < 1 || weight > 1000) {
        errors.push(new SyntaxError('Cue supports font-weight: normal, bold, or a number from 1 to 1000.'));
      } else {
        compiledDeclarations.fontWeight = weight;
      }
      break;
    }
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
    case 'background-image': {
      const source = readBackgroundImage(declaration.value);
      if (source === undefined) {
        errors.push(new SyntaxError(
          'Cue currently supports one relative url(), a two-stop opaque sRGB linear-gradient(), or none for background-image.',
        ));
        break;
      }
      if (typeof source !== 'string') {
        compiledDeclarations[CueStyleProperty.backgroundImage] = source;
        break;
      }
      if (source === 'none') {
        compiledDeclarations[CueStyleProperty.backgroundImage] = source;
        break;
      }
      if (source.startsWith('uuid:')) {
        if (
          source.length <= 'uuid:'.length
          || /\s/u.test(source.slice('uuid:'.length))
        ) {
          errors.push(new SyntaxError(
            'background-image url() contains an invalid "uuid:" source.',
          ));
        } else {
          compiledDeclarations[CueStyleProperty.backgroundImage] = source;
        }
        break;
      }
      if (
        !source.startsWith('./')
        && !source.startsWith('../')
      ) {
        errors.push(new SyntaxError(
          'background-image url() must be relative to the .cue stylesheet or use the "uuid:" scheme.',
        ));
        break;
      }
      if (!canonicalizeBackgroundImageSource) {
        errors.push(new SyntaxError(
          `Cannot compile relative background-image url(${JSON.stringify(source)}) without a compiler-host background image canonicalizer.`,
        ));
        break;
      }
      const result = canonicalizeBackgroundImageSource(source, filename);
      if (!result.ok) {
        errors.push(
          result.error instanceof Error
            ? result.error
            : new Error(result.error),
        );
        break;
      }
      if (
        !result.source.startsWith('uuid:')
        || result.source.length <= 'uuid:'.length
        || /\s/u.test(result.source)
      ) {
        errors.push(new SyntaxError(
          'The compiler host returned an invalid background image source; expected a non-empty "uuid:" source.',
        ));
        break;
      }
      compiledDeclarations[CueStyleProperty.backgroundImage] = result.source;
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
      writeBorder(compiledDeclarations, declaration.value, borderSideNames);
      break;
    }
    case 'border-top':
    case 'border-right':
    case 'border-bottom':
    case 'border-left': {
      writeBorder(
        compiledDeclarations,
        declaration.value,
        [declaration.property.slice('border-'.length) as BorderSideName],
      );
      break;
    }
    case 'border-color': {
      writeBorderColors(compiledDeclarations, declaration.value);
      break;
    }
    case 'border-top-color':
    case 'border-right-color':
    case 'border-bottom-color':
    case 'border-left-color': {
      const color = readBorderColor(declaration.value);
      if (color) {
        compiledDeclarations[borderColorProperties[declaration.property.slice(7, -6) as BorderSideName]] = color;
      }
      break;
    }
    case 'border-radius': {
      writeBorderRadius(compiledDeclarations, declaration.value);
      break;
    }
    case 'border-top-left-radius':
    case 'border-top-right-radius':
    case 'border-bottom-right-radius':
    case 'border-bottom-left-radius': {
      const radius = readCornerRadius(declaration.value);
      if (radius) {
        compiledDeclarations[cornerRadiusProperties[declaration.property]] = radius;
      }
      break;
    }
    case 'border-style': {
      writeBorderStyles(compiledDeclarations, declaration.value);
      break;
    }
    case 'border-top-style':
    case 'border-right-style':
    case 'border-bottom-style':
    case 'border-left-style': {
      const style = readBorderStyle(declaration.value);
      if (style) {
        compiledDeclarations[borderStyleProperties[declaration.property.slice(7, -6) as BorderSideName]] = style;
      }
      break;
    }
    case 'border-width': {
      writeBorderWidths(compiledDeclarations, declaration.value);
      break;
    }
    case 'border-top-width':
    case 'border-right-width':
    case 'border-bottom-width':
    case 'border-left-width': {
      const width = readBorderWidth(declaration.value);
      if (width !== undefined) {
        compiledDeclarations[borderWidthProperties[declaration.property.slice(7, -6) as BorderSideName]] = width;
      }
      break;
    }
    case 'box-sizing':
      compiledDeclarations[CueStyleProperty.boxSizing]
        = declaration.value === 'border-box'
          ? CueBoxSizing.borderBox
          : CueBoxSizing.contentBox;
      break;
    case 'box-shadow': {
      const shadows = readBoxShadows(declaration.value);
      if (shadows) {
        compiledDeclarations[CueStyleProperty.boxShadow] = shadows;
      }
      break;
    }
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
    case 'transform': {
      const functions = readTransformFunctions(declaration.value);
      if (functions) {
        compiledDeclarations[CueStyleProperty.transform] = functions;
      } else {
        errors.push(new SyntaxError(
          'Cue supports 2D CSS transform functions with px or percentage translation only.',
        ));
      }
      break;
    }
    case 'transform-origin': {
      const origin = readTransformOrigin(declaration.value);
      if (origin) {
        compiledDeclarations[CueStyleProperty.transformOrigin] = origin;
      } else {
        errors.push(new SyntaxError(
          'Cue supports 2D transform-origin with px or percentage x/y coordinates only.',
        ));
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
    case 'opacity':
      errors.push(new SyntaxError(
        'Web CSS opacity requires group compositing, which Cue does not implement. Use -cue-opacity for per-element opacity.',
      ));
      break;
    case 'overflow': {
      const overflowX = readOverflow(declaration.value.x);
      const overflowY = readOverflow(declaration.value.y);
      if (overflowX && overflowY && overflowX === overflowY) {
        compiledDeclarations[CueStyleProperty.overflowX] = overflowX;
        compiledDeclarations[CueStyleProperty.overflowY] = overflowY;
      } else {
        errors.push(new SyntaxError(
          'Cue currently supports equal-axis overflow: visible, hidden, and clip; scrolling and mixed-axis values are not supported.',
        ));
      }
      break;
    }
    case 'outline':
      writeOutline(compiledDeclarations, declaration.value);
      break;
    case 'outline-color': {
      const color = readBorderColor(declaration.value);
      if (color) {
        compiledDeclarations[CueStyleProperty.outlineColor] = color;
      }
      break;
    }
    case 'outline-style': {
      const style = readOutlineStyle(declaration.value);
      if (style) {
        compiledDeclarations[CueStyleProperty.outlineStyle] = style;
      }
      break;
    }
    case 'outline-width': {
      const width = readBorderWidth(declaration.value);
      if (width !== undefined) {
        compiledDeclarations[CueStyleProperty.outlineWidth] = width;
      }
      break;
    }
    case 'custom': {
      if (declaration.value.name.toLowerCase() === 'pointer-events') {
        const tokens = declaration.value.value.filter((token) => !(
          token.type === 'token' && token.value.type === 'white-space'
        ));
        const token = tokens[0];
        const value = tokens.length === 1 && token?.type === 'token' && token.value.type === 'ident'
          ? token.value.value.toLowerCase()
          : undefined;
        if (value === 'auto' || value === 'none') {
          compiledDeclarations[CueStyleProperty.pointerEvents] = CuePointerEvents[value];
        } else {
          errors.push(new SyntaxError('Cue supports pointer-events: auto or none.'));
        }
      }
      if (declaration.value.name.startsWith('-cue-text-stroke')) {
        writeTextStroke(compiledDeclarations, declaration.value.name, declaration.value.value, errors);
      }
      if (declaration.value.name === '-cue-opacity') {
        const opacity = readCueOpacity(declaration.value.value);
        if (opacity === undefined) {
          errors.push(new SyntaxError(
            '-cue-opacity requires a number from 0 to 1.',
          ));
        } else {
          compiledDeclarations[CueStyleProperty.cueOpacity] = opacity;
        }
      }
      if (declaration.value.name === 'outline-offset') {
        const offset = readCustomPixelLength(declaration.value.value);
        if (offset === undefined) {
          errors.push(new SyntaxError(
            'Cue currently supports outline-offset in px.',
          ));
        } else {
          compiledDeclarations[CueStyleProperty.outlineOffset] = offset;
        }
      }
      break;
    }
    case 'unparsed': {
      if (declaration.value.propertyId.property === 'background-image') {
        errors.push(new SyntaxError(
          'Cue currently supports one relative url(), a two-stop opaque sRGB linear-gradient(), or none for background-image.',
        ));
      }
      break;
    }
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
    case 'z-index':
      compiledDeclarations[CueStyleProperty.zIndex]
        = declaration.value.type === 'integer'
          ? declaration.value.value
          : 'auto';
      break;
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

function writeTextStroke(
  declarations: CueStyleDeclarations,
  name: string,
  tokens: readonly TokenOrValue[],
  errors: Error[],
): void {
  const values = tokens.filter((entry) => !(
    entry.type === 'token' && entry.value.type === 'white-space'
  ));
  let width: number | undefined;
  let color: CueColor | CueColorKeyword | undefined;
  for (const entry of values) {
    const length = readCustomPixelLength([entry]);
    if (length !== undefined && length >= 0 && width === undefined) {
      width = length;
      continue;
    }
    let parsedColor: CueColor | CueColorKeyword | undefined;
    if (entry.type === 'color') {
      parsedColor = readBorderColor(entry.value);
    } else if (entry.type === 'token' && entry.value.type === 'ident') {
      const keyword = entry.value.value.toLowerCase();
      if (keyword === 'currentcolor') {
        parsedColor = CueColorKeyword.currentColor;
      } else if (keyword === 'transparent') {
        parsedColor = { alpha: 0, blue: 0, green: 0, red: 0 };
      } else if (Object.hasOwn(colorNames, keyword)) {
        const [red, green, blue] = colorNames[keyword as keyof typeof colorNames];
        parsedColor = { alpha: 1, blue, green, red };
      }
    }
    if (parsedColor !== undefined && color === undefined) {
      color = parsedColor;
      continue;
    }
    errors.push(new SyntaxError('Cue text stroke requires a nonnegative px width and/or a supported CSS color.'));
    return;
  }
  if (name === '-cue-text-stroke' && values.length > 0) {
    declarations.cueTextStrokeWidth = width ?? 0;
    declarations.cueTextStrokeColor = color ?? CueColorKeyword.currentColor;
  } else if (name === '-cue-text-stroke-width' && width !== undefined && color === undefined) {
    declarations.cueTextStrokeWidth = width;
  } else if (name === '-cue-text-stroke-color' && color !== undefined && width === undefined) {
    declarations.cueTextStrokeColor = color;
  } else {
    errors.push(new SyntaxError('Unsupported Cue text stroke declaration: ' + name));
  }
}

function readCustomPixelLength(value: readonly unknown[]): number | undefined {
  if (value.length !== 1) {
    return undefined;
  }
  const token = value[0];
  if (!token || typeof token !== 'object') {
    return undefined;
  }
  const length = token as {
    type?: string;
    value?: number | {
      type?: string;
      unit?: string;
      value?: number;
    };
  };
  if (
    length.type === 'length'
    && typeof length.value === 'object'
    && length.value.unit === 'px'
    && typeof length.value.value === 'number'
  ) {
    return length.value.value;
  }
  return length.type === 'token'
    && typeof length.value === 'object'
    && length.value.type === 'number'
    && length.value.value === 0
    ? 0
    : undefined;
}

function readCueOpacity(value: readonly unknown[]): number | undefined {
  if (value.length !== 1) {
    return undefined;
  }
  const entry = value[0] as {
    type?: string;
    value?: {
      type?: string;
      value?: number;
    };
  } | undefined;
  const opacity = entry?.type === 'token'
    && entry.value?.type === 'number'
    ? entry.value.value
    : undefined;
  return opacity !== undefined
    && Number.isFinite(opacity)
    && opacity >= 0
    && opacity <= 1
    ? opacity
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
  sides: readonly BorderSideName[],
): void {
  const color = readBorderColor(border.color);
  const style = readBorderStyle(border.style);
  const width = readBorderWidth(border.width);
  if (!color || !style || width === undefined) {
    return;
  }
  for (const side of sides) {
    declarations[borderColorProperties[side]] = color;
    declarations[borderStyleProperties[side]] = style;
    declarations[borderWidthProperties[side]] = width;
  }
}

const borderSideNames = ['top', 'right', 'bottom', 'left'] as const;
type BorderSideName = typeof borderSideNames[number];

const borderColorProperties = {
  bottom: CueStyleProperty.borderBottomColor,
  left: CueStyleProperty.borderLeftColor,
  right: CueStyleProperty.borderRightColor,
  top: CueStyleProperty.borderTopColor,
} as const;
const borderStyleProperties = {
  bottom: CueStyleProperty.borderBottomStyle,
  left: CueStyleProperty.borderLeftStyle,
  right: CueStyleProperty.borderRightStyle,
  top: CueStyleProperty.borderTopStyle,
} as const;
const borderWidthProperties = {
  bottom: CueStyleProperty.borderBottomWidth,
  left: CueStyleProperty.borderLeftWidth,
  right: CueStyleProperty.borderRightWidth,
  top: CueStyleProperty.borderTopWidth,
} as const;
const cornerRadiusProperties = {
  'border-bottom-left-radius': CueStyleProperty.borderBottomLeftRadius,
  'border-bottom-right-radius': CueStyleProperty.borderBottomRightRadius,
  'border-top-left-radius': CueStyleProperty.borderTopLeftRadius,
  'border-top-right-radius': CueStyleProperty.borderTopRightRadius,
} as const;

function writeBorderColors(
  declarations: CueStyleDeclarations,
  borderColor: BorderColor,
): void {
  for (const side of borderSideNames) {
    const color = readBorderColor(borderColor[side]);
    if (color) {
      declarations[borderColorProperties[side]] = color;
    }
  }
}

function writeBorderStyles(
  declarations: CueStyleDeclarations,
  borderStyle: BorderStyle,
): void {
  for (const side of borderSideNames) {
    const style = readBorderStyle(borderStyle[side]);
    if (style) {
      declarations[borderStyleProperties[side]] = style;
    }
  }
}

function writeBorderWidths(
  declarations: CueStyleDeclarations,
  borderWidth: BorderWidth,
): void {
  for (const side of borderSideNames) {
    const width = readBorderWidth(borderWidth[side]);
    if (width !== undefined) {
      declarations[borderWidthProperties[side]] = width;
    }
  }
}

function readBorderStyle(style: string): CueBorderStyle | undefined {
  switch (style) {
  case 'none':
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

function writeOutline(
  declarations: CueStyleDeclarations,
  outline: GenericBorderFor_OutlineStyleAnd_11,
): void {
  const color = readBorderColor(outline.color);
  const style = readOutlineStyle(outline.style);
  const width = readBorderWidth(outline.width);
  if (!color || !style || width === undefined) {
    return;
  }
  declarations[CueStyleProperty.outlineColor] = color;
  declarations[CueStyleProperty.outlineStyle] = style;
  declarations[CueStyleProperty.outlineWidth] = width;
}

function readOutlineStyle(style: OutlineStyle): CueBorderStyle | undefined {
  return style.type === 'line-style'
    ? readBorderStyle(style.value)
    : undefined;
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

function readBackgroundImage(
  images: readonly Image[],
): string | CueLinearGradient | undefined {
  if (images.length !== 1) {
    return undefined;
  }
  const image = images[0];
  if (image?.type === 'none') {
    return 'none';
  }
  if (image?.type === 'gradient') {
    const gradient = image.value;
    if (
      gradient.type !== 'linear'
      || gradient.vendorPrefix.length > 0
      || gradient.items.length !== 2
      || gradient.items[0]?.type !== 'color-stop'
      || gradient.items[1]?.type !== 'color-stop'
      || (
        gradient.items[0].position !== null
        && gradient.items[0].position !== undefined
      )
      || (
        gradient.items[1].position !== null
        && gradient.items[1].position !== undefined
      )
    ) {
      return undefined;
    }
    const startColor = readColor(gradient.items[0].color);
    const endColor = readColor(gradient.items[1].color);
    if (!startColor || !endColor || startColor.alpha !== 1 || endColor.alpha !== 1) {
      return undefined;
    }
    let direction: CueLinearGradient['direction'];
    if (gradient.direction.type === 'vertical') {
      direction = gradient.direction.value;
    } else if (gradient.direction.type === 'horizontal') {
      direction = gradient.direction.value;
    } else {
      return undefined;
    }
    return {
      direction,
      endColor,
      startColor,
      type: 'linear-gradient',
    };
  }
  return image?.type === 'url' ? image.value.url : undefined;
}

function readOverflow(value: string): CueOverflow | undefined {
  switch (value) {
  case CueOverflow.clip:
    return CueOverflow.clip;
  case CueOverflow.hidden:
    return CueOverflow.hidden;
  case CueOverflow.visible:
    return CueOverflow.visible;
  default:
    return undefined;
  }
}

function readTransformFunctions(
  functions: readonly CssTransform[],
): readonly CueTransformFunction[] | undefined {
  const transforms: CueTransformFunction[] = [];
  for (const transform of functions) {
    switch (transform.type) {
    case 'matrix':
      transforms.push({
        ...transform.value,
        type: 'matrix',
      });
      break;
    case 'rotate':
    case 'rotateZ':
      transforms.push({
        angle: angleDegrees(transform.value),
        type: 'rotate',
      });
      break;
    case 'scale':
      transforms.push({
        type: 'scale',
        x: numericScale(transform.value[0]),
        y: numericScale(transform.value[1]),
      });
      break;
    case 'scaleX':
      transforms.push({ type: 'scale', x: numericScale(transform.value), y: 1 });
      break;
    case 'scaleY':
      transforms.push({ type: 'scale', x: 1, y: numericScale(transform.value) });
      break;
    case 'skew':
      transforms.push({
        type: 'skew',
        xAngle: angleDegrees(transform.value[0]),
        yAngle: angleDegrees(transform.value[1]),
      });
      break;
    case 'skewX':
      transforms.push({ type: 'skew', xAngle: angleDegrees(transform.value), yAngle: 0 });
      break;
    case 'skewY':
      transforms.push({ type: 'skew', xAngle: 0, yAngle: angleDegrees(transform.value) });
      break;
    case 'translate': {
      const x = readLengthPercentage(transform.value[0]);
      const y = readLengthPercentage(transform.value[1]);
      if (x === undefined || y === undefined) {
        return undefined;
      }
      transforms.push({ type: 'translate', x, y });
      break;
    }
    case 'translateX':
    case 'translateY': {
      const offset = readLengthPercentage(transform.value);
      if (offset === undefined) {
        return undefined;
      }
      transforms.push({
        type: 'translate',
        x: transform.type === 'translateX' ? offset : 0,
        y: transform.type === 'translateY' ? offset : 0,
      });
      break;
    }
    default:
      return undefined;
    }
  }
  return transforms;
}

function readTransformOrigin(
  position: Position,
): readonly [CueLengthPercentage, CueLengthPercentage] | undefined {
  const x = position.x.type === 'center'
    ? '50%'
    : position.x.type === 'side'
      ? position.x.offset === null || position.x.offset === undefined
        ? position.x.side === 'left' ? '0%' : '100%'
        : undefined
      : readLengthPercentage(position.x.value);
  const y = position.y.type === 'center'
    ? '50%'
    : position.y.type === 'side'
      ? position.y.offset === null || position.y.offset === undefined
        ? position.y.side === 'top' ? '0%' : '100%'
        : undefined
      : readLengthPercentage(position.y.value);
  return x === undefined || y === undefined ? undefined : [x, y];
}

function angleDegrees(angle: Angle): number {
  switch (angle.type) {
  case 'deg':
    return angle.value;
  case 'rad':
    return angle.value * 180 / Math.PI;
  case 'grad':
    return angle.value * 0.9;
  case 'turn':
    return angle.value * 360;
  }
}

function numericScale(scale: { type: 'number' | 'percentage'; value: number }): number {
  return scale.value;
}

function readBorderColor(
  color: CssColor,
): CueColor | CueColorKeyword | undefined {
  return typeof color === 'object' && color.type === 'currentcolor'
    ? CueColorKeyword.currentColor
    : readColor(color);
}

function readBoxShadows(
  boxShadows: readonly BoxShadow[],
): readonly CueBoxShadow[] | undefined {
  const shadows: CueBoxShadow[] = [];
  for (const shadow of boxShadows) {
    const color = readBorderColor(shadow.color);
    const blur = readShadowLength(shadow.blur);
    const spread = readShadowLength(shadow.spread);
    const xOffset = readShadowLength(shadow.xOffset);
    const yOffset = readShadowLength(shadow.yOffset);
    if (
      !color
      || blur === undefined
      || spread === undefined
      || xOffset === undefined
      || yOffset === undefined
    ) {
      return undefined;
    }
    shadows.push({
      blur,
      color,
      inset: shadow.inset,
      spread,
      xOffset,
      yOffset,
    });
  }
  return shadows;
}

function readShadowLength(length: Length): number | undefined {
  return length.type === 'value' && length.value.unit === 'px'
    ? length.value.value
    : undefined;
}

function writeBorderRadius(
  declarations: CueStyleDeclarations,
  borderRadius: BorderRadius,
): void {
  const corners = {
    'border-bottom-left-radius': borderRadius.bottomLeft,
    'border-bottom-right-radius': borderRadius.bottomRight,
    'border-top-left-radius': borderRadius.topLeft,
    'border-top-right-radius': borderRadius.topRight,
  } as const;
  for (const [cssName, corner] of Object.entries(corners)) {
    const radius = readCornerRadius(corner);
    if (radius) {
      declarations[cornerRadiusProperties[cssName as keyof typeof cornerRadiusProperties]] = radius;
    }
  }
}

function readCornerRadius(
  corner: BorderRadius['topLeft'],
): CueCornerRadius | undefined {
  const horizontal = readLengthPercentage(corner[0]);
  const vertical = readLengthPercentage(corner[1]);
  return horizontal === undefined || vertical === undefined
    ? undefined
    : [horizontal, vertical];
}

export {};

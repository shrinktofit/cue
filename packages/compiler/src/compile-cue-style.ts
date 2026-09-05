import { Buffer } from 'node:buffer';

import {
  cueStyleSchemaVersion,
  CueAlignItems,
  CueDisplay,
  CueFlexDirection,
  CueJustifyContent,
  CueStyleProperty,
  type CueClassSelector,
  type CueStyleDeclarations,
  type CueStyleRule,
  type CueStyleSheet,
} from '@bsgames/cue-style-schema';
import {
  transform,
  type AlignItems,
  type BorderRadius,
  type CssColor,
  type Declaration,
  type DimensionPercentageFor_LengthValue,
  type Display,
  type FlexDirection,
  type Gap,
  type GapValue,
  type JustifyContent,
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
    case 'align-items': {
      const value = readAlignItems(declaration.value);
      if (value) {
        compiledDeclarations[CueStyleProperty.alignItems] = value;
      }
      break;
    }
    case 'width':
    case 'height': {
      const value = readPixelSize(declaration.value);
      if (value !== undefined) {
        compiledDeclarations[
          declaration.property === 'width'
            ? CueStyleProperty.width
            : CueStyleProperty.height
        ] = value;
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
    case 'border-radius': {
      const value = readBorderRadius(declaration.value);
      if (value) {
        compiledDeclarations[CueStyleProperty.borderRadius] = value;
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
    case 'flex-direction':
      compiledDeclarations[CueStyleProperty.flexDirection]
        = readFlexDirection(declaration.value);
      break;
    case 'gap': {
      const value = readGap(declaration.value);
      if (value) {
        compiledDeclarations[CueStyleProperty.gap] = value;
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
    default:
      break;
    }
  }
  return compiledDeclarations;
}

function readAlignItems(alignItems: AlignItems): CueAlignItems | undefined {
  if (alignItems.type === 'stretch') {
    return CueAlignItems.stretch;
  }
  if (alignItems.type !== 'self-position') {
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

function readPixelSize(size: Size): number | undefined {
  if (size.type !== 'length-percentage') {
    return undefined;
  }
  return readPixelLength(size.value);
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

function readGap(gap: Gap) {
  const column = readGapValue(gap.column);
  const row = readGapValue(gap.row);
  return column === undefined || row === undefined
    ? undefined
    : {
      column,
      row,
    };
}

function readGapValue(gap: GapValue): number | undefined {
  return gap.type === 'length-percentage'
    ? readPixelLength(gap.value)
    : undefined;
}

function readJustifyContent(
  justifyContent: JustifyContent,
): CueJustifyContent | undefined {
  if (
    justifyContent.type !== 'content-distribution'
    && justifyContent.type !== 'content-position'
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

function readPixelLength(
  length: DimensionPercentageFor_LengthValue,
): number | undefined {
  if (length.type !== 'dimension' || length.value.unit !== 'px') {
    return undefined;
  }
  return length.value.value;
}

function readColor(color: CssColor) {
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

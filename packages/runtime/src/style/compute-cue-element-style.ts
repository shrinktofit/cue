import {
  CueBorderStyle,
  CueBoxSizing,
  CueColorKeyword,
  CueDimensionKeyword,
  CueDisplay,
  CueFlexDirection,
  CueFlexWrap,
  CueLineHeightKeyword,
  CueMaxDimensionKeyword,
  CueOverflow,
  CuePointerEvents,
  CuePosition,
  CueStyleProperty,
  CueTextAlign,
  CueWhiteSpace,
  type CueAlignContent,
  type CueAlignItems,
  type CueAlignSelf,
  type CueBoxShadow,
  type CueColor,
  type CueCornerRadius,
  type CueDimension,
  type CueJustifyContent,
  type CueLengthPercentage,
  type CueLinearGradient,
  type CueLineHeight,
  type CueTransformFunction,
  type CueMargin,
  type CueMaxDimension,
  type CueStyleDeclarations,
  type CueStyleRule,
  type CueStyleSheet,
} from '@bsgames/cue-style-schema';
import {
  getCueElementProperties,
  type CueElement,
} from '../element/cue-element.js';
import { DivElement } from '../element/div-element.js';
import { encodeCueStyle } from './cue-inline-style.js';

export interface ComputedCueTextStyle {
  fontWeight: number;
  cueTextStrokeWidth: number;
  cueTextStrokeColor: CueColor;
  color: CueColor;
  fontFamily: readonly string[];
  fontSize: number;
  lineHeight: CueLineHeight;
  textAlign: CueTextAlign;
  whiteSpace: CueWhiteSpace;
}

export interface ComputedCueBoxShadow extends Omit<CueBoxShadow, 'color'> {
  color: CueColor;
}

export interface ComputedCueElementStyle extends ComputedCueTextStyle {
  pointerEvents: CuePointerEvents;
  position: CuePosition;
  top: CueDimension;
  right: CueDimension;
  bottom: CueDimension;
  left: CueDimension;
  alignContent?: CueAlignContent;
  alignItems?: CueAlignItems;
  alignSelf?: CueAlignSelf;
  backgroundColor: CueColor;
  backgroundImage?: string | CueLinearGradient;
  borderBottomColor: CueColor;
  borderBottomLeftRadius: CueCornerRadius;
  borderBottomRightRadius: CueCornerRadius;
  borderBottomStyle: CueBorderStyle;
  borderBottomWidth: number;
  borderLeftColor: CueColor;
  borderLeftStyle: CueBorderStyle;
  borderLeftWidth: number;
  borderRightColor: CueColor;
  borderRightStyle: CueBorderStyle;
  borderRightWidth: number;
  borderTopColor: CueColor;
  borderTopLeftRadius: CueCornerRadius;
  borderTopRightRadius: CueCornerRadius;
  borderTopStyle: CueBorderStyle;
  borderTopWidth: number;
  boxSizing: CueBoxSizing;
  boxShadow: readonly ComputedCueBoxShadow[];
  columnGap: CueLengthPercentage;
  cueOpacity: number;
  display?: CueDisplay;
  flexBasis: CueDimension;
  flexDirection: CueFlexDirection;
  flexGrow: number;
  flexShrink: number;
  flexWrap: CueFlexWrap;
  height: CueDimension;
  justifyContent?: CueJustifyContent;
  marginBottom: CueMargin;
  marginLeft: CueMargin;
  marginRight: CueMargin;
  marginTop: CueMargin;
  maxHeight: CueMaxDimension;
  maxWidth: CueMaxDimension;
  minHeight: CueDimension;
  minWidth: CueDimension;
  order: number;
  outlineColor: CueColor;
  outlineOffset: number;
  outlineStyle: CueBorderStyle;
  outlineWidth: number;
  overflowX: CueOverflow;
  overflowY: CueOverflow;
  paddingBottom: CueLengthPercentage;
  paddingLeft: CueLengthPercentage;
  paddingRight: CueLengthPercentage;
  paddingTop: CueLengthPercentage;
  rowGap: CueLengthPercentage;
  transform: readonly CueTransformFunction[];
  transformOrigin: readonly [CueLengthPercentage, CueLengthPercentage];
  width: CueDimension;
  zIndex: number | 'auto';
}

interface DeclarationCandidate {
  important: boolean;
  order: number;
  specificity: number;
}

const cueStyleProperties = Object.values(CueStyleProperty);

export const initialCueTextStyle: ComputedCueTextStyle = {
  fontWeight: 400,
  cueTextStrokeWidth: 0,
  cueTextStrokeColor: { alpha: 1, blue: 0, green: 0, red: 0 },
  color: {
    alpha: 1,
    blue: 0,
    green: 0,
    red: 0,
  },
  fontFamily: [
    'sans-serif',
  ],
  fontSize: 16,
  lineHeight: CueLineHeightKeyword.normal,
  textAlign: CueTextAlign.start,
  whiteSpace: CueWhiteSpace.normal,
};

export function computeCueElementStyle(
  element: CueElement,
  styleSheets: readonly CueStyleSheet[],
  inheritedTextStyle: ComputedCueTextStyle & { pointerEvents?: CuePointerEvents } = initialCueTextStyle,
): ComputedCueElementStyle {
  const classNames = readClassNames(getCueElementProperties(element).get('class'));
  const candidates = new Map<CueStyleProperty, DeclarationCandidate>();
  const declarations: CueStyleDeclarations = {};
  let order = 0;

  for (const styleSheet of styleSheets) {
    for (const rule of styleSheet.rules) {
      order += 1;
      let specificity: number | undefined;
      for (const selector of rule.selectors) {
        if (
          selector.every((className) => classNames.has(className))
          && (specificity === undefined || selector.length > specificity)
        ) {
          specificity = selector.length;
        }
      }
      if (specificity === undefined) {
        continue;
      }
      applyDeclarations(
        declarations,
        candidates,
        rule.declarations,
        false,
        order,
        specificity,
      );
      applyDeclarations(
        declarations,
        candidates,
        rule.importantDeclarations,
        true,
        order,
        specificity,
      );
    }
  }

  // Private compiler output, never CSS source text.
  const inlineStyle = getCueElementProperties(element).get('__cueInlineStyle') as CueStyleRule | undefined;
  applyDeclarations(declarations, candidates, inlineStyle?.declarations, false, order + 1, Infinity);
  applyDeclarations(declarations, candidates, inlineStyle?.importantDeclarations, true, order + 1, Infinity);
  applyDeclarations(declarations, candidates, encodeCueStyle(element.style), false, order + 2, Infinity);

  const computedStyle: ComputedCueElementStyle = {
    pointerEvents: inheritedTextStyle.pointerEvents ?? CuePointerEvents.auto,
    position: CuePosition.static,
    top: CueDimensionKeyword.auto,
    right: CueDimensionKeyword.auto,
    bottom: CueDimensionKeyword.auto,
    left: CueDimensionKeyword.auto,
    fontWeight: inheritedTextStyle.fontWeight,
    cueTextStrokeWidth: inheritedTextStyle.cueTextStrokeWidth,
    cueTextStrokeColor: inheritedTextStyle.cueTextStrokeColor,
    backgroundColor: {
      alpha: 0,
      blue: 0,
      green: 0,
      red: 0,
    },
    borderBottomColor: inheritedTextStyle.color,
    borderBottomLeftRadius: [0, 0],
    borderBottomRightRadius: [0, 0],
    borderBottomStyle: CueBorderStyle.none,
    borderBottomWidth: 3,
    borderLeftColor: inheritedTextStyle.color,
    borderLeftStyle: CueBorderStyle.none,
    borderLeftWidth: 3,
    borderRightColor: inheritedTextStyle.color,
    borderRightStyle: CueBorderStyle.none,
    borderRightWidth: 3,
    borderTopColor: inheritedTextStyle.color,
    borderTopLeftRadius: [0, 0],
    borderTopRightRadius: [0, 0],
    borderTopStyle: CueBorderStyle.none,
    borderTopWidth: 3,
    boxSizing: CueBoxSizing.contentBox,
    boxShadow: [],
    columnGap: 0,
    cueOpacity: 1,
    color: inheritedTextStyle.color,
    ...(element instanceof DivElement
      ? {
        display: CueDisplay.block,
      }
      : {}),
    flexBasis: CueDimensionKeyword.auto,
    flexDirection: CueFlexDirection.row,
    flexGrow: 0,
    flexShrink: 1,
    flexWrap: CueFlexWrap.nowrap,
    fontFamily: inheritedTextStyle.fontFamily,
    fontSize: inheritedTextStyle.fontSize,
    height: CueDimensionKeyword.auto,
    marginBottom: 0,
    marginLeft: 0,
    marginRight: 0,
    marginTop: 0,
    maxHeight: CueMaxDimensionKeyword.none,
    maxWidth: CueMaxDimensionKeyword.none,
    minHeight: CueDimensionKeyword.auto,
    minWidth: CueDimensionKeyword.auto,
    lineHeight: inheritedTextStyle.lineHeight,
    order: 0,
    outlineColor: inheritedTextStyle.color,
    outlineOffset: 0,
    outlineStyle: CueBorderStyle.none,
    outlineWidth: 3,
    overflowX: CueOverflow.visible,
    overflowY: CueOverflow.visible,
    paddingBottom: 0,
    paddingLeft: 0,
    paddingRight: 0,
    paddingTop: 0,
    rowGap: 0,
    textAlign: inheritedTextStyle.textAlign,
    transform: [],
    transformOrigin: ['50%', '50%'],
    whiteSpace: inheritedTextStyle.whiteSpace,
    width: CueDimensionKeyword.auto,
    zIndex: 'auto',
  };
  Object.assign(computedStyle, declarations);
  computedStyle.cueTextStrokeColor = computedBorderColor(
    declarations.cueTextStrokeColor ?? inheritedTextStyle.cueTextStrokeColor,
    computedStyle.color,
  );
  computedStyle.borderBottomColor = computedBorderColor(
    declarations.borderBottomColor,
    computedStyle.color,
  );
  computedStyle.borderLeftColor = computedBorderColor(
    declarations.borderLeftColor,
    computedStyle.color,
  );
  computedStyle.borderRightColor = computedBorderColor(
    declarations.borderRightColor,
    computedStyle.color,
  );
  computedStyle.borderTopColor = computedBorderColor(
    declarations.borderTopColor,
    computedStyle.color,
  );
  computedStyle.outlineColor = computedBorderColor(
    declarations.outlineColor,
    computedStyle.color,
  );
  computedStyle.boxShadow = computedStyle.boxShadow.map((shadow) => ({
    ...shadow,
    color: computedBorderColor(shadow.color, computedStyle.color),
  }));
  return computedStyle;
}

function computedBorderColor(
  value: CueColor | CueColorKeyword | undefined,
  currentColor: CueColor,
): CueColor {
  return value === undefined || value === CueColorKeyword.currentColor
    ? currentColor
    : value;
}

function applyDeclarations(
  target: CueStyleDeclarations,
  candidates: Map<CueStyleProperty, DeclarationCandidate>,
  declarations: CueStyleDeclarations | undefined,
  important: boolean,
  order: number,
  specificity: number,
): void {
  if (!declarations) {
    return;
  }
  for (const property of cueStyleProperties) {
    const value = declarations[property];
    if (value === undefined) {
      continue;
    }
    const candidate = {
      important,
      order,
      specificity,
    };
    const previous = candidates.get(property);
    if (!previous || hasHigherPriority(candidate, previous)) {
      candidates.set(property, candidate);
      Object.assign(target, {
        [property]: value,
      });
    }
  }
}

function readClassNames(value: unknown): Set<string> {
  const classNames = new Set<string>();
  appendClassNames(classNames, value);
  return classNames;
}

function appendClassNames(classNames: Set<string>, value: unknown): void {
  if (typeof value === 'string') {
    for (const className of value.split(/\s+/u)) {
      if (className.length > 0) {
        classNames.add(className);
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      appendClassNames(classNames, item);
    }
    return;
  }
  if (value && typeof value === 'object') {
    for (const [className, enabled] of Object.entries(value)) {
      if (enabled) {
        classNames.add(className);
      }
    }
  }
}

function hasHigherPriority(
  candidate: DeclarationCandidate,
  previous: DeclarationCandidate,
): boolean {
  if (candidate.important !== previous.important) {
    return candidate.important;
  }
  if (candidate.specificity !== previous.specificity) {
    return candidate.specificity > previous.specificity;
  }
  return candidate.order >= previous.order;
}

export {};

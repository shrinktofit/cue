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
  CueSelectorCombinator,
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
  type CueSelector,
  type CueSpecificity,
} from '@bsgames/cue-style-schema';
import {
  getCueElementProperties,
  getCueElementDefaultStyle,
  getCueElementStates,
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
  inline: boolean;
  order: number;
  specificity: CueSpecificity;
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
  const candidates = new Map<CueStyleProperty, DeclarationCandidate>();
  // Builtin defaults are a lower origin than every author declaration, even *.
  const declarations: CueStyleDeclarations = { ...getCueElementDefaultStyle(element) };
  let order = 0;

  for (const styleSheet of styleSheets) {
    for (const rule of styleSheet.rules) {
      order += 1;
      let specificity: CueSpecificity | undefined;
      for (const selector of rule.selectors) {
        if (matchesCueSelector(element, selector)) {
          const selectorSpecificity: [number, number, number] = [0, 0, 0];
          for (const token of selector) {
            if (token.type === 'id') {
              selectorSpecificity[0]++;
            } else if (token.type === 'class' || token.type === 'pseudo-class') {
              selectorSpecificity[1]++;
            } else if (token.type === 'type') {
              selectorSpecificity[2]++;
            }
          }
          if (specificity === undefined || compareSpecificity(selectorSpecificity, specificity) > 0) {
            specificity = selectorSpecificity;
          }
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
  applyDeclarations(declarations, candidates, inlineStyle?.declarations, false, order + 1, [0, 0, 0], true);
  applyDeclarations(declarations, candidates, inlineStyle?.importantDeclarations, true, order + 1, [0, 0, 0], true);
  applyDeclarations(declarations, candidates, encodeCueStyle(element.style), false, order + 2, [0, 0, 0], true);

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
  specificity: CueSpecificity,
  inline = false,
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
      inline,
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

function matchesCueSelector(element: CueElement, selector: CueSelector, end = selector.length - 1): boolean {
  const properties = getCueElementProperties(element);
  const classNames = readClassNames(properties.get('class'));
  for (let index = end; index >= 0; index--) {
    const token = selector[index]!;
    switch (token.type) {
    case 'type':
      if (element.tagName !== token.name) {
        return false;
      }
      break;
    case 'id':
      if (properties.get('id') !== token.name) {
        return false;
      }
      break;
    case 'class':
      if (!classNames.has(token.name)) {
        return false;
      }
      break;
    case 'pseudo-class':
      if (!getCueElementStates(element).has(token.kind)) {
        return false;
      }
      break;
    case 'universal':
      break;
    case 'combinator': {
      let ancestor = element.parent;
      while (ancestor) {
        if (matchesCueSelector(ancestor, selector, index - 1)) {
          return true;
        }
        if (token.value === CueSelectorCombinator.child) {
          return false;
        }
        ancestor = ancestor.parent;
      }
      return false;
    }
    default:
      throw new TypeError('Invalid Cue stylesheet selector token; recompile the stylesheet with the current compiler.');
    }
  }
  return true;
}

function compareSpecificity(left: CueSpecificity, right: CueSpecificity): number {
  return left[0] - right[0] || left[1] - right[1] || left[2] - right[2];
}

function hasHigherPriority(
  candidate: DeclarationCandidate,
  previous: DeclarationCandidate,
): boolean {
  if (candidate.important !== previous.important) {
    return candidate.important;
  }
  if (candidate.inline !== previous.inline) {
    return candidate.inline;
  }
  const specificityOrder = compareSpecificity(candidate.specificity, previous.specificity);
  if (specificityOrder !== 0) {
    return specificityOrder > 0;
  }
  return candidate.order >= previous.order;
}

export {};

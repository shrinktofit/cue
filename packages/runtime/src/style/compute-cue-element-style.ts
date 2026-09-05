import {
  CueDisplay,
  CueFlexDirection,
  CueStyleProperty,
  type CueAlignItems,
  type CueColor,
  type CueGap,
  type CueJustifyContent,
  type CueStyleDeclarations,
  type CueStyleSheet,
} from '@bsgames/cue-style-schema';
import {
  getCueElementProperties,
  type CueElement,
} from '../element/cue-element.js';
import { DivElement } from '../element/div-element.js';

export interface ComputedCueElementStyle {
  alignItems?: CueAlignItems;
  backgroundColor: CueColor;
  borderRadius: readonly [number, number, number, number];
  display?: CueDisplay;
  flexDirection: CueFlexDirection;
  gap: CueGap;
  height?: number;
  justifyContent?: CueJustifyContent;
  width?: number;
}

interface DeclarationCandidate {
  important: boolean;
  order: number;
  specificity: number;
}

const cueStyleProperties = Object.values(CueStyleProperty);

export function computeCueElementStyle(
  element: CueElement,
  styleSheets: readonly CueStyleSheet[],
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

  const computedStyle: ComputedCueElementStyle = {
    backgroundColor: {
      alpha: 0,
      blue: 0,
      green: 0,
      red: 0,
    },
    borderRadius: [
      0,
      0,
      0,
      0,
    ],
    ...(element instanceof DivElement
      ? {
        display: CueDisplay.block,
      }
      : {}),
    flexDirection: CueFlexDirection.row,
    gap: {
      column: 0,
      row: 0,
    },
  };
  Object.assign(computedStyle, declarations);
  return computedStyle;
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

import type { CueStyleDeclarations } from '@bsgames/cue-style-schema';
import type { CueStyle } from './cue-style.js';
import { Length, LengthUnit } from './length.js';

export function encodeCueStyle(style: CueStyle): CueStyleDeclarations {
  return encodeStyleValue(style) as CueStyleDeclarations;
}

function encodeStyleValue(value: unknown): unknown {
  if (value instanceof Length) {
    return value.unit === LengthUnit.px ? value.value : `${value.value}%`;
  }
  if (Array.isArray(value)) {
    return value.map(encodeStyleValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encodeStyleValue(item)]));
  }
  return value;
}

export {};

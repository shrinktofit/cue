import type {
  CueLineHeightKeyword,
  CueStyleDeclarations,
} from '@bsgames/cue-style-schema';
import type { Length, LengthUnit } from './length.js';

// The compiler IR stores percentages as compact strings. The public API uses
// typed values, so callers never construct CSS text or depend on IR encoding.
type StyleValue<Value> = Value extends `${number}%`
  ? Length
  : Value extends object
    ? { [Key in keyof Value]: StyleValue<Value[Key]> }
    : Value;

type PixelProperty
  = 'borderBottomWidth' | 'borderLeftWidth' | 'borderRightWidth' | 'borderTopWidth'
    | 'cueTextStrokeWidth' | 'fontSize' | 'outlineOffset' | 'outlineWidth';

/**
 * Runtime longhand overrides. Numeric lengths are pixels; unitless properties
 * remain unitless. Assign undefined to remove an override. This is a typed API,
 * not Vue's CSS string/object style binding or a CSSStyleDeclaration parser.
 */
export type CueStyle = {
  [Property in keyof CueStyleDeclarations]: Property extends 'lineHeight'
    // A CSS number here means a multiplier, which Cue does not support yet.
    // Require an explicit px value instead of reinterpreting that number.
    ? Length<LengthUnit.px> | CueLineHeightKeyword | undefined
    : Property extends PixelProperty
      ? number | Length<LengthUnit.px> | undefined
      : StyleValue<CueStyleDeclarations[Property]> | undefined;
};

export {};

import { DivElement, Length, type CueStyle } from '../src/index.js';

/// @case A TypeScript consumer sets and clears API values with exactOptionalPropertyTypes.
/// @expect Every override accepts undefined; CSS text, percentage-only misuse and line-height multipliers do not.
export function checkStyleApiTypes(): void {
  const element = new DivElement();
  element.style.width = Length.percent(50);
  element.style.width = undefined;
  element.style.color = undefined;
  element.style.fontSize = undefined;
  element.style.lineHeight = undefined;
  const empty: CueStyle = { width: undefined, backgroundColor: undefined };
  Object.assign(element.style, empty);

  // @ts-expect-error CSS source text is not a typed length.
  element.style.width = '50%';
  // @ts-expect-error Font size currently only supports pixels.
  element.style.fontSize = Length.percent(50);
  // @ts-expect-error Unitless line-height is a CSS multiplier, not a pixel length.
  element.style.lineHeight = 1.5;
  // @ts-expect-error Colors are structured data, not CSS source text.
  element.style.color = '#fff';
  // @ts-expect-error A scale factor is unitless, not a length.
  element.style.transform = [{ type: 'scale', x: Length.px(2), y: 1 }];
}

export {};

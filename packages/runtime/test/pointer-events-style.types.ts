import { CuePointerEvents, DivElement, type CueStyle } from '../src/index.js';

/// @case An API consumer sets, clears, and reads an element's pointer-events override.
/// @expect Only supported typed Web CSS enum values and undefined are accepted.
export function checkPointerEventsStyleTypes(): void {
  const element = new DivElement();
  element.style.pointerEvents = CuePointerEvents.none;
  element.style.pointerEvents = CuePointerEvents.auto;
  element.style.pointerEvents = undefined;
  const style: CueStyle = { pointerEvents: CuePointerEvents.none };
  Object.assign(element.style, style);
  // @ts-expect-error The public API uses the supported enum rather than CSS strings.
  element.style.pointerEvents = 'none';
  // @ts-expect-error SVG-only values are outside the supported CSS subset.
  element.style.pointerEvents = 'painted';
}

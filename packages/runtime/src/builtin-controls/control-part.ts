import { CuePointerEvents, type CueStyleDeclarations } from '@bsgames/cue-style-schema';
import { patchCueElementProperty, setCueElementDefaultStyle } from '../element/cue-element.js';
import { DivElement } from '../element/div-element.js';

export function createControlPart(className: string, style: CueStyleDeclarations): DivElement {
  const part = new DivElement();
  patchCueElementProperty(part, 'class', undefined, className);
  setCueElementDefaultStyle(part, { pointerEvents: CuePointerEvents.none, ...style });
  return part;
}

export {};

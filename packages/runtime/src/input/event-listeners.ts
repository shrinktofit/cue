import type { CueElement } from '../element/cue-element.js';
import type { CueEvent } from './cue-event.js';
import type { CuePointerEvent } from './cue-pointer-event.js';
import type { CueInputEvent, CueChangeEvent } from './cue-value-event.js';
import type { CueKeyboardEvent } from './cue-keyboard-event.js';
import type { CueFocusEvent } from './cue-focus-event.js';
import type { CueWheelEvent } from './cue-wheel-event.js';
import type { CueBeforeInputEvent, CueCompositionEvent } from './cue-editing-event.js';

export interface CueEventMap {
  beforeinput: CueBeforeInputEvent;
  compositionstart: CueCompositionEvent;
  compositionupdate: CueCompositionEvent;
  compositionend: CueCompositionEvent;
  input: CueInputEvent;
  change: CueChangeEvent;
  keydown: CueKeyboardEvent;
  keyup: CueKeyboardEvent;
  focus: CueFocusEvent;
  blur: CueFocusEvent;
  focusin: CueFocusEvent;
  focusout: CueFocusEvent;
  wheel: CueWheelEvent;
  pointerdown: CuePointerEvent;
  pointermove: CuePointerEvent;
  pointerup: CuePointerEvent;
  pointercancel: CuePointerEvent;
  pointerover: CuePointerEvent;
  pointerout: CuePointerEvent;
  pointerenter: CuePointerEvent;
  pointerleave: CuePointerEvent;
  gotpointercapture: CuePointerEvent;
  lostpointercapture: CuePointerEvent;
  click: CuePointerEvent;
}

export type CueEventListener<T extends CueEvent = CueEvent>
  = | ((this: CueElement, event: T) => void)
    | { handleEvent(event: T): void };

export interface CueEventListenerOptions {
  capture?: boolean;
}

export interface CueAddEventListenerOptions extends CueEventListenerOptions {
  once?: boolean;
  passive?: boolean;
}

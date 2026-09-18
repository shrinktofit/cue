import type { CueElement } from '../element/cue-element.js';
import type { CueEvent } from './cue-event.js';
import type { CuePointerEvent } from './cue-pointer-event.js';

export interface CueEventMap {
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

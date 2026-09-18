import type { CueElement } from '../element/cue-element.js';
import { CueEvent } from './cue-event.js';

export class CueFocusEvent extends CueEvent {
  constructor(type: string, readonly relatedTarget?: CueElement) {
    super(type, { bubbles: type === 'focusin' || type === 'focusout' });
  }
}

export {};

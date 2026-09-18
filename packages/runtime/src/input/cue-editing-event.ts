import { CueEvent } from './cue-event.js';

export class CueBeforeInputEvent extends CueEvent {
  constructor(
    readonly inputType: string,
    readonly data: string | undefined,
    readonly isComposing: boolean,
    cancelable = true,
  ) {
    super('beforeinput', { bubbles: true, cancelable });
  }
}

export class CueCompositionEvent extends CueEvent {
  constructor(type: 'compositionstart' | 'compositionupdate' | 'compositionend', readonly data: string) {
    super(type, { bubbles: true });
  }
}

export {};

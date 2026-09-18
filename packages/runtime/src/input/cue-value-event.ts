import { CueEvent } from './cue-event.js';

export class CueInputEvent<T = unknown> extends CueEvent {
  constructor(readonly value: T, init: { isComposing?: boolean } = {}) {
    super('input', { bubbles: true });
    this.isComposing = init.isComposing ?? false;
  }

  readonly isComposing: boolean;
}

export class CueChangeEvent<T = unknown> extends CueEvent {
  constructor(readonly value: T) {
    super('change', { bubbles: true });
  }
}

export {};

import { CueEvent, type CueEventInit } from './cue-event.js';

export interface CueKeyboardEventInit extends CueEventInit {
  key?: string;
  code?: string;
  repeat?: boolean;
  isComposing?: boolean;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
}

export class CueKeyboardEvent extends CueEvent {
  constructor(type: string, init: CueKeyboardEventInit = {}) {
    super(type, { bubbles: true, cancelable: true, ...init });
    this.key = init.key ?? '';
    this.code = init.code ?? '';
    this.repeat = init.repeat ?? false;
    this.isComposing = init.isComposing ?? false;
    this.ctrlKey = init.ctrlKey ?? false;
    this.shiftKey = init.shiftKey ?? false;
    this.altKey = init.altKey ?? false;
    this.metaKey = init.metaKey ?? false;
  }

  readonly key: string;
  readonly code: string;
  readonly repeat: boolean;
  readonly isComposing: boolean;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
}

export {};

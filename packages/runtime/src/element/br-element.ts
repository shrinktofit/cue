import { CueElement } from './cue-element.js';

export class BrElement extends CueElement {
  constructor() {
    super('br');
  }

  override get acceptsAuthorChildren(): boolean {
    return false;
  }
}

export {};

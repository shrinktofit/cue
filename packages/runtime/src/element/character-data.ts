import { CueNode, markCueNodeChanged } from './cue-node.js';

export abstract class CharacterData extends CueNode {
  constructor(data: string) {
    super();
    this.data = data;
  }

  get data(): string {
    return this.#data;
  }

  set data(value: string) {
    if (this.#data === value) return;
    const structural = /[^ \t\r\n\f]/u.test(this.#data) !== /[^ \t\r\n\f]/u.test(value);
    this.#data = value;
    markCueNodeChanged(this, structural);
  }

  #data = '';
}

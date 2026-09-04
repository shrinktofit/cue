import { CueNode } from './cue-node.js';

export abstract class CharacterData extends CueNode {
  constructor(data: string) {
    super();
    this.data = data;
  }

  data: string;
}

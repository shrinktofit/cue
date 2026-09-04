import type { CueElement } from './cue-element.js';

export abstract class CueNode {
  get parent(): CueElement | undefined {
    return this.#parent;
  }

  protected static setParent(
    node: CueNode,
    parent: CueElement | undefined,
  ): void {
    node.#parent = parent;
  }

  #parent: CueElement | undefined;
}

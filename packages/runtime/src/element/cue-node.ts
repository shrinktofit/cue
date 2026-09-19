import type { CueElement } from './cue-element.js';

let nextRevision = 0;
export let markCueNodeChanged: (node: CueNode, structural?: boolean) => void;
export let cueNodeRevision: (node: CueNode) => number;
export let cueSubtreeRevision: (node: CueNode) => number;
export let cueStructureRevision: (node: CueNode) => number;

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
  #revision = 0;
  #subtreeRevision = 0;
  #structureRevision = 0;

  static {
    cueNodeRevision = (node) => node.#revision;
    cueSubtreeRevision = (node) => node.#subtreeRevision;
    cueStructureRevision = (node) => node.#structureRevision;
    markCueNodeChanged = (node, structural = false) => {
      const revision = ++nextRevision;
      node.#revision = revision;
      for (let current: CueNode | undefined = node; current; current = current.parent) {
        current.#subtreeRevision = revision;
        if (structural) current.#structureRevision = revision;
      }
    };
  }
}

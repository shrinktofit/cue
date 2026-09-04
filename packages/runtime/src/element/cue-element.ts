import { CueNode } from './cue-node.js';

export let getCueElementProperties: (
  element: CueElement,
) => ReadonlyMap<string, unknown>;

export let patchCueElementProperty: (
  element: CueElement,
  name: string,
  previousValue: unknown,
  nextValue: unknown,
) => void;

export abstract class CueElement extends CueNode {
  constructor(readonly tagName: string) {
    super();
  }

  get children(): readonly CueNode[] {
    return this.#children;
  }

  insertBefore(child: CueNode, anchor?: CueNode): void {
    if (anchor && anchor.parent !== this) {
      throw new Error('The insertion anchor is not a child of this element.');
    }
    if (child === anchor) {
      return;
    }

    if (child instanceof CueElement) {
      if (child === this) {
        throw new Error('Cannot insert an element into itself or one of its descendants.');
      }
      let ancestor = this.parent;
      while (ancestor) {
        if (ancestor === child) {
          throw new Error('Cannot insert an element into itself or one of its descendants.');
        }
        ancestor = ancestor.parent;
      }
    }

    const currentParent = child.parent;
    if (currentParent) {
      currentParent.removeChild(child);
    }

    const insertionIndex = anchor
      ? this.#children.indexOf(anchor)
      : this.#children.length;
    this.#children.splice(insertionIndex, 0, child);
    CueElement.setParent(child, this);
  }

  removeChild(child: CueNode): void {
    const childIndex = this.#children.indexOf(child);
    if (childIndex < 0) {
      throw new Error('The node is not a child of this element.');
    }

    this.#children.splice(childIndex, 1);
    CueElement.setParent(child, undefined);
  }

  clearChildren(): void {
    for (const child of this.#children) {
      CueElement.setParent(child, undefined);
    }
    this.#children.length = 0;
  }

  readonly #children: CueNode[] = [];
  readonly #properties = new Map<string, unknown>();

  static {
    getCueElementProperties = (element) => element.#properties;
    patchCueElementProperty = (element, name, previousValue, nextValue) => {
      if (previousValue === nextValue) {
        return;
      }
      if (nextValue === undefined || nextValue === null) {
        element.#properties.delete(name);
      } else {
        element.#properties.set(name, nextValue);
      }
    };
  }
}

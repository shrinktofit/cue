// eslint-disable-next-line vue/prefer-import-from-vue -- Cue intentionally targets Vue's custom-renderer runtime.
import { createRenderer, type Renderer } from '@vue/runtime-core';
import { Comment } from '../element/comment.js';
import {
  patchCueElementProperty,
  type CueElement,
} from '../element/cue-element.js';
import type { CueNode } from '../element/cue-node.js';
import { globalElementRegistry } from '../element/global-element-registry.js';
import { Text } from '../element/text.js';

export function createCueRenderer(): Renderer<CueElement> {
  return createRenderer<CueNode, CueElement>({
    patchProp(element, name, previousValue, nextValue) {
      patchCueElementProperty(element, name, previousValue, nextValue);
    },
    insert(child, parent, anchor) {
      parent.insertBefore(child, anchor ?? undefined);
    },
    remove(child) {
      child.parent?.removeChild(child);
    },
    createElement(tagName) {
      const constructor = globalElementRegistry.get(tagName);
      if (!constructor) {
        throw new Error('Element "' + tagName + '" is not registered.');
      }
      return new constructor(tagName);
    },
    createText(text) {
      return new Text(text);
    },
    createComment(text) {
      return new Comment(text);
    },
    setText(node, text) {
      if (node instanceof Text || node instanceof Comment) {
        node.data = text;
        return;
      }
      throw new TypeError('Only text and comment nodes can receive text content.');
    },
    setElementText(element, text) {
      element.clearChildren();
      if (text.length > 0) {
        element.insertBefore(new Text(text));
      }
    },
    parentNode(node) {
      return node.parent ?? null;
    },
    nextSibling(node) {
      const parent = node.parent;
      if (!parent) {
        return null;
      }
      const nodeIndex = parent.children.indexOf(node);
      if (nodeIndex < 0) {
        throw new Error('A parented node is missing from its parent children.');
      }
      return parent.children[nodeIndex + 1] ?? null;
    },
  });
}

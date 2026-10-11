import { render } from './image-import-bindings.cc.vue.template.js';
import { isVNode, type VNode } from '@bsgames/cue';

export function runImageBindings() {
  const root = render({
    _cue_image_1: 'context text',
    _cue_image_3: 'shorthand text',
    _cue_image_4: 'escaped identifier',
  }, [], {}, {
    _cue_image_0: 'setup text',
    SlotHost: {},
  });
  const elements = root.children.filter((node: VNode) => isVNode(node) && typeof node.type !== 'symbol');
  const loop = root.children.find((node: VNode) => isVNode(node) && Array.isArray(node.children));
  const slot = elements[2].children.default({ value: 'slot text' })[0];
  return {
    setupText: elements[0].children,
    contextText: elements[1].children,
    shorthandText: elements[1].props._cue_image_3,
    escapedIdentifier: elements[1].props.title,
    loop: loop.children.map((node: VNode) => ({ src: node.props!.src, text: node.children })),
    slot: { src: slot.props.src, text: slot.children },
  };
}

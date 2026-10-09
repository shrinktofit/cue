import component from './tree-node.cc.vue.js';
import { createCueRenderer, CueElement, CueRootElement, Text } from '@bsgames/cue';

export function runComponentIdentity() {
  const root = new CueRootElement();
  const app = createCueRenderer().createApp(component, { depth: 2 });
  app.mount(root);
  const text: string[] = [];
  let element = root.children.find((child) => child instanceof CueElement);
  while (element) {
    text.push(element.children
      .filter((child) => child instanceof Text)
      .map((child) => child.data)
      .join('')
      .trim());
    element = element.children.find((child) => child instanceof CueElement);
  }
  app.unmount();
  return text;
}

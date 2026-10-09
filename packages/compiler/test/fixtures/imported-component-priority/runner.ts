import component from './tree-node.cc.vue.js';
import { createCueRenderer, CueElement, CueRootElement, Text } from '@bsgames/cue';

export function runComponentIdentity() {
  const root = new CueRootElement();
  const app = createCueRenderer().createApp(component);
  app.mount(root);
  const text = root.children
    .filter((child) => child instanceof CueElement)
    .flatMap((element) => element.children)
    .filter((child) => child instanceof Text)
    .map((child) => child.data);
  app.unmount();
  return text;
}

import component from './runtime-integration.cue.js';
import {
  CueElement,
  CueRootElement,
  createCueRenderer,
  globalElementRegistry,
  nextTick,
  Text,
  type CueNode,
} from '@bsgames/cue';

class CounterDisplayElement extends CueElement {}

function collectText(node: CueNode): string[] {
  if (node instanceof Text) {
    return node.data.length > 0
      ? [
        node.data,
      ]
      : [];
  }
  if (!(node instanceof CueElement)) {
    return [];
  }
  return node.children.flatMap((child) => collectText(child));
}

function findDirectElement(parent: CueElement, text: string): CueElement {
  const element = parent.children.find((child) => (
    child instanceof CueElement
    && collectText(child).join('') === text
  ));
  if (!(element instanceof CueElement)) {
    throw new Error('Expected a direct element containing "' + text + '".');
  }
  return element;
}

export async function runVerticalSlice() {
  globalElementRegistry.define('counter-display', CounterDisplayElement);
  const renderer = createCueRenderer();
  const root = new CueRootElement();
  const app = renderer.createApp(component);
  const exposed = app.mount(root) as unknown as {
    advance(): void;
  };
  const container = root.children[0];
  if (!(container instanceof CueElement)) {
    throw new TypeError('Expected the compiled component to render a CueElement container.');
  }
  const customElement = container.children.find(
    (child) => child instanceof CounterDisplayElement,
  );
  if (!(customElement instanceof CounterDisplayElement)) {
    throw new TypeError('Expected the compiled component to render its Custom Element.');
  }
  const componentElement = findDirectElement(container, 'count:1');
  const firstElement = findDirectElement(container, 'first');
  const secondElement = findDirectElement(container, 'second');
  const initialText = collectText(container);

  exposed.advance();
  await nextTick();

  const updatedContainer = root.children[0];
  if (!(updatedContainer instanceof CueElement)) {
    throw new TypeError('Expected the updated component to retain its CueElement container.');
  }
  const result = {
    componentElementPreserved: findDirectElement(updatedContainer, 'count:2') === componentElement,
    containerPreserved: updatedContainer === container,
    customElementPreserved: updatedContainer.children.includes(customElement),
    initialText,
    keyedElementsPreserved: (
      findDirectElement(updatedContainer, 'first') === firstElement
      && findDirectElement(updatedContainer, 'second') === secondElement
    ),
    updatedText: collectText(updatedContainer),
    rootIsEmptyAfterUnmount: false,
  };

  app.unmount();
  result.rootIsEmptyAfterUnmount = root.children.length === 0;
  return result;
}

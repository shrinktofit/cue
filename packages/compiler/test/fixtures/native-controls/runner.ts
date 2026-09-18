import component from './native-controls.cue.js';
import { CueChangeEvent, CueElement, CueInputEvent, CueKeyboardEvent, CueRootElement, createCueRenderer, nextTick } from '@bsgames/cue';

export async function runNativeControlModels() {
  const root = new CueRootElement();
  const app = createCueRenderer().createApp(component);
  const exposed = app.mount(root) as unknown as { current(): Record<string, unknown>; replace(): void };
  const container = root.children[0] as CueElement;
  const controls = container.children.filter((child): child is CueElement => child instanceof CueElement);
  const [toggle, slider, selection, text, number, lazy, button] = controls;
  const initial = exposed.current();

  text!.dispatchEvent(new CueInputEvent('composing', { isComposing: true }));
  await nextTick();
  const duringComposition = exposed.current().text;
  toggle!.dispatchEvent(new CueInputEvent(true));
  slider!.dispatchEvent(new CueInputEvent(42));
  selection!.dispatchEvent(new CueInputEvent('b'));
  text!.dispatchEvent(new CueInputEvent('edited'));
  number!.dispatchEvent(new CueInputEvent(12));
  lazy!.dispatchEvent(new CueInputEvent('uncommitted'));
  const beforeCommit = exposed.current().lazy;
  lazy!.dispatchEvent(new CueChangeEvent('committed'));
  const accepted = new CueKeyboardEvent('keydown', { key: 'Enter', ctrlKey: true });
  button!.dispatchEvent(new CueKeyboardEvent('keydown', { key: 'Tab', ctrlKey: true }));
  button!.dispatchEvent(new CueKeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, shiftKey: true }));
  button!.dispatchEvent(accepted);
  await nextTick();
  const updated = exposed.current();
  const reflected = controls.slice(0, 6).map((control) => (control as CueElement & { value: unknown }).value);

  exposed.replace();
  await nextTick();
  const externalValues = controls.slice(0, 5).map((control) => (control as CueElement & { value: unknown }).value);
  const preserved = controls.every((control) => container.children.includes(control));
  app.unmount();
  return { initial, duringComposition, beforeCommit, updated, reflected, externalValues, preserved, prevented: accepted.defaultPrevented, emptyAfterUnmount: root.children.length === 0 };
}

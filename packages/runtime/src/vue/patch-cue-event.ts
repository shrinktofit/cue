// eslint-disable-next-line vue/prefer-import-from-vue -- Cue intentionally targets Vue's custom-renderer runtime.
import { callWithAsyncErrorHandling, ErrorCodes, type ComponentInternalInstance } from '@vue/runtime-core';
import type { CueElement } from '../element/cue-element.js';
import { getCueEventDispatchState, type CueEvent } from '../input/cue-event.js';
import type { CueAddEventListenerOptions } from '../input/event-listeners.js';

type CueEventHandler = (event: CueEvent) => void;

interface CueEventInvoker {
  (event: CueEvent): void;
  value: CueEventHandler | CueEventHandler[];
}

const invokers = new WeakMap<CueElement, Map<string, CueEventInvoker>>();

export function patchCueEvent(
  element: CueElement,
  rawName: string,
  nextValue: unknown,
  parentComponent?: ComponentInternalInstance | null,
): boolean {
  if (!/^on[^a-z]/.test(rawName)) {
    return false;
  }

  const elementInvokers = invokers.get(element);
  const existingInvoker = elementInvokers?.get(rawName);
  if (nextValue !== undefined && nextValue !== null
    && typeof nextValue !== 'function'
    && !(Array.isArray(nextValue) && nextValue.every((handler) => typeof handler === 'function'))) {
    throw new TypeError(`Event property "${rawName}" must be a function or an array of functions.`);
  }
  const value = nextValue as CueEventHandler | CueEventHandler[] | undefined | null;
  if (existingInvoker && value) {
    existingInvoker.value = value;
    return true;
  }

  const options: CueAddEventListenerOptions = {};
  let name = rawName;
  let suffix: RegExpMatchArray | null;
  while ((suffix = /(Once|Passive|Capture)$/.exec(name))) {
    options[suffix[0].toLowerCase() as keyof CueAddEventListenerOptions] = true;
    name = name.slice(0, -suffix[0].length);
  }
  const type = name[2] === ':'
    ? name.slice(3)
    : name.slice(2).replace(/\B([A-Z])/g, '-$1').toLowerCase();

  if (value) {
    const invoker: CueEventInvoker = (event) => {
      const handlers = Array.isArray(invoker.value) ? [...invoker.value] : [invoker.value];
      for (const handler of handlers) {
        if (getCueEventDispatchState(event).immediatePropagationStopped) {
          break;
        }
        callWithAsyncErrorHandling(handler, parentComponent ?? null, ErrorCodes.NATIVE_EVENT_HANDLER, [event]);
      }
    };
    invoker.value = value;
    if (elementInvokers) {
      elementInvokers.set(rawName, invoker);
    } else {
      invokers.set(element, new Map([[rawName, invoker]]));
    }
    element.addEventListener(type, invoker, options);
  } else if (existingInvoker) {
    element.removeEventListener(type, existingInvoker, options);
    elementInvokers!.delete(rawName);
  }
  return true;
}

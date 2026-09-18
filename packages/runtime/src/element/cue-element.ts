import { CueNode } from './cue-node.js';
import type { CueStyle } from '../style/cue-style.js';
import { CueEvent, getCueEventDispatchState } from '../input/cue-event.js';
import {
  hasCuePointerCapture,
  releaseCuePointerCapture,
  setCuePointerCapture,
} from '../input/cue-pointer-controller.js';
import type {
  CueAddEventListenerOptions,
  CueEventListener,
  CueEventListenerOptions,
  CueEventMap,
} from '../input/event-listeners.js';

interface RegisteredCueEventListener {
  callback: CueEventListener;
  capture: boolean;
  once: boolean;
  passive: boolean;
  removed: boolean;
}

export let setCueElementClientSize: (element: CueElement, width: number, height: number) => void;

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

  readonly style: CueStyle = {};

  get clientWidth(): number {
    return this.#clientWidth;
  }

  get clientHeight(): number {
    return this.#clientHeight;
  }

  get children(): readonly CueNode[] {
    return this.#children;
  }

  setPointerCapture(pointerId: number): void {
    setCuePointerCapture(this, pointerId);
  }

  releasePointerCapture(pointerId: number): void {
    releaseCuePointerCapture(this, pointerId);
  }

  hasPointerCapture(pointerId: number): boolean {
    return hasCuePointerCapture(this, pointerId);
  }

  addEventListener<T extends keyof CueEventMap>(
    type: T,
    callback: CueEventListener<CueEventMap[T]> | undefined,
    options?: boolean | CueAddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    callback: CueEventListener | undefined,
    options?: boolean | CueAddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    callback: CueEventListener | undefined,
    options: boolean | CueAddEventListenerOptions = {},
  ): void {
    if (!callback) {
      return;
    }
    const capture = typeof options === 'boolean' ? options : options.capture ?? false;
    let listeners = this.#eventListeners.get(type);
    if (listeners?.some((listener) => listener.callback === callback && listener.capture === capture)) {
      return;
    }
    if (!listeners) {
      listeners = [];
      this.#eventListeners.set(type, listeners);
    }
    listeners.push({
      callback,
      capture,
      once: typeof options === 'boolean' ? false : options.once ?? false,
      passive: typeof options === 'boolean' ? false : options.passive ?? false,
      removed: false,
    });
  }

  removeEventListener<T extends keyof CueEventMap>(
    type: T,
    callback: CueEventListener<CueEventMap[T]> | undefined,
    options?: boolean | CueEventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    callback: CueEventListener | undefined,
    options?: boolean | CueEventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    callback: CueEventListener | undefined,
    options: boolean | CueEventListenerOptions = {},
  ): void {
    const listeners = this.#eventListeners.get(type);
    if (!listeners) {
      return;
    }
    const capture = typeof options === 'boolean' ? options : options.capture ?? false;
    const index = listeners.findIndex((listener) => listener.callback === callback && listener.capture === capture);
    if (index >= 0) {
      listeners[index]!.removed = true;
      listeners.splice(index, 1);
      if (listeners.length === 0) {
        this.#eventListeners.delete(type);
      }
    }
  }

  dispatchEvent(event: CueEvent): boolean {
    const state = getCueEventDispatchState(event);
    if (state.dispatching) {
      throw new Error('Cannot dispatch an event that is already being dispatched.');
    }
    const path: CueElement[] = [this];
    let ancestor = this.parent;
    while (ancestor) {
      path.push(ancestor);
      ancestor = ancestor.parent;
    }
    state.path = path;
    state.target = this;
    state.dispatching = true;
    try {
      for (let index = path.length - 1; index >= 0 && !state.propagationStopped; --index) {
        state.eventPhase = index === 0 ? CueEvent.AT_TARGET : CueEvent.CAPTURING_PHASE;
        path[index]!.#invokeEventListeners(event, true);
      }
      for (let index = 0; index < path.length && !state.propagationStopped; ++index) {
        if (index > 0 && !event.bubbles) {
          break;
        }
        state.eventPhase = index === 0 ? CueEvent.AT_TARGET : CueEvent.BUBBLING_PHASE;
        path[index]!.#invokeEventListeners(event, false);
      }
    } finally {
      state.currentTarget = undefined;
      state.eventPhase = CueEvent.NONE;
      state.path = [];
      state.dispatching = false;
      state.propagationStopped = false;
      state.immediatePropagationStopped = false;
      state.passive = false;
    }
    return !event.defaultPrevented;
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
  readonly #eventListeners = new Map<string, RegisteredCueEventListener[]>();
  #clientWidth = 0;
  #clientHeight = 0;

  #invokeEventListeners(event: CueEvent, capture: boolean): void {
    const state = getCueEventDispatchState(event);
    state.currentTarget = this;
    const listeners = [...(this.#eventListeners.get(event.type) ?? [])];
    for (const listener of listeners) {
      if (state.immediatePropagationStopped) {
        break;
      }
      if (listener.removed || listener.capture !== capture) {
        continue;
      }
      if (listener.once) {
        this.removeEventListener(event.type, listener.callback, listener.capture);
      }
      state.passive = listener.passive;
      try {
        if (typeof listener.callback === 'function') {
          listener.callback.call(this, event);
        } else {
          listener.callback.handleEvent(event);
        }
      } catch (error) {
        // Listener failures are reported without interrupting event propagation.
        console.error(error);
      } finally {
        state.passive = false;
      }
    }
  }

  static {
    setCueElementClientSize = (element, width, height) => {
      element.#clientWidth = width;
      element.#clientHeight = height;
    };
    getCueElementProperties = (element) => element.#properties;
    patchCueElementProperty = (element, name, previousValue, nextValue) => {
      if (name === 'style' && nextValue !== undefined && nextValue !== null) {
        throw new TypeError('Runtime CSS style bindings are unsupported. Use the typed CueElement.style API.');
      }
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

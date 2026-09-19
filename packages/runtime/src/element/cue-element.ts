import { CueNode, markCueNodeChanged } from './cue-node.js';
import { copyCueStyleValue, createCueStyle, equalCueStyleValue } from '../style/cue-style-values.js';
import type { CueStyleDeclarations } from '@bsgames/cue-style-schema';
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

export let getCueElementStates: (element: CueElement) => ReadonlySet<string>;
export let setCueElementState: (element: CueElement, state: string, active: boolean) => void;
export let getCueElementDefaultStyle: (element: CueElement) => CueStyleDeclarations | undefined;
export let setCueElementDefaultStyle: (element: CueElement, style: CueStyleDeclarations) => void;
export let setCueElementConnected: (element: CueElement, connected: boolean) => void;
export interface CueContentBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
export let getCueElementContentBox: (element: CueElement) => CueContentBox;
export let setCueElementContentBox: (element: CueElement, box: CueContentBox) => void;

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

  readonly style: CueStyle = createCueStyle(() => markCueNodeChanged(this));

  /** Value controls own their presentation children; buttons accept author content. */
  // eslint-disable-next-line @typescript-eslint/class-literal-property-style -- Subclasses override this content policy with an accessor.
  get acceptsAuthorChildren(): boolean {
    return true;
  }

  get isConnected(): boolean {
    return this.#connected;
  }

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
      // Ancestors can cancel default behavior; stopPropagation only stops listeners.
      for (const element of path) {
        if (event.defaultPrevented) {
          break;
        }
        element.defaultAction(event);
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
      const sameDocument = treeRoot(currentParent) === treeRoot(this);
      currentParent.#children.splice(currentParent.#children.indexOf(child), 1);
      markCueNodeChanged(currentParent, true);
      if (!sameDocument && child instanceof CueElement) {
        setCueElementConnected(child, false);
      }
    }

    const insertionIndex = anchor
      ? this.#children.indexOf(anchor)
      : this.#children.length;
    this.#children.splice(insertionIndex, 0, child);
    CueElement.setParent(child, this);
    markCueNodeChanged(this, true);
    if (child instanceof CueElement) {
      setCueElementConnected(child, this.#connected);
      child.#notifyReparented();
    }
  }

  removeChild(child: CueNode): void {
    const childIndex = this.#children.indexOf(child);
    if (childIndex < 0) {
      throw new Error('The node is not a child of this element.');
    }

    this.#children.splice(childIndex, 1);
    CueElement.setParent(child, undefined);
    markCueNodeChanged(this, true);
    if (child instanceof CueElement) {
      setCueElementConnected(child, false);
    }
  }

  clearChildren(): void {
    for (const child of [...this.#children]) {
      this.removeChild(child);
    }
  }

  protected propertyChanged(_name: string, _previousValue: unknown, _nextValue: unknown): void {
    // Element subclasses handle their own attribute contracts.
  }

  protected defaultAction(_event: CueEvent): void {
    // Native controls supply behavior after propagation.
  }

  protected connected(): void {
    // Custom elements may attach document-scoped resources.
  }

  protected disconnected(): void {
    // Custom elements release document-scoped resources here.
  }

  protected reparented(): void {
    // Same-document moves preserve state but can change ancestor-dependent state.
  }

  readonly #children: CueNode[] = [];
  readonly #properties = new Map<string, unknown>();
  readonly #eventListeners = new Map<string, RegisteredCueEventListener[]>();
  #clientWidth = 0;
  #clientHeight = 0;
  #connected = false;
  readonly #states = new Set<string>();
  #defaultStyle: CueStyleDeclarations | undefined;
  #contentBox: CueContentBox = { x: 0, y: 0, width: 0, height: 0 };

  #notifyReparented(): void {
    this.reparented();
    for (const child of this.#children) {
      if (child instanceof CueElement) {
        child.#notifyReparented();
      }
    }
  }

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
    getCueElementContentBox = (element) => element.#contentBox;
    setCueElementContentBox = (element, box) => {
      element.#contentBox = box;
    };
    getCueElementStates = (element) => element.#states;
    setCueElementState = (element, state, active) => {
      if (element.#states.has(state) === active) return;
      if (active) {
        element.#states.add(state);
      } else {
        element.#states.delete(state);
      }
      markCueNodeChanged(element);
    };
    getCueElementDefaultStyle = (element) => element.#defaultStyle;
    setCueElementDefaultStyle = (element, style) => {
      if (equalCueStyleValue(element.#defaultStyle, style)) return;
      element.#defaultStyle = copyCueStyleValue(style);
      markCueNodeChanged(element);
    };
    setCueElementConnected = (element, connected) => {
      if (element.#connected === connected) {
        return;
      }
      element.#connected = connected;
      if (connected) {
        element.connected();
      } else {
        element.disconnected();
      }
      for (const child of element.#children) {
        if (child instanceof CueElement) {
          setCueElementConnected(child, connected);
        }
      }
    };
    patchCueElementProperty = (element, name, previousValue, nextValue) => {
      if (name === 'style' && nextValue !== undefined && nextValue !== null) {
        throw new TypeError('Runtime CSS style bindings are unsupported. Use the typed CueElement.style API.');
      }
      if (previousValue === nextValue) {
        return;
      }
      const hadValue = element.#properties.has(name);
      const storedValue = element.#properties.get(name);
      if (nextValue === undefined || nextValue === null) {
        element.#properties.delete(name);
      } else {
        element.#properties.set(name, nextValue);
      }
      try {
        element.propertyChanged(name, previousValue, nextValue);
        markCueNodeChanged(element);
      } catch (error) {
        if (hadValue) {
          element.#properties.set(name, storedValue);
        } else {
          element.#properties.delete(name);
        }
        throw error;
      }
    };
  }
}

function treeRoot(element: CueElement): CueElement {
  let root = element;
  while (root.parent) {
    root = root.parent;
  }
  return root;
}

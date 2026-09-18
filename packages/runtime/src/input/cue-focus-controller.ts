import { CueElement, setCueElementConnected, setCueElementState } from '../element/cue-element.js';
import { CueControlElement } from '../builtin-controls/cue-control-element.js';
import { CueFocusEvent } from './cue-focus-event.js';
import { CueKeyboardEvent, type CueKeyboardEventInit } from './cue-keyboard-event.js';

const controllers = new WeakMap<CueElement, CueFocusController>();
const owners = new WeakMap<CueControlElement, CueFocusController>();

export function focusCueControl(element: CueControlElement): void {
  let root: CueElement = element;
  while (root.parent) {
    root = root.parent;
  }
  controllers.get(root)?.focus(element);
}

export function blurCueControl(element: CueControlElement): void {
  owners.get(element)?.focus(undefined);
}

export function refreshCueControlFocus(element: CueControlElement): void {
  owners.get(element)?.refreshPath();
}

export class CueFocusController {
  constructor(readonly root: CueElement, readonly onChange?: (active: CueControlElement | undefined) => void) {
    controllers.set(root, this);
    setCueElementConnected(root, true);
  }

  get activeElement(): CueControlElement | undefined {
    return this.#active;
  }

  refreshPath(): void {
    if (this.#active) {
      this.#setState(this.#active, false);
      this.#setState(this.#active, true);
    }
  }

  focus(element: CueControlElement | undefined): void {
    if (element && (element.disabled || !this.#contains(element))) {
      return;
    }
    const previous = this.#active;
    if (previous === element) {
      return;
    }
    const revision = ++this.#revision;
    this.#active = undefined;
    if (previous) {
      owners.delete(previous);
      this.#setState(previous, false);
      previous.dispatchEvent(new CueFocusEvent('blur', element));
      previous.dispatchEvent(new CueFocusEvent('focusout', element));
    }
    if (revision !== this.#revision) {
      return;
    }
    if (element && !element.disabled && this.#contains(element)) {
      this.#active = element;
      owners.set(element, this);
      this.#setState(element, true);
      element.dispatchEvent(new CueFocusEvent('focus', previous));
      if (revision === this.#revision) {
        element.dispatchEvent(new CueFocusEvent('focusin', previous));
      }
    }
    if (revision === this.#revision) {
      this.onChange?.(this.#active);
    }
  }

  handle(type: string, init: CueKeyboardEventInit): boolean {
    const active = this.#active;
    if (!active) {
      return false;
    }
    if (active.disabled || !this.#contains(active)) {
      this.focus(undefined);
      return false;
    }
    const event = new CueKeyboardEvent(type, init);
    active.dispatchEvent(event);
    if (type === 'keydown' && event.key === 'Tab' && !event.isComposing && !event.defaultPrevented) {
      this.move(event.shiftKey);
      event.preventDefault();
    }
    return event.defaultPrevented;
  }

  move(backward = false): void {
    const candidates: CueControlElement[] = [];
    const visit = (element: CueElement): void => {
      if (element instanceof CueControlElement && !element.disabled && element.tabIndex >= 0) {
        candidates.push(element);
      }
      for (const child of element.children) {
        if (child instanceof CueElement) {
          visit(child);
        }
      }
    };
    visit(this.root);
    candidates.sort((left, right) => (left.tabIndex || Infinity) - (right.tabIndex || Infinity));
    const current = this.#active ? candidates.indexOf(this.#active) : -1;
    const index = backward ? (current <= 0 ? candidates.length - 1 : current - 1) : (current + 1) % candidates.length;
    this.focus(candidates[index]);
  }

  dispose(): void {
    this.focus(undefined);
    controllers.delete(this.root);
    setCueElementConnected(this.root, false);
  }

  #active: CueControlElement | undefined;
  #revision = 0;
  #focusPath: CueElement[] = [];

  #contains(element: CueElement): boolean {
    for (let current: CueElement | undefined = element; current; current = current.parent) {
      if (current === this.root) {
        return true;
      }
    }
    return false;
  }

  #setState(element: CueElement, focused: boolean): void {
    setCueElementState(element, 'focus', focused);
    if (!focused) {
      for (const ancestor of this.#focusPath) {
        setCueElementState(ancestor, 'focus-within', false);
      }
      this.#focusPath = [];
      return;
    }
    for (let current: CueElement | undefined = element; current; current = current.parent) {
      setCueElementState(current, 'focus-within', true);
      this.#focusPath.push(current);
    }
  }
}

export {};

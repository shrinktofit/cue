import type { CueElement } from '../element/cue-element.js';
import { getCueElementStates, setCueElementClientSize, setCueElementState } from '../element/cue-element.js';
import { CuePointerEvent, type CuePointerType } from './cue-pointer-event.js';
import { cueLocalPoint, pickCueElement, type CueHitRegion } from './cue-hit-region.js';

export interface CuePointerSample {
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  type: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel';
  pointerId: number;
  pointerType: CuePointerType;
  isPrimary: boolean;
  clientX: number;
  clientY: number;
  screenX: number;
  screenY: number;
  button: number;
  buttons: number;
}

interface LocalPointerSample extends CuePointerSample {
  x: number;
  y: number;
}

interface PointerState {
  sample: LocalPointerSample;
  hoverPath: CueElement[];
  downTarget: CueElement | undefined;
  capture: CueElement | undefined;
  pendingCapture: CueElement | undefined;
  cancelling: boolean;
}

// Pointer IDs belong to the input source, not to individual documents.
const activePointers = new Map<number, CuePointerController>();

export function setCuePointerCapture(element: CueElement, pointerId: number): void {
  const controller = activePointers.get(pointerId);
  if (!controller) {
    throw new DOMException('No active pointer has this ID.', 'NotFoundError');
  }
  controller.capturePointer(element, pointerId);
}

export function releaseCuePointerCapture(element: CueElement, pointerId: number): void {
  const controller = activePointers.get(pointerId);
  if (!controller) {
    throw new DOMException('No active pointer has this ID.', 'NotFoundError');
  }
  controller.releasePointer(element, pointerId);
}

export function hasCuePointerCapture(element: CueElement, pointerId: number): boolean {
  return activePointers.get(pointerId)?.hasCapture(element, pointerId) ?? false;
}

/** Per-document pointer state. The host supplies layout-space coordinates. */
export class CuePointerController {
  constructor(readonly root: CueElement, readonly onPointerDown?: (target: CueElement | undefined) => void) {}

  setRegions(regions: readonly CueHitRegion[]): void {
    const liveElements = new Set(regions.map((region) => region.element));
    for (const region of this.#regions) {
      if (!liveElements.has(region.element)) {
        setCueElementClientSize(region.element, 0, 0);
      }
    }
    this.#regions = regions;
    for (const state of this.#pointers.values()) {
      if (state.pendingCapture && !this.#contains(state.pendingCapture)) {
        state.pendingCapture = undefined;
      }
      if (state.capture && !this.#contains(state.capture)) {
        state.capture = undefined;
        this.#dispatch(this.root, 'lostpointercapture', state);
      }
      if (state.downTarget && !this.#contains(state.downTarget)) {
        state.downTarget = undefined;
      }
      if (state.sample.pointerType === 'mouse' && !state.capture && !state.pendingCapture) {
        this.#updateHover(state, this.#pick(state.sample));
      }
    }
  }

  hasCapturedPointer(pointerId: number): boolean {
    const state = this.#pointers.get(pointerId);
    return !!(state?.capture ?? state?.pendingCapture);
  }

  capturePointer(element: CueElement, pointerId: number): void {
    if (!this.#contains(element)) {
      throw new DOMException('The element is not in the pointer document.', 'InvalidStateError');
    }
    const state = this.#pointers.get(pointerId)!;
    if (state.sample.buttons !== 0) {
      state.pendingCapture = element;
    }
  }

  releasePointer(element: CueElement, pointerId: number): void {
    const state = this.#pointers.get(pointerId)!;
    if (state.pendingCapture === element) {
      state.pendingCapture = undefined;
    }
  }

  hasCapture(element: CueElement, pointerId: number): boolean {
    return this.#pointers.get(pointerId)?.pendingCapture === element;
  }

  handle(sample: LocalPointerSample): boolean {
    let state = this.#pointers.get(sample.pointerId);
    const hit = this.#pick(sample);
    if (!state) {
      if (!hit || sample.type === 'pointerup' || sample.type === 'pointercancel') {
        return false;
      }
      state = { sample, hoverPath: [], downTarget: undefined, capture: undefined, pendingCapture: undefined, cancelling: false };
      this.#pointers.set(sample.pointerId, state);
    }
    if (state.cancelling) {
      return false;
    }
    state.sample = sample;
    this.#applyCapture(state);
    const target = state.capture ?? hit;
    if (sample.type === 'pointerdown') {
      state.downTarget = sample.button === 0 ? target : undefined;
      activePointers.set(sample.pointerId, this);
      this.#updateHover(state, target);
      if (sample.pointerType === 'touch') {
        state.pendingCapture = target;
      }
    } else if (sample.type !== 'pointercancel') {
      this.#updateHover(state, target);
    }
    if (target) {
      const allowed = this.#dispatch(target, sample.type, state);
      if (sample.type === 'pointerdown' && sample.button === 0 && allowed) {
        this.onPointerDown?.(target);
      }
    } else if (sample.type === 'pointerdown') {
      this.onPointerDown?.(undefined);
    }
    if (sample.type === 'pointerup' || sample.type === 'pointercancel') {
      const clickTarget = sample.type === 'pointerup' && sample.button === 0 && state.downTarget && target
        ? state.capture ?? commonAncestor(state.downTarget, target)
        : undefined;
      state.downTarget = undefined;
      state.pendingCapture = undefined;
      this.#applyCapture(state);
      activePointers.delete(sample.pointerId);
      if (clickTarget && this.#contains(clickTarget)) {
        this.#dispatch(clickTarget, 'click', state);
      }
      if (sample.pointerType === 'touch' || sample.type === 'pointercancel') {
        this.#updateHover(state, undefined);
        this.#pointers.delete(sample.pointerId);
      } else {
        this.#updateHover(state, hit);
      }
    }
    this.#updateActiveStates();
    return target !== undefined;
  }

  cancel(): void {
    for (const pointerId of this.#pointers.keys()) {
      this.cancelPointer(pointerId);
    }
  }

  cancelPointer(pointerId: number): void {
    const state = this.#pointers.get(pointerId);
    if (!state || state.cancelling) {
      return;
    }
    state.cancelling = true;
    const target = state.capture ?? state.downTarget;
    state.sample = { ...state.sample, button: -1, buttons: 0 };
    if (target) {
      this.#dispatch(this.#contains(target) ? target : this.root, 'pointercancel', state);
    }
    state.pendingCapture = undefined;
    this.#applyCapture(state);
    this.#updateHover(state, undefined);
    this.#pointers.delete(pointerId);
    this.#updateActiveStates();
    if (activePointers.get(pointerId) === this) {
      activePointers.delete(pointerId);
    }
  }

  readonly #pointers = new Map<number, PointerState>();
  #regions: readonly CueHitRegion[] = [];
  #activeElements = new Set<CueElement>();

  #updateActiveStates(): void {
    const next = new Set<CueElement>();
    for (const state of this.#pointers.values()) {
      for (const element of elementPath(state.downTarget)) {
        if (!getCueElementStates(element).has('disabled')) {
          next.add(element);
        }
      }
    }
    for (const element of this.#activeElements) {
      if (!next.has(element)) {
        setCueElementState(element, 'active', false);
      }
    }
    for (const element of next) {
      setCueElementState(element, 'active', true);
    }
    this.#activeElements = next;
  }

  #contains(element: CueElement): boolean {
    let ancestor: CueElement | undefined = element;
    while (ancestor) {
      if (ancestor === this.root) {
        return true;
      }
      ancestor = ancestor.parent;
    }
    return false;
  }

  #pick(sample: LocalPointerSample): CueElement | undefined {
    return pickCueElement(this.#regions, sample.x, sample.y);
  }

  #applyCapture(state: PointerState): void {
    if (state.capture === state.pendingCapture) {
      return;
    }
    const previous = state.capture;
    const next = state.pendingCapture;
    state.capture = next;
    if (previous) {
      this.#dispatch(this.#contains(previous) ? previous : this.root, 'lostpointercapture', state);
    }
    if (next) {
      this.#updateHover(state, next);
      this.#dispatch(next, 'gotpointercapture', state);
    }
  }

  #updateHover(state: PointerState, next: CueElement | undefined): void {
    const previousPath = state.hoverPath;
    const nextPath = elementPath(next);
    if (previousPath[0] === next && previousPath.every((element, index) => element === nextPath[index])) {
      return;
    }
    const previous = previousPath[0];
    state.hoverPath = nextPath;
    for (const element of previousPath) {
      if (![...this.#pointers.values()].some((pointer) => pointer.hoverPath.includes(element))) {
        setCueElementState(element, 'hover', false);
      }
    }
    for (const element of nextPath) {
      setCueElementState(element, 'hover', true);
    }
    if (previous) {
      this.#dispatch(previous, 'pointerout', state, next);
      for (const element of previousPath) {
        if (!nextPath.includes(element)) {
          this.#dispatch(element, 'pointerleave', state, next);
        }
      }
    }
    if (next) {
      this.#dispatch(next, 'pointerover', state, previous);
      for (const element of [...nextPath].reverse()) {
        if (!previousPath.includes(element)) {
          this.#dispatch(element, 'pointerenter', state, previous);
        }
      }
    }
  }

  #dispatch(target: CueElement, type: string, state: PointerState, relatedTarget?: CueElement): boolean {
    if (type === 'click' && elementPath(target).some((element) => getCueElementStates(element).has('disabled'))) {
      return false;
    }
    const region = this.#regions.find((candidate) => candidate.element === target);
    const point = region && cueLocalPoint(region, state.sample.x, state.sample.y);
    const boundary = type === 'pointerenter' || type === 'pointerleave';
    return target.dispatchEvent(new CuePointerEvent(type, {
      ...state.sample,
      bubbles: !boundary,
      cancelable: !boundary && type !== 'pointercancel' && type !== 'gotpointercapture' && type !== 'lostpointercapture',
      offsetX: point && region ? point[0] - region.borderLeft : 0,
      offsetY: point && region ? point[1] - region.borderTop : 0,
      relatedTarget,
    }));
  }
}

function elementPath(element: CueElement | undefined): CueElement[] {
  const path: CueElement[] = [];
  for (let ancestor = element; ancestor; ancestor = ancestor.parent) {
    path.push(ancestor);
  }
  return path;
}

function commonAncestor(left: CueElement, right: CueElement): CueElement | undefined {
  const rightPath = elementPath(right);
  return elementPath(left).find((element) => rightPath.includes(element));
}

export {};

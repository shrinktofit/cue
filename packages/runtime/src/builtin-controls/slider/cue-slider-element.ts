import { CueDisplay, CuePointerEvents, CuePosition } from '@bsgames/cue-style-schema';
import { setCueElementDefaultStyle } from '../../element/cue-element.js';
import type { CueEvent } from '../../input/cue-event.js';
import { CueKeyboardEvent } from '../../input/cue-keyboard-event.js';
import { CuePointerEvent } from '../../input/cue-pointer-event.js';
import { CueInputEvent, CueChangeEvent } from '../../input/cue-value-event.js';
import type { CueHitRegion } from '../../input/cue-hit-region.js';
import { Length } from '../../style/length.js';
import { createControlPart } from '../control-part.js';
import { CueControlElement } from '../cue-control-element.js';

export enum CueSliderOrientation {
  horizontal = 'horizontal',
  vertical = 'vertical',
}

const stepKeys = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End']);

export let updateCueSliderLayout: (element: CueSliderElement, regions: readonly CueHitRegion[]) => boolean;

export class CueSliderElement extends CueControlElement {
  constructor() {
    super('cue-slider');
    setCueElementDefaultStyle(this, { display: CueDisplay.block, position: CuePosition.relative, width: 240, height: 32 });
    this.insertBefore(this.#track);
    this.insertBefore(this.#fill);
    this.insertBefore(this.#thumb);
    this.#paint();
  }

  override get acceptsAuthorChildren(): boolean {
    return false;
  }

  get value(): number {
    return this.#value;
  }

  set value(value: number) {
    this.setProperty('value', value);
  }

  get min(): number {
    return this.#min;
  }

  set min(value: number) {
    this.setProperty('min', value);
  }

  get max(): number {
    return this.#max;
  }

  set max(value: number) {
    this.setProperty('max', value);
  }

  get step(): number {
    return this.#step;
  }

  set step(value: number) {
    this.setProperty('step', value);
  }

  get orientation(): CueSliderOrientation {
    return this.#orientation;
  }

  set orientation(value: CueSliderOrientation) {
    this.setProperty('orientation', value);
  }

  protected override propertyChanged(name: string, previous: unknown, next: unknown): void {
    if (name === 'disabled' && this.disabled) {
      this.#finish(false);
    }
    super.propertyChanged(name, previous, next);
    if (name === 'orientation') {
      this.#orientation = next === CueSliderOrientation.vertical ? CueSliderOrientation.vertical : CueSliderOrientation.horizontal;
    } else if (['min', 'max', 'step', 'value'].includes(name)) {
      const number = next === undefined || next === null ? undefined : Number(next);
      if (number !== undefined && !Number.isFinite(number)) {
        throw new TypeError(name + ' must be finite.');
      }
      if (name === 'min') {
        this.#min = number ?? 0;
      }
      if (name === 'max') {
        this.#max = number ?? 100;
      }
      if (name === 'step') {
        if (number !== undefined && number <= 0) {
          throw new RangeError('step must be positive.');
        }
        this.#step = number ?? 1;
      }
      this.#value = this.#snap(name === 'value' ? number ?? this.min : this.value);
    }
    this.#paint();
  }

  protected override defaultAction(event: CueEvent): void {
    super.defaultAction(event);
    if (event.type === 'blur') {
      this.#finish(true);
    }
    if (this.disabled) {
      return;
    }
    if (event instanceof CueKeyboardEvent && !event.isComposing && stepKeys.has(event.key)) {
      if (event.type === 'keydown') {
        this.#startValue ??= this.value;
        this.#edit(event.key === 'Home'
          ? this.min
          : event.key === 'End'
            ? this.max
            : this.value + (event.key === 'ArrowLeft' || event.key === 'ArrowDown' ? -this.step : this.step));
      } else if (event.type === 'keyup') {
        this.#finish(true);
      }
      event.preventDefault();
    }
    if (!(event instanceof CuePointerEvent)) {
      return;
    }
    if (event.type === 'pointerdown' && event.button === 0 && this.#pointer === undefined) {
      this.#pointer = event.pointerId;
      this.#startValue = this.value;
      this.setPointerCapture(event.pointerId);
      this.#fromPointer(event);
    } else if (event.pointerId === this.#pointer) {
      if (event.type === 'pointermove') {
        this.#fromPointer(event);
      }
      if (event.type === 'pointerup') {
        this.#fromPointer(event);
        this.#finish(true);
      }
      if (event.type === 'pointercancel' || event.type === 'lostpointercapture') {
        this.#finish(false);
      }
    }
  }

  protected override disconnected(): void {
    this.#finish(false);
    super.disconnected();
  }

  #value = 0;
  #min = 0;
  #max = 100;
  #step = 1;
  #orientation = CueSliderOrientation.horizontal;
  #pointer: number | undefined;
  #startValue: number | undefined;
  #layoutKey = '';
  #thumbWidth = 20;
  #thumbHeight = 20;
  readonly #track = createControlPart('cue-slider-track', { backgroundColor: { red: 71, green: 85, blue: 105, alpha: 1 } });
  readonly #fill = createControlPart('cue-slider-fill', { backgroundColor: { red: 56, green: 189, blue: 248, alpha: 1 } });
  readonly #thumb = createControlPart('cue-slider-thumb', {
    width: 20, height: 20, backgroundColor: { red: 255, green: 255, blue: 255, alpha: 1 },
    borderTopLeftRadius: [10, 10], borderTopRightRadius: [10, 10], borderBottomLeftRadius: [10, 10], borderBottomRightRadius: [10, 10],
  });

  #snap(value: number): number {
    const maximum = Math.max(this.min, this.max);
    const clamped = Math.min(maximum, Math.max(this.min, value));
    const stepped = this.min + Math.round((clamped - this.min) / this.step) * this.step;
    return Math.min(maximum, Math.max(this.min, Number(stepped.toPrecision(14))));
  }

  #edit(value: number): void {
    const previous = this.value;
    this.value = this.#snap(value);
    if (previous !== this.value) {
      this.dispatchEvent(new CueInputEvent(this.value));
    }
  }

  #fromPointer(event: CuePointerEvent): void {
    const vertical = this.orientation === CueSliderOrientation.vertical;
    const size = vertical ? this.clientHeight : this.clientWidth;
    const position = vertical ? size - event.offsetY : event.offsetX;
    const thumbSize = vertical ? this.#thumbHeight : this.#thumbWidth;
    this.#edit(this.min + Math.max(0, Math.min(1, (position - thumbSize / 2) / Math.max(1, size - thumbSize))) * Math.max(0, this.max - this.min));
  }

  #finish(commit: boolean): void {
    const start = this.#startValue;
    this.#startValue = undefined;
    const pointer = this.#pointer;
    this.#pointer = undefined;
    if (pointer !== undefined && this.hasPointerCapture(pointer)) {
      this.releasePointerCapture(pointer);
    }
    if (commit && start !== undefined && start !== this.value) {
      this.dispatchEvent(new CueChangeEvent(this.value));
    }
  }

  #paint(): boolean {
    const key = JSON.stringify([this.orientation, this.min, this.max, this.value, this.clientWidth, this.clientHeight, this.#thumbWidth, this.#thumbHeight]);
    if (key === this.#layoutKey) {
      return false;
    }
    this.#layoutKey = key;
    const vertical = this.orientation === CueSliderOrientation.vertical;
    const halfWidth = this.#thumbWidth / 2;
    const halfHeight = this.#thumbHeight / 2;
    const ratio = this.max > this.min ? (this.value - this.min) / (this.max - this.min) : 0;
    for (const part of [this.#track, this.#fill, this.#thumb]) {
      part.style.position = CuePosition.absolute;
      part.style.pointerEvents = CuePointerEvents.none;
    }
    Object.assign(this.#track.style, vertical
      ? { top: halfHeight, bottom: halfHeight, left: Length.percent(50), right: undefined, width: 6, height: undefined, marginLeft: -3, marginTop: 0 }
      : { top: Length.percent(50), bottom: undefined, left: halfWidth, right: halfWidth, width: undefined, height: 6, marginLeft: 0, marginTop: -3 });
    Object.assign(this.#fill.style, vertical
      ? { top: undefined, bottom: halfHeight, left: Length.percent(50), width: 6, height: Math.max(0, this.clientHeight - this.#thumbHeight) * ratio, marginLeft: -3, marginTop: 0 }
      : { top: Length.percent(50), bottom: undefined, left: halfWidth, width: Math.max(0, this.clientWidth - this.#thumbWidth) * ratio, height: 6, marginLeft: 0, marginTop: -3 });
    Object.assign(this.#thumb.style, vertical
      ? { top: undefined, bottom: Math.max(0, this.clientHeight - this.#thumbHeight) * ratio, left: Length.percent(50), marginLeft: -halfWidth, marginTop: 0 }
      : { top: Length.percent(50), bottom: undefined, left: Math.max(0, this.clientWidth - this.#thumbWidth) * ratio, marginLeft: 0, marginTop: -halfHeight });
    return true;
  }

  static {
    updateCueSliderLayout = (element, regions) => {
      const thumb = regions.find((region) => region.element === element.#thumb);
      if (thumb) {
        element.#thumbWidth = thumb.width;
        element.#thumbHeight = thumb.height;
      }
      return element.#paint();
    };
  }
}

export {};

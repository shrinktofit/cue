import { CueElement, getCueElementProperties, getCueElementStates, patchCueElementProperty, setCueElementState } from '../element/cue-element.js';
import { blurCueControl, focusCueControl, refreshCueControlFocus } from '../input/cue-focus-controller.js';
import { CuePointerEvent } from '../input/cue-pointer-event.js';
import type { CueEvent } from '../input/cue-event.js';

/** Shared focus and enabled state; each control owns its own value contract. */
export abstract class CueControlElement extends CueElement {
  constructor(tagName: string) {
    super(tagName);
    setCueElementState(this, 'enabled', true);
  }

  get disabled(): boolean {
    const value = getCueElementProperties(this).get('disabled');
    return value === '' || value === true;
  }

  set disabled(value: boolean) {
    this.setProperty('disabled', value);
  }

  get tabIndex(): number {
    const value = getCueElementProperties(this).get('tabindex') ?? getCueElementProperties(this).get('tabIndex');
    return typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : 0;
  }

  set tabIndex(value: number) {
    this.setProperty('tabindex', value);
  }

  get focused(): boolean {
    return getCueElementStates(this).has('focus');
  }

  focus(): void {
    if (!this.disabled) {
      focusCueControl(this);
    }
  }

  blur(): void {
    blurCueControl(this);
  }

  protected setProperty(name: string, value: unknown): void {
    const previous = getCueElementProperties(this).get(name);
    if (previous === value) {
      // Range/step changes can normalize an effective value without changing the
      // last author input. Reassigning that input must still apply it again.
      this.propertyChanged(name, previous, value);
    } else {
      patchCueElementProperty(this, name, previous, value);
    }
  }

  protected override propertyChanged(name: string, _previousValue: unknown, _nextValue: unknown): void {
    if (name === 'disabled') {
      setCueElementState(this, 'disabled', this.disabled);
      setCueElementState(this, 'enabled', !this.disabled);
      if (this.disabled) {
        setCueElementState(this, 'active', false);
        this.blur();
      }
    }
  }

  protected override defaultAction(event: CueEvent): void {
    if (event instanceof CuePointerEvent && event.type === 'pointerdown' && event.button === 0 && !this.disabled) {
      this.focus();
    }
  }

  protected override disconnected(): void {
    this.blur();
    setCueElementState(this, 'active', false);
  }

  protected override reparented(): void {
    refreshCueControlFocus(this);
  }
}

export {};

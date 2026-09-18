import { CueDisplay, CuePointerEvents, CuePosition } from '@bsgames/cue-style-schema';
import { setCueElementDefaultStyle, setCueElementState } from '../../element/cue-element.js';
import type { CueEvent } from '../../input/cue-event.js';
import { CueKeyboardEvent } from '../../input/cue-keyboard-event.js';
import { CueInputEvent, CueChangeEvent } from '../../input/cue-value-event.js';
import { createControlPart } from '../control-part.js';
import { CueControlElement } from '../cue-control-element.js';

export class CueToggleElement extends CueControlElement {
  constructor() {
    super('cue-toggle');
    setCueElementDefaultStyle(this, { display: CueDisplay.block, position: CuePosition.relative, width: 52, height: 30 });
    this.insertBefore(this.#track);
    this.#track.insertBefore(this.#thumb);
    this.#paint();
  }

  override get acceptsAuthorChildren(): boolean {
    return false;
  }

  get value(): boolean {
    return this.#value;
  }

  set value(value: boolean) {
    this.setProperty('value', value);
  }

  protected override propertyChanged(name: string, previous: unknown, next: unknown): void {
    super.propertyChanged(name, previous, next);
    if (name === 'value') {
      this.#value = next === true || next === '';
      this.#paint();
    }
  }

  protected override defaultAction(event: CueEvent): void {
    super.defaultAction(event);
    if (this.disabled) {
      return;
    }
    const keyboard = event instanceof CueKeyboardEvent && event.type === 'keydown' && event.key === ' ' && !event.isComposing;
    if (event.type === 'click' || (keyboard && !event.repeat)) {
      this.value = !this.value;
      this.dispatchEvent(new CueInputEvent(this.value));
      this.dispatchEvent(new CueChangeEvent(this.value));
    }
    if (keyboard) {
      event.preventDefault();
    }
  }

  #value = false;
  readonly #track = createControlPart('cue-toggle-track', {
    position: CuePosition.absolute, left: 0, right: 0, top: 0, bottom: 0,
    borderTopLeftRadius: [15, 15], borderTopRightRadius: [15, 15], borderBottomLeftRadius: [15, 15], borderBottomRightRadius: [15, 15],
  });

  readonly #thumb = createControlPart('cue-toggle-thumb', {
    position: CuePosition.absolute, top: 3, width: 24, height: 24,
    backgroundColor: { red: 255, green: 255, blue: 255, alpha: 1 },
    borderTopLeftRadius: [12, 12], borderTopRightRadius: [12, 12], borderBottomLeftRadius: [12, 12], borderBottomRightRadius: [12, 12],
  });

  #paint(): void {
    setCueElementState(this, 'checked', this.value);
    this.#thumb.style.left = this.value ? undefined : 3;
    this.#thumb.style.right = this.value ? 3 : undefined;
    setCueElementDefaultStyle(this.#track, {
      pointerEvents: CuePointerEvents.none,
      position: CuePosition.absolute, left: 0, right: 0, top: 0, bottom: 0,
      backgroundColor: this.value ? { red: 22, green: 163, blue: 116, alpha: 1 } : { red: 71, green: 85, blue: 105, alpha: 1 },
      borderTopLeftRadius: [15, 15], borderTopRightRadius: [15, 15], borderBottomLeftRadius: [15, 15], borderBottomRightRadius: [15, 15],
    });
  }
}

export {};

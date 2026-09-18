import { CueKeyboardEvent } from '../../input/cue-keyboard-event.js';
import type { CueEvent } from '../../input/cue-event.js';
import { CueInputEvent, CueChangeEvent } from '../../input/cue-value-event.js';
import { CueEditableInputElement } from '../text-input/cue-editable-input-element.js';
/** Finite decimal values; empty input is undefined, never zero or NaN. */
export class CueNumberInputElement extends CueEditableInputElement {
  constructor() {
    super('cue-number-input');
  }

  get value(): number | undefined {
    return this.#value;
  }

  set value(value: number | undefined) {
    if (this.deferValueDuringComposition(() => {
      this.value = value;
    })) {
      return;
    }
    if (value !== undefined && !Number.isFinite(value)) {
      throw new RangeError('Number input value must be finite or undefined.');
    }
    if (value === this.#value) {
      return;
    }
    this.#value = value;
    this.#committedValue = value;
    this.replaceEditingText(value === undefined ? '' : String(value));
  }

  get min(): number | undefined {
    return this.#min;
  }

  set min(value: number | undefined) {
    if (value !== undefined && !Number.isFinite(value)) {
      throw new RangeError('Number input min must be finite or undefined.');
    }
    this.#min = value;
  }

  get max(): number | undefined {
    return this.#max;
  }

  set max(value: number | undefined) {
    if (value !== undefined && !Number.isFinite(value)) {
      throw new RangeError('Number input max must be finite or undefined.');
    }
    this.#max = value;
  }

  get step(): number {
    return this.#step;
  }

  set step(value: number) {
    if (!Number.isFinite(value) || value <= 0) {
      throw new RangeError('Number input step must be finite and greater than zero.');
    }
    this.#step = value;
  }

  stepUp(count = 1): void {
    this.#stepValue(count);
  }

  stepDown(count = 1): void {
    this.#stepValue(-count);
  }

  protected override get editingInputMode(): 'decimal' {
    return 'decimal';
  }

  protected override get editingMultiline(): boolean {
    return false;
  }

  protected override get editingPassword(): boolean {
    return false;
  }

  protected override propertyChanged(name: string, previous: unknown, next: unknown): void {
    super.propertyChanged(name, previous, next);
    switch (name) {
    case 'value':
      this.value = next === undefined || next === '' ? undefined : Number(next);
      break;
    case 'min':
      this.min = next === undefined ? undefined : Number(next);
      break;
    case 'max':
      this.max = next === undefined ? undefined : Number(next);
      break;
    case 'step':
      this.step = next === undefined ? 1 : Number(next);
      break;
    }
  }

  protected override defaultAction(event: CueEvent): void {
    super.defaultAction(event);
    if (this.disabled || this.readOnly || this.composing || !(event instanceof CueKeyboardEvent)
      || event.type !== 'keydown' || event.isComposing) {
      return;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      this.#stepValue(event.key === 'ArrowUp' ? 1 : -1);
      event.preventDefault();
    }
  }

  protected override editValue(text: string, composing: boolean): void {
    if (!composing) {
      const parsed = parseNumberInput(text);
      if (parsed.valid) {
        this.#value = parsed.value;
      }
    }
    this.dispatchEvent(new CueInputEvent(this.#value, { isComposing: composing }));
  }

  protected override commitValue(): void {
    if (this.composing) {
      return;
    }
    const parsed = parseNumberInput(this.editingText);
    const value = parsed.valid ? parsed.value : this.#value;
    const clamped = value === undefined ? undefined : this.#clamp(value);
    if (clamped !== this.#value) {
      this.#value = clamped;
      this.dispatchEvent(new CueInputEvent(this.#value));
    }
    this.replaceEditingText(clamped === undefined ? '' : String(clamped));
    if (this.#committedValue !== this.#value) {
      this.#committedValue = this.#value;
      this.dispatchEvent(new CueChangeEvent(this.#value));
    }
  }

  #value: number | undefined;
  #committedValue: number | undefined;
  #min: number | undefined;
  #max: number | undefined;
  #step = 1;
  #clamp(value: number): number {
    if (this.#min !== undefined && this.#max !== undefined && this.#min > this.#max) {
      throw new RangeError('Number input min must not exceed max.');
    }
    return Math.min(this.#max ?? Infinity, Math.max(this.#min ?? -Infinity, value));
  }

  #stepValue(count: number): void {
    if (!Number.isInteger(count)) {
      throw new RangeError('Number input step count must be an integer.');
    }
    if (this.disabled || this.readOnly || this.composing) {
      return;
    }
    const origin = this.#value ?? this.#min ?? 0;
    // Decimal precision follows the actual operands, including exponent notation.
    const precision = Math.max(decimalPlaces(origin), decimalPlaces(this.#step));
    const total = scaledDecimal(origin, precision) + scaledDecimal(this.#step, precision) * BigInt(count);
    const next = this.#clamp(Number(`${total}e-${precision}`));
    if (!Number.isFinite(next)) {
      throw new RangeError('Number input stepping exceeded the finite number range.');
    }
    if (next === this.#value) {
      return;
    }
    this.#value = next;
    this.replaceEditingText(String(next));
    this.dispatchEvent(new CueInputEvent(next));
    this.commitValue();
  }
}
function parseNumberInput(text: string): {
  valid: false;
} | {
  valid: true;
  value: number | undefined;
} {
  if (text === '') {
    return { valid: true, value: undefined };
  }
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u.test(text)) {
    return { valid: false };
  }
  const value = Number(text);
  return Number.isFinite(value) ? { valid: true, value } : { valid: false };
}
function decimalPlaces(value: number): number {
  const [significand = '', exponent = '0'] = String(value).split('e');
  return Math.max(0, (significand.split('.')[1]?.length ?? 0) - Number(exponent));
}
function scaledDecimal(value: number, precision: number): bigint {
  const [significand = '', exponent = '0'] = String(value).split('e');
  const fractionalDigits = significand.split('.')[1]?.length ?? 0;
  return BigInt(significand.replace('.', '')) * 10n ** BigInt(precision + Number(exponent) - fractionalDigits);
}
export {};

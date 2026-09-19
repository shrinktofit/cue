import { CueInputEvent, CueChangeEvent } from '../../input/cue-value-event.js';
import { markCueNodeChanged } from '../../element/cue-node.js';
import { CueEditableInputElement } from './cue-editable-input-element.js';
export class CueTextInputElement extends CueEditableInputElement {
  constructor() {
    super('cue-text-input');
  }

  get value(): string {
    return this.#value;
  }

  set value(value: string) {
    if (this.deferValueDuringComposition(() => {
      this.value = value;
    })) {
      return;
    }
    const text = String(value).replace(/\r\n?/gu, '\n');
    const normalized = this.#multiline ? text : text.replaceAll('\n', '');
    if (normalized === this.#value) {
      return;
    }
    this.#value = normalized;
    this.#committedValue = normalized;
    this.replaceEditingText(normalized);
  }

  get multiline(): boolean {
    return this.#multiline;
  }

  set multiline(value: boolean) {
    if (value && this.#password) {
      throw new TypeError('A password input cannot be multiline.');
    }
    const next = Boolean(value);
    if (next === this.#multiline) return;
    this.#multiline = next;
    markCueNodeChanged(this);
    this.value = this.#value;
  }

  get password(): boolean {
    return this.#password;
  }

  set password(value: boolean) {
    if (value && this.#multiline) {
      throw new TypeError('A multiline input cannot be a password input.');
    }
    const next = Boolean(value);
    if (next === this.#password) return;
    this.#password = next;
    markCueNodeChanged(this);
  }

  protected override get editingMultiline(): boolean {
    return this.#multiline;
  }

  protected override get editingPassword(): boolean {
    return this.#password;
  }

  protected override get editingInputMode(): 'text' {
    return 'text';
  }

  protected override propertyChanged(name: string, previous: unknown, next: unknown): void {
    super.propertyChanged(name, previous, next);
    switch (name) {
    case 'value':
      if (next !== undefined && typeof next !== 'string') {
        throw new TypeError('Text input value must be a string.');
      }
      this.value = next ?? '';
      break;
    case 'multiline':
      this.multiline = next !== undefined && next !== false;
      break;
    case 'password':
      this.password = next !== undefined && next !== false;
      break;
    }
  }

  protected override editValue(text: string, composing: boolean): void {
    if (!composing) {
      this.#value = text;
    }
    this.dispatchEvent(new CueInputEvent(text, { isComposing: composing }));
  }

  protected override commitValue(): void {
    if (this.composing || this.#committedValue === this.#value) {
      return;
    }
    this.#committedValue = this.#value;
    this.dispatchEvent(new CueChangeEvent(this.#value));
  }

  #value = '';
  #committedValue = '';
  #multiline = false;
  #password = false;
}
export {};

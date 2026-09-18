import type { CueElement } from '../element/cue-element.js';
import { CueBeforeInputEvent, CueCompositionEvent } from '../input/cue-editing-event.js';
import { applyCueTextInputEdit, commitCueTextInputEdit, CueEditableInputElement, readCueTextInputState, setCueTextInputComposing, type CueTextInputState } from '../builtin-controls/text-input/cue-editable-input-element.js';
export interface CueTextInputAnchor {
  x: number;
  y: number;
  height?: number;
}
/** Web editing/IME transport only. Text, caret and selection remain Cue geometry. */
export class CueTextInputSource {
  constructor(readonly ownerDocument: Document = document) {
  }

  sync(activeElement: CueElement | undefined, anchor?: CueTextInputAnchor): void {
    const element = activeElement instanceof CueEditableInputElement && !activeElement.disabled
      ? activeElement
      : undefined;
    const state = element ? readCueTextInputState(element) : undefined;
    if (element !== this.#element || state?.multiline !== this.#multiline) {
      this.#releaseEditor();
      if (element && state) {
        this.#attachEditor(element, state.multiline);
      }
    }
    const editor = this.#editor;
    if (!editor || !state || !element) {
      return;
    }
    editor.readOnly = state.readOnly;
    editor.inputMode = state.inputMode;
    if (editor instanceof this.ownerDocument.defaultView!.HTMLInputElement) {
      editor.type = state.password ? 'password' : 'text';
    }
    if (!state.composing) {
      const valueChanged = editor.value !== state.text;
      if (valueChanged) {
        editor.value = state.text;
        this.#lastPublished = undefined;
      }
      this.#syncSelection(element, editor, state, valueChanged);
    }
    if (anchor) {
      editor.style.left = `${anchor.x}px`;
      editor.style.top = `${anchor.y}px`;
      editor.style.height = `${Math.max(1, anchor.height ?? 20)}px`;
    }
  }

  ownsTarget(target: EventTarget | null): boolean {
    return target === this.#editor;
  }

  dispose(): void {
    this.#releaseEditor();
  }

  #element: CueEditableInputElement | undefined;
  #editor: HTMLInputElement | HTMLTextAreaElement | undefined;
  #abort: AbortController | undefined;
  #multiline: boolean | undefined;
  #lastPublished: string | undefined;
  #syncedSelection: Pick<CueTextInputState, 'selectionStart' | 'selectionEnd' | 'selectionDirection'> | undefined;
  #attachEditor(element: CueEditableInputElement, multiline: boolean): void {
    const editor = multiline ? this.ownerDocument.createElement('textarea') : this.ownerDocument.createElement('input');
    this.#element = element;
    this.#editor = editor;
    this.#multiline = multiline;
    const abort = new AbortController();
    this.#abort = abort;
    const options = { signal: abort.signal };
    editor.dataset.cueEditor = '';
    editor.tabIndex = -1;
    editor.autocomplete = 'off';
    editor.autocapitalize = 'off';
    editor.spellcheck = false;
    Object.assign(editor.style, {
      position: 'fixed', left: '0', top: '0', width: '1px', height: '20px',
      opacity: '0', padding: '0', border: '0', margin: '0', pointerEvents: 'none',
      fontSize: '16px', resize: 'none', overflow: 'hidden', zIndex: '-1',
    });
    const state = readCueTextInputState(element);
    if (editor instanceof this.ownerDocument.defaultView!.HTMLInputElement) {
      editor.type = state.password ? 'password' : 'text';
    }
    editor.value = state.text;
    editor.readOnly = state.readOnly;
    editor.inputMode = state.inputMode;
    editor.setSelectionRange(state.selectionStart, state.selectionEnd, state.selectionDirection);
    this.#syncedSelection = state;
    editor.addEventListener('beforeinput', (event) => {
      const input = event as InputEvent;
      if (!element.dispatchEvent(new CueBeforeInputEvent(input.inputType, input.data ?? undefined, input.isComposing, input.cancelable))) {
        event.preventDefault();
      }
    }, options);
    editor.addEventListener('input', (event) => {
      const input = event as InputEvent;
      this.#publishEdit(input.isComposing || readCueTextInputState(element).composing);
    }, options);
    editor.addEventListener('compositionstart', (event) => {
      setCueTextInputComposing(element, true);
      element.dispatchEvent(new CueCompositionEvent('compositionstart', (event as CompositionEvent).data));
    }, options);
    editor.addEventListener('compositionupdate', (event) => {
      element.dispatchEvent(new CueCompositionEvent('compositionupdate', (event as CompositionEvent).data));
    }, options);
    editor.addEventListener('compositionend', (event) => {
      this.#publishEdit(false);
      setCueTextInputComposing(element, false);
      element.dispatchEvent(new CueCompositionEvent('compositionend', (event as CompositionEvent).data));
    }, options);
    editor.addEventListener('select', () => this.#copySelection(), options);
    this.ownerDocument.addEventListener('selectionchange', () => this.#copySelection(), options);
    editor.addEventListener('change', () => commitCueTextInputEdit(element), options);
    editor.addEventListener('blur', () => {
      if (this.#element === element) {
        if (readCueTextInputState(element).composing) {
          this.#publishEdit(false);
          setCueTextInputComposing(element, false);
        }
        commitCueTextInputEdit(element);
        element.blur();
      }
    }, options);
    this.ownerDocument.body.append(editor);
    editor.focus({ preventScroll: true });
  }

  #publishEdit(composing: boolean): void {
    const editor = this.#editor;
    const element = this.#element;
    if (!editor || !element) {
      return;
    }
    const signature = JSON.stringify([editor.value, composing]);
    if (signature === this.#lastPublished) {
      this.#copySelection();
      return;
    }
    this.#lastPublished = signature;
    applyCueTextInputEdit(element, editor.value, editor.selectionStart ?? 0, editor.selectionEnd ?? 0, composing, editor.selectionDirection ?? 'none');
  }

  #copySelection(): void {
    const editor = this.#editor;
    const element = this.#element;
    if (!editor || !element || this.ownerDocument.activeElement !== editor
      || readCueTextInputState(element).composing) {
      return;
    }
    const state = readCueTextInputState(element);
    // DOM selectionchange can be queued before an external value update is synced.
    if (editor.value !== state.text) {
      return;
    }
    this.#syncSelection(element, editor, state);
  }

  #syncSelection(element: CueEditableInputElement, editor: HTMLInputElement | HTMLTextAreaElement, state: CueTextInputState, valueChanged = false): void {
    const previous = this.#syncedSelection;
    // An explicit Cue selection (pointer, API or visual-line navigation) wins
    // over queued DOM selectionchange. Otherwise retain browser-native movement
    // even when keyup or a render frame arrives before selectionchange.
    if (!valueChanged && state.selectionStart === previous?.selectionStart
      && state.selectionEnd === previous.selectionEnd && state.selectionDirection === previous.selectionDirection) {
      element.setSelectionRange(editor.selectionStart ?? 0, editor.selectionEnd ?? 0, editor.selectionDirection ?? 'none');
      state = readCueTextInputState(element);
    }
    if (editor.selectionStart !== state.selectionStart || editor.selectionEnd !== state.selectionEnd
      || (state.selectionStart !== state.selectionEnd && editor.selectionDirection !== state.selectionDirection)) {
      editor.setSelectionRange(state.selectionStart, state.selectionEnd, state.selectionDirection);
    }
    this.#syncedSelection = state;
  }

  #releaseEditor(): void {
    const element = this.#element;
    if (element && readCueTextInputState(element).composing) {
      this.#publishEdit(false);
      setCueTextInputComposing(element, false);
    }
    this.#element = undefined;
    this.#abort?.abort();
    this.#abort = undefined;
    this.#editor?.remove();
    this.#editor = undefined;
    this.#multiline = undefined;
    this.#lastPublished = undefined;
    this.#syncedSelection = undefined;
    if (element) {
      commitCueTextInputEdit(element);
    }
  }
}
export {};

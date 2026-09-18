import { CueDisplay, CueOverflow, CueBorderStyle, CueBoxSizing, CuePointerEvents, CuePosition, CueWhiteSpace, CueTextAlign, type CueStyleSheet } from '@bsgames/cue-style-schema';
import { CueElement, getCueElementContentBox, getCueElementProperties, patchCueElementProperty, setCueElementDefaultStyle } from '../../element/cue-element.js';
import { DivElement } from '../../element/div-element.js';
import { Text } from '../../element/text.js';
import type { CueEvent } from '../../input/cue-event.js';
import { CuePointerEvent } from '../../input/cue-pointer-event.js';
import { CueKeyboardEvent } from '../../input/cue-keyboard-event.js';
import type { CueTextMeasurer } from '../../render/create-cue-paint-list.js';
import { computeCueElementStyle, type ComputedCueElementStyle } from '../../style/compute-cue-element-style.js';
import { editableTextCaret, editableTextOffsetAt, layoutEditableText, snapEditableTextOffset, type EditableTextLayout } from '../../text/editable-text-layout.js';
import { CueControlElement } from '../cue-control-element.js';
export interface CueTextInputState {
  text: string;
  selectionStart: number;
  selectionEnd: number;
  selectionDirection: 'forward' | 'backward' | 'none';
  multiline: boolean;
  password: boolean;
  readOnly: boolean;
  inputMode: 'text' | 'decimal';
  composing: boolean;
}
export let readCueTextInputState: (element: CueEditableInputElement) => CueTextInputState;
export let readCueTextInputCaretBox: (element: CueEditableInputElement) => {
  x: number;
  y: number;
  height: number;
} | undefined;
export let applyCueTextInputEdit: (element: CueEditableInputElement, text: string, selectionStart: number, selectionEnd: number, composing: boolean, selectionDirection?: 'forward' | 'backward' | 'none') => void;
export let setCueTextInputComposing: (element: CueEditableInputElement, composing: boolean) => void;
export let commitCueTextInputEdit: (element: CueEditableInputElement) => void;
export let updateCueTextInputLayout: (element: CueElement, style: ComputedCueElementStyle, measurer: CueTextMeasurer, styleSheets?: readonly CueStyleSheet[]) => boolean;
/** Shared editing state; browser input and pointer hit testing use one selection. */
export abstract class CueEditableInputElement extends CueControlElement {
  constructor(tagName: string) {
    super(tagName);
    setCueElementDefaultStyle(this, {
      display: CueDisplay.block,
      position: CuePosition.relative,
      boxSizing: CueBoxSizing.borderBox,
      width: 240,
      height: 40,
      paddingTop: 8,
      paddingRight: 8,
      paddingBottom: 8,
      paddingLeft: 8,
      backgroundColor: { red: 25, green: 36, blue: 55, alpha: 1 },
      color: { red: 235, green: 242, blue: 255, alpha: 1 },
      borderTopWidth: 1,
      borderRightWidth: 1,
      borderBottomWidth: 1,
      borderLeftWidth: 1,
      borderTopStyle: CueBorderStyle.solid,
      borderRightStyle: CueBorderStyle.solid,
      borderBottomStyle: CueBorderStyle.solid,
      borderLeftStyle: CueBorderStyle.solid,
      borderTopColor: { red: 76, green: 93, blue: 116, alpha: 1 },
      borderRightColor: { red: 76, green: 93, blue: 116, alpha: 1 },
      borderBottomColor: { red: 76, green: 93, blue: 116, alpha: 1 },
      borderLeftColor: { red: 76, green: 93, blue: 116, alpha: 1 },
    });
    patchCueElementProperty(this.#viewport, 'class', undefined, 'cue-input-viewport');
    patchCueElementProperty(this.#caret, 'class', undefined, 'cue-input-caret');
    setCueElementDefaultStyle(this.#viewport, {
      position: CuePosition.absolute,
      overflowX: CueOverflow.hidden,
      overflowY: CueOverflow.hidden,
      pointerEvents: CuePointerEvents.none,
    });
    setCueElementDefaultStyle(this.#caret, {
      position: CuePosition.absolute,
      width: 1,
      backgroundColor: { red: 235, green: 242, blue: 255, alpha: 1 },
      pointerEvents: CuePointerEvents.none,
    });
    this.#viewport.insertBefore(this.#caret);
    this.insertBefore(this.#viewport);
  }

  override get acceptsAuthorChildren(): boolean {
    return false;
  }

  get placeholder(): string {
    return this.#placeholder;
  }

  set placeholder(value: string) {
    this.#placeholder = String(value);
  }

  get readOnly(): boolean {
    return this.#readOnly;
  }

  set readOnly(value: boolean) {
    this.#readOnly = Boolean(value);
  }

  get selectionStart(): number {
    return this.#selectionStart;
  }

  get selectionEnd(): number {
    return this.#selectionEnd;
  }

  get selectionDirection(): 'forward' | 'backward' | 'none' {
    return this.#selectionDirection;
  }

  setSelectionRange(start: number, end: number, direction: 'forward' | 'backward' | 'none' = 'none'): void {
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      throw new RangeError('Selection offsets must be finite.');
    }
    const nextEnd = snapEditableTextOffset(this.#editingText, end);
    const nextStart = Math.min(nextEnd, snapEditableTextOffset(this.#editingText, start));
    const nextDirection = nextStart === nextEnd ? 'none' : direction;
    if (nextStart === this.#selectionStart && nextEnd === this.#selectionEnd
      && nextDirection === this.#selectionDirection) {
      return;
    }
    this.#selectionEnd = nextEnd;
    this.#selectionStart = nextStart;
    this.#selectionDirection = nextDirection;
    this.#lastCaretChange = Date.now();
    this.#preferredCaretX = undefined;
  }

  select(): void {
    this.setSelectionRange(0, this.#editingText.length);
  }

  protected get editingText(): string {
    return this.#editingText;
  }

  protected get composing(): boolean {
    return this.#composing;
  }

  protected abstract get editingMultiline(): boolean;
  protected abstract get editingPassword(): boolean;
  protected abstract get editingInputMode(): 'text' | 'decimal';
  protected deferValueDuringComposition(apply: () => void): boolean {
    if (!this.#composing) {
      return false;
    }
    this.#pendingValue = apply;
    return true;
  }

  protected replaceEditingText(text: string): void {
    this.#editingText = this.#normalizeText(text);
    this.setSelectionRange(this.#selectionStart, this.#selectionEnd, this.#selectionDirection);
  }

  protected abstract editValue(text: string, composing: boolean): void;
  protected abstract commitValue(): void;
  protected override propertyChanged(name: string, previous: unknown, next: unknown): void {
    super.propertyChanged(name, previous, next);
    switch (name) {
    case 'placeholder':
      if (next !== undefined && typeof next !== 'string') {
        throw new TypeError('Input placeholder must be a string.');
      }
      this.placeholder = next ?? '';
      break;
    case 'readonly':
    case 'read-only':
    case 'readOnly':
      this.readOnly = next !== undefined && next !== false;
      break;
    }
  }

  protected override defaultAction(event: CueEvent): void {
    super.defaultAction(event);
    if (event.type === 'blur') {
      if (this.#dragPointer !== undefined && this.hasPointerCapture(this.#dragPointer)) {
        this.releasePointerCapture(this.#dragPointer);
      }
      this.#dragPointer = undefined;
      if (this.#composing) {
        this.#composing = false;
        this.editValue(this.#editingText, false);
        setCueTextInputComposing(this, false);
      }
      this.commitValue();
      return;
    }
    if (this.disabled) {
      return;
    }
    if (event instanceof CueKeyboardEvent && event.type === 'keydown') {
      if (this.editingMultiline && this.#layout && !this.#composing && !event.isComposing
        && !event.ctrlKey && !event.metaKey && !event.altKey
        && ['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
        const caret = editableTextCaret(this.#layout, this.#selectionDirection === 'backward' ? this.#selectionStart : this.#selectionEnd);
        const preferredX = this.#preferredCaretX ?? caret.x;
        const line = this.#layout.lines[caret.line]!;
        const next = event.key === 'Home'
          ? line.start
          : event.key === 'End'
            ? line.end
            : editableTextOffsetAt(this.#layout, preferredX, caret.y + (event.key === 'ArrowUp' ? -1 : 1) * this.#layout.lineHeight);
        const anchor = event.shiftKey
          ? this.#selectionDirection === 'backward' ? this.#selectionEnd : this.#selectionStart
          : next;
        this.setSelectionRange(Math.min(anchor, next), Math.max(anchor, next), next < anchor ? 'backward' : 'forward');
        if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
          this.#preferredCaretX = preferredX;
        }
        event.preventDefault();
        return;
      }
      if (event.key === 'Enter' && !this.editingMultiline && !this.#composing && !event.isComposing) {
        this.commitValue();
        event.preventDefault();
      }
      return;
    }
    if (!(event instanceof CuePointerEvent)) {
      return;
    }
    if (event.type === 'pointerdown' && event.button === 0) {
      this.focus();
      this.#dragPointer = event.pointerId;
      this.#dragAnchor = this.#offsetAt(event);
      this.setSelectionRange(this.#dragAnchor, this.#dragAnchor);
      this.setPointerCapture(event.pointerId);
    } else if (event.type === 'pointermove' && this.#dragPointer === event.pointerId) {
      const offset = this.#offsetAt(event);
      this.setSelectionRange(Math.min(offset, this.#dragAnchor), Math.max(offset, this.#dragAnchor), offset < this.#dragAnchor ? 'backward' : 'forward');
    } else if ((event.type === 'pointerup' || event.type === 'pointercancel') && this.#dragPointer === event.pointerId) {
      this.#dragPointer = undefined;
      if (this.hasPointerCapture(event.pointerId)) {
        this.releasePointerCapture(event.pointerId);
      }
    }
  }

  protected override disconnected(): void {
    super.disconnected();
    this.#dragPointer = undefined;
    this.#composing = false;
    this.#pendingValue = undefined;
  }

  readonly #viewport = new DivElement();
  readonly #caret = new DivElement();
  readonly #lines: Array<{
    element: DivElement;
    text: Text;
  }> = [];

  readonly #selections: DivElement[] = [];
  #editingText = '';
  #placeholder = '';
  #readOnly = false;
  #selectionStart = 0;
  #selectionEnd = 0;
  #selectionDirection: 'forward' | 'backward' | 'none' = 'none';
  #composing = false;
  #pendingValue: (() => void) | undefined;
  #dragPointer: number | undefined;
  #dragAnchor = 0;
  #layout: EditableTextLayout | undefined;
  #scrollX = 0;
  #scrollY = 0;
  #paddingLeft = 0;
  #paddingTop = 0;
  #lastCaretChange = 0;
  #preferredCaretX: number | undefined;
  #paintKey = '';
  #normalizeText(text: string): string {
    const normalized = text.replace(/\r\n?/gu, '\n');
    return this.editingMultiline ? normalized : normalized.replaceAll('\n', '');
  }

  #offsetAt(event: CuePointerEvent): number {
    return this.#layout
      ? editableTextOffsetAt(this.#layout, event.offsetX - this.#paddingLeft + this.#scrollX, event.offsetY - this.#paddingTop + this.#scrollY)
      : 0;
  }

  #lineRecord(index: number, placeholder: boolean): { element: DivElement; text: Text } {
    const className = placeholder ? 'cue-input-text cue-input-placeholder' : 'cue-input-text';
    const defaultStyle = { position: CuePosition.absolute, whiteSpace: CueWhiteSpace.pre,
      pointerEvents: CuePointerEvents.none, cueOpacity: placeholder ? 0.55 : 1 };
    const existing = this.#lines[index];
    if (existing) {
      const previousClass = getCueElementProperties(existing.element).get('class');
      if (previousClass !== className) {
        patchCueElementProperty(existing.element, 'class', previousClass, className);
        setCueElementDefaultStyle(existing.element, defaultStyle);
      }
      return existing;
    }
    const element = new DivElement();
    const text = new Text('');
    element.insertBefore(text);
    patchCueElementProperty(element, 'class', undefined, className);
    setCueElementDefaultStyle(element, defaultStyle);
    this.#viewport.insertBefore(element, this.#caret);
    const record = { element, text };
    this.#lines.push(record);
    return record;
  }

  #updateLayout(style: ComputedCueElementStyle, measurer: CueTextMeasurer, styleSheets: readonly CueStyleSheet[]): boolean {
    const contentBox = getCueElementContentBox(this);
    this.#paddingLeft = contentBox.x;
    this.#paddingTop = contentBox.y;
    const viewportWidth = contentBox.width;
    const viewportHeight = contentBox.height;
    const showingPlaceholder = this.#editingText.length === 0 && this.#placeholder.length > 0;
    const viewportStyle = computeCueElementStyle(this.#viewport, styleSheets, style);
    const partStyle = computeCueElementStyle(this.#lineRecord(0, showingPlaceholder).element, styleSheets, viewportStyle);
    const textStyle = {
      color: partStyle.color,
      fontFamily: partStyle.fontFamily,
      fontWeight: partStyle.fontWeight,
      fontSize: partStyle.fontSize,
      lineHeight: partStyle.lineHeight,
      cueTextStrokeColor: partStyle.cueTextStrokeColor,
      cueTextStrokeWidth: partStyle.cueTextStrokeWidth,
      textAlign: partStyle.textAlign,
      whiteSpace: CueWhiteSpace.pre,
    };
    const lineHeight = measurer.layout('M', textStyle).height;
    const measure = (text: string) => measurer.layout(text, textStyle).width;
    const key = JSON.stringify([this.#editingText, this.#placeholder, this.editingMultiline,
      this.editingPassword, contentBox, style, textStyle, this.focused,
      this.#selectionStart, this.#selectionEnd, this.#selectionDirection, measurer.fontRevision,
      this.focused && this.#selectionStart === this.#selectionEnd
        ? Math.floor((Date.now() - this.#lastCaretChange) / 500) % 2
        : 0]);
    if (key === this.#paintKey) {
      return false;
    }
    this.#paintKey = key;
    this.#layout = alignEditableLayout(layoutEditableText(this.#editingText, viewportWidth, lineHeight, this.editingMultiline, this.editingPassword, measure), textStyle.textAlign, viewportWidth);
    const caret = editableTextCaret(this.#layout, this.#selectionDirection === 'backward' ? this.#selectionStart : this.#selectionEnd);
    if (this.focused) {
      this.#scrollX = Math.max(0, Math.min(this.#scrollX, caret.x));
      this.#scrollX = Math.max(this.#scrollX, caret.x + 1 - viewportWidth);
      this.#scrollY = Math.max(0, Math.min(this.#scrollY, caret.y));
      this.#scrollY = Math.max(this.#scrollY, caret.y + lineHeight - viewportHeight);
    }
    this.#scrollX = Math.min(this.#scrollX, Math.max(0, this.#layout.width + 1 - viewportWidth));
    this.#scrollY = Math.min(this.#scrollY, Math.max(0, this.#layout.height - viewportHeight));
    Object.assign(this.#viewport.style, { left: this.#paddingLeft, top: this.#paddingTop, width: viewportWidth, height: viewportHeight });
    const displayLayout = showingPlaceholder
      ? alignEditableLayout(layoutEditableText(this.#placeholder, viewportWidth, lineHeight, this.editingMultiline, false, measure), textStyle.textAlign, viewportWidth)
      : this.#layout;
    while (this.#lines.length > displayLayout.lines.length) {
      this.#viewport.removeChild(this.#lines.pop()!.element);
    }
    for (const [index, line] of displayLayout.lines.entries()) {
      const record = this.#lineRecord(index, showingPlaceholder);
      record.text.data = line.text;
      Object.assign(record.element.style, { left: -this.#scrollX, top: index * lineHeight - this.#scrollY,
        width: Math.max(line.width, viewportWidth), height: lineHeight });
    }
    for (const selection of this.#selections) {
      this.#viewport.removeChild(selection);
    }
    this.#selections.length = 0;
    if (this.focused && this.#selectionStart !== this.#selectionEnd) {
      for (const [index, line] of this.#layout.lines.entries()) {
        const start = Math.max(line.start, this.#selectionStart);
        const end = Math.min(line.end, this.#selectionEnd);
        if (start > end || this.#selectionEnd <= line.start || this.#selectionStart > line.end) {
          continue;
        }
        const left = line.positions.find((position) => position.offset === start)?.x ?? 0;
        const right = line.positions.find((position) => position.offset === end)?.x ?? line.positions.at(-1)!.x;
        const selection = new DivElement();
        patchCueElementProperty(selection, 'class', undefined, 'cue-input-selection');
        setCueElementDefaultStyle(selection, { position: CuePosition.absolute,
          backgroundColor: { red: 60, green: 125, blue: 230, alpha: 0.55 }, pointerEvents: CuePointerEvents.none });
        Object.assign(selection.style, { left: left - this.#scrollX, top: index * lineHeight - this.#scrollY,
          width: Math.max(right - left, this.#selectionEnd > line.end ? 4 : 0), height: lineHeight });
        this.#viewport.insertBefore(selection, this.#lines[0]?.element ?? this.#caret);
        this.#selections.push(selection);
      }
    }
    Object.assign(this.#caret.style, { left: caret.x - this.#scrollX, top: caret.y - this.#scrollY,
      height: lineHeight, cueOpacity: this.focused && this.#selectionStart === this.#selectionEnd
        && Math.floor((Date.now() - this.#lastCaretChange) / 500) % 2 === 0
        ? 1
        : 0 });
    return true;
  }

  static {
    readCueTextInputCaretBox = (element) => {
      if (!element.#layout) {
        return undefined;
      }
      const caret = editableTextCaret(element.#layout, element.#selectionDirection === 'backward' ? element.#selectionStart : element.#selectionEnd);
      return { x: element.#paddingLeft + caret.x - element.#scrollX,
        y: element.#paddingTop + caret.y - element.#scrollY, height: element.#layout.lineHeight };
    };
    readCueTextInputState = (element) => ({ text: element.#editingText,
      selectionStart: element.#selectionStart, selectionEnd: element.#selectionEnd,
      selectionDirection: element.#selectionDirection, multiline: element.editingMultiline,
      password: element.editingPassword, readOnly: element.readOnly,
      inputMode: element.editingInputMode, composing: element.#composing });
    applyCueTextInputEdit = (element, text, start, end, composing, direction = 'none') => {
      if (element.disabled || element.readOnly) {
        return;
      }
      element.#composing = composing;
      element.#editingText = element.#normalizeText(text);
      element.setSelectionRange(start, end, direction);
      element.editValue(element.#editingText, composing);
    };
    setCueTextInputComposing = (element, composing) => {
      element.#composing = composing;
      if (!composing && element.#pendingValue) {
        const pending = element.#pendingValue;
        element.#pendingValue = undefined;
        pending();
      }
    };
    commitCueTextInputEdit = (element) => element.commitValue();
    updateCueTextInputLayout = (element, style, measurer, styleSheets = []) => element instanceof CueEditableInputElement
      ? element.#updateLayout(style, measurer, styleSheets)
      : false;
  }
}
function alignEditableLayout(layout: EditableTextLayout, alignment: CueTextAlign, width: number): EditableTextLayout {
  return { ...layout, lines: layout.lines.map((line) => {
    const freeSpace = Math.max(0, width - line.width);
    const offset = alignment === CueTextAlign.center
      ? freeSpace / 2
      : alignment === CueTextAlign.right || alignment === CueTextAlign.end ? freeSpace : 0;
    return { ...line, positions: line.positions.map((position) => ({ ...position, x: position.x + offset })) };
  }) };
}
export {};

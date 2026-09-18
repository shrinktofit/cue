import { describe, expect, it } from 'vitest';
import { CueTextInputElement } from '../src/builtin-controls/text-input/cue-text-input-element.js';
import { CueNumberInputElement } from '../src/builtin-controls/number-input/cue-number-input-element.js';
import { CueKeyboardEvent } from '../src/input/cue-keyboard-event.js';
import { CueInputEvent, CueChangeEvent } from '../src/input/cue-value-event.js';
describe('Text input control values and selection', () => {
  it('keeps programmatic values silent and normalizes line endings according to input mode', () => {
    /// @case
    /// Application code assigns single-line and multiline values to independent inputs.
    /// @expect
    /// Input/change remain user-edit events and multiline content preserves normalized newlines.
    const single = new CueTextInputElement();
    const multiline = new CueTextInputElement();
    const events: string[] = [];
    single.addEventListener('input', () => events.push('input'));
    single.addEventListener('change', () => events.push('change'));
    single.value = 'hello\r\nworld';
    multiline.multiline = true;
    multiline.value = 'first\r\nsecond\rthird';
    expect(single.value).toBe('helloworld');
    expect(multiline.value).toBe('first\nsecond\nthird');
    expect(events).toEqual([]);
    multiline.multiline = false;
    expect(multiline.value).toBe('firstsecondthird');
  });
  it('does not position a public selection inside emoji or combining graphemes', () => {
    /// @case
    /// An application sets selection ranges through a surrogate pair, ZWJ emoji and combining accent.
    /// @expect
    /// Every endpoint lands on a full grapheme boundary, and out-of-range offsets are clamped.
    const input = new CueTextInputElement();
    input.value = 'A😀e\u0301👨‍👩‍👧‍👦Z';
    input.setSelectionRange(2, 4);
    expect([input.selectionStart, input.selectionEnd]).toEqual([3, 5]);
    input.setSelectionRange(8, 13, 'backward');
    expect([input.selectionStart, input.selectionEnd, input.selectionDirection]).toEqual([5, 16, 'backward']);
    input.setSelectionRange(-10, 999);
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, input.value.length]);
    input.value = 'new';
    expect(input.selectionEnd).toBe(3);
    input.select();
    expect([input.selectionStart, input.selectionEnd]).toEqual([0, 3]);
  });
  it('rejects contradictory password and multiline configurations', () => {
    /// @case
    /// A password input is changed to multiline and a multiline input is changed to password.
    /// @expect
    /// Neither operation silently exposes password text or drops multiline content.
    const password = new CueTextInputElement();
    password.password = true;
    expect(() => {
      password.multiline = true;
    }).toThrow('password input cannot be multiline');
    expect(password.multiline).toBe(false);
    const multiline = new CueTextInputElement();
    multiline.multiline = true;
    expect(() => {
      multiline.password = true;
    }).toThrow('multiline input cannot be a password');
    expect(multiline.password).toBe(false);
  });
});
describe('Number input value, range and keyboard contract', () => {
  it('distinguishes empty from zero and rejects non-finite values without input events', () => {
    /// @case
    /// Application code assigns undefined, zero and invalid numeric values.
    /// @expect
    /// Empty is undefined, zero remains zero, NaN/Infinity never enter the model, and assignment is silent.
    const input = new CueNumberInputElement();
    const events: string[] = [];
    input.addEventListener('input', () => events.push('input'));
    input.addEventListener('change', () => events.push('change'));
    expect(input.value).toBeUndefined();
    input.value = 0;
    expect(input.value).toBe(0);
    input.value = undefined;
    expect(input.value).toBeUndefined();
    expect(() => {
      input.value = Number.NaN;
    }).toThrow(RangeError);
    expect(() => {
      input.value = Infinity;
    }).toThrow(RangeError);
    expect(input.value).toBeUndefined();
    expect(events).toEqual([]);
  });
  it('steps decimal numbers without binary floating-point tails and clamps to bounds', () => {
    /// @case
    /// A decimal input is incremented repeatedly and then moved beyond both ends of its range.
    /// @expect
    /// Values stay exact at the declared precision and an unchanged boundary emits nothing.
    const input = new CueNumberInputElement();
    const events: Array<[
      string,
      unknown,
    ]> = [];
    input.addEventListener('input', (event) => {
      if (event instanceof CueInputEvent) {
        events.push(['input', event.value]);
      }
    });
    input.addEventListener('change', (event) => {
      if (event instanceof CueChangeEvent) {
        events.push(['change', event.value]);
      }
    });
    input.value = 0.1;
    input.min = 0;
    input.max = 0.3;
    input.step = 0.1;
    input.stepUp();
    input.stepUp();
    input.stepUp();
    expect(input.value).toBe(0.3);
    expect(events).toEqual([
      ['input', 0.2], ['change', 0.2], ['input', 0.3], ['change', 0.3],
    ]);
    input.stepDown(10);
    expect(input.value).toBe(0);
    input.step = 0.00001;
    input.stepUp(3);
    expect(input.value).toBe(0.00003);
    input.value = 0;
    input.step = 0.00000000000000001;
    input.stepUp(3);
    expect(input.value).toBe(0.00000000000000003);
  });
  it('steps on arrow keys but leaves disabled and readonly values unchanged', () => {
    /// @case
    /// The same keyboard actions target editable, readonly and disabled numeric controls.
    /// @expect
    /// Only the editable control changes, and its consumed arrow key is prevented.
    const input = new CueNumberInputElement();
    input.value = 3;
    const first = new CueKeyboardEvent('keydown', { key: 'ArrowUp' });
    input.dispatchEvent(first);
    expect(input.value).toBe(4);
    expect(first.defaultPrevented).toBe(true);
    input.readOnly = true;
    input.dispatchEvent(new CueKeyboardEvent('keydown', { key: 'ArrowUp' }));
    expect(input.value).toBe(4);
    input.readOnly = false;
    input.disabled = true;
    input.dispatchEvent(new CueKeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(input.value).toBe(4);
    input.disabled = false;
    input.dispatchEvent(new CueKeyboardEvent('keydown', { key: 'ArrowDown' }));
    expect(input.value).toBe(3);
  });
  it('does not step while IME composition owns the key', () => {
    /// @case
    /// An IME reports an ArrowUp key while choosing a candidate for a numeric input.
    /// @expect
    /// The numeric control leaves the key and its value to the composition session.
    const input = new CueNumberInputElement();
    input.value = 5;
    const event = new CueKeyboardEvent('keydown', { key: 'ArrowUp', isComposing: true });
    input.dispatchEvent(event);
    expect(input.value).toBe(5);
    expect(event.defaultPrevented).toBe(false);
  });
});

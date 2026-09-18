import { describe, expect, it } from 'vitest';
import { CueKeyboardEvent } from '../src/input/cue-keyboard-event.js';
import { CuePointerEvent } from '../src/input/cue-pointer-event.js';
import { withKeys } from '../src/vue/with-keys.js';
import { withModifiers } from '../src/vue/with-modifiers.js';

describe('Cue event modifier guards', () => {
  it('matches keyboard aliases and preserves handler results', () => {
    /// @case Enter, Escape and deletion keys are filtered by the corresponding template aliases.
    /// @expect Matching keys call the handler, nonmatching keys do not, and return values survive.
    const calls: string[] = [];
    const handle = (event: CueKeyboardEvent) => {
      calls.push(event.key);
      return event.key;
    };
    const enter = withKeys(handle, ['enter']);
    expect(enter(new CueKeyboardEvent('keydown', { key: 'Tab' }))).toBeUndefined();
    expect(enter(new CueKeyboardEvent('keydown', { key: 'Enter' }))).toBe('Enter');
    withKeys(handle, ['esc'])(new CueKeyboardEvent('keydown', { key: 'Escape' }));
    withKeys(handle, ['delete'])(new CueKeyboardEvent('keydown', { key: 'Backspace' }));
    withKeys(handle, ['delete'])(new CueKeyboardEvent('keydown', { key: 'Delete' }));
    expect(calls).toEqual(['Enter', 'Escape', 'Backspace', 'Delete']);
  });

  it('requires declared system modifiers and rejects extra modifiers with exact', () => {
    /// @case A Ctrl+Enter binding has exact and prevent guards.
    /// @expect Only Ctrl without additional system modifiers runs and prevents the event.
    const calls: string[] = [];
    const handle = withKeys(withModifiers((event: CueKeyboardEvent) => calls.push(event.key), ['ctrl', 'exact', 'prevent']), ['enter']);
    const accepted = new CueKeyboardEvent('keydown', { key: 'Enter', ctrlKey: true });
    const extra = new CueKeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, altKey: true });
    handle(new CueKeyboardEvent('keydown', { key: 'Enter' }));
    handle(extra);
    handle(accepted);
    expect(calls).toEqual(['Enter']);
    expect(extra.defaultPrevented).toBe(false);
    expect(accepted.defaultPrevented).toBe(true);
  });

  it('filters pointer button modifiers without requiring keyboard fields', () => {
    /// @case A pointerdown handler requests only the primary button.
    /// @expect A secondary-button event is ignored and the primary-button event runs.
    const buttons: number[] = [];
    const handle = withModifiers((event: CuePointerEvent) => buttons.push(event.button), ['left']);
    handle(new CuePointerEvent('pointerdown', { button: 2 }));
    handle(new CuePointerEvent('pointerdown', { button: 0 }));
    expect(buttons).toEqual([0]);
  });
});

import type { CueKeyboardEventInit } from '../input/cue-keyboard-event.js';

export interface CueKeyboardClient {
  handle(type: string, init: CueKeyboardEventInit): boolean;
  ownsTarget(target: EventTarget | null): boolean;
  blur(): void;
}

let owner: CueKeyboardClient | undefined;

/** Only the focused Cue document consumes keys; foreign DOM editors keep theirs. */
export function activateCueKeyboardSource(client: CueKeyboardClient | undefined): void {
  if (owner === client) {
    return;
  }
  const previous = owner;
  owner = undefined;
  previous?.blur();
  if (!client) {
    window.removeEventListener('keydown', handleKey, true);
    window.removeEventListener('keyup', handleKey, true);
    window.removeEventListener('focusin', handleFocus, true);
    return;
  }
  owner = client;
  window.addEventListener('keydown', handleKey, true);
  window.addEventListener('keyup', handleKey, true);
  window.addEventListener('focusin', handleFocus, true);
}

export function releaseCueKeyboardSource(client: CueKeyboardClient): void {
  if (owner === client) {
    activateCueKeyboardSource(undefined);
  }
}

function handleKey(event: KeyboardEvent): void {
  const client = owner;
  if (!client) {
    return;
  }
  const target = event.target;
  if (target instanceof HTMLElement && (target.isContentEditable || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)
    && !client.ownsTarget(target)) {
    activateCueKeyboardSource(undefined);
    return;
  }
  if (client.handle(event.type, event)) {
    event.preventDefault();
  }
  // Browser editing defaults still run unless Cue canceled the key. Cocos'
  // global key listeners must not also activate another UI beneath this control.
  event.stopPropagation();
}

function handleFocus(event: FocusEvent): void {
  if (owner && !owner.ownsTarget(event.target) && event.target instanceof HTMLElement
    && (event.target.isContentEditable || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) {
    activateCueKeyboardSource(undefined);
  }
}

export {};

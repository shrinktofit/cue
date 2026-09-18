import { CueAlignItems, CueDisplay, CueJustifyContent, CueTextAlign } from '@bsgames/cue-style-schema';
import { setCueElementDefaultStyle, setCueElementState } from '../../element/cue-element.js';
import type { CueEvent } from '../../input/cue-event.js';
import { CueKeyboardEvent } from '../../input/cue-keyboard-event.js';
import { CuePointerEvent } from '../../input/cue-pointer-event.js';
import { CueControlElement } from '../cue-control-element.js';

export class CueButtonElement extends CueControlElement {
  constructor() {
    super('cue-button');
    setCueElementDefaultStyle(this, {
      display: CueDisplay.flex, alignItems: CueAlignItems.center, justifyContent: CueJustifyContent.center,
      minWidth: 96, minHeight: 40, paddingLeft: 16, paddingRight: 16,
      backgroundColor: { red: 38, green: 99, blue: 210, alpha: 1 },
      color: { red: 255, green: 255, blue: 255, alpha: 1 }, fontSize: 16, textAlign: CueTextAlign.center,
      borderTopLeftRadius: [6, 6], borderTopRightRadius: [6, 6], borderBottomLeftRadius: [6, 6], borderBottomRightRadius: [6, 6],
    });
  }

  protected override defaultAction(event: CueEvent): void {
    super.defaultAction(event);
    if (event.type === 'blur' || event.type === 'pointercancel') {
      this.#spacePressed = false;
      setCueElementState(this, 'active', false);
    }
    if (this.disabled || !(event instanceof CueKeyboardEvent) || event.isComposing) {
      return;
    }
    if (event.type === 'keydown' && (event.key === 'Enter' || event.key === ' ')) {
      if (!event.repeat) {
        if (event.key === 'Enter') {
          this.#click();
        } else {
          this.#spacePressed = true;
          setCueElementState(this, 'active', true);
        }
      }
      event.preventDefault();
    } else if (event.type === 'keyup' && event.key === ' ' && this.#spacePressed) {
      this.#spacePressed = false;
      setCueElementState(this, 'active', false);
      this.#click();
      event.preventDefault();
    }
  }

  #spacePressed = false;

  #click(): void {
    this.dispatchEvent(new CuePointerEvent('click', { bubbles: true, cancelable: true }));
  }
}

export {};

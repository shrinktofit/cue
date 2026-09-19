import { CustomElementRegistry } from './custom-element-registry.js';
import { CueImageElement } from './cue-image-element.js';
import { DivElement } from './div-element.js';
import { SpanElement } from './span-element.js';
import { BrElement } from './br-element.js';
import { cueControlDefinitions } from '@bsgames/cue-control-schema';
import type { CueElementConstructor } from './custom-element-registry.js';
import { CueButtonElement } from '../builtin-controls/button/cue-button-element.js';
import { CueToggleElement } from '../builtin-controls/toggle/cue-toggle-element.js';
import { CueSliderElement } from '../builtin-controls/slider/cue-slider-element.js';
import { CueSelectElement } from '../builtin-controls/select/cue-select-element.js';
import { CueTextInputElement } from '../builtin-controls/text-input/cue-text-input-element.js';
import { CueNumberInputElement } from '../builtin-controls/number-input/cue-number-input-element.js';

export const globalElementRegistry = new CustomElementRegistry();

globalElementRegistry.define('div', DivElement);
globalElementRegistry.define('span', SpanElement);
globalElementRegistry.define('br', BrElement);
globalElementRegistry.define('cue-image', CueImageElement);

const controls: Record<string, CueElementConstructor> = {
  'cue-button': CueButtonElement,
  'cue-toggle': CueToggleElement,
  'cue-slider': CueSliderElement,
  'cue-select': CueSelectElement,
  'cue-text-input': CueTextInputElement,
  'cue-number-input': CueNumberInputElement,
};
for (const name of Object.keys(cueControlDefinitions)) {
  globalElementRegistry.define(name, controls[name]!);
}

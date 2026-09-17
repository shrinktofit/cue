import { CustomElementRegistry } from './custom-element-registry.js';
import { CueImageElement } from './cue-image-element.js';
import { DivElement } from './div-element.js';

export const globalElementRegistry = new CustomElementRegistry();

globalElementRegistry.define('div', DivElement);
globalElementRegistry.define('cue-image', CueImageElement);

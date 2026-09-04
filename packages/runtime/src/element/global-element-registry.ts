import { CustomElementRegistry } from './custom-element-registry.js';
import { DivElement } from './div-element.js';

export const globalElementRegistry = new CustomElementRegistry();

globalElementRegistry.define('div', DivElement);

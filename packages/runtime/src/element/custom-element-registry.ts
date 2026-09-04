import type { CueElement } from './cue-element.js';

export type CueElementConstructor = new (tagName: string) => CueElement;

export class CustomElementRegistry {
  define(tagName: string, constructor: CueElementConstructor): void {
    if (!/^[a-z][a-z0-9-]*$/.test(tagName)) {
      throw new TypeError('Element name "' + tagName + '" must use lowercase kebab-case.');
    }
    if (this.#definitions.has(tagName)) {
      throw new Error('Element "' + tagName + '" is already defined in this registry.');
    }
    this.#definitions.set(tagName, constructor);
  }

  get(tagName: string): CueElementConstructor | undefined {
    return this.#definitions.get(tagName);
  }

  readonly #definitions = new Map<string, CueElementConstructor>();
}

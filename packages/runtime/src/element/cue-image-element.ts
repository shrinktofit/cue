import {
  CueElement,
  getCueElementProperties,
} from './cue-element.js';

export let getCueImageSource: (
  element: CueImageElement,
) => string | undefined;

export class CueImageElement extends CueElement {
  constructor() {
    super('cue-image');
  }

  static {
    getCueImageSource = (element) => {
      const source = getCueElementProperties(element).get('src');
      if (source === undefined) {
        return undefined;
      }
      if (typeof source !== 'string') {
        throw new TypeError('<cue-image> src must be a string.');
      }
      return source;
    };
  }
}

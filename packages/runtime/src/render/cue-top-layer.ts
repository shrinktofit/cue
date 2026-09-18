import type { CueElement } from '../element/cue-element.js';

// Native popup presentation keeps its logical/style ancestry, but paints after
// document content without the ancestors' overflow clips.
export const cueTopLayerElements = new WeakSet<CueElement>();

export {};

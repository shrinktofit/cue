import { CueEvent } from './cue-event.js';

export interface CueWheelEventInit {
  deltaX?: number;
  deltaY?: number;
  deltaMode?: number;
  clientX?: number;
  clientY?: number;
}

export class CueWheelEvent extends CueEvent {
  constructor(init: CueWheelEventInit = {}) {
    super('wheel', { bubbles: true, cancelable: true });
    this.deltaX = init.deltaX ?? 0;
    this.deltaY = init.deltaY ?? 0;
    this.deltaMode = init.deltaMode ?? 0;
    this.clientX = init.clientX ?? 0;
    this.clientY = init.clientY ?? 0;
  }

  readonly deltaX: number;
  readonly deltaY: number;
  readonly deltaMode: number;
  readonly clientX: number;
  readonly clientY: number;
}

export {};

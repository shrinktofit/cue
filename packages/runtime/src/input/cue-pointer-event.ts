import type { CueElement } from '../element/cue-element.js';
import { CueEvent, type CueEventInit } from './cue-event.js';

export type CuePointerType = 'mouse' | 'touch' | 'pen';

export interface CuePointerEventInit extends CueEventInit {
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  pointerId?: number;
  pointerType?: CuePointerType;
  isPrimary?: boolean;
  clientX?: number;
  clientY?: number;
  offsetX?: number;
  offsetY?: number;
  button?: number;
  buttons?: number;
  relatedTarget?: CueElement | undefined;
}

export class CuePointerEvent extends CueEvent {
  constructor(type: string, init: CuePointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 0;
    this.pointerType = init.pointerType ?? 'mouse';
    this.isPrimary = init.isPrimary ?? false;
    this.clientX = init.clientX ?? 0;
    this.clientY = init.clientY ?? 0;
    this.offsetX = init.offsetX ?? 0;
    this.offsetY = init.offsetY ?? 0;
    this.button = init.button ?? 0;
    this.buttons = init.buttons ?? 0;
    this.relatedTarget = init.relatedTarget;
    this.ctrlKey = init.ctrlKey ?? false;
    this.shiftKey = init.shiftKey ?? false;
    this.altKey = init.altKey ?? false;
    this.metaKey = init.metaKey ?? false;
  }

  readonly pointerId: number;
  readonly pointerType: CuePointerType;
  readonly isPrimary: boolean;
  readonly clientX: number;
  readonly clientY: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly button: number;
  readonly buttons: number;
  readonly relatedTarget: CueElement | undefined;
  readonly ctrlKey: boolean;
  readonly shiftKey: boolean;
  readonly altKey: boolean;
  readonly metaKey: boolean;
}

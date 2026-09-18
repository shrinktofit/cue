import type { CueElement } from '../element/cue-element.js';

export interface CueEventInit {
  bubbles?: boolean;
  cancelable?: boolean;
}

interface CueEventDispatchState {
  target: CueElement | undefined;
  currentTarget: CueElement | undefined;
  eventPhase: number;
  path: readonly CueElement[];
  dispatching: boolean;
  propagationStopped: boolean;
  immediatePropagationStopped: boolean;
  passive: boolean;
}

export let getCueEventDispatchState: (event: CueEvent) => CueEventDispatchState;

export class CueEvent {
  static readonly NONE = 0;
  static readonly CAPTURING_PHASE = 1;
  static readonly AT_TARGET = 2;
  static readonly BUBBLING_PHASE = 3;

  constructor(readonly type: string, init: CueEventInit = {}) {
    this.bubbles = init.bubbles ?? false;
    this.cancelable = init.cancelable ?? false;
  }

  readonly NONE = CueEvent.NONE;
  readonly CAPTURING_PHASE = CueEvent.CAPTURING_PHASE;
  readonly AT_TARGET = CueEvent.AT_TARGET;
  readonly BUBBLING_PHASE = CueEvent.BUBBLING_PHASE;

  readonly bubbles: boolean;
  readonly cancelable: boolean;
  /** Event creation time in milliseconds since the Unix epoch. */
  readonly timeStamp = Date.now();

  get target(): CueElement | undefined {
    return this.#state.target;
  }

  get currentTarget(): CueElement | undefined {
    return this.#state.currentTarget;
  }

  get eventPhase(): number {
    return this.#state.eventPhase;
  }

  get defaultPrevented(): boolean {
    return this.#defaultPrevented;
  }

  preventDefault(): void {
    if (this.cancelable && !this.#state.passive) {
      this.#defaultPrevented = true;
    }
  }

  stopPropagation(): void {
    this.#state.propagationStopped = true;
  }

  stopImmediatePropagation(): void {
    this.#state.propagationStopped = true;
    this.#state.immediatePropagationStopped = true;
  }

  composedPath(): CueElement[] {
    return [...this.#state.path];
  }

  #defaultPrevented = false;
  readonly #state: CueEventDispatchState = {
    target: undefined,
    currentTarget: undefined,
    eventPhase: CueEvent.NONE,
    path: [],
    dispatching: false,
    propagationStopped: false,
    immediatePropagationStopped: false,
    passive: false,
  };

  static {
    getCueEventDispatchState = (event) => event.#state;
  }
}

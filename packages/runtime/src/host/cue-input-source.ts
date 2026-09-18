import { EventMouse, EventTouch, Input, input, screen, type Event } from 'cc';
import type { CuePointerSample } from '../input/cue-pointer-controller.js';
import type { CueWheelEventInit } from '../input/cue-wheel-event.js';

export interface CueInputClient {
  priority(): number;
  handle(sample: CuePointerSample, capturedOnly: boolean): boolean;
  cancelPointer(pointerId: number): void;
  cancel(): void;
  blur?(): void;
  wheel?(sample: { screenX: number; screenY: number }, event: CueWheelEventInit): boolean;
}

interface CueInputDispatcher {
  readonly priority: number;
  dispatchEvent(event: Event): boolean;
  onThrowException(): void;
}

interface NativePointerDispatch {
  event: MouseEvent | TouchEvent;
  primaryTouchId: number | undefined;
  sawMouseTouch: boolean;
  mouseTouchPassedUI: boolean;
  mouseCaptured: boolean;
  sawCocosInput: boolean;
  mouseType: CuePointerSample['type'];
  pendingUpdates: Map<number, CueInputClient>;
  pointerDownOwner?: CueInputClient;
}

const clients = new Set<CueInputClient>();
const pointerClients = new Map<number, CueInputClient>();
const nativeDispatches: NativePointerDispatch[] = [];
const latestPointerDispatches = new Map<number, NativePointerDispatch>();
const nativeEventNames = ['mousedown', 'mousemove', 'mouseup', 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'wheel'] as const;
let dispatchersRegistered = false;
let primaryTouchId: number | undefined;
let mouseButtons = 0;

/** Registers a Web mouse/touch consumer alongside the engine's native UI dispatcher. */
export function registerCueInputSource(client: CueInputClient): () => void {
  if (!dispatchersRegistered) {
    // This engine hook is omitted from creator-types, but is the input dispatcher
    // contract in cocos/input/input.ts. Engine UI is priority 1, global input is 0.
    const engineInput = input as typeof input & {
      _registerEventDispatcher(dispatcher: CueInputDispatcher): void;
    };
    engineInput._registerEventDispatcher({
      priority: 1.5,
      dispatchEvent: (event) => dispatchCueInput(event, true),
      onThrowException: cancelCueInput,
    });
    engineInput._registerEventDispatcher({
      priority: 0.5,
      dispatchEvent: (event) => dispatchCueInput(event, false),
      onThrowException: cancelCueInput,
    });
    dispatchersRegistered = true;
  }
  if (clients.size === 0) {
    for (const name of nativeEventNames) {
      window.addEventListener(name, markNativePointerDispatch, { capture: true, passive: true });
    }
    window.addEventListener('blur', cancelCueInput);
  }
  clients.add(client);
  return () => {
    if (!clients.delete(client)) {
      return;
    }
    for (const [pointerId, owner] of pointerClients) {
      if (owner === client) {
        pointerClients.delete(pointerId);
      }
    }
    client.cancel();
    if (clients.size === 0) {
      for (const name of nativeEventNames) {
        window.removeEventListener(name, markNativePointerDispatch, true);
      }
      window.removeEventListener('blur', cancelCueInput);
      nativeDispatches.length = 0;
      latestPointerDispatches.clear();
      primaryTouchId = undefined;
      mouseButtons = 0;
    }
  };
}

function markNativePointerDispatch(event: MouseEvent | TouchEvent): void {
  let mouseType: CuePointerSample['type'] = 'pointermove';
  if (!('changedTouches' in event)) {
    if (event.type === 'mousedown' && mouseButtons === 0 && event.buttons !== 0) {
      mouseType = 'pointerdown';
    } else if (event.type === 'mouseup' && mouseButtons !== 0 && event.buttons === 0) {
      mouseType = 'pointerup';
    }
    mouseButtons = event.buttons;
  }
  if ('changedTouches' in event && event.type === 'touchstart'
    && event.touches.length === event.changedTouches.length) {
    primaryTouchId = event.changedTouches[0]?.identifier;
  }
  const dispatch: NativePointerDispatch = {
    event,
    primaryTouchId,
    sawMouseTouch: false,
    mouseTouchPassedUI: false,
    mouseCaptured: false,
    sawCocosInput: false,
    mouseType,
    pendingUpdates: new Map(),
  };
  nativeDispatches.push(dispatch);
  if ('changedTouches' in event) {
    for (const touch of Array.from(event.changedTouches)) {
      latestPointerDispatches.set(touch.identifier + 2, dispatch);
    }
  } else {
    latestPointerDispatches.set(1, dispatch);
  }
  if ('changedTouches' in event && event.touches.length === 0) {
    primaryTouchId = undefined;
  }
  // A microtask runs between capture and target listeners for trusted browser
  // events. Defer to the next task so the marker remains live through Cocos.
  setTimeout(() => {
    const index = nativeDispatches.indexOf(dispatch);
    if (index >= 0) {
      nativeDispatches.splice(index, 1);
    }
    if (!dispatch.sawCocosInput && event.type === 'mousemove' && !('changedTouches' in event)
      && latestPointerDispatches.get(1) === dispatch && pointerClients.has(1)) {
      // Cocos listens for mousemove on GameCanvas only. Continue explicit Cue
      // capture outside the canvas using pal/input/web/mouse-input.ts coordinates.
      const canvas = document.getElementById('GameCanvas')!;
      const rect = canvas.getBoundingClientRect();
      const dpr = screen.devicePixelRatio;
      try {
        dispatchCueSample({
          type: 'pointermove',
          pointerId: 1,
          pointerType: 'mouse',
          isPrimary: true,
          clientX: event.clientX,
          clientY: event.clientY,
          screenX: (event.clientX - rect.x) * dpr,
          screenY: (rect.y + rect.height - event.clientY) * dpr,
          button: -1,
          buttons: event.buttons,
        }, true, dispatch);
      } catch (error) {
        cancelCueInput();
        throw error;
      }
    }
    // Native UI can swallow the engine event between our two dispatchers.
    if (event.type === 'mousedown' || event.type === 'touchstart') {
      for (const client of clients) {
        if (client !== dispatch.pointerDownOwner) {
          client.blur?.();
        }
      }
    }
    // Clear stale hover and active presses when their client was not reached.
    for (const [pointerId, owner] of dispatch.pendingUpdates) {
      if (latestPointerDispatches.get(pointerId) !== dispatch) {
        continue;
      }
      if (pointerClients.get(pointerId) === owner) {
        pointerClients.delete(pointerId);
        owner.cancelPointer(pointerId);
      } else if (clients.has(owner)) {
        owner.cancelPointer(pointerId);
      }
    }
    for (const [pointerId, latest] of latestPointerDispatches) {
      if (latest === dispatch) {
        latestPointerDispatches.delete(pointerId);
      }
    }
  }, 0);
}

function cancelCueInput(): void {
  pointerClients.clear();
  latestPointerDispatches.clear();
  primaryTouchId = undefined;
  mouseButtons = 0;
  for (const client of [...clients]) {
    client.cancel();
  }
}

function dispatchCueInput(event: Event, capturedOnly: boolean): boolean {
  if (clients.size === 0) {
    return true;
  }
  // Engine Web input dispatch is synchronous. A marker with phase NONE has
  // completed; it must never classify a later synthetic or unrelated event.
  let dispatch: NativePointerDispatch | undefined;
  for (let index = nativeDispatches.length - 1; index >= 0; --index) {
    if (nativeDispatches[index]!.event.eventPhase !== 0) {
      dispatch = nativeDispatches[index];
      break;
    }
  }
  if (!dispatch) {
    return true;
  }
  const native = dispatch.event;
  if (native.type === 'wheel' && native instanceof WheelEvent) {
    if (capturedOnly || !(event instanceof EventMouse) || event.type !== Input.EventType.MOUSE_WHEEL) {
      return true;
    }
    const location = event.getLocation();
    for (const client of [...clients].sort((left, right) => right.priority() - left.priority())) {
      if (client.wheel?.({ screenX: location.x, screenY: location.y }, native)) {
        if (native.cancelable) {
          native.preventDefault();
        }
        return false;
      }
    }
    return true;
  }
  let sample: CuePointerSample;
  let mouseTouch = false;
  if (!('changedTouches' in native)) {
    if (!(event instanceof EventMouse || event instanceof EventTouch)) {
      return true;
    }
    const type = dispatch.mouseType;
    const matchingType = native.type === 'mousedown'
      ? [Input.EventType.MOUSE_DOWN, Input.EventType.TOUCH_START]
      : native.type === 'mouseup'
        ? [Input.EventType.MOUSE_UP, Input.EventType.TOUCH_END]
        : [Input.EventType.MOUSE_MOVE, Input.EventType.TOUCH_MOVE];
    if (!matchingType.includes(event.type as Input.EventType)) {
      return true;
    }
    mouseTouch = event instanceof EventTouch;
    if (mouseTouch) {
      dispatch.sawMouseTouch = true;
      if (!capturedOnly) {
        dispatch.mouseTouchPassedUI = true;
        return true;
      }
    } else if (dispatch.mouseCaptured) {
      return false;
    } else if (!capturedOnly && dispatch.sawMouseTouch && !dispatch.mouseTouchPassedUI) {
      return true;
    }
    const location = event.getLocation();
    sample = {
      type,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      clientX: native.clientX,
      clientY: native.clientY,
      screenX: location.x,
      screenY: location.y,
      button: native.type === 'mousemove' ? -1 : native.button,
      buttons: native.buttons,
      ctrlKey: native.ctrlKey, shiftKey: native.shiftKey, altKey: native.altKey, metaKey: native.metaKey,
    };
  } else {
    if (!(event instanceof EventTouch)) {
      return true;
    }
    const type = native.type === 'touchstart'
      ? 'pointerdown'
      : native.type === 'touchmove'
        ? 'pointermove'
        : native.type === 'touchend' ? 'pointerup' : 'pointercancel';
    const matchingType = type === 'pointerdown'
      ? Input.EventType.TOUCH_START
      : type === 'pointermove'
        ? Input.EventType.TOUCH_MOVE
        : type === 'pointerup' ? Input.EventType.TOUCH_END : Input.EventType.TOUCH_CANCEL;
    if (event.type !== matchingType) {
      return true;
    }
    const identifier = event.getID();
    const touch = Array.from(native.changedTouches).find((candidate) => candidate.identifier === identifier);
    if (!touch) {
      return true;
    }
    const location = event.getLocation();
    sample = {
      type,
      pointerId: touch.identifier + 2,
      pointerType: 'touch',
      isPrimary: touch.identifier === dispatch.primaryTouchId,
      clientX: touch.clientX,
      clientY: touch.clientY,
      screenX: location.x,
      screenY: location.y,
      button: type === 'pointermove' ? -1 : 0,
      buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1,
      ctrlKey: native.ctrlKey, shiftKey: native.shiftKey, altKey: native.altKey, metaKey: native.metaKey,
    };
  }
  dispatch.sawCocosInput = true;
  const continueDispatch = dispatchCueSample(sample, capturedOnly, dispatch);
  if (mouseTouch && !continueDispatch) {
    dispatch.mouseCaptured = true;
  }
  return continueDispatch;
}

function dispatchCueSample(
  sample: CuePointerSample,
  capturedOnly: boolean,
  dispatch: NativePointerDispatch,
): boolean {
  const terminal = sample.type === 'pointerup' || sample.type === 'pointercancel';
  const owner = pointerClients.get(sample.pointerId);
  if (capturedOnly && owner) {
    dispatch.pendingUpdates.set(sample.pointerId, owner);
  }
  const orderedClients = [...clients].sort((left, right) => right.priority() - left.priority());
  for (const client of orderedClients) {
    if (!clients.has(client)) {
      continue;
    }
    const handled = client.handle(sample, capturedOnly);
    if (owner === client && (!capturedOnly || handled)) {
      dispatch.pendingUpdates.delete(sample.pointerId);
      if (terminal && (sample.pointerType === 'touch' || sample.type === 'pointercancel')) {
        pointerClients.delete(sample.pointerId);
      }
    }
    if (handled) {
      if (sample.type === 'pointerdown') {
        dispatch.pointerDownOwner = client;
        if (dispatch.event.cancelable) {
          dispatch.event.preventDefault();
        }
      }
      if (owner && owner !== client) {
        dispatch.pendingUpdates.delete(sample.pointerId);
        owner.cancelPointer(sample.pointerId);
      }
      if (clients.has(client) && (!terminal || (sample.pointerType === 'mouse' && sample.type !== 'pointercancel'))) {
        pointerClients.set(sample.pointerId, client);
      }
      return false;
    }
  }
  return true;
}

import { describe, expect, it, vi } from 'vitest';
import {
  CueElement,
  CueEvent,
  CuePointerEvent,
  CueRootElement,
  DivElement,
  createCueRenderer,
  h,
} from '../src/index.js';

describe('Cue event propagation through the public element tree', () => {
  it('captures from the root, invokes the target, and bubbles back to the root', () => {
    /// @case
    /// Root, parent, and target each register capture and bubble listeners.
    /// @expect
    /// Every listener observes the original target, its current element, and the standard phase.
    const root = new CueRootElement();
    const parent = new DivElement();
    const target = new DivElement();
    root.insertBefore(parent);
    parent.insertBefore(target);
    const calls: Array<[CueElement, number, CueElement | undefined, CueElement[]]> = [];
    for (const element of [root, parent, target]) {
      for (const capture of [true, false]) {
        element.addEventListener('sample', function (event) {
          calls.push([this, event.eventPhase, event.target, event.composedPath()]);
        }, capture);
      }
    }
    const event = new CueEvent('sample', { bubbles: true });

    expect(target.dispatchEvent(event)).toBe(true);

    expect(calls).toEqual([
      [root, 1, target, [target, parent, root]],
      [parent, 1, target, [target, parent, root]],
      [target, 2, target, [target, parent, root]],
      [target, 2, target, [target, parent, root]],
      [parent, 3, target, [target, parent, root]],
      [root, 3, target, [target, parent, root]],
    ]);
    expect(event.currentTarget).toBeUndefined();
    expect(event.eventPhase).toBe(CueEvent.NONE);
    expect(event.target).toBe(target);
    expect(event.composedPath()).toEqual([]);
    expect(Number.isFinite(event.timeStamp)).toBe(true);
  });

  it('captures a non-bubbling event and still invokes both target listener groups', () => {
    /// @case
    /// A non-bubbling event is dispatched at an attached child.
    /// @expect
    /// Ancestor capture and target capture/bubble listeners run, while ancestor bubble listeners do not.
    const root = new CueRootElement();
    const target = new DivElement();
    root.insertBefore(target);
    const calls: string[] = [];
    root.addEventListener('sample', () => calls.push('root capture'), true);
    root.addEventListener('sample', () => calls.push('root bubble'));
    target.addEventListener('sample', () => calls.push('target capture'), true);
    target.addEventListener('sample', () => calls.push('target bubble'));

    target.dispatchEvent(new CueEvent('sample'));

    expect(calls).toEqual(['root capture', 'target capture', 'target bubble']);
  });

  it('retains the dispatch path when a listener reparents the target', () => {
    /// @case
    /// A root capture listener moves the target into a different tree and edits its returned path copy.
    /// @expect
    /// Remaining listeners and composedPath retain the original tree for this dispatch only.
    const root = new CueRootElement();
    const otherRoot = new CueRootElement();
    const target = new DivElement();
    root.insertBefore(target);
    const calls: CueElement[] = [];
    let path: CueElement[] = [];
    root.addEventListener('sample', (event) => {
      otherRoot.insertBefore(target);
      event.composedPath().length = 0;
    }, { capture: true, once: true });
    root.addEventListener('sample', () => calls.push(root));
    otherRoot.addEventListener('sample', () => calls.push(otherRoot));
    target.addEventListener('sample', (event) => {
      path = event.composedPath();
    });

    target.dispatchEvent(new CueEvent('sample', { bubbles: true }));

    expect(path).toEqual([target, root]);
    expect(calls).toEqual([root]);
    target.dispatchEvent(new CueEvent('sample', { bubbles: true }));
    expect(path).toEqual([target, otherRoot]);
    expect(calls).toEqual([root, otherRoot]);
  });

  it('stops traversal after the current listener group without skipping its remaining listeners', () => {
    /// @case
    /// The first root capture listener stops propagation and a second root capture listener remains.
    /// @expect
    /// Both current capture listeners run but the target and subsequent bubble traversal do not.
    const root = new CueRootElement();
    const target = new DivElement();
    root.insertBefore(target);
    const calls: string[] = [];
    root.addEventListener('sample', (event) => {
      calls.push('first');
      event.stopPropagation();
    }, true);
    root.addEventListener('sample', () => calls.push('second'), true);
    target.addEventListener('sample', () => calls.push('target'));
    root.addEventListener('sample', () => calls.push('bubble'));

    target.dispatchEvent(new CueEvent('sample', { bubbles: true }));

    expect(calls).toEqual(['first', 'second']);
  });

  it('stops remaining listeners immediately and permits later reuse of the same event', () => {
    /// @case
    /// A once listener stops immediate propagation before another listener, then the same event is dispatched again.
    /// @expect
    /// The first dispatch skips remaining listeners and the second starts with cleared stop flags.
    const target = new DivElement();
    const calls: string[] = [];
    target.addEventListener('sample', (event) => {
      calls.push('first');
      event.stopImmediatePropagation();
    }, { once: true });
    target.addEventListener('sample', () => calls.push('second'));
    const event = new CueEvent('sample');

    target.dispatchEvent(event);
    target.dispatchEvent(event);

    expect(calls).toEqual(['first', 'second']);
  });

  it('deduplicates callbacks by capture and honors removals during dispatch', () => {
    /// @case
    /// A listener removes a pending callback and adds another callback while its listener group runs.
    /// @expect
    /// Removed callbacks are skipped, added callbacks wait for the next group, and duplicate registrations run once.
    const target = new DivElement();
    const calls: string[] = [];
    const removed = () => calls.push('removed');
    const added = () => calls.push('added');
    const first = () => {
      calls.push('first');
      target.removeEventListener('sample', removed);
      target.addEventListener('sample', added);
    };
    target.addEventListener('sample', first);
    target.addEventListener('sample', first, { once: true });
    target.addEventListener('sample', removed);

    target.dispatchEvent(new CueEvent('sample'));
    expect(calls).toEqual(['first']);
    target.dispatchEvent(new CueEvent('sample'));
    expect(calls).toEqual(['first', 'first', 'added']);

    target.addEventListener('sample', added, true);
    target.removeEventListener('sample', added, true);
    target.dispatchEvent(new CueEvent('sample'));
    expect(calls).toEqual(['first', 'first', 'added', 'first', 'added']);
  });

  it('removes once listeners before nested dispatch and supports listener objects', () => {
    /// @case
    /// A once listener recursively dispatches a different event instance of the same type.
    /// @expect
    /// The once callback cannot recur and listener objects retain their own receiver.
    const target = new DivElement();
    const calls: string[] = [];
    const object = {
      count: 0,
      handleEvent() {
        this.count += 1;
        calls.push('object');
      },
    };
    target.addEventListener('sample', () => {
      calls.push('once');
      target.dispatchEvent(new CueEvent('sample'));
    }, { once: true });
    target.addEventListener('sample', object);

    target.dispatchEvent(new CueEvent('sample'));

    expect(calls).toEqual(['once', 'object', 'object']);
    expect(object.count).toBe(2);
  });

  it('cancels only cancelable events outside passive listeners', () => {
    /// @case
    /// A passive listener attempts cancellation before a non-passive listener attempts it.
    /// @expect
    /// The passive attempt has no effect; dispatch returns false only when a cancelable event is canceled.
    const target = new DivElement();
    const observed: boolean[] = [];
    target.addEventListener('sample', (event) => {
      event.preventDefault();
      observed.push(event.defaultPrevented);
    }, { passive: true });
    target.addEventListener('sample', (event) => event.preventDefault());
    const cancelable = new CueEvent('sample', { cancelable: true });
    const noncancelable = new CueEvent('sample');

    expect(target.dispatchEvent(cancelable)).toBe(false);
    expect(target.dispatchEvent(noncancelable)).toBe(true);
    expect(observed).toEqual([false, false]);
    expect(cancelable.defaultPrevented).toBe(true);
    expect(noncancelable.defaultPrevented).toBe(false);
  });

  it('rejects concurrent reuse while reporting listener failures and continuing dispatch', () => {
    /// @case
    /// A listener attempts to dispatch the same event again while another listener remains.
    /// @expect
    /// The illegal nested dispatch is reported and the remaining listener still runs with valid state.
    const target = new DivElement();
    const errors = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const calls: number[] = [];
    target.addEventListener('sample', (event) => target.dispatchEvent(event), { once: true });
    target.addEventListener('sample', (event) => calls.push(event.eventPhase));
    const event = new CueEvent('sample');
    try {
      expect(target.dispatchEvent(event)).toBe(true);
      expect(errors).toHaveBeenCalledOnce();
      expect(errors.mock.calls[0]?.[0]).toEqual(new Error('Cannot dispatch an event that is already being dispatched.'));
      expect(calls).toEqual([CueEvent.AT_TARGET]);
      expect(event.currentTarget).toBeUndefined();
    } finally {
      errors.mockRestore();
    }
  });

  it('provides pointer coordinates, buttons, identity, and related targets to typed listeners', () => {
    /// @case
    /// A pointer event is dispatched with host coordinates and boundary information.
    /// @expect
    /// The listener receives all supplied metrics unchanged as a CueEvent subclass.
    const target = new DivElement();
    const relatedTarget = new DivElement();
    const event = new CuePointerEvent('pointerdown', {
      pointerId: 7,
      pointerType: 'touch',
      isPrimary: true,
      clientX: 120,
      clientY: 60,
      offsetX: 20,
      offsetY: 10,
      button: 0,
      buttons: 1,
      relatedTarget,
    });
    let received: number[] = [];
    target.addEventListener('pointerdown', (pointer) => {
      received = [pointer.pointerId, pointer.clientX, pointer.clientY, pointer.offsetX, pointer.offsetY, pointer.button, pointer.buttons];
    });

    target.dispatchEvent(event);

    expect(received).toEqual([7, 120, 60, 20, 10, 0, 1]);
    expect(event).toBeInstanceOf(CueEvent);
    expect(event.pointerType).toBe('touch');
    expect(event.isPrimary).toBe(true);
    expect(event.relatedTarget).toBe(relatedTarget);
    expect(target.clientWidth).toBe(0);
    expect(target.clientHeight).toBe(0);
  });
});

describe('Vue event properties on public Cue renderer elements', () => {
  it('reports sync and async handler failures through the owning app and continues the handler array', async () => {
    /// @case
    /// A mounted component registers throwing, asynchronously rejecting, and succeeding click handlers in one array.
    /// @expect
    /// Both failures reach app.config.errorHandler with the owning component, and the final callback still runs.
    const root = new CueRootElement();
    const calls: string[] = [];
    const syncError = new Error('synchronous handler failure');
    const asyncError = new Error('asynchronous handler failure');
    const reported: Array<{ error: unknown; instance: unknown; info: string }> = [];
    const app = createCueRenderer().createApp({
      render: () => h('div', {
        onClick: [
          () => {
            calls.push('sync');
            throw syncError;
          },
          () => {
            calls.push('async');
            return Promise.reject(asyncError);
          },
          () => calls.push('later'),
        ],
      }),
    });
    app.config.errorHandler = (error, instance, info) => reported.push({ error, instance, info });
    const instance = app.mount(root);
    const target = root.children[0] as CueElement;
    try {
      target.dispatchEvent(new CuePointerEvent('click'));
      await Promise.resolve();

      expect(calls).toEqual(['sync', 'async', 'later']);
      expect(reported).toEqual([
        { error: syncError, instance, info: 'native event handler' },
        { error: asyncError, instance, info: 'native event handler' },
      ]);
    } finally {
      app.unmount();
    }
  });

  it('updates a stable invoker in place and removes it when the property disappears', () => {
    /// @case
    /// A rendered handler is replaced between dispatches, then removed from the vnode.
    /// @expect
    /// Updated handlers retain their registration order and removed handlers no longer run.
    const root = new CueRootElement();
    const renderer = createCueRenderer();
    const calls: string[] = [];
    renderer.render(h('div', { onPointerdown: () => calls.push('old') }), root);
    const target = root.children[0] as CueElement;
    target.addEventListener('pointerdown', () => calls.push('native'));
    target.dispatchEvent(new CuePointerEvent('pointerdown'));

    renderer.render(h('div', { onPointerdown: () => calls.push('new') }), root);
    target.dispatchEvent(new CuePointerEvent('pointerdown'));
    renderer.render(h('div'), root);
    target.dispatchEvent(new CuePointerEvent('pointerdown'));

    expect(root.children[0]).toBe(target);
    expect(calls).toEqual(['old', 'native', 'new', 'native', 'native']);
  });

  it('supports capture, once, passive, and stopImmediatePropagation inside handler arrays', () => {
    /// @case
    /// A parent uses a combined modifier name while its child uses a handler array that stops immediately.
    /// @expect
    /// The parent captures once without canceling, and the child stops later handlers and ancestor bubbling.
    const root = new CueRootElement();
    const renderer = createCueRenderer();
    const calls: string[] = [];
    renderer.render(h('div', {
      onPointerdownOnceCapturePassive: (event: CueEvent) => {
        calls.push('capture');
        event.preventDefault();
      },
      onPointerdown: () => calls.push('parent'),
    }, [h('div', {
      onPointerdown: [
        (event: CueEvent) => {
          calls.push('child');
          event.stopImmediatePropagation();
        },
        () => calls.push('skipped'),
      ],
    })]), root);
    const parent = root.children[0] as CueElement;
    const target = parent.children[0] as CueElement;

    expect(target.dispatchEvent(new CuePointerEvent('pointerdown', { bubbles: true, cancelable: true }))).toBe(true);
    target.dispatchEvent(new CuePointerEvent('pointerdown', { bubbles: true }));

    expect(calls).toEqual(['capture', 'child', 'child']);
  });
});

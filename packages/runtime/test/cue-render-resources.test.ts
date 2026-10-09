import { beforeEach, describe, expect, it, vi } from 'vitest';

interface TestEffect {
  refCount: number;
  addRef(): TestEffect;
  decRef(): TestEffect;
}

type CompleteEffect = (error: Error | null, effect?: TestEffect) => void;

const state = vi.hoisted(() => ({
  editorNotInPreview: false,
  error: vi.fn(),
  initializeLayout: vi.fn(),
  loadAny: vi.fn(),
  requests: new Map<string, CompleteEffect>(),
}));

vi.mock('cc', () => ({ assetManager: { loadAny: state.loadAny }, error: state.error }));
vi.mock('cc/env', () => ({
  get EDITOR_NOT_IN_PREVIEW() {
    return state.editorNotInPreview;
  },
}));
vi.mock('../src/render/create-cue-paint-list.js', () => ({
  initializeCueLayout: state.initializeLayout,
}));

let completeLayout: () => void;
let failLayout: (cause: Error) => void;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  state.editorNotInPreview = false;
  state.requests.clear();
  state.loadAny.mockImplementation((uuid: string, complete: CompleteEffect) => {
    state.requests.set(uuid, complete);
  });
  state.initializeLayout.mockReturnValue(new Promise<void>((resolve, reject) => {
    completeLayout = resolve;
    failLayout = reject;
  }));
});

function createEffect(): TestEffect {
  return {
    refCount: 0,
    addRef() {
      ++this.refCount;
      return this;
    },
    decRef() {
      --this.refCount;
      return this;
    },
  };
}

async function waitForLoads(): Promise<void> {
  await vi.waitFor(() => {
    expect(state.requests.size).toBe(4);
    expect(state.initializeLayout).toHaveBeenCalledOnce();
  });
}

describe('shared rendering resource initialization', () => {
  it('waits for every effect and layout before exposing retained shared resources', async () => {
    /// @case
    /// A host is imported while effects and the layout engine are still loading.
    /// @expect
    /// Each successful effect is retained once; import still waits for every dependency.
    let imported = false;
    const loading = import('../src/host/cue-render-resources.js').then((module) => {
      imported = true;
      return module;
    });
    await waitForLoads();
    expect(imported).toBe(false);

    const effects = Array.from(state.requests, ([uuid, complete]) => ({
      uuid,
      complete,
      effect: createEffect(),
    }));
    completeLayout();
    for (const entry of effects.slice(0, -1)) {
      entry.complete(null, entry.effect);
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(imported).toBe(false);
    expect(effects.map(({ effect }) => effect.refCount)).toEqual([
      1,
      1,
      1,
      0,
    ]);

    const last = effects.at(-1)!;
    last.complete(null, last.effect);
    const { cueRenderResources } = await loading;
    expect(cueRenderResources).toEqual({
      backgroundEffect: effects[0]!.effect,
      roundedRectEffect: effects[1]!.effect,
      shadowEffect: effects[2]!.effect,
      textureEffect: effects[3]!.effect,
    });
    expect(effects.map(({ uuid }) => uuid)).toEqual([
      '03694e23-1b5a-4ccd-bf09-94fc7ad3179b',
      'bf6467ca-3f41-4b99-8e47-2cc57ddd8cc2',
      '9c30a019-03ef-4c31-afc9-e4638e951c29',
      '74b6f3ad-ccf0-4ff7-8a19-173225147c3a',
    ]);
    expect(effects.map(({ effect }) => effect.refCount)).toEqual([
      1,
      1,
      1,
      1,
    ]);

    const second = await import('../src/host/cue-render-resources.js');
    expect(second.cueRenderResources).toBe(cueRenderResources);
    expect(state.loadAny).toHaveBeenCalledTimes(4);
    expect(state.initializeLayout).toHaveBeenCalledOnce();
    expect(effects.map(({ effect }) => effect.refCount)).toEqual([
      1,
      1,
      1,
      1,
    ]);
  });

  it('also waits for layout when all effects have finished loading', async () => {
    /// @case
    /// Every effect is ready but layout initialization is still pending.
    /// @expect
    /// The importing module cannot run until layout becomes usable.
    let imported = false;
    const loading = import('../src/host/cue-render-resources.js').then((module) => {
      imported = true;
      return module;
    });
    await waitForLoads();
    for (const complete of state.requests.values()) {
      complete(null, createEffect());
    }
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(imported).toBe(false);
    completeLayout();
    expect((await loading).cueRenderResources).toBeDefined();
  });

  it('skips effect loading and layout initialization outside editor preview', async () => {
    /// @case
    /// The editor imports component definitions outside game preview.
    /// @expect
    /// Import succeeds without requesting rendering resources or initializing layout.
    state.editorNotInPreview = true;
    const { cueRenderResources } = await import('../src/host/cue-render-resources.js');
    expect(cueRenderResources).toEqual({});
    expect(state.loadAny).not.toHaveBeenCalled();
    expect(state.initializeLayout).not.toHaveBeenCalled();
  });

  it('keeps successful effects usable when another effect fails', async () => {
    /// @case
    /// One shared effect fails while the other dependencies load successfully.
    /// @expect
    /// Import succeeds with the other retained effects, and the failed field is absent.
    const cause = new Error('Effect load failed');
    let imported = false;
    const loading = import('../src/host/cue-render-resources.js').then((module) => {
      imported = true;
      return module;
    });
    await waitForLoads();
    const effects = Array.from(state.requests.values(), () => createEffect());
    const requests = Array.from(state.requests.values());
    requests[0]!(cause);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(imported).toBe(false);
    for (const [index, complete] of requests.entries()) {
      if (index > 0) {
        complete(null, effects[index]);
      }
    }
    completeLayout();
    const { cueRenderResources } = await loading;
    expect(cueRenderResources).toEqual({
      roundedRectEffect: effects[1],
      shadowEffect: effects[2],
      textureEffect: effects[3],
    });
    expect(cueRenderResources.backgroundEffect).toBeUndefined();
    expect(state.error).toHaveBeenCalledWith(expect.stringContaining('backgroundEffect'), cause);
    expect(effects.map(({ refCount }) => refCount)).toEqual([
      0,
      1,
      1,
      1,
    ]);
  });

  it('releases even later effects when the required layout engine fails', async () => {
    /// @case
    /// Layout fails while some shared effects are still loading.
    /// @expect
    /// Import waits for outstanding loads, releases their references, and rejects with the error.
    const cause = new Error('Layout initialization failed');
    const rejected = expect(import('../src/host/cue-render-resources.js')).rejects.toBe(cause);
    await waitForLoads();
    const effects = Array.from(state.requests.values(), () => createEffect());
    const requests = Array.from(state.requests.values());
    requests[0]!(null, effects[0]);
    failLayout(cause);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    expect(effects[0]!.refCount).toBe(1);
    for (const [index, complete] of requests.entries()) {
      if (index > 0) {
        complete(null, effects[index]);
      }
    }
    await rejected;
    expect(effects.map(({ refCount }) => refCount)).toEqual([
      0,
      0,
      0,
      0,
    ]);
  });
});

export {};

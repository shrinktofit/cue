import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { TTFFont } from 'cc';
import { loadCueFont } from '../src/host/load-cue-font.js';

vi.mock('cc', () => ({
  assetManager: {},
  TTFFont: class {
    _nativeAsset = 'project-font_LABEL';
    refCount = 0;

    addRef(): void {
      ++this.refCount;
    }

    decRef(): void {
      --this.refCount;
    }
  },
}));

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadCueFont asset ownership and readiness', () => {
  it('returns a usable font only after the browser has loaded it and retains it until disposed', async () => {
    /// @case
    /// A component acquires a TTF while the browser is still loading its font face.
    /// @expect
    /// Acquisition waits for readiness, and disposing the handle releases only its owned reference.
    let markReady!: (faces: FontFace[]) => void;
    const ready = new Promise<FontFace[]>((resolve) => {
      markReady = resolve;
    });
    vi.stubGlobal('document', {
      fonts: {
        load: () => ready,
      },
    });
    const asset = new TTFFont();
    asset.addRef();
    let completed = false;
    const loading = loadCueFont(asset).then((font) => {
      completed = true;
      return font;
    });
    await Promise.resolve();
    expect(completed).toBe(false);
    expect(asset.refCount).toBe(2);

    markReady([{} as FontFace]);
    const font = await loading;
    expect(font.fontFamily).toBe('project-font_LABEL');
    expect(asset.refCount).toBe(2);
    font.dispose();
    expect(asset.refCount).toBe(1);
    font.dispose();
    expect(asset.refCount).toBe(1);
  });

  it.each([
    { nativeFamily: '"Project Font_LABEL"', family: 'Project Font_LABEL' },
    { nativeFamily: '03fd-project-font_LABEL', family: '03fd-project-font_LABEL' },
  ])('returns one raw family name for $nativeFamily', async ({ nativeFamily, family }) => {
    /// @case
    /// Cocos provides a quoted generated family containing spaces or an unquoted UUID-prefixed family.
    /// @expect
    /// The typed style API receives the actual single family name; browser loading receives a quoted CSS value.
    const load = vi.fn(() => Promise.resolve([{} as FontFace]));
    vi.stubGlobal('document', { fonts: { load } });
    const asset = new TTFFont();
    asset._nativeAsset = nativeFamily;

    const font = await loadCueFont(asset);

    expect(font.fontFamily).toBe(family);
    expect(load).toHaveBeenCalledWith(`16px ${JSON.stringify(family)}`);
    font.dispose();
    expect(asset.refCount).toBe(0);
  });

  it('surfaces a failed browser font load and releases its asset reference', async () => {
    /// @case
    /// A TTF asset exists but its browser font download fails.
    /// @expect
    /// Acquisition rejects with the actual error and leaves no retained reference.
    const cause = new Error('Font download failed');
    vi.stubGlobal('document', {
      fonts: {
        load: () => Promise.reject(cause),
      },
    });
    const asset = new TTFFont();
    await expect(loadCueFont(asset)).rejects.toBe(cause);
    expect(asset.refCount).toBe(0);
  });
});

export {};

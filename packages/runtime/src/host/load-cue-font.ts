import {
  assetManager,
  TTFFont,
} from 'cc';

/** A retained Cocos font, ready for Canvas measurement and rendering. */
export interface CueFont {
  /** The single family name to use in a typed style's fontFamily array. */
  readonly fontFamily: string;
  /** Release Cue's asset reference after the font's UI has been unmounted. */
  dispose(): void;
}

export let cueFontRevision = 0;

/** Load an imported TTF by asset UUID, or retain an already loaded TTFFont. */
export async function loadCueFont(source: TTFFont | string): Promise<CueFont> {
  const font = typeof source === 'string'
    ? await new Promise<TTFFont>((resolve, reject) => {
      assetManager.loadAny<TTFFont>(source, (error, asset) => {
        if (error) {
          reject(error);
        } else {
          resolve(asset);
        }
      });
    })
    : source;
  if (!(font instanceof TTFFont)) {
    throw new Error('Cue text requires a Cocos TTFFont asset.');
  }
  font.addRef();
  try {
    const nativeFontFamily = font._nativeAsset;
    if (!nativeFontFamily) {
      throw new Error('The Cocos TTFFont has no loaded font family.');
    }
    // Cocos getFontFamily wraps generated names containing spaces in double
    // quotes. Strip that loader wrapper; the typed API carries a name, not CSS.
    const fontFamily = nativeFontFamily.startsWith('"') && nativeFontFamily.endsWith('"')
      ? nativeFontFamily.slice(1, -1)
      : nativeFontFamily;
    // Browser font loading still consumes CSS, including for UUID-prefixed names.
    const faces = await document.fonts.load(`16px ${JSON.stringify(fontFamily)}`);
    if (faces.length === 0) {
      throw new Error(`The Cocos font family ${fontFamily} is not registered in this document.`);
    }
    ++cueFontRevision;
    let disposed = false;
    return {
      dispose() {
        if (!disposed) {
          disposed = true;
          font.decRef();
          ++cueFontRevision;
        }
      },
      fontFamily,
    };
  } catch (cause) {
    font.decRef();
    throw cause;
  }
}

export {};

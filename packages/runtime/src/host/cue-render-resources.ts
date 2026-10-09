import { assetManager, type EffectAsset } from 'cc';
import { EDITOR_NOT_IN_PREVIEW } from 'cc/env';
import { initializeCueLayout } from '../render/create-cue-paint-list.js';

export const cueRenderResources = await loadCueRenderResources();

async function loadCueRenderResources() {
  if (EDITOR_NOT_IN_PREVIEW) {
    return undefined;
  }

  const [
    backgroundEffect,
    roundedRectEffect,
    shadowEffect,
    textureEffect,
  ]
    = await Promise.all([
      loadEffect('03694e23-1b5a-4ccd-bf09-94fc7ad3179b'),
      loadEffect('bf6467ca-3f41-4b99-8e47-2cc57ddd8cc2'),
      loadEffect('9c30a019-03ef-4c31-afc9-e4638e951c29'),
      loadEffect('74b6f3ad-ccf0-4ff7-8a19-173225147c3a'),
      initializeCueLayout(),
    ]);

  // These effects belong to the module, so scene unloading must not release them.
  for (const effect of [
    backgroundEffect,
    roundedRectEffect,
    shadowEffect,
    textureEffect,
  ]) {
    effect.addRef();
  }

  return {
    backgroundEffect,
    roundedRectEffect,
    shadowEffect,
    textureEffect,
  } as const;
}

function loadEffect(uuid: string): Promise<EffectAsset> {
  return new Promise((resolve, reject) => {
    assetManager.loadAny<EffectAsset>(uuid, (error, asset) => {
      if (error) {
        reject(error);
      } else {
        resolve(asset);
      }
    });
  });
}

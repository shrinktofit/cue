import { assetManager, error, type EffectAsset } from 'cc';
import { EDITOR_NOT_IN_PREVIEW } from 'cc/env';
import { initializeCueLayout } from '../render/create-cue-paint-list.js';

const cueEffectUuids = {
  backgroundEffect: '03694e23-1b5a-4ccd-bf09-94fc7ad3179b',
  roundedRectEffect: 'bf6467ca-3f41-4b99-8e47-2cc57ddd8cc2',
  shadowEffect: '9c30a019-03ef-4c31-afc9-e4638e951c29',
  textureEffect: '74b6f3ad-ccf0-4ff7-8a19-173225147c3a',
} as const;

export const cueRenderResources = await loadCueRenderResources();

async function loadCueRenderResources() {
  const resources: Partial<Record<keyof typeof cueEffectUuids, EffectAsset>> = {};
  if (EDITOR_NOT_IN_PREVIEW) {
    return resources;
  }

  const pending = [initializeCueLayout()];
  for (const [key, uuid] of Object.entries(cueEffectUuids)) {
    pending.push(loadEffect(uuid).then((effect) => {
      // Each successful effect belongs to the module, independently of the others.
      effect.addRef();
      resources[key as keyof typeof cueEffectUuids] = effect;
    }).catch((cause: unknown) => {
      error(`Failed to load Cue rendering effect ${key} (${uuid}).`, cause);
    }));
  }

  const [layout] = await Promise.allSettled(pending);
  if (layout?.status === 'rejected') {
    // Layout is required for every renderer; a failed import cannot own these effects.
    for (const effect of Object.values(resources)) {
      effect.decRef();
    }
    throw layout.reason;
  }
  return resources;
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

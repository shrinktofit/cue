import type { CueElement } from '../element/cue-element.js';
import type { CueAffineTransform } from '../render/cue-affine-transform.js';

export interface CueHitShape {
  x: number;
  y: number;
  width: number;
  height: number;
  transform: CueAffineTransform;
  radii: readonly [readonly [number, number], readonly [number, number], readonly [number, number], readonly [number, number]];
}

export interface CueHitRegion extends CueHitShape {
  element: CueElement;
  clips: readonly CueHitShape[];
  enabled: boolean;
  borderLeft: number;
  borderTop: number;
}

export function cueLocalPoint(shape: CueHitShape, x: number, y: number): readonly [number, number] | undefined {
  const [a, b, c, d, e, f] = shape.transform;
  const determinant = a * d - b * c;
  if (determinant === 0) {
    return undefined;
  }
  return [
    (d * (x - e) - c * (y - f)) / determinant - shape.x,
    (a * (y - f) - b * (x - e)) / determinant - shape.y,
  ];
}

export function pickCueElement(regions: readonly CueHitRegion[], x: number, y: number): CueElement | undefined {
  for (let index = regions.length - 1; index >= 0; index -= 1) {
    const region = regions[index]!;
    if (region.enabled && contains(region, x, y) && region.clips.every((clip) => contains(clip, x, y))) {
      return region.element;
    }
  }
  return undefined;
}

function contains(shape: CueHitShape, x: number, y: number): boolean {
  const point = cueLocalPoint(shape, x, y);
  if (!point || shape.width <= 0 || shape.height <= 0) {
    return false;
  }
  const [localX, localY] = point;
  if (localX < 0 || localY < 0 || localX > shape.width || localY > shape.height) {
    return false;
  }
  const [tl, tr, br, bl] = shape.radii;
  // A zero radius sum puts no constraint on the other corners.
  const factor = Math.min(1, ...[
    [shape.width, tl[0] + tr[0]], [shape.width, bl[0] + br[0]],
    [shape.height, tl[1] + bl[1]], [shape.height, tr[1] + br[1]],
  ].filter((pair) => pair[1]! > 0).map((pair) => pair[0]! / pair[1]!));
  for (const [index, radius] of shape.radii.entries()) {
    const rx = radius[0] * factor;
    const ry = radius[1] * factor;
    const cx = index === 0 || index === 3 ? rx : shape.width - rx;
    const cy = index < 2 ? ry : shape.height - ry;
    const cornerX = index === 0 || index === 3 ? localX < cx : localX > cx;
    const cornerY = index < 2 ? localY < cy : localY > cy;
    if (rx > 0 && ry > 0 && cornerX && cornerY
      && ((localX - cx) / rx) ** 2 + ((localY - cy) / ry) ** 2 > 1) {
      return false;
    }
  }
  return true;
}

export {};

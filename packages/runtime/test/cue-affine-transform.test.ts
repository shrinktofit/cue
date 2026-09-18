import { describe, expect, it } from 'vitest';
import {
  createCueElementTransform,
  identityCueAffineTransform,
  transformCuePaintPoint,
} from '../src/render/cue-affine-transform.js';

describe('createCueElementTransform', () => {
  it('uses CSS transform order and border-box percentages', () => {
    /// @case
    /// A 100×50 element translates by 50% and then scales by 2 around its top-left corner.
    /// @expect
    /// The later scale does not multiply the earlier translation, and percentages use the element box.
    const transform = createCueElementTransform(
      identityCueAffineTransform,
      [
        { type: 'translate', x: '50%', y: '20%' },
        { type: 'scale', x: 2, y: 2 },
      ],
      [0, 0],
      10,
      20,
      100,
      50,
    );
    expect(transformCuePaintPoint(transform, 10, -20)).toEqual([60, -30]);
  });

  it('composes descendant transforms through the parent coordinate space', () => {
    /// @case
    /// A parent translates its subtree and a child rotates around its center.
    /// @expect
    /// The child point is rotated locally, then moved by the parent transform.
    const parent = createCueElementTransform(
      identityCueAffineTransform,
      [{ type: 'translate', x: 20, y: 0 }],
      ['50%', '50%'],
      0,
      0,
      100,
      100,
    );
    const child = createCueElementTransform(
      parent,
      [{ angle: 90, type: 'rotate' }],
      ['50%', '50%'],
      0,
      0,
      20,
      20,
    );
    const [x, y] = transformCuePaintPoint(child, 0, 0);
    expect(x).toBeCloseTo(40);
    expect(y).toBeCloseTo(0);
  });
});

export {};

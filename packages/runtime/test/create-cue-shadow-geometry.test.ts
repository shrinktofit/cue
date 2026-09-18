import { describe, expect, it } from 'vitest';
import { createShadowGeometry } from '../src/render/create-cue-shadow-geometry.js';
import type { CuePaintShadow } from '../src/render/create-cue-paint-list.js';
import { identityCueAffineTransform } from '../src/render/cue-affine-transform.js';

const shadow: CuePaintShadow = {
  blur: 12,
  clipDepth: 0,
  color: {
    alpha: 0.4,
    blue: 0,
    green: 0,
    red: 0,
  },
  height: 60,
  inset: false,
  opacity: 1,
  radii: [[20, 10], [20, 10], [20, 10], [20, 10]],
  spread: 2,
  transform: identityCueAffineTransform,
  width: 100,
  x: 10,
  xOffset: 6,
  y: -5,
  yOffset: 8,
};

describe('createShadowGeometry', () => {
  it('expands an outer shadow quad for spread and blur', () => {
    /// @case
    /// A rounded box has an outer shadow with positive offsets, spread and blur.
    /// @expect
    /// Geometry covers the shadow extent and packs the CSS values for the shader.
    const geometry = createShadowGeometry([shadow]);

    expect(geometry.vertices.length).toBe(100);
    expect([...geometry.indices]).toEqual([0, 1, 2, 0, 2, 3]);
    expect(geometry.vertices[0]).toBe(-5);
    expect(geometry.vertices[1]).toBe(-94);
    expect(geometry.vertices[18]).toBe(12);
    expect(geometry.vertices[19]).toBe(2);
    expect(geometry.vertices[20]).toBe(6);
    expect(geometry.vertices[21]).toBe(8);
    expect(geometry.vertices[22]).toBe(0);
  });

  it('keeps inset shadow geometry inside the border box', () => {
    /// @case
    /// The same CSS shadow is marked inset.
    /// @expect
    /// Its quad exactly matches the box while shader parameters retain inset and offset values.
    const geometry = createShadowGeometry([{
      ...shadow,
      inset: true,
    }]);

    expect(geometry.vertices[0]).toBe(10);
    expect(geometry.vertices[1]).toBe(-65);
    expect(geometry.vertices[22]).toBe(1);
    expect(geometry.vertices[23]).toBe(100);
    expect(geometry.vertices[24]).toBe(60);
  });
});

export {};

import { describe, expect, it } from 'vitest';
import type { Texture2D } from 'cc';
import {
  createBackgroundGeometry,
  createRectGeometry,
} from '../src/render/create-cue-box-geometry.js';
import type {
  CuePaintBackground,
  CuePaintRect,
} from '../src/render/create-cue-paint-list.js';
import { DivElement } from '../src/element/div-element.js';
import { identityCueAffineTransform } from '../src/render/cue-affine-transform.js';

const transparent = {
  alpha: 0,
  blue: 0,
  green: 0,
  red: 0,
};
const red = {
  alpha: 1,
  blue: 0,
  green: 0,
  red: 255,
};
const green = {
  alpha: 1,
  blue: 0,
  green: 255,
  red: 0,
};
const blue = {
  alpha: 1,
  blue: 255,
  green: 0,
  red: 0,
};
const white = {
  alpha: 1,
  blue: 255,
  green: 255,
  red: 255,
};

describe('createRectGeometry', () => {
  it('emits the four independent border colors around an elliptical box', () => {
    /// @case
    /// A box has four differently colored border sides and elliptical radii.
    /// @expect
    /// Vertex colors include every border side and geometry stays within the border box.
    const rect: CuePaintRect = {
      borderColors: [red, green, blue, white],
      borderWidths: [2, 4, 6, 8],
      clipDepth: 0,
      color: transparent,
      height: 60,
      opacity: 1,
      radii: [[20, 10], [10, 20], [20, 10], [10, 20]],
      transform: identityCueAffineTransform,
      width: 100,
      x: 10,
      y: -5,
    };

    const geometry = createRectGeometry([rect]);
    const colors = new Set<string>();
    const points: Array<readonly [number, number]> = [];
    for (let offset = 0; offset < geometry.vertices.length; offset += 6) {
      points.push([
        geometry.vertices[offset]!,
        geometry.vertices[offset + 1]!,
      ]);
      colors.add([
        geometry.vertices[offset + 2],
        geometry.vertices[offset + 3],
        geometry.vertices[offset + 4],
        geometry.vertices[offset + 5],
      ].join(','));
    }

    expect(geometry.indices.length).toBeGreaterThan(0);
    expect(colors).toEqual(new Set([
      '1,0,0,1',
      '0,1,0,1',
      '0,0,1,1',
      '1,1,1,1',
    ]));
    expect(points.every(([x, y]) => (
      x >= 10 && x <= 110 && y >= -65 && y <= -5
    ))).toBe(true);
  });

  it('clips a repeated background image to the rounded border box', () => {
    /// @case
    /// A CSS background image is painted under the border of a rounded box.
    /// @expect
    /// Every triangle vertex lies on or within the rounded box and UVs use the image's intrinsic pixel size.
    const background: CuePaintBackground = {
      element: new DivElement(),
      clipDepth: 0,
      height: 60,
      opacity: 0.5,
      imageOffsetX: 4,
      imageOffsetY: 4,
      radii: [[20, 10], [20, 10], [20, 10], [20, 10]],
      texture: {
        height: 20,
        width: 40,
      } as Texture2D,
      transform: identityCueAffineTransform,
      width: 100,
      x: 10,
      y: -5,
    };
    const geometry = createBackgroundGeometry(background);
    expect(geometry.vertices[0]).toBe(60);
    expect(geometry.vertices[1]).toBe(-35);
    expect(geometry.vertices[2]).toBeCloseTo(1.15);
    expect(geometry.vertices[3]).toBeCloseTo(-0.3);
    expect(geometry.vertices[7]).toBeCloseTo(0.5);
    expect(geometry.indices.length).toBeGreaterThan(0);
    for (let offset = 0; offset < geometry.vertices.length; offset += 8) {
      const x = geometry.vertices[offset]!;
      const y = geometry.vertices[offset + 1]!;
      expect(x).toBeGreaterThanOrEqual(10);
      expect(x).toBeLessThanOrEqual(110);
      expect(y).toBeGreaterThanOrEqual(-65);
      expect(y).toBeLessThanOrEqual(-5);
    }
  });

  it('interpolates a linear gradient across rounded fill vertices', () => {
    /// @case
    /// A rounded rectangle has a left-to-right two-stop linear gradient.
    /// @expect
    /// Fill vertex colors follow the standard gradient direction without affecting its rounded path.
    const geometry = createRectGeometry([{
      borderColors: [transparent, transparent, transparent, transparent],
      borderWidths: [0, 0, 0, 0],
      clipDepth: 0,
      color: transparent,
      gradient: {
        direction: 'right',
        endColor: {
          alpha: 1,
          blue: 255,
          green: 255,
          red: 255,
        },
        startColor: {
          alpha: 1,
          blue: 0,
          green: 0,
          red: 0,
        },
        type: 'linear-gradient',
      },
      gradientArea: {
        height: 30,
        width: 80,
        x: 10,
        y: 10,
      },
      height: 50,
      opacity: 1,
      radii: [[10, 10], [10, 10], [10, 10], [10, 10]],
      transform: identityCueAffineTransform,
      width: 100,
      x: 0,
      y: 0,
    }]);

    const centerColorOffset = 2;
    expect(Array.from(geometry.vertices.slice(
      centerColorOffset,
      centerColorOffset + 4,
    ))).toEqual([0.5, 0.5, 0.5, 1]);
    const topEdgeColors: Array<{ red: number; x: number }> = [];
    for (let offset = 0; offset < geometry.vertices.length; offset += 6) {
      if (Math.abs(geometry.vertices[offset + 1]!) < 0.001) {
        topEdgeColors.push({
          red: geometry.vertices[offset + 2]!,
          x: geometry.vertices[offset]!,
        });
      }
    }
    expect(topEdgeColors.find(({ x }) => Math.abs(x - 10) < 0.001)?.red).toBeCloseTo(0);
    expect(topEdgeColors.find(({ x }) => Math.abs(x - 90) < 0.001)?.red).toBeCloseTo(1);
    expect(geometry.indices.length).toBeGreaterThan(0);
  });

  it('transforms rounded box vertices without changing layout geometry', () => {
    /// @case
    /// A 100×50 rounded box is translated and rotated after layout.
    /// @expect
    /// Its emitted vertices are mapped by the CSS affine transform while indices remain valid.
    const geometry = createRectGeometry([{
      borderColors: [transparent, transparent, transparent, transparent],
      borderWidths: [0, 0, 0, 0],
      clipDepth: 0,
      color: white,
      height: 50,
      opacity: 1,
      radii: [[0, 0], [0, 0], [0, 0], [0, 0]],
      transform: [0, 1, -1, 0, 20, 10],
      width: 100,
      x: 0,
      y: 0,
    }]);

    expect(geometry.vertices[0]).toBeCloseTo(-5);
    expect(geometry.vertices[1]).toBeCloseTo(-60);
    expect(geometry.indices.length).toBeGreaterThan(0);
  });
});

export {};

import type {
  CueColor,
} from '@bsgames/cue-style-schema';
import type {
  CuePaintBackground,
  CuePaintRect,
} from './create-cue-paint-list.js';
import { transformCuePaintPoint } from './cue-affine-transform.js';

export interface CueRectGeometry {
  indices: Uint16Array;
  vertices: Float32Array;
}

export function createBackgroundGeometry(
  background: CuePaintBackground,
): CueRectGeometry {
  const radii = normalizeRadii(
    background.radii,
    background.width,
    background.height,
  );
  const path = cornerPath(
    background.width,
    background.height,
    radii,
    0,
    0,
  );
  const vertices: number[] = [];
  const indices: number[] = [];
  const points = [
    { x: background.width / 2, y: background.height / 2 },
    ...path,
  ];
  for (const point of points) {
    const [x, y] = transformCuePaintPoint(
      background.transform,
      background.x + point.x,
      background.y - point.y,
    );
    vertices.push(
      x,
      y,
      (point.x - background.imageOffsetX) / background.texture.width,
      1 - (point.y - background.imageOffsetY) / background.texture.height,
      1,
      1,
      1,
      background.opacity,
    );
  }
  for (let index = 0; index < path.length; index += 1) {
    indices.push(0, index + 1, (index + 1) % path.length + 1);
  }
  return {
    indices: new Uint16Array(indices),
    vertices: new Float32Array(vertices),
  };
}

interface Point {
  x: number;
  y: number;
}

type BorderSide = 0 | 1 | 2 | 3;
type Corner = 0 | 1 | 2 | 3;
type Radii = CuePaintRect['radii'];

const cornerSegments = 8;
const vertexStride = 6;
const maxVertexCount = 65_536;

export function createRectGeometry(
  rects: readonly CuePaintRect[],
): CueRectGeometry {
  const vertices: number[] = [];
  const indices: number[] = [];
  for (const rect of rects) {
    appendRect(vertices, indices, rect);
  }
  if (vertices.length / vertexStride > maxVertexCount) {
    throw new RangeError('One CueDocument box batch exceeds the 16-bit vertex index range.');
  }
  return {
    indices: new Uint16Array(indices),
    vertices: new Float32Array(vertices),
  };
}

function appendRect(
  vertices: number[],
  indices: number[],
  rect: CuePaintRect,
): void {
  const outer = normalizeRadii(rect.radii, rect.width, rect.height);
  const [top, right, bottom, left] = rect.borderWidths;
  const innerWidth = Math.max(0, rect.width - left - right);
  const innerHeight = Math.max(0, rect.height - top - bottom);
  const inner = normalizeRadii([
    [Math.max(0, outer[0][0] - left), Math.max(0, outer[0][1] - top)],
    [Math.max(0, outer[1][0] - right), Math.max(0, outer[1][1] - top)],
    [Math.max(0, outer[2][0] - right), Math.max(0, outer[2][1] - bottom)],
    [Math.max(0, outer[3][0] - left), Math.max(0, outer[3][1] - bottom)],
  ], innerWidth, innerHeight);
  const outerPath = cornerPath(rect.width, rect.height, outer, 0, 0);
  const innerPath = cornerPath(innerWidth, innerHeight, inner, left, top);

  if (
    innerWidth > 0
    && innerHeight > 0
    && (rect.color.alpha > 0 || rect.gradient)
  ) {
    const centerPoint = {
      x: left + innerWidth / 2,
      y: top + innerHeight / 2,
    };
    const center = pushVertex(
      vertices,
      rect,
      centerPoint,
      rect.gradient
        ? gradientColor(rect, centerPoint)
        : rect.color,
    );
    const first = vertices.length / vertexStride;
    for (const point of innerPath) {
      pushVertex(
        vertices,
        rect,
        point,
        rect.gradient
          ? gradientColor(rect, point)
          : rect.color,
      );
    }
    for (let index = 0; index < innerPath.length; index += 1) {
      indices.push(center, first + index, first + (index + 1) % innerPath.length);
    }
  }

  for (let corner = 0; corner < 4; corner += 1) {
    const cornerIndex = corner as Corner;
    const start = corner * (cornerSegments + 1);
    for (let segment = 0; segment < cornerSegments; segment += 1) {
      const side = (
        segment < cornerSegments / 2
          ? corner
          : (corner + 1) % 4
      ) as BorderSide;
      appendBorderSegment(
        vertices,
        indices,
        rect,
        outerPath[start + segment]!,
        outerPath[start + segment + 1]!,
        innerPath[start + segment]!,
        innerPath[start + segment + 1]!,
        side,
      );
    }
    const next = ((cornerIndex + 1) % 4) * (cornerSegments + 1);
    appendBorderSegment(
      vertices,
      indices,
      rect,
      outerPath[start + cornerSegments]!,
      outerPath[next]!,
      innerPath[start + cornerSegments]!,
      innerPath[next]!,
      ((cornerIndex + 1) % 4) as BorderSide,
    );
  }
}

function gradientColor(
  rect: CuePaintRect,
  point: Point,
): CueColor {
  const gradient = rect.gradient!;
  const area = rect.gradientArea ?? {
    height: rect.height,
    width: rect.width,
    x: 0,
    y: 0,
  };
  let factor: number;
  switch (gradient.direction) {
  case 'top':
    factor = area.height > 0 ? 1 - (point.y - area.y) / area.height : 0;
    break;
  case 'right':
    factor = area.width > 0 ? (point.x - area.x) / area.width : 0;
    break;
  case 'bottom':
    factor = area.height > 0 ? (point.y - area.y) / area.height : 0;
    break;
  case 'left':
    factor = area.width > 0 ? 1 - (point.x - area.x) / area.width : 0;
    break;
  }
  return mixColor(gradient.startColor, gradient.endColor, factor);
}

function mixColor(start: CueColor, end: CueColor, factor: number): CueColor {
  const amount = Math.min(1, Math.max(0, factor));
  return {
    alpha: start.alpha + (end.alpha - start.alpha) * amount,
    blue: start.blue + (end.blue - start.blue) * amount,
    green: start.green + (end.green - start.green) * amount,
    red: start.red + (end.red - start.red) * amount,
  };
}

function appendBorderSegment(
  vertices: number[],
  indices: number[],
  rect: CuePaintRect,
  outerStart: Point,
  outerEnd: Point,
  innerStart: Point,
  innerEnd: Point,
  side: BorderSide,
): void {
  const color = compositeColor(
    rect.borderWidths[side] > 0
      ? rect.borderColors[side]
      : { alpha: 0, blue: 0, green: 0, red: 0 },
    rect.color,
  );
  if (color.alpha <= 0) {
    return;
  }
  const first = vertices.length / vertexStride;
  pushVertex(vertices, rect, outerStart, color);
  pushVertex(vertices, rect, outerEnd, color);
  pushVertex(vertices, rect, innerEnd, color);
  pushVertex(vertices, rect, innerStart, color);
  indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
}

function compositeColor(foreground: CueColor, background: CueColor): CueColor {
  const alpha = foreground.alpha + background.alpha * (1 - foreground.alpha);
  if (alpha <= 0) {
    return { alpha: 0, blue: 0, green: 0, red: 0 };
  }
  return {
    alpha,
    blue: (
      foreground.blue * foreground.alpha
      + background.blue * background.alpha * (1 - foreground.alpha)
    ) / alpha,
    green: (
      foreground.green * foreground.alpha
      + background.green * background.alpha * (1 - foreground.alpha)
    ) / alpha,
    red: (
      foreground.red * foreground.alpha
      + background.red * background.alpha * (1 - foreground.alpha)
    ) / alpha,
  };
}

function pushVertex(
  vertices: number[],
  rect: CuePaintRect,
  point: Point,
  color: CueColor,
): number {
  const index = vertices.length / vertexStride;
  const [x, y] = transformCuePaintPoint(
    rect.transform,
    rect.x + point.x,
    rect.y - point.y,
  );
  vertices.push(
    x,
    y,
    color.red / 255,
    color.green / 255,
    color.blue / 255,
    color.alpha * rect.opacity,
  );
  return index;
}

function cornerPath(
  width: number,
  height: number,
  radii: Radii,
  x: number,
  y: number,
): Point[] {
  const path: Point[] = [];
  const centers = [
    [width - radii[1][0], radii[1][1]],
    [width - radii[2][0], height - radii[2][1]],
    [radii[3][0], height - radii[3][1]],
    [radii[0][0], radii[0][1]],
  ] as const;
  const cornerRadii = [radii[1], radii[2], radii[3], radii[0]];
  for (let corner = 0; corner < 4; corner += 1) {
    const center = centers[corner]!;
    const radius = cornerRadii[corner]!;
    for (let segment = 0; segment <= cornerSegments; segment += 1) {
      const angle = (-Math.PI / 2) + corner * (Math.PI / 2)
        + segment * (Math.PI / 2 / cornerSegments);
      path.push({
        x: x + center[0] + Math.cos(angle) * radius[0],
        y: y + center[1] + Math.sin(angle) * radius[1],
      });
    }
  }
  return path;
}

function normalizeRadii(
  radii: Radii,
  width: number,
  height: number,
): Radii {
  const scale = Math.min(
    1,
    sideScale(width, radii[0][0] + radii[1][0]),
    sideScale(width, radii[3][0] + radii[2][0]),
    sideScale(height, radii[0][1] + radii[3][1]),
    sideScale(height, radii[1][1] + radii[2][1]),
  );
  return radii.map(([horizontal, vertical]) => [
    horizontal * scale,
    vertical * scale,
  ]) as unknown as Radii;
}

function sideScale(sideLength: number, radiiLength: number): number {
  return radiiLength > 0 ? sideLength / radiiLength : 1;
}

export {};

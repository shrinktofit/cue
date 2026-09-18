import type {
  CueLengthPercentage,
  CueTransformFunction,
} from '@bsgames/cue-style-schema';

export type CueAffineTransform = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
];

export const identityCueAffineTransform: CueAffineTransform = [
  1, 0, 0, 1, 0, 0,
];

export function createCueElementTransform(
  parentTransform: CueAffineTransform,
  functions: readonly CueTransformFunction[],
  origin: readonly [CueLengthPercentage, CueLengthPercentage],
  x: number,
  y: number,
  width: number,
  height: number,
): CueAffineTransform {
  if (functions.length === 0) {
    return parentTransform;
  }
  const originX = x + pixelLength(origin[0], width);
  const originY = y + pixelLength(origin[1], height);
  let local = translation(originX, originY);
  for (const transform of functions) {
    local = multiply(local, transformMatrix(transform, width, height));
  }
  local = multiply(local, translation(-originX, -originY));
  return multiply(parentTransform, local);
}

export function multiplyCueAffineTransforms(
  left: CueAffineTransform,
  right: CueAffineTransform,
): CueAffineTransform {
  return multiply(left, right);
}

export function transformCuePaintPoint(
  transform: CueAffineTransform,
  x: number,
  y: number,
): readonly [number, number] {
  const [a, b, c, d, e, f] = transform;
  const layoutY = -y;
  return [
    a * x + c * layoutY + e,
    -(b * x + d * layoutY + f),
  ];
}

function transformMatrix(
  transform: CueTransformFunction,
  width: number,
  height: number,
): CueAffineTransform {
  switch (transform.type) {
  case 'matrix':
    return [
      transform.a,
      transform.b,
      transform.c,
      transform.d,
      transform.e,
      transform.f,
    ];
  case 'rotate': {
    const radians = transform.angle * Math.PI / 180;
    const sine = Math.sin(radians);
    const cosine = Math.cos(radians);
    return [cosine, sine, -sine, cosine, 0, 0];
  }
  case 'scale':
    return [transform.x, 0, 0, transform.y, 0, 0];
  case 'skew':
    return [
      1,
      Math.tan(transform.yAngle * Math.PI / 180),
      Math.tan(transform.xAngle * Math.PI / 180),
      1,
      0,
      0,
    ];
  case 'translate':
    return translation(
      pixelLength(transform.x, width),
      pixelLength(transform.y, height),
    );
  }
}

function translation(x: number, y: number): CueAffineTransform {
  return [1, 0, 0, 1, x, y];
}

function multiply(
  left: CueAffineTransform,
  right: CueAffineTransform,
): CueAffineTransform {
  const [a1, b1, c1, d1, e1, f1] = left;
  const [a2, b2, c2, d2, e2, f2] = right;
  return [
    a1 * a2 + c1 * b2,
    b1 * a2 + d1 * b2,
    a1 * c2 + c1 * d2,
    b1 * c2 + d1 * d2,
    a1 * e2 + c1 * f2 + e1,
    b1 * e2 + d1 * f2 + f1,
  ];
}

function pixelLength(value: CueLengthPercentage, reference: number): number {
  return typeof value === 'number'
    ? value
    : Number.parseFloat(value) * reference / 100;
}

export {};

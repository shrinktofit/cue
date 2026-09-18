import type { CuePaintShadow } from './create-cue-paint-list.js';
import { transformCuePaintPoint } from './cue-affine-transform.js';

export interface CueShadowGeometry {
  indices: Uint16Array;
  vertices: Float32Array;
}

const verticesPerQuad = 4;
const indicesPerQuad = 6;
export const cueShadowVertexStrideFloats = 25;

export function createShadowGeometry(
  shadows: readonly CuePaintShadow[],
): CueShadowGeometry {
  if (shadows.length * verticesPerQuad > 65_536) {
    throw new RangeError('One CueDocument shadow batch exceeds the 16-bit vertex index range.');
  }
  const vertices = new Float32Array(
    shadows.length * verticesPerQuad * cueShadowVertexStrideFloats,
  );
  const indices = new Uint16Array(shadows.length * indicesPerQuad);
  for (const [shadowIndex, shadow] of shadows.entries()) {
    appendShadow(vertices, indices, shadowIndex, shadow);
  }
  return {
    indices,
    vertices,
  };
}

function appendShadow(
  vertices: Float32Array,
  indices: Uint16Array,
  shadowIndex: number,
  shadow: CuePaintShadow,
): void {
  const blurExtent = shadow.blur * 1.5 + 1;
  const spreadDirection = shadow.inset ? -1 : 1;
  const shadowWidth = Math.max(
    0,
    shadow.width + shadow.spread * 2 * spreadDirection,
  );
  const shadowHeight = Math.max(
    0,
    shadow.height + shadow.spread * 2 * spreadDirection,
  );
  const quadWidth = shadow.inset
    ? shadow.width
    : shadowWidth + blurExtent * 2;
  const quadHeight = shadow.inset
    ? shadow.height
    : shadowHeight + blurExtent * 2;
  const quadX = shadow.inset
    ? shadow.x
    : shadow.x + shadow.xOffset - shadow.spread - blurExtent;
  const quadY = shadow.inset
    ? shadow.y
    : shadow.y - shadow.yOffset + shadow.spread + blurExtent;
  const halfShadowWidth = shadowWidth / 2;
  const halfShadowHeight = shadowHeight / 2;
  const localLeft = shadow.inset
    ? -shadow.width / 2 - shadow.xOffset
    : -halfShadowWidth - blurExtent;
  const localTop = shadow.inset
    ? -shadow.height / 2 - shadow.yOffset
    : -halfShadowHeight - blurExtent;
  const positions = [
    quadX, quadY - quadHeight,
    quadX, quadY,
    quadX + quadWidth, quadY,
    quadX + quadWidth, quadY - quadHeight,
  ];
  const localPositions = [
    localLeft, localTop + quadHeight,
    localLeft, localTop,
    localLeft + quadWidth, localTop,
    localLeft + quadWidth, localTop + quadHeight,
  ];
  const radiusX = shadow.radii.map(
    ([horizontal]) => Math.max(0, horizontal + shadow.spread * spreadDirection),
  );
  const radiusY = shadow.radii.map(
    ([, vertical]) => Math.max(0, vertical + shadow.spread * spreadDirection),
  );
  for (let vertexIndex = 0; vertexIndex < verticesPerQuad; vertexIndex += 1) {
    const offset = (
      shadowIndex * verticesPerQuad + vertexIndex
    ) * cueShadowVertexStrideFloats;
    const vectorOffset = vertexIndex * 2;
    const [x, y] = transformCuePaintPoint(
      shadow.transform,
      positions[vectorOffset] ?? 0,
      positions[vectorOffset + 1] ?? 0,
    );
    const values = [
      x,
      y,
      localPositions[vectorOffset],
      localPositions[vectorOffset + 1],
      shadowWidth,
      shadowHeight,
      ...radiusX,
      ...radiusY,
      shadow.color.red / 255,
      shadow.color.green / 255,
      shadow.color.blue / 255,
      shadow.color.alpha * shadow.opacity,
      shadow.blur,
      shadow.spread,
      shadow.xOffset,
      shadow.yOffset,
      shadow.inset ? 1 : 0,
      shadow.width,
      shadow.height,
    ];
    vertices.set(values.map((value) => value ?? 0), offset);
  }
  const vertexOffset = shadowIndex * verticesPerQuad;
  const indexOffset = shadowIndex * indicesPerQuad;
  indices.set([
    vertexOffset,
    vertexOffset + 1,
    vertexOffset + 2,
    vertexOffset,
    vertexOffset + 2,
    vertexOffset + 3,
  ], indexOffset);
}

export {};

/// <meta "uuid"="a3126a99-13de-4a88-b396-028e96f59e1d"/>

import {
  cueStyleSchemaVersion,
  type CueStyleSheet,
} from '@bsgames/cue-style-schema';
import { CycloComponent } from '@cyclonium/core/framework';
import {
  cycloClass,
  executeInEditMode,
} from '@cyclonium/core/legacy-decorator';
// eslint-disable-next-line vue/prefer-import-from-vue -- Cue intentionally depends on Vue's renderer-only runtime.
import type { Component as VueComponent } from '@vue/runtime-core';
// eslint-disable-next-line vue/prefer-import-from-vue -- Cue intentionally depends on Vue's renderer-only runtime.
import type { ComponentPublicInstance } from '@vue/runtime-core';
import {
  assetManager,
  EffectAsset,
  error,
  gfx,
  Material,
  renderer,
  RenderingSubMesh,
  Vec3,
  type Asset,
} from 'cc';
import { CueRootElement } from '../element/cue-root-element.js';
import {
  createCuePaintRects,
  initializeCueLayout,
  type CuePaintRect,
} from '../render/create-cue-paint-rects.js';
import { createCueRenderer } from '../vue/create-cue-renderer.js';

const cueEffectUuid = 'bf6467ca-3f41-4b99-8e47-2cc57ddd8cc2';

interface CueRenderRecord {
  readonly localVertexBuffer: Float32Array;
  readonly model: renderer.scene.Model;
  readonly quadCount: number;
  readonly renderScene: renderer.RenderScene;
  readonly renderingSubMesh: RenderingSubMesh;
  readonly vertexBuffer: gfx.Buffer;
}

let cueEffect: EffectAsset | Promise<EffectAsset> | undefined;

@cycloClass('cue.CueDocument')
@executeInEditMode
export class CueDocument extends CycloComponent {
  static async prepare(): Promise<void> {
    await Promise.all([
      initializeCueLayout(),
      loadCueEffect(),
    ]);
  }

  get rootElement(): CueRootElement {
    return this.#rootElement;
  }

  mount(
    rootComponent: VueComponent,
    rootProps?: Record<string, unknown> | null,
  ): ComponentPublicInstance {
    if (this.#unmount) {
      throw new Error('CueDocument already has a mounted Vue application.');
    }
    this.#styleSheets = readComponentStyleSheets(rootComponent);
    const app = createCueRenderer().createApp(rootComponent, rootProps);
    const instance = app.mount(this.#rootElement);
    this.#unmount = () => app.unmount();
    return instance;
  }

  unmount(): void {
    this.#unmount?.();
    this.#unmount = undefined;
    this.#styleSheets = [];
  }

  protected override onAwake(): void {
    void this.#prepareRenderResources();
  }

  protected override onEnabled(): void {
    this.#syncRenderRecordEnabled();
  }

  protected override onDisabled(): void {
    this.#syncRenderRecordEnabled();
  }

  protected override onUpdate(): void {
    if (!this.#material) {
      return;
    }
    this.#syncRenderRecord(createCuePaintRects(
      this.#rootElement,
      this.#styleSheets,
    ));
  }

  protected override onDestroy(): void {
    super.onDestroy();
    this.unmount();
    this.#destroyRenderRecord();
    this.#material?.destroy();
    this.#material = undefined;
  }

  readonly #rootElement = new CueRootElement();
  #material: Material | undefined;
  #renderRecord: CueRenderRecord | undefined;
  #styleSheets: readonly CueStyleSheet[] = [];
  #unmount: (() => void) | undefined;

  async #prepareRenderResources(): Promise<void> {
    try {
      const [effect] = await Promise.all([
        loadCueEffect(),
        initializeCueLayout(),
      ]);
      if (!this.isValid) {
        return;
      }
      const material = new Material();
      material.reset({
        effectAsset: effect,
      });
      this.#material = material;
    } catch (cause) {
      error('Failed to prepare Cue rendering resources.', cause);
    }
  }

  #syncRenderRecord(paintRects: readonly CuePaintRect[]): void {
    if (paintRects.length === 0) {
      this.#destroyRenderRecord();
      return;
    }

    if (!this.#renderRecord || this.#renderRecord.quadCount !== paintRects.length) {
      this.#reconstructRenderRecord(paintRects.length);
    }
    const renderRecord = this.#renderRecord;
    if (!renderRecord) {
      return;
    }
    writeVertexBuffer(renderRecord.localVertexBuffer, paintRects);
    updateGfxBuffer(renderRecord.vertexBuffer, renderRecord.localVertexBuffer);
    updateModelBounds(renderRecord.model, paintRects);
    this.#syncRenderRecordEnabled();
  }

  #reconstructRenderRecord(quadCount: number): void {
    this.#destroyRenderRecord();
    const renderScene = this.node.scene?.renderScene;
    const material = this.#material;
    if (!renderScene || !material) {
      return;
    }

    const device = renderScene.root.device;
    const localVertexBuffer = new Float32Array(
      quadCount * verticesPerQuad * vertexStrideFloats,
    );
    const vertexBuffer = device.createBuffer(new gfx.BufferInfo(
      gfx.BufferUsageBit.VERTEX,
      gfx.MemoryUsageBit.DEVICE,
      localVertexBuffer.byteLength,
      Float32Array.BYTES_PER_ELEMENT * vertexStrideFloats,
      gfx.BufferFlagBit.NONE,
    ));
    const indices = createIndices(quadCount);
    const indexBuffer = device.createBuffer(new gfx.BufferInfo(
      gfx.BufferUsageBit.INDEX,
      gfx.MemoryUsageBit.DEVICE,
      indices.byteLength,
      indices.BYTES_PER_ELEMENT,
      gfx.BufferFlagBit.NONE,
    ));
    updateGfxBuffer(indexBuffer, indices);
    const renderingSubMesh = new RenderingSubMesh(
      [vertexBuffer],
      vertexAttributes,
      gfx.PrimitiveMode.TRIANGLE_LIST,
      indexBuffer,
      null,
      true,
    );
    const model = new renderer.scene.Model();
    model.node = this.node;
    model.transform = this.node;
    model.initSubModel(0, renderingSubMesh, material);
    model.visFlags = this.node.layer;
    model.enabled = this.enabledInHierarchy;
    renderScene.addModel(model);
    this.#renderRecord = {
      localVertexBuffer,
      model,
      quadCount,
      renderScene,
      renderingSubMesh,
      vertexBuffer,
    };
  }

  #destroyRenderRecord(): void {
    const renderRecord = this.#renderRecord;
    if (!renderRecord) {
      return;
    }
    this.#renderRecord = undefined;
    renderRecord.renderScene.removeModel(renderRecord.model);
    renderRecord.renderingSubMesh.destroy();
    renderRecord.model.destroy();
  }

  #syncRenderRecordEnabled(): void {
    if (this.#renderRecord) {
      this.#renderRecord.model.enabled = this.enabledInHierarchy;
    }
  }
}

const verticesPerQuad = 4;
const indicesPerQuad = 6;
const positionOffset = 0;
const textureCoordinateOffset = 2;
const colorOffset = 4;
const sizeOffset = 8;
const radiusOffset = 10;
const vertexStrideFloats = 14;
const vertexAttributes = [
  new gfx.Attribute(gfx.AttributeName.ATTR_POSITION, gfx.Format.RG32F),
  new gfx.Attribute(gfx.AttributeName.ATTR_TEX_COORD, gfx.Format.RG32F),
  new gfx.Attribute(gfx.AttributeName.ATTR_COLOR, gfx.Format.RGBA32F),
  new gfx.Attribute(gfx.AttributeName.ATTR_TEX_COORD1, gfx.Format.RG32F),
  new gfx.Attribute(gfx.AttributeName.ATTR_TEX_COORD2, gfx.Format.RGBA32F),
];
const textureCoordinates = [
  0, 0,
  0, 1,
  1, 1,
  1, 0,
] as const;

function writeVertexBuffer(
  vertexBuffer: Float32Array,
  paintRects: readonly CuePaintRect[],
): void {
  for (const [quadIndex, paintRect] of paintRects.entries()) {
    const positions = [
      paintRect.x, paintRect.y - paintRect.height,
      paintRect.x, paintRect.y,
      paintRect.x + paintRect.width, paintRect.y,
      paintRect.x + paintRect.width, paintRect.y - paintRect.height,
    ];
    const radii = clampRadii(paintRect);
    for (let vertexIndex = 0; vertexIndex < verticesPerQuad; vertexIndex += 1) {
      const vertexOffset = (
        quadIndex * verticesPerQuad + vertexIndex
      ) * vertexStrideFloats;
      const vectorOffset = vertexIndex * 2;
      vertexBuffer[vertexOffset + positionOffset] = positions[vectorOffset] ?? 0;
      vertexBuffer[vertexOffset + positionOffset + 1] = positions[vectorOffset + 1] ?? 0;
      vertexBuffer[vertexOffset + textureCoordinateOffset] = textureCoordinates[vectorOffset] ?? 0;
      vertexBuffer[vertexOffset + textureCoordinateOffset + 1] = textureCoordinates[vectorOffset + 1] ?? 0;
      vertexBuffer[vertexOffset + colorOffset] = paintRect.color.red / 255;
      vertexBuffer[vertexOffset + colorOffset + 1] = paintRect.color.green / 255;
      vertexBuffer[vertexOffset + colorOffset + 2] = paintRect.color.blue / 255;
      vertexBuffer[vertexOffset + colorOffset + 3] = paintRect.color.alpha;
      vertexBuffer[vertexOffset + sizeOffset] = paintRect.width;
      vertexBuffer[vertexOffset + sizeOffset + 1] = paintRect.height;
      for (let radiusIndex = 0; radiusIndex < radii.length; radiusIndex += 1) {
        vertexBuffer[vertexOffset + radiusOffset + radiusIndex] = radii[radiusIndex] ?? 0;
      }
    }
  }
}

function clampRadii(
  paintRect: CuePaintRect,
): readonly [number, number, number, number] {
  const maximumRadius = Math.min(paintRect.width, paintRect.height) / 2;
  return paintRect.radii.map(
    (radius) => Math.min(Math.max(radius, 0), maximumRadius),
  ) as [number, number, number, number];
}

function createIndices(quadCount: number): Uint16Array {
  if (quadCount * verticesPerQuad > 65_536) {
    throw new RangeError('One CueDocument batch cannot exceed 16,384 rectangles.');
  }
  const indices = new Uint16Array(quadCount * indicesPerQuad);
  for (let quadIndex = 0; quadIndex < quadCount; quadIndex += 1) {
    const vertexOffset = quadIndex * verticesPerQuad;
    const indexOffset = quadIndex * indicesPerQuad;
    indices[indexOffset] = vertexOffset;
    indices[indexOffset + 1] = vertexOffset + 1;
    indices[indexOffset + 2] = vertexOffset + 2;
    indices[indexOffset + 3] = vertexOffset;
    indices[indexOffset + 4] = vertexOffset + 2;
    indices[indexOffset + 5] = vertexOffset + 3;
  }
  return indices;
}

function updateModelBounds(
  model: renderer.scene.Model,
  paintRects: readonly CuePaintRect[],
): void {
  let xMin = Number.POSITIVE_INFINITY;
  let yMin = Number.POSITIVE_INFINITY;
  let xMax = Number.NEGATIVE_INFINITY;
  let yMax = Number.NEGATIVE_INFINITY;
  for (const paintRect of paintRects) {
    xMin = Math.min(xMin, paintRect.x);
    yMin = Math.min(yMin, paintRect.y - paintRect.height);
    xMax = Math.max(xMax, paintRect.x + paintRect.width);
    yMax = Math.max(yMax, paintRect.y);
  }
  model.createBoundingShape(
    new Vec3(xMin, yMin, 0),
    new Vec3(xMax, yMax, 0),
  );
  model.updateWorldBound();
}

function readComponentStyleSheets(
  component: VueComponent,
): readonly CueStyleSheet[] {
  if (
    (typeof component !== 'object' || component === null)
    && typeof component !== 'function'
  ) {
    return [];
  }
  const styleSheets = (
    component as { __cueStyleSheets?: unknown }
  ).__cueStyleSheets;
  if (styleSheets === undefined) {
    return [];
  }
  if (!Array.isArray(styleSheets)) {
    throw new TypeError('Cue component style metadata must be an array.');
  }
  for (const styleSheet of styleSheets) {
    const version = styleSheet && typeof styleSheet === 'object'
      ? (styleSheet as { version?: unknown }).version
      : undefined;
    if (version !== cueStyleSchemaVersion) {
      throw new Error('Unsupported Cue style schema version: ' + String(version) + '.');
    }
  }
  return styleSheets as CueStyleSheet[];
}

function loadCueEffect(): Promise<EffectAsset> {
  if (cueEffect instanceof EffectAsset) {
    return Promise.resolve(cueEffect);
  }
  if (cueEffect) {
    return cueEffect;
  }
  cueEffect = loadAsset<EffectAsset>(cueEffectUuid).then((effect) => {
    cueEffect = effect;
    return effect;
  });
  return cueEffect;
}

function loadAsset<TAsset extends Asset>(uuid: string): Promise<TAsset> {
  return new Promise((fulfill, reject) => {
    assetManager.loadAny<TAsset>(uuid, (assetError, asset) => {
      if (assetError) {
        reject(assetError);
      } else {
        fulfill(asset);
      }
    });
  });
}

function updateGfxBuffer(
  buffer: gfx.Buffer,
  source: gfx.BufferSource | ArrayBufferView,
): void {
  buffer.update(source as gfx.BufferSource);
}

export {};

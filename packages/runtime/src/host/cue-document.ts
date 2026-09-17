/// <meta "uuid"="a3126a99-13de-4a88-b396-028e96f59e1d"/>

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
  SpriteFrame,
  Texture2D,
  Vec3,
  view,
  type Asset,
} from 'cc';
import { CueElement } from '../element/cue-element.js';
import {
  CueImageElement,
  getCueImageSource,
} from '../element/cue-image-element.js';
import { CueRootElement } from '../element/cue-root-element.js';
import {
  createCuePaintList,
  initializeCueLayout,
  type CuePaintImage,
  type CuePaintList,
  type CuePaintRect,
  type CuePaintText,
} from '../render/create-cue-paint-list.js';
import {
  trackCueStyleSheets,
  type CueStyleSheetCollection,
} from '../style/cue-style-sheet-collection.js';
import { createCueRenderer } from '../vue/create-cue-renderer.js';
import { CanvasTextRasterizer } from './canvas-text-rasterizer.js';

const cueRoundedRectEffectUuid = 'bf6467ca-3f41-4b99-8e47-2cc57ddd8cc2';
const cueTextureEffectUuid = '74b6f3ad-ccf0-4ff7-8a19-173225147c3a';

interface CueRenderRecord {
  readonly localVertexBuffer: Float32Array;
  readonly model: renderer.scene.Model;
  readonly quadCount: number;
  readonly renderScene: renderer.RenderScene;
  readonly renderingSubMesh: RenderingSubMesh;
  readonly vertexBuffer: gfx.Buffer;
}

interface CueTextRenderRecord {
  readonly cacheKey: string;
  readonly localVertexBuffer: Float32Array;
  readonly material: Material;
  readonly model: renderer.scene.Model;
  readonly renderScene: renderer.RenderScene;
  readonly renderingSubMesh: RenderingSubMesh;
  readonly texture: Texture2D;
  readonly vertexBuffer: gfx.Buffer;
}

interface CueImageRenderRecord {
  readonly localVertexBuffer: Float32Array;
  readonly material: Material;
  readonly model: renderer.scene.Model;
  readonly renderScene: renderer.RenderScene;
  readonly renderingSubMesh: RenderingSubMesh;
  readonly spriteFrame: SpriteFrame;
  readonly texture: SpriteFrame['texture'];
  readonly vertexBuffer: gfx.Buffer;
}

let cueRoundedRectEffect: EffectAsset | Promise<EffectAsset> | undefined;
let cueTextureEffect: EffectAsset | Promise<EffectAsset> | undefined;

@cycloClass('cue.CueDocument')
@executeInEditMode
export class CueDocument extends CycloComponent {
  static async prepare(): Promise<void> {
    await Promise.all([
      initializeCueLayout(),
      loadCueRoundedRectEffect(),
      loadCueTextureEffect(),
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
    const app = createCueRenderer().createApp(rootComponent, rootProps);
    const styleSheetCollection = trackCueStyleSheets(app);
    this.#styleSheetCollection = styleSheetCollection;
    let instance: ComponentPublicInstance;
    try {
      instance = app.mount(this.#rootElement);
    } catch (cause) {
      styleSheetCollection.clear();
      this.#styleSheetCollection = undefined;
      throw cause;
    }
    this.#unmount = () => app.unmount();
    return instance;
  }

  unmount(): void {
    this.#unmount?.();
    this.#unmount = undefined;
    this.#styleSheetCollection?.clear();
    this.#styleSheetCollection = undefined;
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
    this.#syncImageAssets();
    const textRasterizer = this.#textRasterizer;
    if (!this.#material || !this.#textureEffect || !textRasterizer) {
      return;
    }
    const paintList = createCuePaintList(
      this.#rootElement,
      this.#styleSheetCollection?.styleSheets ?? [],
      textRasterizer,
      (source) => this.#imageAssets.get(source),
    );
    this.#syncRenderRecords(paintList);
  }

  protected override onDestroy(): void {
    super.onDestroy();
    this.unmount();
    this.#destroyRenderRecord();
    this.#destroyImageRenderRecords();
    this.#destroyTextRenderRecords();
    this.#acceptImageAssets = false;
    for (const image of this.#imageAssets.values()) {
      image.decRef();
    }
    this.#imageAssets.clear();
    this.#imageSources.clear();
    this.#material?.destroy();
    this.#material = undefined;
    this.#textureEffect = undefined;
    this.#textRasterizer = undefined;
  }

  readonly #rootElement = new CueRootElement();
  #acceptImageAssets = true;
  readonly #imageAssets = new Map<string, SpriteFrame>();
  readonly #imageLoads = new Map<string, Promise<void>>();
  readonly #imageRenderRecords = new Map<CueImageElement, CueImageRenderRecord>();
  #imageSources = new Set<string>();
  readonly #reportedImageSources = new Set<string>();
  #material: Material | undefined;
  #renderRecord: CueRenderRecord | undefined;
  #styleSheetCollection: CueStyleSheetCollection | undefined;
  #textureEffect: EffectAsset | undefined;
  #textRasterizer: CanvasTextRasterizer | undefined;
  readonly #textRenderRecords = new Map<CuePaintText['element'], CueTextRenderRecord>();
  #unmount: (() => void) | undefined;

  async #prepareRenderResources(): Promise<void> {
    try {
      const [roundedRectEffect, textureEffect] = await Promise.all([
        loadCueRoundedRectEffect(),
        loadCueTextureEffect(),
        initializeCueLayout(),
      ]);
      if (!this.isValid) {
        return;
      }
      const material = new Material();
      material.reset({
        effectAsset: roundedRectEffect,
      });
      this.#material = material;
      this.#textureEffect = textureEffect;
      this.#textRasterizer = new CanvasTextRasterizer(() => view.getScaleX());
    } catch (cause) {
      error('Failed to prepare Cue rendering resources.', cause);
    }
  }

  #syncImageAssets(): void {
    const liveSources = new Set<string>();
    const observedSources = new Set<string>();
    const elements: CueElement[] = [this.#rootElement];
    while (elements.length > 0) {
      const element = elements.pop();
      if (!element) {
        continue;
      }
      for (const child of element.children) {
        if (child instanceof CueElement) {
          elements.push(child);
        }
      }
      if (!(element instanceof CueImageElement)) {
        continue;
      }
      const source = getCueImageSource(element);
      if (source === undefined) {
        continue;
      }
      observedSources.add(source);
      if (!isUuidImageSource(source)) {
        if (!this.#reportedImageSources.has(source)) {
          this.#reportedImageSources.add(source);
          error(
            `Dynamic <cue-image> src ${JSON.stringify(source)} is not supported; use a non-empty "uuid:" source. Static relative paths are canonicalized by the compiler host.`,
          );
        }
        continue;
      }
      liveSources.add(source);
    }

    this.#imageSources = liveSources;
    for (const [source, image] of this.#imageAssets) {
      if (!liveSources.has(source)) {
        this.#imageAssets.delete(source);
        image.decRef();
      }
    }
    for (const source of this.#reportedImageSources) {
      if (!observedSources.has(source)) {
        this.#reportedImageSources.delete(source);
      }
    }
    for (const source of liveSources) {
      if (
        !this.#imageAssets.has(source)
        && !this.#imageLoads.has(source)
        && !this.#reportedImageSources.has(source)
      ) {
        this.#loadImage(source);
      }
    }
  }

  #loadImage(source: string): void {
    const loading = loadAsset<SpriteFrame>(source.slice('uuid:'.length))
      .then((image) => {
        if (!(image instanceof SpriteFrame)) {
          throw new TypeError(
            `<cue-image> source ${JSON.stringify(source)} is not a SpriteFrame asset.`,
          );
        }
        if (!this.#acceptImageAssets || !this.#imageSources.has(source)) {
          return;
        }
        image.addRef();
        this.#imageAssets.set(source, image);
      })
      .catch((cause: unknown) => {
        if (
          this.#acceptImageAssets
          && this.#imageSources.has(source)
          && !this.#reportedImageSources.has(source)
        ) {
          this.#reportedImageSources.add(source);
          error(`Failed to load <cue-image> source ${JSON.stringify(source)}.`, cause);
        }
      })
      .finally(() => {
        if (this.#imageLoads.get(source) === loading) {
          this.#imageLoads.delete(source);
        }
      });
    this.#imageLoads.set(source, loading);
  }

  #syncRenderRecords(paintList: CuePaintList): void {
    this.#syncRenderRecord(paintList.rects);
    this.#syncImageRenderRecords(paintList.images);
    this.#syncTextRenderRecords(paintList.texts);
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
    for (const renderRecord of this.#textRenderRecords.values()) {
      renderRecord.model.enabled = this.enabledInHierarchy;
    }
    for (const renderRecord of this.#imageRenderRecords.values()) {
      renderRecord.model.enabled = this.enabledInHierarchy;
    }
  }

  #syncImageRenderRecords(paintImages: readonly CuePaintImage[]): void {
    const textureEffect = this.#textureEffect;
    if (!textureEffect) {
      return;
    }
    const liveElements = new Set<CueImageElement>();
    for (const paintImage of paintImages) {
      liveElements.add(paintImage.element);
      let renderRecord = this.#imageRenderRecords.get(paintImage.element);
      if (
        renderRecord
        && (
          renderRecord.spriteFrame !== paintImage.spriteFrame
          || renderRecord.texture !== paintImage.spriteFrame.texture
        )
      ) {
        this.#destroyImageRenderRecord(renderRecord);
        renderRecord = undefined;
      }
      if (!renderRecord) {
        renderRecord = this.#reconstructImageRenderRecord(
          paintImage,
          textureEffect,
        );
        if (renderRecord) {
          this.#imageRenderRecords.set(paintImage.element, renderRecord);
        }
      }
      if (!renderRecord) {
        continue;
      }
      writeTextureVertexBuffer(
        renderRecord.localVertexBuffer,
        paintImage,
        spriteFrameTextureCoordinates(paintImage.spriteFrame),
      );
      updateGfxBuffer(
        renderRecord.vertexBuffer,
        renderRecord.localVertexBuffer,
      );
      updateTextureModelBounds(renderRecord.model, paintImage);
      renderRecord.model.enabled = this.enabledInHierarchy;
    }
    for (const [element, renderRecord] of this.#imageRenderRecords) {
      if (!liveElements.has(element)) {
        this.#imageRenderRecords.delete(element);
        this.#destroyImageRenderRecord(renderRecord);
      }
    }
  }

  #reconstructImageRenderRecord(
    paintImage: CuePaintImage,
    textureEffect: EffectAsset,
  ): CueImageRenderRecord | undefined {
    const renderScene = this.node.scene?.renderScene;
    if (!renderScene) {
      return undefined;
    }
    const material = new Material();
    material.reset({
      effectAsset: textureEffect,
    });
    material.setProperty('mainTexture', paintImage.spriteFrame.texture);

    const device = renderScene.root.device;
    const localVertexBuffer = new Float32Array(
      verticesPerQuad * textureVertexStrideFloats,
    );
    const vertexBuffer = device.createBuffer(new gfx.BufferInfo(
      gfx.BufferUsageBit.VERTEX,
      gfx.MemoryUsageBit.DEVICE,
      localVertexBuffer.byteLength,
      Float32Array.BYTES_PER_ELEMENT * textureVertexStrideFloats,
      gfx.BufferFlagBit.NONE,
    ));
    const indexBuffer = device.createBuffer(new gfx.BufferInfo(
      gfx.BufferUsageBit.INDEX,
      gfx.MemoryUsageBit.DEVICE,
      textureIndices.byteLength,
      textureIndices.BYTES_PER_ELEMENT,
      gfx.BufferFlagBit.NONE,
    ));
    updateGfxBuffer(indexBuffer, textureIndices);
    const renderingSubMesh = new RenderingSubMesh(
      [vertexBuffer],
      textureVertexAttributes,
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
    model.priority = 1;
    model.enabled = this.enabledInHierarchy;
    renderScene.addModel(model);
    return {
      localVertexBuffer,
      material,
      model,
      renderScene,
      renderingSubMesh,
      spriteFrame: paintImage.spriteFrame,
      texture: paintImage.spriteFrame.texture,
      vertexBuffer,
    };
  }

  #destroyImageRenderRecords(): void {
    for (const renderRecord of this.#imageRenderRecords.values()) {
      this.#destroyImageRenderRecord(renderRecord);
    }
    this.#imageRenderRecords.clear();
  }

  #destroyImageRenderRecord(renderRecord: CueImageRenderRecord): void {
    renderRecord.renderScene.removeModel(renderRecord.model);
    renderRecord.renderingSubMesh.destroy();
    renderRecord.model.destroy();
    renderRecord.material.destroy();
  }

  #syncTextRenderRecords(paintTexts: readonly CuePaintText[]): void {
    const textRasterizer = this.#textRasterizer;
    const textureEffect = this.#textureEffect;
    if (!textRasterizer || !textureEffect) {
      return;
    }
    const liveElements = new Set<CuePaintText['element']>();
    for (const paintText of paintTexts) {
      liveElements.add(paintText.element);
      const cacheKey = JSON.stringify({
        color: paintText.style.color,
        fontFamily: paintText.style.fontFamily,
        fontSize: paintText.style.fontSize,
        lineHeight: paintText.style.lineHeight,
        lines: paintText.lines,
        pixelScale: textRasterizer.pixelScale,
        textAlign: paintText.style.textAlign,
        whiteSpace: paintText.style.whiteSpace,
        width: paintText.width,
      });
      let renderRecord = this.#textRenderRecords.get(paintText.element);
      if (renderRecord?.cacheKey !== cacheKey) {
        if (renderRecord) {
          this.#destroyTextRenderRecord(renderRecord);
        }
        renderRecord = this.#reconstructTextRenderRecord(
          paintText,
          cacheKey,
          textureEffect,
          textRasterizer,
        );
        if (renderRecord) {
          this.#textRenderRecords.set(paintText.element, renderRecord);
        } else {
          this.#textRenderRecords.delete(paintText.element);
        }
      }
      if (!renderRecord) {
        continue;
      }
      writeTextureVertexBuffer(
        renderRecord.localVertexBuffer,
        paintText,
        textTextureCoordinates,
      );
      updateGfxBuffer(
        renderRecord.vertexBuffer,
        renderRecord.localVertexBuffer,
      );
      updateTextureModelBounds(renderRecord.model, paintText);
      renderRecord.model.enabled = this.enabledInHierarchy;
    }
    for (const [element, renderRecord] of this.#textRenderRecords) {
      if (!liveElements.has(element)) {
        this.#textRenderRecords.delete(element);
        this.#destroyTextRenderRecord(renderRecord);
      }
    }
  }

  #reconstructTextRenderRecord(
    paintText: CuePaintText,
    cacheKey: string,
    textureEffect: EffectAsset,
    textRasterizer: CanvasTextRasterizer,
  ): CueTextRenderRecord | undefined {
    const renderScene = this.node.scene?.renderScene;
    if (!renderScene) {
      return undefined;
    }
    const rasterizedText = textRasterizer.rasterize(paintText);
    const texture = new Texture2D();
    texture.reset({
      format: Texture2D.PixelFormat.RGBA8888,
      height: rasterizedText.canvas.height,
      width: rasterizedText.canvas.width,
    });
    texture.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.LINEAR);
    texture.setWrapMode(
      Texture2D.WrapMode.CLAMP_TO_EDGE,
      Texture2D.WrapMode.CLAMP_TO_EDGE,
    );
    texture.uploadData(rasterizedText.canvas);

    const material = new Material();
    material.reset({
      effectAsset: textureEffect,
    });
    material.setProperty('mainTexture', texture);

    const device = renderScene.root.device;
    const localVertexBuffer = new Float32Array(
      verticesPerQuad * textureVertexStrideFloats,
    );
    const vertexBuffer = device.createBuffer(new gfx.BufferInfo(
      gfx.BufferUsageBit.VERTEX,
      gfx.MemoryUsageBit.DEVICE,
      localVertexBuffer.byteLength,
      Float32Array.BYTES_PER_ELEMENT * textureVertexStrideFloats,
      gfx.BufferFlagBit.NONE,
    ));
    const indexBuffer = device.createBuffer(new gfx.BufferInfo(
      gfx.BufferUsageBit.INDEX,
      gfx.MemoryUsageBit.DEVICE,
      textureIndices.byteLength,
      textureIndices.BYTES_PER_ELEMENT,
      gfx.BufferFlagBit.NONE,
    ));
    updateGfxBuffer(indexBuffer, textureIndices);
    const renderingSubMesh = new RenderingSubMesh(
      [vertexBuffer],
      textureVertexAttributes,
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
    model.priority = 2;
    model.enabled = this.enabledInHierarchy;
    renderScene.addModel(model);
    return {
      cacheKey,
      localVertexBuffer,
      material,
      model,
      renderScene,
      renderingSubMesh,
      texture,
      vertexBuffer,
    };
  }

  #destroyTextRenderRecords(): void {
    for (const renderRecord of this.#textRenderRecords.values()) {
      this.#destroyTextRenderRecord(renderRecord);
    }
    this.#textRenderRecords.clear();
  }

  #destroyTextRenderRecord(renderRecord: CueTextRenderRecord): void {
    renderRecord.renderScene.removeModel(renderRecord.model);
    renderRecord.renderingSubMesh.destroy();
    renderRecord.model.destroy();
    renderRecord.material.destroy();
    renderRecord.texture.destroy();
  }
}

const verticesPerQuad = 4;
const indicesPerQuad = 6;
const positionOffset = 0;
const textureCoordinateOffset = 2;
const colorOffset = 4;
const sizeOffset = 8;
const radiusOffset = 10;
const borderColorOffset = 14;
const borderWidthOffset = 18;
const vertexStrideFloats = 19;
const vertexAttributes = [
  new gfx.Attribute(gfx.AttributeName.ATTR_POSITION, gfx.Format.RG32F),
  new gfx.Attribute(gfx.AttributeName.ATTR_TEX_COORD, gfx.Format.RG32F),
  new gfx.Attribute(gfx.AttributeName.ATTR_COLOR, gfx.Format.RGBA32F),
  new gfx.Attribute(gfx.AttributeName.ATTR_TEX_COORD1, gfx.Format.RG32F),
  new gfx.Attribute(gfx.AttributeName.ATTR_TEX_COORD2, gfx.Format.RGBA32F),
  new gfx.Attribute(gfx.AttributeName.ATTR_TEX_COORD3, gfx.Format.RGBA32F),
  new gfx.Attribute(gfx.AttributeName.ATTR_TEX_COORD4, gfx.Format.R32F),
];
const rectTextureCoordinates = [
  0, 0,
  0, 1,
  1, 1,
  1, 0,
] as const;
const textTextureCoordinates = [
  0, 1,
  0, 0,
  1, 0,
  1, 1,
] as const;
const textureVertexStrideFloats = 4;
const textureVertexAttributes = [
  new gfx.Attribute(gfx.AttributeName.ATTR_POSITION, gfx.Format.RG32F),
  new gfx.Attribute(gfx.AttributeName.ATTR_TEX_COORD, gfx.Format.RG32F),
];
const textureIndices = new Uint16Array([
  0, 1, 2,
  0, 2, 3,
]);

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
    const radii = normalizeRadii(paintRect);
    for (let vertexIndex = 0; vertexIndex < verticesPerQuad; vertexIndex += 1) {
      const vertexOffset = (
        quadIndex * verticesPerQuad + vertexIndex
      ) * vertexStrideFloats;
      const vectorOffset = vertexIndex * 2;
      vertexBuffer[vertexOffset + positionOffset] = positions[vectorOffset] ?? 0;
      vertexBuffer[vertexOffset + positionOffset + 1] = positions[vectorOffset + 1] ?? 0;
      vertexBuffer[vertexOffset + textureCoordinateOffset] = rectTextureCoordinates[vectorOffset] ?? 0;
      vertexBuffer[vertexOffset + textureCoordinateOffset + 1] = rectTextureCoordinates[vectorOffset + 1] ?? 0;
      vertexBuffer[vertexOffset + colorOffset] = paintRect.color.red / 255;
      vertexBuffer[vertexOffset + colorOffset + 1] = paintRect.color.green / 255;
      vertexBuffer[vertexOffset + colorOffset + 2] = paintRect.color.blue / 255;
      vertexBuffer[vertexOffset + colorOffset + 3] = paintRect.color.alpha;
      vertexBuffer[vertexOffset + sizeOffset] = paintRect.width;
      vertexBuffer[vertexOffset + sizeOffset + 1] = paintRect.height;
      for (let radiusIndex = 0; radiusIndex < radii.length; radiusIndex += 1) {
        vertexBuffer[vertexOffset + radiusOffset + radiusIndex] = radii[radiusIndex] ?? 0;
      }
      vertexBuffer[vertexOffset + borderColorOffset] = paintRect.borderColor.red / 255;
      vertexBuffer[vertexOffset + borderColorOffset + 1] = paintRect.borderColor.green / 255;
      vertexBuffer[vertexOffset + borderColorOffset + 2] = paintRect.borderColor.blue / 255;
      vertexBuffer[vertexOffset + borderColorOffset + 3] = paintRect.borderColor.alpha;
      vertexBuffer[vertexOffset + borderWidthOffset] = paintRect.borderWidth;
    }
  }
}

function writeTextureVertexBuffer(
  vertexBuffer: Float32Array,
  paintTexture: Pick<CuePaintText, 'height' | 'width' | 'x' | 'y'>,
  textureCoordinates: readonly number[],
): void {
  const positions = [
    paintTexture.x, paintTexture.y - paintTexture.height,
    paintTexture.x, paintTexture.y,
    paintTexture.x + paintTexture.width, paintTexture.y,
    paintTexture.x + paintTexture.width, paintTexture.y - paintTexture.height,
  ];
  for (let vertexIndex = 0; vertexIndex < verticesPerQuad; vertexIndex += 1) {
    const vertexOffset = vertexIndex * textureVertexStrideFloats;
    const vectorOffset = vertexIndex * 2;
    vertexBuffer[vertexOffset] = positions[vectorOffset] ?? 0;
    vertexBuffer[vertexOffset + 1] = positions[vectorOffset + 1] ?? 0;
    vertexBuffer[vertexOffset + 2] = textureCoordinates[vectorOffset] ?? 0;
    vertexBuffer[vertexOffset + 3] = textureCoordinates[vectorOffset + 1] ?? 0;
  }
}

function spriteFrameTextureCoordinates(
  spriteFrame: SpriteFrame,
): readonly number[] {
  const uv = spriteFrame.uv;
  return [
    uv[0] ?? 0, uv[1] ?? 0,
    uv[4] ?? 0, uv[5] ?? 0,
    uv[6] ?? 0, uv[7] ?? 0,
    uv[2] ?? 0, uv[3] ?? 0,
  ];
}

function normalizeRadii(
  paintRect: CuePaintRect,
): readonly [number, number, number, number] {
  const topLeft = Math.max(paintRect.radii[0], 0);
  const topRight = Math.max(paintRect.radii[1], 0);
  const bottomRight = Math.max(paintRect.radii[2], 0);
  const bottomLeft = Math.max(paintRect.radii[3], 0);
  const scale = Math.min(
    1,
    sideScale(paintRect.width, topLeft + topRight),
    sideScale(paintRect.width, bottomLeft + bottomRight),
    sideScale(paintRect.height, topLeft + bottomLeft),
    sideScale(paintRect.height, topRight + bottomRight),
  );
  return [
    topLeft * scale,
    topRight * scale,
    bottomRight * scale,
    bottomLeft * scale,
  ];
}

function sideScale(sideLength: number, radiiLength: number): number {
  return radiiLength > 0 ? sideLength / radiiLength : 1;
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

function updateTextureModelBounds(
  model: renderer.scene.Model,
  paintTexture: Pick<CuePaintText, 'height' | 'width' | 'x' | 'y'>,
): void {
  model.createBoundingShape(
    new Vec3(paintTexture.x, paintTexture.y - paintTexture.height, 0),
    new Vec3(paintTexture.x + paintTexture.width, paintTexture.y, 0),
  );
  model.updateWorldBound();
}

function loadCueRoundedRectEffect(): Promise<EffectAsset> {
  if (cueRoundedRectEffect instanceof EffectAsset) {
    return Promise.resolve(cueRoundedRectEffect);
  }
  if (cueRoundedRectEffect) {
    return cueRoundedRectEffect;
  }
  cueRoundedRectEffect = loadAsset<EffectAsset>(cueRoundedRectEffectUuid).then((effect) => {
    cueRoundedRectEffect = effect;
    return effect;
  });
  return cueRoundedRectEffect;
}

function loadCueTextureEffect(): Promise<EffectAsset> {
  if (cueTextureEffect instanceof EffectAsset) {
    return Promise.resolve(cueTextureEffect);
  }
  if (cueTextureEffect) {
    return cueTextureEffect;
  }
  cueTextureEffect = loadAsset<EffectAsset>(cueTextureEffectUuid).then((effect) => {
    cueTextureEffect = effect;
    return effect;
  });
  return cueTextureEffect;
}

function isUuidImageSource(source: string): boolean {
  return source.startsWith('uuid:')
    && source.length > 'uuid:'.length
    && !/\s/u.test(source.slice('uuid:'.length));
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

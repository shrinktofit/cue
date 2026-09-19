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
  geometry,
  Material,
  Mat4,
  renderer,
  RenderingSubMesh,
  SpriteFrame,
  Texture2D,
  UITransform,
  Vec3,
  view,
  screen,
  type Asset,
} from 'cc';
import { CueElement } from '../element/cue-element.js';
import {
  CueImageElement,
  getCueImageSource,
} from '../element/cue-image-element.js';
import { CueRootElement } from '../element/cue-root-element.js';
import { cueSubtreeRevision } from '../element/cue-node.js';
import {
  createBackgroundGeometry,
  createRectGeometry,
  type CueRectGeometry,
} from '../render/create-cue-box-geometry.js';
import {
  CuePaintCommandKind,
  CueLayout,
  initializeCueLayout,
  type CuePaintImage,
  type CuePaintBackground,
  type CuePaintList,
  type CuePaintRect,
  type CuePaintShadow,
  type CuePaintText,
} from '../render/create-cue-paint-list.js';
import {
  createShadowGeometry,
  cueShadowVertexStrideFloats,
  type CueShadowGeometry,
} from '../render/create-cue-shadow-geometry.js';
import {
  trackCueStyleSheets,
  type CueStyleSheetCollection,
} from '../style/cue-style-sheet-collection.js';
import { computeCueElementStyle } from '../style/compute-cue-element-style.js';
import { createCueRenderer } from '../vue/create-cue-renderer.js';
import { CanvasTextRasterizer, type RasterizedCueText } from './canvas-text-rasterizer.js';
import { transformCuePaintPoint } from '../render/cue-affine-transform.js';
import { CuePointerController, type CuePointerSample } from '../input/cue-pointer-controller.js';
import { registerCueInputSource } from './cue-input-source.js';
import { CueControlElement } from '../builtin-controls/cue-control-element.js';
import { CueSliderElement, updateCueSliderLayout } from '../builtin-controls/slider/cue-slider-element.js';
import { CueSelectElement, updateCueSelectLayout } from '../builtin-controls/select/cue-select-element.js';
import { CueEditableInputElement, readCueTextInputCaretBox, updateCueTextInputCaret, updateCueTextInputLayout } from '../builtin-controls/text-input/cue-editable-input-element.js';
import { CueFocusController } from '../input/cue-focus-controller.js';
import { CueWheelEvent } from '../input/cue-wheel-event.js';
import { pickCueElement, type CueHitRegion } from '../input/cue-hit-region.js';
import { CueTextInputSource } from './cue-text-input-source.js';
import { activateCueKeyboardSource, releaseCueKeyboardSource, type CueKeyboardClient } from './cue-keyboard-source.js';

const cueRoundedRectEffectUuid = 'bf6467ca-3f41-4b99-8e47-2cc57ddd8cc2';
const cueTextureEffectUuid = '74b6f3ad-ccf0-4ff7-8a19-173225147c3a';
const cueBackgroundEffectUuid = '03694e23-1b5a-4ccd-bf09-94fc7ad3179b';
const cueShadowEffectUuid = '9c30a019-03ef-4c31-afc9-e4638e951c29';

interface CueRenderRecord {
  paintKey?: string;
  readonly baseMaterial: Material;
  readonly indexBuffer: gfx.Buffer;
  readonly indexCount: number;
  readonly localVertexBuffer: Float32Array;
  readonly material: Material;
  readonly model: renderer.scene.Model;
  readonly renderScene: renderer.RenderScene;
  readonly renderingSubMesh: RenderingSubMesh;
  readonly vertexBuffer: gfx.Buffer;
  readonly vertexFloatCount: number;
}

type CueShadowRenderRecord = CueRenderRecord;

interface CueTextRenderRecord {
  paintKey?: string;
  readonly bounds: RasterizedCueText['bounds'];
  readonly baseMaterial: Material;
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
  paintKey?: string;
  readonly baseMaterial: Material;
  readonly localVertexBuffer: Float32Array;
  readonly material: Material;
  readonly model: renderer.scene.Model;
  readonly renderScene: renderer.RenderScene;
  readonly renderingSubMesh: RenderingSubMesh;
  readonly spriteFrame: SpriteFrame;
  readonly texture: SpriteFrame['texture'];
  readonly vertexBuffer: gfx.Buffer;
}

interface CueBackgroundRenderRecord extends CueRenderRecord {
  readonly material: Material;
  readonly texture: Texture2D;
}

let cueRoundedRectEffect: EffectAsset | Promise<EffectAsset> | undefined;
let cueTextureEffect: EffectAsset | Promise<EffectAsset> | undefined;
let cueBackgroundEffect: EffectAsset | Promise<EffectAsset> | undefined;
let cueShadowEffect: EffectAsset | Promise<EffectAsset> | undefined;

@cycloClass('cue.CueDocument')
@executeInEditMode
export class CueDocument extends CycloComponent {
  static async prepare(): Promise<void> {
    await Promise.all([
      initializeCueLayout(),
      loadCueBackgroundEffect(),
      loadCueShadowEffect(),
      loadCueRoundedRectEffect(),
      loadCueTextureEffect(),
    ]);
  }

  get rootElement(): CueRootElement {
    return this.#rootElement;
  }

  get activeElement(): CueControlElement | undefined {
    return this.#focusController.activeElement;
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
    this.#pointerController.cancel();
    this.#focusController.focus(undefined);
    this.#unmount?.();
    this.#unmount = undefined;
    this.#styleSheetCollection?.clear();
    this.#styleSheetCollection = undefined;
    this.#layout?.dispose();
    this.#layout = undefined;
    this.#renderedPaint = undefined;
    this.#pointerController.setRegions([]);
  }

  protected override onAwake(): void {
    void this.#prepareRenderResources();
  }

  protected override onEnabled(): void {
    this.#syncRenderRecordEnabled();
    this.#removeInputSource = registerCueInputSource({
      priority: () => this.#inputCamera()?.priority ?? 0,
      handle: (sample, capturedOnly) => this.#handlePointer(sample, capturedOnly),
      cancel: () => {
        this.#pointerController.cancel();
        this.#focusController.focus(undefined);
      },
      cancelPointer: (pointerId) => this.#pointerController.cancelPointer(pointerId),
      blur: () => this.#focusController.focus(undefined),
      wheel: (sample, event) => {
        const point = this.#pointerPoint(sample);
        const target = point && pickCueElement(this.#hitRegions, point.x, point.y);
        return target ? !target.dispatchEvent(new CueWheelEvent(event)) : false;
      },
    });
  }

  protected override onDisabled(): void {
    this.#syncRenderRecordEnabled();
    this.#removeInputSource?.();
    this.#removeInputSource = undefined;
    this.#focusController.focus(undefined);
  }

  protected override onUpdate(): void {
    const textRasterizer = this.#textRasterizer;
    if (
      !this.#backgroundEffect
      || !this.#shadowEffect
      || !this.#roundedRectEffect
      || !this.#textureEffect
      || !textRasterizer
    ) {
      return;
    }
    const sourcesRevision = cueSubtreeRevision(this.#rootElement) + ':' + (this.#styleSheetCollection?.revision ?? 0);
    if (sourcesRevision !== this.#sourcesRevision) {
      this.#syncImageAssets();
      this.#sourcesRevision = sourcesRevision;
    }
    const layout = this.#layout ??= new CueLayout(
      this.#rootElement,
      textRasterizer,
      (source) => this.#imageAssets.get(source),
      (source) => this.#backgroundAssets.get(source),
    );
    const active = this.activeElement;
    if (active instanceof CueEditableInputElement) updateCueTextInputCaret(active);
    const paint = () => layout.update(
      this.#styleSheetCollection?.styleSheets ?? [],
      this.getComponent(UITransform)?.contentSize,
      this.#assetRevision,
    );
    let paintList = paint();
    let updated = false;
    const controls: CueControlElement[] = [];
    const visit = (element: CueElement): void => {
      if (element instanceof CueControlElement) controls.push(element);
      for (const child of element.children) if (child instanceof CueElement) visit(child);
    };
    if (paintList !== this.#renderedPaint) visit(this.#rootElement);
    for (const element of controls) {
      updated = updateCueTextInputLayout(element, layout.computedStyle(element), textRasterizer, this.#styleSheetCollection?.styleSheets ?? []) || updated;
      if (element instanceof CueSliderElement) {
        updated = updateCueSliderLayout(element, paintList.hitRegions) || updated;
      }
      if (element instanceof CueSelectElement && element.open) {
        updated = updateCueSelectLayout(element, this.#rootElement.clientHeight, paintList.hitRegions) || updated;
      }
    }
    if (updated) {
      paintList = paint();
    }
    if (paintList !== this.#renderedPaint || textRasterizer.pixelScale !== this.#renderedPixelScale) {
      this.#syncRenderRecords(paintList);
      this.#renderedPaint = paintList;
      this.#renderedPixelScale = textRasterizer.pixelScale;
      this.#pointerController.setRegions(paintList.hitRegions);
      this.#hitRegions = paintList.hitRegions;
    }
    if (active) this.#syncTextInputSource();
  }

  protected override onDestroy(): void {
    super.onDestroy();
    this.unmount();
    this.#focusController.dispose();
    this.#textInputSource.dispose();
    this.#removeInputSource?.();
    this.#removeInputSource = undefined;
    this.#destroyRectRenderRecords();
    this.#destroyClipRenderRecords();
    this.#destroyBackgroundRenderRecords();
    this.#destroyShadowRenderRecords();
    this.#destroyImageRenderRecords();
    this.#destroyTextRenderRecords();
    this.#acceptImageAssets = false;
    for (const background of this.#backgroundAssets.values()) {
      background.decRef();
    }
    this.#backgroundAssets.clear();
    this.#backgroundSources.clear();
    this.#reportedBackgroundSources.clear();
    for (const image of this.#imageAssets.values()) {
      image.decRef();
    }
    this.#imageAssets.clear();
    this.#imageSources.clear();
    this.#roundedRectEffect = undefined;
    this.#backgroundEffect = undefined;
    this.#shadowEffect = undefined;
    this.#textureEffect = undefined;
    this.#textRasterizer = undefined;
  }

  readonly #rootElement = new CueRootElement();
  readonly #pointerController = new CuePointerController(this.#rootElement, (target) => {
    let control = target;
    while (control && !(control instanceof CueControlElement)) {
      control = control.parent;
    }
    this.#focusController.focus(control);
  });

  readonly #focusController = new CueFocusController(this.#rootElement, (active) => {
    if (active) {
      activateCueKeyboardSource(this.#keyboardClient);
    } else {
      releaseCueKeyboardSource(this.#keyboardClient);
    }
    this.#syncTextInputSource();
  });

  readonly #textInputSource = new CueTextInputSource();
  readonly #keyboardClient: CueKeyboardClient = {
    handle: (type, init) => {
      const prevented = this.#focusController.handle(type, init);
      this.#syncTextInputSource();
      return prevented;
    },
    ownsTarget: (target) => this.#textInputSource.ownsTarget(target),
    blur: () => this.#focusController.focus(undefined),
  };

  #hitRegions: readonly CueHitRegion[] = [];
  #layout: CueLayout | undefined;
  #renderedPaint: CuePaintList | undefined;
  #renderedPixelScale = 0;
  #sourcesRevision = '';
  #assetRevision = 0;
  #removeInputSource: (() => void) | undefined;
  readonly #backgroundAssets = new Map<string, Texture2D>();
  #backgroundEffect: EffectAsset | undefined;
  readonly #backgroundLoads = new Map<string, Promise<void>>();
  readonly #backgroundRenderRecords = new Map<number, CueBackgroundRenderRecord>();
  readonly #backgroundSources = new Set<string>();
  readonly #reportedBackgroundSources = new Set<string>();
  #shadowEffect: EffectAsset | undefined;
  #shadowRenderRecords: CueShadowRenderRecord[] = [];
  #clipRenderRecords: CueRenderRecord[] = [];
  #acceptImageAssets = true;
  readonly #imageAssets = new Map<string, SpriteFrame>();
  readonly #imageLoads = new Map<string, Promise<void>>();
  readonly #imageRenderRecords = new Map<CueImageElement, CueImageRenderRecord>();
  #imageSources = new Set<string>();
  readonly #reportedImageSources = new Set<string>();
  #rectRenderRecords: CueRenderRecord[] = [];
  #roundedRectEffect: EffectAsset | undefined;
  #styleSheetCollection: CueStyleSheetCollection | undefined;
  #textureEffect: EffectAsset | undefined;
  #textRasterizer: CanvasTextRasterizer | undefined;
  readonly #textRenderRecords = new Map<number, CueTextRenderRecord>();
  #unmount: (() => void) | undefined;

  #inputCamera(): renderer.scene.Camera | undefined {
    return this.node.scene?.renderScene?.cameras
      .filter((camera) => camera.enabled && (camera.visibility & this.node.layer) !== 0)
      .sort((left, right) => right.priority - left.priority)[0];
  }

  #handlePointer(sample: CuePointerSample, capturedOnly: boolean): boolean {
    const captured = this.#pointerController.hasCapturedPointer(sample.pointerId);
    if (capturedOnly && !captured) {
      return false;
    }
    const point = this.#pointerPoint(sample);
    return point ? this.#pointerController.handle({ ...sample, ...point }) : false;
  }

  #pointerPoint(sample: { screenX: number; screenY: number }): { x: number; y: number } | undefined {
    const camera = this.#inputCamera();
    if (!camera) {
      return undefined;
    }
    // Use the same camera and node world transform as the submitted geometry.
    const ray = camera.screenPointToRay(new geometry.Ray(), sample.screenX, sample.screenY);
    const worldToLocal = Mat4.invert(new Mat4(), this.node.worldMatrix);
    const origin = Vec3.transformMat4(new Vec3(), ray.o, worldToLocal);
    const endpoint = Vec3.transformMat4(new Vec3(), Vec3.add(new Vec3(), ray.o, ray.d), worldToLocal);
    const direction = Vec3.subtract(new Vec3(), endpoint, origin);
    if (direction.z === 0) {
      return undefined;
    }
    const distance = -origin.z / direction.z;
    return {
      x: origin.x + direction.x * distance,
      y: -(origin.y + direction.y * distance),
    };
  }

  #syncTextInputSource(): void {
    const active = this.activeElement;
    const region = this.#hitRegions.find((candidate) => candidate.element === active);
    const camera = this.#inputCamera();
    const canvas = document.getElementById('GameCanvas');
    if (!region || !camera || !canvas) {
      this.#textInputSource.sync(active);
      return;
    }
    const caret = active instanceof CueEditableInputElement ? readCueTextInputCaretBox(active) : undefined;
    const point = transformCuePaintPoint(region.transform, region.x + region.borderLeft + (caret?.x ?? 0), region.y + region.borderTop + (caret?.y ?? 0));
    const world = Vec3.transformMat4(new Vec3(), new Vec3(point[0], -point[1], 0), this.node.worldMatrix);
    const projected = camera.worldToScreen(new Vec3(), world);
    const rect = canvas.getBoundingClientRect();
    this.#textInputSource.sync(active, {
      x: rect.left + projected.x / screen.devicePixelRatio,
      y: rect.bottom - projected.y / screen.devicePixelRatio,
      height: caret?.height ?? 20,
    });
  }

  async #prepareRenderResources(): Promise<void> {
    try {
      const [backgroundEffect, roundedRectEffect, shadowEffect, textureEffect] = await Promise.all([
        loadCueBackgroundEffect(),
        loadCueRoundedRectEffect(),
        loadCueShadowEffect(),
        loadCueTextureEffect(),
        initializeCueLayout(),
      ]);
      if (!this.isValid) {
        return;
      }
      this.#roundedRectEffect = roundedRectEffect;
      this.#backgroundEffect = backgroundEffect;
      this.#shadowEffect = shadowEffect;
      this.#textureEffect = textureEffect;
      this.#textRasterizer = new CanvasTextRasterizer(() => view.getScaleX());
    } catch (cause) {
      error('Failed to prepare Cue rendering resources.', cause);
    }
  }

  #syncImageAssets(): void {
    const liveSources = new Set<string>();
    const liveBackgroundSources = new Set<string>();
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
      const backgroundSource = this.#backgroundSource(element);
      if (backgroundSource) {
        liveBackgroundSources.add(backgroundSource);
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

    this.#syncBackgroundAssets(liveBackgroundSources);
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

  #backgroundSource(element: CueElement): string | undefined {
    const style = computeCueElementStyle(
      element,
      this.#styleSheetCollection?.styleSheets ?? [],
    );
    return typeof style.backgroundImage === 'string'
      && style.backgroundImage !== 'none'
      ? style.backgroundImage
      : undefined;
  }

  #syncBackgroundAssets(liveSources: ReadonlySet<string>): void {
    this.#backgroundSources.clear();
    for (const source of liveSources) {
      this.#backgroundSources.add(source);
    }
    for (const [source, texture] of this.#backgroundAssets) {
      if (!liveSources.has(source)) {
        this.#backgroundAssets.delete(source);
        texture.decRef();
      }
    }
    for (const source of this.#reportedBackgroundSources) {
      if (!liveSources.has(source)) {
        this.#reportedBackgroundSources.delete(source);
      }
    }
    for (const source of liveSources) {
      if (
        !this.#backgroundAssets.has(source)
        && !this.#backgroundLoads.has(source)
        && !this.#reportedBackgroundSources.has(source)
      ) {
        this.#loadBackground(source);
      }
    }
  }

  #loadBackground(source: string): void {
    const loading = loadAsset<Texture2D>(source.slice('uuid:'.length))
      .then((texture) => {
        if (!(texture instanceof Texture2D)) {
          throw new TypeError(
            `background-image source ${JSON.stringify(source)} is not a Texture2D asset.`,
          );
        }
        if (!this.#acceptImageAssets || !this.#backgroundSources.has(source)) {
          return;
        }
        texture.addRef();
        this.#backgroundAssets.set(source, texture);
        this.#assetRevision++;
      })
      .catch((cause: unknown) => {
        if (
          this.#acceptImageAssets
          && this.#backgroundSources.has(source)
          && !this.#reportedBackgroundSources.has(source)
        ) {
          this.#reportedBackgroundSources.add(source);
          error(
            `Failed to load background-image source ${JSON.stringify(source)}.`,
            cause,
          );
        }
      })
      .finally(() => {
        if (this.#backgroundLoads.get(source) === loading) {
          this.#backgroundLoads.delete(source);
        }
      });
    this.#backgroundLoads.set(source, loading);
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
        this.#assetRevision++;
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
    const rectRuns: Array<{
      clipDepth: number;
      priority: number;
      rects: CuePaintRect[];
    }> = [];
    const clips: Array<{
      entering: boolean;
      priority: number;
      rect: CuePaintRect;
    }> = [];
    const backgrounds: CuePaintBackground[] = [];
    const shadowRuns: Array<{
      clipDepth: number;
      priority: number;
      shadows: CuePaintShadow[];
    }> = [];
    const images: CuePaintImage[] = [];
    const texts: CuePaintText[] = [];
    for (const [priority, command] of paintList.commands.entries()) {
      switch (command.kind) {
      case CuePaintCommandKind.background:
        backgrounds.push(command.paint);
        break;
      case CuePaintCommandKind.rect: {
        const lastRun = rectRuns.at(-1);
        if (
          lastRun?.clipDepth === command.paint.clipDepth
          && lastRun.priority + lastRun.rects.length === priority
        ) {
          lastRun.rects.push(command.paint);
        } else {
          rectRuns.push({
            clipDepth: command.paint.clipDepth,
            priority,
            rects: [command.paint],
          });
        }
        break;
      }
      case CuePaintCommandKind.clipEnter:
      case CuePaintCommandKind.clipExit:
        clips.push({
          entering: command.kind === CuePaintCommandKind.clipEnter,
          priority,
          rect: command.paint,
        });
        break;
      case CuePaintCommandKind.shadow: {
        const lastRun = shadowRuns.at(-1);
        if (
          lastRun?.clipDepth === command.paint.clipDepth
          && lastRun.priority + lastRun.shadows.length === priority
        ) {
          lastRun.shadows.push(command.paint);
        } else {
          shadowRuns.push({
            clipDepth: command.paint.clipDepth,
            priority,
            shadows: [command.paint],
          });
        }
        break;
      }
      case CuePaintCommandKind.image:
        images.push(command.paint);
        break;
      case CuePaintCommandKind.text:
        texts.push(command.paint);
        break;
      }
    }
    this.#syncClipRenderRecords(clips);
    this.#syncBackgroundRenderRecords(backgrounds);
    this.#syncShadowRenderRecords(shadowRuns);
    this.#syncRectRenderRecords(rectRuns);
    this.#syncImageRenderRecords(images);
    this.#syncTextRenderRecords(texts);
    let textIndex = 0;
    let backgroundIndex = 0;
    for (const [priority, command] of paintList.commands.entries()) {
      if (command.kind === CuePaintCommandKind.background) {
        const model = this.#backgroundRenderRecords.get(
          backgroundIndex++,
        )?.model;
        if (model) {
          model.priority = priority;
        }
      } else if (command.kind === CuePaintCommandKind.image) {
        const model = this.#imageRenderRecords.get(command.paint.element)?.model;
        if (model) {
          model.priority = priority;
        }
      } else if (command.kind === CuePaintCommandKind.text) {
        const model = this.#textRenderRecords.get(textIndex++)?.model;
        if (model) {
          model.priority = priority;
        }
      }
    }
  }

  #syncRectRenderRecords(
    runs: ReadonlyArray<{
      clipDepth: number;
      priority: number;
      rects: readonly CuePaintRect[];
    }>,
  ): void {
    while (this.#rectRenderRecords.length > runs.length) {
      const record = this.#rectRenderRecords.pop();
      if (record) {
        this.#destroyRectRenderRecord(record);
      }
    }
    for (const [runIndex, run] of runs.entries()) {
      let record = this.#rectRenderRecords[runIndex];
      const paintKey = JSON.stringify(run);
      if (record?.paintKey === paintKey) continue;
      const geometry = createRectGeometry(run.rects);
      if (
        record?.vertexFloatCount !== geometry.vertices.length
        || record.indexCount !== geometry.indices.length
      ) {
        if (record) {
          this.#destroyRectRenderRecord(record);
        }
        record = this.#createRectRenderRecord(geometry);
        if (!record) {
          continue;
        }
        this.#rectRenderRecords[runIndex] = record;
      }
      record.paintKey = paintKey;
      record.localVertexBuffer.set(geometry.vertices);
      configureClipRead(record.material, run.clipDepth);
      record.model.setSubModelMaterial(0, record.material);
      updateGfxBuffer(record.vertexBuffer, record.localVertexBuffer);
      updateGfxBuffer(record.indexBuffer, geometry.indices);
      updateGeometryModelBounds(record.model, geometry.vertices, vertexStrideFloats);
      record.model.priority = run.priority;
      record.model.enabled = this.enabledInHierarchy;
    }
  }

  #createRectRenderRecord(
    geometry: CueRectGeometry,
  ): CueRenderRecord | undefined {
    const renderScene = this.node.scene?.renderScene;
    const effect = this.#roundedRectEffect;
    if (!renderScene || !effect) {
      return undefined;
    }
    const material = new Material();
    material.reset({
      effectAsset: effect,
    });
    const materialInstance = new renderer.MaterialInstance({
      parent: material,
    });

    const device = renderScene.root.device;
    const localVertexBuffer = new Float32Array(
      geometry.vertices.length,
    );
    const vertexBuffer = device.createBuffer(new gfx.BufferInfo(
      gfx.BufferUsageBit.VERTEX,
      gfx.MemoryUsageBit.DEVICE,
      localVertexBuffer.byteLength,
      Float32Array.BYTES_PER_ELEMENT * vertexStrideFloats,
      gfx.BufferFlagBit.NONE,
    ));
    const indexBuffer = device.createBuffer(new gfx.BufferInfo(
      gfx.BufferUsageBit.INDEX,
      gfx.MemoryUsageBit.DEVICE,
      geometry.indices.byteLength,
      geometry.indices.BYTES_PER_ELEMENT,
      gfx.BufferFlagBit.NONE,
    ));
    updateGfxBuffer(indexBuffer, geometry.indices);
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
    model.initSubModel(0, renderingSubMesh, materialInstance);
    model.visFlags = this.node.layer;
    model.enabled = this.enabledInHierarchy;
    renderScene.addModel(model);
    return {
      baseMaterial: material,
      localVertexBuffer,
      material: materialInstance,
      indexBuffer,
      indexCount: geometry.indices.length,
      model,
      renderScene,
      renderingSubMesh,
      vertexBuffer,
      vertexFloatCount: geometry.vertices.length,
    };
  }

  #destroyRectRenderRecords(): void {
    for (const record of this.#rectRenderRecords) {
      this.#destroyRectRenderRecord(record);
    }
    this.#rectRenderRecords = [];
  }

  #destroyRectRenderRecord(renderRecord: CueRenderRecord): void {
    renderRecord.renderScene.removeModel(renderRecord.model);
    renderRecord.renderingSubMesh.destroy();
    renderRecord.model.destroy();
    renderRecord.material.destroy();
    renderRecord.baseMaterial.destroy();
  }

  #syncClipRenderRecords(
    clips: ReadonlyArray<{
      entering: boolean;
      priority: number;
      rect: CuePaintRect;
    }>,
  ): void {
    while (this.#clipRenderRecords.length > clips.length) {
      const record = this.#clipRenderRecords.pop();
      if (record) {
        this.#destroyRectRenderRecord(record);
      }
    }
    for (const [clipIndex, clip] of clips.entries()) {
      let record = this.#clipRenderRecords[clipIndex];
      const paintKey = JSON.stringify(clip);
      if (record?.paintKey === paintKey) continue;
      const geometry = createRectGeometry([clip.rect]);
      if (
        record?.vertexFloatCount !== geometry.vertices.length
        || record.indexCount !== geometry.indices.length
      ) {
        if (record) {
          this.#destroyRectRenderRecord(record);
        }
        record = this.#createRectRenderRecord(geometry);
        if (!record) {
          continue;
        }
        this.#clipRenderRecords[clipIndex] = record;
      }
      record.paintKey = paintKey;
      record.localVertexBuffer.set(geometry.vertices);
      configureClipWrite(
        record.material,
        clip.rect.clipDepth,
        clip.entering,
      );
      record.model.setSubModelMaterial(0, record.material);
      updateGfxBuffer(record.vertexBuffer, record.localVertexBuffer);
      updateGfxBuffer(record.indexBuffer, geometry.indices);
      updateGeometryModelBounds(record.model, geometry.vertices, vertexStrideFloats);
      record.model.priority = clip.priority;
      record.model.enabled = this.enabledInHierarchy;
    }
  }

  #destroyClipRenderRecords(): void {
    for (const record of this.#clipRenderRecords) {
      this.#destroyRectRenderRecord(record);
    }
    this.#clipRenderRecords = [];
  }

  #syncBackgroundRenderRecords(
    backgrounds: readonly CuePaintBackground[],
  ): void {
    const effect = this.#backgroundEffect;
    if (!effect) {
      return;
    }
    for (const [index, background] of backgrounds.entries()) {
      let record = this.#backgroundRenderRecords.get(index);
      const paintKey = JSON.stringify([texturePaintKey(background), background.radii,
        background.imageOffsetX, background.imageOffsetY, background.texture.width, background.texture.height]);
      if (record?.paintKey === paintKey && record.texture === background.texture) continue;
      const geometry = createBackgroundGeometry(background);
      if (
        record
        && (
          record.texture !== background.texture
          || record.vertexFloatCount !== geometry.vertices.length
          || record.indexCount !== geometry.indices.length
        )
      ) {
        this.#destroyBackgroundRenderRecord(record);
        record = undefined;
      }
      if (!record) {
        record = this.#createBackgroundRenderRecord(
          background,
          geometry,
          effect,
        );
        if (record) {
          this.#backgroundRenderRecords.set(index, record);
        }
      }
      if (!record) {
        continue;
      }
      record.localVertexBuffer.set(geometry.vertices);
      configureClipRead(record.material, background.clipDepth);
      record.paintKey = paintKey;
      record.model.setSubModelMaterial(0, record.material);
      updateGfxBuffer(record.vertexBuffer, record.localVertexBuffer);
      updateGfxBuffer(record.indexBuffer, geometry.indices);
      updateGeometryModelBounds(record.model, geometry.vertices, textureVertexStrideFloats);
      record.model.enabled = this.enabledInHierarchy;
    }
    for (const [index, record] of this.#backgroundRenderRecords) {
      if (index >= backgrounds.length) {
        this.#backgroundRenderRecords.delete(index);
        this.#destroyBackgroundRenderRecord(record);
      }
    }
  }

  #createBackgroundRenderRecord(
    background: CuePaintBackground,
    geometry: CueRectGeometry,
    effect: EffectAsset,
  ): CueBackgroundRenderRecord | undefined {
    const renderScene = this.node.scene?.renderScene;
    if (!renderScene) {
      return undefined;
    }
    const baseMaterial = new Material();
    baseMaterial.reset({
      effectAsset: effect,
    });
    const material = new renderer.MaterialInstance({
      parent: baseMaterial,
    });
    material.setProperty('mainTexture', background.texture);
    const device = renderScene.root.device;
    const localVertexBuffer = new Float32Array(geometry.vertices.length);
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
      geometry.indices.byteLength,
      geometry.indices.BYTES_PER_ELEMENT,
      gfx.BufferFlagBit.NONE,
    ));
    updateGfxBuffer(indexBuffer, geometry.indices);
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
    model.enabled = this.enabledInHierarchy;
    renderScene.addModel(model);
    return {
      baseMaterial,
      indexBuffer,
      indexCount: geometry.indices.length,
      localVertexBuffer,
      material,
      model,
      renderScene,
      renderingSubMesh,
      texture: background.texture,
      vertexBuffer,
      vertexFloatCount: geometry.vertices.length,
    };
  }

  #destroyBackgroundRenderRecords(): void {
    for (const record of this.#backgroundRenderRecords.values()) {
      this.#destroyBackgroundRenderRecord(record);
    }
    this.#backgroundRenderRecords.clear();
  }

  #destroyBackgroundRenderRecord(record: CueBackgroundRenderRecord): void {
    record.renderScene.removeModel(record.model);
    record.renderingSubMesh.destroy();
    record.model.destroy();
    record.material.destroy();
    record.baseMaterial.destroy();
  }

  #syncShadowRenderRecords(
    runs: ReadonlyArray<{
      clipDepth: number;
      priority: number;
      shadows: readonly CuePaintShadow[];
    }>,
  ): void {
    while (this.#shadowRenderRecords.length > runs.length) {
      const record = this.#shadowRenderRecords.pop();
      if (record) {
        this.#destroyShadowRenderRecord(record);
      }
    }
    for (const [runIndex, run] of runs.entries()) {
      let record = this.#shadowRenderRecords[runIndex];
      const paintKey = JSON.stringify(run);
      if (record?.paintKey === paintKey) continue;
      const geometry = createShadowGeometry(run.shadows);
      if (
        record?.vertexFloatCount !== geometry.vertices.length
        || record.indexCount !== geometry.indices.length
      ) {
        if (record) {
          this.#destroyShadowRenderRecord(record);
        }
        record = this.#createShadowRenderRecord(geometry);
        if (!record) {
          continue;
        }
        this.#shadowRenderRecords[runIndex] = record;
      }
      record.paintKey = paintKey;
      record.localVertexBuffer.set(geometry.vertices);
      configureClipRead(record.material, run.clipDepth);
      record.model.setSubModelMaterial(0, record.material);
      updateGfxBuffer(record.vertexBuffer, record.localVertexBuffer);
      updateGfxBuffer(record.indexBuffer, geometry.indices);
      updateGeometryModelBounds(record.model, geometry.vertices, cueShadowVertexStrideFloats);
      record.model.priority = run.priority;
      record.model.enabled = this.enabledInHierarchy;
    }
  }

  #createShadowRenderRecord(
    geometry: CueShadowGeometry,
  ): CueShadowRenderRecord | undefined {
    const renderScene = this.node.scene?.renderScene;
    const effect = this.#shadowEffect;
    if (!renderScene || !effect) {
      return undefined;
    }
    const baseMaterial = new Material();
    baseMaterial.reset({
      effectAsset: effect,
    });
    const material = new renderer.MaterialInstance({
      parent: baseMaterial,
    });
    const device = renderScene.root.device;
    const localVertexBuffer = new Float32Array(geometry.vertices.length);
    const vertexBuffer = device.createBuffer(new gfx.BufferInfo(
      gfx.BufferUsageBit.VERTEX,
      gfx.MemoryUsageBit.DEVICE,
      localVertexBuffer.byteLength,
      Float32Array.BYTES_PER_ELEMENT * cueShadowVertexStrideFloats,
      gfx.BufferFlagBit.NONE,
    ));
    const indexBuffer = device.createBuffer(new gfx.BufferInfo(
      gfx.BufferUsageBit.INDEX,
      gfx.MemoryUsageBit.DEVICE,
      geometry.indices.byteLength,
      geometry.indices.BYTES_PER_ELEMENT,
      gfx.BufferFlagBit.NONE,
    ));
    updateGfxBuffer(indexBuffer, geometry.indices);
    const renderingSubMesh = new RenderingSubMesh(
      [vertexBuffer],
      shadowVertexAttributes,
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
    return {
      baseMaterial,
      indexBuffer,
      indexCount: geometry.indices.length,
      localVertexBuffer,
      material,
      model,
      renderScene,
      renderingSubMesh,
      vertexBuffer,
      vertexFloatCount: geometry.vertices.length,
    };
  }

  #destroyShadowRenderRecords(): void {
    for (const record of this.#shadowRenderRecords) {
      this.#destroyShadowRenderRecord(record);
    }
    this.#shadowRenderRecords = [];
  }

  #destroyShadowRenderRecord(record: CueShadowRenderRecord): void {
    record.renderScene.removeModel(record.model);
    record.renderingSubMesh.destroy();
    record.model.destroy();
    record.material.destroy();
    record.baseMaterial.destroy();
  }

  #syncRenderRecordEnabled(): void {
    for (const record of this.#rectRenderRecords) {
      record.model.enabled = this.enabledInHierarchy;
    }
    for (const record of this.#clipRenderRecords) {
      record.model.enabled = this.enabledInHierarchy;
    }
    for (const record of this.#backgroundRenderRecords.values()) {
      record.model.enabled = this.enabledInHierarchy;
    }
    for (const record of this.#shadowRenderRecords) {
      record.model.enabled = this.enabledInHierarchy;
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
      const coordinates = spriteFrameTextureCoordinates(paintImage.spriteFrame);
      const paintKey = JSON.stringify([texturePaintKey(paintImage), coordinates]);
      if (renderRecord.paintKey === paintKey) continue;
      renderRecord.paintKey = paintKey;
      writeTextureVertexBuffer(
        renderRecord.localVertexBuffer,
        paintImage,
        coordinates,
      );
      configureClipRead(renderRecord.material, paintImage.clipDepth);
      renderRecord.model.setSubModelMaterial(0, renderRecord.material);
      updateGfxBuffer(
        renderRecord.vertexBuffer,
        renderRecord.localVertexBuffer,
      );
      updateGeometryModelBounds(
        renderRecord.model,
        renderRecord.localVertexBuffer,
        textureVertexStrideFloats,
      );
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
    const baseMaterial = new Material();
    baseMaterial.reset({
      effectAsset: textureEffect,
    });
    const material = new renderer.MaterialInstance({
      parent: baseMaterial,
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
    model.enabled = this.enabledInHierarchy;
    renderScene.addModel(model);
    return {
      baseMaterial,
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
    renderRecord.baseMaterial.destroy();
  }

  #syncTextRenderRecords(paintTexts: readonly CuePaintText[]): void {
    const textRasterizer = this.#textRasterizer;
    const textureEffect = this.#textureEffect;
    if (!textRasterizer || !textureEffect) {
      return;
    }
    for (const [index, paintText] of paintTexts.entries()) {
      const cacheKey = JSON.stringify({
        color: paintText.style.color,
        fontFamily: paintText.style.fontFamily,
        fontSize: paintText.style.fontSize,
        fontWeight: paintText.style.fontWeight,
        fontRevision: textRasterizer.fontRevision,
        cueTextStrokeColor: paintText.style.cueTextStrokeColor,
        cueTextStrokeWidth: paintText.style.cueTextStrokeWidth,
        height: paintText.height,
        lineHeight: paintText.style.lineHeight,
        lines: paintText.lines,
        pixelScale: textRasterizer.pixelScale,
        textAlign: paintText.style.textAlign,
        whiteSpace: paintText.style.whiteSpace,
        width: paintText.width,
      });
      let renderRecord = this.#textRenderRecords.get(index);
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
          this.#textRenderRecords.set(index, renderRecord);
        } else {
          this.#textRenderRecords.delete(index);
        }
      }
      if (!renderRecord) {
        continue;
      }
      const paintKey = texturePaintKey(paintText);
      if (renderRecord.paintKey === paintKey) continue;
      renderRecord.paintKey = paintKey;
      writeTextureVertexBuffer(
        renderRecord.localVertexBuffer,
        {
          ...paintText,
          x: paintText.x + renderRecord.bounds.x,
          y: paintText.y - renderRecord.bounds.y,
          width: renderRecord.bounds.width,
          height: renderRecord.bounds.height,
        },
        textTextureCoordinates,
      );
      configureClipRead(renderRecord.material, paintText.clipDepth);
      renderRecord.model.setSubModelMaterial(0, renderRecord.material);
      updateGfxBuffer(
        renderRecord.vertexBuffer,
        renderRecord.localVertexBuffer,
      );
      updateGeometryModelBounds(
        renderRecord.model,
        renderRecord.localVertexBuffer,
        textureVertexStrideFloats,
      );
      renderRecord.model.enabled = this.enabledInHierarchy;
    }
    for (const [index, renderRecord] of this.#textRenderRecords) {
      if (index >= paintTexts.length) {
        this.#textRenderRecords.delete(index);
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

    const baseMaterial = new Material();
    baseMaterial.reset({
      effectAsset: textureEffect,
    });
    const material = new renderer.MaterialInstance({
      parent: baseMaterial,
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
    model.enabled = this.enabledInHierarchy;
    renderScene.addModel(model);
    return {
      baseMaterial,
      cacheKey,
      bounds: rasterizedText.bounds,
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
    renderRecord.baseMaterial.destroy();
    renderRecord.texture.destroy();
  }
}

const verticesPerQuad = 4;
const vertexStrideFloats = 6;
const vertexAttributes = [
  new gfx.Attribute(gfx.AttributeName.ATTR_POSITION, gfx.Format.RG32F),
  new gfx.Attribute(gfx.AttributeName.ATTR_COLOR, gfx.Format.RGBA32F),
];
const textTextureCoordinates = [
  0, 1,
  0, 0,
  1, 0,
  1, 1,
] as const;
const textureVertexStrideFloats = 8;
const textureVertexAttributes = [
  new gfx.Attribute(gfx.AttributeName.ATTR_POSITION, gfx.Format.RG32F),
  new gfx.Attribute(gfx.AttributeName.ATTR_TEX_COORD, gfx.Format.RG32F),
  new gfx.Attribute(gfx.AttributeName.ATTR_COLOR, gfx.Format.RGBA32F),
];
const shadowVertexAttributes = [
  new gfx.Attribute(gfx.AttributeName.ATTR_POSITION, gfx.Format.RG32F),
  new gfx.Attribute(gfx.AttributeName.ATTR_TEX_COORD, gfx.Format.RG32F),
  new gfx.Attribute(gfx.AttributeName.ATTR_TEX_COORD1, gfx.Format.RG32F),
  new gfx.Attribute(gfx.AttributeName.ATTR_TEX_COORD2, gfx.Format.RGBA32F),
  new gfx.Attribute(gfx.AttributeName.ATTR_TEX_COORD3, gfx.Format.RGBA32F),
  new gfx.Attribute(gfx.AttributeName.ATTR_COLOR, gfx.Format.RGBA32F),
  new gfx.Attribute(gfx.AttributeName.ATTR_TEX_COORD4, gfx.Format.RGBA32F),
  new gfx.Attribute(gfx.AttributeName.ATTR_TEX_COORD5, gfx.Format.RGB32F),
];
const textureIndices = new Uint16Array([
  0, 1, 2,
  0, 2, 3,
]);

function writeTextureVertexBuffer(
  vertexBuffer: Float32Array,
  paintTexture: Pick<CuePaintText, 'height' | 'opacity' | 'width' | 'x' | 'y' | 'transform'>,
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
    const [x, y] = transformCuePaintPoint(
      paintTexture.transform,
      positions[vectorOffset] ?? 0,
      positions[vectorOffset + 1] ?? 0,
    );
    vertexBuffer[vertexOffset] = x;
    vertexBuffer[vertexOffset + 1] = y;
    vertexBuffer[vertexOffset + 2] = textureCoordinates[vectorOffset] ?? 0;
    vertexBuffer[vertexOffset + 3] = textureCoordinates[vectorOffset + 1] ?? 0;
    vertexBuffer[vertexOffset + 4] = 1;
    vertexBuffer[vertexOffset + 5] = 1;
    vertexBuffer[vertexOffset + 6] = 1;
    vertexBuffer[vertexOffset + 7] = paintTexture.opacity;
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

function updateGeometryModelBounds(
  model: renderer.scene.Model,
  vertices: Float32Array,
  stride: number,
): void {
  let xMin = Number.POSITIVE_INFINITY;
  let yMin = Number.POSITIVE_INFINITY;
  let xMax = Number.NEGATIVE_INFINITY;
  let yMax = Number.NEGATIVE_INFINITY;
  for (let offset = 0; offset < vertices.length; offset += stride) {
    xMin = Math.min(xMin, vertices[offset]!);
    yMin = Math.min(yMin, vertices[offset + 1]!);
    xMax = Math.max(xMax, vertices[offset]!);
    yMax = Math.max(yMax, vertices[offset + 1]!);
  }
  if (!Number.isFinite(xMin)) {
    return;
  }
  model.createBoundingShape(
    new Vec3(xMin, yMin, 0),
    new Vec3(xMax, yMax, 0),
  );
  model.updateWorldBound();
}

function configureClipRead(material: Material, clipDepth: number): void {
  const stencilTest = clipDepth > 0;
  material.overridePipelineStates({
    depthStencilState: {
      stencilFuncBack: gfx.ComparisonFunc.EQUAL,
      stencilFuncFront: gfx.ComparisonFunc.EQUAL,
      stencilPassOpBack: gfx.StencilOp.KEEP,
      stencilPassOpFront: gfx.StencilOp.KEEP,
      stencilReadMaskBack: 0xFF,
      stencilReadMaskFront: 0xFF,
      stencilRefBack: clipDepth,
      stencilRefFront: clipDepth,
      stencilTestBack: stencilTest,
      stencilTestFront: stencilTest,
      stencilWriteMaskBack: 0,
      stencilWriteMaskFront: 0,
    },
  });
}

function configureClipWrite(
  material: Material,
  clipDepth: number,
  entering: boolean,
): void {
  const operation = entering ? gfx.StencilOp.INCR : gfx.StencilOp.DECR;
  const reference = entering ? clipDepth : clipDepth + 1;
  material.overridePipelineStates({
    blendState: {
      targets: [{
        blendColorMask: gfx.ColorMask.NONE,
      }],
    },
    depthStencilState: {
      stencilFailOpBack: gfx.StencilOp.KEEP,
      stencilFailOpFront: gfx.StencilOp.KEEP,
      stencilFuncBack: gfx.ComparisonFunc.EQUAL,
      stencilFuncFront: gfx.ComparisonFunc.EQUAL,
      stencilPassOpBack: operation,
      stencilPassOpFront: operation,
      stencilReadMaskBack: 0xFF,
      stencilReadMaskFront: 0xFF,
      stencilRefBack: reference,
      stencilRefFront: reference,
      stencilTestBack: true,
      stencilTestFront: true,
      stencilWriteMaskBack: 0xFF,
      stencilWriteMaskFront: 0xFF,
      stencilZFailOpBack: gfx.StencilOp.KEEP,
      stencilZFailOpFront: gfx.StencilOp.KEEP,
    },
  });
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

function loadCueBackgroundEffect(): Promise<EffectAsset> {
  if (cueBackgroundEffect instanceof EffectAsset) {
    return Promise.resolve(cueBackgroundEffect);
  }
  if (cueBackgroundEffect) {
    return cueBackgroundEffect;
  }
  cueBackgroundEffect = loadAsset<EffectAsset>(cueBackgroundEffectUuid).then((effect) => {
    cueBackgroundEffect = effect;
    return effect;
  });
  return cueBackgroundEffect;
}

function loadCueShadowEffect(): Promise<EffectAsset> {
  if (cueShadowEffect instanceof EffectAsset) {
    return Promise.resolve(cueShadowEffect);
  }
  if (cueShadowEffect) {
    return cueShadowEffect;
  }
  cueShadowEffect = loadAsset<EffectAsset>(cueShadowEffectUuid).then((effect) => {
    cueShadowEffect = effect;
    return effect;
  });
  return cueShadowEffect;
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

function texturePaintKey(paint: Pick<CuePaintImage, 'x' | 'y' | 'width' | 'height' | 'clipDepth' | 'opacity' | 'transform'>): string {
  return JSON.stringify([paint.x, paint.y, paint.width, paint.height, paint.clipDepth, paint.opacity, paint.transform]);
}

function updateGfxBuffer(
  buffer: gfx.Buffer,
  source: gfx.BufferSource | ArrayBufferView,
): void {
  buffer.update(source as gfx.BufferSource);
}

export {};

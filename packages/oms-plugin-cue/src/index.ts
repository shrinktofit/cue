import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  compileCue,
  type CanonicalizeCueImageSourceResult,
  type CompileCueFile,
} from '@bsgames/cue-compiler';
import type { OmsPlugin, OmsPluginContext } from '@oms/plugin';

export interface CuePluginOptions {
  customElements?: readonly string[];
}

interface CompiledComponent {
  entryFileName: string;
  files: CompileCueFile[];
  dependencies: string[];
}

const modulePrefix = '\0cue:';
const cacheKey = 'components';

/** Compile Cue sources in OMS's normal development and production module graph. */
export function cue(options: CuePluginOptions = {}): OmsPlugin {
  return {
    name: 'oms-plugin-cue',
    enforce: 'pre',
    buildStart() {
      // Native plugin caches are separate for each OMS build/profile. A build-local
      // collection also ensures metadata changes never reuse stale UUIDs.
      this.cache.set(cacheKey, {});
    },
    async resolveId(source, importer, resolveOptions) {
      if (source.startsWith(modulePrefix)) {
        return source;
      }
      if (importer?.startsWith(modulePrefix)) {
        const [filename] = JSON.parse(importer.slice(modulePrefix.length)) as [string, string];
        const { importerAttributes, ...forwardedOptions } = resolveOptions;
        return await this.resolve(source, filename, {
          ...forwardedOptions,
          ...(importerAttributes ? { importerAttributes } : {}),
        });
      }
      if (importer?.endsWith('.cue')) {
        const component = compileComponent(this, importer, options);
        const file = component.files.find((candidate) => source === `./${candidate.fileName}`);
        if (file) {
          return modulePrefix + JSON.stringify([importer, file.fileName]);
        }
      }
      return undefined;
    },
    load(id) {
      if (id.startsWith(modulePrefix)) {
        const [filename, fileName] = JSON.parse(id.slice(modulePrefix.length)) as [string, string];
        const component = compileComponent(this, filename, options);
        const file = component.files.find((candidate) => candidate.fileName === fileName);
        if (!file) {
          return this.error(`Unknown Cue module ${fileName} in ${filename}.`);
        }
        return { code: file.code, map: null };
      }
      if (!id.endsWith('.cue')) {
        return undefined;
      }
      const component = compileComponent(this, id, options);
      return { code: component.files.find((file) => file.fileName === component.entryFileName)!.code, map: null };
    },
  };
}

function compileComponent(context: OmsPluginContext, filename: string, options: CuePluginOptions): CompiledComponent {
  const components: Record<string, CompiledComponent> = context.cache.get(cacheKey);
  let component = components[filename];
  if (!component) {
    const dependencies = new Set([filename]);
    context.addWatchFile(filename);
    const canonicalize = (source: string, importer: 'sprite-frame' | 'texture'): CanonicalizeCueImageSourceResult => {
      const assetPath = resolve(dirname(filename), source);
      const metaPath = `${assetPath}.meta`;
      for (const dependency of [assetPath, metaPath]) {
        dependencies.add(dependency);
        // Register before reading so a missing or invalid .meta can recover on change.
        context.addWatchFile(dependency);
      }
      const meta = JSON.parse(readFileSync(metaPath, 'utf8')) as {
        subMetas?: Record<string, { importer?: string; uuid?: string }>;
      };
      const assets = Object.values(meta.subMetas ?? {}).filter((asset) => (
        asset.importer === importer && typeof asset.uuid === 'string' && asset.uuid.length > 0
      ));
      if (assets.length !== 1) {
        return { ok: false, error: new SyntaxError(`Expected exactly one ${importer} subasset in ${metaPath}, found ${assets.length}.`) };
      }
      return { ok: true, source: `uuid:${assets[0]!.uuid}` };
    };
    const result = compileCue(readFileSync(filename, 'utf8'), {
      ...options,
      filename,
      canonicalizeImageSource: (source) => canonicalize(source, 'sprite-frame'),
      canonicalizeBackgroundImageSource: (source) => canonicalize(source, 'texture'),
    });
    if (!result.ok) {
      const first = result.errors[0];
      const location = first && typeof first !== 'string' && 'loc' in first ? first.loc?.start : undefined;
      return context.error({
        message: result.errors.map((error) => typeof error === 'string' ? error : error.message).join('\n'),
        id: filename,
        ...(location ? { loc: { file: filename, line: location.line, column: location.column - 1 } } : {}),
      });
    }
    component = { entryFileName: result.entryFileName, files: result.files, dependencies: [...dependencies] };
    components[filename] = component;
    context.cache.set(cacheKey, components);
  }
  for (const dependency of component.dependencies) {
    context.addWatchFile(dependency);
  }
  return component;
}

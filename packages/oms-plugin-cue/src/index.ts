import { readFileSync } from 'node:fs';
import {
  compileCue,
  cueFileExtension,
  type CompileCueFile,
} from '@bsgames/cue-compiler';
import type { OmsPlugin, OmsPluginContext } from '@oms/plugin';

export interface CuePluginOptions {
  customElements?: readonly string[];
}

interface CompiledComponent {
  entryFileName: string;
  files: CompileCueFile[];
}

const modulePrefix = '\0cue:';
const cacheKey = 'components';

/** Compile Cue sources in OMS's normal development and production module graph. */
export function cue(options: CuePluginOptions = {}): OmsPlugin {
  return {
    name: 'oms-plugin-cue',
    enforce: 'pre',
    buildStart() {
      // Native plugin caches are separate for each OMS build/profile.
      this.cache.set(cacheKey, {});
    },
    async resolveId(source, importer, resolveOptions) {
      if (source.startsWith(modulePrefix)) {
        return source;
      }
      if (importer?.startsWith(modulePrefix)) {
        const [filename] = JSON.parse(importer.slice(modulePrefix.length)) as [
          string,
          string,
        ];
        const { importerAttributes, ...forwardedOptions } = resolveOptions;
        return await this.resolve(source, filename, {
          ...forwardedOptions,
          ...(importerAttributes ? { importerAttributes } : {}),
        });
      }
      if (importer?.endsWith(cueFileExtension)) {
        const component = compileComponent(this, importer, options);
        const file = component.files.find(
          (candidate) => source === `./${candidate.fileName}`,
        );
        if (file) {
          return modulePrefix + JSON.stringify([importer, file.fileName]);
        }
      }
      return undefined;
    },
    load(id) {
      if (id.startsWith(modulePrefix)) {
        const [filename, fileName] = JSON.parse(id.slice(modulePrefix.length)) as [
          string,
          string,
        ];
        const component = compileComponent(this, filename, options);
        const file = component.files.find((candidate) => candidate.fileName === fileName);
        if (!file) {
          return this.error(`Unknown Cue module ${fileName} in ${filename}.`);
        }
        return { code: file.code, map: null };
      }
      if (!id.endsWith(cueFileExtension)) {
        return undefined;
      }
      const component = compileComponent(this, id, options);
      return {
        code: component.files.find((file) => file.fileName === component.entryFileName)!
          .code,
        map: null,
      };
    },
  };
}

function compileComponent(
  context: OmsPluginContext,
  filename: string,
  options: CuePluginOptions,
): CompiledComponent {
  const components: Record<string, CompiledComponent> = context.cache.get(cacheKey);
  context.addWatchFile(filename);
  let component = components[filename];
  if (!component) {
    const result = compileCue(readFileSync(filename, 'utf8'), {
      ...options,
      filename,
    });
    if (!result.ok) {
      const first = result.errors[0];
      const location
        = first && typeof first !== 'string' && 'loc' in first
          ? first.loc?.start
          : undefined;
      return context.error({
        message: result.errors
          .map((error) => (typeof error === 'string' ? error : error.message))
          .join('\n'),
        id: filename,
        ...(location
          ? {
            loc: {
              file: filename,
              line: location.line,
              column: location.column - 1,
            },
          }
          : {}),
      });
    }
    component = {
      entryFileName: result.entryFileName,
      files: result.files,
    };
    components[filename] = component;
    context.cache.set(cacheKey, components);
  }
  return component;
}

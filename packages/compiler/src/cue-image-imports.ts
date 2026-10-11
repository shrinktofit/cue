import { posix } from 'node:path';
import type { CueStyleRule } from '@bsgames/cue-style-schema';

/** Module-local asset imports; the bundler owns path resolution and metadata. */
export class CueImageImports {
  constructor(base?: string, reservedNames: ReadonlySet<string> = new Set()) {
    this.#base = base;
    this.#reservedNames = reservedNames;
  }

  readonly bindings = new Map<string, {
    name: string;
    path: string;
    importer: string;
  }>();

  get imports(): string[] {
    return [...this.bindings.values()].map(({ name, path, importer }) =>
      `import ${name} from ${JSON.stringify(path)} with { importer: ${JSON.stringify(importer)} };`,
    );
  }

  expression(source: string, importer: 'sprite-frame' | 'texture'): string {
    const path = this.#base === undefined ? source : posix.join(this.#base, source);
    const specifier = `${path.startsWith('./') || path.startsWith('../') || posix.isAbsolute(path) || /^[A-Za-z]:\//u.test(path)
      ? path
      : `./${path}`}?uuid`;
    const key = JSON.stringify([specifier, importer]);
    let binding = this.bindings.get(key);
    if (!binding) {
      let name: string;
      do {
        name = `_cue_image_${this.#nextIdentifier++}`;
      } while (this.#reservedNames.has(name));
      binding = {
        name,
        path: specifier,
        importer,
      };
      this.bindings.set(key, binding);
    }
    return `("uuid:" + ${binding.name})`;
  }

  styleRule(rule: CueStyleRule, space?: number): string {
    const properties = new Map<string, string>();
    for (const key of ['declarations', 'importantDeclarations'] as const) {
      const declarations = rule[key];
      const source = declarations?.backgroundImage;
      if (typeof source !== 'string' || !source.startsWith('.')) {
        continue;
      }
      properties.set(key, `{ ${Object.entries(declarations!).map(([name, value]) =>
        `${JSON.stringify(name)}: ${name === 'backgroundImage' ? this.expression(source, 'texture') : JSON.stringify(value)}`,
      ).join(', ')} }`);
    }
    if (properties.size === 0) {
      return JSON.stringify(rule, undefined, space);
    }
    return `{ ${Object.entries(rule).map(([key, value]) =>
      `${JSON.stringify(key)}: ${properties.get(key) ?? JSON.stringify(value)}`,
    ).join(', ')} }`;
  }

  readonly #base: string | undefined;
  readonly #reservedNames: ReadonlySet<string>;
  #nextIdentifier = 0;
}

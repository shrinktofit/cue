import { mkdtemp, mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rollup, type Plugin } from 'rollup';
import { afterEach, describe, expect, it } from 'vitest';
import { cue } from '../src/index.js';

const projects: string[] = [];
afterEach(async () => {
  await Promise.all(
    projects.splice(0).map((project) => rm(project, { recursive: true })),
  );
});

async function createProject(files: Record<string, string>): Promise<string> {
  const project = await mkdtemp(join(tmpdir(), 'cue-plugin-'));
  projects.push(project);
  for (const [name, content] of Object.entries(files)) {
    const path = join(project, name);
    await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, content);
  }
  return project;
}

async function build(project: string, plugins: Plugin[] = []) {
  const bundle = await rollup({
    input: join(project, 'app.cc.vue'),
    plugins: [cue(), ...plugins],
    external: ['@bsgames/cue', 'vue'],
    onwarn(warning) {
      throw new Error(warning.message);
    },
  });
  try {
    const { output } = await bundle.generate({ format: 'es' });
    return {
      code: output[0].code,
      watchFiles: bundle.watchFiles,
      cache: bundle.cache,
    };
  } finally {
    await bundle.close();
  }
}

describe('Cue plugin in the Rollup build pipeline', () => {
  it('bundles nested components without writing intermediate modules', async () => {
    /// @case
    /// Two components with the same basename import different helpers relative to their original
    /// .cc.vue files.
    /// @expect
    /// The output preserves both helpers and the source tree contains no generated JavaScript.
    const project = await createProject({
      'app.cc.vue':
        ('<script setup>import Left from "./left/card.cc.vue"; import '
          + 'Right from "./right/card.cc.vue";</script><template><Left/><Rig'
          + 'ht/></template>'),
      'left/card.cc.vue':
        ('<script setup>import { label } from '
          + '"./label.js";</script><template><div>{{ label '
          + '}}</div></template>'),
      'left/label.js': 'export const label = "left-original-directory";',
      'right/card.cc.vue':
        ('<script setup>import { label } from '
          + '"./label.js";</script><template><div>{{ label '
          + '}}</div></template>'),
      'right/label.js': 'export const label = "right-original-directory";',
    });
    const before = await readdir(project, { recursive: true });
    const output = await build(project);
    expect(output.code).toContain('left-original-directory');
    expect(output.code).toContain('right-original-directory');
    expect(await readdir(project, { recursive: true })).toEqual(before);
  });

  it('delegates image imports to the host with the original component importer', async () => {
    /// @case
    /// The host supplies image and background UUID modules without local metadata.
    /// @expect
    /// Imports select distinct SpriteFrame/Texture2D assets relative to the source,
    /// and compiled properties use the existing uuid: string contract.
    const project = await createProject({
      'app.cc.vue':
        ('<template><cue-image src="./icon\'s.png" class="icon" '
          + '/></template><style>.icon { background-image: '
          + 'url("./icon\'s.png"); }</style>'),
    });
    const imports: Array<{ filename: string | undefined; importer: string | undefined }> = [];
    const output = await build(project, [
      {
        name: 'test:host-uuid',
        resolveId(source, importer, options) {
          if (source === './icon\'s.png?uuid') {
            imports.push({ filename: importer, importer: options.attributes.importer });
            expect(['sprite-frame', 'texture']).toContain(options.attributes.importer);
            return '\0host:' + options.attributes.importer;
          }
          return undefined;
        },
        load(id) {
          return id.startsWith('\0host:')
            ? `export default ${JSON.stringify(id.slice('\0host:'.length) + '-uuid')};`
            : undefined;
        },
      },
    ]);
    expect(imports).toHaveLength(2);
    expect(imports.every((entry) => entry.filename === join(project, 'app.cc.vue'))).toBe(true);
    expect(imports.map((entry) => entry.importer).sort()).toEqual([
      'sprite-frame',
      'texture',
    ]);
    expect(output.code).toContain('"uuid:" + _cue_image_0');
    expect(output.code).toContain('sprite-frame-uuid');
    expect(output.code).toContain('texture-uuid');
  });

  it('reports the original source location for an unsupported template binding', async () => {
    /// @case
    /// A directly imported source contains an unsupported dynamic style binding.
    /// @expect
    /// The build fails with the .cc.vue filename and original source line, not a generated module
    /// path.
    const project = await createProject({
      'app.cc.vue': '<template>\n  <div :style="appearance" />\n</template>',
    });
    await expect(build(project)).rejects.toMatchObject({
      id: join(project, 'app.cc.vue'),
      loc: { line: 2, column: 7 },
      message: expect.stringContaining('Dynamic :style'),
    });
  });
});

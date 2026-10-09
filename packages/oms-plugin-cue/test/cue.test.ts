import { mkdtemp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rollup, type RollupCache } from 'rollup';
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

async function build(project: string, cache?: RollupCache) {
  const bundle = await rollup({
    input: join(project, 'app.cc.vue'),
    plugins: [cue()],
    external: ['@bsgames/cue', 'vue'],
    cache,
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

  it('watches image metadata and recompiles unchanged source with the native cache', async () => {
    /// @case
    /// A source uses one image as a SpriteFrame and a background Texture2D, then only its
    /// metadata changes.
    /// @expect
    /// Both canonical UUIDs update and the original source, asset and metadata are watched.
    const project = await createProject({
      'app.cc.vue':
        ('<template><cue-image src="./icon.png" class="icon" '
          + '/></template><style>.icon { background-image: '
          + 'url("./icon.png"); }</style>'),
      'icon.png': '',
      'icon.png.meta': JSON.stringify({
        subMetas: {
          sprite: { importer: 'sprite-frame', uuid: 'sprite-before' },
          texture: { importer: 'texture', uuid: 'texture-before' },
        },
      }),
    });
    const first = await build(project);
    expect(first.code).toContain('uuid:sprite-before');
    expect(first.code).toContain('uuid:texture-before');
    expect(first.watchFiles).toEqual(
      expect.arrayContaining([
        join(project, 'app.cc.vue'),
        join(project, 'icon.png'),
        join(project, 'icon.png.meta'),
      ]),
    );
    const metaPath = join(project, 'icon.png.meta');
    await writeFile(
      metaPath,
      (await readFile(metaPath, 'utf8')).replaceAll('before', 'after'),
    );
    const second = await build(project, first.cache);
    expect(second.code).toContain('uuid:sprite-after');
    expect(second.code).toContain('uuid:texture-after');
    expect(second.code).not.toContain('uuid:sprite-before');
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

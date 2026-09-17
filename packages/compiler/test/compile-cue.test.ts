import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { compileCue, type CompileCueOptions } from '../src/index.js';

const fixturesDirectory = fileURLToPath(new URL('./fixtures', import.meta.url));
const fixtureNames = (await readdir(fixturesDirectory, {
  withFileTypes: true,
}))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

describe('compileCue', () => {
  for (const fixtureName of fixtureNames) {
    it(fixtureName, async () => {
      /// @case
      /// A compiler fixture supplies Cue source and JSON-serializable compiler options.
      /// @expect
      /// Compilation succeeds and its complete generated JavaScript files match the file snapshot.
      const fixtureDirectory = join(fixturesDirectory, fixtureName);
      const [source, optionsSource] = await Promise.all([
        readFile(join(fixtureDirectory, 'code.vue'), 'utf8'),
        readFile(join(fixtureDirectory, 'opts.json'), 'utf8'),
      ]);
      const options = JSON.parse(optionsSource) as CompileCueOptions;
      const result = compileCue(source, options);

      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      expect(result.files.length).toBeGreaterThan(1);
      expect(result.entryFileName).toBe(result.files[0]?.fileName);
      const output = result.files
        .map(({ code, fileName }) => `/// ${fileName}\n\n${code.trimEnd()}`)
        .join('\n\n');
      await expect(output)
        .toMatchFileSnapshot(join(fixtureDirectory, 'output.snap'));
    });
  }

  it('canonicalizes a relative cue-image source through the compiler host', () => {
    /// @case
    /// A Cue template uses the builtin cue-image element with a source relative to its .cue file.
    /// @expect
    /// The compiler host receives the source and importer and generated code contains only its canonical UUID.
    const calls: Array<{
      filename: string;
      source: string;
    }> = [];
    const result = compileCue(
      '<template><cue-image src="./icon.png" /></template>',
      {
        canonicalizeImageSource(source: string, filename: string) {
          calls.push({
            filename,
            source,
          });
          return {
            ok: true as const,
            source: 'uuid:8e56d1ce-933a-4fb1-a2f5-7814727fd380@f9941',
          };
        },
        filename: '/project/ui/card.cue',
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(calls).toEqual([{
      filename: '/project/ui/card.cue',
      source: './icon.png',
    }]);
    const templateFile = result.files.find(
      ({ fileName }) => fileName.endsWith('.template.js'),
    );
    expect(templateFile?.code).toContain('uuid:8e56d1ce-933a-4fb1-a2f5-7814727fd380@f9941');
    expect(templateFile?.code).not.toContain('./icon.png');
    expect(templateFile?.code).not.toContain('_resolveComponent("cue-image")');
  });

  it('rejects a cue-image source outside the supported source schemes', () => {
    /// @case
    /// A Cue template uses an HTTP URL even though the first cue-image profile only supports relative paths and UUIDs.
    /// @expect
    /// Compilation fails visibly instead of reinterpreting or silently preserving the unsupported source.
    const result = compileCue(
      '<template><cue-image src="https://example.com/icon.png" /></template>',
      {
        filename: '/project/ui/card.cue',
      },
    );

    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors.map((error) => (
      typeof error === 'string' ? error : error.message
    ))).toContain(
      '<cue-image> src must be a relative path or use the "uuid:" scheme.',
    );
  });
});

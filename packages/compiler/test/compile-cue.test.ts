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

interface CompileFixtureOptions extends CompileCueOptions {
  backgroundImageSources?: Record<string, string>;
  expectedOk?: boolean;
}

describe('compileCue', () => {
  for (const fixtureName of fixtureNames) {
    it(fixtureName, async () => {
      /// @case
      /// A compiler fixture supplies Cue source and JSON-serializable compiler options.
      /// @expect
      /// Compilation matches the expected outcome and snapshots every generated file or diagnostic.
      const fixtureDirectory = join(fixturesDirectory, fixtureName);
      const [source, optionsSource] = await Promise.all([
        readFile(join(fixtureDirectory, 'code.vue'), 'utf8'),
        readFile(join(fixtureDirectory, 'opts.json'), 'utf8'),
      ]);
      const fixtureOptions = JSON.parse(optionsSource) as CompileFixtureOptions;
      const {
        backgroundImageSources,
        expectedOk = true,
        ...options
      } = fixtureOptions;
      const result = compileCue(source, {
        ...options,
        ...(backgroundImageSources
          ? {
            canonicalizeBackgroundImageSource(imageSource) {
              const canonicalSource = backgroundImageSources[imageSource];
              return canonicalSource
                ? {
                  ok: true as const,
                  source: canonicalSource,
                }
                : {
                  error: new Error(`Unknown fixture background image ${imageSource}.`),
                  ok: false as const,
                };
            },
          }
          : {}),
      });

      expect(result.ok).toBe(expectedOk);
      if (!result.ok) {
        const output = result.errors
          .map((error, index) => `/// error ${index + 1}\n\n${typeof error === 'string' ? error : error.message}`)
          .join('\n\n');
        await expect(output)
          .toMatchFileSnapshot(join(fixtureDirectory, 'output.snap'));
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

  it('locates dynamic style diagnostics at the original attribute', () => {
    /// @case
    /// A template binds a JavaScript style object to an element on the second source line.
    /// @expect
    /// Compilation rejects the unsupported binding and retains its source line and attribute text.
    const result = compileCue('<template>\n  <div :style="appearance" />\n</template>', {
      filename: '/project/ui/card.cue',
    });
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    expect(result.errors[0]).toMatchObject({
      loc: {
        source: ':style="appearance"',
        start: { column: 8, line: 2 },
      },
    });
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

  it.each([
    ['outline-offset: 0;', true],
    ['-cue-opacity: 0.5;', true],
    ['-cue-opacity: 0;', true],
    ['-cue-opacity: 1;', true],
    ['-cue-opacity: 50%;', false],
    ['-cue-opacity: 1.5;', false],
    ['opacity: 0;', false],
    ['opacity: 0.5;', false],
    ['opacity: 1;', false],
    ['overflow: scroll;', false],
    ['background-image: linear-gradient(in srgb to right, red, blue);', false],
    ['background-image: linear-gradient(to right, red, blue, green);', false],
  ])('checks the CSS decoration subset for %s', (declaration, supported) => {
    /// @case
    /// A declaration uses either the implemented Web CSS subset or a known unsupported variant.
    /// @expect
    /// Standard unitless zero succeeds, while unsupported visuals fail visibly.
    const result = compileCue(
      `<template><div class="test" /></template><style>.test { ${declaration} }</style>`,
      { filename: '/project/ui/card.cue' },
    );

    expect(result.ok).toBe(supported);
  });

  it('preserves an explicit Texture2D UUID in background-image', () => {
    /// @case
    /// A stylesheet references a Texture2D with the supported uuid: URL scheme.
    /// @expect
    /// Compilation succeeds without requiring a filesystem asset canonicalizer.
    const source = 'uuid:a9f027e7-44da-44dc-9a20-99ed39c18322';
    const result = compileCue(
      `<template><div class="test" /></template><style>.test { background-image: url("${source}"); }</style>`,
      { filename: '/project/ui/card.cue' },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.files.find(({ fileName }) => fileName.endsWith('.style.js'))?.code)
      .toContain(source);
  });
});

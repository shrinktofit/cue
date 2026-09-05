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
});

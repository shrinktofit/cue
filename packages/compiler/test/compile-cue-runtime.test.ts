import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { build } from 'vite';
import { compileCue, type CompileCueOptions } from '../src/index.js';

interface RuntimeIntegrationResult {
  componentElementPreserved: boolean;
  containerPreserved: boolean;
  customElementPreserved: boolean;
  initialText: string[];
  keyedElementsPreserved: boolean;
  rootIsEmptyAfterUnmount: boolean;
  updatedText: string[];
}

interface RuntimeIntegrationModule {
  runVerticalSlice(): Promise<RuntimeIntegrationResult>;
}

const fixtureDirectory = fileURLToPath(new URL(
  './fixtures/runtime-integration',
  import.meta.url,
));
const runtimeEntry = fileURLToPath(new URL(
  '../../runtime/src/index.ts',
  import.meta.url,
));
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map(
    (directory) => rm(directory, {
      recursive: true,
    }),
  ));
});

describe('compiled Cue runtime integration', () => {
  it('executes generated modules through the Cue renderer', async () => {
    /// @case
    /// A real Cue SFC uses script setup state, a local Vue component, a Custom Element,
    /// keyed children, and conditional content.
    /// @expect
    /// The compiler output mounts and updates as one stable public CueElement tree.
    const temporaryDirectory = await mkdtemp(join(tmpdir(), 'cue-runtime-integration-'));
    temporaryDirectories.push(temporaryDirectory);
    const [source, optionsSource, runnerSource] = await Promise.all([
      readFile(join(fixtureDirectory, 'code.vue'), 'utf8'),
      readFile(join(fixtureDirectory, 'opts.json'), 'utf8'),
      readFile(join(fixtureDirectory, 'runner.ts'), 'utf8'),
    ]);
    const result = compileCue(
      source,
      JSON.parse(optionsSource) as CompileCueOptions,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    await Promise.all([
      ...result.files.map(({ code, fileName }) => writeFile(
        join(temporaryDirectory, fileName),
        code,
        'utf8',
      )),
      writeFile(join(temporaryDirectory, 'runner.ts'), runnerSource, 'utf8'),
    ]);

    const bundleDirectory = join(temporaryDirectory, 'bundle');
    await build({
      configFile: false,
      define: {
        __VUE_OPTIONS_API__: 'true',
        __VUE_PROD_DEVTOOLS__: 'false',
        __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false',
      },
      logLevel: 'silent',
      resolve: {
        alias: {
          '@bsgames/cue': runtimeEntry,
        },
      },
      build: {
        emptyOutDir: true,
        lib: {
          entry: join(temporaryDirectory, 'runner.ts'),
          fileName: 'runtime-integration',
          formats: [
            'es',
          ],
        },
        minify: false,
        outDir: bundleDirectory,
        target: 'esnext',
      },
    });

    const integrationModule = await import(
      pathToFileURL(join(bundleDirectory, 'runtime-integration.js')).href,
    ) as RuntimeIntegrationModule;

    await expect(integrationModule.runVerticalSlice()).resolves.toEqual({
      componentElementPreserved: true,
      containerPreserved: true,
      customElementPreserved: true,
      initialText: [
        '1',
        'count:1',
        'first',
        'second',
      ],
      keyedElementsPreserved: true,
      rootIsEmptyAfterUnmount: true,
      updatedText: [
        '2',
        'count:2',
        'second',
        'first',
        'ready',
      ],
    });
  });
});

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
  initialWidthMatches: boolean;
  initialFontWeight: number;
  keyedElementsPreserved: boolean;
  rootIsEmptyAfterUnmount: boolean;
  updatedText: string[];
  updatedWidthMatches: boolean;
  updatedFontWeight: number;
}

interface RuntimeIntegrationModule {
  runVerticalSlice(): Promise<RuntimeIntegrationResult>;
}

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
    const integrationModule = await executeCompiledFixture('runtime-integration') as RuntimeIntegrationModule;

    await expect(integrationModule.runVerticalSlice()).resolves.toEqual({
      componentElementPreserved: true,
      containerPreserved: true,
      customElementPreserved: true,
      initialWidthMatches: true,
      initialFontWeight: 400,
      initialText: [
        '1',
        'count:1',
        'first',
        'second',
      ],
      keyedElementsPreserved: true,
      rootIsEmptyAfterUnmount: true,
      updatedWidthMatches: true,
      updatedFontWeight: 700,
      updatedText: [
        '2',
        'count:2',
        'second',
        'first',
        'ready',
      ],
    });
  });

  it('executes generated pointer event modifiers in their declared order', async () => {
    /// @case
    /// Compiled native handlers combine stop, prevent, and self in different orders.
    /// @expect
    /// Every imported helper exists, guards preserve order, and handlers receive their arguments and return values.
    const integrationModule = await executeCompiledFixture('pointer-modifiers') as {
      runPointerModifiers(): { calls: string[]; returnValue: string };
    };
    expect(integrationModule.runPointerModifiers()).toEqual({
      calls: ['stop', 'prevent', 'handler:own', 'stop', 'prevent', 'prevent', 'handler:own-pointer'],
      returnValue: 'handled',
    });
  });

  it('preserves Vue component custom event names and dynamic bindings', async () => {
    /// @case
    /// A component emits custom and keyboard-named events through static, dynamic, and object bindings.
    /// @expect
    /// Vue handles custom event names normally and .once still invokes its listener only once.
    const integrationModule = await executeCompiledFixture('component-custom-events') as {
      runComponentCustomEvents(): string[];
    };
    expect(integrationModule.runComponentCustomEvents()).toEqual([
      'changed', 'custom-keydown', 'first-ready', 'dynamic', 'mapped',
    ]);
  });

  it('mounts compiled native models, composition guards and keyboard modifiers', async () => {
    /// @case All five value controls bind script-setup refs and a button handles Ctrl+Enter.
    /// @expect Models preserve value types, ignore composing input, honor lazy change, reflect parent updates and cleanly unmount.
    const integrationModule = await executeCompiledFixture('native-controls') as {
      runNativeControlModels(): Promise<unknown>;
    };
    await expect(integrationModule.runNativeControlModels()).resolves.toEqual({
      initial: { toggle: false, slider: 20, selection: undefined, text: 'initial', number: undefined, lazy: 'saved', presses: 0, inputValues: [] },
      duringComposition: 'initial',
      beforeCommit: 'saved',
      updated: { toggle: true, slider: 42, selection: 'b', text: 'edited', number: 12, lazy: 'committed', presses: 1, inputValues: ['composing', 'edited'] },
      reflected: [true, 42, 'b', 'edited', 12, 'committed'],
      externalValues: [false, 75, undefined, 'external', undefined],
      preserved: true,
      prevented: true,
      emptyAfterUnmount: true,
    });
  });
});

async function executeCompiledFixture(fixtureName: string): Promise<unknown> {
  const fixtureDirectory = fileURLToPath(new URL('./fixtures/' + fixtureName, import.meta.url));
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

  return import(
    pathToFileURL(join(bundleDirectory, 'runtime-integration.js')).href,
  );
}

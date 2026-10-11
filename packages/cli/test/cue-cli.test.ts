import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';

const executeFile = promisify(execFile);
const cliEntry = fileURLToPath(new URL('../bin.js', import.meta.url));
const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) =>
    rm(directory, { recursive: true }),
  ));
});

describe('cue compile', () => {
  it.each([
    { outDir: undefined, directory: '' },
    { outDir: 'generated', directory: 'generated' },
  ])('writes the generated modules with out-dir=$outDir', async ({ outDir, directory }) => {
    /// @case
    /// A user compiles a component into the current directory or an explicit generated directory.
    /// @expect
    /// All generated files are written and reported; missing directories are created.
    const workingDirectory = await mkdtemp(join(tmpdir(), 'cue-cli-'));
    temporaryDirectories.push(workingDirectory);
    await writeFile(
      join(workingDirectory, 'greeting.cc.vue'),
      '<template><div>Hello</div></template>',
    );
    const result = await executeFile(process.execPath, [
      cliEntry,
      'compile',
      'greeting.cc.vue',
      ...(outDir ? ['--out-dir=' + outDir] : []),
    ], { cwd: workingDirectory });
    const outputFiles = [
      'greeting.cc.vue.js',
      'greeting.cc.vue.script.js',
      'greeting.cc.vue.template.js',
    ].map((file) => join(workingDirectory, directory, file));
    expect(result.stdout.trim().split(/\r?\n/u)).toEqual(outputFiles);
    await expect(
      Promise.all(outputFiles.map((file) => readFile(file, 'utf8'))),
    ).resolves.toHaveLength(3);
  });

  it.each([
    {
      outDir: '.',
      source: './icon.png',
      specifier: './icon.png?uuid',
    },
    {
      outDir: 'generated/nested',
      source: './icon.png',
      specifier: '../../icon.png?uuid',
    },
    {
      outDir: '.',
      source: './.icon.png',
      specifier: './.icon.png?uuid',
    },
    {
      outDir: '.',
      source: './.assets/icon.png',
      specifier: './.assets/icon.png?uuid',
    },
  ])('emits $source relative to $outDir', async ({ outDir, source, specifier }) => {
    /// @case
    /// Image, inline background and stylesheet references compile with no PNG or metadata present.
    /// @expect
    /// Imports target the original image from the output directory; the bundler owns UUID loading.
    const workingDirectory = await mkdtemp(join(tmpdir(), 'cue-cli-images-'));
    temporaryDirectories.push(workingDirectory);
    await writeFile(join(workingDirectory, 'card.cc.vue'), [
      `<template><cue-image src="${source}"`,
      ` style="background-image: url(${source})" /></template>`,
      `<style>.card { background-image: url(${source}); }</style>`,
    ].join('\n'));
    await executeFile(process.execPath, [
      cliEntry,
      'compile',
      'card.cc.vue',
      '--out-dir=' + outDir,
    ], { cwd: workingDirectory });
    const modules = await Promise.all(['template', 'style'].map((kind) =>
      readFile(join(workingDirectory, outDir, 'card.cc.vue.' + kind + '.js'), 'utf8'),
    ));
    for (const code of modules) {
      expect(code).toContain(specifier);
      expect(code).toContain('with { importer: "texture" }');
      expect(code).toContain('"uuid:" + _cue_image_');
    }
    expect(modules[0]).toContain('with { importer: "sprite-frame" }');
  });
});

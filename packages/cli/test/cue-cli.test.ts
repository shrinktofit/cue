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
  await Promise.all(temporaryDirectories.splice(0).map(
    (directory) => rm(directory, {
      recursive: true,
    }),
  ));
});

describe('cue compile', () => {
  it('writes the generated JavaScript modules to the current directory by default', async () => {
    /// @case
    /// A user compiles a .cue file without passing --out-dir.
    /// @expect
    /// The CLI writes every generated JavaScript file into the current working directory.
    const workingDirectory = await mkdtemp(join(tmpdir(), 'cue-cli-default-'));
    temporaryDirectories.push(workingDirectory);
    await writeFile(
      join(workingDirectory, 'greeting.cue'),
      '<template><div>Hello</div></template>',
      'utf8',
    );

    const result = await executeFile(
      process.execPath,
      [cliEntry, 'compile', 'greeting.cue'],
      {
        cwd: workingDirectory,
      },
    );

    const outputFiles = [
      join(workingDirectory, 'greeting.cue.js'),
      join(workingDirectory, 'greeting.cue.script.js'),
      join(workingDirectory, 'greeting.cue.template.js'),
    ];
    expect(result.stdout.trim().split(/\r?\n/u)).toEqual(outputFiles);
    await expect(Promise.all(outputFiles.map((file) => readFile(file, 'utf8')))).resolves.toHaveLength(3);
  });

  it('writes the generated JavaScript modules to --out-dir', async () => {
    /// @case
    /// A user compiles a .cue file with an explicit generated directory.
    /// @expect
    /// The CLI creates the directory and writes every generated JavaScript file there.
    const workingDirectory = await mkdtemp(join(tmpdir(), 'cue-cli-output-'));
    temporaryDirectories.push(workingDirectory);
    await writeFile(
      join(workingDirectory, 'greeting.cue'),
      '<template><div>Hello</div></template>',
      'utf8',
    );

    const result = await executeFile(
      process.execPath,
      [cliEntry, 'compile', 'greeting.cue', '--out-dir=generated'],
      {
        cwd: workingDirectory,
      },
    );

    const outputFiles = [
      join(workingDirectory, 'generated', 'greeting.cue.js'),
      join(workingDirectory, 'generated', 'greeting.cue.script.js'),
      join(workingDirectory, 'generated', 'greeting.cue.template.js'),
    ];
    expect(result.stdout.trim().split(/\r?\n/u)).toEqual(outputFiles);
    await expect(Promise.all(outputFiles.map((file) => readFile(file, 'utf8')))).resolves.toHaveLength(3);
  });
});

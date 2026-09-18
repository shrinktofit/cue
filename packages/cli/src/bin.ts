import { readFileSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  dirname,
  extname,
  join,
  resolve,
} from 'node:path';
import process from 'node:process';
import {
  compileCue,
  cueFileExtension,
  type CanonicalizeCueImageSourceResult,
} from '@bsgames/cue-compiler';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

try {
  await yargs(hideBin(process.argv))
    .scriptName('cue')
    .strict()
    .exitProcess(false)
    .demandCommand(1)
    .command(
      'compile <file>',
      'Compile a .cue file into JavaScript modules.',
      (command) => command
        .positional('file', {
          describe: 'Cue SFC to compile.',
          demandOption: true,
          type: 'string',
        })
        .option('out-dir', {
          describe: 'Directory for the generated modules.',
          default: process.cwd(),
          type: 'string',
        }),
      async (args) => {
        const sourceFile = resolve(args.file);
        if (extname(sourceFile) !== cueFileExtension) {
          throw new Error(`Expected a ${cueFileExtension} input file: ${sourceFile}`);
        }

        const source = await readFile(sourceFile, 'utf8');
        const result = compileCue(source, {
          canonicalizeBackgroundImageSource,
          canonicalizeImageSource,
          filename: sourceFile,
        });

        if (!result.ok) {
          throw new Error(result.errors
            .map((error) => typeof error === 'string' ? error : error.message)
            .join('\n'));
        }

        const outputDirectory = resolve(args.outDir);
        await mkdir(outputDirectory, {
          recursive: true,
        });
        const outputFiles = result.files.map(({ code, fileName }) => ({
          code,
          path: join(outputDirectory, fileName),
        }));
        await Promise.all(outputFiles.map(({ code, path }) => writeFile(path, code, 'utf8')));
        process.stdout.write(`${outputFiles.map(({ path }) => path).join('\n')}\n`);
      },
    )
    .help()
    .parseAsync();
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}

interface CocosAssetMeta {
  subMetas?: Record<string, CocosAssetSubMeta>;
}

function canonicalizeBackgroundImageSource(
  source: string,
  filename: string,
): CanonicalizeCueImageSourceResult {
  return canonicalizeCocosImageSource(
    source,
    filename,
    'texture',
    'background-image',
  );
}

interface CocosAssetSubMeta {
  importer?: unknown;
  uuid?: unknown;
}

function canonicalizeImageSource(
  source: string,
  filename: string,
): CanonicalizeCueImageSourceResult {
  return canonicalizeCocosImageSource(
    source,
    filename,
    'sprite-frame',
    '<cue-image> src',
  );
}

function canonicalizeCocosImageSource(
  source: string,
  filename: string,
  importer: 'sprite-frame' | 'texture',
  context: string,
): CanonicalizeCueImageSourceResult {
  const assetPath = resolve(dirname(filename), source);
  const metaPath = `${assetPath}.meta`;
  let meta: CocosAssetMeta;
  try {
    meta = JSON.parse(readFileSync(metaPath, 'utf8')) as CocosAssetMeta;
  } catch (cause) {
    return {
      ok: false,
      error: new SyntaxError(
        `Cannot read Cocos asset metadata for ${context} ${JSON.stringify(source)} at ${metaPath}.`,
        {
          cause,
        },
      ),
    };
  }
  const assets = meta.subMetas
    ? Object.values(meta.subMetas).filter((subMeta) => (
      subMeta.importer === importer
      && typeof subMeta.uuid === 'string'
      && subMeta.uuid.length > 0
    ))
    : [];
  if (assets.length !== 1) {
    return {
      ok: false,
      error: new SyntaxError(
        `Expected exactly one ${importer} subasset for ${context} ${JSON.stringify(source)}, found ${assets.length}.`,
      ),
    };
  }
  return {
    ok: true,
    source: `uuid:${String(assets[0]?.uuid)}`,
  };
}

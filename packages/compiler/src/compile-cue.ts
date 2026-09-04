import {
  compileScript,
  compileTemplate,
  parse,
  type CompilerOptions,
  type SFCParseResult,
  type SFCTemplateCompileResults,
} from '@vue/compiler-sfc';
import {
  ModuleKind,
  ScriptTarget,
  transpileModule,
} from 'typescript';

export const cueFileExtension = '.cue';
export const cueRuntimeModuleName = '@bsgames/cue';

export type CompileCueError
  = SFCParseResult['errors'][number]
    | SFCTemplateCompileResults['errors'][number];

export interface CompileCueOptions {
  customElements?: readonly string[];
  filename: string;
  id?: string;
  templateCompilerOptions?: CompilerOptions;
}

export interface CompileCueFile {
  code: string;
  fileName: string;
}

export type CompileCueResult = {
  ok: true;
  entryFileName: string;
  files: CompileCueFile[];
} | {
  ok: false;
  errors: CompileCueError[];
};

export function compileCue(source: string, options: CompileCueOptions): CompileCueResult {
  const parsed = parse(source, {
    filename: options.filename,
  });

  if (parsed.errors.length > 0) {
    return {
      ok: false,
      errors: parsed.errors,
    };
  }

  const descriptor = parsed.descriptor;
  if (descriptor.styles.length > 0) {
    return {
      ok: false,
      errors: [
        new SyntaxError('Cue style blocks are not supported yet.'),
      ],
    };
  }

  const id = options.id ?? options.filename;
  const configuredCustomElements = new Set(options.customElements);
  const configuredIsCustomElement = options.templateCompilerOptions?.isCustomElement;
  const templateCompilerOptions = {
    ...options.templateCompilerOptions,
    isCustomElement: (tagName: string) => (
      configuredCustomElements.has(tagName)
      || configuredIsCustomElement?.(tagName) === true
    ),
    runtimeModuleName: cueRuntimeModuleName,
  };
  const script = descriptor.script || descriptor.scriptSetup
    ? compileScript(descriptor, {
      id,
      genDefaultAs: '__sfc__',
      templateOptions: {
        compilerOptions: templateCompilerOptions,
      },
    })
    : undefined;
  const template = descriptor.template
    ? compileTemplate({
      id,
      filename: options.filename,
      source: descriptor.template.content,
      slotted: descriptor.slotted,
      compilerOptions: {
        ...templateCompilerOptions,
        ...(script
          ? {
            bindingMetadata: script.bindings,
          }
          : {}),
      },
    })
    : undefined;

  if (template && template.errors.length > 0) {
    return {
      ok: false,
      errors: template.errors,
    };
  }

  const normalizedFilename = options.filename.replaceAll('\\', '/');
  const sourceFileName = normalizedFilename.slice(normalizedFilename.lastIndexOf('/') + 1);
  const entryFileName = `${sourceFileName}.js`;
  const scriptFileName = `${sourceFileName}.script.js`;
  const templateFileName = `${sourceFileName}.template.js`;
  const scriptCode = transpileModule([
    script?.content ?? 'const __sfc__ = {};',
    'export default __sfc__;',
    '',
  ].join('\n'), {
    compilerOptions: {
      module: ModuleKind.ESNext,
      target: ScriptTarget.ESNext,
    },
    fileName: `${sourceFileName}.script.ts`,
  }).outputText;
  const componentProperties = [
    `  __file: ${JSON.stringify(options.filename)},`,
  ];
  if (template) {
    componentProperties.push('  render,');
  }

  const entryCode = [
    `import component from ${JSON.stringify(`./${scriptFileName}`)};`,
    ...(template
      ? [
        `import { render } from ${JSON.stringify(`./${templateFileName}`)};`,
      ]
      : []),
    '',
    'export default Object.assign(component, {',
    ...componentProperties,
    '});',
    '',
  ].join('\n');

  return {
    ok: true,
    entryFileName,
    files: [
      {
        code: entryCode,
        fileName: entryFileName,
      },
      {
        code: scriptCode,
        fileName: scriptFileName,
      },
      ...(template
        ? [{
          code: template.code,
          fileName: templateFileName,
        }]
        : []),
    ],
  };
}

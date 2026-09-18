import { cueControlDefinitions } from '@bsgames/cue-control-schema';
import {
  ConstantTypes,
  createCompoundExpression,
  createSimpleExpression,
  ElementTypes,
  NodeTypes,
  transformModel,
  type AttributeNode,
  type CompoundExpressionNode,
  type DirectiveTransform,
  type ElementNode,
  type NodeTransform,
  type RootNode,
} from '@vue/compiler-core';
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
import {
  compileCueInlineStyle,
  compileCueStyle,
} from './compile-cue-style.js';

export const cueFileExtension = '.cue';
export const cueRuntimeModuleName = '@bsgames/cue';

export type CompileCueError
  = SFCParseResult['errors'][number]
    | SFCTemplateCompileResults['errors'][number];

export type CanonicalizeCueImageSourceResult = {
  ok: true;
  source: string;
} | {
  ok: false;
  error: CompileCueError;
};

export type CueImageSourceCanonicalizer = (
  source: string,
  filename: string,
) => CanonicalizeCueImageSourceResult;

export interface CompileCueOptions {
  canonicalizeBackgroundImageSource?: CueImageSourceCanonicalizer;
  canonicalizeImageSource?: CueImageSourceCanonicalizer;
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
  const configuredCustomElements = new Set(options.customElements);
  const configuredIsCustomElement = options.templateCompilerOptions?.isCustomElement;
  const isCustomElement = (tagName: string): boolean => (
    tagName === 'cue-image'
    || Object.hasOwn(cueControlDefinitions, tagName)
    || configuredCustomElements.has(tagName)
    || configuredIsCustomElement?.(tagName) === true
  );
  const parsed = parse(source, {
    filename: options.filename,
    templateParseOptions: {
      ...options.templateCompilerOptions,
      isCustomElement,
      whitespace: 'preserve',
    },
  });

  if (parsed.errors.length > 0) {
    return {
      ok: false,
      errors: parsed.errors,
    };
  }

  const descriptor = parsed.descriptor;
  // Lower raw attributes before Vue's DOM transform rewrites static CSS into
  // a JavaScript style object. Clone the parser's cached AST before changing it.
  const templateAst = descriptor.template?.ast
    ? structuredClone(descriptor.template.ast)
    : undefined;
  const templatePropertyErrors: CompileCueError[] = [];
  if (templateAst) {
    compileTemplateProperties(templateAst, options, templatePropertyErrors);
  }
  if (templatePropertyErrors.length > 0) {
    return { ok: false, errors: templatePropertyErrors };
  }
  const compiledStyle = compileCueStyle(
    descriptor.styles.map((style) => style.content),
    options.filename,
    options.canonicalizeBackgroundImageSource,
  );
  if (compiledStyle.errors.length > 0) {
    return {
      ok: false,
      errors: compiledStyle.errors,
    };
  }

  const id = options.id ?? options.filename;
  const imageSourceErrors: CompileCueError[] = [];
  const templateCompilerOptions = {
    ...options.templateCompilerOptions,
    hoistStatic: false,
    isCustomElement,
    directiveTransforms: {
      ...options.templateCompilerOptions?.directiveTransforms,
      model: transformCueModel,
    },
    nodeTransforms: [
      createCueImageSourceTransform(options, imageSourceErrors),
      ...(options.templateCompilerOptions?.nodeTransforms ?? []),
    ],
    runtimeModuleName: cueRuntimeModuleName,
    whitespace: 'preserve' as const,
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
      ...(templateAst ? { ast: templateAst } : {}),
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

  if (template && (template.errors.length > 0 || imageSourceErrors.length > 0)) {
    return {
      ok: false,
      errors: [
        ...template.errors,
        ...imageSourceErrors,
      ],
    };
  }

  const normalizedFilename = options.filename.replaceAll('\\', '/');
  const sourceFileName = normalizedFilename.slice(normalizedFilename.lastIndexOf('/') + 1);
  const entryFileName = `${sourceFileName}.js`;
  const scriptFileName = `${sourceFileName}.script.js`;
  const templateFileName = `${sourceFileName}.template.js`;
  const styleFileName = `${sourceFileName}.style.js`;
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
  if (descriptor.styles.length > 0) {
    componentProperties.push('  __cueStyleSheets: [styleSheet],');
  }

  const entryCode = [
    `import component from ${JSON.stringify(`./${scriptFileName}`)};`,
    ...(template
      ? [
        `import { render } from ${JSON.stringify(`./${templateFileName}`)};`,
      ]
      : []),
    ...(descriptor.styles.length > 0
      ? [
        `import styleSheet from ${JSON.stringify(`./${styleFileName}`)};`,
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
      ...(descriptor.styles.length > 0 && compiledStyle.styleSheet
        ? [{
          code: [
            `const styleSheet = ${JSON.stringify(compiledStyle.styleSheet, undefined, 2)};`,
            '',
            'export default styleSheet;',
            '',
          ].join('\n'),
          fileName: styleFileName,
        }]
        : []),
    ],
  };
}

const supportedNativeEvents = new Set([
  'pointerdown', 'pointermove', 'pointerup', 'pointercancel',
  'pointerover', 'pointerout', 'pointerenter', 'pointerleave',
  'gotpointercapture', 'lostpointercapture', 'click',
  'keydown', 'keyup', 'focus', 'blur', 'focusin', 'focusout',
  'beforeinput', 'input', 'change',
  'compositionstart', 'compositionupdate', 'compositionend', 'wheel',
]);
const supportedEventModifiers = new Set([
  'stop', 'prevent', 'self', 'once', 'capture', 'passive',
  'ctrl', 'shift', 'alt', 'meta', 'exact',
  'enter', 'tab', 'delete', 'esc', 'space', 'up', 'down', 'left', 'right', 'middle',
]);

const transformCueModel: DirectiveTransform = (directive, node, context) => {
  if (node.tagType !== ElementTypes.ELEMENT) {
    return transformModel(directive, node, context);
  }
  const model = cueControlDefinitions[node.tag]?.model;
  // Native model contracts have already been checked at the original source location.
  if (!model) {
    throw new Error(`Missing validated native model contract for <${node.tag}>.`);
  }
  const transformed = transformModel(directive, node, { ...context, cacheHandlers: false });
  const [value, update] = transformed.props;
  if (!value || !update) {
    return transformed;
  }
  const lazy = directive.modifiers.some((modifier) => modifier.content === 'lazy');
  return {
    props: [
      { ...value, key: createSimpleExpression(model.property, true) },
      {
        ...update,
        key: createSimpleExpression(lazy ? 'onChange' : 'onInput', true),
        value: createCompoundExpression([
          lazy ? '$event => (' : '$event => !$event.isComposing && (',
          // With handler caching disabled, Vue's core model transform returns its assignment expression.
          update.value as CompoundExpressionNode,
          ')($event.value)',
        ]),
      },
    ],
  };
};

function compileTemplateProperties(
  node: RootNode | ElementNode,
  options: CompileCueOptions,
  errors: CompileCueError[],
): void {
  if (node.type === NodeTypes.ELEMENT) {
    for (let index = 0; index < node.props.length; ++index) {
      const property = node.props[index]!;
      if (node.tagType === ElementTypes.ELEMENT && property.type === NodeTypes.DIRECTIVE && property.name === 'model') {
        const model = Object.hasOwn(cueControlDefinitions, node.tag) ? cueControlDefinitions[node.tag]?.model : undefined;
        let message: string | undefined;
        if (!model) {
          message = `Cue native element <${node.tag}> does not support v-model.`;
        } else if (property.arg) {
          message = 'Cue native control v-model does not support arguments; bind its value without an argument.';
        } else if (property.modifiers.some((modifier) => modifier.content !== 'lazy')) {
          message = 'Cue native control v-model supports only the .lazy modifier.';
        }
        if (message) {
          errors.push(Object.assign(new SyntaxError(message), { loc: property.loc }));
        }
      }
      if (property.type === NodeTypes.DIRECTIVE && property.name === 'on') {
        if (node.tagType === ElementTypes.ELEMENT) {
          if (property.arg?.type !== NodeTypes.SIMPLE_EXPRESSION || !property.arg.isStatic) {
            errors.push(Object.assign(new SyntaxError(
              'Cue native event bindings require a static event name; dynamic v-on arguments and v-on objects are not supported.',
            ), { loc: property.loc }));
          } else if (!supportedNativeEvents.has(property.arg.content)) {
            errors.push(Object.assign(new SyntaxError(
              `Unsupported Cue native event "${property.arg.content}". Supported events: ${[...supportedNativeEvents].join(', ')}.`,
            ), { loc: property.loc }));
          }
        }
        for (const modifier of property.modifiers) {
          if (!supportedEventModifiers.has(modifier.content)) {
            errors.push(Object.assign(new SyntaxError(
              `Unsupported Cue event modifier ".${modifier.content}". Supported modifiers: stop, prevent, self, once, capture, passive.`,
            ), { loc: modifier.loc }));
          }
          if (node.tagType === ElementTypes.ELEMENT && property.arg?.type === NodeTypes.SIMPLE_EXPRESSION && property.arg.isStatic) {
            if (['enter', 'tab', 'delete', 'esc', 'space', 'up', 'down'].includes(modifier.content)
              && property.arg.content !== 'keydown' && property.arg.content !== 'keyup') {
              errors.push(Object.assign(new SyntaxError(
                `Cue key modifier ".${modifier.content}" requires keydown or keyup.`,
              ), { loc: modifier.loc }));
            }
            if (property.arg.content === 'click' && (modifier.content === 'right' || modifier.content === 'middle')) {
              errors.push(Object.assign(new SyntaxError(
                `Cue click.${modifier.content} is unsupported; use pointerdown.${modifier.content} or pointerup.${modifier.content}.`,
              ), { loc: modifier.loc }));
            }
          }
        }
        if (property.modifiers.some((modifier) => modifier.content === 'passive')
          && property.modifiers.some((modifier) => modifier.content === 'prevent')) {
          errors.push(Object.assign(new SyntaxError(
            'Cue event modifiers .passive and .prevent cannot be combined.',
          ), { loc: property.loc }));
        }
      }
      const name = property.type === NodeTypes.ATTRIBUTE
        ? property.name
        : property.name === 'bind'
          && property.arg?.type === NodeTypes.SIMPLE_EXPRESSION
          && property.arg.isStatic
          ? property.arg.content
          : undefined;
      if (name === '__cueInlineStyle') {
        errors.push(Object.assign(
          new SyntaxError('__cueInlineStyle is reserved for Cue compiler output.'),
          { loc: property.loc },
        ));
        continue;
      }
      if (name !== 'style') {
        continue;
      }
      if (property.type === NodeTypes.DIRECTIVE) {
        errors.push(Object.assign(
          new SyntaxError('Dynamic :style bindings are not supported. Update the element\'s typed CueElement.style properties instead.'),
          { loc: property.loc },
        ));
        continue;
      }
      const result = compileCueInlineStyle(
        property.value?.content ?? '',
        options.filename,
        options.canonicalizeBackgroundImageSource,
      );
      errors.push(...result.errors.map((error) => Object.assign(error, { loc: property.loc })));
      if (!result.rule) {
        node.props.splice(index, 1);
        --index;
        continue;
      }
      node.props[index] = {
        arg: createSimpleExpression('__cueInlineStyle', true, property.loc),
        exp: createSimpleExpression(
          JSON.stringify(result.rule),
          false,
          property.loc,
          ConstantTypes.CAN_STRINGIFY,
        ),
        loc: property.loc,
        modifiers: [],
        name: 'bind',
        type: NodeTypes.DIRECTIVE,
      };
    }
  }
  for (const child of node.children) {
    if (child.type === NodeTypes.ELEMENT) {
      compileTemplateProperties(child, options, errors);
    }
  }
}

function createCueImageSourceTransform(
  options: CompileCueOptions,
  errors: CompileCueError[],
): NodeTransform {
  return (node) => {
    if (
      node.type !== NodeTypes.ELEMENT
      || node.tagType !== ElementTypes.ELEMENT
      || node.tag !== 'cue-image'
    ) {
      return;
    }
    const sourceAttribute = node.props.find(
      (property): property is AttributeNode => (
        property.type === NodeTypes.ATTRIBUTE
        && property.name === 'src'
      ),
    );
    if (!sourceAttribute?.value) {
      return;
    }
    const source = sourceAttribute.value.content;
    if (isUuidSource(source)) {
      return;
    }
    if (!source.startsWith('./') && !source.startsWith('../')) {
      errors.push(new SyntaxError(
        '<cue-image> src must be a relative path or use the "uuid:" scheme.',
      ));
      return;
    }
    const canonicalizeImageSource = options.canonicalizeImageSource;
    if (!canonicalizeImageSource) {
      errors.push(new SyntaxError(
        `Cannot compile relative <cue-image> src ${JSON.stringify(source)} without a compiler-host image source canonicalizer.`,
      ));
      return;
    }
    const result = canonicalizeImageSource(source, options.filename);
    if (!result.ok) {
      errors.push(result.error);
      return;
    }
    if (!isUuidSource(result.source)) {
      errors.push(new SyntaxError(
        `The compiler host returned an invalid <cue-image> source ${JSON.stringify(result.source)}; expected a non-empty "uuid:" source.`,
      ));
      return;
    }
    sourceAttribute.value.content = result.source;
  };
}

function isUuidSource(source: string): boolean {
  return source.startsWith('uuid:')
    && source.length > 'uuid:'.length
    && !/\s/u.test(source.slice('uuid:'.length));
}

import { cueControlDefinitions } from '@bsgames/cue-control-schema';
import {
  ConstantTypes,
  createCompoundExpression,
  createSimpleExpression,
  ElementTypes,
  NodeTypes,
  transformModel,
  walkIdentifiers,
  type CompoundExpressionNode,
  type DirectiveTransform,
  type ElementNode,
  type ExpressionNode,
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
import { ModuleKind, ScriptTarget, transpileModule } from 'typescript';
import { compileCueInlineStyle, compileCueStyle } from './compile-cue-style.js';
import { CueImageImports } from './cue-image-imports.js';

export const cueFileExtension = '.cc.vue';
export const cueRuntimeModuleName = '@bsgames/cue';

export type CompileCueError
  = | SFCParseResult['errors'][number]
    | SFCTemplateCompileResults['errors'][number];

export interface CompileCueOptions {
  /** Source directory relative to emitted modules; omitted for bundler virtual modules. */
  assetImportBase?: string;
  customElements?: readonly string[];
  filename: string;
  id?: string;
  templateCompilerOptions?: CompilerOptions;
}

export interface CompileCueFile {
  code: string;
  fileName: string;
}

export type CompileCueResult
  = | {
    ok: true;
    entryFileName: string;
    files: CompileCueFile[];
  }
  | {
    ok: false;
    errors: CompileCueError[];
  };

export function compileCue(source: string, options: CompileCueOptions): CompileCueResult {
  const configuredCustomElements = new Set(options.customElements);
  const configuredIsCustomElement = options.templateCompilerOptions?.isCustomElement;
  const isCustomElement = (tagName: string): boolean =>
    tagName === 'cue-image'
    || Object.hasOwn(cueControlDefinitions, tagName)
    || configuredCustomElements.has(tagName)
    || configuredIsCustomElement?.(tagName) === true;
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
  const templateImages = new CueImageImports(
    options.assetImportBase,
    templateAst ? collectTemplateIdentifiers(templateAst) : undefined,
  );
  if (templateAst) {
    compileTemplateProperties(templateAst, options, templateImages, templatePropertyErrors);
  }
  if (templatePropertyErrors.length > 0) {
    return { ok: false, errors: templatePropertyErrors };
  }
  const compiledStyle = compileCueStyle(
    descriptor.styles.map((style) => style.content),
    options.filename,
  );
  if (compiledStyle.errors.length > 0) {
    return {
      ok: false,
      errors: compiledStyle.errors,
    };
  }

  const normalizedFilename = options.filename.replaceAll('\\', '/');
  const sourceFileName = normalizedFilename.slice(
    normalizedFilename.lastIndexOf('/') + 1,
  );
  const inferredName = sourceFileName.endsWith(cueFileExtension)
    ? sourceFileName.slice(0, -cueFileExtension.length)
    : undefined;
  const id = options.id ?? options.filename;
  const templateCompilerOptions: CompilerOptions = {
    ...options.templateCompilerOptions,
    hoistStatic: false,
    isCustomElement,
    directiveTransforms: {
      ...options.templateCompilerOptions?.directiveTransforms,
      model: transformCueModel,
    },
    nodeTransforms: [
      (node, context) => {
        if (node.type === NodeTypes.ROOT) {
          for (const { name } of templateImages.bindings.values()) {
            context.addIdentifiers(name);
          }
        }
        // Vue removes only .vue when inferring selfName. Remove the remaining .cc
        // without changing the real filename used for imports and diagnostics.
        if (
          node.type === NodeTypes.ROOT
          && inferredName !== undefined
          && context.selfName?.endsWith('.cc')
        ) {
          context.selfName = context.selfName.slice(0, -'.cc'.length);
        }
      },
      ...(options.templateCompilerOptions?.nodeTransforms ?? []),
    ],
    runtimeModuleName: cueRuntimeModuleName,
    whitespace: 'preserve' as const,
  };
  const script
    = descriptor.script || descriptor.scriptSetup
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

  if (template && template.errors.length > 0) {
    return {
      ok: false,
      errors: template.errors,
    };
  }

  const entryFileName = `${sourceFileName}.js`;
  const scriptFileName = `${sourceFileName}.script.js`;
  const templateFileName = `${sourceFileName}.template.js`;
  const styleFileName = `${sourceFileName}.style.js`;
  const scriptCode = transpileModule(
    [
      script?.content ?? 'const __sfc__ = {};',
      'export default __sfc__;',
      '',
    ].join('\n'),
    {
      compilerOptions: {
        module: ModuleKind.ESNext,
        target: ScriptTarget.ESNext,
      },
      fileName: `${sourceFileName}.script.ts`,
    },
  ).outputText;
  const componentProperties = [`  __file: ${JSON.stringify(options.filename)},`];
  if (inferredName !== undefined) {
    // Keep the runtime's inferred name in sync with template self-reference.
    // Vue still gives an explicitly declared component.name precedence over __name.
    componentProperties.push(`  __name: ${JSON.stringify(inferredName)},`);
  }
  if (template) {
    componentProperties.push('  render,');
  }
  if (descriptor.styles.length > 0) {
    componentProperties.push('  __cueStyleSheets: [styleSheet],');
  }

  const entryCode = [
    `import component from ${JSON.stringify(`./${scriptFileName}`)};`,
    ...(template
      ? [`import { render } from ${JSON.stringify(`./${templateFileName}`)};`]
      : []),
    ...(descriptor.styles.length > 0
      ? [`import styleSheet from ${JSON.stringify(`./${styleFileName}`)};`]
      : []),
    '',
    'export default Object.assign(component, {',
    ...componentProperties,
    '});',
    '',
  ].join('\n');

  const styleImages = new CueImageImports(options.assetImportBase);
  const styleRules = compiledStyle.styleSheet?.rules.map((rule) => styleImages.styleRule(rule, 2));
  const styleCode = styleImages.bindings.size > 0
    ? [
      ...styleImages.imports,
      '',
      `const styleSheet = { version: ${compiledStyle.styleSheet!.version}, rules: [`,
      ...styleRules!.map((rule) => `  ${rule},`),
      '] };',
    ].join('\n')
    : `const styleSheet = ${JSON.stringify(compiledStyle.styleSheet, undefined, 2)};`;

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
        ? [
          {
            code: [...templateImages.imports, template.code].join('\n'),
            fileName: templateFileName,
          },
        ]
        : []),
      ...(descriptor.styles.length > 0 && compiledStyle.styleSheet
        ? [
          {
            code: [
              styleCode,
              '',
              'export default styleSheet;',
              '',
            ].join('\n'),
            fileName: styleFileName,
          },
        ]
        : []),
    ],
  };
}

const supportedNativeEvents = new Set([
  'pointerdown',
  'pointermove',
  'pointerup',
  'pointercancel',
  'pointerover',
  'pointerout',
  'pointerenter',
  'pointerleave',
  'gotpointercapture',
  'lostpointercapture',
  'click',
  'keydown',
  'keyup',
  'focus',
  'blur',
  'focusin',
  'focusout',
  'beforeinput',
  'input',
  'change',
  'compositionstart',
  'compositionupdate',
  'compositionend',
  'wheel',
]);
const supportedEventModifiers = new Set([
  'stop',
  'prevent',
  'self',
  'once',
  'capture',
  'passive',
  'ctrl',
  'shift',
  'alt',
  'meta',
  'exact',
  'enter',
  'tab',
  'delete',
  'esc',
  'space',
  'up',
  'down',
  'left',
  'right',
  'middle',
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
  const transformed = transformModel(directive, node, {
    ...context,
    cacheHandlers: false,
  });
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
          // With handler caching disabled, Vue's core model transform returns its assignment
          // expression.
          update.value as CompoundExpressionNode,
          ')($event.value)',
        ]),
      },
    ],
  };
};

function collectTemplateIdentifiers(root: RootNode): Set<string> {
  const identifiers = new Set<string>();
  const collectExpression = (expression: ExpressionNode | undefined): void => {
    if (expression?.type !== NodeTypes.SIMPLE_EXPRESSION || expression.isStatic) {
      return;
    }
    if (expression.ast) {
      // Vue's parsed AST includes decoded identifiers and destructured binding patterns.
      walkIdentifiers(expression.ast, (identifier) => identifiers.add(identifier.name), true);
    } else if (expression.ast === null) {
      identifiers.add(expression.content);
    }
  };
  const visit = (node: RootNode | ElementNode): void => {
    if (node.type === NodeTypes.ELEMENT) {
      for (const property of node.props) {
        if (property.type !== NodeTypes.DIRECTIVE) {
          continue;
        }
        collectExpression(property.arg);
        collectExpression(property.exp);
        if (
          property.name === 'bind'
          && !property.exp
          && property.arg?.type === NodeTypes.SIMPLE_EXPRESSION
          && property.arg.isStatic
        ) {
          // Vue expands :name to :name="name" after parsing.
          identifiers.add(property.arg.content);
        }
        if (property.forParseResult) {
          const { source, value, key, index } = property.forParseResult;
          for (const expression of [
            source,
            value,
            key,
            index,
          ]) {
            collectExpression(expression);
          }
        }
      }
    }
    for (const child of node.children) {
      if (child.type === NodeTypes.ELEMENT) {
        visit(child);
      } else if (child.type === NodeTypes.INTERPOLATION) {
        collectExpression(child.content);
      }
    }
  };
  visit(root);
  return identifiers;
}

function compileTemplateProperties(
  node: RootNode | ElementNode,
  options: CompileCueOptions,
  images: CueImageImports,
  errors: CompileCueError[],
): void {
  if (node.type === NodeTypes.ELEMENT) {
    for (let index = 0; index < node.props.length; ++index) {
      const property = node.props[index]!;
      if (
        node.tagType === ElementTypes.ELEMENT
        && node.tag === 'cue-image'
        && property.type === NodeTypes.ATTRIBUTE
        && property.name === 'src'
        && property.value
      ) {
        const source = property.value.content;
        if (!isUuidSource(source)) {
          if (source.startsWith('./') || source.startsWith('../')) {
            node.props[index] = {
              arg: createSimpleExpression('src', true, property.loc),
              exp: createSimpleExpression(
                images.expression(source, 'sprite-frame'),
                false,
                property.loc,
                ConstantTypes.CAN_STRINGIFY,
              ),
              loc: property.loc,
              modifiers: [],
              name: 'bind',
              type: NodeTypes.DIRECTIVE,
            };
          } else {
            errors.push(Object.assign(new SyntaxError(
              '<cue-image> src must be a relative path or use the "uuid:" scheme.',
            ), { loc: property.loc }));
          }
        }
        continue;
      }
      if (
        node.tagType === ElementTypes.ELEMENT
        && property.type === NodeTypes.DIRECTIVE
        && property.name === 'model'
      ) {
        const model = Object.hasOwn(cueControlDefinitions, node.tag)
          ? cueControlDefinitions[node.tag]?.model
          : undefined;
        let message: string | undefined;
        if (!model) {
          message = `Cue native element <${node.tag}> does not support v-model.`;
        } else if (property.arg) {
          message
            = ('Cue native control v-model does not support arguments; bind '
              + 'its value without an argument.');
        } else if (property.modifiers.some((modifier) => modifier.content !== 'lazy')) {
          message = 'Cue native control v-model supports only the .lazy modifier.';
        }
        if (message) {
          errors.push(Object.assign(new SyntaxError(message), { loc: property.loc }));
        }
      }
      if (property.type === NodeTypes.DIRECTIVE && property.name === 'on') {
        if (node.tagType === ElementTypes.ELEMENT) {
          if (
            property.arg?.type !== NodeTypes.SIMPLE_EXPRESSION
            || !property.arg.isStatic
          ) {
            errors.push(
              Object.assign(
                new SyntaxError(
                  ('Cue native event bindings require a static event name; '
                    + 'dynamic v-on arguments and v-on objects are not supported.'),
                ),
                { loc: property.loc },
              ),
            );
          } else if (!supportedNativeEvents.has(property.arg.content)) {
            errors.push(
              Object.assign(
                new SyntaxError(
                  `Unsupported Cue native event "${property.arg.content}". Supported events: ${[...supportedNativeEvents].join(', ')}.`,
                ),
                { loc: property.loc },
              ),
            );
          }
        }
        for (const modifier of property.modifiers) {
          if (!supportedEventModifiers.has(modifier.content)) {
            errors.push(
              Object.assign(
                new SyntaxError(
                  `Unsupported Cue event modifier ".${modifier.content}". Supported modifiers: stop, prevent, self, once, capture, passive.`,
                ),
                { loc: modifier.loc },
              ),
            );
          }
          if (
            node.tagType === ElementTypes.ELEMENT
            && property.arg?.type === NodeTypes.SIMPLE_EXPRESSION
            && property.arg.isStatic
          ) {
            if (
              [
                'enter',
                'tab',
                'delete',
                'esc',
                'space',
                'up',
                'down',
              ].includes(
                modifier.content,
              )
              && property.arg.content !== 'keydown'
              && property.arg.content !== 'keyup'
            ) {
              errors.push(
                Object.assign(
                  new SyntaxError(
                    `Cue key modifier ".${modifier.content}" requires keydown or keyup.`,
                  ),
                  { loc: modifier.loc },
                ),
              );
            }
            if (
              property.arg.content === 'click'
              && (modifier.content === 'right' || modifier.content === 'middle')
            ) {
              errors.push(
                Object.assign(
                  new SyntaxError(
                    `Cue click.${modifier.content} is unsupported; use pointerdown.${modifier.content} or pointerup.${modifier.content}.`,
                  ),
                  { loc: modifier.loc },
                ),
              );
            }
          }
        }
        if (
          property.modifiers.some((modifier) => modifier.content === 'passive')
          && property.modifiers.some((modifier) => modifier.content === 'prevent')
        ) {
          errors.push(
            Object.assign(
              new SyntaxError(
                'Cue event modifiers .passive and .prevent cannot be combined.',
              ),
              { loc: property.loc },
            ),
          );
        }
      }
      const name
        = property.type === NodeTypes.ATTRIBUTE
          ? property.name
          : property.name === 'bind'
            && property.arg?.type === NodeTypes.SIMPLE_EXPRESSION
            && property.arg.isStatic
            ? property.arg.content
            : undefined;
      if (name === '__cueInlineStyle') {
        errors.push(
          Object.assign(
            new SyntaxError('__cueInlineStyle is reserved for Cue compiler output.'),
            { loc: property.loc },
          ),
        );
        continue;
      }
      if (name !== 'style') {
        continue;
      }
      if (property.type === NodeTypes.DIRECTIVE) {
        errors.push(
          Object.assign(
            new SyntaxError(
              ('Dynamic :style bindings are not supported. Update the '
                + 'element\'s typed CueElement.style properties instead.'),
            ),
            { loc: property.loc },
          ),
        );
        continue;
      }
      const result = compileCueInlineStyle(
        property.value?.content ?? '',
        options.filename,
      );
      errors.push(
        ...result.errors.map((error) => Object.assign(error, { loc: property.loc })),
      );
      if (!result.rule) {
        node.props.splice(index, 1);
        --index;
        continue;
      }
      node.props[index] = {
        arg: createSimpleExpression('__cueInlineStyle', true, property.loc),
        exp: createSimpleExpression(
          images.styleRule(result.rule),
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
      compileTemplateProperties(child, options, images, errors);
    }
  }
}

function isUuidSource(source: string): boolean {
  return (
    source.startsWith('uuid:')
    && source.length > 'uuid:'.length
    && !/\s/u.test(source.slice('uuid:'.length))
  );
}

import { Buffer } from 'node:buffer';
import {
  compileCueStyleRules,
  type CanonicalizeCueImageSource,
} from './compile-cue-style-rules.js';
import {
  cueStyleSchemaVersion,
  type CueStyleRule,
  type CueStyleSheet,
} from '@bsgames/cue-style-schema';
import { transform, transformStyleAttribute, type StyleSheet } from 'lightningcss';

export interface CompileCueStyleResult {
  errors: Error[];
  styleSheet?: CueStyleSheet;
}

export function compileCueInlineStyle(
  source: string,
  filename: string,
  canonicalizeBackgroundImageSource?: CanonicalizeCueImageSource,
): { errors: Error[]; rule?: CueStyleRule } {
  try {
    // The attribute parser rejects rule syntax. Lower its serialized output as
    // a stylesheet because Lightning's attribute visitor omits !important.
    const attribute = transformStyleAttribute({ code: Buffer.from(source) });
    const result = compileCueStyle(
      ['.cue-inline {' + Buffer.from(attribute.code).toString() + '}'],
      filename,
      canonicalizeBackgroundImageSource,
    );
    const rule = result.styleSheet?.rules[0];
    return { errors: result.errors, ...(rule ? { rule } : {}) };
  } catch (error) {
    return { errors: [error instanceof Error ? error : new Error(String(error))] };
  }
}

export function compileCueStyle(
  styleSources: readonly string[],
  filename: string,
  canonicalizeBackgroundImageSource?: CanonicalizeCueImageSource,
): CompileCueStyleResult {
  const errors: Error[] = [];
  const rules: CueStyleRule[] = [];

  for (const [styleIndex, source] of styleSources.entries()) {
    let ast: StyleSheet | undefined;
    try {
      transform({
        code: Buffer.from(source),
        filename: filename + '?style=' + styleIndex,
        visitor: {
          StyleSheetExit(styleSheet) {
            ast = styleSheet;
          },
        },
      });
    } catch (error) {
      errors.push(error instanceof Error ? error : new Error(String(error)));
      continue;
    }

    if (!ast) {
      errors.push(new Error('Lightning CSS did not provide a stylesheet AST.'));
      continue;
    }
    rules.push(...compileCueStyleRules(
      ast,
      filename,
      canonicalizeBackgroundImageSource,
      errors,
    ));
  }

  return errors.length > 0
    ? {
      errors,
    }
    : {
      errors,
      styleSheet: {
        rules,
        version: cueStyleSchemaVersion,
      },
    };
}

export {};

import { describe, expect, it } from 'vitest';
import { compileCue } from '../src/index.js';

describe('native control compilation contracts', () => {
  it.each(['cue-toggle', 'cue-slider', 'cue-select', 'cue-text-input', 'cue-number-input'])(
    'compiles %s model bindings without DOM directives', (tagName) => {
      /// @case A builtin control binds a writable script-setup model.
      /// @expect The native element receives value and input bindings without Vue DOM helpers.
      const result = compileCue(`<script setup>let value;</script><template><${tagName} v-model="value" /></template>`, {
        filename: 'control.cue',
      });
      expect(result.ok).toBe(true);
      if (!result.ok) {
        return;
      }
      const template = result.files.find(({ fileName }) => fileName.endsWith('.template.js'))!.code;
      expect(template).toContain(`_createElementBlock("${tagName}"`);
      expect(template).toContain('value:');
      expect(template).toContain('onInput:');
      expect(template).toContain('$event.value');
      expect(template).not.toContain('vModel');
    },
  );

  it('uses the committed change event for lazy models', () => {
    /// @case A number field uses the supported lazy modifier.
    /// @expect Only change writes back the event value to the bound model.
    const result = compileCue('<template><cue-number-input v-model.lazy="value" /></template>', { filename: 'lazy.cue' });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const template = result.files.find(({ fileName }) => fileName.endsWith('.template.js'))!.code;
      expect(template).toContain('onChange:');
      expect(template).not.toContain('onInput:');
    }
  });

  it.each([
    '<cue-button v-model="value" />',
    '<cue-toggle v-model:checked="value" />',
    '<cue-number-input v-model.number="value" />',
    '<cue-text-input v-model.trim="value" />',
    '<input v-model="value" />',
  ])('diagnoses an unsupported native model contract: %s', (template) => {
    /// @case A native model requests a missing control contract, argument, or modifier.
    /// @expect Compilation fails rather than generating DOM directives or silently ignoring syntax.
    expect(compileCue(`<template>${template}</template>`, { filename: 'invalid.cue' }).ok).toBe(false);
  });

  it('compiles control selectors with their real CSS token identities', () => {
    /// @case A rule combines type, ID, classes, states, child and descendant selectors in a list.
    /// @expect Every selector remains an explicit CSS token sequence in the stylesheet IR.
    const result = compileCue('<template><cue-slider /></template><style>cue-slider#volume.form:hover > .thumb, * .label:focus-within { width: 12px; }</style>', {
      filename: 'selectors.cue',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      const style = result.files.find(({ fileName }) => fileName.endsWith('.style.js'))!.code;
      expect(style).toContain('"type": "type"');
      expect(style).toContain('"type": "id"');
      expect(style).toContain('"type": "universal"');
      expect(style).toContain('"value": "child"');
      expect(style).toContain('"value": "descendant"');
      expect(style).toContain('"kind": "focus-within"');
    }
  });

  it.each(['div + div', 'div[title]', 'div::before', 'div:not(.off)'])(
    'diagnoses selectors outside the supported subset: %s', (selector) => {
      /// @case A stylesheet uses an unsupported combinator, attribute selector, or pseudo selector.
      /// @expect Unsupported syntax fails visibly instead of silently dropping a rule.
      expect(compileCue(`<template><div /></template><style>${selector} { width: 1px; }</style>`, { filename: 'unsupported.cue' }).ok).toBe(false);
    },
  );
});

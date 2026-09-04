import { describe, expect, it } from 'vitest';
import {
  CharacterData,
  Comment,
  CueElement,
  CueNode,
  CustomElementRegistry,
  DivElement,
  globalElementRegistry,
  Text,
} from '../src/index.js';

describe('CharacterData', () => {
  it('owns the mutable data shared by text and comment nodes', () => {
    /// @case
    /// Text and Comment are created with character data and then updated.
    /// @expect
    /// Both nodes inherit CharacterData and expose their current data without adding data to CueElement.
    const text = new Text('initial text');
    const comment = new Comment('initial comment');

    text.data = 'updated text';
    comment.data = 'updated comment';

    expect(text).toBeInstanceOf(CharacterData);
    expect(comment).toBeInstanceOf(CharacterData);
    expect(text.data).toBe('updated text');
    expect(comment.data).toBe('updated comment');
    expect('data' in new DivElement()).toBe(false);
  });
});

describe('CueElement', () => {
  it('maintains parentage and ordering while nodes move through the tree', () => {
    /// @case
    /// CueNode instances are inserted, reordered, and moved between CueElement parents.
    /// @expect
    /// Children remain ordered and each node reports exactly one current parent.
    const left = new DivElement();
    const right = new DivElement();
    const first = new Text('first');
    const second = new Text('second');

    left.insertBefore(first);
    left.insertBefore(second, first);

    expect(left).toBeInstanceOf(CueNode);
    expect(first).toBeInstanceOf(CueNode);
    expect(left.children).toEqual([second, first]);
    expect(first.parent).toBe(left);
    expect(second.parent).toBe(left);

    right.insertBefore(first);

    expect(left.children).toEqual([second]);
    expect(right.children).toEqual([first]);
    expect(first.parent).toBe(right);
  });

  it('rejects tree cycles', () => {
    /// @case
    /// An ancestor is inserted below one of its descendants.
    /// @expect
    /// The mutation throws and leaves the existing tree unchanged.
    const parent = new DivElement();
    const child = new DivElement();
    parent.insertBefore(child);

    expect(() => child.insertBefore(parent))
      .toThrow('Cannot insert an element into itself or one of its descendants.');
    expect(parent.children).toEqual([child]);
    expect(child.parent).toBe(parent);
  });
});

describe('CustomElementRegistry', () => {
  it('stores and returns explicitly defined element constructors', () => {
    /// @case
    /// A custom constructor is defined in a registry and builtin div is defined in the global registry.
    /// @expect
    /// Both definitions are returned through get while an unknown name remains absent.
    class RegisteredElement extends CueElement {}

    const registry = new CustomElementRegistry();
    registry.define('registered-element', RegisteredElement);

    expect(registry.get('registered-element')).toBe(RegisteredElement);
    expect(registry.get('missing-element')).toBeUndefined();
    expect(globalElementRegistry.get('div')).toBe(DivElement);
  });

  it('rejects duplicate definitions in the same registry', () => {
    /// @case
    /// The same element name is defined twice in one registry.
    /// @expect
    /// The second definition throws instead of silently replacing the first.
    class DuplicateElement extends CueElement {}

    const registry = new CustomElementRegistry();
    registry.define('duplicate-element', DuplicateElement);

    expect(() => registry.define('duplicate-element', DuplicateElement))
      .toThrow('Element "duplicate-element" is already defined in this registry.');
  });
});

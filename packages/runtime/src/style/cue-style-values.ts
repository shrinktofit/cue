import { Length, LengthUnit } from './length.js';
import type { CueStyle } from './cue-style.js';

/** Style assignments store values, not caller-owned object graphs. */
export function copyCueStyleValue<Value>(value: Value): Value {
  if (value instanceof Length) {
    return Object.freeze(value.unit === LengthUnit.px ? Length.px(value.value) : Length.percent(value.value)) as Value;
  }
  if (Array.isArray(value)) return Object.freeze(value.map(copyCueStyleValue)) as Value;
  if (value && typeof value === 'object') {
    return Object.freeze(Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copyCueStyleValue(item)]))) as Value;
  }
  return value;
}

export function equalCueStyleValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length
    && keys.every((key) => Object.hasOwn(right, key)
      && equalCueStyleValue(Reflect.get(left, key), Reflect.get(right, key)));
}

/** Top-level mutation is observable; composite values are immutable snapshots. */
export function createCueStyle(changed: () => void): CueStyle {
  return new Proxy<CueStyle>({}, {
    set(target, property, value) {
      const previous: unknown = Reflect.get(target, property);
      if (equalCueStyleValue(previous, value)) return true;
      if (value === undefined) Reflect.deleteProperty(target, property);
      else Reflect.set(target, property, copyCueStyleValue(value));
      changed();
      return true;
    },
    deleteProperty(target, property) {
      if (Object.hasOwn(target, property)) {
        Reflect.deleteProperty(target, property);
        changed();
      }
      return true;
    },
  });
}

export {};

interface CueModifierEvent {
  readonly target: unknown;
  readonly currentTarget: unknown;
  readonly ctrlKey?: boolean;
  readonly shiftKey?: boolean;
  readonly altKey?: boolean;
  readonly metaKey?: boolean;
  readonly button?: number;
  stopPropagation(): void;
  preventDefault(): void;
}

// These strings are Vue compiler helper arguments, not Cue event names.
type CueEventModifier = 'stop' | 'prevent' | 'self' | 'ctrl' | 'shift' | 'alt' | 'meta' | 'exact' | 'left' | 'middle' | 'right';
const systemModifiers = ['ctrl', 'shift', 'alt', 'meta'] as const;

/** Applies Vue's supported event guards in template order without a DOM dependency. */
export function withModifiers<Event extends CueModifierEvent, Args extends unknown[], Result>(
  handler: (event: Event, ...args: Args) => Result,
  modifiers: readonly CueEventModifier[],
): (event: Event, ...args: Args) => Result | undefined {
  return (event, ...args) => {
    for (const modifier of modifiers) {
      switch (modifier) {
      case 'stop':
        event.stopPropagation();
        break;
      case 'prevent':
        event.preventDefault();
        break;
      case 'self':
        if (event.target !== event.currentTarget) {
          return;
        }
        break;
      case 'ctrl':
      case 'shift':
      case 'alt':
      case 'meta':
        if (!event[`${modifier}Key`]) {
          return;
        }
        break;
      case 'exact':
        if (systemModifiers.some((key) => event[`${key}Key`] && !modifiers.includes(key))) {
          return;
        }
        break;
      case 'left':
      case 'middle':
      case 'right':
        if (event.button !== undefined && event.button !== (modifier === 'left' ? 0 : modifier === 'middle' ? 1 : 2)) {
          return;
        }
        break;
      default:
        throw new TypeError(`Unsupported Cue event modifier ".${String(modifier)}".`);
      }
    }
    return handler(event, ...args);
  };
}

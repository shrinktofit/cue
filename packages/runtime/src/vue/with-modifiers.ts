interface CueModifierEvent {
  readonly target: unknown;
  readonly currentTarget: unknown;
  stopPropagation(): void;
  preventDefault(): void;
}

// These strings are Vue compiler helper arguments, not Cue event names.
type CueEventModifier = 'stop' | 'prevent' | 'self';

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
      default:
        throw new TypeError(`Unsupported Cue event modifier ".${String(modifier)}".`);
      }
    }
    return handler(event, ...args);
  };
}

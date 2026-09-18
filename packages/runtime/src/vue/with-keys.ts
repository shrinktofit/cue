const keyAliases: Readonly<Record<string, readonly string[]>> = {
  esc: ['escape'],
  space: [' '],
  up: ['arrow-up'],
  left: ['arrow-left'],
  right: ['arrow-right'],
  down: ['arrow-down'],
  delete: ['backspace', 'delete'],
};

/** Applies Vue keyboard aliases to Cue keyboard events without a DOM dependency. */
export function withKeys<Event extends { readonly key?: string }, Args extends unknown[], Result>(
  handler: (event: Event, ...args: Args) => Result,
  modifiers: readonly string[],
): (event: Event, ...args: Args) => Result | undefined {
  return (event, ...args) => {
    if (typeof event.key !== 'string') {
      return;
    }
    const key = event.key.replace(/\B([A-Z])/g, '-$1').toLowerCase();
    if (modifiers.some((modifier) => modifier === key || keyAliases[modifier]?.includes(key))) {
      return handler(event, ...args);
    }
  };
}

import component from './component-custom-events.cue.js';
import { createCueRenderer, CueRootElement } from '@bsgames/cue';

export function runComponentCustomEvents() {
  const app = createCueRenderer().createApp(component);
  const exposed = app.mount(new CueRootElement()) as unknown as { calls: string[] };
  const calls = [...exposed.calls];
  app.unmount();
  return calls;
}

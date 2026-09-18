import { render } from './pointer-modifiers.cue.template.js';

export function runPointerModifiers() {
  const calls: string[] = [];
  const target = {};
  const node = render({
    handle(_event: unknown, argument: string) {
      calls.push('handler:' + argument);
      return 'handled';
    },
  }, [], {}, {}, {}, {});
  const event = {
    currentTarget: target,
    preventDefault() { calls.push('prevent'); },
    stopPropagation() { calls.push('stop'); },
    target,
  };
  const returnValue = node.props.onClick(event, 'own');
  node.props.onClick({ ...event, target: {} }, 'child');
  node.props.onPointerdown({ ...event, target: {} }, 'child');
  node.props.onPointerdown(event, 'own-pointer');
  return { calls, returnValue };
}

export enum CueControlValueType {
  boolean = 'boolean',
  number = 'number',
  string = 'string',
}

export interface CueControlModelDefinition {
  readonly property: 'value';
  readonly valueType: CueControlValueType;
  readonly optional: boolean;
}

export interface CueControlDefinition {
  readonly model?: CueControlModelDefinition;
}

/** The native control contracts shared by compiler lowering and runtime properties. */
export const cueControlDefinitions: Readonly<Record<string, CueControlDefinition>> = {
  'cue-button': {},
  'cue-toggle': { model: { property: 'value', valueType: CueControlValueType.boolean, optional: false } },
  'cue-slider': { model: { property: 'value', valueType: CueControlValueType.number, optional: false } },
  'cue-select': { model: { property: 'value', valueType: CueControlValueType.string, optional: true } },
  'cue-text-input': { model: { property: 'value', valueType: CueControlValueType.string, optional: false } },
  'cue-number-input': { model: { property: 'value', valueType: CueControlValueType.number, optional: true } },
};

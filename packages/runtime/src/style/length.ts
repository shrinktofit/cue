export enum LengthUnit {
  px = 'px',
  percent = 'percent',
}

/** A typed CSS length. Percentage values use 50 for 50%, not 0.5. */
export class Length<Unit extends LengthUnit = LengthUnit> {
  static px(value: number): Length<LengthUnit.px> {
    return new Length(value, LengthUnit.px);
  }

  static percent(value: number): Length<LengthUnit.percent> {
    return new Length(value, LengthUnit.percent);
  }

  private constructor(readonly value: number, readonly unit: Unit) {
    if (!Number.isFinite(value)) {
      throw new RangeError('A style length must be finite.');
    }
  }
}

export {};

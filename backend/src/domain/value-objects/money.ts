import { DomainValidationError } from "../errors/domain-errors.js";

export class Money {
  readonly cents: number;

  constructor(cents: number) {
    if (!Number.isInteger(cents) || cents < 0) {
      throw new DomainValidationError(
        "MONEY_INVALID_VALUE",
        "O valor monetário deve ser informado em centavos, como inteiro não negativo.",
      );
    }

    this.cents = cents;
  }

  static fromDecimal(value: number): Money {
    if (!Number.isFinite(value) || value < 0) {
      throw new DomainValidationError(
        "MONEY_INVALID_VALUE",
        "O valor monetário deve ser não negativo.",
      );
    }

    return new Money(Math.round(value * 100));
  }

  multiply(quantity: number): Money {
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new DomainValidationError(
        "MONEY_INVALID_MULTIPLIER",
        "O multiplicador deve ser um inteiro não negativo.",
      );
    }

    return new Money(this.cents * quantity);
  }

  toDecimal(): number {
    return this.cents / 100;
  }
}

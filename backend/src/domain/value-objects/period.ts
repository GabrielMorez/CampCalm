import { DomainValidationError } from "../errors/domain-errors.js";

export class Period {
  readonly startDate: Date;
  readonly endDate: Date;

  constructor(startDate: Date, endDate: Date) {
    if (!(startDate instanceof Date) || Number.isNaN(startDate.getTime())) {
      throw new DomainValidationError(
        "RESERVATION_INVALID_PERIOD",
        "A data inicial informada é inválida.",
      );
    }

    if (!(endDate instanceof Date) || Number.isNaN(endDate.getTime())) {
      throw new DomainValidationError(
        "RESERVATION_INVALID_PERIOD",
        "A data final informada é inválida.",
      );
    }

    if (startDate >= endDate) {
      throw new DomainValidationError(
        "RESERVATION_INVALID_PERIOD",
        "A data inicial deve ser anterior à data final.",
      );
    }

    this.startDate = new Date(startDate);
    this.endDate = new Date(endDate);
  }

  overlaps(other: Period): boolean {
    return this.startDate < other.endDate && other.startDate < this.endDate;
  }

  contains(date: Date): boolean {
    return date >= this.startDate && date < this.endDate;
  }

  get nights(): number {
    const millisecondsPerDay = 24 * 60 * 60 * 1000;
    return Math.ceil(
      (this.endDate.getTime() - this.startDate.getTime()) / millisecondsPerDay,
    );
  }
}

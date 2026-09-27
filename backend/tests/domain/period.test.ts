import { describe, expect, it } from "vitest";
import { DomainValidationError } from "../../src/domain/errors/domain-errors.js";
import { Period } from "../../src/domain/value-objects/period.js";

describe("Period", () => {
  it("creates a valid period and calculates the number of nights", () => {
    const period = new Period(
      new Date("2026-10-09T00:00:00.000Z"),
      new Date("2026-10-11T00:00:00.000Z"),
    );

    expect(period.nights).toBe(2);
  });

  it("rejects a period whose start date equals the end date", () => {
    expect(
      () =>
        new Period(
          new Date("2026-10-09T00:00:00.000Z"),
          new Date("2026-10-09T00:00:00.000Z"),
        ),
    ).toThrowError(DomainValidationError);
  });

  it("detects overlapping periods", () => {
    const first = new Period(
      new Date("2026-10-09T00:00:00.000Z"),
      new Date("2026-10-11T00:00:00.000Z"),
    );
    const second = new Period(
      new Date("2026-10-10T00:00:00.000Z"),
      new Date("2026-10-12T00:00:00.000Z"),
    );

    expect(first.overlaps(second)).toBe(true);
  });
});

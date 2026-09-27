import { describe, expect, it } from "vitest";
import { InvalidReservationStateError } from "../../src/domain/errors/domain-errors.js";
import { Reservation } from "../../src/domain/entities/reservation.js";
import { Money } from "../../src/domain/value-objects/money.js";
import { Period } from "../../src/domain/value-objects/period.js";

function makeReservation() {
  return new Reservation({
    id: "reservation-1",
    camperId: "camper-1",
    campingId: "camping-1",
    spaceId: "space-1",
    period: new Period(
      new Date("2026-10-09T00:00:00.000Z"),
      new Date("2026-10-11T00:00:00.000Z"),
    ),
    dailyRate: Money.fromDecimal(50),
  });
}

describe("Reservation", () => {
  it("starts with PENDING status", () => {
    const reservation = makeReservation();

    expect(reservation.status).toBe("PENDING");
  });

  it("approves a pending reservation", () => {
    const reservation = makeReservation();

    reservation.approve();

    expect(reservation.status).toBe("CONFIRMED");
  });

  it("does not approve an already confirmed reservation", () => {
    const reservation = makeReservation();
    reservation.approve();

    expect(() => reservation.approve()).toThrowError(InvalidReservationStateError);
  });

  it("calculates Friday to Sunday at R$ 50/day as R$ 100", () => {
    const reservation = makeReservation();

    expect(reservation.total.toDecimal()).toBe(100);
  });
});

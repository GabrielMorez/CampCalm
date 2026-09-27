import { describe, expect, it } from "vitest";
import { CreateReservationUseCase } from "../../src/application/use-cases/create-reservation.js";
import { Camping } from "../../src/domain/entities/camping.js";
import { Space } from "../../src/domain/entities/space.js";
import {
  CampingInactiveError,
  ReservationConflictError,
} from "../../src/domain/errors/domain-errors.js";
import type { CampingRepository } from "../../src/domain/repositories/camping-repository.js";
import type { SpaceRepository } from "../../src/domain/repositories/space-repository.js";
import { Money } from "../../src/domain/value-objects/money.js";
import { Period } from "../../src/domain/value-objects/period.js";
import { InMemoryReservationRepository } from "../../src/infrastructure/repositories/in-memory-reservation-repository.js";

class StubCampingRepository implements CampingRepository {
  constructor(private readonly camping: Camping | null) {}

  async findNearby(): Promise<Camping[]> {
    return this.camping ? [this.camping] : [];
  }

  async findById(): Promise<Camping | null> {
    return this.camping;
  }

  async save(): Promise<void> {}
}

class StubSpaceRepository implements SpaceRepository {
  constructor(private readonly space: Space | null) {}

  async findAvailable(): Promise<Space[]> {
    return this.space ? [this.space] : [];
  }

  async findById(): Promise<Space | null> {
    return this.space;
  }

  async save(): Promise<void> {}
}

function makePeriod() {
  return new Period(
    new Date("2026-10-09T00:00:00.000Z"),
    new Date("2026-10-11T00:00:00.000Z"),
  );
}

function makeCamping(active = true) {
  return new Camping({
    id: "camping-1",
    name: "Camping Teste",
    latitude: -26.7,
    longitude: -49.3,
    active,
  });
}

function makeSpace() {
  return new Space({
    id: "space-1",
    campingId: "camping-1",
    name: "Lote 1",
    accommodationTypes: ["TENT"],
    dailyRate: Money.fromDecimal(50),
  });
}

describe("CreateReservationUseCase", () => {
  it("creates a pending reservation when the camping and space are available", async () => {
    const reservationRepository = new InMemoryReservationRepository();
    const useCase = new CreateReservationUseCase(
      new StubCampingRepository(makeCamping()),
      new StubSpaceRepository(makeSpace()),
      reservationRepository,
    );

    const reservation = await useCase.execute({
      id: "reservation-1",
      camperId: "camper-1",
      campingId: "camping-1",
      spaceId: "space-1",
      period: makePeriod(),
    });

    expect(reservation.status).toBe("PENDING");
    expect(reservation.total.toDecimal()).toBe(100);
  });

  it("rejects a new reservation when the period conflicts with a pending reservation", async () => {
    const reservationRepository = new InMemoryReservationRepository();
    const useCase = new CreateReservationUseCase(
      new StubCampingRepository(makeCamping()),
      new StubSpaceRepository(makeSpace()),
      reservationRepository,
    );

    await useCase.execute({
      id: "reservation-1",
      camperId: "camper-1",
      campingId: "camping-1",
      spaceId: "space-1",
      period: makePeriod(),
    });

    await expect(
      useCase.execute({
        id: "reservation-2",
        camperId: "camper-2",
        campingId: "camping-1",
        spaceId: "space-1",
        period: makePeriod(),
      }),
    ).rejects.toBeInstanceOf(ReservationConflictError);
  });

  it("rejects reservations for an inactive camping", async () => {
    const useCase = new CreateReservationUseCase(
      new StubCampingRepository(makeCamping(false)),
      new StubSpaceRepository(makeSpace()),
      new InMemoryReservationRepository(),
    );

    await expect(
      useCase.execute({
        id: "reservation-1",
        camperId: "camper-1",
        campingId: "camping-1",
        spaceId: "space-1",
        period: makePeriod(),
      }),
    ).rejects.toBeInstanceOf(CampingInactiveError);
  });
});

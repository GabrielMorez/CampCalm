import type { Reservation } from "../../domain/entities/reservation.js";
import type { ReservationRepository } from "../../domain/repositories/reservation-repository.js";
import type { Period } from "../../domain/value-objects/period.js";

export class InMemoryReservationRepository implements ReservationRepository {
  private readonly data = new Map<string, Reservation>();

  async findConflicts(spaceId: string, period: Period): Promise<Reservation[]> {
    return [...this.data.values()].filter(
      (reservation) =>
        reservation.spaceId === spaceId &&
        (reservation.status === "PENDING" || reservation.status === "CONFIRMED") &&
        reservation.period.overlaps(period),
    );
  }

  async save(reservation: Reservation): Promise<void> {
    this.data.set(reservation.id, reservation);
  }

  async update(reservation: Reservation): Promise<void> {
    this.data.set(reservation.id, reservation);
  }

  async findActiveByDate(campingId: string, date: Date): Promise<Reservation[]> {
    return [...this.data.values()].filter(
      (reservation) =>
        reservation.campingId === campingId &&
        reservation.status === "CONFIRMED" &&
        reservation.period.contains(date),
    );
  }
}

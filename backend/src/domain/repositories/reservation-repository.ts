import type { Reservation } from "../entities/reservation.js";
import type { Period } from "../value-objects/period.js";

export interface ReservationRepository {
  findConflicts(spaceId: string, period: Period): Promise<Reservation[]>;
  save(reservation: Reservation): Promise<void>;
  update(reservation: Reservation): Promise<void>;
  findActiveByDate(campingId: string, date: Date): Promise<Reservation[]>;
}

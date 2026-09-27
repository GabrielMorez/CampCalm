import { Reservation } from "../../domain/entities/reservation.js";
import {
  CampingInactiveError,
  ReservationConflictError,
  SpaceUnavailableError,
} from "../../domain/errors/domain-errors.js";
import type { CampingRepository } from "../../domain/repositories/camping-repository.js";
import type { ReservationRepository } from "../../domain/repositories/reservation-repository.js";
import type { SpaceRepository } from "../../domain/repositories/space-repository.js";
import type { Period } from "../../domain/value-objects/period.js";

export interface CreateReservationInput {
  id: string;
  camperId: string;
  campingId: string;
  spaceId: string;
  period: Period;
}

export class CreateReservationUseCase {
  constructor(
    private readonly campingRepository: CampingRepository,
    private readonly spaceRepository: SpaceRepository,
    private readonly reservationRepository: ReservationRepository,
  ) {}

  async execute(input: CreateReservationInput): Promise<Reservation> {
    const camping = await this.campingRepository.findById(input.campingId);

    if (!camping || !camping.active) {
      throw new CampingInactiveError();
    }

    const space = await this.spaceRepository.findById(input.spaceId);

    if (!space || !space.active || space.campingId !== input.campingId) {
      throw new SpaceUnavailableError();
    }

    const conflicts = await this.reservationRepository.findConflicts(
      input.spaceId,
      input.period,
    );

    if (conflicts.length > 0) {
      throw new ReservationConflictError();
    }

    const reservation = new Reservation({
      id: input.id,
      camperId: input.camperId,
      campingId: input.campingId,
      spaceId: input.spaceId,
      period: input.period,
      dailyRate: space.dailyRate,
    });

    await this.reservationRepository.save(reservation);

    return reservation;
  }
}

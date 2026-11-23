import type { Pool, PoolClient, QueryResultRow } from "pg";

import {
  Reservation,
  type ReservationStatus,
} from "../../domain/entities/reservation.js";

import {
  DomainValidationError,
  InvalidReservationStateError,
  ReservationConflictError,
} from "../../domain/errors/domain-errors.js";

import type { ReservationRepository } from "../../domain/repositories/reservation-repository.js";
import { Money } from "../../domain/value-objects/money.js";
import { Period } from "../../domain/value-objects/period.js";

interface ReservationRow extends QueryResultRow {
  id: string;
  camper_id: string;
  camping_id: string;
  space_id: string;
  start_date: string;
  end_date: string;
  daily_rate_cents: number;
  status: ReservationStatus;
}

const RESERVATION_COLUMNS = `
  id,
  camper_id,
  camping_id,
  space_id,
  start_date::text AS start_date,
  end_date::text AS end_date,
  daily_rate_cents,
  status
`;

function toDateOnly(date: Date): string {
  if (Number.isNaN(date.getTime())) {
    throw new DomainValidationError(
      "RESERVATION_INVALID_PERIOD",
      "Data inválida.",
    );
  }

  return date.toISOString().slice(0, 10);
}

function toPeriodDate(date: Date): string {
  if (
    date.getUTCHours() !== 0 ||
    date.getUTCMinutes() !== 0 ||
    date.getUTCSeconds() !== 0 ||
    date.getUTCMilliseconds() !== 0
  ) {
    throw new DomainValidationError(
      "RESERVATION_INVALID_PERIOD",
      "As datas da reserva devem representar dias inteiros em UTC.",
    );
  }

  return toDateOnly(date);
}

function toReservation(row: ReservationRow): Reservation {
  return new Reservation({
    id: row.id,
    camperId: row.camper_id,
    campingId: row.camping_id,
    spaceId: row.space_id,
    period: new Period(
      new Date(`${row.start_date}T00:00:00.000Z`),
      new Date(`${row.end_date}T00:00:00.000Z`),
    ),
    dailyRate: new Money(row.daily_rate_cents),
    status: row.status,
  });
}

function isOverlapError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23P01" &&
    "constraint" in error &&
    error.constraint === "reservations_no_active_overlap"
  );
}

export class PostgresReservationRepository implements ReservationRepository {
  constructor(private readonly db: Pool | PoolClient) {}

  async findConflicts(spaceId: string, period: Period): Promise<Reservation[]> {
    const result = await this.db.query<ReservationRow>(
      `
      SELECT ${RESERVATION_COLUMNS}
      FROM reservations
      WHERE space_id = $1
        AND status IN ('PENDING', 'CONFIRMED')
        AND daterange(start_date, end_date, '[)')
            && daterange($2::date, $3::date, '[)')
      ORDER BY start_date
      `,
      [spaceId, toPeriodDate(period.startDate), toPeriodDate(period.endDate)],
    );

    return result.rows.map(toReservation);
  }

  async save(reservation: Reservation): Promise<void> {
    try {
      await this.db.query(
        `
        INSERT INTO reservations (
          id,
          camper_id,
          camping_id,
          space_id,
          start_date,
          end_date,
          daily_rate_cents,
          status
        )
        VALUES (
          $1, $2, $3, $4,
          $5::date, $6::date,
          $7, $8
        )
        `,
        [
          reservation.id,
          reservation.camperId,
          reservation.campingId,
          reservation.spaceId,
          toPeriodDate(reservation.period.startDate),
          toPeriodDate(reservation.period.endDate),
          reservation.dailyRate.cents,
          reservation.status,
        ],
      );
    } catch (error) {
      if (isOverlapError(error)) {
        throw new ReservationConflictError();
      }

      throw error;
    }
  }

  async update(reservation: Reservation): Promise<void> {
    if (
      reservation.status !== "CONFIRMED" &&
      reservation.status !== "REFUSED"
    ) {
      throw new InvalidReservationStateError(
        "A atualização deve representar aprovação ou recusa.",
      );
    }

    const result = await this.db.query(
      `
      UPDATE reservations
      SET status = $2
      WHERE id = $1
        AND status = 'PENDING'
      RETURNING id
      `,
      [reservation.id, reservation.status],
    );

    if (result.rowCount !== 1) {
      throw new InvalidReservationStateError(
        "Reserva inexistente ou já processada.",
      );
    }
  }

  async findActiveByDate(
    campingId: string,
    date: Date,
  ): Promise<Reservation[]> {
    const result = await this.db.query<ReservationRow>(
      `
      SELECT ${RESERVATION_COLUMNS}
      FROM reservations
      WHERE camping_id = $1
        AND status = 'CONFIRMED'
        AND start_date <= $2::date
        AND end_date > $2::date
      ORDER BY start_date
      `,
      [campingId, toDateOnly(date)],
    );

    return result.rows.map(toReservation);
  }
}

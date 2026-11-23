import type { Pool, QueryResultRow } from "pg";

import { Space, type AccommodationType } from "../../domain/entities/space.js";

import { DomainValidationError } from "../../domain/errors/domain-errors.js";
import type { SpaceRepository } from "../../domain/repositories/space-repository.js";
import { Money } from "../../domain/value-objects/money.js";
import type { Period } from "../../domain/value-objects/period.js";

interface SpaceRow extends QueryResultRow {
  id: string;
  camping_id: string;
  name: string;
  dimensions: string | null;
  daily_rate_cents: number;
  active: boolean;
  accommodation_types: AccommodationType[];
}

const SPACE_COLUMNS = `
  s.id,
  s.camping_id,
  s.name,
  s.dimensions,
  s.daily_rate_cents,
  s.active,
  ARRAY(
    SELECT sat.accommodation_type
    FROM space_accommodation_types sat
    WHERE sat.space_id = s.id
    ORDER BY sat.accommodation_type
  ) AS accommodation_types
`;

function toSpace(row: SpaceRow): Space {
  return new Space({
    id: row.id,
    campingId: row.camping_id,
    name: row.name,
    accommodationTypes: row.accommodation_types,
    ...(row.dimensions !== null ? { dimensions: row.dimensions } : {}),
    dailyRate: new Money(row.daily_rate_cents),
    active: row.active,
  });
}

function toSqlDate(date: Date): string {
  if (
    Number.isNaN(date.getTime()) ||
    date.getUTCHours() !== 0 ||
    date.getUTCMinutes() !== 0 ||
    date.getUTCSeconds() !== 0 ||
    date.getUTCMilliseconds() !== 0
  ) {
    throw new DomainValidationError(
      "RESERVATION_INVALID_PERIOD",
      "A data deve representar meia-noite UTC.",
    );
  }

  return date.toISOString().slice(0, 10);
}

export class PostgresSpaceRepository implements SpaceRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<Space | null> {
    const result = await this.pool.query<SpaceRow>(
      `
      SELECT ${SPACE_COLUMNS}
      FROM spaces s
      WHERE s.id = $1
      `,
      [id],
    );

    const row = result.rows[0];
    return row ? toSpace(row) : null;
  }

  async findAvailable(campingId: string, period: Period): Promise<Space[]> {
    const result = await this.pool.query<SpaceRow>(
      `
      SELECT ${SPACE_COLUMNS}
      FROM spaces s
      INNER JOIN campings c ON c.id = s.camping_id
      WHERE s.camping_id = $1
        AND s.active = TRUE
        AND c.active = TRUE
        AND c.publication_status = 'APPROVED'
        AND NOT EXISTS (
          SELECT 1
          FROM reservations r
          WHERE r.space_id = s.id
            AND r.status IN ('PENDING', 'CONFIRMED')
            AND daterange(r.start_date, r.end_date, '[)')
                && daterange($2::date, $3::date, '[)')
        )
      ORDER BY s.name, s.id
      `,
      [campingId, toSqlDate(period.startDate), toSqlDate(period.endDate)],
    );

    return result.rows.map(toSpace);
  }

  async save(space: Space): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        `
        INSERT INTO spaces (
          id,
          camping_id,
          name,
          dimensions,
          daily_rate_cents,
          active
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        `,
        [
          space.id,
          space.campingId,
          space.name,
          space.dimensions ?? null,
          space.dailyRate.cents,
          space.active,
        ],
      );

      await client.query(
        `
        INSERT INTO space_accommodation_types (
          space_id,
          accommodation_type
        )
        SELECT $1::uuid, UNNEST($2::text[])
        ON CONFLICT DO NOTHING
        `,
        [space.id, space.accommodationTypes],
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

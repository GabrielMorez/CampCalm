import type { Pool, PoolClient, QueryResultRow } from "pg";

import { Camping } from "../../domain/entities/camping.js";
import { DomainValidationError } from "../../domain/errors/domain-errors.js";
import type { CampingRepository } from "../../domain/repositories/camping-repository.js";

interface CampingRow extends QueryResultRow {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  active: boolean;
}

function toCamping(row: CampingRow): Camping {
  return new Camping({
    id: row.id,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    active: row.active,
  });
}

export class PostgresCampingRepository implements CampingRepository {
  constructor(private readonly db: Pool | PoolClient) {}

  async findById(id: string): Promise<Camping | null> {
    const result = await this.db.query<CampingRow>(
      `
      SELECT id, name, latitude, longitude, active
      FROM campings
      WHERE id = $1
      `,
      [id],
    );

    const row = result.rows[0];
    return row ? toCamping(row) : null;
  }

  async findNearby(
    latitude: number,
    longitude: number,
    radiusKm: number,
  ): Promise<Camping[]> {
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      throw new DomainValidationError(
        "CAMPING_INVALID_LATITUDE",
        "Latitude inválida.",
      );
    }

    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      throw new DomainValidationError(
        "CAMPING_INVALID_LONGITUDE",
        "Longitude inválida.",
      );
    }

    if (!Number.isFinite(radiusKm) || radiusKm < 0) {
      throw new DomainValidationError(
        "CAMPING_INVALID_RADIUS",
        "O raio da pesquisa deve ser não negativo.",
      );
    }

    const result = await this.db.query<CampingRow>(
      `
      WITH origin AS (
        SELECT ST_SetSRID(
          ST_MakePoint($2::double precision, $1::double precision),
          4326
        )::geography AS point
      )
      SELECT
        c.id,
        c.name,
        c.latitude,
        c.longitude,
        c.active
      FROM campings c
      CROSS JOIN origin
      WHERE c.active = TRUE
        AND ST_DWithin(
          c.location,
          origin.point,
          $3::double precision * 1000
        )
      ORDER BY ST_Distance(c.location, origin.point), c.id
      `,
      [latitude, longitude, radiusKm],
    );

    return result.rows.map(toCamping);
  }

  async save(camping: Camping): Promise<void> {
    await this.db.query(
      `
      INSERT INTO campings (
        id, name, latitude, longitude, active
      )
      VALUES ($1, $2, $3, $4, $5)
      `,
      [
        camping.id,
        camping.name,
        camping.latitude,
        camping.longitude,
        camping.active,
      ],
    );
  }
}

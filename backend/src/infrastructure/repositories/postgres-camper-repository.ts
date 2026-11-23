import type { Pool, PoolClient, QueryResultRow } from "pg";

import { Camper } from "../../domain/entities/camper.js";
import { CamperEmailAlreadyExistsError } from "../../domain/errors/domain-errors.js";
import type { CamperRepository } from "../../domain/repositories/camper-repository.js";

interface CamperRow extends QueryResultRow {
  id: string;
  name: string;
  email: string;
  phone: string;
}

function toCamper(row: CamperRow): Camper {
  return new Camper({
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone,
  });
}

function isDuplicateEmail(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const dbError = error as {
    code?: string;
    constraint?: string;
  };

  return (
    dbError.code === "23505" &&
    dbError.constraint === "campers_email_lower_uniq"
  );
}

export class PostgresCamperRepository implements CamperRepository {
  constructor(private readonly db: Pool | PoolClient) {}

  async findById(id: string): Promise<Camper | null> {
    const result = await this.db.query<CamperRow>(
      `
      SELECT id, name, email, phone
      FROM campers
      WHERE id = $1
      `,
      [id],
    );

    const row = result.rows[0];

    return row ? toCamper(row) : null;
  }

  async save(camper: Camper): Promise<void> {
    try {
      await this.db.query(
        `
        INSERT INTO campers (
          id,
          name,
          email,
          phone
        )
        VALUES ($1, $2, $3, $4)
        `,
        [camper.id, camper.name, camper.email, camper.phone],
      );
    } catch (error) {
      if (isDuplicateEmail(error)) {
        throw new CamperEmailAlreadyExistsError();
      }

      throw error;
    }
  }
}

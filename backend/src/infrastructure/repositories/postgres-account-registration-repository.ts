
import type { Pool } from "pg";

import type { User } from "../../domain/entities/user.js";
import type { Camper } from "../../domain/entities/camper.js";

import { AccountEmailAlreadyExistsError } from "../../domain/errors/domain-errors.js";

import type { AccountRegistrationRepository } from "../../application/ports/account-registration-repository.js";

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
    (
      dbError.constraint === "users_email_lower_uniq" ||
      dbError.constraint === "campers_email_lower_uniq"
    )
  );
}

export class PostgresAccountRegistrationRepository
  implements AccountRegistrationRepository
{
  constructor(private readonly pool: Pool) {}

  async save(user: User, camper: Camper): Promise<void> {
    if (user.email !== camper.email) {
      throw new Error(
        "O e-mail da conta deve corresponder ao perfil do campista.",
      );
    }

    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      await client.query(
        `
        INSERT INTO users (
          id,
          email,
          password_hash,
          active
        )
        VALUES ($1, $2, $3, $4)
        `,
        [
          user.id,
          user.email,
          user.passwordHash,
          user.active,
        ],
      );

      await client.query(
        `
        INSERT INTO campers (
          id,
          user_id,
          name,
          email,
          phone
        )
        VALUES ($1, $2, $3, $4, $5)
        `,
        [
          camper.id,
          user.id,
          camper.name,
          camper.email,
          camper.phone,
        ],
      );

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");

      if (isDuplicateEmail(error)) {
        throw new AccountEmailAlreadyExistsError();
      }

      throw error;
    } finally {
      client.release();
    }
  }
}

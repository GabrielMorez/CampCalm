import type { Pool, PoolClient, QueryResultRow } from "pg";

import { User } from "../../domain/entities/user.js";
import type { UserRepository } from "../../domain/repositories/user-repository.js";

interface UserRow extends QueryResultRow {
  id: string;
  email: string;
  password_hash: string;
  active: boolean;
}

function toUser(row: UserRow): User {
  return new User({
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    active: row.active,
  });
}

export class PostgresUserRepository implements UserRepository {
  constructor(private readonly db: Pool | PoolClient) {}

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.db.query<UserRow>(
      `
      SELECT id, email, password_hash, active
      FROM users
      WHERE lower(email) = lower($1)
      LIMIT 1
      `,
      [email.trim()],
    );

    const row = result.rows[0];
    return row ? toUser(row) : null;
  }

  async findById(id: string): Promise<User | null> {
    const result = await this.db.query<UserRow>(
      `
      SELECT id, email, password_hash, active
      FROM users
      WHERE id = $1
      `,
      [id],
    );

    const row = result.rows[0];
    return row ? toUser(row) : null;
  }
}
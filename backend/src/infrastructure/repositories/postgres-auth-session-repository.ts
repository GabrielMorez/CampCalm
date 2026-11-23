
import type { Pool, QueryResultRow } from "pg";

import type {
  AuthSessionRepository,
  CreateAuthSessionInput,
  RotateAuthSessionInput,
  RotateAuthSessionResult,
  RevokeAuthSessionInput,
} from "../../application/ports/auth-session-repository.js";

interface SessionRow extends QueryResultRow {
  user_id: string;
  expires_at: Date;
}

export class PostgresAuthSessionRepository
  implements AuthSessionRepository
{
  constructor(private readonly pool: Pool) {}

  async create(
    input: CreateAuthSessionInput,
  ): Promise<void> {
    const result = await this.pool.query(
      `
      INSERT INTO auth_sessions (
        id,
        user_id,
        refresh_token_hash,
        expires_at
      )
      SELECT
        $1::uuid,
        u.id,
        $3::text,
        $4::timestamptz
      FROM users u
      WHERE u.id = $2::uuid
        AND u.active = TRUE
      RETURNING id
      `,
      [
        input.id,
        input.userId,
        input.refreshTokenHash,
        input.expiresAt,
      ],
    );

    if (result.rowCount !== 1) {
      throw new Error(
        "Não foi possível criar a sessão para este usuário.",
      );
    }
  }

  async rotate(
    input: RotateAuthSessionInput,
  ): Promise<RotateAuthSessionResult | null> {
    // A condição sobre o hash torna a rotação
    // atômica, inclusive entre requisições concorrentes.
    const result = await this.pool.query<SessionRow>(
      `
      UPDATE auth_sessions s
      SET
        refresh_token_hash = $3,
        last_used_at = NOW()
      FROM users u
      WHERE s.id = $1
        AND s.refresh_token_hash = $2
        AND s.user_id = u.id
        AND u.active = TRUE
        AND s.revoked_at IS NULL
        AND s.expires_at > NOW()
      RETURNING
        s.user_id,
        s.expires_at
      `,
      [
        input.sessionId,
        input.currentTokenHash,
        input.newTokenHash,
      ],
    );

    const row = result.rows[0];

    if (!row) {
      return null;
    }

    return {
      userId: row.user_id,
      expiresAt: row.expires_at,
    };
  }

  async revoke(
    input: RevokeAuthSessionInput,
  ): Promise<boolean> {
    const result = await this.pool.query(
      `
      UPDATE auth_sessions
      SET revoked_at = NOW()
      WHERE id = $1
        AND refresh_token_hash = $2
        AND revoked_at IS NULL
      RETURNING id
      `,
      [
        input.sessionId,
        input.refreshTokenHash,
      ],
    );

    return result.rowCount === 1;
  }

  async isActive(
    sessionId: string,
    userId: string,
  ): Promise<boolean> {
    const result = await this.pool.query(
      `
      SELECT 1
      FROM auth_sessions s
      INNER JOIN users u
        ON u.id = s.user_id
      WHERE s.id = $1
        AND s.user_id = $2
        AND u.active = TRUE
        AND s.revoked_at IS NULL
        AND s.expires_at > NOW()
      LIMIT 1
      `,
      [sessionId, userId],
    );

    return result.rowCount === 1;
  }
}

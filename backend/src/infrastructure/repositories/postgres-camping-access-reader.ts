import type { Pool, PoolClient, QueryResultRow } from "pg";

import type {
  CampingAccessReader,
  CampingRole,
} from "../../application/ports/camping-access-reader.js";

interface RoleRow extends QueryResultRow {
  role: CampingRole;
}

export class PostgresCampingAccessReader implements CampingAccessReader {
  constructor(private readonly db: Pool | PoolClient) {}

  async findRole(
    userId: string,
    campingId: string,
  ): Promise<CampingRole | null> {
    const result = await this.db.query<RoleRow>(
      `
      SELECT cu.role
      FROM camping_users cu
      INNER JOIN users u
        ON u.id = cu.user_id
      WHERE cu.user_id = $1
        AND cu.camping_id = $2
        AND u.active = TRUE
      `,
      [userId, campingId],
    );

    return result.rows[0]?.role ?? null;
  }

  async isPlatformModerator(userId: string): Promise<boolean> {
    const result = await this.db.query(
      `
      SELECT 1
      FROM platform_moderators pm
      INNER JOIN users u
        ON u.id = pm.user_id
      WHERE pm.user_id = $1
        AND u.active = TRUE
      LIMIT 1
      `,
      [userId],
    );

    return result.rowCount === 1;
  }
}

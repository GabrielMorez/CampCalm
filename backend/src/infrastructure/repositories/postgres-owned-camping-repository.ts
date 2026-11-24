import type { Pool } from "pg";

import type { Camping } from "../../domain/entities/camping.js";

export class PostgresOwnedCampingRepository {
  constructor(private readonly pool: Pool) {}

  async createOwned(
    camping: Camping,
    userId: string,
    addressText: string,
  ): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      await client.query("BEGIN");

      // Confirma que o proprietário continua ativo.
      const user = await client.query(
        `
        SELECT id
        FROM users
        WHERE id = $1
          AND active = TRUE
        FOR SHARE
        `,
        [userId],
      );

      if (user.rowCount !== 1) {
        await client.query("ROLLBACK");
        return false;
      }

      // O banco aplica PENDING_REVIEW automaticamente.
      await client.query(
        `
        INSERT INTO campings (id, name, latitude, longitude, address_text)
        VALUES ($1, $2, $3, $4, $5)
        `,
        [camping.id, camping.name, camping.latitude, camping.longitude, camping.addressText],
      );

      // Vinculação automática do proprietário.
      await client.query(
        `
        INSERT INTO camping_users (
          camping_id,
          user_id,
          role
        )
        VALUES ($1, $2, 'OWNER')
        `,
        [camping.id, userId],
      );

      await client.query("COMMIT");

      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async findByUser(userId: string) {
    const result = await this.pool.query(
      `
      SELECT
        c.id,
        c.name,
        c.active,
        c.publication_status AS "publicationStatus",
        c.address_text AS "addressText",
        cu.role
      FROM camping_users cu
      INNER JOIN campings c
        ON c.id = cu.camping_id
      WHERE cu.user_id = $1
      ORDER BY c.created_at DESC
      `,
      [userId],
    );

    return result.rows;
  }
}

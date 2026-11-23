import { pool } from "./postgres.js";

async function main(): Promise<void> {
  try {
    const result = await pool.query<{
      database: string;
      postgis_version: string | null;
      migrations: string;
    }>(`
      SELECT
        current_database() AS database,
        (
          SELECT extversion
          FROM pg_extension
          WHERE extname = 'postgis'
        ) AS postgis_version,
        (
          SELECT count(*)::text
          FROM schema_migrations
        ) AS migrations
    `);

    console.log("Conexão PostgreSQL estabelecida!");
    console.table(result.rows);
  } catch (error) {
    console.error("Erro na conexão PostgreSQL:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

await main();

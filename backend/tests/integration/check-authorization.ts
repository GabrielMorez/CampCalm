import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import { config } from "dotenv";
import { Pool } from "pg";

import { CampingAuthorizationService } from "../../src/application/services/camping-authorization-service.js";
import { AccessDeniedError } from "../../src/application/errors/authorization-errors.js";
import { PostgresCampingAccessReader } from "../../src/infrastructure/repositories/postgres-camping-access-reader.js";

config({
  path: resolve(process.cwd(), "../.env"),
  quiet: true,
});

const pool = new Pool({
  host: process.env.DATABASE_HOST ?? "127.0.0.1",
  port: Number(process.env.DATABASE_PORT ?? 5432),
  database: "campcalm_test",
  user: process.env.DATABASE_USER ?? "campcalm",
  password: process.env.DATABASE_PASSWORD,
});

const ownerId = randomUUID();
const managerId = randomUUID();
const outsiderId = randomUUID();
const moderatorId = randomUUID();
const inactiveId = randomUUID();

const campingAId = randomUUID();
const campingBId = randomUUID();

const userIds = [ownerId, managerId, outsiderId, moderatorId, inactiveId];

const campingIds = [campingAId, campingBId];

const authorization = new CampingAuthorizationService(
  new PostgresCampingAccessReader(pool),
);

async function setup(): Promise<void> {
  for (const [index, id] of userIds.entries()) {
    await pool.query(
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
        id,
        `authorization-${id}@example.test`,
        "test-only-not-a-real-password-hash",
        id !== inactiveId,
      ],
    );
  }

  for (const [index, id] of campingIds.entries()) {
    await pool.query(
      `
      INSERT INTO campings (
        id,
        name,
        latitude,
        longitude
      )
      VALUES ($1, $2, $3, $4)
      `,
      [id, `Camping Autorização ${index + 1}`, -26.9, -49.23],
    );
  }

  for (const [userId, campingId, role] of [
    [ownerId, campingAId, "OWNER"],
    [managerId, campingAId, "MANAGER"],
    [inactiveId, campingBId, "OWNER"],
  ]) {
    await pool.query(
      `
      INSERT INTO camping_users (
        user_id,
        camping_id,
        role
      )
      VALUES ($1, $2, $3)
      `,
      [userId, campingId, role],
    );
  }

  await pool.query(
    `
    INSERT INTO platform_moderators (user_id)
    VALUES ($1)
    `,
    [moderatorId],
  );
}

async function cleanup(): Promise<void> {
  await pool.query(
    `
    DELETE FROM camping_users
    WHERE camping_id = ANY($1::uuid[])
    `,
    [campingIds],
  );

  await pool.query(
    `
    DELETE FROM platform_moderators
    WHERE user_id = ANY($1::uuid[])
    `,
    [userIds],
  );

  await pool.query(
    `
    DELETE FROM campings
    WHERE id = ANY($1::uuid[])
    `,
    [campingIds],
  );

  await pool.query(
    `
    DELETE FROM users
    WHERE id = ANY($1::uuid[])
    `,
    [userIds],
  );
}

async function run(): Promise<void> {
  const database = await pool.query<{ name: string }>(
    "SELECT current_database() AS name",
  );

  assert.equal(database.rows[0]?.name, "campcalm_test");

  try {
    await setup();

    // OWNER e MANAGER gerenciam seu camping.
    await authorization.requireManageCamping(ownerId, campingAId);

    await authorization.requireManageCamping(managerId, campingAId);

    console.log("OK: OWNER e MANAGER gerenciam o próprio camping");

    // Somente OWNER gerencia responsáveis.
    await authorization.requireManageMembers(ownerId, campingAId);

    await assert.rejects(
      () => authorization.requireManageMembers(managerId, campingAId),
      AccessDeniedError,
    );

    console.log("OK: somente OWNER gerencia responsáveis");

    // Usuário comum não gerencia camping.
    await assert.rejects(
      () => authorization.requireManageCamping(outsiderId, campingAId),
      AccessDeniedError,
    );

    // OWNER de A não pode administrar B.
    await assert.rejects(
      () => authorization.requireManageCamping(ownerId, campingBId),
      AccessDeniedError,
    );

    console.log("OK: acesso negado a outros campings");

    // Usuário desativado perde autorização.
    await assert.rejects(
      () => authorization.requireManageCamping(inactiveId, campingBId),
      AccessDeniedError,
    );

    console.log("OK: usuário desativado sem acesso");

    // Apenas moderadores aprovam publicações.
    await authorization.requirePlatformModerator(moderatorId);

    await assert.rejects(
      () => authorization.requirePlatformModerator(ownerId),
      AccessDeniedError,
    );

    await assert.rejects(
      () => authorization.requirePlatformModerator(managerId),
      AccessDeniedError,
    );

    console.log("OK: moderação exclusiva da plataforma");

    // MODERATOR não administra automaticamente
    // estabelecimentos de terceiros.
    await assert.rejects(
      () => authorization.requireManageCamping(moderatorId, campingAId),
      AccessDeniedError,
    );

    console.log("OK: moderador sem acesso administrativo automático");

    console.log("\nTodos os testes de autorização passaram!");
  } finally {
    await cleanup();
  }
}

run()
  .catch((error: unknown) => {
    console.error("Falha nos testes de autorização:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

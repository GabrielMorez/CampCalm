import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import { config } from "dotenv";
import { Pool } from "pg";

import { Reservation } from "../../src/domain/entities/reservation.js";
import { ReservationConflictError } from "../../src/domain/errors/domain-errors.js";
import { Money } from "../../src/domain/value-objects/money.js";
import { Period } from "../../src/domain/value-objects/period.js";
import { PostgresReservationRepository } from "../../src/infrastructure/repositories/postgres-reservation-repository.js";

config({
  path: resolve(process.cwd(), "../.env"),
  quiet: true,
});

// Sempre conecta ao banco local exclusivo de testes.
const pool = new Pool({
  host: "127.0.0.1",
  port: Number(process.env.DATABASE_PORT ?? 5432),
  user: process.env.DATABASE_USER ?? "campcalm",
  password: process.env.DATABASE_PASSWORD,
  database: "campcalm_test",
  max: 5,
});

const camperId = randomUUID();
const campingId = randomUUID();
const spaceId = randomUUID();

function makeReservation(): Reservation {
  return new Reservation({
    id: randomUUID(),
    camperId,
    campingId,
    spaceId,
    period: new Period(
      new Date("2027-01-10T00:00:00.000Z"),
      new Date("2027-01-12T00:00:00.000Z"),
    ),
    dailyRate: new Money(5000),
  });
}

async function clearReservations(): Promise<void> {
  await pool.query("DELETE FROM reservations WHERE space_id = $1", [spaceId]);
}

async function seed(): Promise<void> {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(
      `INSERT INTO campers (id, name, email, phone)
       VALUES ($1, $2, $3, $4)`,
      [camperId, "Campista Teste", `${camperId}@example.test`, "47999999999"],
    );

    await client.query(
      `INSERT INTO campings (id, name, latitude, longitude)
       VALUES ($1, $2, $3, $4)`,
      [campingId, "Camping Teste", -26.897, -49.231],
    );

    await client.query(
      `INSERT INTO spaces (
         id, camping_id, name, daily_rate_cents
       ) VALUES ($1, $2, $3, $4)`,
      [spaceId, campingId, "Lote 01", 5000],
    );

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function cleanup(): Promise<void> {
  await clearReservations();

  await pool.query("DELETE FROM spaces WHERE id = $1", [spaceId]);
  await pool.query("DELETE FROM campings WHERE id = $1", [campingId]);
  await pool.query("DELETE FROM campers WHERE id = $1", [camperId]);
}

async function runTests(): Promise<void> {
  // Proteção contra execução no banco errado.
  const database = await pool.query<{ name: string }>(
    "SELECT current_database() AS name",
  );

  assert.equal(database.rows[0]?.name, "campcalm_test");

  await seed();

  const repository = new PostgresReservationRepository(pool);

  try {
    // TESTE 1: gravação e consulta de conflitos.
    const first = makeReservation();

    await repository.save(first);

    const conflicts = await repository.findConflicts(spaceId, first.period);

    assert.equal(conflicts.length, 1);
    assert.equal(conflicts[0]?.status, "PENDING");
    assert.equal(conflicts[0]?.dailyRate.cents, 5000);

    console.log("OK: save() e findConflicts()");

    // TESTE 2: aprovação mantém o bloqueio.
    first.approve();
    await repository.update(first);

    const active = await repository.findActiveByDate(
      campingId,
      new Date("2027-01-11T00:00:00.000Z"),
    );

    assert.equal(active.length, 1);
    assert.equal(active[0]?.status, "CONFIRMED");

    await assert.rejects(
      () => repository.save(makeReservation()),
      ReservationConflictError,
    );

    console.log("OK: aprovação mantém o bloqueio");

    await clearReservations();

    // TESTE 3: recusa libera a vaga.
    const refused = makeReservation();

    await repository.save(refused);

    refused.refuse();
    await repository.update(refused);

    assert.equal(
      (await repository.findConflicts(spaceId, refused.period)).length,
      0,
    );

    await repository.save(makeReservation());

    console.log("OK: recusa libera a vaga");

    await clearReservations();

    // TESTE 4: concorrência real entre conexões.
    const results = await Promise.allSettled([
      repository.save(makeReservation()),
      repository.save(makeReservation()),
    ]);

    const successful = results.filter(
      (result) => result.status === "fulfilled",
    );

    const failed = results.filter(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );

    assert.equal(successful.length, 1);
    assert.equal(failed.length, 1);

    assert.ok(failed[0]?.reason instanceof ReservationConflictError);

    const persisted = await pool.query<{ total: number }>(
      `SELECT COUNT(*)::integer AS total
       FROM reservations
       WHERE space_id = $1
         AND status = 'PENDING'`,
      [spaceId],
    );

    assert.equal(persisted.rows[0]?.total, 1);

    console.log("OK: duas solicitações simultâneas");
    console.log("OK: somente uma reserva persistida");
  } finally {
    await cleanup();
  }
}

runTests()
  .then(() => {
    console.log("\nTodos os testes de integração passaram!");
  })
  .catch((error: unknown) => {
    console.error("\nFalha na integração PostgreSQL:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

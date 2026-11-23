import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import { config } from "dotenv";
import { Pool } from "pg";

import { CreateReservationUseCase } from "../../src/application/use-cases/create-reservation.js";
import { Camping } from "../../src/domain/entities/camping.js";
import { Space } from "../../src/domain/entities/space.js";
import { ReservationConflictError } from "../../src/domain/errors/domain-errors.js";
import { Money } from "../../src/domain/value-objects/money.js";
import { Period } from "../../src/domain/value-objects/period.js";

import { PostgresCampingRepository } from "../../src/infrastructure/repositories/postgres-camping-repository.js";
import { PostgresSpaceRepository } from "../../src/infrastructure/repositories/postgres-space-repository.js";
import { PostgresReservationRepository } from "../../src/infrastructure/repositories/postgres-reservation-repository.js";

import { Camper } from "../../src/domain/entities/camper.js";
import { CamperEmailAlreadyExistsError } from "../../src/domain/errors/domain-errors.js";
import { PostgresCamperRepository } from "../../src/infrastructure/repositories/postgres-camper-repository.js";

config({
  path: resolve(process.cwd(), "../.env"),
  quiet: true,
});

const pool = new Pool({
  host: "127.0.0.1",
  port: Number(process.env.DATABASE_PORT ?? 5432),
  database: "campcalm_test",
  user: process.env.DATABASE_USER ?? "campcalm",
  password: process.env.DATABASE_PASSWORD,
  max: 5,
});

const campingAId = randomUUID();
const campingBId = randomUUID();
const campingCId = randomUUID();
const camperId = randomUUID();

const spaceAId = randomUUID();
const spaceBId = randomUUID();
const spaceCId = randomUUID();

const period = new Period(
  new Date("2027-01-10T00:00:00.000Z"),
  new Date("2027-01-12T00:00:00.000Z"),
);

const campingRepository = new PostgresCampingRepository(pool);
const spaceRepository = new PostgresSpaceRepository(pool);
const reservationRepository = new PostgresReservationRepository(pool);
const camperRepository = new PostgresCamperRepository(pool);

const createReservation = new CreateReservationUseCase(
  campingRepository,
  spaceRepository,
  reservationRepository,
);

async function cleanup(): Promise<void> {
  const campingIds = [campingAId, campingBId, campingCId];

  await pool.query(
    "DELETE FROM reservations WHERE camping_id = ANY($1::uuid[])",
    [campingIds],
  );

  await pool.query("DELETE FROM spaces WHERE camping_id = ANY($1::uuid[])", [
    campingIds,
  ]);

  await pool.query("DELETE FROM campings WHERE id = ANY($1::uuid[])", [
    campingIds,
  ]);

  await pool.query("DELETE FROM campers WHERE id = $1", [camperId]);
}

async function runTests(): Promise<void> {
  const database = await pool.query<{ name: string }>(
    "SELECT current_database() AS name",
  );

  assert.equal(database.rows[0]?.name, "campcalm_test");

  try {
    // 1. Cadastrar campings
    await campingRepository.save(
      new Camping({
        id: campingAId,
        name: "Camping Próximo A",
        latitude: -26.9001,
        longitude: -49.2301,
      }),
    );

    await campingRepository.save(
      new Camping({
        id: campingBId,
        name: "Camping Próximo B",
        latitude: -26.94,
        longitude: -49.28,
      }),
    );

    await campingRepository.save(
      new Camping({
        id: campingCId,
        name: "Camping Inativo",
        latitude: -26.9002,
        longitude: -49.2302,
        active: false,
      }),
    );

    const camping = await campingRepository.findById(campingAId);

    assert.equal(camping?.name, "Camping Próximo A");
    assert.equal(camping?.active, true);

    console.log("OK: cadastro e consulta de camping");

    // 2. Buscar campings próximos
    const nearby = await campingRepository.findNearby(-26.9, -49.23, 100);

    const testIds: string[] = [campingAId, campingBId, campingCId];

    const foundIds = nearby
      .map((item) => item.id)
      .filter((id) => testIds.includes(id));

    assert.deepEqual(foundIds, [campingAId, campingBId]);
    assert.equal(foundIds.includes(campingCId), false);

    console.log("OK: busca geográfica e exclusão de inativos");

    // 3. Cadastrar espaços
    await spaceRepository.save(
      new Space({
        id: spaceAId,
        campingId: campingAId,
        name: "Lote 01",
        accommodationTypes: ["TENT", "MOTORHOME"],
        dimensions: "8x10m",
        dailyRate: new Money(5000),
      }),
    );

    await spaceRepository.save(
      new Space({
        id: spaceBId,
        campingId: campingAId,
        name: "Lote 02",
        accommodationTypes: ["TRAILER"],
        dailyRate: new Money(7500),
      }),
    );

    await spaceRepository.save(
      new Space({
        id: spaceCId,
        campingId: campingAId,
        name: "Lote Inativo",
        accommodationTypes: ["TENT"],
        dailyRate: new Money(3000),
        active: false,
      }),
    );

    const space = await spaceRepository.findById(spaceAId);

    assert.equal(space?.name, "Lote 01");
    assert.equal(space?.dailyRate.cents, 5000);
    assert.deepEqual([...(space?.accommodationTypes ?? [])].sort(), [
      "MOTORHOME",
      "TENT",
    ]);

    console.log("OK: cadastro, categorias e valores dos espaços");

    // 4. Verificar disponibilidade inicial
    const availableBefore = await spaceRepository.findAvailable(
      campingAId,
      period,
    );

    assert.deepEqual(
      availableBefore.map((item) => item.id).sort(),
      [spaceAId, spaceBId].sort(),
    );

    console.log("OK: disponibilidade inicial");

    // 5. Cadastrar e consultar campista
    await camperRepository.save(
      new Camper({
        id: camperId,
        name: "Campista Integração",
        email: `${camperId}@example.test`,
        phone: "47999999999",
      }),
    );

    const camper = await camperRepository.findById(camperId);

    assert.equal(camper?.id, camperId);
    assert.equal(camper?.name, "Campista Integração");

    console.log("OK: cadastro e consulta de campista");

    // 5.1. Impedir cadastro de e-mail duplicado
    await assert.rejects(
      () =>
        camperRepository.save(
          new Camper({
            id: randomUUID(),
            name: "Outro Campista",
            email: `${camperId.toUpperCase()}@EXAMPLE.TEST`,
            phone: "47988888888",
          }),
        ),
      CamperEmailAlreadyExistsError,
    );

    console.log("OK: e-mail duplicado rejeitado");

    // 6. Criar reserva com os repositórios reais
    const reservation = await createReservation.execute({
      id: randomUUID(),
      camperId,
      campingId: campingAId,
      spaceId: spaceAId,
      period,
    });

    assert.equal(reservation.status, "PENDING");
    assert.equal(reservation.total.cents, 10000);

    const availableAfter = await spaceRepository.findAvailable(
      campingAId,
      period,
    );

    assert.deepEqual(
      availableAfter.map((item) => item.id),
      [spaceBId],
    );

    console.log("OK: reserva pendente bloqueia o espaço");

    // 7. Impedir reserva duplicada
    await assert.rejects(
      () =>
        createReservation.execute({
          id: randomUUID(),
          camperId,
          campingId: campingAId,
          spaceId: spaceAId,
          period,
        }),
      ReservationConflictError,
    );

    console.log("OK: solicitação duplicada rejeitada");

    // 8. Recusar e liberar disponibilidade
    reservation.refuse();
    await reservationRepository.update(reservation);

    const availableAgain = await spaceRepository.findAvailable(
      campingAId,
      period,
    );

    assert.deepEqual(
      availableAgain.map((item) => item.id).sort(),
      [spaceAId, spaceBId].sort(),
    );

    console.log("OK: recusa libera a disponibilidade");

    console.log("\nIntegração Camping + Space + Reservation aprovada!");
  } finally {
    await cleanup();
  }
}

runTests()
  .catch((error: unknown) => {
    console.error("Falha nos testes:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

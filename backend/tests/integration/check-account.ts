
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import { config } from "dotenv";
import { Pool } from "pg";

import { RegisterAccountUseCase } from "../../src/application/use-cases/register-account.js";
import { AccountEmailAlreadyExistsError } from "../../src/domain/errors/domain-errors.js";
import { PostgresAccountRegistrationRepository } from "../../src/infrastructure/repositories/postgres-account-registration-repository.js";
import { Argon2PasswordHasher } from "../../src/infrastructure/security/argon2-password-hasher.js";

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

const hasher = new Argon2PasswordHasher();

const registerAccount = new RegisterAccountUseCase(
  new PostgresAccountRegistrationRepository(pool),
  hasher,
);

// E-mails exclusivos desta execução.
const mainEmail = `account-${randomUUID()}@example.test`;
const legacyEmail = `legacy-${randomUUID()}@example.test`;
const concurrentEmail = `concurrent-${randomUUID()}@example.test`;

const testEmails = [
  mainEmail,
  legacyEmail,
  concurrentEmail,
];

const password = "SenhaTeste!CampCalm2026";

function makeInput(email: string) {
  return {
    name: "Campista de Teste",
    email,
    phone: "47999999999",
    password,
  };
}

async function assertTestDatabase(): Promise<void> {
  const result = await pool.query<{ name: string }>(
    "SELECT current_database() AS name",
  );

  assert.equal(
    result.rows[0]?.name,
    "campcalm_test",
    "Este teste só pode executar em campcalm_test.",
  );
}

async function cleanup(): Promise<void> {
  // Remove somente os registros com os e-mails
  // exclusivos gerados nesta execução.
  await pool.query(
    `
    DELETE FROM campers
    WHERE lower(email) = ANY($1::text[])
    `,
    [testEmails],
  );

  await pool.query(
    `
    DELETE FROM users
    WHERE lower(email) = ANY($1::text[])
    `,
    [testEmails],
  );
}

async function countByEmail(
  table: "users" | "campers",
  email: string,
): Promise<number> {
  const result = await pool.query<{ total: number }>(
    `
    SELECT COUNT(*)::integer AS total
    FROM ${table}
    WHERE lower(email) = lower($1)
    `,
    [email],
  );

  return result.rows[0]?.total ?? 0;
}

async function runTests(): Promise<void> {
  await assertTestDatabase();

  try {
    // ==========================================
    // 1. Cadastro transacional
    // ==========================================

    const account = await registerAccount.execute(
      makeInput(mainEmail.toUpperCase()),
    );

    assert.equal(account.email, mainEmail);

    // A resposta não deve conter credenciais.
    assert.deepEqual(
      Object.keys(account).sort(),
      ["userId", "camperId", "email"].sort(),
    );

    const result = await pool.query<{
      user_id: string;
      camper_id: string;
      linked_user_id: string;
      email: string;
      password_hash: string;
    }>(
      `
      SELECT
        u.id AS user_id,
        c.id AS camper_id,
        c.user_id AS linked_user_id,
        u.email,
        u.password_hash
      FROM users u
      INNER JOIN campers c
        ON c.user_id = u.id
      WHERE u.id = $1
      `,
      [account.userId],
    );

    assert.equal(result.rowCount, 1);

    const row = result.rows[0];

    assert.ok(row);
    assert.equal(row.user_id, account.userId);
    assert.equal(row.camper_id, account.camperId);
    assert.equal(row.linked_user_id, account.userId);
    assert.equal(row.email, mainEmail);

    console.log("OK: User e Camper criados na mesma operação");

    // ==========================================
    // 2. Segurança da senha
    // ==========================================

    assert.notEqual(row.password_hash, password);
    assert.match(row.password_hash, /^\$argon2id\$/);

    assert.equal(
      await hasher.verify(password, row.password_hash),
      true,
    );

    assert.equal(
      await hasher.verify("senha-incorreta", row.password_hash),
      false,
    );

    console.log("OK: senha armazenada com Argon2id");
    console.log("OK: validação de senha correta/incorreta");

    // ==========================================
    // 3. E-mail duplicado
    // ==========================================

    await assert.rejects(
      () => registerAccount.execute(makeInput(mainEmail)),
      AccountEmailAlreadyExistsError,
    );

    assert.equal(await countByEmail("users", mainEmail), 1);
    assert.equal(await countByEmail("campers", mainEmail), 1);

    console.log("OK: e-mail duplicado rejeitado");

    // ==========================================
    // 4. Rollback se já existir um campista
    // ==========================================

    const legacyCamperId = randomUUID();

    await pool.query(
      `
      INSERT INTO campers (id, name, email, phone)
      VALUES ($1, $2, $3, $4)
      `,
      [
        legacyCamperId,
        "Campista Antigo",
        legacyEmail,
        "47988888888",
      ],
    );

    // O INSERT em users consegue iniciar,
    // mas o INSERT em campers deverá falhar.
    await assert.rejects(
      () => registerAccount.execute(makeInput(legacyEmail)),
      AccountEmailAlreadyExistsError,
    );

    // A transação não pode deixar User órfão.
    assert.equal(
      await countByEmail("users", legacyEmail),
      0,
    );

    // O perfil anterior deve permanecer intacto.
    assert.equal(
      await countByEmail("campers", legacyEmail),
      1,
    );

    console.log("OK: rollback em caso de conflito no Camper");

    // ==========================================
    // 5. Cadastros simultâneos
    // ==========================================

    const results = await Promise.allSettled([
      registerAccount.execute(makeInput(concurrentEmail)),
      registerAccount.execute(makeInput(concurrentEmail)),
    ]);

    const success = results.filter(
      (result) => result.status === "fulfilled",
    );

    const failures = results.filter(
      (result): result is PromiseRejectedResult =>
        result.status === "rejected",
    );

    assert.equal(success.length, 1);
    assert.equal(failures.length, 1);

    assert.ok(
      failures[0]?.reason instanceof
        AccountEmailAlreadyExistsError,
    );

    assert.equal(
      await countByEmail("users", concurrentEmail),
      1,
    );

    assert.equal(
      await countByEmail("campers", concurrentEmail),
      1,
    );

    console.log("OK: cadastro concorrente protegido");
    console.log("OK: apenas uma conta persistida");

    console.log(
      "\nTodos os testes de cadastro de conta passaram!",
    );
  } finally {
    await cleanup();
  }
}

runTests()
  .catch((error: unknown) => {
    console.error(
      "\nFalha na integração de contas:",
      error,
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });


import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { resolve } from "node:path";

import { config } from "dotenv";
import { Pool } from "pg";

import { RegisterAccountUseCase } from "../../src/application/use-cases/register-account.js";
import { AuthSessionService } from "../../src/application/services/auth-session-service.js";
import { InvalidRefreshTokenError } from "../../src/domain/errors/domain-errors.js";
import { PostgresAccountRegistrationRepository } from "../../src/infrastructure/repositories/postgres-account-registration-repository.js";
import { PostgresAuthSessionRepository } from "../../src/infrastructure/repositories/postgres-auth-session-repository.js";
import { Argon2PasswordHasher } from "../../src/infrastructure/security/argon2-password-hasher.js";

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

const email = `session-${randomUUID()}@example.test`;

const sessions = new AuthSessionService(
  new PostgresAuthSessionRepository(pool),
);

const register = new RegisterAccountUseCase(
  new PostgresAccountRegistrationRepository(pool),
  new Argon2PasswordHasher(),
);

async function cleanup(): Promise<void> {
  await pool.query(
    `
    DELETE FROM auth_sessions
    WHERE user_id IN (
      SELECT id FROM users WHERE email = $1
    )
    `,
    [email],
  );

  await pool.query(
    "DELETE FROM campers WHERE email = $1",
    [email],
  );

  await pool.query(
    "DELETE FROM users WHERE email = $1",
    [email],
  );
}

async function run(): Promise<void> {
  const database = await pool.query<{ name: string }>(
    "SELECT current_database() AS name",
  );

  assert.equal(database.rows[0]?.name, "campcalm_test");

  try {
    const account = await register.execute({
      name: "Teste de Sessão",
      email,
      phone: "47999999999",
      password: "SenhaTeste!CampCalm2026",
    });

    // 1. Criar sessão.
    const initial = await sessions.create(account.userId);

    assert.equal(
      await sessions.isActive(
        initial.sessionId,
        account.userId,
      ),
      true,
    );

    console.log("OK: sessão criada e ativa");

    // 2. Verificar armazenamento seguro.
    const stored = await pool.query<{
      refresh_token_hash: string;
    }>(
      `
      SELECT refresh_token_hash
      FROM auth_sessions
      WHERE id = $1
      `,
      [initial.sessionId],
    );

    const tokenHash = stored.rows[0]?.refresh_token_hash;

    assert.ok(tokenHash);
    assert.match(tokenHash, /^[a-f0-9]{64}$/);
    assert.notEqual(tokenHash, initial.refreshToken);

    assert.equal(
      tokenHash,
      createHash("sha256")
        .update(initial.refreshToken)
        .digest("hex"),
    );

    console.log("OK: somente o hash do token foi armazenado");

    // 3. Renovação simples.
    const renewed = await sessions.rotate(
      initial.refreshToken,
    );

    assert.equal(renewed.sessionId, initial.sessionId);
    assert.equal(renewed.userId, account.userId);
    assert.notEqual(
      renewed.refreshToken,
      initial.refreshToken,
    );

    console.log("OK: rotação de refresh token");

    // 4. Token antigo não pode ser reutilizado.
    await assert.rejects(
      () => sessions.rotate(initial.refreshToken),
      InvalidRefreshTokenError,
    );

    console.log("OK: refresh token antigo rejeitado");

    // 5. Duas renovações simultâneas.
    const outcomes = await Promise.allSettled([
      sessions.rotate(renewed.refreshToken),
      sessions.rotate(renewed.refreshToken),
    ]);

    const successes = outcomes.filter(
      (result) => result.status === "fulfilled",
    );

    const failures = outcomes.filter(
      (result) => result.status === "rejected",
    );

    assert.equal(successes.length, 1);
    assert.equal(failures.length, 1);

    const winner = successes[0];
    const loser = failures[0];

    assert.ok(
      winner && winner.status === "fulfilled",
    );

    assert.ok(
      loser && loser.status === "rejected",
    );

    assert.ok(
      loser.reason instanceof InvalidRefreshTokenError,
    );

    console.log("OK: somente uma renovação concorrente venceu");

    // 6. Revogar o token mais recente.
    const currentToken = winner.value.refreshToken;

    const revoked = await sessions.revoke(currentToken);

    assert.equal(revoked, true);

    assert.equal(
      await sessions.isActive(
        initial.sessionId,
        account.userId,
      ),
      false,
    );

    await assert.rejects(
      () => sessions.rotate(currentToken),
      InvalidRefreshTokenError,
    );

    console.log("OK: sessão revogada não pode ser renovada");

    // 7. Sessão expirada.
    const expiring = await sessions.create(account.userId);

    await pool.query(
      `
      UPDATE auth_sessions
      SET
        created_at = NOW() - INTERVAL '31 days',
        expires_at = NOW() - INTERVAL '1 day'
      WHERE id = $1
      `,
      [expiring.sessionId],
    );

    await assert.rejects(
      () => sessions.rotate(expiring.refreshToken),
      InvalidRefreshTokenError,
    );

    console.log("OK: sessão expirada rejeitada");

    // 8. Conta desativada.
    const inactive = await sessions.create(account.userId);

    await pool.query(
      "UPDATE users SET active = FALSE WHERE id = $1",
      [account.userId],
    );

    assert.equal(
      await sessions.isActive(
        inactive.sessionId,
        account.userId,
      ),
      false,
    );

    await assert.rejects(
      () => sessions.rotate(inactive.refreshToken),
      InvalidRefreshTokenError,
    );

    console.log("OK: usuário desativado não renova sessão");

    console.log(
      "\nTodos os testes de sessão passaram!",
    );
  } finally {
    await cleanup();
  }
}

run()
  .catch((error: unknown) => {
    console.error("Falha nos testes de sessão:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });

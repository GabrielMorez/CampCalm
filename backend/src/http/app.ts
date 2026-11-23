import Fastify from "fastify";
import cors from "@fastify/cors";

import { getHealthStatus } from "../index.js";
import { pool } from "../infrastructure/database/postgres.js";

import { RegisterAccountUseCase } from "../application/use-cases/register-account.js";

import { PostgresAccountRegistrationRepository } from "../infrastructure/repositories/postgres-account-registration-repository.js";

import { Argon2PasswordHasher } from "../infrastructure/security/argon2-password-hasher.js";

import {
  registerAuthRoutes,
  type AccountRegistrar,
} from "./routes/auth-routes.js";

interface AppDependencies {
  accountRegistrar?: AccountRegistrar;
}

export async function buildApp(dependencies: AppDependencies = {}) {
  const app = Fastify({
    logger: true,
  });

  const allowedOrigins = (
    process.env.CORS_ORIGINS ??
    [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost",
      "https://localhost",
      "capacitor://localhost",
    ].join(",")
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  await app.register(cors, {
    origin: allowedOrigins,
  });

  // Verifica se o servidor HTTP está respondendo.
  app.get("/health", async () => {
    return getHealthStatus();
  });

  // Verifica se a API consegue consultar o PostgreSQL.
  app.get("/ready", async (_request, reply) => {
    try {
      await pool.query("SELECT 1");

      return {
        status: "ready",
      };
    } catch (error) {
      app.log.error({ err: error }, "PostgreSQL indisponível");

      return reply.code(503).send({
        status: "unavailable",
      });
    }
  });

  const accountRegistrar =
    dependencies.accountRegistrar ??
    new RegisterAccountUseCase(
      new PostgresAccountRegistrationRepository(pool),
      new Argon2PasswordHasher(),
    );

  registerAuthRoutes(app, accountRegistrar);

  return app;
}

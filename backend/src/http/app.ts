import Fastify from "fastify";
import cors from "@fastify/cors";

import { getHealthStatus } from "../index.js";
import { pool } from "../infrastructure/database/postgres.js";

import { RegisterAccountUseCase } from "../application/use-cases/register-account.js";

import { PostgresAccountRegistrationRepository } from "../infrastructure/repositories/postgres-account-registration-repository.js";

import { Argon2PasswordHasher } from "../infrastructure/security/argon2-password-hasher.js";

import fastifyJwt from "@fastify/jwt";
import { AuthenticateUserUseCase } from "../application/use-cases/authenticate-user.js";
import { PostgresUserRepository } from "../infrastructure/repositories/postgres-user-repository.js";
import type { UserRepository } from "../domain/repositories/user-repository.js";
import type { AccountAuthenticator } from "./routes/auth-routes.js";

import { AuthSessionService } from "../application/services/auth-session-service.js";
import { PostgresAuthSessionRepository } from "../infrastructure/repositories/postgres-auth-session-repository.js";
import type { SessionManager } from "./routes/auth-routes.js";

import { registerCampingRoutes } from "./routes/camping-routes.js";

import { registerSpaceRoutes } from "./routes/space-routes.js";

import { registerPublicReservationRoutes } from "./routes/public-reservation-routes.js";

import { registerManageReservationRoutes } from
  "./routes/manage-reservation-routes.js";

import {
  registerAuthRoutes,
  type AccountRegistrar,
} from "./routes/auth-routes.js";

interface AppDependencies {
  accountRegistrar?: AccountRegistrar;
  authenticator?: AccountAuthenticator;
  userRepository?: UserRepository;
  jwtSecret?: string;
  sessions?: SessionManager;
}

export async function buildApp(dependencies: AppDependencies = {}) {
  const app = Fastify({
    logger: true,
  });

  const jwtSecret =
    dependencies.jwtSecret ??
    process.env.JWT_SECRET ??
    (process.env.NODE_ENV === "test"
      ? "campcalm-exclusivo-para-testes-automatizados-2026"
      : undefined);

  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error(
      "JWT_SECRET deve conter um segredo de pelo menos 32 caracteres.",
    );
  }

  await app.register(fastifyJwt, {
    secret: jwtSecret,

    sign: {
      algorithm: "HS256",
      expiresIn: "15m",
      iss: "campcalm",
      aud: "campcalm-api",
    },

    verify: {
      algorithms: ["HS256"],
      allowedIss: "campcalm",
      allowedAud: "campcalm-api",
    },
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

  const userRepository =
    dependencies.userRepository ?? new PostgresUserRepository(pool);

  const authenticator =
    dependencies.authenticator ??
    new AuthenticateUserUseCase(userRepository, new Argon2PasswordHasher());

  const sessions =
    dependencies.sessions ??
    new AuthSessionService(new PostgresAuthSessionRepository(pool));

  registerCampingRoutes(app, sessions, pool);
  registerSpaceRoutes(app, sessions, pool);
  registerPublicReservationRoutes(app, sessions, pool);
  registerManageReservationRoutes(app, sessions, pool);
  registerAuthRoutes(
    app,
    accountRegistrar,
    authenticator,
    userRepository,
    sessions,
  );

  return app;
}

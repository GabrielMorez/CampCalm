import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { RegisterAccountUseCase } from "../../application/use-cases/register-account.js";

import {
  AccountEmailAlreadyExistsError,
  DomainValidationError,
} from "../../domain/errors/domain-errors.js";

import type { AuthenticateUserUseCase } from "../../application/use-cases/authenticate-user.js";
import type { UserRepository } from "../../domain/repositories/user-repository.js";
import { InvalidCredentialsError } from "../../domain/errors/domain-errors.js";

import type { AuthSessionService } from "../../application/services/auth-session-service.js";
import { InvalidRefreshTokenError } from "../../domain/errors/domain-errors.js";
import { requireAuth } from "../middleware/require-auth.js";

export type AccountAuthenticator = Pick<AuthenticateUserUseCase, "execute">;
export type AuthUserReader = Pick<UserRepository, "findById">;
export type AccountRegistrar = Pick<RegisterAccountUseCase, "execute">;
export type SessionManager = Pick<
  AuthSessionService,
  "create" | "rotate" | "revoke" | "isActive"
>;

const registerSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
    phone: z.string().trim().min(8).max(30),
    password: z.string().min(12).max(128),
  })
  .strict();

const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().pipe(z.email()),

    password: z.string().min(1).max(128),
  })
  .strict();

const refreshSchema = z
  .object({
    refreshToken: z.string().min(1).max(200),
  })
  .strict();

export function registerAuthRoutes(
  app: FastifyInstance,
  accountRegistrar: AccountRegistrar,
  authenticator: AccountAuthenticator,
  users: AuthUserReader,
  sessions: SessionManager,
): void {
  app.post("/auth/refresh", { bodyLimit: 2048 }, async (request, reply) => {
    reply.header("Cache-Control", "no-store");

    const parsed = refreshSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        code: "VALIDATION_ERROR",
        message: "Refresh token inválido.",
      });
    }

    try {
      const session = await sessions.rotate(parsed.data.refreshToken);

      const accessToken = await reply.jwtSign({
        sub: session.userId,
        sid: session.sessionId,
      });

      return reply.code(200).send({
        tokenType: "Bearer",
        accessToken,
        refreshToken: session.refreshToken,
        expiresIn: 900,
        sessionExpiresAt: session.expiresAt.toISOString(),
      });
    } catch (error) {
      if (error instanceof InvalidRefreshTokenError) {
        return reply.code(401).send({
          code: error.code,
          message: error.message,
        });
      }

      app.log.error({ err: error }, "Falha ao renovar sessão");

      return reply.code(500).send({
        code: "INTERNAL_ERROR",
        message: "Não foi possível renovar a sessão.",
      });
    }
  });

  app.post("/auth/register", { bodyLimit: 4096 }, async (request, reply) => {
    reply.header("Cache-Control", "no-store");

    const parsed = registerSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        code: "VALIDATION_ERROR",
        message: "Dados de cadastro inválidos.",
        fields: parsed.error.issues.map((issue) => ({
          field: issue.path.join("."),
          message: issue.message,
        })),
      });
    }

    try {
      const result = await accountRegistrar.execute(parsed.data);

      return reply.code(201).send({
        userId: result.userId,
        camperId: result.camperId,
        email: result.email,
      });
    } catch (error) {
      if (error instanceof AccountEmailAlreadyExistsError) {
        return reply.code(409).send({
          code: error.code,
          message: error.message,
        });
      }

      if (error instanceof DomainValidationError) {
        return reply.code(400).send({
          code: error.code,
          message: error.message,
        });
      }

      app.log.error({ err: error }, "Falha ao cadastrar conta");

      return reply.code(500).send({
        code: "INTERNAL_ERROR",
        message: "Não foi possível realizar o cadastro.",
      });
    }
  });

  app.post("/auth/login", { bodyLimit: 2048 }, async (request, reply) => {
    reply.header("Cache-Control", "no-store");

    const parsed = loginSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        code: "VALIDATION_ERROR",
        message: "Dados de login inválidos.",
      });
    }

    try {
      const authenticated = await authenticator.execute(parsed.data);

      // Cria sessão persistida no PostgreSQL.
      const session = await sessions.create(authenticated.userId);

      // JWT vinculado à sessão.
      const accessToken = await reply.jwtSign({
        sub: authenticated.userId,
        sid: session.sessionId,
      });

      return reply.code(200).send({
        tokenType: "Bearer",
        accessToken,
        refreshToken: session.refreshToken,
        expiresIn: 900,
        sessionExpiresAt: session.expiresAt.toISOString(),
        user: {
          id: authenticated.userId,
          email: authenticated.email,
        },
      });
    } catch (error) {
      if (error instanceof InvalidCredentialsError) {
        return reply.code(401).send({
          code: error.code,
          message: error.message,
        });
      }

      app.log.error({ err: error }, "Falha ao realizar login");

      return reply.code(500).send({
        code: "INTERNAL_ERROR",
        message: "Não foi possível autenticar.",
      });
    }
  });

  app.post("/auth/logout", { bodyLimit: 2048 }, async (request, reply) => {
    reply.header("Cache-Control", "no-store");

    const parsed = refreshSchema.safeParse(request.body);

    if (!parsed.success) {
      return reply.code(400).send({
        code: "VALIDATION_ERROR",
        message: "Refresh token inválido.",
      });
    }

    try {
      await sessions.revoke(parsed.data.refreshToken);

      // Resposta idempotente: não revela se
      // a sessão já havia sido encerrada.
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof InvalidRefreshTokenError) {
        return reply.code(401).send({
          code: error.code,
          message: error.message,
        });
      }

      app.log.error({ err: error }, "Falha ao encerrar sessão");

      return reply.code(500).send({
        code: "INTERNAL_ERROR",
        message: "Não foi possível encerrar a sessão.",
      });
    }
  });

  app.get(
    "/auth/me",
    {
      onRequest: requireAuth(sessions),
    },
    async (request, reply) => {
      reply.header("Cache-Control", "no-store");

      const user = await users.findById(request.user.sub);

      if (!user || !user.active) {
        return reply.code(401).send({
          code: "UNAUTHORIZED",
          message: "Autenticação necessária.",
        });
      }

      return {
        id: user.id,
        email: user.email,
      };
    },
  );
}

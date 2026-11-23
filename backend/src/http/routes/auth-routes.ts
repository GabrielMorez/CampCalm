
import type { FastifyInstance } from "fastify";
import { z } from "zod";

import type { RegisterAccountUseCase } from
  "../../application/use-cases/register-account.js";

import {
  AccountEmailAlreadyExistsError,
  DomainValidationError,
} from "../../domain/errors/domain-errors.js";

export type AccountRegistrar =
  Pick<RegisterAccountUseCase, "execute">;

const registerSchema = z.object({
  name: z.string().trim().min(2).max(120),

  email: z.string()
    .trim()
    .toLowerCase()
    .max(254)
    .pipe(z.email()),

  phone: z.string().trim().min(8).max(30),

  password: z.string().min(12).max(128),
}).strict();

export function registerAuthRoutes(
  app: FastifyInstance,
  accountRegistrar: AccountRegistrar,
): void {
  app.post(
    "/auth/register",
    { bodyLimit: 4096 },
    async (request, reply) => {
      reply.header("Cache-Control", "no-store");

      const parsed = registerSchema.safeParse(
        request.body,
      );

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
        const result = await accountRegistrar.execute(
          parsed.data,
        );

        return reply.code(201).send({
          userId: result.userId,
          camperId: result.camperId,
          email: result.email,
        });
      } catch (error) {
        if (
          error instanceof
          AccountEmailAlreadyExistsError
        ) {
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

        app.log.error(
          { err: error },
          "Falha ao cadastrar conta",
        );

        return reply.code(500).send({
          code: "INTERNAL_ERROR",
          message: "Não foi possível realizar o cadastro.",
        });
      }
    },
  );
}

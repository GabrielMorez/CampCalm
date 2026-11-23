import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";

import { Camping } from "../../domain/entities/camping.js";
import { PostgresOwnedCampingRepository } from "../../infrastructure/repositories/postgres-owned-camping-repository.js";

import type { SessionManager } from "./auth-routes.js";
import { requireAuth } from "../middleware/require-auth.js";

const campingSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    latitude: z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
  })
  .strict();

export function registerCampingRoutes(
  app: FastifyInstance,
  sessions: SessionManager,
  pool: Pool,
): void {
  const repository = new PostgresOwnedCampingRepository(pool);

  const authenticate = requireAuth(sessions);

  app.post(
    "/campings",
    {
      onRequest: authenticate,
      bodyLimit: 2048,
    },
    async (request, reply) => {
      const parsed = campingSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          code: "VALIDATION_ERROR",
          message: "Dados do camping inválidos.",
        });
      }

      const camping = new Camping({
        id: randomUUID(),
        ...parsed.data,
      });

      try {
        const created = await repository.createOwned(camping, request.user.sub);

        if (!created) {
          return reply.code(401).send({
            code: "UNAUTHORIZED",
            message: "Conta indisponível.",
          });
        }

        return reply.code(201).send({
          id: camping.id,
          name: camping.name,
          publicationStatus: "PENDING_REVIEW",
          role: "OWNER",
        });
      } catch (error) {
        app.log.error({ err: error }, "Falha ao cadastrar camping");

        return reply.code(500).send({
          code: "INTERNAL_ERROR",
          message: "Não foi possível cadastrar o camping.",
        });
      }
    },
  );

  app.get("/me/campings", { onRequest: authenticate }, async (request) => {
    return repository.findByUser(request.user.sub);
  });
}

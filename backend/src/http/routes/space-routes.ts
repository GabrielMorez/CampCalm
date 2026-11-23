import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";

import { Space } from "../../domain/entities/space.js";
import { Money } from "../../domain/value-objects/money.js";
import { AccessDeniedError } from "../../application/errors/authorization-errors.js";
import { CampingAuthorizationService } from "../../application/services/camping-authorization-service.js";
import { PostgresCampingAccessReader } from "../../infrastructure/repositories/postgres-camping-access-reader.js";
import { PostgresSpaceRepository } from "../../infrastructure/repositories/postgres-space-repository.js";

import { requireAuth } from "../middleware/require-auth.js";
import type { SessionManager } from "./auth-routes.js";

const paramsSchema = z.object({
  campingId: z.uuid(),
});

const createSpaceSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    accommodationTypes: z
      .array(z.enum(["TENT", "MOTORHOME", "TRAILER"]))
      .min(1)
      .max(3)
      .refine(
        (items) => new Set(items).size === items.length,
        "Os tipos de acomodação não podem se repetir.",
      ),
    dimensions: z.string().trim().max(120).optional(),
    dailyRateCents: z.number().int().min(0).max(2147483647),
  })
  .strict();

export function registerSpaceRoutes(
  app: FastifyInstance,
  sessions: SessionManager,
  pool: Pool,
): void {
  const repository = new PostgresSpaceRepository(pool);

  const authorization = new CampingAuthorizationService(
    new PostgresCampingAccessReader(pool),
  );

  const authenticate = requireAuth(sessions);

  async function canManage(
    userId: string,
    campingId: string,
  ): Promise<boolean> {
    try {
      await authorization.requireManageCamping(userId, campingId);
      return true;
    } catch (error) {
      if (error instanceof AccessDeniedError) {
        return false;
      }
      throw error;
    }
  }

  // Cadastrar espaço
  app.post(
    "/campings/:campingId/spaces",
    { onRequest: authenticate },
    async (request, reply) => {
      const params = paramsSchema.safeParse(request.params);
      const body = createSpaceSchema.safeParse(request.body);

      if (!params.success || !body.success) {
        return reply.code(400).send({
          code: "VALIDATION_ERROR",
          message: "Dados do espaço inválidos.",
        });
      }

      const { campingId } = params.data;

      if (!(await canManage(request.user.sub, campingId))) {
        return reply.code(403).send({
          code: "FORBIDDEN",
          message: "Acesso não autorizado.",
        });
      }

      const space = new Space({
        id: randomUUID(),
        campingId,
        name: body.data.name,
        accommodationTypes: body.data.accommodationTypes,
        dimensions: body.data.dimensions ?? '',
        dailyRate: new Money(body.data.dailyRateCents),
      });

      await repository.save(space);

      return reply.code(201).send({
        id: space.id,
        campingId: space.campingId,
        name: space.name,
        accommodationTypes: space.accommodationTypes,
        dimensions: space.dimensions,
        dailyRateCents: space.dailyRate.cents,
        active: space.active,
      });
    },
  );

  // Listar espaços para administração
  app.get(
    "/campings/:campingId/spaces",
    { onRequest: authenticate },
    async (request, reply) => {
      const params = paramsSchema.safeParse(request.params);

      if (!params.success) {
        return reply.code(400).send({
          code: "VALIDATION_ERROR",
        });
      }

      const { campingId } = params.data;

      if (!(await canManage(request.user.sub, campingId))) {
        return reply.code(403).send({
          code: "FORBIDDEN",
        });
      }

      const result = await pool.query(
        `
        SELECT
          s.id,
          s.camping_id AS "campingId",
          s.name,
          s.dimensions,
          s.daily_rate_cents AS "dailyRateCents",
          s.active,
          ARRAY(
            SELECT sat.accommodation_type
            FROM space_accommodation_types sat
            WHERE sat.space_id = s.id
            ORDER BY sat.accommodation_type
          ) AS "accommodationTypes"
        FROM spaces s
        WHERE s.camping_id = $1
        ORDER BY s.name
        `,
        [campingId],
      );

      return result.rows;
    },
  );
}

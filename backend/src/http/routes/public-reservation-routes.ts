import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";

import { Period } from "../../domain/value-objects/period.js";
import {
  CampingInactiveError,
  CampingNotPublishedError,
  DomainValidationError,
  ReservationConflictError,
  SpaceUnavailableError,
} from "../../domain/errors/domain-errors.js";

import { CreateReservationUseCase } from "../../application/use-cases/create-reservation.js";

import { PostgresCampingRepository } from "../../infrastructure/repositories/postgres-camping-repository.js";
import { PostgresSpaceRepository } from "../../infrastructure/repositories/postgres-space-repository.js";
import { PostgresReservationRepository } from "../../infrastructure/repositories/postgres-reservation-repository.js";

import { requireAuth } from "../middleware/require-auth.js";
import type { SessionManager } from "./auth-routes.js";

const searchSchema = z.object({
  latitude: z.coerce.number().finite().min(-90).max(90),
  longitude: z.coerce.number().finite().min(-180).max(180),
  radiusKm: z.coerce.number().positive().max(200).default(100),
});

const periodSchema = z
  .object({
    startDate: z.iso.date(),
    endDate: z.iso.date(),
  })
  .refine((period) => period.endDate > period.startDate, {
    message: "O check-out deve ser posterior ao check-in.",
  });

const campingParamsSchema = z.object({
  campingId: z.uuid(),
});

const reservationSchema = z
  .object({
    campingId: z.uuid(),
    spaceId: z.uuid(),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
  })
  .strict()
  .refine((data) => data.endDate > data.startDate, {
    message: "O check-out deve ser posterior ao check-in.",
  });

function toPeriod(startDate: string, endDate: string): Period {
  return new Period(
    new Date(`${startDate}T00:00:00Z`),
    new Date(`${endDate}T00:00:00Z`),
  );
}

function isOverlapError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23P01"
  );
}

export function registerPublicReservationRoutes(
  app: FastifyInstance,
  sessions: SessionManager,
  pool: Pool,
): void {
  const campings = new PostgresCampingRepository(pool);
  const spaces = new PostgresSpaceRepository(pool);
  const reservations = new PostgresReservationRepository(pool);

  const createReservation = new CreateReservationUseCase(
    campings,
    spaces,
    reservations,
  );

  // Buscar campings publicados por localização.
  app.get("/campings", async (request, reply) => {
    const parsed = searchSchema.safeParse(request.query);

    if (!parsed.success) {
      return reply.code(400).send({
        code: "VALIDATION_ERROR",
        message: "Localização ou raio inválido.",
      });
    }

    const { latitude, longitude, radiusKm } = parsed.data;

    const results = await campings.findNearby(latitude, longitude, radiusKm);

    return results
      .filter((camping) => camping.isPublished)
      .map((camping) => ({
        id: camping.id,
        name: camping.name,
        latitude: camping.latitude,
        longitude: camping.longitude,
        addressText: camping.addressText,
      }));
  });

  // Consultar espaços disponíveis por período.

  app.get("/campings/:campingId/available-spaces", async (request, reply) => {
    const params = campingParamsSchema.safeParse(request.params);

    const query = periodSchema.safeParse(request.query);

    if (!params.success || !query.success) {
      return reply.code(400).send({
        code: "VALIDATION_ERROR",
        message: "Camping ou período inválido.",
      });
    }

    // O TypeScript reconhece os dois campos como string.
    const { startDate, endDate } = query.data;

    const period = toPeriod(startDate, endDate);

    const available = await spaces.findAvailable(params.data.campingId, period);

    return available.map((space) => ({
      id: space.id,
      campingId: space.campingId,
      name: space.name,
      accommodationTypes: space.accommodationTypes,
      dimensions: space.dimensions,
      dailyRateCents: space.dailyRate.cents,
      totalCents: space.dailyRate.cents * period.nights,
      nights: period.nights,
    }));
  });

  // Solicitar reserva como campista autenticado.
  app.post(
    "/reservations",
    {
      onRequest: requireAuth(sessions),
      bodyLimit: 2048,
    },
    async (request, reply) => {
      const parsed = reservationSchema.safeParse(request.body);

      if (!parsed.success) {
        return reply.code(400).send({
          code: "VALIDATION_ERROR",
          message: "Dados da reserva inválidos.",
        });
      }

      // O campista é identificado pela conta autenticada.
      // Não aceitamos camperId enviado pelo cliente.
      const camperResult = await pool.query<{
        id: string;
      }>(
        `
        SELECT id
        FROM campers
        WHERE user_id = $1
        `,
        [request.user.sub],
      );

      const camperId = camperResult.rows[0]?.id;

      if (!camperId) {
        return reply.code(403).send({
          code: "CAMPER_PROFILE_REQUIRED",
          message: "Perfil de campista não encontrado.",
        });
      }

      try {
        const reservation = await createReservation.execute({
          id: randomUUID(),
          camperId,
          campingId: parsed.data.campingId,
          spaceId: parsed.data.spaceId,
          period: toPeriod(parsed.data.startDate, parsed.data.endDate),
        });

        return reply.code(201).send({
          id: reservation.id,
          campingId: reservation.campingId,
          spaceId: reservation.spaceId,
          status: reservation.status,
          startDate: parsed.data.startDate,
          endDate: parsed.data.endDate,
          totalCents: reservation.total.cents,
        });
      } catch (error) {
        if (error instanceof DomainValidationError) {
          return reply.code(400).send({
            code: error.code,
            message: error.message,
          });
        }

        if (
          error instanceof ReservationConflictError ||
          error instanceof SpaceUnavailableError ||
          error instanceof CampingInactiveError ||
          error instanceof CampingNotPublishedError ||
          isOverlapError(error)
        ) {
          return reply.code(409).send({
            code: "RESERVATION_UNAVAILABLE",
            message: "Não foi possível reservar esta vaga.",
          });
        }

        app.log.error({ err: error }, "Falha ao criar reserva");

        return reply.code(500).send({
          code: "INTERNAL_ERROR",
          message: "Não foi possível solicitar a reserva.",
        });
      }
    },
  );
}

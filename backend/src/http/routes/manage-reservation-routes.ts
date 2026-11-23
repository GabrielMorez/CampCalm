
import type { FastifyInstance } from "fastify";
import type { Pool, QueryResultRow } from "pg";
import { z } from "zod";

import type { ReservationStatus } from "../../domain/entities/reservation.js";

import { AccessDeniedError } from "../../application/errors/authorization-errors.js";
import { CampingAuthorizationService } from "../../application/services/camping-authorization-service.js";
import { PostgresCampingAccessReader } from "../../infrastructure/repositories/postgres-camping-access-reader.js";

import { requireAuth } from "../middleware/require-auth.js";
import type { SessionManager } from "./auth-routes.js";

const campingParamsSchema = z.object({
  campingId: z.uuid(),
});

const reservationParamsSchema = z.object({
  reservationId: z.uuid(),
});

interface ReservationListRow extends QueryResultRow {
  id: string;
  campingId: string;
  spaceId: string;
  spaceName: string;
  camperId: string;
  camperName: string;
  startDate: string;
  endDate: string;
  nights: number;
  dailyRateCents: number;
  status: ReservationStatus;
}

interface DecisionRow extends QueryResultRow {
  id: string;
  campingId: string;
  spaceId: string;
  status: ReservationStatus;
}

interface StatusRow extends QueryResultRow {
  status: ReservationStatus;
}

type Decision = "approve" | "refuse";

export function registerManageReservationRoutes(
  app: FastifyInstance,
  sessions: SessionManager,
  pool: Pool,
): void {
  const authenticate = requireAuth(sessions);

  const authorization = new CampingAuthorizationService(
    new PostgresCampingAccessReader(pool),
  );

  // ==========================================
  // 1. Listar reservas do camping
  // ==========================================

  app.get(
    "/campings/:campingId/reservations",
    { onRequest: authenticate },
    async (request, reply) => {
      reply.header("Cache-Control", "no-store");

      const params = campingParamsSchema.safeParse(
        request.params,
      );

      if (!params.success) {
        return reply.code(400).send({
          code: "VALIDATION_ERROR",
          message: "Identificador do camping inválido.",
        });
      }

      const { campingId } = params.data;

      try {
        await authorization.requireManageCamping(
          request.user.sub,
          campingId,
        );
      } catch (error) {
        if (error instanceof AccessDeniedError) {
          return reply.code(403).send({
            code: "FORBIDDEN",
            message: "Acesso não autorizado.",
          });
        }

        throw error;
      }

      const result = await pool.query<ReservationListRow>(
        `
        SELECT
          r.id,
          r.camping_id AS "campingId",
          r.space_id AS "spaceId",
          s.name AS "spaceName",
          r.camper_id AS "camperId",
          c.name AS "camperName",
          r.start_date::text AS "startDate",
          r.end_date::text AS "endDate",
          (r.end_date - r.start_date) AS nights,
          r.daily_rate_cents AS "dailyRateCents",
          r.status
        FROM reservations r
        INNER JOIN spaces s
          ON s.id = r.space_id
        INNER JOIN campers c
          ON c.id = r.camper_id
        WHERE r.camping_id = $1
        ORDER BY
          CASE WHEN r.status = 'PENDING'
            THEN 0 ELSE 1 END,
          r.created_at DESC
        LIMIT 100
        `,
        [campingId],
      );

      return result.rows.map((reservation) => ({
        ...reservation,
        totalCents:
          reservation.dailyRateCents *
          reservation.nights,
      }));
    },
  );

  // ==========================================
  // 2. Aprovar ou recusar reserva
  // ==========================================

  function registerDecisionRoute(
    decision: Decision,
    nextStatus: "CONFIRMED" | "REFUSED",
  ): void {
    app.post(
      `/reservations/:reservationId/${decision}`,
      { onRequest: authenticate },
      async (request, reply) => {
        reply.header("Cache-Control", "no-store");

        const params = reservationParamsSchema.safeParse(
          request.params,
        );

        if (!params.success) {
          return reply.code(400).send({
            code: "VALIDATION_ERROR",
            message: "Identificador da reserva inválido.",
          });
        }

        const { reservationId } = params.data;
        const userId = request.user.sub;

        // A autorização e a mudança de estado
        // acontecem na mesma operação SQL.
        const result = await pool.query<DecisionRow>(
          `
          UPDATE reservations AS r
          SET status = $2
          WHERE r.id = $1
            AND r.status = 'PENDING'
            AND EXISTS (
              SELECT 1
              FROM camping_users cu
              INNER JOIN users u
                ON u.id = cu.user_id
              WHERE cu.camping_id = r.camping_id
                AND cu.user_id = $3
                AND cu.role IN ('OWNER', 'MANAGER')
                AND u.active = TRUE
            )
          RETURNING
            r.id,
            r.camping_id AS "campingId",
            r.space_id AS "spaceId",
            r.status
          `,
          [
            reservationId,
            nextStatus,
            userId,
          ],
        );

        const updated = result.rows[0];

        if (updated) {
          return reply.code(200).send(updated);
        }

        // Nenhuma atualização ocorreu.
        // Verifica se a reserva existe e pertence
        // a um camping administrado pelo usuário.
        const existing = await pool.query<StatusRow>(
          `
          SELECT r.status
          FROM reservations r
          WHERE r.id = $1
            AND EXISTS (
              SELECT 1
              FROM camping_users cu
              INNER JOIN users u
                ON u.id = cu.user_id
              WHERE cu.camping_id = r.camping_id
                AND cu.user_id = $2
                AND cu.role IN ('OWNER', 'MANAGER')
                AND u.active = TRUE
            )
          `,
          [reservationId, userId],
        );

        if (existing.rows[0]) {
          return reply.code(409).send({
            code: "RESERVATION_INVALID_STATE",
            message:
              "A reserva não está mais pendente.",
          });
        }

        // Não diferencia reserva inexistente
        // de reserva sem autorização.
        return reply.code(404).send({
          code: "RESERVATION_NOT_FOUND",
          message: "Reserva não encontrada.",
        });
      },
    );
  }

  registerDecisionRoute("approve", "CONFIRMED");
  registerDecisionRoute("refuse", "REFUSED");
}

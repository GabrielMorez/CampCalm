import type { FastifyInstance } from "fastify";
import type { Pool, QueryResultRow } from "pg";
import { z } from "zod";

import { requireAuth } from "../middleware/require-auth.js";
import type { SessionManager } from "./auth-routes.js";

const geocodeQuerySchema = z.object({
  q: z.string().trim().min(4).max(180),
}).strict();

const addressSchema = z.object({
  addressText: z.string().trim().min(5).max(350),
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
}).strict();

const campingParamsSchema = z.object({
  campingId: z.uuid(),
});

// Geoapify: format=json -> results[].formatted, results[].lat e results[].lon.
const geoapifyResponseSchema = z.object({
  results: z.array(z.object({
    formatted: z.string(),
    lat: z.number(),
    lon: z.number(),
    result_type: z.string().optional(),
  })),
});

interface UpdatedCampingRow extends QueryResultRow {
  id: string;
  addressText: string;
  publicationStatus: "PENDING_REVIEW";
}

export function registerAddressRoutes(
  app: FastifyInstance,
  sessions: SessionManager,
  pool: Pool,
): void {
  // Busca explícita (clique em "Localizar"); sem autocomplete no navegador.
  // A chave do provedor fica exclusivamente no backend.
  app.get("/geocoding/search", async (request, reply) => {
    reply.header("Cache-Control", "no-store");
    const parsed = geocodeQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.code(400).send({ code: "VALIDATION_ERROR", message: "Informe um endereço válido." });
    }

    const apiKey = process.env.GEOAPIFY_API_KEY;
    if (!apiKey) {
      return reply.code(503).send({
        code: "GEOCODING_NOT_CONFIGURED",
        message: "Configure GEOAPIFY_API_KEY no .env do backend.",
      });
    }

    const url = new URL("https://api.geoapify.com/v1/geocode/search");
    url.searchParams.set("text", parsed.data.q);
    url.searchParams.set("filter", "countrycode:br");
    url.searchParams.set("lang", "pt");
    url.searchParams.set("format", "json");
    url.searchParams.set("limit", "5");
    url.searchParams.set("apiKey", apiKey);

    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: { Accept: "application/json" },
      });
      if (!response.ok) {
        // Não registrar URL inteira, pois ela contém a chave de API.
        app.log.warn({ status: response.status }, "Provedor de endereços indisponível");
        return reply.code(502).send({
          code: "GEOCODING_UNAVAILABLE",
          message: "A busca de endereços está indisponível. Tente novamente.",
        });
      }

      const data: unknown = await response.json();
      const validated = geoapifyResponseSchema.safeParse(data);
      if (!validated.success) {
        return reply.code(502).send({
          code: "GEOCODING_INVALID_RESPONSE",
          message: "O serviço de endereços retornou dados inesperados.",
        });
      }

      return {
        results: validated.data.results
          .filter((item) => Number.isFinite(item.lat) && Number.isFinite(item.lon))
          .map((item) => ({
            label: item.formatted,
            latitude: item.lat,
            longitude: item.lon,
            resultType: item.result_type ?? null,
          })),
      };
    } catch (error) {
      app.log.warn({ kind: error instanceof Error ? error.name : "UnknownError" }, "Falha na busca de endereços");
      return reply.code(502).send({
        code: "GEOCODING_UNAVAILABLE",
        message: "Não foi possível localizar o endereço agora.",
      });
    }
  });

  // Atualizar endereço de um camping já cadastrado (OWNER ou MANAGER).
  // Mudança de localização exige nova análise antes de voltar à busca pública.
  app.put(
    "/campings/:campingId/address",
    { onRequest: requireAuth(sessions), bodyLimit: 2048 },
    async (request, reply) => {
      const params = campingParamsSchema.safeParse(request.params);
      const body = addressSchema.safeParse(request.body);
      if (!params.success || !body.success) {
        return reply.code(400).send({
          code: "VALIDATION_ERROR",
          message: "Endereço ou camping inválido.",
        });
      }

      const result = await pool.query<UpdatedCampingRow>(
        `
        UPDATE campings AS c
        SET
          address_text = $2,
          latitude = $3,
          longitude = $4,
          publication_status = 'PENDING_REVIEW',
          submitted_at = NOW(),
          reviewed_at = NULL,
          reviewed_by = NULL,
          review_note = NULL
        WHERE c.id = $1
          AND EXISTS (
            SELECT 1
            FROM camping_users cu
            JOIN users u ON u.id = cu.user_id
            WHERE cu.camping_id = c.id
              AND cu.user_id = $5
              AND cu.role IN ('OWNER', 'MANAGER')
              AND u.active = TRUE
          )
        RETURNING
          c.id,
          c.address_text AS "addressText",
          c.publication_status AS "publicationStatus"
        `,
        [params.data.campingId, body.data.addressText, body.data.latitude,
         body.data.longitude, request.user.sub],
      );

      const updated = result.rows[0];
      if (!updated) {
        return reply.code(404).send({ code: "CAMPING_NOT_FOUND", message: "Camping não encontrado." });
      }
      return updated;
    },
  );
}

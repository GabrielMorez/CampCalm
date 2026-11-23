import type { FastifyReply, FastifyRequest } from "fastify";

import type { AuthSessionService } from "../../application/services/auth-session-service.js";

type SessionChecker = Pick<AuthSessionService, "isActive">;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function unauthorized(reply: FastifyReply) {
  return reply.code(401).send({
    code: "UNAUTHORIZED",
    message: "Autenticação necessária.",
  });
}

export function requireAuth(sessions: SessionChecker) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch {
      return unauthorized(reply);
    }

    const { sub, sid } = request.user;

    if (
      typeof sub !== "string" ||
      typeof sid !== "string" ||
      !UUID_PATTERN.test(sub) ||
      !UUID_PATTERN.test(sid)
    ) {
      return unauthorized(reply);
    }

    const active = await sessions.isActive(sid, sub);

    if (!active) {
      return unauthorized(reply);
    }
  };
}

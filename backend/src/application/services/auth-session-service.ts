
import {
  createHash,
  randomBytes,
  randomUUID,
} from "node:crypto";

import type { AuthSessionRepository } from
  "../ports/auth-session-repository.js";

import { InvalidRefreshTokenError } from
  "../../domain/errors/domain-errors.js";

const SESSION_DURATION_MS =
  30 * 24 * 60 * 60 * 1000;

// UUID + ponto + segredo base64url de 32 bytes.
const REFRESH_TOKEN_PATTERN =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.[A-Za-z0-9_-]{43}$/;

export interface AuthSessionResult {
  sessionId: string;
  userId: string;
  refreshToken: string;
  expiresAt: Date;
}

function generateToken(sessionId: string): string {
  const secret = randomBytes(32).toString("base64url");

  return `${sessionId}.${secret}`;
}

function hashToken(token: string): string {
  return createHash("sha256")
    .update(token, "utf8")
    .digest("hex");
}

function parseToken(token: string): string {
  const match = REFRESH_TOKEN_PATTERN.exec(token);

  if (!match?.[1]) {
    throw new InvalidRefreshTokenError();
  }

  return match[1];
}

export class AuthSessionService {
  constructor(
    private readonly sessions: AuthSessionRepository,
  ) {}

  async create(
    userId: string,
  ): Promise<AuthSessionResult> {
    const sessionId = randomUUID();

    const refreshToken = generateToken(sessionId);

    const expiresAt = new Date(
      Date.now() + SESSION_DURATION_MS,
    );

    await this.sessions.create({
      id: sessionId,
      userId,
      refreshTokenHash: hashToken(refreshToken),
      expiresAt,
    });

    return {
      sessionId,
      userId,
      refreshToken,
      expiresAt,
    };
  }

  async rotate(
    refreshToken: string,
  ): Promise<AuthSessionResult> {
    const sessionId = parseToken(refreshToken);

    const newRefreshToken = generateToken(sessionId);

    const result = await this.sessions.rotate({
      sessionId,
      currentTokenHash: hashToken(refreshToken),
      newTokenHash: hashToken(newRefreshToken),
    });

    if (!result) {
      throw new InvalidRefreshTokenError();
    }

    return {
      sessionId,
      userId: result.userId,
      refreshToken: newRefreshToken,
      expiresAt: result.expiresAt,
    };
  }

  async revoke(
    refreshToken: string,
  ): Promise<boolean> {
    const sessionId = parseToken(refreshToken);

    return this.sessions.revoke({
      sessionId,
      refreshTokenHash: hashToken(refreshToken),
    });
  }

  async isActive(
    sessionId: string,
    userId: string,
  ): Promise<boolean> {
    return this.sessions.isActive(sessionId, userId);
  }
}

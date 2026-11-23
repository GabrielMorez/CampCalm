export interface CreateAuthSessionInput {
  id: string;
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
}

export interface RotateAuthSessionInput {
  sessionId: string;
  currentTokenHash: string;
  newTokenHash: string;
}

export interface RotateAuthSessionResult {
  userId: string;
  expiresAt: Date;
}

export interface RevokeAuthSessionInput {
  sessionId: string;
  refreshTokenHash: string;
}

export interface AuthSessionRepository {
  create(input: CreateAuthSessionInput): Promise<void>;

  rotate(
    input: RotateAuthSessionInput,
  ): Promise<RotateAuthSessionResult | null>;

  revoke(input: RevokeAuthSessionInput): Promise<boolean>;

  isActive(sessionId: string, userId: string): Promise<boolean>;
}

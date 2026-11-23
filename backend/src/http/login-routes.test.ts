import { describe, expect, it } from "vitest";

import { buildApp } from "./app.js";

import { User } from "../domain/entities/user.js";
import { InvalidCredentialsError } from "../domain/errors/domain-errors.js";

import type { RegisterAccountInput } from "../application/use-cases/register-account.js";

import type { AuthenticateUserInput } from "../application/use-cases/authenticate-user.js";

import { InvalidRefreshTokenError } from "../domain/errors/domain-errors.js";

const userId = "2db98d28-611a-4754-bacd-376d167dd6d0";
const sessionId = "4cd91e22-21c4-4ba1-bb4a-5c96f26eb170";

const credentials = {
  email: "teste@example.com",
  password: "SenhaSegura123!",
};

function createDependencies(
  options: {
    active?: boolean;
    rejectLogin?: boolean;
  } = {},
) {
  const user = new User({
    id: userId,
    email: credentials.email,
    passwordHash: "hash-ficticio-para-testes",
    active: options.active ?? true,
  });

  let currentRefreshToken = "refresh-inicial";
  let sessionActive = true;

  const sessions = {
    create: async (requestedUserId: string) => ({
      sessionId,
      userId: requestedUserId,
      refreshToken: currentRefreshToken,
      expiresAt: new Date("2030-01-01T00:00:00Z"),
    }),

    rotate: async (token: string) => {
      if (!sessionActive || token !== currentRefreshToken) {
        throw new InvalidRefreshTokenError();
      }

      currentRefreshToken = "refresh-renovado";

      return {
        sessionId,
        userId: user.id,
        refreshToken: currentRefreshToken,
        expiresAt: new Date("2030-01-01T00:00:00Z"),
      };
    },

    revoke: async (token: string) => {
      if (!sessionActive || token !== currentRefreshToken) {
        return false;
      }

      sessionActive = false;
      return true;
    },

    isActive: async (sid: string, uid: string) => {
      return sessionActive && sid === sessionId && uid === user.id;
    },
  };

  return {
    // Esta rota não é utilizada nestes testes.
    accountRegistrar: {
      execute: async (_input: RegisterAccountInput) => ({
        userId,
        camperId: "camper-test",
        email: user.email,
      }),
    },
    authenticator: {
      execute: async (_input: AuthenticateUserInput) => {
        if (options.rejectLogin) {
          throw new InvalidCredentialsError();
        }

        return {
          userId: user.id,
          email: user.email,
        };
      },
    },
    userRepository: {
      findById: async (id: string) => (id === user.id ? user : null),

      findByEmail: async (_email: string) => user,
    },
    jwtSecret: "campcalm-jwt-secret-exclusivo-para-testes",
    sessions,
  };
}

describe("Autenticação HTTP", () => {
  it("realiza login e consulta o usuário autenticado", async () => {
    const app = await buildApp(createDependencies());

    try {
      const login = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: credentials,
      });

      expect(login.statusCode).toBe(200);

      const body = login.json();

      expect(body.tokenType).toBe("Bearer");
      expect(body.expiresIn).toBe(900);
      expect(body.accessToken).toEqual(expect.any(String));

      expect(body.user).toEqual({
        id: userId,
        email: credentials.email,
      });

      const me = await app.inject({
        method: "GET",
        url: "/auth/me",
        headers: {
          authorization: `Bearer ${body.accessToken}`,
        },
      });

      expect(me.statusCode).toBe(200);
      expect(me.json()).toEqual({
        id: userId,
        email: credentials.email,
      });
    } finally {
      await app.close();
    }
  });

  it("rejeita credenciais incorretas", async () => {
    const app = await buildApp(createDependencies({ rejectLogin: true }));

    try {
      const response = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: {
          ...credentials,
          password: "SenhaIncorreta123!",
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().code).toBe("INVALID_CREDENTIALS");
    } finally {
      await app.close();
    }
  });

  it("rejeita acesso sem token", async () => {
    const app = await buildApp(createDependencies());

    try {
      const response = await app.inject({
        method: "GET",
        url: "/auth/me",
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().code).toBe("UNAUTHORIZED");
    } finally {
      await app.close();
    }
  });

  it("rejeita um token JWT inválido", async () => {
    const app = await buildApp(createDependencies());

    try {
      const response = await app.inject({
        method: "GET",
        url: "/auth/me",
        headers: {
          authorization: "Bearer token-invalido",
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().code).toBe("UNAUTHORIZED");
    } finally {
      await app.close();
    }
  });

  it("rejeita acesso de usuário desativado", async () => {
    const app = await buildApp(createDependencies({ active: false }));

    try {
      await app.ready();

      // JWT válido e associado à sessão simulada.
      const token = app.jwt.sign({
        sub: userId,
        sid: sessionId,
      });

      const response = await app.inject({
        method: "GET",
        url: "/auth/me",
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(401);
      expect(response.json().code).toBe("UNAUTHORIZED");
    } finally {
      await app.close();
    }
  });

  it("renova o token e rejeita reutilização", async () => {
    const app = await buildApp(createDependencies());

    try {
      const login = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: credentials,
      });

      expect(login.statusCode).toBe(200);

      const original = login.json();

      const refresh = await app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: {
          refreshToken: original.refreshToken,
        },
      });

      expect(refresh.statusCode).toBe(200);

      const renewed = refresh.json();

      expect(renewed.refreshToken).not.toBe(original.refreshToken);

      const replay = await app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: {
          refreshToken: original.refreshToken,
        },
      });

      expect(replay.statusCode).toBe(401);
      expect(replay.json().code).toBe("INVALID_REFRESH_TOKEN");

      const me = await app.inject({
        method: "GET",
        url: "/auth/me",
        headers: {
          authorization: `Bearer ${renewed.accessToken}`,
        },
      });

      expect(me.statusCode).toBe(200);
    } finally {
      await app.close();
    }
  });

  it("invalida o access token após logout", async () => {
    const app = await buildApp(createDependencies());

    try {
      const login = await app.inject({
        method: "POST",
        url: "/auth/login",
        payload: credentials,
      });

      const tokens = login.json();

      const logout = await app.inject({
        method: "POST",
        url: "/auth/logout",
        payload: {
          refreshToken: tokens.refreshToken,
        },
      });

      expect(logout.statusCode).toBe(204);

      const me = await app.inject({
        method: "GET",
        url: "/auth/me",
        headers: {
          authorization: `Bearer ${tokens.accessToken}`,
        },
      });

      expect(me.statusCode).toBe(401);

      const refresh = await app.inject({
        method: "POST",
        url: "/auth/refresh",
        payload: {
          refreshToken: tokens.refreshToken,
        },
      });

      expect(refresh.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });

  it("rejeita JWT associado a outra sessão", async () => {
    const app = await buildApp(createDependencies());

    try {
      await app.ready();

      const token = app.jwt.sign({
        sub: userId,
        sid: "e26c2c4b-01ce-4f69-b7eb-6a369a7807e9",
      });

      const response = await app.inject({
        method: "GET",
        url: "/auth/me",
        headers: {
          authorization: `Bearer ${token}`,
        },
      });

      expect(response.statusCode).toBe(401);
    } finally {
      await app.close();
    }
  });
});

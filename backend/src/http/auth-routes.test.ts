
import { describe, expect, it, vi } from "vitest";

import type { RegisterAccountInput } from
  "../application/use-cases/register-account.js";

import { AccountEmailAlreadyExistsError } from
  "../domain/errors/domain-errors.js";

import { buildApp } from "./app.js";

const payload = {
  name: "Campista Teste",
  email: "teste@example.com",
  phone: "47999999999",
  password: "SenhaSegura123!",
};

describe("POST /auth/register", () => {
  it("retorna 201 ao cadastrar uma conta", async () => {
    const execute = vi.fn(
      async (input: RegisterAccountInput) => ({
        userId: "user-1",
        camperId: "camper-1",
        email: input.email,
      }),
    );

    const app = await buildApp({
      accountRegistrar: { execute },
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload,
      });

      expect(response.statusCode).toBe(201);

      expect(response.json()).toEqual({
        userId: "user-1",
        camperId: "camper-1",
        email: "teste@example.com",
      });

      expect(execute).toHaveBeenCalledOnce();
    } finally {
      await app.close();
    }
  });

  it("retorna 400 para cadastro inválido", async () => {
    const execute = vi.fn();

    const app = await buildApp({
      accountRegistrar: { execute },
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          ...payload,
          email: "email-invalido",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().code).toBe(
        "VALIDATION_ERROR",
      );

      expect(execute).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });

  it("retorna 409 para e-mail duplicado", async () => {
    const execute = vi.fn(
      async (_input: RegisterAccountInput) => {
        throw new AccountEmailAlreadyExistsError();
      },
    );

    const app = await buildApp({
      accountRegistrar: { execute },
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload,
      });

      expect(response.statusCode).toBe(409);

      expect(response.json().code).toBe(
        "ACCOUNT_EMAIL_ALREADY_EXISTS",
      );
    } finally {
      await app.close();
    }
  });

  it("rejeita campos de permissão no cadastro", async () => {
    const execute = vi.fn();

    const app = await buildApp({
      accountRegistrar: { execute },
    });

    try {
      const response = await app.inject({
        method: "POST",
        url: "/auth/register",
        payload: {
          ...payload,
          role: "MODERATOR",
        },
      });

      expect(response.statusCode).toBe(400);
      expect(execute).not.toHaveBeenCalled();
    } finally {
      await app.close();
    }
  });
});

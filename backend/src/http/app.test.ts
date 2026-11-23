import { describe, expect, it } from "vitest";

import { buildApp } from "../../src/http/app.js";

describe("CampCalm HTTP API", () => {
  it("deve responder ao endpoint de saúde", async () => {
    const app = await buildApp();

    try {
      const response = await app.inject({
        method: "GET",
        url: "/health",
      });

      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        service: "campcalm-backend",
        status: "ok",
      });
    } finally {
      await app.close();
    }
  });
});

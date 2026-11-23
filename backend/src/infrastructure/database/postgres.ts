import { Pool } from "pg";
import { config } from "dotenv";
import { resolve } from "node:path";

config({
  path: resolve(process.cwd(), "../.env"),
  quiet: true,
});

const connectionString = process.env.DATABASE_URL;

export const pool = new Pool(
  connectionString
    ? {
        connectionString,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }
    : {
        host: process.env.DATABASE_HOST ?? "localhost",
        port: Number(process.env.DATABASE_PORT ?? 5432),
        database: process.env.DATABASE_NAME ?? "campcalm",
        user: process.env.DATABASE_USER ?? "campcalm",
        password: process.env.DATABASE_PASSWORD,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      },
);

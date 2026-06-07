import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { username } from "better-auth/plugins";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";
import type { Env } from "../db/client";

export function createAuth(env: Env["Bindings"]) {
  const db = drizzle(env.family_kanban);

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: schema.users,
        session: schema.sessions,
        account: schema.accounts,
        verification: schema.verifications,
      },
    }),
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 6,
    },
    plugins: [username()],
    user: {
      additionalFields: {
        points: {
          type: "number",
          defaultValue: 0,
          input: false,
        },
        type: {
          type: "string",
          defaultValue: "child",
          input: true,
        },
      },
    },
    advanced: {
      database: {
        generateId: false,
      },
    },
    trustedOrigins: [
      "http://localhost:3000",
      "http://localhost:8787",
      "https://kanban.clpowe.workers.dev",
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;

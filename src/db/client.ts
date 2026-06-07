import { drizzle } from "drizzle-orm/d1";
import type { User } from "../types";

export type Env = {
  Bindings: {
    family_kanban: D1Database;
    ASSETS: Fetcher;
    BETTER_AUTH_SECRET: string;
    BETTER_AUTH_URL: string;
  };
  Variables: {
    authUser: User;
    loginUser: User;
    activeUser: User;
  };
};

export function getDB(env: Env["Bindings"]) {
  return drizzle(env.family_kanban);
}

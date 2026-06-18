import { getCookie, setCookie } from "hono/cookie";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import type { Env } from "../db/client";
import { getDB } from "../db/client";
import type { User } from "../types";
import { canManageTask, canUpdateTaskStatus } from "./authorization";
import { createAuth } from "./auth";
import {
  getAllUsers,
  getTaskAssigneeId,
  getUserById,
} from "../services/user.service";
import { createPostHogClient } from "../lib/posthog";

export const FAMILY_SESSION_COOKIE = "family_session";

export type FamilySession = {
  loginUserId: number;
  activeUserId: number;
  familyUserIds: number[];
};

export function serializeFamilySession(session: FamilySession): string {
  return JSON.stringify(session);
}

export function parseFamilySession(
  value: string | undefined | null,
): FamilySession | null {
  if (!value) {
    return null;
  }

  try {
    const parsed = JSON.parse(value) as Partial<FamilySession>;

    if (
      typeof parsed.loginUserId !== "number" ||
      typeof parsed.activeUserId !== "number" ||
      !Array.isArray(parsed.familyUserIds) ||
      parsed.familyUserIds.some((id) => typeof id !== "number")
    ) {
      return null;
    }

    return {
      loginUserId: parsed.loginUserId,
      activeUserId: parsed.activeUserId,
      familyUserIds: parsed.familyUserIds,
    };
  } catch {
    return null;
  }
}

export function resolveActiveUser(
  users: User[],
  loginUser: User,
  sessionValue: string | undefined | null,
): User {
  const session = parseFamilySession(sessionValue);

  if (!session) {
    return loginUser;
  }

  // If the logged-in user has changed, default back to their own account
  if (session.loginUserId !== loginUser.id) {
    return loginUser;
  }

  if (!session.familyUserIds.includes(session.activeUserId)) {
    return loginUser;
  }

  const activeUser = users.find((user) => user.id === session.activeUserId);

  return activeUser ?? loginUser;
}

export function validateActiveUserSelection(
  session: FamilySession,
  requestedUserId: number,
): number {
  if (!session.familyUserIds.includes(requestedUserId)) {
    throw new Error("Invalid active user selection");
  }

  return requestedUserId;
}

// ── Session Middleware ────────────
export const sessionMiddleware = async (
  c: Context<Env>,
  next: () => Promise<void>,
) => {
  // Skip Better Auth routes — they handle their own auth
  if (c.req.path.startsWith("/api/auth")) {
    return next();
  }

  // Validate the Better Auth session cookie
  const auth = createAuth(c.env);
  const result = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!result?.session || !result?.user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const db = getDB(c.env);
  const loginUser = await getUserById(db, Number(result.user.id));

  if (!loginUser) {
    return c.json({ error: "User not found" }, 401);
  }

  // Resolve active family member via the switcher cookie
  const users: User[] = await getAllUsers(db);
  const sessionValue = getCookie(c, FAMILY_SESSION_COOKIE);
  const activeUser = resolveActiveUser(users, loginUser, sessionValue);
  const nextSession = serializeFamilySession({
    loginUserId: loginUser.id,
    activeUserId: activeUser.id,
    familyUserIds: users.map((user: User) => user.id),
  });

  setCookie(c, FAMILY_SESSION_COOKIE, nextSession, {
    httpOnly: true,
    sameSite: "Lax",
    path: "/",
  });

  c.set("loginUser", loginUser);
  c.set("activeUser", activeUser);
  c.set("authUser", activeUser);

  const posthog = createPostHogClient(c.env);
  posthog.identify({
    distinctId: String(loginUser.id),
    properties: {
      $set: {
        name: loginUser.name,
        email: loginUser.email,
        user_type: loginUser.type,
      },
    },
  });
  await posthog.shutdown();

  await next();
};

// ── Guard Helpers (unchanged) ──────────────────────────
export function requireAuthenticatedUser(c: Context<Env>): User {
  const authUser = c.get("activeUser");

  if (!authUser) {
    throw new Error("Authenticated user missing from context");
  }

  return authUser;
}

export function requireParent(c: Context<Env>): User {
  const authUser = requireAuthenticatedUser(c);

  if (!canManageTask(authUser)) {
    throw new HTTPException(403, { message: "Forbidden" });
  }

  return authUser;
}

export async function requireChildOwnTaskAccess(
  c: Context<Env>,
  taskId: number,
): Promise<User> {
  const authUser = requireAuthenticatedUser(c);

  if (authUser.type === "parent") {
    return authUser;
  }

  const db = getDB(c.env);
  const assigneeId = await getTaskAssigneeId(db, taskId);

  if (!canUpdateTaskStatus(authUser, assigneeId)) {
    throw new HTTPException(403, { message: "Forbidden" });
  }

  return authUser;
}

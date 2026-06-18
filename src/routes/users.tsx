import type { Hono } from "hono";
import { getDB, type Env } from "../db/client";
import { requireParent } from "../auth/middleware";
import { getAllUsers } from "../services/user.service";
import { createAuth } from "../auth/auth";
import { eq, and } from "drizzle-orm";
import { users, accounts } from "../db/schema";
import { hashPassword } from "better-auth/crypto";

export function userRoutes(app: Hono<Env>) {
  // GET list of all users (sorted)
  app.get("/api/users", async (c) => {
    try {
      const db = getDB(c.env);
      const result = await getAllUsers(db);
      const sortedUsers = [...result].sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === "child" ? -1 : 1;
        }

        if (a.points !== b.points) {
          return b.points - a.points;
        }

        return a.name.localeCompare(b.name);
      });

      return c.json(sortedUsers);
    } catch (error) {
      console.error("GET /api/users error:", error);
      return c.json({ error: "Failed to load users" }, 500);
    }
  });

  // POST create a child user (Parents only)
  app.post("/api/users/children", async (c) => {
    try {
      requireParent(c);

      const body = await c.req.json<{
        name?: string;
        username?: string;
        email?: string;
        password?: string;
      }>();

      const { name, username, email, password } = body;

      if (!name?.trim() || !username?.trim() || !email?.trim() || !password) {
        return c.json(
          { error: "Name, username, email, and password are required" },
          400,
        );
      }

      if (password.length < 6) {
        return c.json({ error: "Password must be at least 6 characters" }, 400);
      }

      const auth = createAuth(c.env);

      const result = await auth.api.signUpEmail({
        body: {
          email: email.trim(),
          password,
          name: name.trim(),
          username: username.trim(),
          type: "child",
        },
      });

      if (!result?.user) {
        return c.json({ error: "Failed to create child account" }, 500);
      }

      return c.json(result.user, 201);
    } catch (err: any) {
      console.error("POST /api/users/children error:", err);
      const message =
        err?.message || err?.body?.message || "Failed to create child account";
      const status = err?.status || 500;
      return c.json({ error: message }, status);
    }
  });

  // PATCH user details (Parents only - Stub)
  app.patch("/api/users/:id", async (c) => {
    try {
      requireParent(c);
      return c.json({ error: "Not implemented" }, 501);
    } catch (err) {
      return c.json(
        { error: err instanceof Error ? err.message : "Internal Server Error" },
        500,
      );
    }
  });

  app.post("/api/users/:id/password", async (c) => {
    try {
      requireParent(c);
      const targetUserId = Number(c.req.param("id"));
      const body = await c.req.json<{ password?: string }>();
      const { password } = body;

      if (!password || password.length < 6) {
        return c.json({ error: "Password must be at least 6 characters" }, 400);
      }

      const db = getDB(c.env);

      // Enforce that target user exists and is a child
      const targetUser = await db
        .select()
        .from(users)
        .where(eq(users.id, targetUserId))
        .get();

      if (!targetUser) {
        return c.json({ error: "User not found" }, 404);
      }

      if (targetUser.type !== "child") {
        return c.json(
          { error: "Forbidden: Parents can only change children's passwords" },
          403,
        );
      }

      // Hash password and update account record
      const hashedPassword = await hashPassword(password);
      await db
        .update(accounts)
        .set({ password: hashedPassword, updatedAt: new Date() })
        .where(
          and(
            eq(accounts.userId, targetUserId),
            eq(accounts.providerId, "email"),
          ),
        );
      return c.json({ success: true });
    } catch (err: any) {
      console.error("POST /api/users/:id/password error:", err);
      return c.json(
        { error: err?.message || "Failed to update child password" },
        500,
      );
    }
  });
}

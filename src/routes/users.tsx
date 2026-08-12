import type { Hono } from "hono";
import { getDB, type Env } from "../db/client";
import { requireAuthenticatedUser, requireParent } from "../auth/middleware";
import { getAllUsers } from "../services/user.service";
import { createAuth } from "../auth/auth";
import { eq, and, isNull, ne, or, sql } from "drizzle-orm";
import {
  users,
  accounts,
  tasks,
  taskAchievements,
  taskCompletions,
  pointEntries,
  earnedBadges,
} from "../db/schema";
import { hashPassword } from "better-auth/crypto";

type UserRoutesDeps = {
  getDB: typeof getDB;
  requireAuthenticatedUser: typeof requireAuthenticatedUser;
  requireParent: typeof requireParent;
};

const defaultDeps: UserRoutesDeps = {
  getDB,
  requireAuthenticatedUser,
  requireParent,
};

export function userRoutes(
  app: Hono<Env>,
  overrides: Partial<UserRoutesDeps> = {},
) {
  const deps = { ...defaultDeps, ...overrides };
  // GET list of all users (sorted)
  app.get("/api/users", async (c) => {
    try {
      const db = deps.getDB(c.env);
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
      deps.requireParent(c);

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
      deps.requireParent(c);
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
      deps.requireParent(c);
      const targetUserId = Number(c.req.param("id"));
      const body = await c.req.json<{ password?: string }>();
      const { password } = body;

      if (!password || password.length < 6) {
        return c.json({ error: "Password must be at least 6 characters" }, 400);
      }

      const db = deps.getDB(c.env);

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

  // GET achievements, custom parent achievements, stats, and milestones
  app.get("/api/users/:id/achievements", async (c) => {
    try {
      deps.requireAuthenticatedUser(c);
      const userId = Number(c.req.param("id"));
      const db = deps.getDB(c.env);
      // Check if user exists
      const targetUser = await db
        .select()
        .from(users)
        .where(eq(users.id, userId))
        .get();
      if (!targetUser) {
        return c.json({ error: "User not found" }, 404);
      }
      // Get all custom achievements for tasks assigned to this user
      const achievementsList = await db
        .select({
          achievement: taskAchievements,
          currentTask: tasks,
        })
        .from(taskAchievements)
        .leftJoin(
          tasks,
          and(
            eq(tasks.achievementId, taskAchievements.id),
            ne(tasks.status, "archived"),
          ),
        )
        .where(
          and(
            eq(taskAchievements.active, true),
            eq(taskAchievements.streakEnabled, true),
            or(
              eq(taskAchievements.assigneeId, userId),
              eq(tasks.assigneeId, userId),
            ),
          ),
        );

      // Get all earned badges for this user
      const userBadges = await db
        .select()
        .from(earnedBadges)
        .where(
          and(
            eq(earnedBadges.userId, userId),
            isNull(earnedBadges.revokedAt),
          ),
        );
      const completionHistory = await db
        .select({ completion: taskCompletions, task: tasks })
        .from(taskCompletions)
        .leftJoin(tasks, eq(taskCompletions.taskId, tasks.id))
        .where(
          and(
            eq(taskCompletions.userId, userId),
            isNull(taskCompletions.canceledAt),
          ),
        );
      const pointTotal = await db
        .select({
          points: sql<number>`coalesce(sum(${pointEntries.delta}), 0)`,
        })
        .from(pointEntries)
        .where(eq(pointEntries.userId, userId))
        .get();
      const totalCompleted = completionHistory.length;
      const highPriorityCompleted = completionHistory.filter(
        ({ task }) => task?.priority === "high",
      ).length;
      const repeatingCompleted = completionHistory.filter(
        ({ completion }) => completion.achievementId !== null,
      ).length;
      const cleanCompleted = completionHistory.filter(({ task }) => {
        const title = task?.title.toLowerCase() ?? "";
        return title.includes("clean") || title.includes("room");
      }).length;
      return c.json({
        achievements: achievementsList.map((a: any) => ({
          ...a.achievement,
          taskId: a.currentTask?.id ?? a.achievement.taskId ?? null,
          taskTitle: a.achievement.taskTitle ?? a.currentTask?.title ?? null,
          taskRepeat: a.achievement.cadence ?? a.currentTask?.repeat ?? null,
        })),
        badges: userBadges,
        stats: {
          totalCompleted,
          highPriorityCompleted,
          repeatingCompleted,
          cleanCompleted,
          currentPoints: Number(pointTotal?.points ?? 0),
        },
      });
    } catch (err: any) {
      console.error("GET /api/users/:id/achievements error:", err);
      return c.json(
        { error: err?.message || "Failed to load achievements" },
        500,
      );
    }
  });
  // PATCH update user avatar (image field)
  app.patch("/api/users/:id/avatar", async (c) => {
    try {
      const activeUser = deps.requireAuthenticatedUser(c);
      const targetUserId = Number(c.req.param("id"));
      const body = await c.req.json<{ avatar?: string }>();
      const { avatar } = body;
      if (!avatar) {
        return c.json({ error: "Avatar emoji is required" }, 400);
      }
      // Requester must be parent or the target user themselves
      if (activeUser.type !== "parent" && activeUser.id !== targetUserId) {
        return c.json({ error: "Forbidden: Access denied" }, 403);
      }
      const db = deps.getDB(c.env);
      // Verify user exists
      const targetUser = await db
        .select()
        .from(users)
        .where(eq(users.id, targetUserId))
        .get();
      if (!targetUser) {
        return c.json({ error: "User not found" }, 404);
      }
      // Define avatar milestone unlocks
      const avatarMilestones: Record<string, number> = {
        "🦊": 0,
        "🐼": 15,
        "🐨": 30,
        "🐯": 50,
        "🦁": 75,
        "🐲": 100,
      };
      const requiredCompletions = avatarMilestones[avatar];
      if (requiredCompletions === undefined) {
        return c.json({ error: "Invalid avatar selection" }, 400);
      }
      // If required > 0, verify the user has achieved it
      if (requiredCompletions > 0) {
        const completionRows = await db
          .select({ id: taskCompletions.id })
          .from(taskCompletions)
          .where(
            and(
              eq(taskCompletions.userId, targetUserId),
              isNull(taskCompletions.canceledAt),
            ),
          );
        const totalCompleted = completionRows.length;
        if (totalCompleted < requiredCompletions) {
          return c.json(
            {
              error: `Locked! You need at least ${requiredCompletions} task completions to unlock this avatar.`,
            },
            400,
          );
        }
      }
      // Update user avatar
      await db
        .update(users)
        .set({ image: avatar, updatedAt: new Date() })
        .where(eq(users.id, targetUserId));
      return c.json({ success: true, avatar });
    } catch (err: any) {
      console.error("PATCH /api/users/:id/avatar error:", err);
      return c.json({ error: err?.message || "Failed to update avatar" }, 500);
    }
  });
}

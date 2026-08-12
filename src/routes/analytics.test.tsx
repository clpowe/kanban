import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import type { Database, Env } from "../db/client";
import {
  earnedBadges,
  pointEntries,
  taskAchievements,
  taskCompletions,
  tasks,
  users,
} from "../db/schema";
import { createTestDb } from "../db/test-db";
import type { User } from "../types";
import { analyticsRoutes } from "./analytics";
import { userRoutes } from "./users";

type TestDb = ReturnType<typeof createTestDb>;

async function createHistoryFixture(db: TestDb) {
  const now = new Date("2026-08-12T12:00:00Z");
  const [parent, child] = await db
    .insert(users)
    .values([
      {
        name: "Parent",
        email: "analytics-parent@example.com",
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
        points: 0,
        type: "parent",
        username: "analytics-parent",
      },
      {
        name: "Child",
        email: "analytics-child@example.com",
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
        points: 999,
        type: "child",
        username: "analytics-child",
      },
    ])
    .returning();
  if (!parent || !child) throw new Error("User fixtures were not inserted");

  const [goal] = await db
    .insert(taskAchievements)
    .values({
      recurrenceKey: "analytics-daily",
      cadence: "daily",
      taskTitle: "Configured clean room",
      taskPriority: "high",
      taskValue: 10,
      assigneeId: child.id,
      streakEnabled: true,
      active: true,
      name: "Clean room streak",
      targetStreak: 5,
      currentStreak: 1,
      prestigeCount: 1,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  if (!goal) throw new Error("Goal fixture was not inserted");

  const [completedOccurrence, currentOccurrence, canceledTask, missedTask] =
    await db
      .insert(tasks)
      .values([
        {
          title: "Historical clean room",
          priority: "high",
          value: 10,
          status: "archived",
          repeat: "daily",
          assigneeId: child.id,
          achievementId: goal.id,
          cycleDate: "2026-08-11",
          completedAt: now,
          archivedAt: now,
          archiveReason: "completed",
        },
        {
          title: "Current occurrence snapshot",
          priority: "low",
          value: 1,
          status: "todo",
          repeat: "daily",
          assigneeId: child.id,
          achievementId: goal.id,
          cycleDate: "2026-08-12",
        },
        {
          title: "Status-only done task",
          priority: "medium",
          value: 5,
          status: "done",
          repeat: "none",
          assigneeId: child.id,
        },
        {
          title: "Missed legacy recurring task",
          priority: "low",
          value: 1,
          status: "archived",
          repeat: "daily",
          assigneeId: child.id,
          archivedAt: now,
          archiveReason: "missed",
        },
      ])
      .returning();
  if (!completedOccurrence || !currentOccurrence || !canceledTask || !missedTask) {
    throw new Error("Task fixtures were not inserted");
  }

  const [activeCompletion, canceledCompletion] = await db
    .insert(taskCompletions)
    .values([
      {
        eventId: "analytics-active-completion",
        taskId: completedOccurrence.id,
        achievementId: goal.id,
        userId: child.id,
        completedOn: "2026-08-11",
        completedAt: now,
        createdAt: now,
      },
      {
        eventId: "analytics-canceled-completion",
        taskId: canceledTask.id,
        achievementId: null,
        userId: child.id,
        completedOn: "2026-08-12",
        completedAt: now,
        canceledAt: now,
        cancelReason: "user_undo",
        createdAt: now,
      },
    ])
    .returning();
  if (!activeCompletion || !canceledCompletion) {
    throw new Error("Completion fixtures were not inserted");
  }

  await db.insert(pointEntries).values([
    {
      eventId: "analytics-opening",
      userId: child.id,
      delta: 30,
      reason: "opening_balance",
      createdAt: now,
    },
    {
      eventId: "analytics-reward",
      userId: child.id,
      delta: -10,
      reason: "reward_redeemed",
      createdAt: now,
    },
  ]);

  await db.insert(earnedBadges).values([
    {
      userId: child.id,
      achievementId: goal.id,
      badgeName: "Visible badge",
      prestigeLevel: 1,
      earnedAt: now,
      taskCompletionId: activeCompletion.id,
    },
    {
      userId: child.id,
      achievementId: goal.id,
      badgeName: "Revoked badge",
      prestigeLevel: 2,
      earnedAt: now,
      revokedAt: now,
      revokedReason: "completion_undone",
    },
  ]);

  return { parent, child, goal, currentOccurrence };
}

function createHistoryApp(db: TestDb, activeUser: User) {
  const app = new Hono<Env>();
  app.use("*", async (c, next) => {
    c.set("loginUser", activeUser);
    c.set("activeUser", activeUser);
    c.set("authUser", activeUser);
    await next();
  });
  analyticsRoutes(app, {
    getDB: () => db as unknown as Database,
  });
  userRoutes(app, {
    getDB: () => db as unknown as Database,
  });
  return app;
}

describe("history-backed analytics", () => {
  test("uses active completions and point entries instead of mutable task status", async () => {
    const db = createTestDb();
    const { parent, child } = await createHistoryFixture(db);
    const app = createHistoryApp(db, parent as User);

    const response = await app.request("/api/analytics");
    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      statusCounts: Array<{ status: string; count: number }>;
      childStats: Array<Record<string, unknown>>;
    };

    expect(json.statusCounts).toEqual([
      { status: "todo", count: 1 },
      { status: "doing", count: 0 },
      { status: "done", count: 0 },
      { status: "archived", count: 1 },
    ]);
    expect(json.childStats).toEqual([
      {
        childId: child.id,
        name: child.name,
        username: child.username,
        points: 20,
        todo: 1,
        doing: 0,
        done: 0,
        archived: 1,
      },
    ]);
  });

  test("builds profile stats, badges, and current goal cards from history", async () => {
    const db = createTestDb();
    const { parent, child, goal, currentOccurrence } =
      await createHistoryFixture(db);
    const app = createHistoryApp(db, parent as User);

    const response = await app.request(`/api/users/${child.id}/achievements`);
    expect(response.status).toBe(200);
    const json = (await response.json()) as {
      stats: Record<string, number>;
      badges: Array<Record<string, unknown>>;
      achievements: Array<Record<string, unknown>>;
    };

    expect(json.stats).toEqual({
      totalCompleted: 1,
      highPriorityCompleted: 1,
      repeatingCompleted: 1,
      cleanCompleted: 1,
      currentPoints: 20,
    });
    expect(json.badges).toEqual([
      expect.objectContaining({ badgeName: "Visible badge", revokedAt: null }),
    ]);
    expect(json.achievements).toEqual([
      expect.objectContaining({
        id: goal.id,
        taskId: currentOccurrence.id,
        taskTitle: "Configured clean room",
        taskRepeat: "daily",
      }),
    ]);
  });
});

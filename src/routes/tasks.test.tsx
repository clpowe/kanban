import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { eq } from "drizzle-orm";
import type { Database, Env } from "../db/client";
import { taskAchievements, tasks, users } from "../db/schema";
import { createTestDb } from "../db/test-db";
import type { User } from "../types";
import { createTask } from "../services/task.service";
import { taskRoutes } from "./tasks";

const parentUser: User = {
  id: 100,
  name: "Parent",
  email: "route-parent@example.com",
  emailVerified: true,
  image: null,
  createdAt: new Date("2026-08-07T16:00:00Z"),
  updatedAt: new Date("2026-08-07T16:00:00Z"),
  points: 0,
  type: "parent",
  username: "route-parent",
  displayUsername: "Parent",
};

function createTasksApp(db: ReturnType<typeof createTestDb>) {
  const app = new Hono<Env>();
  taskRoutes(app, {
    getDB: () => db as unknown as Database,
    requireAuthenticatedUser: () => parentUser,
    requireParent: () => parentUser,
    requireChildOwnTaskAccess: async () => parentUser,
    queuePostHogTelemetry: () => undefined,
  });
  return app;
}

async function insertUser(
  db: ReturnType<typeof createTestDb>,
  type: "parent" | "child",
  suffix: string,
) {
  const now = new Date("2026-08-07T16:00:00Z");
  const [user] = await db
    .insert(users)
    .values({
      name: `${type} ${suffix}`,
      email: `${type}-${suffix}@example.com`,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
      points: 0,
      type,
      username: `${type}-${suffix}`,
    })
    .returning();
  if (!user) throw new Error("User fixture was not inserted");
  return user;
}

async function requestJson(
  app: Hono<Env>,
  path: string,
  method: "POST" | "PATCH",
  body: unknown,
) {
  return app.request(path, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("taskRoutes validation", () => {
  test("returns 400 without writes for invalid create payloads", async () => {
    const invalidPayloads = [
      { title: " ", priority: "low", repeat: "none" },
      { title: "Bad priority", priority: "urgent", repeat: "none" },
      { title: "Bad repeat", priority: "low", repeat: "monthly" },
      {
        title: "Bad target",
        priority: "low",
        repeat: "daily",
        achievementName: "Bad streak",
        targetStreak: 0,
      },
      { title: "Bad assignee", priority: "low", repeat: "none", assigneeId: false },
      { title: "Missing assignee", priority: "low", repeat: "none", assigneeId: 999 },
    ];

    for (const [index, payload] of invalidPayloads.entries()) {
      const db = createTestDb();
      const app = createTasksApp(db);
      const response = await requestJson(app, "/api/tasks", "POST", payload);

      expect(response.status, `payload ${index}`).toBe(400);
      expect(await db.select().from(tasks), `tasks ${index}`).toEqual([]);
      expect(await db.select().from(taskAchievements), `goals ${index}`).toEqual([]);
    }
  });

  test("persists a validated edit and recalculates priority points", async () => {
    const db = createTestDb();
    const child = await insertUser(db, "child", "valid-edit");
    const [task] = await createTask(db as unknown as Database, {
      title: "Empty dishwasher",
      priority: "low",
      repeat: "none",
      assigneeId: child.id,
    });
    if (!task) throw new Error("Task fixture was not inserted");
    const app = createTasksApp(db);

    const response = await requestJson(
      app,
      `/api/tasks/${task.id}`,
      "PATCH",
      { title: "  Empty and reload dishwasher  ", priority: "high" },
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      title: "Empty and reload dishwasher",
      priority: "high",
      value: 10,
    });
  });

  test("returns 404 when updating a missing task", async () => {
    const db = createTestDb();
    const app = createTasksApp(db);

    const response = await requestJson(
      app,
      "/api/tasks/999",
      "PATCH",
      { title: "Missing" },
    );

    expect(response.status).toBe(404);
  });

  test("rejects a parent assignee before changing the task", async () => {
    const db = createTestDb();
    const child = await insertUser(db, "child", "assignee-guard");
    const parent = await insertUser(db, "parent", "assignee-guard");
    const [task] = await createTask(db as unknown as Database, {
      title: "Clean room",
      priority: "medium",
      repeat: "none",
      assigneeId: child.id,
    });
    if (!task) throw new Error("Task fixture was not inserted");
    const app = createTasksApp(db);

    const response = await requestJson(
      app,
      `/api/tasks/${task.id}`,
      "PATCH",
      { assigneeId: parent.id },
    );

    expect(response.status).toBe(400);
    expect(
      await db.select().from(tasks).where(eq(tasks.id, task.id)).get(),
    ).toMatchObject({ assigneeId: child.id });
  });

  test("rejects edits and restore attempts for archived recurring history", async () => {
    const db = createTestDb();
    const child = await insertUser(db, "child", "archive-guard");
    const [task] = await createTask(
      db as unknown as Database,
      {
        title: "Read together",
        priority: "low",
        repeat: "daily",
        assigneeId: child.id,
      },
      new Date("2026-08-07T16:00:00Z"),
    );
    if (!task) throw new Error("Recurring fixture was not inserted");
    await db
      .update(tasks)
      .set({
        status: "archived",
        archivedAt: new Date("2026-08-08T16:00:00Z"),
        archiveReason: "missed",
      })
      .where(eq(tasks.id, task.id));
    const app = createTasksApp(db);

    const editResponse = await requestJson(
      app,
      `/api/tasks/${task.id}`,
      "PATCH",
      { title: "Changed history" },
    );
    const restoreResponse = await requestJson(
      app,
      `/api/tasks/${task.id}/status`,
      "PATCH",
      { status: "todo", eventId: "restore-history" },
    );

    expect(editResponse.status).toBe(400);
    expect(restoreResponse.status).toBe(400);
    expect(
      await db.select().from(tasks).where(eq(tasks.id, task.id)).get(),
    ).toMatchObject({ status: "archived", title: "Read together" });
  });
});

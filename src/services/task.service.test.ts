import { describe, expect, test } from "bun:test";
import { taskAchievements, tasks, users } from "../db/schema";
import { createTestDb } from "../db/test-db";
import { eq } from "drizzle-orm";
import {
  archiveDoneTasks,
  createTask,
  getActiveTasks,
  getTaskById,
  updateTaskStatus,
} from "./task.service";
import type { Database } from "../db/client";

async function insertChild(db: ReturnType<typeof createTestDb>, suffix: string) {
  const now = new Date("2026-08-07T16:00:00Z");
  const [child] = await db
    .insert(users)
    .values({
      name: `Child ${suffix}`,
      email: `child-${suffix}@example.com`,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
      points: 0,
      type: "child",
      username: `child-${suffix}`,
    })
    .returning();
  if (!child) throw new Error("Child fixture was not inserted");
  return child;
}

describe("task service", () => {
  test.each([
    ["high", 10],
    ["medium", 5],
    ["low", 1],
  ] as const)(
    "stores %s priority tasks with %i points on creation",
    async (priority, expectedValue) => {
      const db = createTestDb();

      const created = await createTask(db as unknown as Database, {
        title: "Empty dishwasher",
        priority,
        value: "999",
        repeat: "none",
        assigneeId: "",
      });

      expect(created).toEqual([
        expect.objectContaining({
          id: 1,
          title: "Empty dishwasher",
          priority,
          value: expectedValue,
          repeat: "none",
          status: "todo",
          assigneeId: null,
          achievement: null,
        }),
      ]);
      expect(await db.select().from(taskAchievements)).toEqual([]);
    },
  );

  test("creates and hydrates a linked daily goal even when streak display is disabled", async () => {
    const db = createTestDb();
    const child = await insertChild(db, "daily");
    const now = new Date("2026-08-07T16:00:00Z");

    const [created] = await createTask(
      db as unknown as Database,
      {
        title: "Clean room",
        priority: "medium",
        repeat: "daily",
        assigneeId: child.id,
        streakEnabled: false,
      },
      now,
    );

    expect(created).toMatchObject({
      title: "Clean room",
      repeat: "daily",
      cycleDate: "2026-08-07",
      achievement: {
        cadence: "daily",
        taskTitle: "Clean room",
        taskPriority: "medium",
        taskValue: 5,
        assigneeId: child.id,
        streakEnabled: false,
        active: true,
      },
    });
    expect(created?.achievementId).toBe(created?.achievement?.id);
    expect(created?.achievement?.recurrenceKey).toMatch(/^recurrence:/);

    const hydrated = await getTaskById(db as unknown as Database, created!.id);
    expect(hydrated?.achievement?.id).toBe(created?.achievement?.id);

    const [boardTask] = await getActiveTasks(db as unknown as Database, now);
    expect(boardTask?.achievement?.id).toBe(created?.achievement?.id);
  });

  test("uses a Monday cycle key for weekly goals", async () => {
    const db = createTestDb();
    const child = await insertChild(db, "weekly");

    const [created] = await createTask(
      db as unknown as Database,
      {
        title: "Take bins out",
        priority: "high",
        repeat: "weekly",
        assigneeId: child.id,
        achievementName: "Bins streak",
        targetStreak: 8,
      },
      new Date("2026-08-09T16:00:00Z"),
    );

    expect(created?.cycleDate).toBe("2026-08-03");
    expect(created?.achievement).toMatchObject({
      cadence: "weekly",
      name: "Bins streak",
      targetStreak: 8,
      streakEnabled: true,
    });
  });

  test("prepares but hides a Monday daily occurrence created on a weekend", async () => {
    const db = createTestDb();
    const child = await insertChild(db, "weekend");
    const saturday = new Date("2026-08-08T16:00:00Z");

    const [created] = await createTask(
      db as unknown as Database,
      {
        title: "Read together",
        priority: "low",
        repeat: "daily",
        assigneeId: child.id,
      },
      saturday,
    );

    expect(created?.cycleDate).toBe("2026-08-10");
    expect(await getActiveTasks(db as unknown as Database, saturday)).toEqual([]);
    expect(
      await getActiveTasks(
        db as unknown as Database,
        new Date("2026-08-10T12:00:00Z"),
      ),
    ).toHaveLength(1);
    await expect(
      updateTaskStatus(
        db as unknown as Database,
        created!.id,
        "done",
        saturday,
      ),
    ).rejects.toThrow("not available until 2026-08-10");
  });

  test("rejects invalid recurring task input before writing", async () => {
    const invalidInputs = [
      { title: "Bad priority", priority: "urgent", repeat: "daily" },
      { title: "Bad cadence", priority: "low", repeat: "monthly" },
      {
        title: "Bad target",
        priority: "low",
        repeat: "daily",
        streakEnabled: true,
        achievementName: "Bad",
        targetStreak: 0,
      },
      { title: "Missing child", priority: "low", repeat: "daily", assigneeId: 999 },
    ];

    for (const [index, input] of invalidInputs.entries()) {
      const db = createTestDb();
      await expect(
        createTask(
          db as unknown as Database,
          input,
          new Date("2026-08-07T16:00:00Z"),
        ),
      ).rejects.toThrow();
      expect(await db.select().from(tasks), `fixture ${index}`).toEqual([]);
      expect(await db.select().from(taskAchievements), `fixture ${index}`).toEqual([]);
    }
  });

  test("does not subtract points when moving a completed task into archived", async () => {
    const updateCalls: Array<{ table: unknown; payload: Record<string, unknown> }> = [];
    const db = {
      select() {
        return {
          from() {
            return {
              where() {
                return {
                  get: async () => ({
                    id: 9,
                    status: "done",
                    assigneeId: 2,
                    value: 5,
                  }),
                };
              },
            };
          },
        };
      },
      update(table: unknown) {
        return {
          set(payload: Record<string, unknown>) {
            updateCalls.push({ table, payload });
            return {
              where: async () => undefined,
            };
          },
        };
      },
    };

    await updateTaskStatus(db as unknown as Database, 9, "archived");

    expect(updateCalls).toEqual([
      {
        table: tasks,
        payload: { status: "archived" },
      },
    ]);
  });

  test("bulk archival excludes recurring task occurrences", async () => {
    const db = createTestDb();
    const now = new Date("2026-08-08T16:00:00Z");

    const [recurringTask] = await db
      .insert(tasks)
      .values({
        title: "Clean room",
        priority: "medium",
        value: 5,
        status: "done",
        repeat: "daily",
        cycleDate: "2026-08-07",
      })
      .returning();
    if (!recurringTask) throw new Error("Recurring fixture was not inserted");
    const [achievement] = await db
      .insert(taskAchievements)
      .values({
        taskId: recurringTask.id,
        name: "Room streak",
        targetStreak: 20,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!achievement) throw new Error("Achievement fixture was not inserted");
    await db
      .update(tasks)
      .set({ achievementId: achievement.id })
      .where(eq(tasks.id, recurringTask.id));

    const [oneOffTask] = await db
      .insert(tasks)
      .values({
        title: "Take bins out",
        priority: "low",
        value: 1,
        status: "done",
        repeat: "none",
      })
      .returning();
    if (!oneOffTask) throw new Error("One-off fixture was not inserted");

    await archiveDoneTasks(db as unknown as Database);

    const rows = await db.select().from(tasks);
    expect(rows.find((task) => task.id === recurringTask.id)?.status).toBe("done");
    expect(rows.find((task) => task.id === oneOffTask.id)?.status).toBe("archived");
  });

  test("rejects direct undo transitions that would bypass the ledger", async () => {
    const updateCalls: Array<{ table: unknown; payload: Record<string, unknown> }> = [];
    const db = {
      select() {
        return {
          from() {
            return {
              where() {
                return {
                  get: async () => ({
                    id: 7,
                    status: "done",
                    assigneeId: 2,
                    value: 10,
                  }),
                };
              },
            };
          },
        };
      },
      update(table: unknown) {
        return {
          set(payload: Record<string, unknown>) {
            updateCalls.push({ table, payload });
            return {
              where: async () => undefined,
            };
          },
        };
      },
    };

    await expect(
      updateTaskStatus(db as unknown as Database, 7, "todo"),
    ).rejects.toThrow("Undo completion requires an event ID");
    expect(updateCalls).toEqual([]);
  });

  test("rejects direct completion transitions that would bypass the ledger", async () => {
    const db = createTestDb();
    const child = await insertChild(db, "ledger-guard");
    const [task] = await createTask(db as unknown as Database, {
      title: "Clean table",
      priority: "low",
      repeat: "none",
      assigneeId: child.id,
    });
    if (!task) throw new Error("Task fixture was not inserted");

    await expect(
      updateTaskStatus(db as unknown as Database, task.id, "done"),
    ).rejects.toThrow("completion requires an event ID");

    expect(
      await db.select().from(tasks).where(eq(tasks.id, task.id)).get(),
    ).toMatchObject({ status: "todo", completedAt: null });
  });
});

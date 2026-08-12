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

  test("subtracts points when a done task moves back to an active status", async () => {
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

    await updateTaskStatus(db as unknown as Database, 7, "todo");

    expect(updateCalls[0]).toEqual({
      table: tasks,
      payload: { status: "todo" },
    });
    expect(updateCalls[1]?.table).toBe(users);
  });

  test("awards a badge and reports the milestone when the streak hits the target", async () => {
    const now = new Date("2026-07-08T12:00:00Z");
    const selectResults = [
      // 1st select: the task row
      {
        id: 3,
        status: "doing",
        repeat: "daily",
        assigneeId: 2,
        value: 5,
      },
      // 2nd select: the achievement row, one day from the 20-day badge
      {
        id: 11,
        taskId: 3,
        name: "20-Day Streak Reward Badge",
        targetStreak: 20,
        currentStreak: 19,
        prestigeCount: 0,
        missedDaysInARow: 0,
        lastCompletedAt: new Date("2026-07-07T12:00:00Z"),
      },
    ];
    const updateCalls: Array<{ table: unknown; payload: Record<string, unknown> }> = [];
    const insertCalls: Array<{ table: unknown; payload: Record<string, unknown> }> = [];

    const db = {
      select() {
        return {
          from() {
            return {
              where() {
                return {
                  get: async () => selectResults.shift(),
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
      insert(table: unknown) {
        return {
          values: async (payload: Record<string, unknown>) => {
            insertCalls.push({ table, payload });
          },
        };
      },
    };

    const { milestone } = await updateTaskStatus(db as unknown as Database, 3, "done", now);

    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0]?.payload).toMatchObject({
      userId: 2,
      achievementId: 11,
      badgeName: "20-Day Streak Reward Badge",
      prestigeLevel: 1,
    });

    const achievementUpdate = updateCalls.at(-1)?.payload;
    expect(achievementUpdate).toMatchObject({
      currentStreak: 0,
      missedDaysInARow: 0,
      prestigeCount: 1,
      prevStreak: 19,
    });

    expect(milestone).toEqual({
      achievementId: 11,
      badgeName: "20-Day Streak Reward Badge",
      streak: 20,
      prestigeLevel: 1,
    });
  });

  test("applies the daily penalty after a skipped weekday", async () => {
    const now = new Date("2026-07-08T12:00:00Z");
    const selectResults = [
      { id: 4, status: "todo", repeat: "daily", assigneeId: 2, value: 5 },
      {
        id: 12,
        taskId: 4,
        name: "Room Cleaner",
        targetStreak: 20,
        currentStreak: 5,
        prestigeCount: 0,
        missedDaysInARow: 1,
        lastCompletedAt: new Date("2026-07-06T12:00:00Z"), // missed July 7th
      },
    ];
    const updateCalls: Array<{ table: unknown; payload: Record<string, unknown> }> = [];

    const db = {
      select() {
        return {
          from() {
            return {
              where() {
                return {
                  get: async () => selectResults.shift(),
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
      insert() {
        throw new Error("no badge should be inserted for a frozen streak");
      },
    };

    const { milestone } = await updateTaskStatus(db as unknown as Database, 4, "done", now);

    expect(milestone).toBeNull();
    const achievementUpdate = updateCalls.at(-1)?.payload;
    expect(achievementUpdate).toMatchObject({
      currentStreak: 4,
      missedDaysInARow: 0,
    });
  });
});

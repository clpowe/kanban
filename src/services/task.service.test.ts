import { describe, expect, test } from "bun:test";
import { taskAchievements, tasks, users } from "../db/schema";
import { createTestDb } from "../db/test-db";
import { eq } from "drizzle-orm";
import {
  archiveDoneTasks,
  createTask,
  getActiveTasks,
  getTaskById,
  updateTask,
  updateTaskStatus,
} from "./task.service";
import type { Database } from "../db/client";
import { reconcileRecurringTasks } from "./recurrence.service";

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

  test("trims edits and recalculates point value from priority", async () => {
    const db = createTestDb();
    const [task] = await createTask(db as unknown as Database, {
      title: "Empty dishwasher",
      priority: "low",
      repeat: "none",
      assigneeId: null,
    });
    if (!task) throw new Error("Task fixture was not inserted");

    const updated = await updateTask(
      db as unknown as Database,
      task.id,
      { title: "  Empty and reload dishwasher  ", priority: "high" },
      new Date("2026-08-07T16:00:00Z"),
    );

    expect(updated).toMatchObject({
      title: "Empty and reload dishwasher",
      priority: "high",
      value: 10,
      repeat: "none",
    });
  });

  test("updates recurring configuration and cadence in one batch", async () => {
    const db = createTestDb();
    const child = await insertChild(db, "edit-recurring");
    const [task] = await createTask(
      db as unknown as Database,
      {
        title: "Clean room",
        priority: "medium",
        repeat: "daily",
        assigneeId: child.id,
        achievementName: "Room streak",
        targetStreak: 5,
      },
      new Date("2026-08-07T16:00:00Z"),
    );
    if (!task?.achievement) throw new Error("Recurring fixture was not inserted");

    const updated = await updateTask(
      db as unknown as Database,
      task.id,
      {
        title: "Deep clean room",
        priority: "high",
        repeat: "weekly",
        achievementName: "Weekly room reset",
        targetStreak: 8,
        streakEnabled: true,
      },
      new Date("2026-08-09T16:00:00Z"),
    );

    expect(updated).toMatchObject({
      id: task.id,
      title: "Deep clean room",
      priority: "high",
      value: 10,
      repeat: "weekly",
      cycleDate: "2026-08-03",
      achievementId: task.achievement.id,
      achievement: {
        id: task.achievement.id,
        cadence: "weekly",
        taskTitle: "Deep clean room",
        taskPriority: "high",
        taskValue: 10,
        name: "Weekly room reset",
        targetStreak: 8,
        streakEnabled: true,
        active: true,
      },
    });
  });

  test("starts a cadence edit at the next unused cycle when current history collides", async () => {
    const db = createTestDb();
    const child = await insertChild(db, "edit-cycle-collision");
    const monday = new Date("2026-08-03T16:00:00Z");
    const [mondayTask] = await createTask(
      db as unknown as Database,
      {
        title: "Clean room",
        priority: "medium",
        repeat: "daily",
        assigneeId: child.id,
      },
      monday,
    );
    if (!mondayTask) throw new Error("Recurring fixture was not inserted");
    await db
      .update(tasks)
      .set({ status: "done", completedAt: monday })
      .where(eq(tasks.id, mondayTask.id));
    await reconcileRecurringTasks(
      db as unknown as Database,
      new Date("2026-08-04T04:05:00Z"),
    );
    const tuesdayTask = await db
      .select()
      .from(tasks)
      .where(eq(tasks.status, "todo"))
      .get();
    if (!tuesdayTask) throw new Error("Tuesday occurrence was not inserted");

    const updated = await updateTask(
      db as unknown as Database,
      tuesdayTask.id,
      { repeat: "weekly" },
      new Date("2026-08-04T16:00:00Z"),
    );

    expect(updated).toMatchObject({
      repeat: "weekly",
      cycleDate: "2026-08-10",
      achievementId: mondayTask.achievementId,
    });
  });

  test("converts one-off work to recurring and back without changing the occurrence ID", async () => {
    const db = createTestDb();
    const child = await insertChild(db, "edit-transition");
    const [task] = await createTask(db as unknown as Database, {
      title: "Read together",
      priority: "low",
      repeat: "none",
      assigneeId: child.id,
    });
    if (!task) throw new Error("Task fixture was not inserted");
    const saturday = new Date("2026-08-08T16:00:00Z");

    const recurring = await updateTask(
      db as unknown as Database,
      task.id,
      {
        repeat: "daily",
        streakEnabled: false,
      },
      saturday,
    );
    expect(recurring).toMatchObject({
      id: task.id,
      repeat: "daily",
      cycleDate: "2026-08-10",
      achievement: {
        cadence: "daily",
        streakEnabled: false,
        active: true,
      },
    });
    const goalId = recurring?.achievementId;
    expect(goalId).toBeNumber();

    const oneOff = await updateTask(
      db as unknown as Database,
      task.id,
      { repeat: "none", streakEnabled: false },
      saturday,
    );
    expect(oneOff).toMatchObject({
      id: task.id,
      repeat: "none",
      cycleDate: null,
      achievementId: null,
      achievement: null,
    });
    expect(
      await db
        .select()
        .from(taskAchievements)
        .where(eq(taskAchievements.id, goalId!))
        .get(),
    ).toMatchObject({ active: false });
  });

  test("rejects invalid assignees and archived recurring edits before writes", async () => {
    const db = createTestDb();
    const child = await insertChild(db, "edit-guard");
    const now = new Date("2026-08-07T16:00:00Z");
    const [parent] = await db
      .insert(users)
      .values({
        name: "Parent edit guard",
        email: "parent-edit-guard@example.com",
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
        points: 0,
        type: "parent",
        username: "parent-edit-guard",
      })
      .returning();
    const [task] = await createTask(
      db as unknown as Database,
      {
        title: "Clean room",
        priority: "medium",
        repeat: "daily",
        assigneeId: child.id,
      },
      now,
    );
    if (!parent || !task) throw new Error("Guard fixture was not inserted");

    await expect(
      updateTask(db as unknown as Database, task.id, {
        assigneeId: parent.id,
      }),
    ).rejects.toThrow("assigned to parents");
    expect(
      await db.select().from(tasks).where(eq(tasks.id, task.id)).get(),
    ).toMatchObject({ assigneeId: child.id });

    await db
      .update(tasks)
      .set({ status: "archived", archivedAt: now, archiveReason: "manual" })
      .where(eq(tasks.id, task.id));
    await expect(
      updateTask(db as unknown as Database, task.id, { title: "Changed" }),
    ).rejects.toThrow("cannot be edited");
    expect(
      await updateTask(db as unknown as Database, 999, { title: "Missing" }),
    ).toBeNull();
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

import { describe, expect, test } from "bun:test";
import { asc, eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { rolloverRuns, taskAchievements, tasks, users } from "../db/schema";
import { createTestDb } from "../db/test-db";
import { createTask, getActiveTasks } from "./task.service";
import { reconcileRecurringTasks } from "./recurrence.service";

type TestDb = ReturnType<typeof createTestDb>;

async function insertChild(db: TestDb, suffix: string) {
  const now = new Date("2026-08-07T16:00:00Z");
  const [child] = await db
    .insert(users)
    .values({
      name: `Child ${suffix}`,
      email: `recurrence-${suffix}@example.com`,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
      points: 0,
      type: "child",
      username: `recurrence-${suffix}`,
    })
    .returning();

  if (!child) throw new Error("Child fixture was not inserted");
  return child;
}

async function createRecurringFixture(
  db: TestDb,
  options: {
    suffix: string;
    repeat: "daily" | "weekly";
    now: Date;
    title?: string;
    priority?: "high" | "medium" | "low";
  },
) {
  const child = await insertChild(db, options.suffix);
  const [task] = await createTask(
    db as unknown as Database,
    {
      title: options.title ?? `Task ${options.suffix}`,
      priority: options.priority ?? "medium",
      repeat: options.repeat,
      assigneeId: child.id,
      achievementName: `Goal ${options.suffix}`,
      targetStreak: 7,
    },
    options.now,
  );

  if (!task?.achievement) throw new Error("Recurring fixture was not created");
  return { child, task, goal: task.achievement };
}

describe("reconcileRecurringTasks", () => {
  test("archives a completed Friday occurrence and prepares exactly one hidden Monday row", async () => {
    const db = createTestDb();
    const friday = new Date("2026-08-07T16:00:00Z");
    const saturday = new Date("2026-08-08T16:00:00Z");
    const sunday = new Date("2026-08-09T16:00:00Z");
    const monday = new Date("2026-08-10T12:00:00Z");
    const { task, goal, child } = await createRecurringFixture(db, {
      suffix: "daily-completed",
      repeat: "daily",
      now: friday,
      title: "Clean room",
      priority: "high",
    });
    const completedAt = new Date("2026-08-07T20:00:00Z");
    await db
      .update(tasks)
      .set({ status: "done", completedAt })
      .where(eq(tasks.id, task.id));

    expect(
      await reconcileRecurringTasks(db as unknown as Database, saturday),
    ).toEqual({
      cycleKey: "2026-08-08",
      duplicate: false,
      archived: 1,
      created: 1,
    });

    let rows = await db.select().from(tasks).orderBy(asc(tasks.id));
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: task.id,
      status: "archived",
      archiveReason: "completed",
      completedAt,
    });
    expect(rows[0]?.archivedAt).toEqual(saturday);
    expect(rows[1]).toMatchObject({
      title: "Clean room",
      priority: "high",
      value: 10,
      assigneeId: child.id,
      repeat: "daily",
      achievementId: goal.id,
      cycleDate: "2026-08-10",
      status: "todo",
    });
    expect(await getActiveTasks(db as unknown as Database, saturday)).toEqual([]);

    expect(
      await reconcileRecurringTasks(db as unknown as Database, sunday),
    ).toMatchObject({ duplicate: false, archived: 0, created: 0 });
    expect(
      await reconcileRecurringTasks(db as unknown as Database, monday),
    ).toMatchObject({ duplicate: false, archived: 0, created: 0 });

    rows = await db.select().from(tasks).orderBy(asc(tasks.id));
    expect(rows).toHaveLength(2);
    const boardRows = await getActiveTasks(db as unknown as Database, monday);
    expect(boardRows).toHaveLength(1);
    expect(boardRows[0]?.cycleDate).toBe("2026-08-10");
  });

  test("archives an unfinished Friday occurrence as missed", async () => {
    const db = createTestDb();
    const { task } = await createRecurringFixture(db, {
      suffix: "daily-missed",
      repeat: "daily",
      now: new Date("2026-08-07T16:00:00Z"),
    });

    await reconcileRecurringTasks(
      db as unknown as Database,
      new Date("2026-08-08T16:00:00Z"),
    );

    const archived = await db.select().from(tasks).where(eq(tasks.id, task.id)).get();
    expect(archived).toMatchObject({
      status: "archived",
      archiveReason: "missed",
      completedAt: null,
    });
  });

  test.each([
    ["done", "completed"],
    ["todo", "missed"],
  ] as const)(
    "rolls a weekly %s occurrence into the next Monday as %s history",
    async (status, archiveReason) => {
      const db = createTestDb();
      const { task, goal, child } = await createRecurringFixture(db, {
        suffix: `weekly-${status}`,
        repeat: "weekly",
        now: new Date("2026-08-03T16:00:00Z"),
        title: "Take bins out",
        priority: "low",
      });
      await db.update(tasks).set({ status }).where(eq(tasks.id, task.id));

      const result = await reconcileRecurringTasks(
        db as unknown as Database,
        new Date("2026-08-10T05:00:00Z"),
      );

      expect(result).toMatchObject({ duplicate: false, archived: 1, created: 1 });
      const rows = await db.select().from(tasks).orderBy(asc(tasks.id));
      expect(rows[0]).toMatchObject({
        status: "archived",
        archiveReason,
      });
      expect(rows[1]).toMatchObject({
        title: "Take bins out",
        priority: "low",
        value: 1,
        assigneeId: child.id,
        repeat: "weekly",
        achievementId: goal.id,
        cycleDate: "2026-08-10",
        status: "todo",
      });
    },
  );

  test("uses the daily receipt to make a replay a no-op", async () => {
    const db = createTestDb();
    const { goal } = await createRecurringFixture(db, {
      suffix: "replay",
      repeat: "daily",
      now: new Date("2026-08-07T16:00:00Z"),
    });
    await db
      .update(taskAchievements)
      .set({ currentStreak: 4 })
      .where(eq(taskAchievements.id, goal.id));
    const now = new Date("2026-08-08T16:00:00Z");

    const first = await reconcileRecurringTasks(db as unknown as Database, now);
    const tasksAfterFirst = await db.select().from(tasks).orderBy(asc(tasks.id));
    const goalAfterFirst = await db
      .select()
      .from(taskAchievements)
      .where(eq(taskAchievements.id, goal.id))
      .get();
    const second = await reconcileRecurringTasks(db as unknown as Database, now);

    expect(first).toMatchObject({ duplicate: false, archived: 1, created: 1 });
    expect(second).toEqual({
      cycleKey: "2026-08-08",
      duplicate: true,
      archived: 0,
      created: 0,
    });
    expect(await db.select().from(tasks).orderBy(asc(tasks.id))).toEqual(
      tasksAfterFirst,
    );
    expect(
      await db
        .select()
        .from(taskAchievements)
        .where(eq(taskAchievements.id, goal.id))
        .get(),
    ).toEqual(goalAfterFirst);
    expect(goalAfterFirst?.currentStreak).toBe(4);
    expect(await db.select().from(rolloverRuns)).toHaveLength(1);
  });

  test("reconciles directly to current cycles after missed scheduler dates", async () => {
    const db = createTestDb();
    await createRecurringFixture(db, {
      suffix: "gap-daily",
      repeat: "daily",
      now: new Date("2026-08-07T16:00:00Z"),
    });
    await createRecurringFixture(db, {
      suffix: "gap-weekly",
      repeat: "weekly",
      now: new Date("2026-07-27T16:00:00Z"),
    });

    const result = await reconcileRecurringTasks(
      db as unknown as Database,
      new Date("2026-08-17T04:05:00Z"),
    );

    expect(result).toMatchObject({ duplicate: false, archived: 2, created: 2 });
    const allRows = await db.select().from(tasks);
    expect(allRows.filter((row) => row.status === "archived")).toHaveLength(2);
    const activeRows = allRows.filter((row) => row.status !== "archived");
    expect(activeRows).toHaveLength(2);
    expect(activeRows.map((row) => row.cycleDate).sort()).toEqual([
      "2026-08-17",
      "2026-08-17",
    ]);
  });

  test("does not create an occurrence for an inactive goal", async () => {
    const db = createTestDb();
    const { task, goal } = await createRecurringFixture(db, {
      suffix: "inactive",
      repeat: "daily",
      now: new Date("2026-08-07T16:00:00Z"),
    });
    await db
      .update(taskAchievements)
      .set({ active: false })
      .where(eq(taskAchievements.id, goal.id));
    await db
      .update(tasks)
      .set({
        status: "archived",
        archiveReason: "manual",
        archivedAt: new Date("2026-08-07T20:00:00Z"),
      })
      .where(eq(tasks.id, task.id));

    const result = await reconcileRecurringTasks(
      db as unknown as Database,
      new Date("2026-08-10T04:05:00Z"),
    );

    expect(result).toMatchObject({ duplicate: false, archived: 0, created: 0 });
    expect(await db.select().from(tasks)).toHaveLength(1);
  });
});

import { describe, expect, test } from "bun:test";
import { asc, eq, isNull, ne } from "drizzle-orm";
import type { Database } from "../db/client";
import {
  earnedBadges,
  pointEntries,
  taskAchievements,
  taskCompletions,
  tasks,
  users,
} from "../db/schema";
import { createTestDb } from "../db/test-db";
import { reconcileRecurringTasks } from "./recurrence.service";
import { createTask, updateTaskStatus } from "./task.service";
import { completeTask, undoCompletion } from "./completion.service";

type TestDb = ReturnType<typeof createTestDb>;

async function insertChild(db: TestDb, suffix: string) {
  const now = new Date("2026-08-03T16:00:00Z");
  const [child] = await db
    .insert(users)
    .values({
      name: `Child ${suffix}`,
      email: `completion-${suffix}@example.com`,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
      points: 0,
      type: "child",
      username: `completion-${suffix}`,
    })
    .returning();

  if (!child) throw new Error("Child fixture was not inserted");
  return child;
}

async function snapshotCompletionState(db: TestDb) {
  const [userRows, taskRows, goalRows, completionRows, pointRows, badgeRows] =
    await Promise.all([
      db.select().from(users).orderBy(asc(users.id)),
      db.select().from(tasks).orderBy(asc(tasks.id)),
      db.select().from(taskAchievements).orderBy(asc(taskAchievements.id)),
      db.select().from(taskCompletions).orderBy(asc(taskCompletions.id)),
      db.select().from(pointEntries).orderBy(asc(pointEntries.id)),
      db.select().from(earnedBadges).orderBy(asc(earnedBadges.id)),
    ]);

  return {
    userRows,
    taskRows,
    goalRows,
    completionRows,
    pointRows,
    badgeRows,
  };
}

describe("completeTask", () => {
  test("atomically completes a one-off task and awards ledger-backed points once", async () => {
    const db = createTestDb();
    const child = await insertChild(db, "one-off");
    const [task] = await createTask(db as unknown as Database, {
      title: "Empty dishwasher",
      priority: "medium",
      repeat: "none",
      assigneeId: child.id,
    });
    if (!task) throw new Error("Task fixture was not inserted");
    const now = new Date("2026-08-07T20:00:00Z");

    const result = await completeTask(
      db as unknown as Database,
      task.id,
      "complete-one-off",
      now,
    );

    expect(result).toMatchObject({ duplicate: false, milestone: null });
    expect(result.task).toMatchObject({ status: "done", completedAt: now });

    const completions = await db.select().from(taskCompletions);
    expect(completions).toEqual([
      expect.objectContaining({
        eventId: "complete-one-off",
        taskId: task.id,
        achievementId: null,
        userId: child.id,
        completedOn: "2026-08-07",
        completedAt: now,
        canceledAt: null,
      }),
    ]);

    const entries = await db.select().from(pointEntries);
    expect(entries).toEqual([
      expect.objectContaining({
        eventId: "complete-one-off",
        userId: child.id,
        delta: 5,
        reason: "task_completed",
        taskId: task.id,
        taskCompletionId: completions[0]?.id,
      }),
    ]);
    const refreshedChild = await db
      .select()
      .from(users)
      .where(eq(users.id, child.id))
      .get();
    expect(refreshedChild?.points).toBe(
      entries.reduce((sum, entry) => sum + entry.delta, 0),
    );

    const replay = await completeTask(
      db as unknown as Database,
      task.id,
      "complete-one-off",
      now,
    );
    expect(replay.duplicate).toBe(true);
    expect(await db.select().from(taskCompletions)).toHaveLength(1);
    expect(await db.select().from(pointEntries)).toHaveLength(1);
  });

  test("advances a recurring streak and awards one linked badge under same-cycle concurrency", async () => {
    const db = createTestDb();
    const child = await insertChild(db, "recurring");
    const monday = new Date("2026-08-03T16:00:00Z");
    const [firstTask] = await createTask(
      db as unknown as Database,
      {
        title: "Clean room",
        priority: "high",
        repeat: "daily",
        assigneeId: child.id,
        achievementName: "Room streak",
        targetStreak: 2,
      },
      monday,
    );
    if (!firstTask?.achievement) throw new Error("Recurring fixture was not inserted");

    await completeTask(
      db as unknown as Database,
      firstTask.id,
      "complete-monday",
      monday,
    );
    let goal = await db
      .select()
      .from(taskAchievements)
      .where(eq(taskAchievements.id, firstTask.achievement.id))
      .get();
    expect(goal).toMatchObject({ currentStreak: 1, prestigeCount: 0 });

    await reconcileRecurringTasks(
      db as unknown as Database,
      new Date("2026-08-04T04:05:00Z"),
    );
    const secondTask = await db
      .select()
      .from(tasks)
      .where(ne(tasks.status, "archived"))
      .get();
    if (!secondTask) throw new Error("Tuesday occurrence was not inserted");
    const tuesday = new Date("2026-08-04T16:00:00Z");

    const concurrentResults = await Promise.all([
      completeTask(
        db as unknown as Database,
        secondTask.id,
        "complete-tuesday-a",
        tuesday,
      ),
      completeTask(
        db as unknown as Database,
        secondTask.id,
        "complete-tuesday-b",
        tuesday,
      ),
    ]);

    expect(
      concurrentResults.map((result) => result.duplicate).sort(),
    ).toEqual([false, true]);
    expect(await db.select().from(taskCompletions)).toHaveLength(2);
    expect(await db.select().from(pointEntries)).toHaveLength(2);

    goal = await db
      .select()
      .from(taskAchievements)
      .where(eq(taskAchievements.id, firstTask.achievement.id))
      .get();
    expect(goal).toMatchObject({
      currentStreak: 0,
      prestigeCount: 1,
      lastCompletedAt: tuesday,
    });

    const badges = await db.select().from(earnedBadges);
    const activeTuesdayCompletion = await db
      .select()
      .from(taskCompletions)
      .where(eq(taskCompletions.taskId, secondTask.id))
      .get();
    expect(badges).toEqual([
      expect.objectContaining({
        achievementId: firstTask.achievement.id,
        badgeName: "Room streak",
        prestigeLevel: 1,
        taskCompletionId: activeTuesdayCompletion?.id,
        revokedAt: null,
      }),
    ]);

    const refreshedChild = await db
      .select()
      .from(users)
      .where(eq(users.id, child.id))
      .get();
    expect(refreshedChild?.points).toBe(20);
  });

  test("rolls back every completion write when any batch statement fails", async () => {
    for (let statementIndex = 0; statementIndex < 6; statementIndex += 1) {
      const db = createTestDb();
      const child = await insertChild(db, `failure-${statementIndex}`);
      const [task] = await createTask(
        db as unknown as Database,
        {
          title: "Read together",
          priority: "low",
          repeat: "daily",
          assigneeId: child.id,
          achievementName: "Reading streak",
          targetStreak: 1,
        },
        new Date("2026-08-03T16:00:00Z"),
      );
      if (!task) throw new Error("Failure fixture was not inserted");

      const before = await snapshotCompletionState(db);
      db.setBatchFailureIndex(statementIndex);

      await expect(
        completeTask(
          db as unknown as Database,
          task.id,
          `complete-failure-${statementIndex}`,
          new Date("2026-08-03T20:00:00Z"),
        ),
      ).rejects.toThrow(`statement ${statementIndex}`);

      db.setBatchFailureIndex(null);
      expect(await snapshotCompletionState(db), `statement ${statementIndex}`).toEqual(
        before,
      );
    }
  });
});

describe("undoCompletion", () => {
  test("atomically cancels a one-off completion and records one negative reversal", async () => {
    const db = createTestDb();
    const child = await insertChild(db, "undo-one-off");
    const [task] = await createTask(db as unknown as Database, {
      title: "Empty dishwasher",
      priority: "medium",
      repeat: "none",
      assigneeId: child.id,
    });
    if (!task) throw new Error("Task fixture was not inserted");
    await completeTask(
      db as unknown as Database,
      task.id,
      "complete-before-undo",
      new Date("2026-08-07T20:00:00Z"),
    );
    const undoAt = new Date("2026-08-07T20:05:00Z");

    const result = await undoCompletion(
      db as unknown as Database,
      task.id,
      "doing",
      "undo-one-off",
      undoAt,
    );

    expect(result).toMatchObject({ duplicate: false });
    expect(result.task).toMatchObject({ status: "doing", completedAt: null });
    expect(result.completion).toMatchObject({
      canceledAt: undoAt,
      cancelReason: "user_undo",
    });
    expect(result.reversal).toMatchObject({
      eventId: "undo-one-off",
      delta: -5,
      reason: "completion_undone",
      taskId: task.id,
    });

    const entries = await db.select().from(pointEntries).orderBy(asc(pointEntries.id));
    expect(entries).toHaveLength(2);
    expect(result.reversal?.reversesEntryId).toBe(entries[0]?.id);
    const refreshedChild = await db
      .select()
      .from(users)
      .where(eq(users.id, child.id))
      .get();
    expect(refreshedChild?.points).toBe(0);

    const sameEventReplay = await undoCompletion(
      db as unknown as Database,
      task.id,
      "doing",
      "undo-one-off",
      undoAt,
    );
    const newEventRetry = await undoCompletion(
      db as unknown as Database,
      task.id,
      "doing",
      "undo-one-off-retry",
      undoAt,
    );
    expect(sameEventReplay.duplicate).toBe(true);
    expect(newEventRetry.duplicate).toBe(true);
    expect(await db.select().from(pointEntries)).toHaveLength(2);
  });

  test("revokes the linked badge and derives the recurring streak from remaining history", async () => {
    const db = createTestDb();
    const child = await insertChild(db, "undo-recurring");
    const monday = new Date("2026-08-03T16:00:00Z");
    const [firstTask] = await createTask(
      db as unknown as Database,
      {
        title: "Clean room",
        priority: "high",
        repeat: "daily",
        assigneeId: child.id,
        achievementName: "Room streak",
        targetStreak: 2,
      },
      monday,
    );
    if (!firstTask?.achievement) throw new Error("Recurring fixture was not inserted");
    await completeTask(
      db as unknown as Database,
      firstTask.id,
      "complete-undo-monday",
      monday,
    );
    await reconcileRecurringTasks(
      db as unknown as Database,
      new Date("2026-08-04T04:05:00Z"),
    );
    const secondTask = await db
      .select()
      .from(tasks)
      .where(ne(tasks.status, "archived"))
      .get();
    if (!secondTask) throw new Error("Tuesday occurrence was not inserted");
    const tuesday = new Date("2026-08-04T16:00:00Z");
    await completeTask(
      db as unknown as Database,
      secondTask.id,
      "complete-undo-tuesday",
      tuesday,
    );
    const undoAt = new Date("2026-08-04T20:00:00Z");

    await undoCompletion(
      db as unknown as Database,
      secondTask.id,
      "todo",
      "undo-tuesday",
      undoAt,
    );

    const activeCompletions = await db
      .select()
      .from(taskCompletions)
      .where(isNull(taskCompletions.canceledAt));
    expect(activeCompletions).toHaveLength(1);
    expect(activeCompletions[0]?.taskId).toBe(firstTask.id);
    const canceledCompletion = await db
      .select()
      .from(taskCompletions)
      .where(eq(taskCompletions.taskId, secondTask.id))
      .get();
    expect(canceledCompletion).toMatchObject({
      canceledAt: undoAt,
      cancelReason: "user_undo",
    });

    const badge = await db.select().from(earnedBadges).get();
    expect(badge).toMatchObject({
      taskCompletionId: canceledCompletion?.id,
      revokedAt: undoAt,
      revokedReason: "completion_undone",
    });
    const goal = await db
      .select()
      .from(taskAchievements)
      .where(eq(taskAchievements.id, firstTask.achievement.id))
      .get();
    expect(goal).toMatchObject({
      currentStreak: 1,
      prestigeCount: 0,
      lastCompletedAt: monday,
    });
    const refreshedChild = await db
      .select()
      .from(users)
      .where(eq(users.id, child.id))
      .get();
    expect(refreshedChild?.points).toBe(10);
  });

  test("rejects undo and restore for archived recurring history", async () => {
    const db = createTestDb();
    const child = await insertChild(db, "undo-archived");
    const [task] = await createTask(
      db as unknown as Database,
      {
        title: "Read together",
        priority: "low",
        repeat: "daily",
        assigneeId: child.id,
        achievementName: "Reading streak",
        targetStreak: 5,
      },
      new Date("2026-08-03T16:00:00Z"),
    );
    if (!task) throw new Error("Recurring fixture was not inserted");
    await completeTask(
      db as unknown as Database,
      task.id,
      "complete-before-archive",
      new Date("2026-08-03T20:00:00Z"),
    );
    await reconcileRecurringTasks(
      db as unknown as Database,
      new Date("2026-08-04T04:05:00Z"),
    );

    await expect(
      undoCompletion(
        db as unknown as Database,
        task.id,
        "todo",
        "undo-archived",
        new Date("2026-08-04T16:00:00Z"),
      ),
    ).rejects.toThrow("Archived recurring history cannot be undone");
    await expect(
      updateTaskStatus(db as unknown as Database, task.id, "todo"),
    ).rejects.toThrow("Archived recurring history cannot be restored");
  });

  test("rolls back every undo write when any batch statement fails", async () => {
    for (let statementIndex = 0; statementIndex < 6; statementIndex += 1) {
      const db = createTestDb();
      const child = await insertChild(db, `undo-failure-${statementIndex}`);
      const [task] = await createTask(
        db as unknown as Database,
        {
          title: "Read together",
          priority: "low",
          repeat: "daily",
          assigneeId: child.id,
          achievementName: "Reading streak",
          targetStreak: 1,
        },
        new Date("2026-08-03T16:00:00Z"),
      );
      if (!task) throw new Error("Failure fixture was not inserted");
      await completeTask(
        db as unknown as Database,
        task.id,
        `complete-before-undo-failure-${statementIndex}`,
        new Date("2026-08-03T20:00:00Z"),
      );

      const before = await snapshotCompletionState(db);
      db.setBatchFailureIndex(statementIndex);

      await expect(
        undoCompletion(
          db as unknown as Database,
          task.id,
          "todo",
          `undo-failure-${statementIndex}`,
          new Date("2026-08-03T20:05:00Z"),
        ),
      ).rejects.toThrow(`statement ${statementIndex}`);

      db.setBatchFailureIndex(null);
      expect(await snapshotCompletionState(db), `statement ${statementIndex}`).toEqual(
        before,
      );
    }
  });
});

import { describe, expect, test } from "bun:test";
import { asc, eq, isNull } from "drizzle-orm";
import type { Database } from "./db/client";
import {
  pointEntries,
  taskAchievements,
  taskCompletions,
  tasks,
  users,
} from "./db/schema";
import { createTestDb } from "./db/test-db";
import { completeTask, undoCompletion } from "./services/completion.service";
import { reconcileRecurringTasks } from "./services/recurrence.service";
import {
  archiveDoneTasks,
  createTask,
  getActiveTasks,
} from "./services/task.service";

describe("recurring lifecycle integration", () => {
  test("preserves daily and weekly history across rollover, replay, undo, and archive", async () => {
    const db = createTestDb();
    const now = new Date("2026-08-07T12:00:00Z");
    const [child] = await db
      .insert(users)
      .values({
        name: "Lifecycle Child",
        email: "lifecycle-child@example.com",
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
        points: 0,
        type: "child",
        username: "lifecycle-child",
      })
      .returning();
    if (!child) throw new Error("Child fixture was not inserted");

    const [daily] = await createTask(
      db as unknown as Database,
      {
        title: "Friday kitchen reset",
        priority: "high",
        repeat: "daily",
        assigneeId: child.id,
        achievementName: "Kitchen weekdays",
        targetStreak: 4,
      },
      now,
    );
    if (!daily?.achievementId) throw new Error("Daily goal was not created");

    const fridayDaily = await completeTask(
      db as unknown as Database,
      daily.id,
      "integration-daily-friday",
      new Date("2026-08-07T20:00:00Z"),
    );
    expect(fridayDaily).toMatchObject({
      duplicate: false,
      task: { status: "done", cycleDate: "2026-08-07" },
    });
    expect(
      await db.select().from(users).where(eq(users.id, child.id)).get(),
    ).toMatchObject({ points: 10 });
    expect(
      await db
        .select()
        .from(taskAchievements)
        .where(eq(taskAchievements.id, daily.achievementId))
        .get(),
    ).toMatchObject({ currentStreak: 1, prestigeCount: 0 });

    // Create the weekly goal before Monday's shared reconciliation receipt so
    // both Monday cycles are exercised in the same database timeline.
    const [weekly] = await createTask(
      db as unknown as Database,
      {
        title: "Weekly family review",
        priority: "low",
        repeat: "weekly",
        assigneeId: child.id,
        achievementName: "Weekly review streak",
        targetStreak: 4,
      },
      now,
    );
    if (!weekly?.achievementId) throw new Error("Weekly goal was not created");
    expect(weekly.cycleDate).toBe("2026-08-03");
    await completeTask(
      db as unknown as Database,
      weekly.id,
      "integration-weekly-first",
      new Date("2026-08-07T20:05:00Z"),
    );

    const saturday = new Date("2026-08-08T04:05:00Z");
    expect(await reconcileRecurringTasks(db as unknown as Database, saturday)).toMatchObject({
      duplicate: false,
      archived: 1,
      created: 1,
    });
    const dailyRowsAfterSaturday = await db
      .select()
      .from(tasks)
      .where(eq(tasks.achievementId, daily.achievementId))
      .orderBy(asc(tasks.id));
    expect(dailyRowsAfterSaturday).toHaveLength(2);
    expect(dailyRowsAfterSaturday).toEqual([
      expect.objectContaining({
        id: daily.id,
        status: "archived",
        archiveReason: "completed",
        cycleDate: "2026-08-07",
      }),
      expect.objectContaining({
        status: "todo",
        cycleDate: "2026-08-10",
      }),
    ]);
    expect(
      dailyRowsAfterSaturday.some((task) =>
        task.cycleDate === "2026-08-08" || task.cycleDate === "2026-08-09"
      ),
    ).toBe(false);
    expect(
      (await getActiveTasks(db as unknown as Database, saturday)).some(
        (task) => task.achievementId === daily.achievementId,
      ),
    ).toBe(false);

    const sunday = new Date("2026-08-09T04:05:00Z");
    expect(await reconcileRecurringTasks(db as unknown as Database, sunday)).toMatchObject({
      duplicate: false,
      archived: 0,
      created: 0,
    });

    const preparedMondayDaily = dailyRowsAfterSaturday[1];
    if (!preparedMondayDaily) throw new Error("Monday daily row was not prepared");
    const monday = new Date("2026-08-10T04:05:00Z");
    const mondayResult = await reconcileRecurringTasks(
      db as unknown as Database,
      monday,
    );
    expect(mondayResult).toMatchObject({
      duplicate: false,
      archived: 1,
      created: 1,
    });
    const visibleMondayTasks = await getActiveTasks(
      db as unknown as Database,
      monday,
    );
    expect(
      visibleMondayTasks.filter(
        (task) => task.achievementId === daily.achievementId,
      ),
    ).toEqual([
      expect.objectContaining({
        id: preparedMondayDaily.id,
        cycleDate: "2026-08-10",
      }),
    ]);

    const mondayDaily = await completeTask(
      db as unknown as Database,
      preparedMondayDaily.id,
      "integration-daily-monday",
      new Date("2026-08-10T16:00:00Z"),
    );
    expect(mondayDaily.duplicate).toBe(false);
    expect(
      await db
        .select()
        .from(taskAchievements)
        .where(eq(taskAchievements.id, daily.achievementId))
        .get(),
    ).toMatchObject({ currentStreak: 2, prestigeCount: 0 });

    const mondayWeekly = visibleMondayTasks.find(
      (task) => task.achievementId === weekly.achievementId,
    );
    if (!mondayWeekly) throw new Error("Next weekly occurrence was not created");
    expect(mondayWeekly).toMatchObject({ cycleDate: "2026-08-10", status: "todo" });
    await completeTask(
      db as unknown as Database,
      mondayWeekly.id,
      "integration-weekly-second",
      new Date("2026-08-10T16:05:00Z"),
    );
    expect(
      await db
        .select()
        .from(taskAchievements)
        .where(eq(taskAchievements.id, weekly.achievementId))
        .get(),
    ).toMatchObject({ currentStreak: 2, prestigeCount: 0 });

    const countsBeforeReplay = {
      tasks: (await db.select().from(tasks)).length,
      completions: (await db.select().from(taskCompletions)).length,
      entries: (await db.select().from(pointEntries)).length,
    };
    expect(
      await completeTask(
        db as unknown as Database,
        preparedMondayDaily.id,
        "integration-daily-monday",
        new Date("2026-08-10T16:10:00Z"),
      ),
    ).toMatchObject({ duplicate: true });
    expect(
      await reconcileRecurringTasks(db as unknown as Database, monday),
    ).toMatchObject({ duplicate: true, archived: 0, created: 0 });
    expect({
      tasks: (await db.select().from(tasks)).length,
      completions: (await db.select().from(taskCompletions)).length,
      entries: (await db.select().from(pointEntries)).length,
    }).toEqual(countsBeforeReplay);

    const undone = await undoCompletion(
      db as unknown as Database,
      preparedMondayDaily.id,
      "todo",
      "integration-daily-monday-undo",
      new Date("2026-08-10T17:00:00Z"),
    );
    expect(undone).toMatchObject({
      duplicate: false,
      task: { status: "todo", completedAt: null },
      completion: { canceledAt: new Date("2026-08-10T17:00:00Z") },
      reversal: { delta: -10, reason: "completion_undone" },
    });
    expect(
      await db
        .select()
        .from(taskAchievements)
        .where(eq(taskAchievements.id, daily.achievementId))
        .get(),
    ).toMatchObject({ currentStreak: 1, prestigeCount: 0 });
    expect(
      await db.select().from(users).where(eq(users.id, child.id)).get(),
    ).toMatchObject({ points: 12 });
    expect(
      await db
        .select()
        .from(taskCompletions)
        .where(isNull(taskCompletions.canceledAt)),
    ).toHaveLength(3);

    const [oneOff] = await createTask(db as unknown as Database, {
      title: "One-off donation box",
      priority: "medium",
      repeat: "none",
      assigneeId: child.id,
    });
    if (!oneOff) throw new Error("One-off task was not created");
    await completeTask(
      db as unknown as Database,
      oneOff.id,
      "integration-one-off",
      new Date("2026-08-10T18:00:00Z"),
    );
    const recurringBeforeArchive = await db
      .select()
      .from(tasks)
      .where(eq(tasks.achievementId, weekly.achievementId))
      .orderBy(asc(tasks.id));

    await archiveDoneTasks(db as unknown as Database);

    expect(
      await db.select().from(tasks).where(eq(tasks.id, oneOff.id)).get(),
    ).toMatchObject({ status: "archived", achievementId: null });
    expect(
      await db
        .select()
        .from(tasks)
        .where(eq(tasks.achievementId, weekly.achievementId))
        .orderBy(asc(tasks.id)),
    ).toEqual(recurringBeforeArchive);
  });
});

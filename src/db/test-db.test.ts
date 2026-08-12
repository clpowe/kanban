import { expect, test } from "bun:test";
import {
  earnedBadges,
  pointEntries,
  rolloverRuns,
  taskAchievements,
  taskCompletions,
  tasks,
  users,
} from "./schema";
import { createTestDb } from "./test-db";
import { eq, sql } from "drizzle-orm";

test("creates a migrated database with both 0009 migrations", async () => {
  const db = createTestDb();

  expect(await db.select().from(tasks)).toEqual([]);
  expect(await db.select().from(taskAchievements)).toEqual([]);
});

test("exposes D1-like batch() for service tests", async () => {
  const db = createTestDb();

  await db.batch([
    db.insert(tasks).values({
      title: "Empty dishwasher",
      priority: "medium",
      value: 5,
      repeat: "none",
    }),
  ]);

  expect(await db.select().from(tasks)).toEqual([
    expect.objectContaining({
      title: "Empty dishwasher",
      priority: "medium",
      value: 5,
      repeat: "none",
      status: "todo",
    }),
  ]);
});

test("rolls back every batch statement when a later statement fails", async () => {
  const db = createTestDb();
  const now = new Date("2026-08-03T16:00:00Z");
  await db.insert(users).values({
    name: "Existing child",
    email: "existing-batch@example.com",
    emailVerified: true,
    createdAt: now,
    updatedAt: now,
    points: 0,
    type: "child",
    username: "existing-batch",
  });

  await expect(
    db.batch([
      db.insert(tasks).values({
        title: "Must roll back",
        priority: "low",
        value: 1,
        repeat: "none",
      }),
      db.insert(users).values({
        name: "Duplicate child",
        email: "existing-batch@example.com",
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
        points: 0,
        type: "child",
        username: "duplicate-batch",
      }),
    ]),
  ).rejects.toThrow("UNIQUE constraint failed");

  expect(await db.select().from(tasks)).toEqual([]);
});

test("migrates badge completion foreign key with set-null deletion", async () => {
  const db = createTestDb();

  const foreignKeys = await db.all(sql`PRAGMA foreign_key_list(earned_badges)`);

  expect(foreignKeys).toContainEqual(
    expect.objectContaining({
      table: "task_completions",
      from: "task_completion_id",
      on_delete: "SET NULL",
    }),
  );
});
test("creates a migrated database with ledger tables and badge fields", async () => {
  const db = createTestDb();

  expect(await db.select().from(taskCompletions)).toEqual([]);
  expect(await db.select().from(pointEntries)).toEqual([]);
  expect(await db.select().from(earnedBadges)).toEqual([]);
});

test("creates recurring goal configuration and rollover receipt tables", async () => {
  const db = createTestDb();

  expect(await db.select().from(rolloverRuns)).toEqual([]);
  expect(await db.select().from(taskAchievements)).toEqual([]);

  const taskIndexes = await db.all(sql`PRAGMA index_list(tasks)`);
  const badgeIndexes = await db.all(sql`PRAGMA index_list(earned_badges)`);

  expect(taskIndexes).toContainEqual(
    expect.objectContaining({ name: "tasks_one_active_achievement_unique", unique: 1 }),
  );
  expect(badgeIndexes).toContainEqual(
    expect.objectContaining({ name: "earned_badges_completion_unique", unique: 1 }),
  );
});

test("upgrades a 0012 database without deleting ambiguous legacy history", async () => {
  const db = createTestDb({ through: "0012_task_ledger" });
  const now = new Date("2026-08-12T16:00:00Z");

  const [child] = await db
    .insert(users)
    .values({
      name: "Sam",
      email: "sam@example.com",
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
      points: 42,
      type: "child",
      username: "sam",
    })
    .returning();
  if (!child) throw new Error("Child fixture was not inserted");

  const [activeTask] = await db
    .insert(tasks)
    .values({
      title: "Clean room",
      priority: "medium",
      value: 5,
      status: "todo",
      repeat: "daily",
      assigneeId: child.id,
    })
    .returning();
  if (!activeTask) throw new Error("Active task fixture was not inserted");

  const activeGoalId = 101;
  const archivedGoalId = 102;
  const nowSeconds = Math.floor(now.getTime() / 1000);
  await db.run(sql`
    INSERT INTO task_achievements (
      id, task_id, name, target_streak, current_streak, prestige_count,
      missed_days_in_a_row, created_at, updated_at
    ) VALUES (
      ${activeGoalId}, ${activeTask.id}, 'Room streak', 20, 0, 0, 0,
      ${nowSeconds}, ${nowSeconds}
    )
  `);

  const [archivedTask] = await db
    .insert(tasks)
    .values({
      title: "Weekly bins",
      priority: "high",
      value: 10,
      status: "archived",
      repeat: "weekly",
      assigneeId: child.id,
    })
    .returning();
  if (!archivedTask) throw new Error("Archived task fixture was not inserted");

  await db.run(sql`
    INSERT INTO task_achievements (
      id, task_id, name, target_streak, current_streak, prestige_count,
      missed_days_in_a_row, created_at, updated_at
    ) VALUES (
      ${archivedGoalId}, ${archivedTask.id}, 'Bins streak', 8, 0, 0, 0,
      ${nowSeconds}, ${nowSeconds}
    )
  `);
  await db
    .update(tasks)
    .set({ achievementId: archivedGoalId })
    .where(eq(tasks.id, archivedTask.id));

  await db.insert(earnedBadges).values([
    {
      userId: child.id,
      achievementId: activeGoalId,
      badgeName: "Room streak",
      prestigeLevel: 1,
      earnedAt: now,
    },
    {
      userId: child.id,
      achievementId: activeGoalId,
      badgeName: "Room streak",
      prestigeLevel: 1,
      earnedAt: now,
    },
  ]);

  db.applyMigrations({ after: "0012_task_ledger" });

  const upgradedTask = await db
    .select()
    .from(tasks)
    .where(eq(tasks.id, activeTask.id))
    .get();
  const upgradedGoal = await db
    .select()
    .from(taskAchievements)
    .where(eq(taskAchievements.id, activeGoalId))
    .get();

  expect(upgradedTask).toMatchObject({
    achievementId: activeGoalId,
    repeat: "daily",
  });
  expect(upgradedTask?.cycleDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  expect(upgradedGoal).toMatchObject({
    recurrenceKey: `legacy:${activeGoalId}`,
    cadence: "daily",
    taskTitle: "Clean room",
    taskPriority: "medium",
    taskValue: 5,
    assigneeId: child.id,
    streakEnabled: true,
    active: true,
  });
  expect(await db.select().from(earnedBadges)).toHaveLength(2);
  expect(await db.select().from(pointEntries)).toEqual([]);
  expect(await db.all(sql`PRAGMA foreign_key_check`)).toEqual([]);
});

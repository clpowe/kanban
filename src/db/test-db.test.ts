import { expect, test } from "bun:test";
import { earnedBadges, pointEntries, taskAchievements, taskCompletions, tasks } from "./schema";
import { createTestDb } from "./test-db";
import { sql } from "drizzle-orm";

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

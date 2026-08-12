import { expect, test } from "bun:test";
import { createTableRelationsHelpers } from "drizzle-orm";
import * as schema from "./schema";
import {
  earnedBadges,
  earnedBadgesRelations,
  pointEntries,
  rewards,
  taskAchievementsRelations,
  taskCompletions,
  tasks,
  usersRelations,
  tasksRelations,
} from "./schema";

test("tasks schema exposes the id column as tasks.id", () => {
  expect(tasks.id).toBeDefined();
  expect(tasks.status).toBeDefined();
});

test("rewards schema exposes catalog label and cost columns for the service layer to use", () => {
  expect(rewards.name).toBeDefined();
  expect(rewards.value).toBeDefined();
});

test("task completions schema exposes ledger columns", () => {
  expect(taskCompletions.completedOn).toBeDefined();
  expect(taskCompletions.achievementId).toBeDefined();
});

test("point entries schema exposes point deltas", () => {
  expect(pointEntries.delta).toBeDefined();
});

test("earned badges schema exposes revocation fields", () => {
  expect(earnedBadges.revokedAt).toBeDefined();
  expect(earnedBadges.revokedReason).toBeDefined();
  expect(earnedBadges.taskCompletionId).toBeDefined();
});

test("users relations expose ledger rows", () => {
  const config = usersRelations.config(createTableRelationsHelpers(usersRelations.table));

  expect(config.completions).toBeDefined();
  expect(config.pointEntries).toBeDefined();
});

test("tasks relations expose completion history", () => {
  const config = tasksRelations.config(createTableRelationsHelpers(tasksRelations.table));

  expect(config.completions).toBeDefined();
});

test("task achievement relations expose ledger rows", () => {
  const config = taskAchievementsRelations.config(
    createTableRelationsHelpers(taskAchievementsRelations.table),
  );

  expect(config.completions).toBeDefined();
  expect(config.pointEntries).toBeDefined();
});

test("earned badge relations expose source completion", () => {
  const config = earnedBadgesRelations.config(
    createTableRelationsHelpers(earnedBadgesRelations.table),
  );

  expect(config.taskCompletion).toBeDefined();
});

test("task achievements expose stable recurring goal configuration", () => {
  const { taskAchievements } = schema;

  expect(taskAchievements.recurrenceKey).toBeDefined();
  expect(taskAchievements.cadence).toBeDefined();
  expect(taskAchievements.taskTitle).toBeDefined();
  expect(taskAchievements.taskPriority).toBeDefined();
  expect(taskAchievements.taskValue).toBeDefined();
  expect(taskAchievements.assigneeId).toBeDefined();
  expect(taskAchievements.streakEnabled).toBeDefined();
  expect(taskAchievements.active).toBeDefined();
});

test("rollover runs expose idempotency receipt columns", () => {
  const rolloverRuns = (schema as Record<string, any>).rolloverRuns;

  expect(rolloverRuns).toBeDefined();
  expect(rolloverRuns.rolloverType).toBeDefined();
  expect(rolloverRuns.cycleKey).toBeDefined();
  expect(rolloverRuns.startedAt).toBeDefined();
  expect(rolloverRuns.completedAt).toBeDefined();
});

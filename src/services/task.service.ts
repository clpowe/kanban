import { and, eq, isNull, lte, ne, or, sql } from "drizzle-orm";
import { earnedBadges, tasks, users, taskAchievements } from "../db/schema";
import type { TaskUpdate } from "../types";
import {
  getEligibleDailyCycleKey,
  getNewYorkDateKey,
  getNewYorkWeekKey,
  getNextEligibleDailyCycleKey,
} from "../utils/new-york-time";
import { type TaskStatus } from "../utils/task-status";
import type { Database } from "../db/client";

export type StreakMilestone = {
  achievementId: number;
  badgeName: string;
  streak: number;
  prestigeLevel: number;
};

const priorityPoints = {
  high: 10,
  medium: 5,
  low: 1,
} as const;

type TaskPriority = keyof typeof priorityPoints;
type TaskCadence = "daily" | "weekly" | "none";

type CreateTaskInput = {
  title?: unknown;
  priority?: unknown;
  value?: unknown;
  repeat?: unknown;
  assigneeId?: unknown;
  achievementName?: unknown;
  targetStreak?: unknown;
  streakEnabled?: unknown;
};

function parsePriority(value: unknown): TaskPriority {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }

  throw new Error("Invalid task priority");
}

function parseCadence(value: unknown): TaskCadence {
  if (value === "daily" || value === "weekly" || value === "none") {
    return value;
  }

  throw new Error("Invalid task repeat cadence");
}

function parseAssigneeId(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("Invalid task assignee");
  }

  return parsed;
}

export const getActiveTasks = async (db: Database, now: Date = new Date()) => {
  const todayKey = getNewYorkDateKey(now);
  const result = await db
    .select({
      task: tasks,
      achievement: taskAchievements,
    })
    .from(tasks)
    .leftJoin(taskAchievements, eq(tasks.achievementId, taskAchievements.id))
    .where(
      and(
        ne(tasks.status, "archived"),
        or(isNull(tasks.cycleDate), lte(tasks.cycleDate, todayKey)),
      ),
    );

  return result.map((r: any) => ({
    ...r.task,
    achievement: r.achievement,
  }));
};

export const getArchivedTasks = async (db: Database, assigneeId?: number | null) => {
  if (assigneeId) {
    return db
      .select()
      .from(tasks)
      .where(and(eq(tasks.status, "archived"), eq(tasks.assigneeId, assigneeId)));
  }

  return db.select().from(tasks).where(eq(tasks.status, "archived"));
};

export const getTaskById = async (db: Database, id: number) => {
  const r = await db
    .select({
      task: tasks,
      achievement: taskAchievements,
    })
    .from(tasks)
    .leftJoin(taskAchievements, eq(tasks.achievementId, taskAchievements.id))
    .where(eq(tasks.id, id))
    .get();
  if (!r) return null;
  return {
    ...r.task,
    achievement: r.achievement,
  };
};

export const createTask = async (
  db: Database,
  data: CreateTaskInput,
  now: Date = new Date(),
) => {
  const title = typeof data.title === "string" ? data.title.trim() : "";
  if (!title) throw new Error("Task title is required");

  const priority = parsePriority(data.priority);
  const repeat = parseCadence(data.repeat);
  const assigneeId = parseAssigneeId(data.assigneeId);

  if (assigneeId !== null) {
    const assignee = await db
      .select()
      .from(users)
      .where(eq(users.id, assigneeId))
      .get();

    if (!assignee) {
      throw new Error("Task assignee was not found");
    }
    if (assignee.type === "parent") {
      throw new Error("Tasks cannot be assigned to parents");
    }
  }

  if (repeat === "none") {
    const [insertedTask] = await db
      .insert(tasks)
      .values({
        title,
        priority,
        value: priorityPoints[priority],
        repeat,
        status: "todo",
        assigneeId,
      })
      .returning();

    if (!insertedTask) throw new Error("Failed to create task");
    return [await getTaskById(db, insertedTask.id)];
  }

  const recurrenceKey = `recurrence:${crypto.randomUUID()}`;
  const achievementName =
    typeof data.achievementName === "string" ? data.achievementName.trim() : "";
  const streakEnabled =
    typeof data.streakEnabled === "boolean"
      ? data.streakEnabled
      : achievementName.length > 0;
  const targetStreak =
    data.targetStreak === undefined || data.targetStreak === null || data.targetStreak === ""
      ? 20
      : Number(data.targetStreak);

  if (!Number.isInteger(targetStreak) || targetStreak <= 0) {
    throw new Error("Target streak must be a positive integer");
  }
  if (streakEnabled && !achievementName) {
    throw new Error("Streak name is required when streak tracking is enabled");
  }

  const cycleDate =
    repeat === "daily"
      ? (getEligibleDailyCycleKey(now) ?? getNextEligibleDailyCycleKey(now))
      : getNewYorkWeekKey(now);
  const taskValue = priorityPoints[priority];

  const insertGoal = db.insert(taskAchievements).values({
    recurrenceKey,
    cadence: repeat,
    taskTitle: title,
    taskPriority: priority,
    taskValue,
    assigneeId,
    streakEnabled,
    active: true,
    name: achievementName || `${title} Streak`,
    targetStreak,
    currentStreak: 0,
    prestigeCount: 0,
    createdAt: now,
    updatedAt: now,
  });

  const insertOccurrence = db.insert(tasks).values({
    title,
    priority,
    value: taskValue,
    repeat,
    status: "todo",
    assigneeId,
    achievementId: sql<number>`(
      select ${taskAchievements.id}
      from ${taskAchievements}
      where ${taskAchievements.recurrenceKey} = ${recurrenceKey}
    )`,
    cycleDate,
  });

  await db.batch([insertGoal, insertOccurrence]);

  const insertedTask = await db
    .select({ id: tasks.id })
    .from(tasks)
    .innerJoin(taskAchievements, eq(tasks.achievementId, taskAchievements.id))
    .where(eq(taskAchievements.recurrenceKey, recurrenceKey))
    .get();

  if (!insertedTask) throw new Error("Failed to create recurring task");
  return [await getTaskById(db, insertedTask.id)];
};

export const updateTask = async (db: Database, id: number, updates: TaskUpdate) => {
  if (updates.assigneeId) {
    const assignee = await db.select().from(users).where(eq(users.id, updates.assigneeId)).get();
    if (assignee && assignee.type === "parent") {
      throw new Error("Tasks cannot be assigned to parents");
    }
  }

  await db.update(tasks).set(updates).where(eq(tasks.id, id));
};

export const updateTaskStatus = async (
  db: Database,
  id: number,
  status: TaskStatus,
  now: Date = new Date(),
): Promise<{ milestone: StreakMilestone | null }> => {
  const existing = await db.select().from(tasks).where(eq(tasks.id, id)).get();

  if (!existing) return { milestone: null };

  const prevStatus = existing.status;
  const nextStatus = status ?? prevStatus;

  if (
    nextStatus === "done" &&
    existing.cycleDate &&
    existing.cycleDate > getNewYorkDateKey(now)
  ) {
    throw new Error(`Task is not available until ${existing.cycleDate}`);
  }

  if (prevStatus !== "done" && nextStatus === "done") {
    throw new Error("Task completion requires an event ID");
  }

  const assigneeId = existing.assigneeId;
  const value = existing.value ?? 0;

  // update task status first
  await db.update(tasks).set({ status }).where(eq(tasks.id, id));

  // no assignee → nothing to do for score or achievements
  if (!assigneeId) return { milestone: null };

  let milestone: StreakMilestone | null = null;

  // UNDO DONE → subtract score and revert achievements/streaks
  if (prevStatus === "done" && nextStatus !== "done" && nextStatus !== "archived") {
    // 1. Revert points
    await db
      .update(users)
      .set({
        points: sql`${users.points} - ${value}`,
      })
      .where(eq(users.id, assigneeId));

    // 2. Revert Streak
    const achievement = await db
      .select()
      .from(taskAchievements)
      .where(eq(taskAchievements.id, existing.achievementId ?? -1))
      .get();

    if (achievement) {
      const undoesLatestCompletion =
        achievement.prevStreak != null &&
        achievement.lastCompletedAt != null &&
        getNewYorkDateKey(new Date(achievement.lastCompletedAt)) === getNewYorkDateKey(now);

      if (undoesLatestCompletion) {
        let prestigeCount = achievement.prestigeCount ?? 0;

        // If that completion earned a badge, take it back too.
        const earnedBadgeOnCompletion =
          prestigeCount > 0 &&
          achievement.targetStreak > 0 &&
          achievement.currentStreak === 0 &&
          (achievement.prevStreak ?? 0) + 1 >= achievement.targetStreak;

        if (earnedBadgeOnCompletion) {
          await db
            .delete(earnedBadges)
            .where(
              and(
                eq(earnedBadges.achievementId, achievement.id),
                eq(earnedBadges.userId, assigneeId),
                eq(earnedBadges.prestigeLevel, prestigeCount),
              ),
            );
          prestigeCount -= 1;
        }

        await db
          .update(taskAchievements)
          .set({
            currentStreak: achievement.prevStreak ?? 0,
            lastCompletedAt: achievement.prevLastCompletedAt ?? null,
            missedDaysInARow: achievement.prevMissedDaysInARow ?? 0,
            prestigeCount,
            // Clear the snapshot so a repeated undo can't rewind twice.
            prevStreak: null,
            prevLastCompletedAt: null,
            prevMissedDaysInARow: null,
            updatedAt: now,
          })
          .where(eq(taskAchievements.id, achievement.id));
      }
    }
  }

  return { milestone };
};

export const archiveDoneTasks = async (db: Database) => {
  await db
    .update(tasks)
    .set({ status: "archived" })
    .where(and(eq(tasks.status, "done"), isNull(tasks.achievementId)));
};

export const deleteTask = async (db: Database, id: number) => {
  await db.delete(tasks).where(eq(tasks.id, id));
};

import { and, eq, ne, sql } from "drizzle-orm";
import { tasks, users, taskAchievements, earnedBadges } from "../db/schema";
import type { TaskUpdate } from "../types";
import { getNewYorkDateKey } from "../utils/new-york-time";
import { type TaskStatus } from "../utils/task-status";
import { applyCompletionToStreak } from "./streak";

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

export const getActiveTasks = async (db: any) => {
  const result = await db
    .select({
      task: tasks,
      achievement: taskAchievements,
    })
    .from(tasks)
    .leftJoin(taskAchievements, eq(tasks.id, taskAchievements.taskId))
    .where(ne(tasks.status, "archived"));

  return result.map((r: any) => ({
    ...r.task,
    achievement: r.achievement,
  }));
};

export const getArchivedTasks = async (db: any, assigneeId?: number | null) => {
  if (assigneeId) {
    return db
      .select()
      .from(tasks)
      .where(and(eq(tasks.status, "archived"), eq(tasks.assigneeId, assigneeId)));
  }

  return db.select().from(tasks).where(eq(tasks.status, "archived"));
};

export const getTaskById = async (db: any, id: number) => {
  const r = await db
    .select({
      task: tasks,
      achievement: taskAchievements,
    })
    .from(tasks)
    .leftJoin(taskAchievements, eq(tasks.id, taskAchievements.taskId))
    .where(eq(tasks.id, id))
    .get();
  if (!r) return null;
  return {
    ...r.task,
    achievement: r.achievement,
  };
};

export const createTask = async (db: any, data: any) => {
  const priority = data.priority as keyof typeof priorityPoints;

  // Validate assignee is not a parent
  if (data.assigneeId) {
    const assignee = await db
      .select()
      .from(users)
      .where(eq(users.id, Number(data.assigneeId)))
      .get();
    if (assignee && assignee.type === "parent") {
      throw new Error("Tasks cannot be assigned to parents");
    }
  }

  const [insertedTask] = await db
    .insert(tasks)
    .values({
      title: data.title,
      priority,
      value: priorityPoints[priority],
      repeat: data.repeat,
      status: "todo",
      assigneeId: data.assigneeId ? Number(data.assigneeId) : null,
    })
    .returning();

  if (
    data.achievementName?.trim() &&
    data.targetStreak &&
    (data.repeat === "daily" || data.repeat === "weekly")
  ) {
    await db.insert(taskAchievements).values({
      taskId: insertedTask.id,
      name: data.achievementName.trim(),
      targetStreak: Number(data.targetStreak),
      currentStreak: 0,
      prestigeCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  return [await getTaskById(db, insertedTask.id)];
};

export const updateTask = async (db: any, id: number, updates: TaskUpdate) => {
  if (updates.assigneeId) {
    const assignee = await db.select().from(users).where(eq(users.id, updates.assigneeId)).get();
    if (assignee && assignee.type === "parent") {
      throw new Error("Tasks cannot be assigned to parents");
    }
  }

  await db.update(tasks).set(updates).where(eq(tasks.id, id));
};

export const updateTaskStatus = async (
  db: any,
  id: number,
  status: TaskStatus,
  now: Date = new Date(),
): Promise<{ milestone: StreakMilestone | null }> => {
  const existing = await db.select().from(tasks).where(eq(tasks.id, id)).get();

  if (!existing) return { milestone: null };

  const prevStatus = existing.status;
  const nextStatus = status ?? prevStatus;

  const assigneeId = existing.assigneeId;
  const value = existing.value ?? 0;

  // update task status first
  await db.update(tasks).set({ status }).where(eq(tasks.id, id));

  // no assignee → nothing to do for score or achievements
  if (!assigneeId) return { milestone: null };

  let milestone: StreakMilestone | null = null;

  // DONE → add score and handle streaks/achievements
  if (prevStatus !== "done" && nextStatus === "done") {
    // 1. Update points
    await db
      .update(users)
      .set({
        points: sql`${users.points} + ${value}`,
      })
      .where(eq(users.id, assigneeId));

    // 2. Handle Streak
    const achievement = await db
      .select()
      .from(taskAchievements)
      .where(eq(taskAchievements.taskId, id))
      .get();

    if (achievement) {
      const result = applyCompletionToStreak(
        {
          repeat: existing.repeat,
          targetStreak: achievement.targetStreak,
          currentStreak: achievement.currentStreak ?? 0,
          prestigeCount: achievement.prestigeCount ?? 0,
          lastCompletedAt: achievement.lastCompletedAt
            ? new Date(achievement.lastCompletedAt)
            : null,
        },
        now,
      );

      if (result.changed) {
        if (result.earnedBadge) {
          await db.insert(earnedBadges).values({
            userId: assigneeId,
            achievementId: achievement.id,
            badgeName: achievement.name,
            prestigeLevel: result.prestigeCount,
            earnedAt: now,
          });

          milestone = {
            achievementId: achievement.id,
            badgeName: achievement.name,
            streak: achievement.targetStreak,
            prestigeLevel: result.prestigeCount,
          };
        }

        await db
          .update(taskAchievements)
          .set({
            currentStreak: result.currentStreak,
            missedDaysInARow: 0,
            prestigeCount: result.prestigeCount,
            lastCompletedAt: result.lastCompletedAt,
            prevStreak: achievement.currentStreak ?? 0,
            prevLastCompletedAt: achievement.lastCompletedAt ?? null,
            prevMissedDaysInARow: achievement.missedDaysInARow ?? 0,
            updatedAt: now,
          })
          .where(eq(taskAchievements.id, achievement.id));
      }
    }
  }

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
      .where(eq(taskAchievements.taskId, id))
      .get();

    if (achievement) {
      const undoesLatestCompletion =
        achievement.prevStreak != null &&
        achievement.lastCompletedAt != null &&
        getNewYorkDateKey(new Date(achievement.lastCompletedAt)) ===
          getNewYorkDateKey(now);

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
            currentStreak: achievement.prevStreak,
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

export const archiveDoneTasks = async (db: any) => {
  await db.update(tasks).set({ status: "archived" }).where(eq(tasks.status, "done"));
};

export const deleteTask = async (db: any, id: number) => {
  await db.delete(tasks).where(eq(tasks.id, id));
};

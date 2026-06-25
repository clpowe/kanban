import { and, eq, ne, sql } from "drizzle-orm";
import { tasks, users, taskAchievements, earnedBadges } from "../db/schema";
import type { TaskUpdate } from "../types";
import { type TaskStatus } from "../utils/task-status";

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
      .where(
        and(eq(tasks.status, "archived"), eq(tasks.assigneeId, assigneeId)),
      );
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
    const assignee = await db
      .select()
      .from(users)
      .where(eq(users.id, updates.assigneeId))
      .get();
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
) => {
  const existing = await db.select().from(tasks).where(eq(tasks.id, id)).get();

  if (!existing) return;

  const prevStatus = existing.status;
  const nextStatus = status ?? prevStatus;

  const assigneeId = existing.assigneeId;
  const value = existing.value ?? 0;

  // update task status first
  await db.update(tasks).set({ status }).where(eq(tasks.id, id));

  // no assignee → nothing to do for score or achievements
  if (!assigneeId) return;

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
      const now = new Date();
      let currentStreak = achievement.currentStreak;
      let prestigeCount = achievement.prestigeCount;
      const lastCompletedAt = achievement.lastCompletedAt;

      if (lastCompletedAt) {
        const diffMs = now.getTime() - new Date(lastCompletedAt).getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        if (existing.repeat === "daily") {
          if (diffHours < 12) {
            // Already completed today or very recently, do not increase streak again
          } else if (diffHours <= 36) {
            // Completed yesterday (within 36h), continue streak!
            currentStreak += 1;
          } else {
            // Missed days penalty: lose 2 days of streak per missed 24h interval
            const missedDays = Math.max(1, Math.floor(diffHours / 24) - 1);
            currentStreak = Math.max(0, currentStreak - missedDays * 2) + 1; // +1 for current completion
          }
        } else if (existing.repeat === "weekly") {
          if (diffHours < 72) {
            // Too close, do not increase
          } else if (diffHours <= 240) {
            // Completed within 10 days, continue weekly streak!
            currentStreak += 1;
          } else {
            // Missed weeks penalty: lose 2 weeks of streak per missed 7-day interval
            const missedWeeks = Math.max(1, Math.floor(diffHours / 168) - 1);
            currentStreak = Math.max(0, currentStreak - missedWeeks * 2) + 1; // +1 for current completion
          }
        }
      } else {
        // First completion ever
        currentStreak = 1;
      }

      // Check if target streak is reached for completion / prestige
      if (currentStreak >= achievement.targetStreak) {
        prestigeCount += 1;
        currentStreak = 0; // reset streak to start next cycle

        // Insert into earnedBadges (Trophy Room)
        await db.insert(earnedBadges).values({
          userId: assigneeId,
          achievementId: achievement.id,
          badgeName: achievement.name,
          prestigeLevel: prestigeCount,
          earnedAt: now,
        });
      }

      await db
        .update(taskAchievements)
        .set({
          currentStreak,
          prestigeCount,
          lastCompletedAt: now,
          updatedAt: now,
        })
        .where(eq(taskAchievements.id, achievement.id));
    }
  }

  // UNDO DONE → subtract score and revert achievements/streaks
  if (
    prevStatus === "done" &&
    nextStatus !== "done" &&
    nextStatus !== "archived"
  ) {
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
      let currentStreak = achievement.currentStreak;
      let prestigeCount = achievement.prestigeCount;

      // Check if we need to undo a prestige transition
      if (currentStreak === 0 && prestigeCount > 0) {
        // Delete the earned badge for this prestige level
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
        currentStreak = achievement.targetStreak - 1;
      } else if (currentStreak > 0) {
        currentStreak -= 1;
      }

      await db
        .update(taskAchievements)
        .set({
          currentStreak,
          prestigeCount,
          updatedAt: new Date(),
        })
        .where(eq(taskAchievements.id, achievement.id));
    }
  }
};

export const archiveDoneTasks = async (db: any) => {
  await db
    .update(tasks)
    .set({ status: "archived" })
    .where(eq(tasks.status, "done"));
};

export const deleteTask = async (db: any, id: number) => {
  await db.delete(tasks).where(eq(tasks.id, id));
};

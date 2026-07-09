import { and, eq, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import { tasks, users, taskAchievements, earnedBadges } from "../db/schema";
import type { TaskUpdate } from "../types";
import { type TaskStatus } from "../utils/task-status";
import {
  countWeekdaysBetween,
  getNewYorkDateKey,
  getNextWeekdayDateKey,
} from "../utils/new-york-time";

const priorityPoints = {
  high: 10,
  medium: 5,
  low: 1,
} as const;

export const getActiveTasks = async (db: any) => {
  try {
    await rolloverPastDailyTasks(db);
  } catch (err) {
    console.error("Error rolling over past daily tasks in getActiveTasks:", err);
  }

  const result = await db
    .select({
      task: tasks,
      achievement: taskAchievements,
    })
    .from(tasks)
    .leftJoin(taskAchievements, eq(tasks.achievementId, taskAchievements.id))
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
    .leftJoin(taskAchievements, eq(tasks.achievementId, taskAchievements.id))
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

  const isRepeatable = data.repeat === "daily" || data.repeat === "weekly";

  const [insertedTask] = await db
    .insert(tasks)
    .values({
      title: data.title,
      priority,
      value: priorityPoints[priority],
      repeat: data.repeat,
      status: "todo",
      assigneeId: data.assigneeId ? Number(data.assigneeId) : null,
      cycleDate: isRepeatable ? getNewYorkDateKey() : null,
    })
    .returning();

  if (isRepeatable) {
    const [achievement] = await db
      .insert(taskAchievements)
      .values({
        taskId: insertedTask.id,
        name: data.achievementName?.trim() || `${data.title} Streak`,
        targetStreak: Number(data.targetStreak || 20),
        currentStreak: 0,
        prestigeCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    await db
      .update(tasks)
      .set({ achievementId: achievement.id })
      .where(eq(tasks.id, insertedTask.id));
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

  const now = new Date();
  // update task status first
  await db
    .update(tasks)
    .set({
      status,
      completedAt:
        prevStatus !== "done" && nextStatus === "done"
          ? now
          : nextStatus === "done"
            ? existing.completedAt
            : null,
      archiveReason:
        nextStatus === "archived" ? (existing.archiveReason ?? "manual") : null,
      archivedAt: nextStatus === "archived" ? now : null,
    })
    .where(eq(tasks.id, id));

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
    const achievement = await getTaskAchievement(db, existing);

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
          } else {
            const lastDateKey = getNewYorkDateKey(new Date(lastCompletedAt));
            const currentDateKey = getNewYorkDateKey(now);
            const weekdaysElapsed = countWeekdaysBetween(
              lastDateKey,
              currentDateKey,
            );

            if (weekdaysElapsed <= 1) {
              currentStreak += 1;
            } else {
              // Missed days penalty: lose 2 days of streak per missed weekday
              const missedDays = weekdaysElapsed - 1;
              currentStreak = Math.max(0, currentStreak - missedDays * 2) + 1; // +1 for current completion
            }
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
    const achievement = await getTaskAchievement(db, existing);

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

const getTaskAchievement = async (db: any, task: any) => {
  if (task.achievementId) {
    return db
      .select()
      .from(taskAchievements)
      .where(eq(taskAchievements.id, task.achievementId))
      .get();
  }

  return db
    .select()
    .from(taskAchievements)
    .where(eq(taskAchievements.taskId, task.id))
    .get();
};

const ensureRepeatableTaskAchievement = async (
  db: any,
  task: any,
  now: Date,
) => {
  let achievement = await getTaskAchievement(db, task);

  if (!achievement) {
    const [createdAchievement] = await db
      .insert(taskAchievements)
      .values({
        taskId: task.id,
        name: `${task.title} Streak`,
        targetStreak: 20,
        currentStreak: 0,
        prestigeCount: 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning();

    achievement = createdAchievement;
  }

  if (achievement && task.achievementId !== achievement.id) {
    await db
      .update(tasks)
      .set({ achievementId: achievement.id })
      .where(eq(tasks.id, task.id));
  }

  return achievement;
};

export const rolloverPastDailyTasks = async (db: any, now = new Date()) => {
  const todayDateKey = getNewYorkDateKey(now);

  const pastTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.repeat, "daily"),
        ne(tasks.status, "archived"),
        or(isNull(tasks.cycleDate), lt(tasks.cycleDate, todayDateKey)),
      ),
    );

  for (const task of pastTasks) {
    const achievement = await ensureRepeatableTaskAchievement(db, task, now);
    const achievementId = achievement?.id;

    if (achievementId) {
      const existingTodayTask = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.achievementId, achievementId),
            eq(tasks.cycleDate, todayDateKey),
          ),
        )
        .get();

      if (!existingTodayTask) {
        const [nextTask] = await db
          .insert(tasks)
          .values({
            title: task.title,
            priority: task.priority,
            value: task.value,
            status: "todo",
            repeat: "daily",
            assigneeId: task.assigneeId,
            achievementId,
            cycleDate: todayDateKey,
          })
          .returning();

        await db
          .update(taskAchievements)
          .set({ taskId: nextTask.id, updatedAt: now })
          .where(eq(taskAchievements.id, achievementId));
      }
    }

    await db
      .update(tasks)
      .set({
        status: "archived",
        archiveReason: task.status === "done" ? "completed" : "missed",
        archivedAt: now,
      })
      .where(eq(tasks.id, task.id));
  }
};

export const rolloverDailyTasks = async (db: any, now = new Date()) => {
  const cycleDate = getNewYorkDateKey(now);
  const nextCycleDate = getNextWeekdayDateKey(cycleDate);

  const dueTasks = await db
    .select()
    .from(tasks)
    .where(
      and(
        eq(tasks.repeat, "daily"),
        ne(tasks.status, "archived"),
        or(isNull(tasks.cycleDate), lte(tasks.cycleDate, cycleDate)),
      ),
    );

  for (const task of dueTasks) {
    const achievement = await ensureRepeatableTaskAchievement(db, task, now);
    const achievementId = achievement?.id;

    if (achievementId) {
      const existingNextTask = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.achievementId, achievementId),
            eq(tasks.cycleDate, nextCycleDate),
          ),
        )
        .get();

      if (!existingNextTask) {
        const [nextTask] = await db
          .insert(tasks)
          .values({
            title: task.title,
            priority: task.priority,
            value: task.value,
            status: "todo",
            repeat: "daily",
            assigneeId: task.assigneeId,
            achievementId,
            cycleDate: nextCycleDate,
          })
          .returning();

        await db
          .update(taskAchievements)
          .set({ taskId: nextTask.id, updatedAt: now })
          .where(eq(taskAchievements.id, achievementId));
      }
    }

    await db
      .update(tasks)
      .set({
        status: "archived",
        archiveReason: task.status === "done" ? "completed" : "missed",
        archivedAt: now,
      })
      .where(eq(tasks.id, task.id));
  }
};

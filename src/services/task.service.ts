import { and, eq, ne, sql } from "drizzle-orm";
import { tasks, users, taskAchievements } from "../db/schema";
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
  const { assigneeId, repeat } = existing;
  const value = existing.value ?? 0;

  await db.update(tasks).set({ status }).where(eq(tasks.id, id));
  if (!assigneeId) return;

  const becameDone = prevStatus !== "done" && nextStatus === "done";
  const undoneDone =
    prevStatus === "done" && nextStatus !== "done" && nextStatus !== "archived";

  if (!becameDone && !undoneDone) return;

  if (becameDone) {
    await addPoints(db, assigneeId, value);
    await advanceAchievement(db, id, repeat);
    return;
  }

  await subtractPoints(db, assigneeId, value);
  await revertAchievement(db, id);
};

const addPoints = (db: any, userId: number, value: number) =>
  db
    .update(users)
    .set({ points: sql`${users.points} + ${value}` })
    .where(eq(users.id, userId));

const subtractPoints = (db: any, userId: number, value: number) =>
  db
    .update(users)
    .set({ points: sql`${users.points} - ${value}` })
    .where(eq(users.id, userId));

const advanceAchievement = async (
  db: any,
  taskId: number,
  repeat: string | null,
) => {
  const achievement = await db
    .select()
    .from(taskAchievements)
    .where(eq(taskAchievements.taskId, taskId))
    .get();
  if (!achievement) return;

  const now = new Date();
  let currentStreak = nextStreak(achievement, repeat, now);
  let { prestigeCount } = achievement;

  if (currentStreak >= achievement.targetStreak) {
    prestigeCount += 1;
    currentStreak = 0;
  }

  await db
    .update(taskAchievements)
    .set({ currentStreak, prestigeCount, lastCompletedAt: now, updatedAt: now })
    .where(eq(taskAchievements.id, achievement.id));
};

const nextStreak = (
  achievement: { currentStreak: number; lastCompletedAt: Date | null },
  repeat: string | null,
  now: Date,
): number => {
  const { currentStreak, lastCompletedAt } = achievement;
  if (!lastCompletedAt) return 1;

  const diffHours =
    (now.getTime() - new Date(lastCompletedAt).getTime()) / (1000 * 60 * 60);

  if (repeat === "daily") {
    if (diffHours < 12) return currentStreak; // already done today
    if (diffHours <= 36) return currentStreak + 1; // continue
    return 1; // missed
  }

  if (repeat === "weekly") {
    if (diffHours < 72) return currentStreak;
    if (diffHours <= 240) return currentStreak + 1;
    return 1;
  }

  return currentStreak;
};

const revertAchievement = async (db: any, taskId: number) => {
  const achievement = await db
    .select()
    .from(taskAchievements)
    .where(eq(taskAchievements.taskId, taskId))
    .get();
  if (!achievement) return;

  let { currentStreak, prestigeCount } = achievement;

  if (currentStreak > 0) {
    currentStreak -= 1;
  } else if (prestigeCount > 0) {
    prestigeCount -= 1;
    currentStreak = achievement.targetStreak - 1;
  }

  await db
    .update(taskAchievements)
    .set({ currentStreak, prestigeCount, updatedAt: new Date() })
    .where(eq(taskAchievements.id, achievement.id));
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

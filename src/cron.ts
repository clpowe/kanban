import { and, eq, ne } from "drizzle-orm";
import { tasks, taskAchievements } from "./db/schema";
import { getDB, type Env } from "./db/client";
import { archiveDoneTasks } from "./services/task.service";
import { dailyReset } from "./services/streak";
import { getNewYorkDateKey } from "./utils/new-york-time";

export const resetDailyTasks = async (env: Env, now = new Date()) => {
  const db = getDB(env.Bindings);
  const endedDateKey = getNewYorkDateKey(now);

  const activeDailyTask = and(
    eq(tasks.repeat, "daily"),
    ne(tasks.status, "archived"),
  );

  const rows = await db
    .select({ achievement: taskAchievements })
    .from(taskAchievements)
    .innerJoin(tasks, eq(taskAchievements.taskId, tasks.id))
    .where(activeDailyTask);

  for (const { achievement } of rows) {
    const result = dailyReset(
      {
        streakCount: achievement.currentStreak ?? 0,
        lastCompletedDate: achievement.lastCompletedAt
          ? new Date(achievement.lastCompletedAt)
          : null,
        missedDaysInARow: achievement.missedDaysInARow ?? 0,
      },
      endedDateKey,
    );

    if (result.changed) {
      await db
        .update(taskAchievements)
        .set({
          currentStreak: result.state.streakCount,
          missedDaysInARow: result.state.missedDaysInARow,
          updatedAt: now,
        })
        .where(eq(taskAchievements.id, achievement.id));
    }
  }

  await db
    .update(tasks)
    .set({ status: "todo" })
    .where(activeDailyTask);

  console.log(`[CRON] Daily rollover completed for ${endedDateKey}`);
};

export const rolloverDailyTasks = resetDailyTasks;

export const archiveCompletedTasks = async (env: Env) => {
  const db = getDB(env.Bindings);

  await archiveDoneTasks(db);

  console.log("[CRON] Weekly completed tasks archived");
};

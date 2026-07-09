import { tasks, taskAchievements } from './db/schema'
import { getDB, type Env } from './db/client'
import { eq } from 'drizzle-orm'
import { archiveDoneTasks } from './services/task.service'
import { dailyReset, startOfUTCDay } from './services/streak'

// End-of-day sweep for daily tasks: track missed days, break streaks after
// two consecutive misses, then reset statuses back to "todo".
export const resetDailyTasks = async (env: Env) => {
  const db = getDB(env.Bindings)
  const now = new Date()
  // The cron fires at UTC midnight, so the day being closed out is the
  // previous UTC calendar day.
  const endedDay = new Date(startOfUTCDay(now) - 1)

  const rows = await db
    .select({ achievement: taskAchievements })
    .from(taskAchievements)
    .innerJoin(tasks, eq(taskAchievements.taskId, tasks.id))
    .where(eq(tasks.repeat, 'daily'))

  for (const { achievement } of rows) {
    const result = dailyReset(
      {
        streakCount: achievement.currentStreak ?? 0,
        lastCompletedDate: achievement.lastCompletedAt
          ? new Date(achievement.lastCompletedAt)
          : null,
        missedDaysInARow: achievement.missedDaysInARow ?? 0
      },
      endedDay
    )

    if (result.changed) {
      await db
        .update(taskAchievements)
        .set({
          currentStreak: result.state.streakCount,
          missedDaysInARow: result.state.missedDaysInARow,
          updatedAt: now
        })
        .where(eq(taskAchievements.id, achievement.id))

      if (result.streakBroken) {
        console.log(
          `[CRON] Streak broken for achievement ${achievement.id} after 2 missed days`
        )
      }
    }
  }

  await db
    .update(tasks)
    .set({ status: 'todo' })
    .where(eq(tasks.repeat, 'daily'))

  console.log('[CRON] Daily tasks reset → todo')
}

export const archiveCompletedTasks = async (env: Env) => {
  const db = getDB(env.Bindings)

  await archiveDoneTasks(db)

  console.log('[CRON] Weekly completed tasks archived')
}

import { tasks } from './db/schema'
import { getDB, type Env } from './db/client'
import { eq } from 'drizzle-orm'
import { archiveDoneTasks } from './services/task.service'

// reset all daily tasks to "todo"
export const resetDailyTasks = async (env: Env) => {
  const db = getDB(env.Bindings)
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

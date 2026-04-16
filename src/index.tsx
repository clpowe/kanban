import { Hono } from 'hono'
import { users } from './db/schema.ts'
import { type Env, getDB } from './db/client.ts'
import { Layout } from './components/Layout.tsx'
import { taskRoutes } from './routes/tasks.tsx'
import { archivedRoutes } from './routes/archived.tsx'
import { rewardRoutes } from './routes/rewards.tsx'
import { userRoutes } from './routes/users.tsx'
import { sessionRoutes } from './routes/session.tsx'
import { authMiddleware, requireAuthenticatedUser } from './auth/middleware.ts'
import { archiveCompletedTasks, resetDailyTasks } from './cron.ts'

const app = new Hono<Env>()

app.use('/*', authMiddleware)

app.get('/', async (c) => {
  const authUser = requireAuthenticatedUser(c)
  const db = getDB(c.env)
  const usersRes = await db.select().from(users)

  return c.html(
    <Layout activeUser={authUser} users={usersRes} currentPage='board'>
      <main class='grid items-start gap-6 grid-cols-1 '>
        <section
          class='min-w-0'
          id='tasks-container'
          hx-get='/tasks'
          hx-trigger='load, refreshTasks from:body, every 30s'
          hx-swap='innerHTML'
        ></section>
      </main>
    </Layout>
  )
})

taskRoutes(app)
archivedRoutes(app)
rewardRoutes(app)
userRoutes(app)
sessionRoutes(app)

type ScheduledDeps = {
  resetDailyTasks: typeof resetDailyTasks
  archiveCompletedTasks: typeof archiveCompletedTasks
}

const scheduledDeps: ScheduledDeps = {
  resetDailyTasks,
  archiveCompletedTasks
}

export const handleScheduled = async (
  controller: ScheduledController,
  env: Env['Bindings'],
  deps: ScheduledDeps = scheduledDeps
) => {
  console.log('[CRON] triggered', controller.cron)

  if (controller.cron === '0 0 * * *') {
    await deps.resetDailyTasks({ Bindings: env } as Env)
  }

  if (controller.cron === '59 23 * * 6') {
    await deps.archiveCompletedTasks({ Bindings: env } as Env)
  }
}

export default {
  fetch: app.fetch,

  async scheduled(controller: ScheduledController, env: Env) {
    try {
      await handleScheduled(controller, env.Bindings)
    } catch (err) {
      console.error('[CRON ERROR]', err)
      throw err
    }
  }
}

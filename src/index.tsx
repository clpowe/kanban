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
  try {
    const response = await c.env.ASSETS.fetch(new URL('/index.html', c.req.url))
    return new Response(response.body, response)
  } catch (err) {
    console.error('Failed to load asset index.html:', err)
    return c.text('Not Found', 404)
  }
})

app.get('/archived', async (c) => {
  try {
    const response = await c.env.ASSETS.fetch(new URL('/index.html', c.req.url))
    return new Response(response.body, response)
  } catch (err) {
    console.error('Failed to load asset index.html:', err)
    return c.text('Not Found', 404)
  }
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

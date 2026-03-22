import { Hono } from 'hono'
import { users } from './db/schema.ts'
import { type Env, getDB } from './db/client.ts'
import { Layout } from './components/Layout.tsx'
import { taskRoutes } from './routes/tasks.tsx'
import { rewardRoutes } from './routes/rewards.tsx'
import { userRoutes } from './routes/users.tsx'
import { sessionRoutes } from './routes/session.tsx'
import { authMiddleware, requireAuthenticatedUser } from './auth/middleware.ts'
import { resetDailyTasks } from './cron.ts'

const app = new Hono<Env>()

app.use('/*', authMiddleware)

app.get('/', async (c) => {
  const authUser = requireAuthenticatedUser(c)
  const db = getDB(c.env)
  const usersRes = await db.select().from(users)

  return c.html(
    <Layout activeUser={authUser} users={usersRes}>
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
rewardRoutes(app)
userRoutes(app)
sessionRoutes(app)

export default {
  fetch: app.fetch,

  async scheduled(controller: ScheduledController, env: Env) {
    try {
      console.log('[CRON] triggered')

      const now = new Date()
      const tampaHour = new Date(
        now.toLocaleString('en-US', { timeZone: 'America/New_York' })
      ).getHours()

      console.log('[CRON] tampaHour:', tampaHour)

      if (tampaHour === 0) {
        await resetDailyTasks(env)
      }
    } catch (err) {
      console.error('[CRON ERROR]', err)
      throw err
    }
  }
}

import { Hono } from 'hono'
import { users } from './db/schema.ts'
import { type Env, getDB } from './db/client.ts'
import { Layout } from './components/Layout.tsx'
import { TaskInputForm } from './components/TaskInputForm.tsx'
import { taskRoutes } from './routes/tasks.tsx'
import { userRoutes } from './routes/users.tsx'
import { canManageTask } from './auth/authorization.ts'
import { authMiddleware, requireAuthenticatedUser } from './auth/middleware.ts'

const app = new Hono<Env>()

app.use('/*', authMiddleware)

app.get('/', async (c) => {
  const authUser = requireAuthenticatedUser(c)
  const db = getDB(c.env)
  const usersRes = await db.select().from(users)

  return c.html(
    <Layout>
      {canManageTask(authUser) ? <TaskInputForm users={usersRes} /> : null}
      <main>
        <section
          id='tasks-container'
          hx-get='/tasks'
          hx-trigger='load, refreshTasks from:body, every 30s'
          hx-swap='innerHTML'
        ></section>
        <aside
          id='users-container'
          hx-get='/users'
          hx-trigger='load, refreshUsers from:body, every 60s'
          hx-swap='innerHTML'
        ></aside>
      </main>
    </Layout>
  )
})

taskRoutes(app)
userRoutes(app)

export default app

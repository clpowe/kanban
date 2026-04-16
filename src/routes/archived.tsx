import type { Hono } from 'hono'
import type { Context } from 'hono'
import { ArchivedTaskList } from '../components/ArchivedTaskList'
import { Layout } from '../components/Layout'
import type { Env } from '../db/client'
import { getDB } from '../db/client'
import { requireAuthenticatedUser } from '../auth/middleware'
import { getArchivedTasks } from '../services/task.service'
import { getAllUsers } from '../services/user.service'

export const parseSelectedAssigneeId = (
  rawValue: string | undefined,
  users: Awaited<ReturnType<typeof getAllUsers>>
) => {
  if (!rawValue || rawValue === 'all') {
    return null
  }

  const assigneeId = Number(rawValue)

  if (Number.isNaN(assigneeId) || !users.some((user) => user.id === assigneeId)) {
    return null
  }

  return assigneeId
}

type ArchivedRoutesDeps = {
  getDB: typeof getDB
  requireAuthenticatedUser: typeof requireAuthenticatedUser
  getAllUsers: typeof getAllUsers
  getArchivedTasks: typeof getArchivedTasks
}

const defaultDeps: ArchivedRoutesDeps = {
  getDB,
  requireAuthenticatedUser,
  getAllUsers,
  getArchivedTasks
}

export function archivedRoutes(
  app: Hono<Env>,
  deps: ArchivedRoutesDeps = defaultDeps
) {
  app.get('/archived', async (c) => {
    const authUser = deps.requireAuthenticatedUser(c as Context<Env>)
    const db = deps.getDB(c.env)
    const users = await deps.getAllUsers(db)
    const assigneeId = c.req.query('assigneeId')
    const search = new URLSearchParams()

    if (assigneeId) {
      search.set('assigneeId', assigneeId)
    }

    return c.html(
      <Layout activeUser={authUser} users={users} currentPage='archived'>
        <main class='grid grid-cols-1 items-start gap-6'>
          <section
            class='min-w-0'
            id='archived-tasks-container'
            hx-get={`/archived/tasks${search.size > 0 ? `?${search.toString()}` : ''}`}
            hx-trigger='load'
            hx-swap='innerHTML'
          ></section>
        </main>
      </Layout>
    )
  })

  app.get('/archived/tasks', async (c) => {
    const authUser = deps.requireAuthenticatedUser(c as Context<Env>)
    const db = deps.getDB(c.env)
    const users = await deps.getAllUsers(db)
    const selectedAssigneeId = parseSelectedAssigneeId(c.req.query('assigneeId'), users)
    const tasks = await deps.getArchivedTasks(db, selectedAssigneeId)

    return c.html(
      <ArchivedTaskList
        tasks={tasks}
        users={users}
        authUser={authUser}
        selectedAssigneeId={selectedAssigneeId}
      />
    )
  })
}

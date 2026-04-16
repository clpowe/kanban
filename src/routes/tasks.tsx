import { ArchivedTaskList } from '../components/ArchivedTaskList'
import { TaskList } from '../components/TaskList'
import type { Hono } from 'hono'
import { getDB, type Env } from '../db/client'
import type { TaskUpdate } from '../types'
import {
  htmxDeleteResponse,
  htmxRefreshTasksResponse
} from '../utils/htmx'
import { TaskItem } from '../components/TaskItem'
import {
  requireAuthenticatedUser,
  requireChildOwnTaskAccess,
  requireParent
} from '../auth/middleware'
import {
  createTask,
  deleteTask,
  getActiveTasks,
  getArchivedTasks,
  getTaskById,
  updateTask,
  updateTaskStatus
} from '../services/task.service'
import { getAllUsers } from '../services/user.service'
import { isActiveTaskStatus, isTaskStatus } from '../utils/task-status'

export function taskRoutes(app: Hono<Env>) {
  app.get('/tasks', async (c) => {
    try {
      const authUser = requireAuthenticatedUser(c)
      const db = getDB(c.env)
      const result = await getActiveTasks(db)
      const users = await getAllUsers(db)

      return c.html(<TaskList tasks={result} users={users} authUser={authUser} />)
    } catch (err) {
      console.error('GET /tasks error:', err)

      return c.html(<div class='error'>Failed to load tasks</div>, 500)
    }
  })

  app.post('/tasks', async (c) => {
    requireParent(c)
    const db = getDB(c.env)
    const body = await c.req.parseBody()

    await createTask(db, body)

    const users = await getAllUsers(db)
    const result = await getActiveTasks(db)
    const authUser = requireAuthenticatedUser(c)

    return c.html(<TaskList tasks={result} users={users} authUser={authUser} />)
  })

  app.patch('/task/:id/status', async (c) => {
    const id = Number(c.req.param('id'))
    await requireChildOwnTaskAccess(c, id)
    const db = getDB(c.env)
    const body = await c.req.parseBody()
    const status = body.status as string

    if (!isActiveTaskStatus(status)) {
      return c.text('Invalid status', 400)
    }

    await updateTaskStatus(db, id, status)

    const result = await getActiveTasks(db)
    const users = await getAllUsers(db)
    const authUser = requireAuthenticatedUser(c)

    c.header(
      'HX-Trigger',
      JSON.stringify({
        refreshUsers: true,
        refreshRewards: true
      })
    )
    return c.html(<TaskList tasks={result} users={users} authUser={authUser} />)
  })

  app.patch('/task/:id', async (c) => {
    requireParent(c)
    const id = Number(c.req.param('id'))
    const db = getDB(c.env)
    const body = await c.req.parseBody()

    const updates: TaskUpdate = {}

    if (body.title) updates.title = body.title as string
    if (body.priority)
      updates.priority = body.priority as 'high' | 'medium' | 'low'
    if ('assigneeId' in body) {
      updates.assigneeId = body.assigneeId ? Number(body.assigneeId) : null
    }
    if (body.status) {
      const status = body.status as string
      if (!isTaskStatus(status)) {
        return c.text('Invalid status', 400)
      }
      if (status === 'archived' && body.view !== 'archive') {
        return c.text('Invalid status', 400)
      }
      updates.status = status
    }

    await updateTask(db, id, updates)

    const authUser = requireAuthenticatedUser(c)
    const users = await getAllUsers(db)

    if (body.view === 'archive') {
      const rawAssigneeId = body.assigneeIdFilter as string | undefined
      const assigneeId =
        rawAssigneeId && rawAssigneeId !== 'all' ? Number(rawAssigneeId) : null
      const selectedAssigneeId =
        assigneeId && users.some((user) => user.id === assigneeId)
          ? assigneeId
          : null
      const tasks = await getArchivedTasks(db, selectedAssigneeId)

      return c.html(
        <ArchivedTaskList
          tasks={tasks}
          users={users}
          authUser={authUser}
          selectedAssigneeId={selectedAssigneeId}
        />
      )
    }

    if (updates.status) {
      return htmxRefreshTasksResponse(c)
    }

    const task = await getTaskById(db, id)

    return c.html(<TaskItem task={task} users={users} authUser={authUser} />)
  })

  app.delete('/task/:id', async (c) => {
    requireParent(c)
    const id = Number(c.req.param('id'))
    const db = getDB(c.env)
    await deleteTask(db, id)
    return htmxDeleteResponse(c)
  })
}

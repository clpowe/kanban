import { TaskList } from '../components/TaskList'
import type { Hono } from 'hono'
import { getDB, type Env } from '../db/client'
import type { TaskUpdate } from '../types'
import { htmxDeleteResponse, htmxRefreshTasksResponse } from '../utils/htmx'
import { TaskItem } from '../components/TaskItem'
import {
  requireAuthenticatedUser,
  requireChildOwnTaskAccess,
  requireParent
} from '../auth/middleware'
import {
  createTask,
  deleteTask,
  getAllTasks,
  getTaskById,
  updateTask,
  updateTaskStatus
} from '../services/task.service'
import { getAllUsers } from '../services/user.service'

export function taskRoutes(app: Hono<Env>) {
  app.get('/tasks', async (c) => {
    try {
      const authUser = requireAuthenticatedUser(c)
      const db = getDB(c.env)
      const result = await getAllTasks(db)
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
    const result = await getAllTasks(db)
    const authUser = requireAuthenticatedUser(c)

    return c.html(<TaskList tasks={result} users={users} authUser={authUser} />)
  })

  app.patch('/task/:id/status', async (c) => {
    const id = Number(c.req.param('id'))
    await requireChildOwnTaskAccess(c, id)
    const db = getDB(c.env)
    const body = await c.req.parseBody()

    await updateTaskStatus(db, id, body.status as string)

    const result = await getAllTasks(db)
    const users = await getAllUsers(db)
    const authUser = requireAuthenticatedUser(c)

    c.header('HX-Trigger', 'refreshUsers')
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
    if (body.status) updates.status = body.status as any

    await updateTask(db, id, updates)

    if (updates.status) {
      return htmxRefreshTasksResponse(c)
    }

    const users = await getAllUsers(db)
    const task = await getTaskById(db, id)
    const authUser = requireAuthenticatedUser(c)

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

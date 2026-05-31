import type { Hono } from 'hono'
import { getDB, type Env } from '../db/client'
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
import { isTaskStatus } from '../utils/task-status'
import type { TaskUpdate } from '../types'

export function taskRoutes(app: Hono<Env>) {
  app.get('/api/tasks', async (c) => {
    try {
      requireAuthenticatedUser(c)
      const db = getDB(c.env)
      const result = await getActiveTasks(db)
      return c.json(result)
    } catch (err) {
      console.error('GET /tasks error:', err)
      return c.json({ error: 'Failed to load tasks' }, 500)
    }
  })

  app.post('/api/tasks', async (c) => {
    try {
      requireParent(c)
      const db = getDB(c.env)
      const body = await c.req.json()

      const [createdTask] = await createTask(db, body)

      if (!createdTask) {
        return c.json({ error: 'Failed to create task' }, 500)
      }
      return c.json(createdTask, 201)
    } catch (err) {
      console.error('POST /api/tasks error:', err)
      return c.json({ error: err instanceof Error ? err.message : 'Internal Server Error' }, 500)
    }
  })

  app.patch('/api/tasks/:id/status', async (c) => {
    try {
      const id = Number(c.req.param('id'))
      await requireChildOwnTaskAccess(c, id)
      const db = getDB(c.env)
      const body = await c.req.json()
      const status = body.status as string
      if (!isTaskStatus(status)) {
        return c.json({ error: 'Invalid status' }, 400)
      }
      await updateTaskStatus(db, id, status)
      const task = await getTaskById(db, id)
      return c.json(task)
    } catch (err) {
      console.error('PATCH status error:', err)
      return c.json({ error: err instanceof Error ? err.message : 'Internal Server Error' }, 500)
    }
  })

  app.patch('/api/tasks/:id', async (c) => {
    try {
      requireParent(c)
      const id = Number(c.req.param('id'))
      const db = getDB(c.env)
      const body = await c.req.json()
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
          return c.json({ error: 'Invalid status' }, 400)
        }
        updates.status = status
      }

      await updateTask(db, id, updates)

      const task = await getTaskById(db, id)
      return c.json(task)
    } catch (err) {
      console.error('PATCH task error:', err)
      return c.json({ error: err instanceof Error ? err.message : 'Internal Server Error' }, 500)
    }
  })

  app.delete('/api/tasks/:id', async (c) => {
    try {
      requireParent(c)
      const id = Number(c.req.param('id'))
      const db = getDB(c.env)
      await deleteTask(db, id)
      return c.json({ success: true })
    } catch (err) {
      console.error('DELETE task error:', err)
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  })
}

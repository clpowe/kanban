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
import { createPostHogClient } from '../lib/posthog'

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

  app.get('/api/tasks/archived', async (c) => {
    try {
      requireAuthenticatedUser(c)
      const db = getDB(c.env)
      const result = await getArchivedTasks(db)
      return c.json(result)
    } catch (err) {
      console.error('GET /tasks/archived error:', err)
      return c.json({ error: 'Failed to load archived tasks' }, 500)
    }
  })

  app.post('/api/tasks', async (c) => {
    try {
      const parentUser = requireParent(c)
      const db = getDB(c.env)
      const body = await c.req.json()

      const [createdTask] = await createTask(db, body)

      if (!createdTask) {
        return c.json({ error: 'Failed to create task' }, 500)
      }

      const posthog = createPostHogClient(c.env)
      await posthog.captureImmediate({
        distinctId: String(parentUser.id),
        event: 'task created',
        properties: {
          task_id: createdTask.id,
          task_title: createdTask.title,
          priority: createdTask.priority,
          assignee_id: createdTask.assigneeId ?? null,
          repeat: createdTask.repeat ?? null,
        },
      })

      return c.json(createdTask, 201)
    } catch (err) {
      console.error('POST /api/tasks error:', err)
      return c.json({ error: err instanceof Error ? err.message : 'Internal Server Error' }, 500)
    }
  })

  app.patch('/api/tasks/:id/status', async (c) => {
    try {
      const id = Number(c.req.param('id'))
      const activeUser = await requireChildOwnTaskAccess(c, id)
      const db = getDB(c.env)
      const body = await c.req.json()
      const status = body.status as string
      if (!isTaskStatus(status)) {
        return c.json({ error: 'Invalid status' }, 400)
      }
      const { milestone } = await updateTaskStatus(db, id, status)
      const task = await getTaskById(db, id)

      const posthog = createPostHogClient(c.env)
      await posthog.captureImmediate({
        distinctId: String(activeUser.id),
        event: 'task status updated',
        properties: {
          task_id: id,
          new_status: status,
          task_title: task?.title ?? null,
          assignee_id: task?.assigneeId ?? null,
        },
      })

      if (milestone) {
        await posthog.captureImmediate({
          distinctId: String(activeUser.id),
          event: 'streak milestone reached',
          properties: {
            task_id: id,
            achievement_id: milestone.achievementId,
            badge_name: milestone.badgeName,
            streak: milestone.streak,
            prestige_level: milestone.prestigeLevel,
          },
        })
      }

      return c.json(task)
    } catch (err) {
      console.error('PATCH status error:', err)
      return c.json({ error: err instanceof Error ? err.message : 'Internal Server Error' }, 500)
    }
  })

  app.patch('/api/tasks/:id', async (c) => {
    try {
      const parentUser = requireParent(c)
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

      const posthog = createPostHogClient(c.env)
      await posthog.captureImmediate({
        distinctId: String(parentUser.id),
        event: 'task updated',
        properties: {
          task_id: id,
          fields_changed: Object.keys(updates),
          task_title: task?.title ?? null,
        },
      })

      return c.json(task)
    } catch (err) {
      console.error('PATCH task error:', err)
      return c.json({ error: err instanceof Error ? err.message : 'Internal Server Error' }, 500)
    }
  })

  app.delete('/api/tasks/:id', async (c) => {
    try {
      const parentUser = requireParent(c)
      const id = Number(c.req.param('id'))
      const db = getDB(c.env)
      await deleteTask(db, id)

      const posthog = createPostHogClient(c.env)
      await posthog.captureImmediate({
        distinctId: String(parentUser.id),
        event: 'task deleted',
        properties: { task_id: id },
      })

      return c.json({ success: true })
    } catch (err) {
      console.error('DELETE task error:', err)
      return c.json({ error: 'Internal Server Error' }, 500)
    }
  })
}

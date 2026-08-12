import type { Hono } from 'hono'
import { getDB, type Env } from '../db/client'
import {
  requireAuthenticatedUser,
  requireChildOwnTaskAccess,
  requireParent,
} from '../auth/middleware'
import {
  createTask,
  deleteTask,
  getActiveTasks,
  getArchivedTasks,
  getTaskById,
  updateTask,
  updateTaskStatus,
} from '../services/task.service'
import { completeTask, undoCompletion } from '../services/completion.service'
import { isTaskStatus } from '../utils/task-status'
import {
  parseCreateTaskInput,
  parseTaskUpdateInput,
  TaskInputError,
} from '../utils/task-input'
import {
  getRequestExecutionContext,
  queuePostHogTelemetry,
} from '../lib/posthog'

type TaskRoutesDeps = {
  getDB: typeof getDB
  requireAuthenticatedUser: typeof requireAuthenticatedUser
  requireChildOwnTaskAccess: typeof requireChildOwnTaskAccess
  requireParent: typeof requireParent
  queuePostHogTelemetry: typeof queuePostHogTelemetry
}

const defaultDeps: TaskRoutesDeps = {
  getDB,
  requireAuthenticatedUser,
  requireChildOwnTaskAccess,
  requireParent,
  queuePostHogTelemetry,
}

function taskErrorStatus(error: unknown): 400 | 403 | 500 {
  if (error instanceof TaskInputError) return 400
  if (typeof error === 'object' && error !== null && 'status' in error) {
    const status = Reflect.get(error, 'status')
    if (status === 400 || status === 403) return status
  }
  return 500
}

function stringField(input: unknown, key: string) {
  if (typeof input !== 'object' || input === null || !(key in input)) return ''
  const value = Reflect.get(input, key)
  return typeof value === 'string' ? value : ''
}

export function taskRoutes(
  app: Hono<Env>,
  overrides: Partial<TaskRoutesDeps> = {},
) {
  const deps: TaskRoutesDeps = { ...defaultDeps, ...overrides }

  app.get('/api/tasks', async (c) => {
    try {
      deps.requireAuthenticatedUser(c)
      const db = deps.getDB(c.env)
      const result = await getActiveTasks(db)
      return c.json(result)
    } catch (err) {
      console.error('GET /tasks error:', err)
      return c.json({ error: 'Failed to load tasks' }, 500)
    }
  })

  app.get('/api/tasks/archived', async (c) => {
    try {
      deps.requireAuthenticatedUser(c)
      const db = deps.getDB(c.env)
      const result = await getArchivedTasks(db)
      return c.json(result)
    } catch (err) {
      console.error('GET /tasks/archived error:', err)
      return c.json({ error: 'Failed to load archived tasks' }, 500)
    }
  })

  app.post('/api/tasks', async (c) => {
    try {
      const parentUser = deps.requireParent(c)
      const db = deps.getDB(c.env)
      const body: unknown = await c.req.json()
      const parsed = parseCreateTaskInput(body)
      if (!parsed.ok) return c.json({ error: parsed.error }, 400)

      const [createdTask] = await createTask(db, parsed.value)
      if (!createdTask) {
        return c.json({ error: 'Failed to create task' }, 500)
      }

      deps.queuePostHogTelemetry(c.env, getRequestExecutionContext(c), {
        type: 'capture',
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
      const status = taskErrorStatus(err)
      if (status === 500) console.error('POST /api/tasks error:', err)
      return c.json(
        { error: err instanceof Error ? err.message : 'Internal Server Error' },
        status,
      )
    }
  })

  app.patch('/api/tasks/:id/status', async (c) => {
    try {
      const id = Number(c.req.param('id'))
      const activeUser = await deps.requireChildOwnTaskAccess(c, id)
      const db = deps.getDB(c.env)
      const body: unknown = await c.req.json()
      const status = stringField(body, 'status')
      if (!isTaskStatus(status)) {
        return c.json({ error: 'Invalid status' }, 400)
      }

      const eventId = stringField(body, 'eventId').trim()
      const existingTask = await getTaskById(db, id)
      if (!existingTask) return c.json({ error: 'Task not found' }, 404)

      let milestone = null
      let task
      if (status === 'done') {
        if (!eventId) {
          return c.json({ error: 'Completion event ID is required' }, 400)
        }
        const result = await completeTask(db, id, eventId)
        milestone = result.milestone
        task = result.task
      } else if (
        existingTask.status === 'done' &&
        (status === 'todo' || status === 'doing' || status === 'review')
      ) {
        if (!eventId) {
          return c.json({ error: 'Undo event ID is required' }, 400)
        }
        const result = await undoCompletion(db, id, status, eventId)
        task = result.task
      } else {
        await updateTaskStatus(db, id, status)
        task = await getTaskById(db, id)
      }

      deps.queuePostHogTelemetry(c.env, getRequestExecutionContext(c), {
        type: 'capture',
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
        deps.queuePostHogTelemetry(c.env, getRequestExecutionContext(c), {
          type: 'capture',
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
      const status = taskErrorStatus(err)
      if (status === 500) console.error('PATCH status error:', err)
      return c.json(
        { error: err instanceof Error ? err.message : 'Internal Server Error' },
        status,
      )
    }
  })

  app.patch('/api/tasks/:id', async (c) => {
    try {
      const parentUser = deps.requireParent(c)
      const id = Number(c.req.param('id'))
      const db = deps.getDB(c.env)
      const body: unknown = await c.req.json()
      const parsed = parseTaskUpdateInput(body)
      if (!parsed.ok) return c.json({ error: parsed.error }, 400)

      const task = await updateTask(db, id, parsed.value)
      if (!task) return c.json({ error: 'Task not found' }, 404)

      deps.queuePostHogTelemetry(c.env, getRequestExecutionContext(c), {
        type: 'capture',
        distinctId: String(parentUser.id),
        event: 'task updated',
        properties: {
          task_id: id,
          fields_changed: Object.keys(parsed.value),
          task_title: task.title,
        },
      })

      return c.json(task)
    } catch (err) {
      const status = taskErrorStatus(err)
      if (status === 500) console.error('PATCH task error:', err)
      return c.json(
        { error: err instanceof Error ? err.message : 'Internal Server Error' },
        status,
      )
    }
  })

  app.delete('/api/tasks/:id', async (c) => {
    try {
      const parentUser = deps.requireParent(c)
      const id = Number(c.req.param('id'))
      const db = deps.getDB(c.env)
      await deleteTask(db, id)

      deps.queuePostHogTelemetry(c.env, getRequestExecutionContext(c), {
        type: 'capture',
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

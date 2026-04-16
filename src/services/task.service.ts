import { and, eq, ne, sql } from 'drizzle-orm'
import { tasks, users } from '../db/schema'
import type { TaskUpdate } from '../types'
import { type TaskStatus } from '../utils/task-status'

const priorityPoints = {
  high: 10,
  medium: 5,
  low: 1
} as const

export const getActiveTasks = async (db: any) => {
  return db.select().from(tasks).where(ne(tasks.status, 'archived'))
}

export const getArchivedTasks = async (db: any, assigneeId?: number | null) => {
  if (assigneeId) {
    return db
      .select()
      .from(tasks)
      .where(and(eq(tasks.status, 'archived'), eq(tasks.assigneeId, assigneeId)))
  }

  return db.select().from(tasks).where(eq(tasks.status, 'archived'))
}

export const getTaskById = async (db: any, id: number) => {
  return db.select().from(tasks).where(eq(tasks.id, id)).get()
}

export const createTask = async (db: any, data: any) => {
  const priority = data.priority as keyof typeof priorityPoints

  return await db
    .insert(tasks)
    .values({
      title: data.title,
      priority,
      value: priorityPoints[priority],
      repeat: data.repeat,
      status: 'todo',
      assigneeId: data.assigneeId ? Number(data.assigneeId) : null
    })
    .returning()
}

export const updateTask = async (db: any, id: number, updates: TaskUpdate) => {
  await db.update(tasks).set(updates).where(eq(tasks.id, id))
}

export const updateTaskStatus = async (db: any, id: number, status: TaskStatus) => {
  const existing = await db.select().from(tasks).where(eq(tasks.id, id)).get()

  if (!existing) return

  const prevStatus = existing.status
  const nextStatus = status ?? prevStatus

  const assigneeId = existing.assigneeId
  const value = existing.value ?? 0

  // update task first
  await db.update(tasks).set({ status }).where(eq(tasks.id, id))

  // no assignee → nothing to do
  if (!assigneeId) return

  // DONE → add score
  if (prevStatus !== 'done' && nextStatus === 'done') {
    await db
      .update(users)
      .set({
        points: sql`${users.points} + ${value}`
      })
      .where(eq(users.id, assigneeId))
  }

  // UNDO DONE → subtract score
  if (
    prevStatus === 'done' &&
    nextStatus !== 'done' &&
    nextStatus !== 'archived'
  ) {
    await db
      .update(users)
      .set({
        points: sql`${users.points} - ${value}`
      })
      .where(eq(users.id, assigneeId))
  }
}

export const archiveDoneTasks = async (db: any) => {
  await db
    .update(tasks)
    .set({ status: 'archived' })
    .where(eq(tasks.status, 'done'))
}

export const deleteTask = async (db: any, id: number) => {
  await db.delete(tasks).where(eq(tasks.id, id))
}

import { eq, sql } from 'drizzle-orm'
import { tasks, users } from '../db/schema'
import type { TaskUpdate } from '../types'

export const getAllTasks = async (db: any) => {
  return db.select().from(tasks)
}

export const getTaskById = async (db: any, id: number) => {
  return db.select().from(tasks).where(eq(tasks.id, id)).get()
}

export const createTask = async (db: any, data: any) => {
  return await db
    .insert(tasks)
    .values({
      title: data.title,
      priority: data.priority,
      value: Number(data.value),
      repeat: data.repeat,
      status: 'todo',
      assigneeId: data.assigneeId ? Number(data.assigneeId) : null
    })
    .returning()
}

export const updateTask = async (db: any, id: number, updates: TaskUpdate) => {
  await db.update(tasks).set(updates).where(eq(tasks.id, id))
}

export const updateTaskStatus = async (db: any, id: number, status: string) => {
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
  if (prevStatus === 'done' && nextStatus !== 'done') {
    await db
      .update(users)
      .set({
        points: sql`${users.points} - ${value}`
      })
      .where(eq(users.id, assigneeId))
  }
}

export const deleteTask = async (db: any, id: number) => {
  await db.delete(tasks).where(eq(tasks.id, id))
}

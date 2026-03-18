import { eq, and } from 'drizzle-orm'
import { tasks } from '../db/schema'
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
	await db.update(tasks).set({ status }).where(eq(tasks.id, id))
}

export const deleteTask = async (db: any, id: number) => {
	await db.delete(tasks).where(eq(tasks.id, id))
}

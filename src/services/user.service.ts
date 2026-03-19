import { eq } from 'drizzle-orm'
import { tasks, users } from './../db/schema'

export const getAllUsers = async (db: any) => {
	return db.select().from(users)
}

export const getUserByUsername = async (db: any, username: string) => {
	return db.select().from(users).where(eq(users.username, username)).get()
}

export const getTaskAssigneeId = async (db: any, taskId: number) => {
	const task = await db
		.select({ assigneeId: tasks.assigneeId })
		.from(tasks)
		.where(eq(tasks.id, taskId))
		.get()

	return task?.assigneeId ?? null
}

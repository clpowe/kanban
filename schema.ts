// drizzle/schema.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { relations } from 'drizzle-orm'

// USERS
export const users = sqliteTable('users', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	points: integer('points').default(0),
	type: text('type', { enum: ['parent', 'child'] }).notNull()
})

// TASKS
export const tasks = sqliteTable('tasks', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	title: text('title').notNull(),

	priority: text('priority', {
		enum: ['high', 'medium', 'low']
	}).notNull(),

	value: integer('value').notNull(),

	status: text('status', {
		enum: ['todo', 'doing', 'review', 'done']
	}).default('todo'),

	repeat: text('repeat', {
		enum: ['daily', 'weekly', 'none']
	}).default('none'),

	assigneeId: integer('assignee_id').references(() => users.id)
})

// REWARDS
export const rewards = sqliteTable('rewards', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	name: text('name').notNull(),
	value: integer('value').notNull()
})

export const usersRelations = relations(users, ({ many }) => ({
	tasks: many(tasks)
}))

export const tasksRelations = relations(tasks, ({ one }) => ({
	assignee: one(users, {
		fields: [tasks.assigneeId],
		references: [users.id]
	})
}))

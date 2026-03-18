import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { tasks, rewards, users } from './schema'

export type User = InferSelectModel<typeof users>
export type Task = InferSelectModel<typeof tasks>
export type Reward = InferSelectModel<typeof rewards>
export type TaskUpdate = Partial<InferInsertModel<typeof tasks>>

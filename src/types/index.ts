import type { InferInsertModel, InferSelectModel } from 'drizzle-orm'
import { tasks, rewards, users } from '../db/schema.ts'

export type User = InferSelectModel<typeof users>
export type Task = InferSelectModel<typeof tasks>
export type Reward = InferSelectModel<typeof rewards>
export type RewardView = {
  id: number
  title: string
  cost: number
}
export type RewardLike = Reward | RewardView
export type TaskUpdate = Partial<InferInsertModel<typeof tasks>>

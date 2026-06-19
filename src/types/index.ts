import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { tasks, rewards, users, taskAchievements } from "../db/schema.ts";

export type User = InferSelectModel<typeof users>;
export type TaskAchievement = InferSelectModel<typeof taskAchievements>;

export type Task = InferSelectModel<typeof tasks> & {
  achievement?: TaskAchievement | null;
};

export type CreateTask = Omit<Task, "id" | "value" | "status"> & {
  achievementName?: string;
  targetStreak?: number;
};

export type Reward = InferSelectModel<typeof rewards>;
export type RewardView = {
  id: number;
  title: string;
  cost: number;
};
export type RewardLike = Reward | RewardView;
export type TaskUpdate = Partial<InferInsertModel<typeof tasks>>;

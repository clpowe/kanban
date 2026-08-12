import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  pointEntries,
  rewards,
  taskAchievements,
  taskCompletions,
  tasks,
  users,
} from "../db/schema.ts";

export type User = InferSelectModel<typeof users>;
export type TaskAchievement = InferSelectModel<typeof taskAchievements>;

export type TaskCompletion = InferSelectModel<typeof taskCompletions>;
export type NewTaskCompletion = InferInsertModel<typeof taskCompletions>;
export type PointEntry = InferSelectModel<typeof pointEntries>;
export type NewPointEntry = InferInsertModel<typeof pointEntries>;

export type Task = InferSelectModel<typeof tasks> & {
  achievement?: TaskAchievement | null;
};

export type CreateTask = Omit<Task, "id" | "value" | "status"> & {
  achievementName?: string;
  targetStreak?: number;
  streakEnabled?: boolean;
};

export type Reward = InferSelectModel<typeof rewards>;
export type RewardView = {
  id: number;
  title: string;
  cost: number;
};
export type RewardLike = Reward | RewardView;
export type TaskUpdate = Partial<InferInsertModel<typeof tasks>> & {
  achievementName?: string;
  targetStreak?: number;
  streakEnabled?: boolean;
};

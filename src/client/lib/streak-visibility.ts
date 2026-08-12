import type { TaskAchievement } from "../../types";

export function isVisibleStreak(
  achievement: Pick<TaskAchievement, "streakEnabled"> | null | undefined,
) {
  return achievement?.streakEnabled === true;
}

import { countWeekdaysBetween, getNewYorkDateKey } from "../utils/new-york-time";

export type StreakInput = {
  repeat: "daily" | "weekly" | "none" | null;
  targetStreak: number;
  currentStreak: number;
  prestigeCount: number;
  lastCompletedAt: Date | null;
};

export type StreakResult = {
  currentStreak: number;
  prestigeCount: number;
  lastCompletedAt: Date;
  earnedBadge: boolean;
};

export type DailyResetState = {
  streakCount: number;
  lastCompletedDate: Date | null;
  missedDaysInARow: number;
};

export type DailyResetResult = {
  state: DailyResetState;
  changed: boolean;
  streakBroken: boolean;
};

const MILLISECONDS_PER_HOUR = 1000 * 60 * 60;
const MILLISECONDS_PER_DAY = 24 * MILLISECONDS_PER_HOUR;

export function startOfUTCDay(date: Date): number {
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
}

function calendarDaysBetween(from: Date, to: Date): number {
  return Math.round(
    (startOfUTCDay(to) - startOfUTCDay(from)) /
      MILLISECONDS_PER_DAY,
  );
}

export function dailyReset(
  state: DailyResetState,
  endedDay: Date,
): DailyResetResult {
  const completedThatDay =
    state.lastCompletedDate !== null &&
    calendarDaysBetween(state.lastCompletedDate, endedDay) <= 0;

  if (completedThatDay) {
    return { state, changed: false, streakBroken: false };
  }

  const missedDaysInARow = state.missedDaysInARow + 1;
  const breaksStreak = missedDaysInARow >= 2;

  return {
    state: {
      ...state,
      missedDaysInARow,
      streakCount: breaksStreak ? 0 : state.streakCount,
    },
    changed: true,
    streakBroken: breaksStreak && state.streakCount > 0,
  };
}

function hoursBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / MILLISECONDS_PER_HOUR;
}

function applyDailyCompletion(currentStreak: number, lastCompletedAt: Date, now: Date): number {
  if (hoursBetween(lastCompletedAt, now) < 12) {
    return currentStreak;
  }

  const weekdaysElapsed = countWeekdaysBetween(
    getNewYorkDateKey(lastCompletedAt),
    getNewYorkDateKey(now),
  );

  if (weekdaysElapsed <= 1) {
    return currentStreak + 1;
  }

  const missedDays = weekdaysElapsed - 1;

  return Math.max(0, currentStreak - missedDays * 2) + 1;
}

function applyWeeklyCompletion(currentStreak: number, lastCompletedAt: Date, now: Date): number {
  const elapsedHours = hoursBetween(lastCompletedAt, now);

  if (elapsedHours < 72) {
    return currentStreak;
  }

  if (elapsedHours <= 240) {
    return currentStreak + 1;
  }

  const missedWeeks = Math.max(1, Math.floor(elapsedHours / 168) - 1);

  return Math.max(0, currentStreak - missedWeeks * 2) + 1;
}

function calculateCurrentStreak(input: StreakInput, now: Date): number {
  if (!input.lastCompletedAt) {
    return 1;
  }

  if (input.repeat === "daily") {
    return applyDailyCompletion(input.currentStreak, input.lastCompletedAt, now);
  }

  if (input.repeat === "weekly") {
    return applyWeeklyCompletion(input.currentStreak, input.lastCompletedAt, now);
  }

  return input.currentStreak;
}

export function applyCompletionToStreak(input: StreakInput, now: Date): StreakResult {
  const currentStreak = calculateCurrentStreak(input, now);
  const earnedBadge = currentStreak >= input.targetStreak;

  return {
    currentStreak: earnedBadge ? 0 : currentStreak,
    prestigeCount: earnedBadge ? input.prestigeCount + 1 : input.prestigeCount,
    lastCompletedAt: now,
    earnedBadge,
  };
}

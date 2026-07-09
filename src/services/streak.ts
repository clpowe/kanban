/**
 * Pure streak/grace-period logic for daily (and weekly) repeating tasks.
 *
 * Rules (per period, 1 day for daily tasks, 7 days for weekly):
 *  A. Completed the very next period  → streak + 1
 *  B. Missed exactly one period       → streak frozen (kept, not incremented)
 *  C. Missed two or more periods      → streak resets to 1 (today counts)
 *  D. Streak hits the target          → badge milestone
 *
 * All date comparisons use UTC calendar days, never elapsed hours, so a
 * completion at 23:50 followed by one at 00:10 the next day still counts
 * as consecutive days.
 */

export type StreakState = {
  streakCount: number;
  lastCompletedDate: Date | null;
  missedDaysInARow: number;
};

export type StreakOptions = {
  /** Streak length that earns a badge (e.g. 20). */
  targetStreak: number;
  /** 1 for daily tasks, 7 for weekly. Defaults to 1. */
  periodDays?: number;
};

export type CompletionResult = {
  state: StreakState;
  /** false when the task was already completed this period (no-op). */
  changed: boolean;
  /** true when this completion earned a badge. */
  milestoneReached: boolean;
};

export type DailyResetResult = {
  state: StreakState;
  changed: boolean;
  /** true when this reset zeroed out a running streak. */
  streakBroken: boolean;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Milliseconds at 00:00 UTC of the given date's calendar day. */
export const startOfUTCDay = (d: Date): number =>
  Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

/** Whole calendar days from `from` to `to` (positive when `to` is later). */
export const daysBetween = (from: Date, to: Date): number =>
  Math.round((startOfUTCDay(to) - startOfUTCDay(from)) / MS_PER_DAY);

/**
 * Apply a task completion to the streak state.
 * Idempotent within a period: completing twice on the same day is a no-op.
 */
export function completeTask(
  state: StreakState,
  now: Date,
  options: StreakOptions,
): CompletionResult {
  const periodDays = options.periodDays ?? 1;

  let streakCount: number;
  if (!state.lastCompletedDate) {
    // First completion ever starts a streak of 1.
    streakCount = 1;
  } else {
    const periodsSince = Math.floor(
      daysBetween(state.lastCompletedDate, now) / periodDays,
    );

    if (periodsSince <= 0) {
      return { state, changed: false, milestoneReached: false };
    }
    if (periodsSince === 1) {
      streakCount = state.streakCount + 1; // Rule A: consecutive
    } else if (periodsSince === 2) {
      streakCount = state.streakCount; // Rule B: 1-period grace, freeze
    } else {
      streakCount = 1; // Rule C: broken, today restarts it
    }
  }

  // Rule D. Guard on streak growth so a frozen streak sitting on the
  // target doesn't re-award; modulo makes the badge repeatable each cycle
  // (prestige) without resetting the visible streak.
  const milestoneReached =
    streakCount > state.streakCount &&
    options.targetStreak > 0 &&
    streakCount % options.targetStreak === 0;

  return {
    state: {
      streakCount,
      lastCompletedDate: now,
      missedDaysInARow: 0,
    },
    changed: true,
    milestoneReached,
  };
}

/**
 * End-of-day sweep for a task that may not have been completed.
 * `endedDay` is the calendar day being closed out (for a midnight cron,
 * the previous UTC day).
 */
export function dailyReset(
  state: StreakState,
  endedDay: Date,
): DailyResetResult {
  const completedThatDay =
    state.lastCompletedDate !== null &&
    daysBetween(state.lastCompletedDate, endedDay) <= 0;

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

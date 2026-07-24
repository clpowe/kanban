import {
  countWeekdaysBetween,
  getNewYorkDateKey,
  isNewYorkWeekdayDateKey,
} from "../utils/new-york-time";

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
  lastCompletedAt: Date | null;
  earnedBadge: boolean;
  changed: boolean;
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

export type CompletionForStreak = {
  completedOn: string;
  completedAt: Date;
};

export type DerivedStreak = {
  currentStreak: number;
  lastCompletedAt: Date | null;
  projectedPrestigeCount: number;
};

const MILLISECONDS_PER_HOUR = 1000 * 60 * 60;

export function dailyReset(
  state: DailyResetState,
  endedDateKey: string,
): DailyResetResult {
  // Weekends are neutral for weekday streaks.
  if (!isNewYorkWeekdayDateKey(endedDateKey)) {
    return { state, changed: false, streakBroken: false };
  }

  const completedThatDay =
    state.lastCompletedDate !== null &&
    getNewYorkDateKey(state.lastCompletedDate) === endedDateKey;

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

function hoursBetween(from: Date, to: Date) {
  return (to.getTime() - from.getTime()) / MILLISECONDS_PER_HOUR;
}

function applyDailyCompletion(
  currentStreak: number,
  lastCompletedAt: Date | null,
  now: Date,
) {
  const nowDateKey = getNewYorkDateKey(now);

  // Weekend task completion can still award task points, but does not alter
  // the weekday streak or overwrite its last qualifying completion.
  if (!isNewYorkWeekdayDateKey(nowDateKey)) {
    return { currentStreak, changed: false };
  }

  if (!lastCompletedAt) {
    return { currentStreak: 1, changed: true };
  }

  const previousDateKey = getNewYorkDateKey(lastCompletedAt);

  // Same New York date is always the same streak period, regardless of hours.
  if (previousDateKey === nowDateKey) {
    return { currentStreak, changed: false };
  }

  const weekdaysElapsed = countWeekdaysBetween(
    previousDateKey,
    nowDateKey,
  );

  if (weekdaysElapsed <= 0) {
    return { currentStreak, changed: false };
  }

  if (weekdaysElapsed === 1) {
    return { currentStreak: currentStreak + 1, changed: true };
  }

  const missedDays = weekdaysElapsed - 1;

  return {
    currentStreak: Math.max(0, currentStreak - missedDays * 2) + 1,
    changed: true,
  };
}

function applyWeeklyCompletion(
  currentStreak: number,
  lastCompletedAt: Date | null,
  now: Date,
) {
  if (!lastCompletedAt) {
    return { currentStreak: 1, changed: true };
  }

  const elapsedHours = hoursBetween(lastCompletedAt, now);

  if (elapsedHours < 72) {
    return { currentStreak, changed: false };
  }

  if (elapsedHours <= 240) {
    return { currentStreak: currentStreak + 1, changed: true };
  }

  const missedWeeks = Math.max(1, Math.floor(elapsedHours / 168) - 1);

  return {
    currentStreak: Math.max(0, currentStreak - missedWeeks * 2) + 1,
    changed: true,
  };
}

export function applyCompletionToStreak(
  input: StreakInput,
  now: Date,
): StreakResult {
  const calculation =
    input.repeat === "daily"
      ? applyDailyCompletion(input.currentStreak, input.lastCompletedAt, now)
      : input.repeat === "weekly"
        ? applyWeeklyCompletion(input.currentStreak, input.lastCompletedAt, now)
        : { currentStreak: input.currentStreak, changed: false };

  const earnedBadge =
    calculation.changed &&
    input.targetStreak > 0 &&
    calculation.currentStreak >= input.targetStreak;

  return {
    currentStreak: earnedBadge ? 0 : calculation.currentStreak,
    prestigeCount: earnedBadge
      ? input.prestigeCount + 1
      : input.prestigeCount,
    lastCompletedAt: calculation.changed ? now : input.lastCompletedAt,
    earnedBadge,
    changed: calculation.changed,
  };
}

export function deriveStreakFromCompletions(
  completions: CompletionForStreak[],
  options: {
    repeat: "daily" | "weekly" | "none" | null;
    targetStreak: number;
  },
): DerivedStreak {
  const sortedCompletions = [...completions].sort(
    (left, right) =>
      left.completedAt.getTime() - right.completedAt.getTime(),
  );

  return sortedCompletions.reduce<DerivedStreak>(
    (projection, completion) => {
      const result = applyCompletionToStreak(
        {
          repeat: options.repeat,
          targetStreak: options.targetStreak,
          currentStreak: projection.currentStreak,
          prestigeCount: projection.projectedPrestigeCount,
          lastCompletedAt: projection.lastCompletedAt,
        },
        completion.completedAt,
      );

      return {
        currentStreak: result.currentStreak,
        lastCompletedAt: result.lastCompletedAt,
        projectedPrestigeCount: result.prestigeCount,
      };
    },
    {
      currentStreak: 0,
      lastCompletedAt: null,
      projectedPrestigeCount: 0,
    },
  );
}

import {
  countWeekdaysBetween,
  getNewYorkDateKey,
  getNewYorkWeekKey,
  getNewYorkWeekKeyFromDateKey,
  isNewYorkWeekdayDateKey,
  countWeekKeysBetween,
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

function applyDailyCycle(
  currentStreak: number,
  previousDateKey: string | null,
  nowDateKey: string,
) {
  // Weekend task completion can still award task points, but does not alter
  // the weekday streak or overwrite its last qualifying completion.
  if (!isNewYorkWeekdayDateKey(nowDateKey)) {
    return { currentStreak, changed: false };
  }

  if (!previousDateKey) {
    return { currentStreak: 1, changed: true };
  }

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

function applyDailyCompletion(
  currentStreak: number,
  lastCompletedAt: Date | null,
  now: Date,
) {
  return applyDailyCycle(
    currentStreak,
    lastCompletedAt ? getNewYorkDateKey(lastCompletedAt) : null,
    getNewYorkDateKey(now),
  );
}

function applyWeeklyCycle(
  currentStreak: number,
  previousWeekKey: string | null,
  currentWeekKey: string,
) {
  if (!previousWeekKey) {
    return { currentStreak: 1, changed: true };
  }

  const elapsedWeeks = countWeekKeysBetween(previousWeekKey, currentWeekKey);

  if (elapsedWeeks <= 0) {
    return { currentStreak, changed: false };
  }

  if (elapsedWeeks === 1) {
    return { currentStreak: currentStreak + 1, changed: true };
  }

  const missedWeeks = elapsedWeeks - 1;

  return {
    currentStreak: Math.max(0, currentStreak - missedWeeks * 2) + 1,
    changed: true,
  };
}

function applyWeeklyCompletion(
  currentStreak: number,
  lastCompletedAt: Date | null,
  now: Date,
) {
  return applyWeeklyCycle(
    currentStreak,
    lastCompletedAt ? getNewYorkWeekKey(lastCompletedAt) : null,
    getNewYorkWeekKey(now),
  );
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
  const sortedCompletions = [...completions].sort((left, right) => {
    const cycleComparison = left.completedOn.localeCompare(right.completedOn);
    return cycleComparison !== 0
      ? cycleComparison
      : left.completedAt.getTime() - right.completedAt.getTime();
  });

  const projection = sortedCompletions.reduce<DerivedStreak & {
    lastCompletedOn: string | null;
  }>(
    (projection, completion) => {
      const calculation =
        options.repeat === "daily"
          ? applyDailyCycle(
              projection.currentStreak,
              projection.lastCompletedOn,
              completion.completedOn,
            )
          : options.repeat === "weekly"
            ? applyWeeklyCycle(
                projection.currentStreak,
                projection.lastCompletedOn
                  ? getNewYorkWeekKeyFromDateKey(projection.lastCompletedOn)
                  : null,
                getNewYorkWeekKeyFromDateKey(completion.completedOn),
              )
            : { currentStreak: projection.currentStreak, changed: false };

      const earnedBadge =
        calculation.changed &&
        options.targetStreak > 0 &&
        calculation.currentStreak >= options.targetStreak;

      return {
        currentStreak: earnedBadge ? 0 : calculation.currentStreak,
        lastCompletedAt: calculation.changed
          ? completion.completedAt
          : projection.lastCompletedAt,
        lastCompletedOn: calculation.changed
          ? completion.completedOn
          : projection.lastCompletedOn,
        projectedPrestigeCount: earnedBadge
          ? projection.projectedPrestigeCount + 1
          : projection.projectedPrestigeCount,
      };
    },
    {
      currentStreak: 0,
      lastCompletedAt: null,
      lastCompletedOn: null,
      projectedPrestigeCount: 0,
    },
  );

  return {
    currentStreak: projection.currentStreak,
    lastCompletedAt: projection.lastCompletedAt,
    projectedPrestigeCount: projection.projectedPrestigeCount,
  };
}

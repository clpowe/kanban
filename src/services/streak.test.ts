import { describe, expect, test } from "bun:test";
import {
  applyCompletionToStreak,
  deriveStreakFromCompletions,
  type CompletionForStreak,
  type StreakInput,
} from "./streak";

const baseInput = (overrides: Partial<StreakInput> = {}): StreakInput => ({
  repeat: "daily",
  targetStreak: 20,
  currentStreak: 0,
  prestigeCount: 0,
  lastCompletedAt: null,
  ...overrides,
});

describe("applyCompletionToStreak", () => {
  test("first completion sets streak to 1", () => {
    const now = new Date("2026-07-09T16:00:00.000Z");

    const result = applyCompletionToStreak(baseInput(), now);

    expect(result).toEqual({
      currentStreak: 1,
      prestigeCount: 0,
      lastCompletedAt: now,
      earnedBadge: false,
      changed: true
    });
  });

  test("same New York date does not increment or move the streak anchor", () => {
    const lastCompletedAt = new Date("2026-07-09T08:00:00.000Z");
    const now = new Date("2026-07-09T16:00:00.000Z");

    const result = applyCompletionToStreak(
      baseInput({
        currentStreak: 3,
        lastCompletedAt,
      }),
      now,
    );

    expect(result.currentStreak).toBe(3);
    expect(result.lastCompletedAt).toEqual(lastCompletedAt);
    expect(result.earnedBadge).toBe(false);
    expect(result.changed).toBe(false);
  });

  test("daily consecutive New York weekdays increment by 1", () => {
    const now = new Date("2026-07-06T16:00:00.000Z");

    const result = applyCompletionToStreak(
      baseInput({
        currentStreak: 3,
        lastCompletedAt: new Date("2026-07-03T16:00:00.000Z"),
      }),
      now,
    );

    expect(result.currentStreak).toBe(4);
  });

  test("daily skipped weekdays apply missed day penalty", () => {
    const now = new Date("2026-07-09T16:00:00.000Z");

    const result = applyCompletionToStreak(
      baseInput({
        currentStreak: 7,
        lastCompletedAt: new Date("2026-07-06T16:00:00.000Z"),
      }),
      now,
    );

    expect(result.currentStreak).toBe(4);
  });

  test("same weekly completion within 72 hours does not increment", () => {
    const now = new Date("2026-07-09T15:00:00.000Z");

    const result = applyCompletionToStreak(
      baseInput({
        repeat: "weekly",
        currentStreak: 2,
        lastCompletedAt: new Date("2026-07-06T16:00:00.000Z"),
      }),
      now,
    );

    expect(result.currentStreak).toBe(2);
  });

  test("weekly completion within 240 hours increments by 1", () => {
    const now = new Date("2026-07-09T16:00:00.000Z");

    const result = applyCompletionToStreak(
      baseInput({
        repeat: "weekly",
        currentStreak: 2,
        lastCompletedAt: new Date("2026-07-01T16:00:00.000Z"),
      }),
      now,
    );

    expect(result.currentStreak).toBe(3);
  });

  test("weekly completion after more than 240 hours applies missed week penalty", () => {
    const now = new Date("2026-07-09T16:00:00.000Z");

    const result = applyCompletionToStreak(
      baseInput({
        repeat: "weekly",
        currentStreak: 7,
        lastCompletedAt: new Date("2026-06-18T16:00:00.000Z"),
      }),
      now,
    );

    expect(result.currentStreak).toBe(4);
  });

  test("hitting target streak resets current streak and returns badge milestone", () => {
    const now = new Date("2026-07-07T16:00:00.000Z");

    const result = applyCompletionToStreak(
      baseInput({
        targetStreak: 3,
        currentStreak: 2,
        lastCompletedAt: new Date("2026-07-06T16:00:00.000Z"),
      }),
      now,
    );

    expect(result).toEqual({
      currentStreak: 0,
      prestigeCount: 1,
      lastCompletedAt: now,
      earnedBadge: true,
      changed: true,
    });
  });
});

const completion = (
  completedOn: string,
  completedAt = new Date(`${completedOn}T16:00:00.000Z`),
): CompletionForStreak => ({
  completedOn,
  completedAt,
});

describe("deriveStreakFromCompletions", () => {
  test("returns an empty projection without completions", () => {
    const result = deriveStreakFromCompletions([], {
      repeat: "daily",
      targetStreak: 20,
    });

    expect(result).toEqual({
      currentStreak: 0,
      lastCompletedAt: null,
      projectedPrestigeCount: 0,
    });
  });

  test("sorts and counts consecutive daily New York dates", () => {
    const result = deriveStreakFromCompletions(
      [
        completion("2026-07-08"),
        completion("2026-07-06"),
        completion("2026-07-07"),
      ],
      {
        repeat: "daily",
        targetStreak: 20,
      },
    );

    expect(result).toEqual({
      currentStreak: 3,
      lastCompletedAt: new Date("2026-07-08T16:00:00.000Z"),
      projectedPrestigeCount: 0,
    });
  });

  test("applies the daily skipped-weekday penalty", () => {
    const result = deriveStreakFromCompletions(
      [
        completion("2026-06-26"),
        completion("2026-06-29"),
        completion("2026-06-30"),
        completion("2026-07-01"),
        completion("2026-07-02"),
        completion("2026-07-03"),
        completion("2026-07-06"),
        completion("2026-07-09"),
      ],
      {
        repeat: "daily",
        targetStreak: 20,
      },
    );

    expect(result.currentStreak).toBe(4);
    expect(result.projectedPrestigeCount).toBe(0);
  });

  test("keeps weekend completions neutral", () => {
    const result = deriveStreakFromCompletions(
      [
        completion("2026-07-10"),
        completion("2026-07-11"),
        completion("2026-07-13"),
      ],
      {
        repeat: "daily",
        targetStreak: 20,
      },
    );

    expect(result).toEqual({
      currentStreak: 2,
      lastCompletedAt: new Date("2026-07-13T16:00:00.000Z"),
      projectedPrestigeCount: 0,
    });
  });

  test("applies the existing weekly gap rules", () => {
    const result = deriveStreakFromCompletions(
      [
        completion("2026-07-01"),
        completion("2026-07-03"),
        completion("2026-07-09"),
        completion("2026-07-30"),
      ],
      {
        repeat: "weekly",
        targetStreak: 20,
      },
    );

    expect(result).toEqual({
      currentStreak: 1,
      lastCompletedAt: new Date("2026-07-30T16:00:00.000Z"),
      projectedPrestigeCount: 0,
    });
  });

  test("resets the current streak after reaching the target", () => {
    const result = deriveStreakFromCompletions(
      [
        completion("2026-07-06"),
        completion("2026-07-07"),
        completion("2026-07-08"),
      ],
      {
        repeat: "daily",
        targetStreak: 3,
      },
    );

    expect(result).toEqual({
      currentStreak: 0,
      lastCompletedAt: new Date("2026-07-08T16:00:00.000Z"),
      projectedPrestigeCount: 1,
    });
  });

  test("continues the next cycle after earning a badge", () => {
    const result = deriveStreakFromCompletions(
      [
        completion("2026-07-06"),
        completion("2026-07-07"),
        completion("2026-07-08"),
        completion("2026-07-09"),
        completion("2026-07-10"),
      ],
      {
        repeat: "daily",
        targetStreak: 3,
      },
    );

    expect(result).toEqual({
      currentStreak: 2,
      lastCompletedAt: new Date("2026-07-10T16:00:00.000Z"),
      projectedPrestigeCount: 1,
    });
  });
});

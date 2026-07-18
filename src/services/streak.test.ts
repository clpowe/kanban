import { describe, expect, test } from "bun:test";
import { applyCompletionToStreak, type StreakInput } from "./streak";

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
    });
  });

  test("same daily completion within 12 hours does not increment", () => {
    const now = new Date("2026-07-09T16:00:00.000Z");

    const result = applyCompletionToStreak(
      baseInput({
        currentStreak: 3,
        lastCompletedAt: new Date("2026-07-09T08:00:00.000Z"),
      }),
      now,
    );

    expect(result.currentStreak).toBe(3);
    expect(result.lastCompletedAt).toEqual(now);
    expect(result.earnedBadge).toBe(false);
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
    });
  });
});

import { describe, expect, test } from "bun:test";
import { isVisibleStreak } from "./streak-visibility";

describe("isVisibleStreak", () => {
  test("shows only explicitly enabled streak goals", () => {
    expect(isVisibleStreak({ streakEnabled: true })).toBe(true);
    expect(isVisibleStreak({ streakEnabled: false })).toBe(false);
    expect(isVisibleStreak(null)).toBe(false);
    expect(isVisibleStreak(undefined)).toBe(false);
  });
});

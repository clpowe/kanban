import { describe, expect, test } from "bun:test";
import {
  countWeekdaysBetween,
  getEligibleDailyCycleKey,
  getNewYorkDateKey,
  getNewYorkWeekKey,
  getNextEligibleDailyCycleKey,
  isRecurringRolloverTime,
} from "./new-york-time";

describe("New York task cycles", () => {
  test("uses Monday as the weekly cycle key", () => {
    expect(getNewYorkWeekKey(new Date("2026-08-03T16:00:00Z"))).toBe(
      "2026-08-03",
    );
    expect(getNewYorkWeekKey(new Date("2026-08-09T16:00:00Z"))).toBe(
      "2026-08-03",
    );
  });

  test("returns only weekday daily cycle keys", () => {
    expect(getEligibleDailyCycleKey(new Date("2026-08-08T16:00:00Z"))).toBeNull();
    expect(getNextEligibleDailyCycleKey(new Date("2026-08-08T16:00:00Z"))).toBe(
      "2026-08-10",
    );
    expect(getEligibleDailyCycleKey(new Date("2026-08-10T16:00:00Z"))).toBe(
      "2026-08-10",
    );
  });

  test("counts Friday to Monday as one eligible daily period", () => {
    expect(countWeekdaysBetween("2026-08-07", "2026-08-10")).toBe(1);
  });

  test("accepts only the EDT rollover trigger in summer", () => {
    expect(isRecurringRolloverTime(new Date("2026-07-01T04:05:00Z"))).toBe(true);
    expect(isRecurringRolloverTime(new Date("2026-07-01T05:05:00Z"))).toBe(false);
  });

  test("accepts only the EST rollover trigger in winter", () => {
    expect(isRecurringRolloverTime(new Date("2026-01-05T04:05:00Z"))).toBe(false);
    expect(isRecurringRolloverTime(new Date("2026-01-05T05:05:00Z"))).toBe(true);
  });

  test("keeps New York date keys stable across DST transitions", () => {
    expect(getNewYorkDateKey(new Date("2026-03-08T06:59:00Z"))).toBe("2026-03-08");
    expect(getNewYorkDateKey(new Date("2026-03-08T07:01:00Z"))).toBe("2026-03-08");
    expect(getNewYorkDateKey(new Date("2026-11-01T05:30:00Z"))).toBe("2026-11-01");
    expect(getNewYorkDateKey(new Date("2026-11-01T06:30:00Z"))).toBe("2026-11-01");
  });
});

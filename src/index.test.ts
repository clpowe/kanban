import { describe, expect, test } from "bun:test";
import { handleScheduled } from "./index";

const dependencies = (calls: string[]) => ({
  rolloverDailyTasks: async () => {
    calls.push("reconcile");
  },
  archiveCompletedTasks: async () => {
    calls.push("archive");
  },
});

describe("handleScheduled", () => {
  test("dispatches exactly one EDT recurrence trigger in summer", async () => {
    const calls: string[] = [];

    await handleScheduled(
      {
        cron: "5 4 * * *",
        scheduledTime: Date.parse("2026-07-01T04:05:00Z"),
      } as ScheduledController,
      {} as never,
      dependencies(calls),
    );
    await handleScheduled(
      {
        cron: "5 5 * * *",
        scheduledTime: Date.parse("2026-07-01T05:05:00Z"),
      } as ScheduledController,
      {} as never,
      dependencies(calls),
    );

    expect(calls).toEqual(["reconcile"]);
  });

  test("dispatches exactly one EST recurrence trigger in winter", async () => {
    const calls: string[] = [];

    await handleScheduled(
      {
        cron: "5 4 * * *",
        scheduledTime: Date.parse("2026-01-05T04:05:00Z"),
      } as ScheduledController,
      {} as never,
      dependencies(calls),
    );
    await handleScheduled(
      {
        cron: "5 5 * * *",
        scheduledTime: Date.parse("2026-01-05T05:05:00Z"),
      } as ScheduledController,
      {} as never,
      dependencies(calls),
    );

    expect(calls).toEqual(["reconcile"]);
  });

  test("ignores unrelated cron expressions", async () => {
    const calls: string[] = [];

    await handleScheduled(
      {
        cron: "0 12 * * *",
        scheduledTime: Date.parse("2026-07-01T12:00:00Z"),
      } as ScheduledController,
      {} as never,
      dependencies(calls),
    );

    expect(calls).toEqual([]);
  });
});

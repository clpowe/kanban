import { describe, expect, test } from "bun:test";
import { app, handleScheduled } from "./index";

test("registers protected-route session middleware exactly once", () => {
  expect(
    app.routes.filter(
      (route) => route.method === "ALL" && route.path === "/api/*",
    ),
  ).toHaveLength(1);
  expect(
    app.routes.filter(
      (route) => route.method === "ALL" && route.path === "/session/*",
    ),
  ).toHaveLength(1);
});

const dependencies = (calls: string[]) => ({
  reconcileRecurringTasks: async () => {
    calls.push("reconcile");
    return {
      cycleKey: "2026-01-01",
      duplicate: false,
      archived: 0,
      created: 0,
    };
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
        scheduledTime: Date.parse("2026-01-07T04:05:00Z"),
      } as ScheduledController,
      {} as never,
      dependencies(calls),
    );
    await handleScheduled(
      {
        cron: "5 5 * * *",
        scheduledTime: Date.parse("2026-01-07T05:05:00Z"),
      } as ScheduledController,
      {} as never,
      dependencies(calls),
    );

    expect(calls).toEqual(["reconcile"]);
  });

  test.each([
    [
      "spring-forward",
      "2026-03-08T04:05:00Z",
      "2026-03-08T05:05:00Z",
    ],
    [
      "fall-back",
      "2026-11-01T04:05:00Z",
      "2026-11-01T05:05:00Z",
    ],
  ])("dispatches exactly once across the %s transition", async (_, first, second) => {
    const calls: string[] = [];

    await handleScheduled(
      {
        cron: "5 4 * * *",
        scheduledTime: Date.parse(first),
      } as ScheduledController,
      {} as never,
      dependencies(calls),
    );
    await handleScheduled(
      {
        cron: "5 5 * * *",
        scheduledTime: Date.parse(second),
      } as ScheduledController,
      {} as never,
      dependencies(calls),
    );

    expect(calls.filter((call) => call === "reconcile")).toEqual(["reconcile"]);
  });

  test("archives only non-recurring completed tasks on New York Monday", async () => {
    const calls: string[] = [];

    await handleScheduled(
      {
        cron: "5 4 * * *",
        scheduledTime: Date.parse("2026-08-10T04:05:00Z"),
      } as ScheduledController,
      {} as never,
      dependencies(calls),
    );
    await handleScheduled(
      {
        cron: "5 5 * * *",
        scheduledTime: Date.parse("2026-08-10T05:05:00Z"),
      } as ScheduledController,
      {} as never,
      dependencies(calls),
    );

    expect(calls).toEqual(["reconcile", "archive"]);
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

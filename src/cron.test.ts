import { expect, test } from "bun:test";
import * as cron from "./cron";

test("cron exposes a single idempotent recurrence reconciler", () => {
  expect(
    (cron as Record<string, unknown>).reconcileRecurringTasks,
  ).toBeFunction();
});

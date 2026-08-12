import { getDB, type Env } from "./db/client";
import {
  reconcileRecurringTasks as reconcileRecurringOccurrences,
  type RecurrenceReconciliationResult,
} from "./services/recurrence.service";
import { archiveDoneTasks } from "./services/task.service";

export const reconcileRecurringTasks = async (
  env: Env,
  now: Date = new Date(),
): Promise<RecurrenceReconciliationResult> => {
  const db = getDB(env.Bindings);
  const result = await reconcileRecurringOccurrences(db, now);

  console.log("[CRON] Recurrence reconciliation", result);
  return result;
};

// Transitional alias for the existing scheduled entry point. Task 6 switches
// dispatch to the reconciler name while preserving a type-safe intermediate commit.
export const rolloverDailyTasks = async (env: Env, now: Date = new Date()) => {
  await reconcileRecurringTasks(env, now);
};

export const archiveCompletedTasks = async (env: Env) => {
  const db = getDB(env.Bindings);
  await archiveDoneTasks(db);

  console.log("[CRON] Non-recurring completed tasks archived");
};

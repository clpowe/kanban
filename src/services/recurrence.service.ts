import { and, eq, isNotNull, ne } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { Database } from "../db/client";
import { rolloverRuns, taskAchievements, tasks } from "../db/schema";
import {
  getEligibleDailyCycleKey,
  getNewYorkDateKey,
  getNewYorkWeekKey,
  getNextEligibleDailyCycleKey,
} from "../utils/new-york-time";

type Goal = typeof taskAchievements.$inferSelect;
type TaskOccurrence = typeof tasks.$inferSelect;

export type RecurrenceReconciliationResult = {
  cycleKey: string;
  duplicate: boolean;
  archived: number;
  created: number;
};

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Error &&
    /(UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE|SQLITE_CONSTRAINT[^:]*:.*UNIQUE)/i.test(
      error.message,
    )
  );
}

async function hasRolloverReceipt(db: Database, cycleKey: string) {
  return Boolean(
    await db
      .select({ id: rolloverRuns.id })
      .from(rolloverRuns)
      .where(
        and(
          eq(rolloverRuns.rolloverType, "recurrence"),
          eq(rolloverRuns.cycleKey, cycleKey),
        ),
      )
      .get(),
  );
}

function occurrenceValues(
  goal: Goal,
  previous: TaskOccurrence | undefined,
  cycleDate: string,
) {
  const title = goal.taskTitle ?? previous?.title;
  const priority = goal.taskPriority ?? previous?.priority;
  const value = goal.taskValue ?? previous?.value;
  const repeat = goal.cadence ?? previous?.repeat;

  if (!title || !priority || value == null) {
    throw new Error(`Recurring goal ${goal.id} is missing task configuration`);
  }
  if (repeat !== "daily" && repeat !== "weekly") {
    throw new Error(`Recurring goal ${goal.id} has an invalid cadence`);
  }

  return {
    title,
    priority,
    value,
    repeat,
    assigneeId: goal.assigneeId ?? previous?.assigneeId ?? null,
    achievementId: goal.id,
    cycleDate,
    status: "todo" as const,
  };
}

export async function reconcileRecurringTasks(
  db: Database,
  now: Date,
): Promise<RecurrenceReconciliationResult> {
  const cycleKey = getNewYorkDateKey(now);
  const duplicateResult: RecurrenceReconciliationResult = {
    cycleKey,
    duplicate: true,
    archived: 0,
    created: 0,
  };

  if (await hasRolloverReceipt(db, cycleKey)) return duplicateResult;

  const dailyCycleKey =
    getEligibleDailyCycleKey(now) ?? getNextEligibleDailyCycleKey(now);
  const weeklyCycleKey = getNewYorkWeekKey(now);
  const goals = await db
    .select()
    .from(taskAchievements)
    .where(eq(taskAchievements.active, true));
  const activeOccurrences = await db
    .select()
    .from(tasks)
    .where(and(ne(tasks.status, "archived"), isNotNull(tasks.achievementId)));
  const activeByGoal = new Map<number, TaskOccurrence>();

  for (const occurrence of activeOccurrences) {
    if (occurrence.achievementId != null) {
      activeByGoal.set(occurrence.achievementId, occurrence);
    }
  }

  const mutations: BatchItem<"sqlite">[] = [];
  let archived = 0;
  let created = 0;

  for (const goal of goals) {
    if (goal.cadence !== "daily" && goal.cadence !== "weekly") continue;

    const targetCycleKey =
      goal.cadence === "daily" ? dailyCycleKey : weeklyCycleKey;
    const current = activeByGoal.get(goal.id);

    if (current?.cycleDate === targetCycleKey) continue;

    if (current) {
      const archiveReason = current.status === "done" ? "completed" : "missed";
      mutations.push(
        db
          .update(tasks)
          .set({
            status: "archived",
            archivedAt: now,
            archiveReason,
            completedAt:
              archiveReason === "completed"
                ? (current.completedAt ?? now)
                : current.completedAt,
          })
          .where(and(eq(tasks.id, current.id), ne(tasks.status, "archived"))),
      );
      archived += 1;
    }

    mutations.push(
      db
        .insert(tasks)
        .values(occurrenceValues(goal, current, targetCycleKey)),
    );
    created += 1;
  }

  const insertReceipt = db.insert(rolloverRuns).values({
    rolloverType: "recurrence",
    cycleKey,
    startedAt: now,
    completedAt: now,
  });

  try {
    const statements: [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]] = [
      insertReceipt,
      ...mutations,
    ];
    await db.batch(statements);
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;
    if (!(await hasRolloverReceipt(db, cycleKey))) throw error;
    return duplicateResult;
  }

  return {
    cycleKey,
    duplicate: false,
    archived,
    created,
  };
}

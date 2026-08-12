import { and, eq, isNull, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import type { Database } from "../db/client";
import {
  earnedBadges,
  pointEntries,
  taskAchievements,
  taskCompletions,
  tasks,
  users,
} from "../db/schema";
import { getNewYorkDateKey } from "../utils/new-york-time";
import { deriveStreakFromCompletions } from "./streak";
import { getTaskById, type StreakMilestone } from "./task.service";

type TaskRow = typeof tasks.$inferSelect;
type CompletionRow = typeof taskCompletions.$inferSelect;

export type CompleteTaskResult = {
  task: NonNullable<Awaited<ReturnType<typeof getTaskById>>>;
  completion: CompletionRow;
  duplicate: boolean;
  milestone: StreakMilestone | null;
};

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Error &&
    /(UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE|SQLITE_CONSTRAINT[^:]*:.*UNIQUE)/i.test(
      error.message,
    )
  );
}

async function findEstablishedCompletion(
  db: Database,
  task: TaskRow,
  eventId: string,
  completedOn: string,
) {
  const eventCompletion = await db
    .select()
    .from(taskCompletions)
    .where(eq(taskCompletions.eventId, eventId))
    .get();

  if (eventCompletion) {
    if (eventCompletion.taskId !== task.id) {
      throw new Error("Completion event ID has already been used");
    }
    return eventCompletion;
  }

  if (task.achievementId != null) {
    return db
      .select()
      .from(taskCompletions)
      .where(
        and(
          eq(taskCompletions.achievementId, task.achievementId),
          eq(taskCompletions.completedOn, completedOn),
          isNull(taskCompletions.canceledAt),
        ),
      )
      .get();
  }

  return db
    .select()
    .from(taskCompletions)
    .where(
      and(
        eq(taskCompletions.taskId, task.id),
        isNull(taskCompletions.canceledAt),
      ),
    )
    .get();
}

async function duplicateResult(
  db: Database,
  task: TaskRow,
  completion: CompletionRow,
): Promise<CompleteTaskResult> {
  const hydratedTask = await getTaskById(db, task.id);
  if (!hydratedTask) throw new Error("Completed task no longer exists");

  return {
    task: hydratedTask,
    completion,
    duplicate: true,
    milestone: null,
  };
}

export async function completeTask(
  db: Database,
  taskId: number,
  eventId: string,
  now: Date = new Date(),
): Promise<CompleteTaskResult> {
  const normalizedEventId = eventId.trim();
  if (!normalizedEventId) throw new Error("Completion event ID is required");

  const row = await db
    .select({ task: tasks, achievement: taskAchievements })
    .from(tasks)
    .leftJoin(taskAchievements, eq(tasks.achievementId, taskAchievements.id))
    .where(eq(tasks.id, taskId))
    .get();

  if (!row) throw new Error("Task not found");
  const { task, achievement } = row;
  if (task.status === "archived") {
    throw new Error("Archived task history cannot be completed");
  }
  if (task.assigneeId == null) {
    throw new Error("Task must have an assignee before completion");
  }
  if (task.cycleDate && task.cycleDate > getNewYorkDateKey(now)) {
    throw new Error(`Task is not available until ${task.cycleDate}`);
  }
  if (task.achievementId != null && !achievement) {
    throw new Error("Recurring task is missing its goal");
  }

  const completedOn =
    task.achievementId != null
      ? task.cycleDate
      : getNewYorkDateKey(now);
  if (!completedOn) {
    throw new Error("Recurring task is missing its cycle date");
  }

  const established = await findEstablishedCompletion(
    db,
    task,
    normalizedEventId,
    completedOn,
  );
  if (established) return duplicateResult(db, task, established);

  let milestone: StreakMilestone | null = null;
  let achievementUpdate: BatchItem<"sqlite"> | null = null;
  let badgeInsert: BatchItem<"sqlite"> | null = null;

  if (achievement?.streakEnabled) {
    const previousCompletions = await db
      .select({
        completedOn: taskCompletions.completedOn,
        completedAt: taskCompletions.completedAt,
      })
      .from(taskCompletions)
      .where(
        and(
          eq(taskCompletions.achievementId, achievement.id),
          isNull(taskCompletions.canceledAt),
        ),
      );
    const projectionOptions = {
      repeat: achievement.cadence ?? task.repeat,
      targetStreak: achievement.targetStreak,
    };
    const beforeProjection = deriveStreakFromCompletions(
      previousCompletions,
      projectionOptions,
    );
    const projection = deriveStreakFromCompletions(
      [...previousCompletions, { completedOn, completedAt: now }],
      projectionOptions,
    );
    const earnedBadge =
      projection.projectedPrestigeCount >
      beforeProjection.projectedPrestigeCount;

    achievementUpdate = db
      .update(taskAchievements)
      .set({
        currentStreak: projection.currentStreak,
        prestigeCount: projection.projectedPrestigeCount,
        lastCompletedAt: projection.lastCompletedAt,
        missedDaysInARow: 0,
        updatedAt: now,
      })
      .where(eq(taskAchievements.id, achievement.id));

    if (earnedBadge) {
      const prestigeLevel = projection.projectedPrestigeCount;
      badgeInsert = db.insert(earnedBadges).values({
        userId: task.assigneeId,
        achievementId: achievement.id,
        badgeName: achievement.name,
        prestigeLevel,
        earnedAt: now,
        taskCompletionId: sql<number>`(
          select ${taskCompletions.id}
          from ${taskCompletions}
          where ${taskCompletions.eventId} = ${normalizedEventId}
        )`,
      });
      milestone = {
        achievementId: achievement.id,
        badgeName: achievement.name,
        streak: achievement.targetStreak,
        prestigeLevel,
      };
    }
  }

  const insertCompletion = db.insert(taskCompletions).values({
    eventId: normalizedEventId,
    taskId: task.id,
    achievementId: task.achievementId,
    userId: task.assigneeId,
    completedOn,
    completedAt: now,
    createdAt: now,
  });
  const insertPoints = db.insert(pointEntries).values({
    eventId: normalizedEventId,
    userId: task.assigneeId,
    delta: task.value,
    reason: "task_completed",
    taskCompletionId: sql<number>`(
      select ${taskCompletions.id}
      from ${taskCompletions}
      where ${taskCompletions.eventId} = ${normalizedEventId}
    )`,
    taskId: task.id,
    achievementId: task.achievementId,
    createdAt: now,
  });
  const refreshPoints = db
    .update(users)
    .set({
      points: sql<number>`coalesce((
        select sum(${pointEntries.delta})
        from ${pointEntries}
        where ${pointEntries.userId} = ${task.assigneeId}
      ), 0)`,
    })
    .where(eq(users.id, task.assigneeId));
  const updateOccurrence = db
    .update(tasks)
    .set({ status: "done", completedAt: now })
    .where(eq(tasks.id, task.id));
  const statements: [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]] = [
    insertCompletion,
    insertPoints,
    refreshPoints,
    updateOccurrence,
  ];
  if (achievementUpdate) statements.push(achievementUpdate);
  if (badgeInsert) statements.push(badgeInsert);

  try {
    await db.batch(statements);
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    const competingCompletion = await findEstablishedCompletion(
      db,
      task,
      normalizedEventId,
      completedOn,
    );
    if (!competingCompletion) throw error;
    return duplicateResult(db, task, competingCompletion);
  }

  const completion = await db
    .select()
    .from(taskCompletions)
    .where(eq(taskCompletions.eventId, normalizedEventId))
    .get();
  const hydratedTask = await getTaskById(db, task.id);
  if (!completion || !hydratedTask) {
    throw new Error("Completed task could not be reloaded");
  }

  return {
    task: hydratedTask,
    completion,
    duplicate: false,
    milestone,
  };
}

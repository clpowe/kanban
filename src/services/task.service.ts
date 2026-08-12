import { and, eq, isNull, lte, ne, or, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { Temporal } from "@js-temporal/polyfill";
import { tasks, users, taskAchievements } from "../db/schema";
import {
  getEligibleDailyCycleKey,
  getNewYorkDateKey,
  getNewYorkWeekKey,
  getNextEligibleDailyCycleKey,
} from "../utils/new-york-time";
import {
  requireCreateTaskInput,
  requireTaskUpdateInput,
  TaskInputError,
  type TaskCadenceInput,
} from "../utils/task-input";
import { type TaskStatus } from "../utils/task-status";
import type { Database } from "../db/client";

export type StreakMilestone = {
  achievementId: number;
  badgeName: string;
  streak: number;
  prestigeLevel: number;
};

const priorityPoints = {
  high: 10,
  medium: 5,
  low: 1,
} as const;

function recurringCycleDate(cadence: Exclude<TaskCadenceInput, "none">, now: Date) {
  return cadence === "daily"
    ? (getEligibleDailyCycleKey(now) ?? getNextEligibleDailyCycleKey(now))
    : getNewYorkWeekKey(now);
}

function nextCycleDate(
  cycleDate: string,
  cadence: Exclude<TaskCadenceInput, "none">,
) {
  let next = Temporal.PlainDate.from(cycleDate).add({
    days: cadence === "weekly" ? 7 : 1,
  });
  while (cadence === "daily" && next.dayOfWeek > 5) {
    next = next.add({ days: 1 });
  }
  return next.toString();
}

async function findAvailableCycleDate(
  db: Database,
  taskId: number,
  achievementId: number,
  cadence: Exclude<TaskCadenceInput, "none">,
  now: Date,
) {
  let candidate = recurringCycleDate(cadence, now);

  for (let attempt = 0; attempt < 400; attempt += 1) {
    const conflict = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(
        and(
          eq(tasks.achievementId, achievementId),
          eq(tasks.cycleDate, candidate),
          ne(tasks.id, taskId),
        ),
      )
      .get();
    if (!conflict) return candidate;
    candidate = nextCycleDate(candidate, cadence);
  }

  throw new TaskInputError("Could not find an available recurring cycle");
}

async function assertChildAssignee(db: Database, assigneeId: number | null) {
  if (assigneeId === null) return;

  const assignee = await db
    .select()
    .from(users)
    .where(eq(users.id, assigneeId))
    .get();
  if (!assignee) throw new TaskInputError("Task assignee was not found");
  if (assignee.type === "parent") {
    throw new TaskInputError("Tasks cannot be assigned to parents");
  }
}

export const getActiveTasks = async (db: Database, now: Date = new Date()) => {
  const todayKey = getNewYorkDateKey(now);
  const result = await db
    .select({
      task: tasks,
      achievement: taskAchievements,
    })
    .from(tasks)
    .leftJoin(taskAchievements, eq(tasks.achievementId, taskAchievements.id))
    .where(
      and(
        ne(tasks.status, "archived"),
        or(isNull(tasks.cycleDate), lte(tasks.cycleDate, todayKey)),
      ),
    );

  return result.map((r: any) => ({
    ...r.task,
    achievement: r.achievement,
  }));
};

export const getArchivedTasks = async (db: Database, assigneeId?: number | null) => {
  if (assigneeId) {
    return db
      .select()
      .from(tasks)
      .where(and(eq(tasks.status, "archived"), eq(tasks.assigneeId, assigneeId)));
  }

  return db.select().from(tasks).where(eq(tasks.status, "archived"));
};

export const getTaskById = async (db: Database, id: number) => {
  const r = await db
    .select({
      task: tasks,
      achievement: taskAchievements,
    })
    .from(tasks)
    .leftJoin(taskAchievements, eq(tasks.achievementId, taskAchievements.id))
    .where(eq(tasks.id, id))
    .get();
  if (!r) return null;
  return {
    ...r.task,
    achievement: r.achievement,
  };
};

export const createTask = async (
  db: Database,
  input: unknown,
  now: Date = new Date(),
) => {
  const data = requireCreateTaskInput(input);
  const { title, priority, repeat, assigneeId } = data;
  await assertChildAssignee(db, assigneeId);

  if (repeat === "none") {
    const [insertedTask] = await db
      .insert(tasks)
      .values({
        title,
        priority,
        value: priorityPoints[priority],
        repeat,
        status: "todo",
        assigneeId,
      })
      .returning();

    if (!insertedTask) throw new Error("Failed to create task");
    return [await getTaskById(db, insertedTask.id)];
  }

  const recurrenceKey = `recurrence:${crypto.randomUUID()}`;
  const achievementName = data.achievementName ?? "";
  const cycleDate = recurringCycleDate(repeat, now);
  const taskValue = priorityPoints[priority];

  const insertGoal = db.insert(taskAchievements).values({
    recurrenceKey,
    cadence: repeat,
    taskTitle: title,
    taskPriority: priority,
    taskValue,
    assigneeId,
    streakEnabled: data.streakEnabled,
    active: true,
    name: achievementName || `${title} Streak`,
    targetStreak: data.targetStreak,
    currentStreak: 0,
    prestigeCount: 0,
    createdAt: now,
    updatedAt: now,
  });

  const insertOccurrence = db.insert(tasks).values({
    title,
    priority,
    value: taskValue,
    repeat,
    status: "todo",
    assigneeId,
    achievementId: sql<number>`(
      select ${taskAchievements.id}
      from ${taskAchievements}
      where ${taskAchievements.recurrenceKey} = ${recurrenceKey}
    )`,
    cycleDate,
  });

  await db.batch([insertGoal, insertOccurrence]);

  const insertedTask = await db
    .select({ id: tasks.id })
    .from(tasks)
    .innerJoin(taskAchievements, eq(tasks.achievementId, taskAchievements.id))
    .where(eq(taskAchievements.recurrenceKey, recurrenceKey))
    .get();

  if (!insertedTask) throw new Error("Failed to create recurring task");
  return [await getTaskById(db, insertedTask.id)];
};

export const updateTask = async (
  db: Database,
  id: number,
  input: unknown,
  now: Date = new Date(),
) => {
  const updates = requireTaskUpdateInput(input);
  const row = await db
    .select({ task: tasks, achievement: taskAchievements })
    .from(tasks)
    .leftJoin(taskAchievements, eq(tasks.achievementId, taskAchievements.id))
    .where(eq(tasks.id, id))
    .get();
  if (!row) return null;

  const { task, achievement } = row;
  if (task.status === "archived" && task.achievementId != null) {
    throw new TaskInputError("Archived recurring history cannot be edited");
  }

  const title = updates.title ?? task.title;
  const priority = updates.priority ?? task.priority;
  const repeat = updates.repeat ?? task.repeat ?? "none";
  const assigneeId =
    "assigneeId" in updates ? (updates.assigneeId ?? null) : task.assigneeId;
  await assertChildAssignee(db, assigneeId);

  const currentlyRecurring = task.achievementId != null && achievement != null;
  const nextRecurring = repeat === "daily" || repeat === "weekly";
  const streakEnabled =
    updates.streakEnabled ?? achievement?.streakEnabled ?? false;
  if (!nextRecurring && streakEnabled) {
    throw new TaskInputError("Streak tracking requires a recurring task");
  }
  const achievementName =
    updates.achievementName?.trim() ||
    achievement?.name ||
    `${title} Streak`;
  const targetStreak = updates.targetStreak ?? achievement?.targetStreak ?? 20;
  const taskValues = {
    title,
    priority,
    value: priorityPoints[priority],
    repeat,
    assigneeId,
  };

  if (currentlyRecurring && nextRecurring) {
    const cycleDate =
      task.repeat === repeat && task.cycleDate
        ? task.cycleDate
        : await findAvailableCycleDate(
            db,
            task.id,
            achievement.id,
            repeat,
            now,
          );
    const updateGoal = db
      .update(taskAchievements)
      .set({
        cadence: repeat,
        taskTitle: title,
        taskPriority: priority,
        taskValue: priorityPoints[priority],
        assigneeId,
        streakEnabled,
        active: true,
        name: achievementName,
        targetStreak,
        updatedAt: now,
      })
      .where(eq(taskAchievements.id, achievement.id));
    const updateOccurrence = db
      .update(tasks)
      .set({ ...taskValues, cycleDate })
      .where(eq(tasks.id, task.id));
    await db.batch([updateGoal, updateOccurrence]);
    return getTaskById(db, task.id);
  }

  if (!currentlyRecurring && nextRecurring) {
    const recurrenceKey = `recurrence:${crypto.randomUUID()}`;
    const cycleDate = recurringCycleDate(repeat, now);
    const insertGoal = db.insert(taskAchievements).values({
      recurrenceKey,
      cadence: repeat,
      taskTitle: title,
      taskPriority: priority,
      taskValue: priorityPoints[priority],
      assigneeId,
      streakEnabled,
      active: true,
      name: achievementName,
      targetStreak,
      currentStreak: 0,
      prestigeCount: 0,
      createdAt: now,
      updatedAt: now,
    });
    const linkOccurrence = db
      .update(tasks)
      .set({
        ...taskValues,
        achievementId: sql<number>`(
          select ${taskAchievements.id}
          from ${taskAchievements}
          where ${taskAchievements.recurrenceKey} = ${recurrenceKey}
        )`,
        cycleDate,
      })
      .where(eq(tasks.id, task.id));
    const statements: [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]] = [
      insertGoal,
      linkOccurrence,
    ];
    await db.batch(statements);
    return getTaskById(db, task.id);
  }

  if (currentlyRecurring && !nextRecurring) {
    const deactivateGoal = db
      .update(taskAchievements)
      .set({ active: false, updatedAt: now })
      .where(eq(taskAchievements.id, achievement.id));
    const detachOccurrence = db
      .update(tasks)
      .set({
        ...taskValues,
        repeat: "none",
        achievementId: null,
        cycleDate: null,
      })
      .where(eq(tasks.id, task.id));
    await db.batch([deactivateGoal, detachOccurrence]);
    return getTaskById(db, task.id);
  }

  await db.update(tasks).set(taskValues).where(eq(tasks.id, task.id));
  return getTaskById(db, task.id);
};

export const updateTaskStatus = async (
  db: Database,
  id: number,
  status: TaskStatus,
  now: Date = new Date(),
): Promise<{ milestone: StreakMilestone | null }> => {
  const existing = await db.select().from(tasks).where(eq(tasks.id, id)).get();

  if (!existing) return { milestone: null };

  const prevStatus = existing.status;
  const nextStatus = status ?? prevStatus;

  if (
    prevStatus === "archived" &&
    existing.achievementId != null &&
    nextStatus !== "archived"
  ) {
    throw new TaskInputError("Archived recurring history cannot be restored");
  }

  if (
    nextStatus === "done" &&
    existing.cycleDate &&
    existing.cycleDate > getNewYorkDateKey(now)
  ) {
    throw new Error(`Task is not available until ${existing.cycleDate}`);
  }

  if (prevStatus !== "done" && nextStatus === "done") {
    throw new Error("Task completion requires an event ID");
  }

  if (
    prevStatus === "done" &&
    nextStatus !== "done" &&
    nextStatus !== "archived"
  ) {
    throw new Error("Undo completion requires an event ID");
  }

  await db.update(tasks).set({ status }).where(eq(tasks.id, id));
  return { milestone: null };
};

export const archiveDoneTasks = async (db: Database) => {
  await db
    .update(tasks)
    .set({ status: "archived" })
    .where(and(eq(tasks.status, "done"), isNull(tasks.achievementId)));
};

export const deleteTask = async (db: Database, id: number) => {
  await db.delete(tasks).where(eq(tasks.id, id));
};

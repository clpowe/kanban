export const taskPriorities = ["high", "medium", "low"] as const;
export const taskCadences = ["daily", "weekly", "none"] as const;

export type TaskPriorityInput = (typeof taskPriorities)[number];
export type TaskCadenceInput = (typeof taskCadences)[number];

export type ParsedCreateTaskInput = {
  title: string;
  priority: TaskPriorityInput;
  repeat: TaskCadenceInput;
  assigneeId: number | null;
  achievementName?: string;
  targetStreak: number;
  streakEnabled: boolean;
};

export type ParsedTaskUpdateInput = {
  title?: string;
  priority?: TaskPriorityInput;
  repeat?: TaskCadenceInput;
  assigneeId?: number | null;
  achievementName?: string;
  targetStreak?: number;
  streakEnabled?: boolean;
};

export type TaskInputResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

export class TaskInputError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string) {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function parsePriority(value: unknown): TaskInputResult<TaskPriorityInput> {
  if (value === "high" || value === "medium" || value === "low") {
    return { ok: true, value };
  }
  return { ok: false, error: "Invalid task priority" };
}

function parseCadence(value: unknown): TaskInputResult<TaskCadenceInput> {
  if (value === "daily" || value === "weekly" || value === "none") {
    return { ok: true, value };
  }
  return { ok: false, error: "Invalid task repeat cadence" };
}

function parseAssignee(value: unknown): TaskInputResult<number | null> {
  if (value === null || value === undefined || value === "") {
    return { ok: true, value: null };
  }

  if (typeof value !== "number" && typeof value !== "string") {
    return { ok: false, error: "Invalid task assignee" };
  }
  const parsed = typeof value === "number" ? value : Number(value.trim());
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { ok: false, error: "Invalid task assignee" };
  }
  return { ok: true, value: parsed };
}

function parseTarget(value: unknown): TaskInputResult<number> {
  if (typeof value !== "number" && typeof value !== "string") {
    return { ok: false, error: "Target streak must be a positive integer" };
  }
  const parsed = typeof value === "number" ? value : Number(value.trim());
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return { ok: false, error: "Target streak must be a positive integer" };
  }
  return { ok: true, value: parsed };
}

function parseName(value: unknown): TaskInputResult<string> {
  if (typeof value !== "string") {
    return { ok: false, error: "Streak name must be text" };
  }
  return { ok: true, value: value.trim() };
}

export function parseCreateTaskInput(
  input: unknown,
): TaskInputResult<ParsedCreateTaskInput> {
  if (!isRecord(input)) {
    return { ok: false, error: "Task payload must be an object" };
  }

  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) return { ok: false, error: "Task title is required" };

  const priority = parsePriority(input.priority);
  if (!priority.ok) return priority;
  const repeat = parseCadence(input.repeat ?? "none");
  if (!repeat.ok) return repeat;
  const assigneeId = parseAssignee(input.assigneeId);
  if (!assigneeId.ok) return assigneeId;

  let achievementName = "";
  if (hasOwn(input, "achievementName")) {
    const parsedName = parseName(input.achievementName);
    if (!parsedName.ok) return parsedName;
    achievementName = parsedName.value;
  }

  if (
    hasOwn(input, "streakEnabled") &&
    typeof input.streakEnabled !== "boolean"
  ) {
    return { ok: false, error: "Streak enabled must be a boolean" };
  }
  const streakEnabled =
    typeof input.streakEnabled === "boolean"
      ? input.streakEnabled
      : achievementName.length > 0;

  let targetStreak = 20;
  if (hasOwn(input, "targetStreak")) {
    const parsedTarget = parseTarget(input.targetStreak);
    if (!parsedTarget.ok) return parsedTarget;
    targetStreak = parsedTarget.value;
  }

  if (repeat.value === "none" && streakEnabled) {
    return { ok: false, error: "Streak tracking requires a recurring task" };
  }
  if (streakEnabled && !achievementName) {
    return {
      ok: false,
      error: "Streak name is required when streak tracking is enabled",
    };
  }

  return {
    ok: true,
    value: {
      title,
      priority: priority.value,
      repeat: repeat.value,
      assigneeId: assigneeId.value,
      ...(achievementName ? { achievementName } : {}),
      targetStreak,
      streakEnabled,
    },
  };
}

export function parseTaskUpdateInput(
  input: unknown,
): TaskInputResult<ParsedTaskUpdateInput> {
  if (!isRecord(input)) {
    return { ok: false, error: "Task payload must be an object" };
  }

  const value: ParsedTaskUpdateInput = {};

  if (hasOwn(input, "title")) {
    const title = typeof input.title === "string" ? input.title.trim() : "";
    if (!title) return { ok: false, error: "Task title is required" };
    value.title = title;
  }
  if (hasOwn(input, "priority")) {
    const priority = parsePriority(input.priority);
    if (!priority.ok) return priority;
    value.priority = priority.value;
  }
  if (hasOwn(input, "repeat")) {
    const repeat = parseCadence(input.repeat);
    if (!repeat.ok) return repeat;
    value.repeat = repeat.value;
  }
  if (hasOwn(input, "assigneeId")) {
    const assigneeId = parseAssignee(input.assigneeId);
    if (!assigneeId.ok) return assigneeId;
    value.assigneeId = assigneeId.value;
  }
  if (hasOwn(input, "streakEnabled")) {
    if (typeof input.streakEnabled !== "boolean") {
      return { ok: false, error: "Streak enabled must be a boolean" };
    }
    value.streakEnabled = input.streakEnabled;
  }
  if (hasOwn(input, "achievementName")) {
    const achievementName = parseName(input.achievementName);
    if (!achievementName.ok) return achievementName;
    if (!achievementName.value && value.streakEnabled !== false) {
      return { ok: false, error: "Streak name cannot be empty" };
    }
    value.achievementName = achievementName.value;
  }
  if (hasOwn(input, "targetStreak")) {
    const targetStreak = parseTarget(input.targetStreak);
    if (!targetStreak.ok) return targetStreak;
    value.targetStreak = targetStreak.value;
  }

  if (value.repeat === "none" && value.streakEnabled === true) {
    return { ok: false, error: "Streak tracking requires a recurring task" };
  }

  return { ok: true, value };
}

export function requireCreateTaskInput(input: unknown): ParsedCreateTaskInput {
  const result = parseCreateTaskInput(input);
  if (!result.ok) throw new TaskInputError(result.error);
  return result.value;
}

export function requireTaskUpdateInput(input: unknown): ParsedTaskUpdateInput {
  const result = parseTaskUpdateInput(input);
  if (!result.ok) throw new TaskInputError(result.error);
  return result.value;
}

import { describe, expect, test } from "bun:test";
import { parseCreateTaskInput, parseTaskUpdateInput } from "./task-input";

describe("parseCreateTaskInput", () => {
  test("trims and normalizes a recurring task payload", () => {
    expect(
      parseCreateTaskInput({
        title: "  Clean room  ",
        priority: "high",
        repeat: "daily",
        assigneeId: "7",
        achievementName: "  Room streak  ",
        targetStreak: "12",
      }),
    ).toEqual({
      ok: true,
      value: {
        title: "Clean room",
        priority: "high",
        repeat: "daily",
        assigneeId: 7,
        achievementName: "Room streak",
        targetStreak: 12,
        streakEnabled: true,
      },
    });
  });

  test.each([
    [{ title: " ", priority: "low", repeat: "none" }, "title"],
    [{ title: "Task", priority: "urgent", repeat: "none" }, "priority"],
    [{ title: "Task", priority: "low", repeat: "monthly" }, "cadence"],
    [{ title: "Task", priority: "low", repeat: "none", assigneeId: "x" }, "assignee"],
    [
      {
        title: "Task",
        priority: "low",
        repeat: "daily",
        achievementName: "Streak",
        targetStreak: 0,
      },
      "positive integer",
    ],
    [
      {
        title: "Task",
        priority: "low",
        repeat: "none",
        streakEnabled: true,
        achievementName: "Streak",
      },
      "recurring",
    ],
  ])("rejects invalid create input %#", (input, message) => {
    const result = parseCreateTaskInput(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.toLowerCase()).toContain(message);
  });
});

describe("parseTaskUpdateInput", () => {
  test("preserves explicit null and trims editable fields", () => {
    expect(
      parseTaskUpdateInput({
        title: "  Updated task ",
        priority: "medium",
        repeat: "weekly",
        assigneeId: null,
        streakEnabled: false,
        achievementName: "",
        targetStreak: "5",
      }),
    ).toEqual({
      ok: true,
      value: {
        title: "Updated task",
        priority: "medium",
        repeat: "weekly",
        assigneeId: null,
        streakEnabled: false,
        achievementName: "",
        targetStreak: 5,
      },
    });
  });

  test.each([
    [{ title: "" }, "title"],
    [{ priority: "urgent" }, "priority"],
    [{ repeat: "monthly" }, "cadence"],
    [{ assigneeId: false }, "assignee"],
    [{ targetStreak: -1 }, "positive integer"],
  ])("rejects invalid update input %#", (input, message) => {
    const result = parseTaskUpdateInput(input);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.toLowerCase()).toContain(message);
  });
});

import { describe, expect, test } from "bun:test";
import { tasks, users } from "../db/schema";
import { archiveDoneTasks, createTask, updateTaskStatus } from "./task.service";
import type { Database } from "../db/client";

describe("task service", () => {
  test.each([
    ["high", 10],
    ["medium", 5],
    ["low", 1],
  ] as const)(
    "stores %s priority tasks with %i points on creation",
    async (priority, expectedValue) => {
      const valuesCalls: Array<Record<string, unknown>> = [];
      const db = {
        insert() {
          return {
            values(payload: Record<string, unknown>) {
              valuesCalls.push(payload);
              return {
                returning: async () => [
                  {
                    id: 1,
                    title: "Empty dishwasher",
                    priority,
                    value: expectedValue,
                    repeat: "none",
                    status: "todo",
                    assigneeId: null,
                  },
                ],
              };
            },
          };
        },
        select() {
          return {
            from() {
              return {
                leftJoin() {
                  return {
                    where() {
                      return {
                        get: async () => ({
                          task: {
                            id: 1,
                            title: "Empty dishwasher",
                            priority,
                            value: expectedValue,
                            repeat: "none",
                            status: "todo",
                            assigneeId: null,
                          },
                          achievement: null,
                        }),
                      };
                    },
                  };
                },
              };
            },
          };
        },
      };

      const created = await createTask(db as unknown as Database, {
        title: "Empty dishwasher",
        priority,
        value: "999",
        repeat: "none",
        assigneeId: "",
      });

      expect(valuesCalls).toHaveLength(1);
      expect(valuesCalls[0]).toMatchObject({
        title: "Empty dishwasher",
        priority,
        value: expectedValue,
        repeat: "none",
        status: "todo",
        assigneeId: null,
      });
      expect(created).toEqual([
        expect.objectContaining({
          id: 1,
          title: "Empty dishwasher",
          priority,
          value: expectedValue,
          repeat: "none",
          status: "todo",
          assigneeId: null,
          achievement: null,
        }),
      ]);
    },
  );

  test("does not subtract points when moving a completed task into archived", async () => {
    const updateCalls: Array<{ table: unknown; payload: Record<string, unknown> }> = [];
    const db = {
      select() {
        return {
          from() {
            return {
              where() {
                return {
                  get: async () => ({
                    id: 9,
                    status: "done",
                    assigneeId: 2,
                    value: 5,
                  }),
                };
              },
            };
          },
        };
      },
      update(table: unknown) {
        return {
          set(payload: Record<string, unknown>) {
            updateCalls.push({ table, payload });
            return {
              where: async () => undefined,
            };
          },
        };
      },
    };

    await updateTaskStatus(db as unknown as Database, 9, "archived");

    expect(updateCalls).toEqual([
      {
        table: tasks,
        payload: { status: "archived" },
      },
    ]);
  });

  test("archives only done tasks in the bulk archive helper", async () => {
    const updateCalls: Array<Record<string, unknown>> = [];
    const whereCalls: unknown[] = [];
    const db = {
      update(table: unknown) {
        expect(table).toBe(tasks);
        return {
          set(payload: Record<string, unknown>) {
            updateCalls.push(payload);
            return {
              where(clause: unknown) {
                whereCalls.push(clause);
                return Promise.resolve();
              },
            };
          },
        };
      },
    };

    await archiveDoneTasks(db as unknown as Database);

    expect(updateCalls).toEqual([{ status: "archived" }]);
    expect(whereCalls).toHaveLength(1);
  });

  test("subtracts points when a done task moves back to an active status", async () => {
    const updateCalls: Array<{ table: unknown; payload: Record<string, unknown> }> = [];
    const db = {
      select() {
        return {
          from() {
            return {
              where() {
                return {
                  get: async () => ({
                    id: 7,
                    status: "done",
                    assigneeId: 2,
                    value: 10,
                  }),
                };
              },
            };
          },
        };
      },
      update(table: unknown) {
        return {
          set(payload: Record<string, unknown>) {
            updateCalls.push({ table, payload });
            return {
              where: async () => undefined,
            };
          },
        };
      },
    };

    await updateTaskStatus(db as unknown as Database, 7, "todo");

    expect(updateCalls[0]).toEqual({
      table: tasks,
      payload: { status: "todo" },
    });
    expect(updateCalls[1]?.table).toBe(users);
  });

  test("awards a badge and reports the milestone when the streak hits the target", async () => {
    const now = new Date("2026-07-08T12:00:00Z");
    const selectResults = [
      // 1st select: the task row
      {
        id: 3,
        status: "doing",
        repeat: "daily",
        assigneeId: 2,
        value: 5,
      },
      // 2nd select: the achievement row, one day from the 20-day badge
      {
        id: 11,
        taskId: 3,
        name: "20-Day Streak Reward Badge",
        targetStreak: 20,
        currentStreak: 19,
        prestigeCount: 0,
        missedDaysInARow: 0,
        lastCompletedAt: new Date("2026-07-07T12:00:00Z"),
      },
    ];
    const updateCalls: Array<{ table: unknown; payload: Record<string, unknown> }> = [];
    const insertCalls: Array<{ table: unknown; payload: Record<string, unknown> }> = [];

    const db = {
      select() {
        return {
          from() {
            return {
              where() {
                return {
                  get: async () => selectResults.shift(),
                };
              },
            };
          },
        };
      },
      update(table: unknown) {
        return {
          set(payload: Record<string, unknown>) {
            updateCalls.push({ table, payload });
            return {
              where: async () => undefined,
            };
          },
        };
      },
      insert(table: unknown) {
        return {
          values: async (payload: Record<string, unknown>) => {
            insertCalls.push({ table, payload });
          },
        };
      },
    };

    const { milestone } = await updateTaskStatus(db as unknown as Database, 3, "done", now);

    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0]?.payload).toMatchObject({
      userId: 2,
      achievementId: 11,
      badgeName: "20-Day Streak Reward Badge",
      prestigeLevel: 1,
    });

    const achievementUpdate = updateCalls.at(-1)?.payload;
    expect(achievementUpdate).toMatchObject({
      currentStreak: 0,
      missedDaysInARow: 0,
      prestigeCount: 1,
      prevStreak: 19,
    });

    expect(milestone).toEqual({
      achievementId: 11,
      badgeName: "20-Day Streak Reward Badge",
      streak: 20,
      prestigeLevel: 1,
    });
  });

  test("applies the daily penalty after a skipped weekday", async () => {
    const now = new Date("2026-07-08T12:00:00Z");
    const selectResults = [
      { id: 4, status: "todo", repeat: "daily", assigneeId: 2, value: 5 },
      {
        id: 12,
        taskId: 4,
        name: "Room Cleaner",
        targetStreak: 20,
        currentStreak: 5,
        prestigeCount: 0,
        missedDaysInARow: 1,
        lastCompletedAt: new Date("2026-07-06T12:00:00Z"), // missed July 7th
      },
    ];
    const updateCalls: Array<{ table: unknown; payload: Record<string, unknown> }> = [];

    const db = {
      select() {
        return {
          from() {
            return {
              where() {
                return {
                  get: async () => selectResults.shift(),
                };
              },
            };
          },
        };
      },
      update(table: unknown) {
        return {
          set(payload: Record<string, unknown>) {
            updateCalls.push({ table, payload });
            return {
              where: async () => undefined,
            };
          },
        };
      },
      insert() {
        throw new Error("no badge should be inserted for a frozen streak");
      },
    };

    const { milestone } = await updateTaskStatus(db as unknown as Database, 4, "done", now);

    expect(milestone).toBeNull();
    const achievementUpdate = updateCalls.at(-1)?.payload;
    expect(achievementUpdate).toMatchObject({
      currentStreak: 4,
      missedDaysInARow: 0,
    });
  });
});

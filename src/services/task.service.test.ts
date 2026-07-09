import { describe, expect, test } from 'bun:test'
import { tasks, users, taskAchievements } from '../db/schema'
import {
  archiveDoneTasks,
  createTask,
  updateTaskStatus,
  rolloverPastDailyTasks
} from './task.service'

describe('task service', () => {
  test.each([
    ['high', 10],
    ['medium', 5],
    ['low', 1]
  ] as const)('stores %s priority tasks with %i points on creation', async (priority, expectedValue) => {
    const valuesCalls: Array<Record<string, unknown>> = []
    const db = {
      insert() {
        return {
          values(payload: Record<string, unknown>) {
            valuesCalls.push(payload)
            return {
              returning: async () => [
                {
                  id: 1,
                  title: 'Empty dishwasher',
                  priority,
                  value: expectedValue,
                  repeat: 'none',
                  status: 'todo',
                  assigneeId: null
                }
              ]
            }
          }
        }
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
                          title: 'Empty dishwasher',
                          priority,
                          value: expectedValue,
                          repeat: 'none',
                          status: 'todo',
                          assigneeId: null
                        },
                        achievement: null
                      })
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    const created = await createTask(db, {
      title: 'Empty dishwasher',
      priority,
      value: '999',
      repeat: 'none',
      assigneeId: ''
    })

    expect(valuesCalls).toHaveLength(1)
    expect(valuesCalls[0]).toMatchObject({
      title: 'Empty dishwasher',
      priority,
      value: expectedValue,
      repeat: 'none',
      status: 'todo',
      assigneeId: null
    })
    expect(created).toEqual([
      {
        id: 1,
        title: 'Empty dishwasher',
        priority,
        value: expectedValue,
        repeat: 'none',
        status: 'todo',
        assigneeId: null,
        achievement: null
      }
    ])
  })

  test('does not subtract points when moving a completed task into archived', async () => {
    const updateCalls: Array<{ table: unknown; payload: Record<string, unknown> }> = []
    const db = {
      select() {
        return {
          from() {
            return {
              where() {
                return {
                  get: async () => ({
                    id: 9,
                    status: 'done',
                    assigneeId: 2,
                    value: 5
                  })
                }
              }
            }
          }
        }
      },
      update(table: unknown) {
        return {
          set(payload: Record<string, unknown>) {
            updateCalls.push({ table, payload })
            return {
              where: async () => undefined
            }
          }
        }
      }
    }

    await updateTaskStatus(db, 9, 'archived')

    expect(updateCalls).toHaveLength(1)
    expect(updateCalls[0]).toMatchObject({
      table: tasks,
      payload: {
        status: 'archived',
        archiveReason: 'manual',
        completedAt: null
      }
    })
    expect(updateCalls[0]!.payload.archivedAt).toBeInstanceOf(Date)
  })

  test('archives only done tasks in the bulk archive helper', async () => {
    const updateCalls: Array<Record<string, unknown>> = []
    const whereCalls: unknown[] = []
    const db = {
      update(table: unknown) {
        expect(table).toBe(tasks)
        return {
          set(payload: Record<string, unknown>) {
            updateCalls.push(payload)
            return {
              where(clause: unknown) {
                whereCalls.push(clause)
                return Promise.resolve()
              }
            }
          }
        }
      }
    }

    await archiveDoneTasks(db)

    expect(updateCalls).toEqual([{ status: 'archived' }])
    expect(whereCalls).toHaveLength(1)
  })

  test('subtracts points when a done task moves back to an active status', async () => {
    const updateCalls: Array<{ table: unknown; payload: Record<string, unknown> }> = []
    const db = {
      select() {
        return {
          from() {
            return {
              where() {
                return {
                  get: async () => ({
                    id: 7,
                    status: 'done',
                    assigneeId: 2,
                    value: 10
                  })
                }
              }
            }
          }
        }
      },
      update(table: unknown) {
        return {
          set(payload: Record<string, unknown>) {
            updateCalls.push({ table, payload })
            return {
              where: async () => undefined
            }
          }
        }
      }
    }

    await updateTaskStatus(db, 7, 'todo')

    expect(updateCalls[0]).toMatchObject({
      table: tasks,
      payload: {
        status: 'todo',
        archiveReason: null,
        archivedAt: null,
        completedAt: null
      }
    })
    expect(updateCalls[1]?.table).toBe(users)
  })

  test('rolloverPastDailyTasks archives past daily tasks and creates a new task for today', async () => {
    const archivedTasksCalls: any[] = [];
    const insertedTasksCalls: any[] = [];
    const updatedAchievementsCalls: any[] = [];

    const db = {
      select() {
        return {
          from(table: any) {
            return {
              where() {
                if (table === taskAchievements) {
                  return {
                    get: async () => ({
                      id: 5,
                      taskId: 10,
                      name: 'Clean Room Streak',
                      targetStreak: 20,
                      currentStreak: 0,
                      prestigeCount: 0
                    })
                  };
                }
                return {
                  get: async () => undefined,
                  then(resolve: any) {
                    resolve([
                      {
                        id: 10,
                        title: 'Clean Room',
                        priority: 'medium',
                        value: 5,
                        status: 'done',
                        repeat: 'daily',
                        assigneeId: 2,
                        achievementId: 5,
                        cycleDate: '2026-06-29'
                      }
                    ]);
                  }
                };
              }
            };
          }
        };
      },
      update(table: any) {
        return {
          set(payload: any) {
            if (table === tasks) {
              return {
                where: async () => {
                  archivedTasksCalls.push(payload);
                }
              };
            }
            if (table === taskAchievements) {
              return {
                where: async () => {
                  updatedAchievementsCalls.push(payload);
                }
              };
            }
            return {
              where: async () => {}
            };
          }
        };
      },
      insert(table: any) {
        return {
          values(payload: any) {
            if (table === tasks) {
              insertedTasksCalls.push(payload);
              return {
                returning: async () => [
                  {
                    id: 11,
                    title: 'Clean Room',
                    priority: 'medium',
                    value: 5,
                    status: 'todo',
                    repeat: 'daily',
                    assigneeId: 2,
                    achievementId: 5,
                    cycleDate: '2026-06-30'
                  }
                ]
              };
            }
            return {
              returning: async () => []
            };
          }
        };
      }
    };

    const today = new Date(Date.UTC(2026, 5, 30, 12, 0, 0)); // 2026-06-30

    await rolloverPastDailyTasks(db, today);

    expect(archivedTasksCalls).toHaveLength(1);
    expect(archivedTasksCalls[0]).toMatchObject({
      status: 'archived',
      archiveReason: 'completed'
    });

    expect(insertedTasksCalls).toHaveLength(1);
    expect(insertedTasksCalls[0]).toMatchObject({
      title: 'Clean Room',
      status: 'todo',
      cycleDate: '2026-06-30'
    });

    expect(updatedAchievementsCalls).toHaveLength(1);
    expect(updatedAchievementsCalls[0]).toMatchObject({
      taskId: 11
    });
  })
})

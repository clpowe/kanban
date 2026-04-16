import { describe, expect, test } from 'bun:test'
import { tasks, users } from '../db/schema'
import {
  archiveDoneTasks,
  createTask,
  updateTaskStatus
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
        assigneeId: null
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

    expect(updateCalls).toEqual([
      {
        table: tasks,
        payload: { status: 'archived' }
      }
    ])
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

    expect(updateCalls[0]).toEqual({
      table: tasks,
      payload: { status: 'todo' }
    })
    expect(updateCalls[1]?.table).toBe(users)
  })
})

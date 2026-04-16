import { describe, expect, test } from 'bun:test'
import { handleScheduled } from './index'

describe('handleScheduled', () => {
  test('dispatches the daily reset cron separately from weekly archive', async () => {
    const calls: string[] = []

    await handleScheduled(
      { cron: '0 0 * * *' } as ScheduledController,
      {} as any,
      {
        resetDailyTasks: async () => {
          calls.push('daily')
        },
        archiveCompletedTasks: async () => {
          calls.push('weekly')
        }
      }
    )

    expect(calls).toEqual(['daily'])
  })

  test('dispatches the weekly archive cron at saturday 11:59 pm', async () => {
    const calls: string[] = []

    await handleScheduled(
      { cron: '59 23 * * 6' } as ScheduledController,
      {} as any,
      {
        resetDailyTasks: async () => {
          calls.push('daily')
        },
        archiveCompletedTasks: async () => {
          calls.push('weekly')
        }
      }
    )

    expect(calls).toEqual(['weekly'])
  })
})

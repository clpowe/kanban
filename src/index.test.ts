import { describe, expect, test } from 'bun:test'
import { handleScheduled } from './index'

describe('handleScheduled', () => {
  test('dispatches the daily rollover cron separately from weekly archive', async () => {
    const calls: string[] = []

    await handleScheduled(
      {
        cron: '59 3 * * *',
        scheduledTime: Date.UTC(2026, 6, 1, 3, 59)
      } as ScheduledController,
      {} as any,
      {
        rolloverDailyTasks: async () => {
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
        rolloverDailyTasks: async () => {
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

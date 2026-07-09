import { describe, expect, test } from 'bun:test'
import {
  completeTask,
  dailyReset,
  daysBetween,
  type StreakState
} from './streak'

const at = (iso: string) => new Date(iso)

const state = (overrides: Partial<StreakState> = {}): StreakState => ({
  streakCount: 0,
  lastCompletedDate: null,
  missedDaysInARow: 0,
  ...overrides
})

const DAILY = { targetStreak: 20 }

describe('daysBetween', () => {
  test('uses calendar days, not elapsed hours', () => {
    // 25 minutes apart but on different calendar days
    expect(
      daysBetween(at('2026-07-07T23:50:00Z'), at('2026-07-08T00:15:00Z'))
    ).toBe(1)
    // 23 hours apart but the same calendar day boundary crossed once
    expect(
      daysBetween(at('2026-07-07T00:30:00Z'), at('2026-07-07T23:30:00Z'))
    ).toBe(0)
  })
})

describe('completeTask', () => {
  test('first completion ever starts a streak of 1', () => {
    const result = completeTask(state(), at('2026-07-08T15:00:00Z'), DAILY)

    expect(result.changed).toBe(true)
    expect(result.state.streakCount).toBe(1)
    expect(result.state.missedDaysInARow).toBe(0)
  })

  test('Rule A: consecutive day increments the streak', () => {
    const result = completeTask(
      state({
        streakCount: 5,
        lastCompletedDate: at('2026-07-07T09:00:00Z'),
        missedDaysInARow: 0
      }),
      at('2026-07-08T21:00:00Z'), // 36h later but still the next calendar day
      DAILY
    )

    expect(result.state.streakCount).toBe(6)
    expect(result.state.missedDaysInARow).toBe(0)
  })

  test('Rule A: late-night then early-morning completion still counts as consecutive', () => {
    const result = completeTask(
      state({ streakCount: 3, lastCompletedDate: at('2026-07-07T23:50:00Z') }),
      at('2026-07-08T00:10:00Z'), // only 20 minutes later
      DAILY
    )

    expect(result.state.streakCount).toBe(4)
  })

  test('Rule B: missing exactly one day freezes the streak', () => {
    const result = completeTask(
      state({
        streakCount: 5,
        lastCompletedDate: at('2026-07-06T09:00:00Z'), // missed the 7th
        missedDaysInARow: 1
      }),
      at('2026-07-08T09:00:00Z'),
      DAILY
    )

    expect(result.changed).toBe(true)
    expect(result.state.streakCount).toBe(5) // frozen, not reset
    expect(result.state.missedDaysInARow).toBe(0)
  })

  test('Rule C: missing two or more days resets the streak to 1', () => {
    const result = completeTask(
      state({
        streakCount: 10,
        lastCompletedDate: at('2026-07-04T09:00:00Z'), // missed 5th and 6th (+7th)
        missedDaysInARow: 2
      }),
      at('2026-07-08T09:00:00Z'),
      DAILY
    )

    expect(result.state.streakCount).toBe(1)
    expect(result.state.missedDaysInARow).toBe(0)
  })

  test('completing twice on the same day is a no-op', () => {
    const before = state({
      streakCount: 7,
      lastCompletedDate: at('2026-07-08T08:00:00Z')
    })
    const result = completeTask(before, at('2026-07-08T22:00:00Z'), DAILY)

    expect(result.changed).toBe(false)
    expect(result.milestoneReached).toBe(false)
    expect(result.state).toBe(before)
  })

  test('Rule D: hitting exactly the 20-day target earns the badge', () => {
    const result = completeTask(
      state({
        streakCount: 19,
        lastCompletedDate: at('2026-07-07T09:00:00Z')
      }),
      at('2026-07-08T09:00:00Z'),
      DAILY
    )

    expect(result.state.streakCount).toBe(20)
    expect(result.milestoneReached).toBe(true)
  })

  test('Rule D: a streak frozen at the target does not re-award the badge', () => {
    const result = completeTask(
      state({
        streakCount: 20,
        lastCompletedDate: at('2026-07-06T09:00:00Z') // missed one day
      }),
      at('2026-07-08T09:00:00Z'),
      DAILY
    )

    expect(result.state.streakCount).toBe(20)
    expect(result.milestoneReached).toBe(false)
  })

  test('Rule D: badge repeats at each multiple of the target (prestige)', () => {
    const result = completeTask(
      state({
        streakCount: 39,
        lastCompletedDate: at('2026-07-07T09:00:00Z')
      }),
      at('2026-07-08T09:00:00Z'),
      DAILY
    )

    expect(result.state.streakCount).toBe(40)
    expect(result.milestoneReached).toBe(true)
  })

  test('weekly tasks apply the same rules per 7-day period', () => {
    const base = state({
      streakCount: 4,
      lastCompletedDate: at('2026-07-01T09:00:00Z')
    })

    // next week → increment
    expect(
      completeTask(base, at('2026-07-08T09:00:00Z'), {
        targetStreak: 20,
        periodDays: 7
      }).state.streakCount
    ).toBe(5)

    // skipped one week → frozen
    expect(
      completeTask(base, at('2026-07-15T09:00:00Z'), {
        targetStreak: 20,
        periodDays: 7
      }).state.streakCount
    ).toBe(4)

    // skipped two weeks → reset to 1
    expect(
      completeTask(base, at('2026-07-22T09:00:00Z'), {
        targetStreak: 20,
        periodDays: 7
      }).state.streakCount
    ).toBe(1)

    // same week → no-op
    expect(
      completeTask(base, at('2026-07-05T09:00:00Z'), {
        targetStreak: 20,
        periodDays: 7
      }).changed
    ).toBe(false)
  })
})

describe('dailyReset', () => {
  test('leaves state untouched when the task was completed that day', () => {
    const result = dailyReset(
      state({
        streakCount: 5,
        lastCompletedDate: at('2026-07-08T18:00:00Z')
      }),
      at('2026-07-08T23:59:59Z')
    )

    expect(result.changed).toBe(false)
    expect(result.streakBroken).toBe(false)
  })

  test('first missed day increments the counter but keeps the streak', () => {
    const result = dailyReset(
      state({
        streakCount: 5,
        lastCompletedDate: at('2026-07-07T18:00:00Z'),
        missedDaysInARow: 0
      }),
      at('2026-07-08T23:59:59Z')
    )

    expect(result.changed).toBe(true)
    expect(result.state.missedDaysInARow).toBe(1)
    expect(result.state.streakCount).toBe(5)
    expect(result.streakBroken).toBe(false)
  })

  test('second consecutive missed day breaks the streak to 0', () => {
    const result = dailyReset(
      state({
        streakCount: 5,
        lastCompletedDate: at('2026-07-06T18:00:00Z'),
        missedDaysInARow: 1
      }),
      at('2026-07-08T23:59:59Z')
    )

    expect(result.state.missedDaysInARow).toBe(2)
    expect(result.state.streakCount).toBe(0)
    expect(result.streakBroken).toBe(true)
  })

  test('further missed days keep the streak at 0 without re-reporting a break', () => {
    const result = dailyReset(
      state({
        streakCount: 0,
        lastCompletedDate: at('2026-07-05T18:00:00Z'),
        missedDaysInARow: 2
      }),
      at('2026-07-08T23:59:59Z')
    )

    expect(result.state.missedDaysInARow).toBe(3)
    expect(result.state.streakCount).toBe(0)
    expect(result.streakBroken).toBe(false)
  })

  test('never-completed task accrues missed days from zero', () => {
    const result = dailyReset(state(), at('2026-07-08T23:59:59Z'))

    expect(result.state.missedDaysInARow).toBe(1)
    expect(result.state.streakCount).toBe(0)
    expect(result.streakBroken).toBe(false)
  })
})

describe('completeTask + dailyReset interplay', () => {
  test('grace period end-to-end: complete Mon, miss Tue, complete Wed keeps streak', () => {
    // Monday: streak at 5 after completion
    let s = state({
      streakCount: 5,
      lastCompletedDate: at('2026-07-06T17:00:00Z') // Monday
    })

    // Tuesday midnight sweep: missed Tuesday
    s = dailyReset(s, at('2026-07-07T23:59:59Z')).state
    expect(s.missedDaysInARow).toBe(1)
    expect(s.streakCount).toBe(5)

    // Wednesday: completes the task → frozen streak survives
    const result = completeTask(s, at('2026-07-08T10:00:00Z'), DAILY)
    expect(result.state.streakCount).toBe(5)
    expect(result.state.missedDaysInARow).toBe(0)
  })

  test('broken streak end-to-end: two missed days zero the streak, next completion restarts at 1', () => {
    let s = state({
      streakCount: 12,
      lastCompletedDate: at('2026-07-05T17:00:00Z')
    })

    s = dailyReset(s, at('2026-07-06T23:59:59Z')).state // missed day 1
    const secondMiss = dailyReset(s, at('2026-07-07T23:59:59Z')) // missed day 2
    s = secondMiss.state

    expect(secondMiss.streakBroken).toBe(true)
    expect(s.streakCount).toBe(0)

    const result = completeTask(s, at('2026-07-08T10:00:00Z'), DAILY)
    expect(result.state.streakCount).toBe(1)
  })
})

import { describe, expect, test } from 'bun:test'
import { createReward, redeemReward } from './reward.service'

const parentUser = {
  id: 1,
  name: 'Mom',
  points: 0,
  type: 'parent' as const,
  username: 'mom',
  passwordHash: 'hash'
}

const childUser = {
  id: 2,
  name: 'Emma',
  points: 25,
  type: 'child' as const,
  username: 'emma',
  passwordHash: 'hash'
}

describe('reward service', () => {
  test('creates a reward record', async () => {
    const valuesCalls: Array<Record<string, unknown>> = []
    const db = {
      insert() {
        return {
          values(payload: Record<string, unknown>) {
            valuesCalls.push(payload)
            return {
              returning: async () => [
                {
                  id: 7,
                  name: 'Movie Night Pick',
                  value: 20
                }
              ]
            }
          }
        }
      }
    }

    const created = await createReward(db, parentUser, {
      title: 'Movie Night Pick',
      cost: '20'
    })

    expect(valuesCalls).toHaveLength(1)
    expect(valuesCalls[0]).toBeDefined()
    expect(valuesCalls[0]?.name ?? valuesCalls[0]?.title).toBe('Movie Night Pick')
    expect(valuesCalls[0]?.value ?? valuesCalls[0]?.cost).toBe(20)
    expect(created).toEqual([
      {
        id: 7,
        title: 'Movie Night Pick',
        cost: 20
      }
    ])
  })

  test('redeems a reward when the child has enough points', async () => {
    const reward = { id: 9, title: 'Ice Cream', cost: 10 }
    let updatedPoints: number | null = null
    const db = {
      select() {
        return {
          from() {
            return {
              where() {
                return {
                  get: async () => reward
                }
              }
            }
          }
        }
      },
      update() {
        return {
          set(payload: { points: number }) {
            updatedPoints = payload.points
            return {
              where: async () => undefined
            }
          }
        }
      }
    }

    await redeemReward(db, childUser, reward.id)

    expect(updatedPoints).toBe(15)
  })

  test('does not redeem a reward when the child lacks enough points', async () => {
    const reward = { id: 4, title: 'Stay Up Late', cost: 30 }
    let updateAttempted = false
    const db = {
      select() {
        return {
          from() {
            return {
              where() {
                return {
                  get: async () => reward
                }
              }
            }
          }
        }
      },
      update() {
        updateAttempted = true
        return {
          set() {
            return {
              where: async () => undefined
            }
          }
        }
      }
    }

    await expect(redeemReward(db, { ...childUser, points: 5 }, reward.id)).rejects.toThrow(
      'Insufficient points'
    )
    expect(updateAttempted).toBe(false)
  })
})

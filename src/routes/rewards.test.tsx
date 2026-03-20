import { beforeEach, describe, expect, test } from 'bun:test'
import { Hono } from 'hono'
import type { Env } from '../db/client'
import { rewardRoutes } from './rewards'

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

const rewards = [{ id: 9, title: 'Ice Cream', cost: 10 }]
const users = [parentUser, childUser]

let activeUser = parentUser
let createRewardCall:
  | {
      user: typeof parentUser | typeof childUser
      body: Record<string, FormDataEntryValue>
    }
  | null = null
let redeemRewardCall:
  | {
      user: typeof parentUser | typeof childUser
      rewardId: number
    }
  | null = null
let redeemShouldThrow = false

async function loadRewardsApp() {
  const app = new Hono<Env>()
  rewardRoutes(app, {
    getDB() {
      return {} as any
    },
    requireAuthenticatedUser() {
      return activeUser
    },
    requireParent() {
      if (activeUser.type !== 'parent') {
        throw new Response('Forbidden', { status: 403 })
      }

      return activeUser
    },
    getAllRewards: async () => rewards,
    createReward: async (_db: unknown, user: typeof activeUser, body: Record<string, FormDataEntryValue>) => {
      createRewardCall = { user, body }
      return rewards
    },
    redeemReward: async (_db: unknown, user: typeof activeUser, rewardId: number) => {
      redeemRewardCall = { user, rewardId }

      if (redeemShouldThrow) {
        throw new Error('Insufficient points')
      }
    },
    htmxRefreshResponse(c) {
      return c.body('', 200)
    }
  })
  return app
}

beforeEach(() => {
  activeUser = parentUser
  createRewardCall = null
  redeemRewardCall = null
  redeemShouldThrow = false
})

describe('rewardRoutes', () => {
  test('parent can create a reward through the route', async () => {
    const app = await loadRewardsApp()

    const response = await app.request('/rewards', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        title: 'Movie Night Pick',
        cost: '20'
      }).toString()
    })

    expect(response.status).toBe(200)
    expect(createRewardCall).toEqual({
      user: parentUser,
      body: {
        title: 'Movie Night Pick',
        cost: '20'
      }
    })
  })

  test('child cannot create a reward', async () => {
    activeUser = childUser
    const app = await loadRewardsApp()

    const response = await app.request('/rewards', {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        title: 'Movie Night Pick',
        cost: '20'
      }).toString()
    })

    expect(response.status).toBe(403)
    expect(createRewardCall).toBeNull()
  })

  test('child can redeem an affordable reward', async () => {
    activeUser = childUser
    const app = await loadRewardsApp()

    const response = await app.request('/rewards/9/redeem', {
      method: 'POST'
    })

    expect(response.status).toBe(200)
    expect(redeemRewardCall).toEqual({
      user: childUser,
      rewardId: 9
    })
  })

  test('child cannot redeem an unaffordable reward', async () => {
    activeUser = childUser
    redeemShouldThrow = true
    const app = await loadRewardsApp()

    const response = await app.request('/rewards/9/redeem', {
      method: 'POST'
    })

    expect(response.status).toBe(400)
    expect(redeemRewardCall).toEqual({
      user: childUser,
      rewardId: 9
    })
  })
})

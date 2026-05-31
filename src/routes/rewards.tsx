import type { Hono } from 'hono'
import type { Env } from '../db/client'
import { getDB } from '../db/client'
import { requireAuthenticatedUser, requireParent } from '../auth/middleware'
import {
  createReward,
  getAllRewards,
  redeemReward,
} from '../services/reward.service'

type RewardRoutesDeps = {
  getDB: typeof getDB
  requireAuthenticatedUser: typeof requireAuthenticatedUser
  requireParent: typeof requireParent
  createReward: typeof createReward
  getAllRewards: typeof getAllRewards
  redeemReward: typeof redeemReward
}

const defaultDeps: RewardRoutesDeps = {
  getDB,
  requireAuthenticatedUser,
  requireParent,
  createReward,
  getAllRewards,
  redeemReward,
}

export function rewardRoutes(app: Hono<Env>,
  deps: RewardRoutesDeps = defaultDeps) {
  // 1. GET all rewards
  app.get('/api/rewards', async (c) => {
    try {
      deps.requireAuthenticatedUser(c)
      const db = deps.getDB(c.env)
      const rewards = await deps.getAllRewards(db)
      return c.json(rewards)
    } catch (error) {
      console.error("GET /api/rewards error:", error)
      return c.json({ error: 'Failed to load rewards' }, 500)
    }
  })

  // 2. POST create a new reward (Parents only)
  app.post('/api/rewards', async (c) => {
    try {
      const parentUser = deps.requireParent(c)
      const db = deps.getDB(c.env)
      const body = await c.req.json()

      const createdRewards = await deps.createReward(db, parentUser, body)
      const createdReward = createdRewards[0]

      if (!createdReward) {
        return c.json({ error: 'Failed to create reward' }, 500)
      }

      return c.json(createdReward, 201)
    } catch (error) {
      console.error('POST /api/rewards error:', error)
      return c.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, 500)
    }
  })

  // 3. POST redeem a reward (Children only)
  app.post('/api/rewards/:id/redeem', async (c) => {
    try {
      const authUser = deps.requireAuthenticatedUser(c)
      if (authUser.type !== 'child') {
        return c.json({ error: 'Silly parent, gifts are for kids' }, 403)
      }
      const db = deps.getDB(c.env)
      const rewardId = Number(c.req.param('id'))
      await deps.redeemReward(db, authUser, rewardId)

      return c.json({ success: true })
    } catch (error) {
      console.error('POST /api/rewards/:id/redeem error:', error)
      return c.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, 400)
    }
  })
}

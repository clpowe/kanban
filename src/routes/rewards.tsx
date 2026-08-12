import type { Hono } from 'hono'
import type { Env } from '../db/client'
import { getDB } from '../db/client'
import { requireAuthenticatedUser, requireParent } from '../auth/middleware'
import {
  createReward,
  getAllRewards,
  redeemReward,
  getRewardById,
} from '../services/reward.service'
import { createPostHogClient } from '../lib/posthog'

type RewardRoutesDeps = {
  getDB: typeof getDB
  requireAuthenticatedUser: typeof requireAuthenticatedUser
  requireParent: typeof requireParent
  createReward: typeof createReward
  getAllRewards: typeof getAllRewards
  redeemReward: typeof redeemReward
  getRewardById: typeof getRewardById
  createPostHogClient(
    env: Env['Bindings'],
  ): Pick<ReturnType<typeof createPostHogClient>, 'captureImmediate'>
}

const defaultDeps: RewardRoutesDeps = {
  getDB,
  requireAuthenticatedUser,
  requireParent,
  createReward,
  getAllRewards,
  redeemReward,
  getRewardById,
  createPostHogClient,
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

      const posthog = deps.createPostHogClient(c.env)
      await posthog.captureImmediate({
        distinctId: String(parentUser.id),
        event: 'reward created',
        properties: {
          reward_id: createdReward.id,
          reward_title: createdReward.title,
          cost: createdReward.cost,
        },
      })

      return c.json(createdReward, 201)
    } catch (error: any) {
      console.error('POST /api/rewards error:', error)
      if (error && typeof error === 'object' && typeof error.status === 'number') {
        return c.json({ error: error.message }, error.status)
      }
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
      const reward = await deps.getRewardById(db, rewardId)
      if (!reward) {
        return c.json({ error: 'Reward not found' }, 404)
      }
      const body = await c.req.json()
      const eventId =
        typeof body?.eventId === 'string' ? body.eventId.trim() : ''
      if (!eventId) {
        return c.json({ error: 'Reward event ID is required' }, 400)
      }
      await deps.redeemReward(db, { id: authUser.id }, rewardId, eventId)

      const posthog = deps.createPostHogClient(c.env)
      await posthog.captureImmediate({
        distinctId: String(authUser.id),
        event: 'reward redeemed',
        properties: {
          reward_id: rewardId,
          reward_title: reward?.title ?? null,
          cost: reward?.cost ?? null,
          points_before: authUser.points,
        },
      })

      return c.json({ success: true })
    } catch (error) {
      console.error('POST /api/rewards/:id/redeem error:', error)
      const message = error instanceof Error ? error.message : 'Internal Server Error'
      if (message === 'Reward not found') {
        return c.json({ error: message }, 404)
      }
      if (
        message === 'Insufficient points' ||
        message === 'Reward event ID is required'
      ) {
        return c.json({ error: message }, 400)
      }
      return c.json({ error: message }, 500)
    }
  })
}

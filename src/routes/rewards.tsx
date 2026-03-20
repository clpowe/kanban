import type { Hono } from 'hono'
import type { Context } from 'hono'
import type { Env } from '../db/client'
import { getDB } from '../db/client'
import { requireAuthenticatedUser, requireParent } from '../auth/middleware'
import {
  createReward,
  getAllRewards,
  redeemReward,
} from '../services/reward.service'
import { RewardList } from '../components/RewardList'
import { htmxRefreshResponse } from '../utils/htmx'

type RewardRoutesDeps = {
  getDB: typeof getDB
  requireAuthenticatedUser: typeof requireAuthenticatedUser
  requireParent: typeof requireParent
  createReward: typeof createReward
  getAllRewards: typeof getAllRewards
  redeemReward: typeof redeemReward
  htmxRefreshResponse: typeof htmxRefreshResponse
}

const defaultDeps: RewardRoutesDeps = {
  getDB,
  requireAuthenticatedUser,
  requireParent,
  createReward,
  getAllRewards,
  redeemReward,
  htmxRefreshResponse,
}

export function rewardRoutes(app: Hono<Env>, deps: RewardRoutesDeps = defaultDeps) {
  app.get('/rewards', async (c) => {
    const authUser = deps.requireAuthenticatedUser(c)
    const db = deps.getDB(c.env)
    const rewards = await deps.getAllRewards(db)

    return c.html(
      <RewardList rewards={rewards} authUser={authUser} showCreateForm={false} />
    )
  })

  app.post('/rewards', async (c) => {
    try {
      const parentUser = deps.requireParent(c)
      const db = deps.getDB(c.env)
      const body = await c.req.parseBody()

      await deps.createReward(db, parentUser, body as Record<string, FormDataEntryValue>)

      return deps.htmxRefreshResponse(c as Context, ['refreshRewards', 'refreshUsers'])
    } catch (error) {
      if (error instanceof Response) {
        return error
      }

      throw error
    }
  })

  app.post('/rewards/:id/redeem', async (c) => {
    const authUser = deps.requireAuthenticatedUser(c)

    if (authUser.type !== 'child') {
      return c.text('Forbidden', 403)
    }

    const db = deps.getDB(c.env)
    const rewardId = Number(c.req.param('id'))

    try {
      await deps.redeemReward(db, authUser, rewardId)
    } catch (error) {
      if (error instanceof Error) {
        return c.text(error.message, 400)
      }

      throw error
    }

    return deps.htmxRefreshResponse(c as Context, ['refreshRewards', 'refreshUsers'])
  })
}

import { eq } from 'drizzle-orm'
import { rewards, users } from '../db/schema'

type RewardRow = {
  id: number
  name?: string
  value?: number
  title?: string
  cost?: number
}

type RewardView = {
  id: number
  title: string
  cost: number
}

function toRewardView(reward: RewardRow): RewardView {
  return {
    id: reward.id,
    title: reward.title ?? reward.name ?? '',
    cost: reward.cost ?? reward.value ?? 0
  }
}

export const getAllRewards = async (db: any): Promise<RewardView[]> => {
  const result = await db.select().from(rewards)
  return result.map(toRewardView)
}

export const getRewardById = async (db: any, id: number): Promise<RewardView | null> => {
  const reward = await db.select().from(rewards).where(eq(rewards.id, id)).get()

  if (!reward) {
    return null
  }

  return toRewardView(reward)
}

export const createReward = async (
  db: any,
  _parentUser: any,
  data: { title: string; cost: string | number }
): Promise<RewardView[]> => {
  const result = await db
    .insert(rewards)
    .values({
      name: data.title,
      value: Number(data.cost)
    })
    .returning()

  return result.map(toRewardView)
}

export const redeemReward = async (
  db: any,
  childUser: { id: number; points: number },
  rewardId: number
): Promise<void> => {
  const reward = await getRewardById(db, rewardId)

  if (!reward) {
    throw new Error('Reward not found')
  }

  if (childUser.points < reward.cost) {
    throw new Error('Insufficient points')
  }

  await db
    .update(users)
    .set({
      points: childUser.points - reward.cost
    })
    .where(eq(users.id, childUser.id))
}

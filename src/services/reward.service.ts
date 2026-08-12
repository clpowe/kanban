import { eq, sql } from "drizzle-orm";
import { pointEntries, rewards, users } from "../db/schema";
import type { Database } from "../db/client";

type RewardRow = {
  id: number;
  name?: string;
  value?: number;
  title?: string;
  cost?: number;
};

type RewardView = {
  id: number;
  title: string;
  cost: number;
};

function toRewardView(reward: RewardRow): RewardView {
  return {
    id: reward.id,
    title: reward.title ?? reward.name ?? "",
    cost: reward.cost ?? reward.value ?? 0,
  };
}

export const getAllRewards = async (db: Database): Promise<RewardView[]> => {
  const result = await db.select().from(rewards);
  return result.map(toRewardView);
};

export const getRewardById = async (db: Database, id: number): Promise<RewardView | null> => {
  const reward = await db.select().from(rewards).where(eq(rewards.id, id)).get();

  if (!reward) {
    return null;
  }

  return toRewardView(reward);
};

export const createReward = async (
  db: Database,
  _parentUser: any,
  data: { title: string; cost: string | number },
): Promise<RewardView[]> => {
  const result = await db
    .insert(rewards)
    .values({
      name: data.title,
      value: Number(data.cost),
    })
    .returning();

  return result.map(toRewardView);
};

export type RedeemRewardResult = {
  duplicate: boolean;
  points: number;
};

function isUniqueConstraintError(error: unknown) {
  return (
    error instanceof Error &&
    /(UNIQUE constraint failed|SQLITE_CONSTRAINT_UNIQUE|SQLITE_CONSTRAINT[^:]*:.*UNIQUE)/i.test(
      error.message,
    )
  );
}

async function getLedgerBalance(db: Database, userId: number) {
  const row = await db
    .select({
      balance: sql<number>`coalesce(sum(${pointEntries.delta}), 0)`,
    })
    .from(pointEntries)
    .where(eq(pointEntries.userId, userId))
    .get();

  return Number(row?.balance ?? 0);
}

async function getRedemptionByEvent(db: Database, eventId: string) {
  return db
    .select()
    .from(pointEntries)
    .where(eq(pointEntries.eventId, eventId))
    .get();
}

function assertMatchingRedemption(
  entry: NonNullable<Awaited<ReturnType<typeof getRedemptionByEvent>>>,
  userId: number,
  rewardId: number,
) {
  if (
    entry.reason !== "reward_redeemed" ||
    entry.userId !== userId ||
    entry.rewardId !== rewardId
  ) {
    throw new Error("Reward event ID has already been used");
  }
}

export const redeemReward = async (
  db: Database,
  childUser: { id: number },
  rewardId: number,
  eventId: string,
  now: Date = new Date(),
): Promise<RedeemRewardResult> => {
  const normalizedEventId = eventId.trim();
  if (!normalizedEventId) throw new Error("Reward event ID is required");

  const reward = await getRewardById(db, rewardId);

  if (!reward) {
    throw new Error("Reward not found");
  }

  const established = await getRedemptionByEvent(db, normalizedEventId);
  if (established) {
    assertMatchingRedemption(established, childUser.id, rewardId);
    return {
      duplicate: true,
      points: await getLedgerBalance(db, childUser.id),
    };
  }

  const balance = await getLedgerBalance(db, childUser.id);
  if (balance < reward.cost) {
    throw new Error("Insufficient points");
  }

  const insertDebit = db.insert(pointEntries).values({
    eventId: normalizedEventId,
    userId: childUser.id,
    delta: -reward.cost,
    reason: "reward_redeemed",
    rewardId,
    createdAt: now,
  });
  const refreshPoints = db
    .update(users)
    .set({
      points: sql<number>`coalesce((
        select sum(${pointEntries.delta})
        from ${pointEntries}
        where ${pointEntries.userId} = ${childUser.id}
      ), 0)`,
    })
    .where(eq(users.id, childUser.id));

  try {
    await db.batch([insertDebit, refreshPoints]);
  } catch (error) {
    if (!isUniqueConstraintError(error)) throw error;

    const competing = await getRedemptionByEvent(db, normalizedEventId);
    if (!competing) throw error;
    assertMatchingRedemption(competing, childUser.id, rewardId);
    return {
      duplicate: true,
      points: await getLedgerBalance(db, childUser.id),
    };
  }

  return {
    duplicate: false,
    points: await getLedgerBalance(db, childUser.id),
  };
};

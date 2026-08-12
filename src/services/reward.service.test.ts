import { describe, expect, test } from "bun:test";
import { asc, eq } from "drizzle-orm";
import type { Database } from "../db/client";
import { pointEntries, rewards, users } from "../db/schema";
import { createTestDb } from "../db/test-db";
import { createReward, redeemReward } from "./reward.service";

type TestDb = ReturnType<typeof createTestDb>;

const parentUser = {
  id: 1,
  name: "Mom",
  points: 0,
  type: "parent" as const,
  username: "mom",
  passwordHash: "hash",
};

async function insertChildWithBalance(
  db: TestDb,
  suffix: string,
  ledgerBalance: number,
  cachedPoints = ledgerBalance,
) {
  const now = new Date("2026-08-12T12:00:00Z");
  const [child] = await db
    .insert(users)
    .values({
      name: `Child ${suffix}`,
      email: `reward-${suffix}@example.com`,
      emailVerified: true,
      createdAt: now,
      updatedAt: now,
      points: cachedPoints,
      type: "child",
      username: `reward-${suffix}`,
    })
    .returning();
  if (!child) throw new Error("Child fixture was not inserted");

  if (ledgerBalance !== 0) {
    await db.insert(pointEntries).values({
      eventId: `opening-${suffix}`,
      userId: child.id,
      delta: ledgerBalance,
      reason: "opening_balance",
      createdAt: now,
    });
  }

  return child;
}

async function insertReward(db: TestDb, name = "Ice Cream", value = 10) {
  const [reward] = await db.insert(rewards).values({ name, value }).returning();
  if (!reward) throw new Error("Reward fixture was not inserted");
  return reward;
}

async function snapshotRewardState(db: TestDb) {
  return {
    users: await db.select().from(users).orderBy(asc(users.id)),
    entries: await db.select().from(pointEntries).orderBy(asc(pointEntries.id)),
    rewards: await db.select().from(rewards).orderBy(asc(rewards.id)),
  };
}

describe("reward service", () => {
  test("creates a reward record", async () => {
    const db = createTestDb();
    const created = await createReward(db as unknown as Database, parentUser, {
      title: "Movie Night Pick",
      cost: "20",
    });

    expect(created).toEqual([
      {
        id: expect.any(Number),
        title: "Movie Night Pick",
        cost: 20,
      },
    ]);
  });

  test("redeems through one negative ledger entry and refreshes cached points", async () => {
    const db = createTestDb();
    const child = await insertChildWithBalance(db, "success", 25, 999);
    const reward = await insertReward(db);
    const now = new Date("2026-08-12T13:00:00Z");

    const result = await redeemReward(
      db as unknown as Database,
      { id: child.id },
      reward.id,
      "redeem-success",
      now,
    );

    expect(result).toEqual({ duplicate: false, points: 15 });
    expect(
      await db
        .select()
        .from(pointEntries)
        .where(eq(pointEntries.eventId, "redeem-success")),
    ).toEqual([
      expect.objectContaining({
        userId: child.id,
        delta: -10,
        reason: "reward_redeemed",
        rewardId: reward.id,
        createdAt: now,
      }),
    ]);
    expect(
      await db.select().from(users).where(eq(users.id, child.id)).get(),
    ).toMatchObject({ points: 15 });
  });

  test("rejects affordability based on ledger balance, not stale cached points", async () => {
    const db = createTestDb();
    const child = await insertChildWithBalance(db, "insufficient", 5, 100);
    const reward = await insertReward(db);

    await expect(
      redeemReward(
        db as unknown as Database,
        { id: child.id },
        reward.id,
        "redeem-insufficient",
      ),
    ).rejects.toThrow("Insufficient points");

    expect(
      await db
        .select()
        .from(pointEntries)
        .where(eq(pointEntries.eventId, "redeem-insufficient")),
    ).toEqual([]);
    expect(
      await db.select().from(users).where(eq(users.id, child.id)).get(),
    ).toMatchObject({ points: 100 });
  });

  test("does not double-charge a repeated redemption event ID", async () => {
    const db = createTestDb();
    const child = await insertChildWithBalance(db, "duplicate", 25);
    const reward = await insertReward(db);

    const first = await redeemReward(
      db as unknown as Database,
      { id: child.id },
      reward.id,
      "redeem-duplicate",
    );
    const second = await redeemReward(
      db as unknown as Database,
      { id: child.id },
      reward.id,
      "redeem-duplicate",
    );

    expect(first).toEqual({ duplicate: false, points: 15 });
    expect(second).toEqual({ duplicate: true, points: 15 });
    expect(
      await db
        .select()
        .from(pointEntries)
        .where(eq(pointEntries.eventId, "redeem-duplicate")),
    ).toHaveLength(1);
  });

  test("rolls back every redemption write when either batch statement fails", async () => {
    for (let statementIndex = 0; statementIndex < 2; statementIndex += 1) {
      const db = createTestDb();
      const child = await insertChildWithBalance(
        db,
        `failure-${statementIndex}`,
        25,
      );
      const reward = await insertReward(db);
      const before = await snapshotRewardState(db);
      db.setBatchFailureIndex(statementIndex);

      await expect(
        redeemReward(
          db as unknown as Database,
          { id: child.id },
          reward.id,
          `redeem-failure-${statementIndex}`,
        ),
      ).rejects.toThrow(`statement ${statementIndex}`);

      db.setBatchFailureIndex(null);
      expect(await snapshotRewardState(db)).toEqual(before);
    }
  });
});

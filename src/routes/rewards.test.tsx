import { beforeEach, describe, expect, test } from "bun:test";
import { Hono } from "hono";
import type { Env } from "../db/client";
import { rewardRoutes } from "./rewards";
import type { User } from "../types";

const parentUser: User = {
  id: 1,
  name: "Mom",
  email: "mom@example.com",
  emailVerified: true,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  points: 0,
  type: "parent",
  username: "mom",
  displayUsername: "Mom",
};

const childUser: User = {
  id: 2,
  name: "Emma",
  email: "emma@example.com",
  emailVerified: true,
  image: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  points: 25,
  type: "child",
  username: "emma",
  displayUsername: "Emma",
};

const rewards = [{ id: 9, title: "Ice Cream", cost: 10 }];

let activeUser: User;
let createRewardCall: {
  user: User;
  body: { title: string; cost: string };
} | null = null;
let redeemRewardCall: {
  user: { id: number; points: number };
  rewardId: number;
} | null = null;
let redeemShouldThrow = false;

async function loadRewardsApp() {
  const app = new Hono<Env>();
  rewardRoutes(app, {
    getDB() {
      return {} as any;
    },
    requireAuthenticatedUser() {
      return activeUser;
    },
    requireParent() {
      if (activeUser.type !== "parent") {
        throw new Response("Forbidden", { status: 403 });
      }
      return activeUser;
    },
    getAllRewards: async () => rewards,
    createReward: async (
      _db: any,
      user: any,
      data: { title: string; cost: string | number },
    ) => {
      createRewardCall = {
        user,
        body: { title: data.title, cost: String(data.cost) },
      };
      return rewards;
    },
    redeemReward: async (
      _db: any,
      user: { id: number; points: number },
      rewardId: number,
    ) => {
      redeemRewardCall = { user, rewardId };

      if (redeemShouldThrow) {
        throw new Error("Insufficient points");
      }
    },
    getRewardById: async (_db: any, id: number) => {
      const reward = rewards.find((r) => r.id === id);
      return reward ? { id: reward.id, title: reward.title, cost: reward.cost } : null;
    },
  });
  return app;
}

beforeEach(() => {
  activeUser = childUser;
  createRewardCall = null;
  redeemRewardCall = null;
  redeemShouldThrow = false;
});

describe("rewardRoutes", () => {
  test("parent can create a reward through the route", async () => {
    activeUser = parentUser;
    const app = await loadRewardsApp();

    const response = await app.request("/api/rewards", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Movie Night Pick",
        cost: 20,
      }),
    });

    expect(response.status).toBe(201);
    expect(createRewardCall).toEqual({
      user: parentUser,
      body: {
        title: "Movie Night Pick",
        cost: "20",
      },
    });
  });

  test("child cannot create a reward", async () => {
    activeUser = childUser;
    const app = await loadRewardsApp();

    const response = await app.request("/api/rewards", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        title: "Movie Night Pick",
        cost: 20,
      }),
    });

    expect(response.status).toBe(403);
    expect(createRewardCall).toBeNull();
  });

  test("child can redeem an affordable reward", async () => {
    activeUser = childUser;
    const app = await loadRewardsApp();

    const response = await app.request("/api/rewards/9/redeem", {
      method: "POST",
    });

    expect(response.status).toBe(200);
    expect(redeemRewardCall).toEqual({
      user: childUser,
      rewardId: 9,
    });
  });

  test("child cannot redeem an unaffordable reward", async () => {
    activeUser = childUser;
    redeemShouldThrow = true;
    const app = await loadRewardsApp();

    const response = await app.request("/api/rewards/9/redeem", {
      method: "POST",
    });

    expect(response.status).toBe(400);
    expect(redeemRewardCall).toEqual({
      user: childUser,
      rewardId: 9,
    });
  });
});

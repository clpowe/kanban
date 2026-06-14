import { drizzle } from "drizzle-orm/d1";
import { tasks, rewards } from "./src/db/schema";
import { createAuth } from "./src/auth/auth";

interface Env {
  family_kanban: D1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  ASSETS: Fetcher;
  POSTHOG_API_KEY: string;
  POSTHOG_HOST: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const db = drizzle(env.family_kanban);
    const auth = createAuth(env);

    try {
      // Clear existing data (order matters for foreign keys)
      await db.delete(tasks);
      await db.delete(rewards);

      // Create family members via Better Auth API
      const familyMembers = [
        {
          name: "Mom",
          username: "mom",
          email: "mom@family.local",
          type: "parent",
        },
        {
          name: "Dad",
          username: "dad",
          email: "dad@family.local",
          type: "parent",
        },
        {
          name: "Emma",
          username: "emma",
          email: "emma@family.local",
          type: "child",
        },
        {
          name: "Noah",
          username: "noah",
          email: "noah@family.local",
          type: "child",
        },
      ];

      const createdUsers: Record<string, any> = {};

      for (const member of familyMembers) {
        const result = await auth.api.signUpEmail({
          body: {
            name: member.name,
            username: member.username,
            email: member.email,
            password: "family123",
            type: member.type,
          },
        });
        createdUsers[member.username] = result.user;
      }

      const emma = createdUsers["emma"];
      const noah = createdUsers["noah"];

      if (!emma || !noah) {
        throw new Error("Expected seeded child users to exist");
      }

      // Insert rewards
      await db.insert(rewards).values([
        { name: "Ice Cream", value: 10 },
        { name: "Movie Night Pick", value: 20 },
        { name: "Stay Up Late", value: 30 },
      ]);

      // Insert tasks
      await db.insert(tasks).values([
        {
          title: "Clean Room",
          priority: "medium",
          value: 5,
          status: "todo",
          repeat: "daily",
          assigneeId: emma.id,
        },
        {
          title: "Take Out Trash",
          priority: "low",
          value: 3,
          status: "todo",
          repeat: "weekly",
          assigneeId: noah.id,
        },
        {
          title: "Do Homework",
          priority: "high",
          value: 7,
          status: "todo",
          repeat: "daily",
          assigneeId: noah.id,
        },
      ]);

      return new Response("✅ Family Kanban database seeded successfully!", {
        status: 200,
        headers: { "Content-Type": "text/plain" },
      });
    } catch (error) {
      return new Response(`❌ Error seeding database: ${error}`, {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      });
    }
  },
};

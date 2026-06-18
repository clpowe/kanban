import { Hono } from "hono";
import { getDB, type Env } from "../db/client";
import { requireParent } from "../auth/middleware";
import { eq } from "drizzle-orm";
import { tasks, users } from "../db/schema";

export function analyticsRoutes(app: Hono<Env>) {
  app.get("/api/analytics", async (c) => {
    try {
      requireParent(c);
      const db = getDB(c.env);

      // Get all child users in the system
      const children = await db
        .select()
        .from(users)
        .where(eq(users.type, "child"));

      // Get all tasks in the system
      const allTasks = await db.select().from(tasks);

      // Aggregate overall status counts
      const statusCounts = {
        todo: 0,
        doing: 0,
        done: 0,
        archived: 0,
      };

      for (const t of allTasks) {
        if (t.status in statusCounts) {
          statusCounts[t.status as keyof typeof statusCounts]++;
        }
      }

      // Aggregate child-specific stats
      const childStats = children.map((child) => {
        const childTasks = allTasks.filter((t) => t.assigneeId === child.id);
        const todo = childTasks.filter((t) => t.status === "todo").length;
        const doing = childTasks.filter((t) => t.status === "doing").length;
        const done = childTasks.filter((t) => t.status === "done").length;
        const archived = childTasks.filter(
          (t) => t.status === "archived",
        ).length;

        return {
          childId: child.id,
          name: child.name,
          username: child.username,
          points: child.points,
          todo,
          doing,
          done,
          archived,
        };
      });

      // Convert statusCounts object to an array of objects
      const statusCountsArray = Object.entries(statusCounts).map(
        ([status, count]) => ({
          status,
          count,
        }),
      );

      return c.json({
        statusCounts: statusCountsArray,
        childStats,
      });
    } catch (err: any) {
      console.error("GET /api/analytics error:", err);
      return c.json(
        { error: err?.message || "Failed to generate analytics" },
        500,
      );
    }
  });
}

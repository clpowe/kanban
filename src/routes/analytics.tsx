import type { Hono } from "hono";
import { getDB, type Env } from "../db/client";
import { requireParent } from "../auth/middleware";
import { eq, isNull, sql } from "drizzle-orm";
import { pointEntries, taskCompletions, tasks, users } from "../db/schema";

type AnalyticsRoutesDeps = {
  getDB: typeof getDB;
  requireParent: typeof requireParent;
};

const defaultDeps: AnalyticsRoutesDeps = { getDB, requireParent };

export function analyticsRoutes(
  app: Hono<Env>,
  overrides: Partial<AnalyticsRoutesDeps> = {},
) {
  const deps = { ...defaultDeps, ...overrides };

  app.get("/api/analytics", async (c) => {
    try {
      deps.requireParent(c);
      const db = deps.getDB(c.env);

      const [children, allTasks, completionRows, pointRows] = await Promise.all([
        db.select().from(users).where(eq(users.type, "child")),
        db.select().from(tasks),
        db
          .select({ completion: taskCompletions, task: tasks })
          .from(taskCompletions)
          .leftJoin(tasks, eq(taskCompletions.taskId, tasks.id))
          .where(isNull(taskCompletions.canceledAt)),
        db
          .select({
            userId: pointEntries.userId,
            points: sql<number>`coalesce(sum(${pointEntries.delta}), 0)`,
          })
          .from(pointEntries)
          .groupBy(pointEntries.userId),
      ]);

      const pointsByUser = new Map(
        pointRows.map((row) => [row.userId, Number(row.points)]),
      );
      const statusCounts = {
        todo: allTasks.filter((task) => task.status === "todo").length,
        doing: allTasks.filter((task) => task.status === "doing").length,
        done: completionRows.filter((row) => row.task?.status !== "archived")
          .length,
        archived: completionRows.filter(
          (row) => row.task?.status === "archived",
        ).length,
      };

      const childStats = children.map((child) => {
        const childTasks = allTasks.filter(
          (task) => task.assigneeId === child.id,
        );
        const childCompletions = completionRows.filter(
          (row) => row.completion.userId === child.id,
        );

        return {
          childId: child.id,
          name: child.name,
          username: child.username,
          points: pointsByUser.get(child.id) ?? 0,
          todo: childTasks.filter((task) => task.status === "todo").length,
          doing: childTasks.filter((task) => task.status === "doing").length,
          done: childCompletions.filter(
            (row) => row.task?.status !== "archived",
          ).length,
          archived: childCompletions.filter(
            (row) => row.task?.status === "archived",
          ).length,
        };
      });

      return c.json({
        statusCounts: Object.entries(statusCounts).map(([status, count]) => ({
          status,
          count,
        })),
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

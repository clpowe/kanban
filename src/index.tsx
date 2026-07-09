import { Hono } from "hono";
import type { Env } from "./db/client.ts";
import { createAuth } from "./auth/auth.ts";
import { sessionMiddleware } from "./auth/middleware.ts";
import { taskRoutes } from "./routes/tasks.tsx";
import { rewardRoutes } from "./routes/rewards.tsx";
import { userRoutes } from "./routes/users.tsx";
import { sessionRoutes } from "./routes/session.tsx";
import { analyticsRoutes } from "./routes/analytics.tsx";
import { archiveCompletedTasks, rolloverDailyTasks } from "./cron.ts";

const app = new Hono<Env>();

// ── Better Auth handler (must be before session middleware) ──
app.all("/api/auth/*", async (c) => {
  const auth = createAuth(c.env);
  return auth.handler(c.req.raw);
});

// ── Session middleware for protected API routes ─────────
app.use("/api/*", sessionMiddleware);
app.use("/session/*", sessionMiddleware);

// ── Session middleware for protected API routes ─────────
app.use("/api/*", sessionMiddleware);
app.use("/session/*", sessionMiddleware);

// ── API routes ──────────────────────────────────────────
taskRoutes(app);
rewardRoutes(app);
userRoutes(app);
sessionRoutes(app);
analyticsRoutes(app);

// ── SPA catch-all (serves index.html for all page routes) ──
app.get("*", async (c) => {
  try {
    const response = await c.env.ASSETS.fetch(
      new URL("/index.html", c.req.url),
    );
    return new Response(response.body, response);
  } catch (err) {
    console.error("Failed to load asset index.html:", err);
    return c.text("Not Found", 404);
  }
});

// ── Scheduled handlers ──────────────────────────────────
type ScheduledDeps = {
  rolloverDailyTasks: typeof rolloverDailyTasks;
  archiveCompletedTasks: typeof archiveCompletedTasks;
};

const scheduledDeps: ScheduledDeps = {
  rolloverDailyTasks,
  archiveCompletedTasks,
};

export const handleScheduled = async (
  controller: ScheduledController,
  env: Env["Bindings"],
  deps: ScheduledDeps = scheduledDeps,
) => {
  console.log("[CRON] triggered", controller.cron);

  if (controller.cron === "59 3 * * *" || controller.cron === "59 4 * * *") {
    await deps.rolloverDailyTasks(
      { Bindings: env } as Env,
      new Date(controller.scheduledTime),
    );
  }
  if (controller.cron === "59 23 * * 6") {
    await deps.archiveCompletedTasks({ Bindings: env } as Env);
  }
};

export default {
  fetch: app.fetch,

  async scheduled(controller: ScheduledController, env: Env["Bindings"]) {
    try {
      await handleScheduled(controller, env);
    } catch (err) {
      console.error("[CRON ERROR]", err);
      throw err;
    }
  },
};

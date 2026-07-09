import { tasks } from "./db/schema";
import { getDB, type Env } from "./db/client";
import { eq } from "drizzle-orm";
import { archiveDoneTasks } from "./services/task.service";
import { rolloverDailyTasks as rolloverDailyTasksService } from "./services/task.service";
import { isDailyRolloverTime } from "./utils/new-york-time";

// reset all daily tasks to "todo"
export const rolloverDailyTasks = async (env: Env, now = new Date()) => {
  if (!isDailyRolloverTime(now)) {
    console.log(
      "[CRON] Daily rollover skipped outside New York weekday cutoff",
    );
    return;
  }

  const db = getDB(env.Bindings);
  await rolloverDailyTasksService(db, now);

  console.log("[CRON] Daily tasks rolled over");
};

export const archiveCompletedTasks = async (env: Env) => {
  const db = getDB(env.Bindings);

  await archiveDoneTasks(db);

  console.log("[CRON] Weekly completed tasks archived");
};

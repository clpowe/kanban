import { eq } from "drizzle-orm";
import { tasks, users } from "./../db/schema";
import type { Database } from "../db/client";

export const getAllUsers = async (db: Database) => {
  return db.select().from(users);
};

export const getUserByUsername = async (db: Database, username: string) => {
  return db.select().from(users).where(eq(users.username, username)).get();
};

export const getTaskAssigneeId = async (db: Database, taskId: number) => {
  const task = await db
    .select({ assigneeId: tasks.assigneeId })
    .from(tasks)
    .where(eq(tasks.id, taskId))
    .get();

  return task?.assigneeId ?? null;
};

export const getUserById = async (db: Database, id: number) => {
  return db.select().from(users).where(eq(users.id, id)).get();
};

import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  type AnySQLiteColumn,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

// ── USERS (extended for Better Auth) ───────────────────
export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" })
    .notNull()
    .default(false),
  image: text("image"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  // Custom fields
  points: integer("points").notNull().default(0),
  type: text("type", { enum: ["parent", "child"] }).notNull(),
  username: text("username").notNull().unique(),
  displayUsername: text("display_username"),
});

// ── TASKS ──────────────────────────────────────────────
export const tasks = sqliteTable(
  "tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    title: text("title").notNull(),
    priority: text("priority", {
      enum: ["high", "medium", "low"],
    }).notNull(),
    value: integer("value").notNull(),
    status: text("status", {
      enum: ["todo", "doing", "review", "done", "archived"],
    })
      .notNull()
      .default("todo"),
    repeat: text("repeat", {
      enum: ["daily", "weekly", "none"],
    }).default("none"),
    assigneeId: integer("assignee_id").references(() => users.id),
    achievementId: integer("achievement_id").references(
      (): AnySQLiteColumn => taskAchievements.id,
      {
        onDelete: "set null",
      },
    ),
    cycleDate: text("cycle_date"),
    completedAt: integer("completed_at", { mode: "timestamp" }),
    archivedAt: integer("archived_at", { mode: "timestamp" }),
    archiveReason: text("archive_reason", {
      enum: ["completed", "missed", "manual"],
    }),
  },
  (table) => [
    uniqueIndex("tasks_achievement_cycle_unique").on(
      table.achievementId,
      table.cycleDate,
    ),
  ],
);

// ── REWARDS ────────────────────────────────────────────
export const rewards = sqliteTable("rewards", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  value: integer("value").notNull(),
});

// ── TASK ACHIEVEMENTS ──────────────────────────────────
export const taskAchievements = sqliteTable("task_achievements", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  taskId: integer("task_id")
    .unique()
    .references((): AnySQLiteColumn => tasks.id, { onDelete: "set null" }),
  name: text("name").notNull(), // Achievement name, e.g. "Clean Room Legend"
  targetStreak: integer("target_streak").notNull(), // e.g. 20
  currentStreak: integer("current_streak").notNull().default(0),
  prestigeCount: integer("prestige_count").notNull().default(0),
  lastCompletedAt: integer("last_completed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// ── EARNED BADGES (Trophy Room Collection) ─────────────
export const earnedBadges = sqliteTable("earned_badges", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  achievementId: integer("achievement_id")
    .notNull()
    .references(() => taskAchievements.id, { onDelete: "cascade" }),
  badgeName: text("badge_name").notNull(),
  prestigeLevel: integer("prestige_level").notNull(), // 1 for first time, 2 for second, etc.
  earnedAt: integer("earned_at", { mode: "timestamp" }).notNull(),
});

// ── BETTER AUTH: SESSIONS ──────────────────────────────
export const sessions = sqliteTable("session", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
});

// ── BETTER AUTH: ACCOUNTS ──────────────────────────────
export const accounts = sqliteTable("account", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", {
    mode: "timestamp",
  }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", {
    mode: "timestamp",
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

// ── BETTER AUTH: VERIFICATION ──────────────────────────
export const verifications = sqliteTable("verification", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

// ── RELATIONS ──────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  tasks: many(tasks),
  sessions: many(sessions),
  accounts: many(accounts),
  badges: many(earnedBadges),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  assignee: one(users, {
    fields: [tasks.assigneeId],
    references: [users.id],
  }),
  achievement: one(taskAchievements, {
    fields: [tasks.achievementId],
    references: [taskAchievements.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));
export const taskAchievementsRelations = relations(
  taskAchievements,
  ({ one }) => ({
    task: one(tasks, {
      fields: [taskAchievements.taskId],
      references: [tasks.id],
    }),
  }),
);

export const earnedBadgesRelations = relations(earnedBadges, ({ one }) => ({
  user: one(users, {
    fields: [earnedBadges.userId],
    references: [users.id],
  }),
  achievement: one(taskAchievements, {
    fields: [earnedBadges.achievementId],
    references: [taskAchievements.id],
  }),
}));

# Task System Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace mutable task completion, point, and streak counters with an event-based ledger that preserves completion history, makes point balances auditable, and keeps multi-step writes atomic.

**Architecture:** `task_completions` and `point_entries` become the source of truth. Repeat-task completions are keyed by `achievement_id` plus the New York cycle date so streaks span the archived/current task row chain. `users.points` remains a denormalized cache, but every ledger write refreshes it from `SUM(point_entries.delta)` in the same D1 batch. Current API response shapes are preserved by hydrating derived `currentStreak`, `prestigeCount`, and `lastCompletedAt` values on read.

**Tech Stack:** TypeScript, Hono, Drizzle ORM, Cloudflare D1, Bun test, `bun:sqlite`, Temporal via `@js-temporal/polyfill`

---

## Current repo facts this plan relies on

1. Migration files and journal entries already exist through `0009`. If `0007`, `0008`, or `0009` are still untracked in the implementation worktree, settle that before creating `0010`.
2. The current mutable achievement state is only `task_achievements.current_streak`, `prestige_count`, and `last_completed_at`. There are no `missed_days_in_a_row` or `prev_*` columns in the current schema.
3. Repeat tasks are represented as per-cycle `tasks` rows tied together by `tasks.achievement_id`. Rollover archives the old row and creates the next row.
4. Daily cycle boundaries use `America/New_York` via `src/utils/new-york-time.ts`. Ledger `completed_on` must use the same date key, not UTC.
5. The Solid client expects achievement objects to include `currentStreak`, `prestigeCount`, and `lastCompletedAt`. Those fields must stay in API payloads even after the database columns are dropped.

## Target data model

### New table: `task_completions`

`task_completions` records the fact that a task was completed. Rows are not deleted for undo. Undo marks the row canceled and appends a reversing point entry.

```sql
CREATE TABLE `task_completions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `event_id` text NOT NULL,
  `task_id` integer REFERENCES `tasks`(`id`) ON DELETE SET NULL,
  `achievement_id` integer REFERENCES `task_achievements`(`id`) ON DELETE SET NULL,
  `user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `completed_on` text NOT NULL,
  `completed_at` integer NOT NULL,
  `canceled_at` integer,
  `cancel_reason` text,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_completions_event_unique`
  ON `task_completions` (`event_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_completions_active_achievement_day_unique`
  ON `task_completions` (`achievement_id`, `completed_on`)
  WHERE `achievement_id` IS NOT NULL AND `canceled_at` IS NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `task_completions_active_task_unique`
  ON `task_completions` (`task_id`)
  WHERE `achievement_id` IS NULL AND `task_id` IS NOT NULL AND `canceled_at` IS NULL;
--> statement-breakpoint
CREATE INDEX `task_completions_user_idx`
  ON `task_completions` (`user_id`, `completed_on`);
--> statement-breakpoint
CREATE INDEX `task_completions_achievement_idx`
  ON `task_completions` (`achievement_id`, `completed_on`);
```

Notes:

- `completed_on` is the existing app cycle key: `task.cycleDate ?? getNewYorkDateKey(now)`.
- Repeat streaks derive from all active completions for the same `achievement_id`, not from the current `task_id`.
- One-off tasks use the partial `task_id` uniqueness rule.

### New table: `point_entries`

`point_entries` records every point delta. `users.points` is a cache and must equal `COALESCE(SUM(point_entries.delta), 0)` for that user.

```sql
CREATE TABLE `point_entries` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `event_id` text NOT NULL,
  `user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `delta` integer NOT NULL,
  `reason` text NOT NULL,
  `task_completion_id` integer REFERENCES `task_completions`(`id`) ON DELETE SET NULL,
  `task_id` integer REFERENCES `tasks`(`id`) ON DELETE SET NULL,
  `achievement_id` integer REFERENCES `task_achievements`(`id`) ON DELETE SET NULL,
  `reward_id` integer REFERENCES `rewards`(`id`) ON DELETE SET NULL,
  `reverses_entry_id` integer REFERENCES `point_entries`(`id`) ON DELETE SET NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `point_entries_event_unique`
  ON `point_entries` (`event_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `point_entries_one_reversal_unique`
  ON `point_entries` (`reverses_entry_id`)
  WHERE `reverses_entry_id` IS NOT NULL;
--> statement-breakpoint
CREATE INDEX `point_entries_user_idx`
  ON `point_entries` (`user_id`, `created_at`);
```

Allowed `reason` values:

- `opening_balance`
- `task_completed`
- `completion_undone`
- `reward_redeemed`
- `manual_adjustment` only if a future admin flow needs it

### Existing table updates

Add to `earned_badges`:

```sql
ALTER TABLE `earned_badges` ADD `task_completion_id` integer REFERENCES task_completions(id) ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE `earned_badges` ADD `revoked_at` integer;
--> statement-breakpoint
ALTER TABLE `earned_badges` ADD `revoked_reason` text;
```

At the end of the migration, drop only these legacy state columns from `task_achievements`:

- `current_streak`
- `prestige_count`
- `last_completed_at`

Keep:

- `task_id`: current task pointer for existing achievement/profile joins
- `name`
- `target_streak`
- `created_at`
- `updated_at`

## Key rules

- No implementation should read `childUser.points` from the session to calculate a new balance.
- Every point-changing operation inserts or skips a `point_entries` row and then refreshes `users.points` from `SUM(delta)` in the same batch.
- Undo is append-only: cancel the completion, add a negative point entry, revoke any badge tied to that completion, and refresh the user point cache.
- Badge rows remain history. Hide revoked badges from API responses and count only non-revoked badges for `prestigeCount`.
- Use indexed, scoped completion queries. A per-achievement query is acceptable; do not scan all completions for a board load.
- Preserve current HTTP response shapes. The client should not need a coordinated change for this plan.

---

## Phase 0: Baseline and guardrails

### Task 1: Confirm migration and test baseline

**Files:**
- Review: `drizzle/meta/_journal.json`
- Review: `drizzle/0007_premium_xavin.sql`
- Review: `drizzle/0008_violet_devos.sql`
- Review: `drizzle/0009_clumsy_rawhide_kid.sql`
- Review: `src/db/schema.ts`

**Step 1: Check migration files and journal**

Run: `git status --short drizzle drizzle/meta`

Expected: no missing `0007`/`0008`/`0009` migration files. If any are untracked, stop and commit or otherwise settle the migration baseline before generating `0010`.

**Step 2: Check TypeScript baseline**

Run: `bunx tsc --noEmit`

Expected: PASS, or record any existing failures before starting the overhaul.

**Step 3: Check test baseline**

Run: `bun test`

Expected: PASS, or record existing failures before starting the overhaul.

**Step 4: Commit**

No commit is required if this task only records baseline results.

---

## Phase 1: Isolate existing behavior before changing storage

### Task 2: Extract current streak rules into a pure service

**Files:**
- Create: `src/services/streak.ts`
- Create: `src/services/streak.test.ts`
- Modify: `src/services/task.service.ts`

**Step 1: Write failing characterization tests**

Create tests for the behavior currently embedded in `updateTaskStatus`:

- first completion sets streak to `1`
- same daily completion within 12 hours does not increment
- daily consecutive New York weekdays increment by `1`
- daily skipped weekdays apply the current penalty: `max(0, current - missedDays * 2) + 1`
- same weekly completion within 72 hours does not increment
- weekly completion within 240 hours increments by `1`
- weekly completion after more than 240 hours applies the current missed-week penalty
- hitting `targetStreak` resets current streak to `0` and returns a badge milestone

Run: `bun test src/services/streak.test.ts`

Expected: FAIL because `src/services/streak.ts` does not exist yet.

**Step 2: Implement the pure streak functions**

Create a small API that mirrors current behavior:

```ts
export type StreakInput = {
  repeat: "daily" | "weekly" | "none" | null;
  targetStreak: number;
  currentStreak: number;
  prestigeCount: number;
  lastCompletedAt: Date | null;
};

export type StreakResult = {
  currentStreak: number;
  prestigeCount: number;
  lastCompletedAt: Date;
  earnedBadge: boolean;
};

export function applyCompletionToStreak(input: StreakInput, now: Date): StreakResult;
```

Copy the existing business rules out of `src/services/task.service.ts` instead of redesigning them in this task.

**Step 3: Route current task completion through the pure function**

Modify only the current streak block in `updateTaskStatus` to call `applyCompletionToStreak`. Keep all storage behavior unchanged.

**Step 4: Run focused tests**

Run: `bun test src/services/streak.test.ts src/services/task.service.test.ts`

Expected: PASS.

**Step 5: Run TypeScript**

Run: `bunx tsc --noEmit`

Expected: PASS.

**Step 6: Commit**

```bash
git add src/services/streak.ts src/services/streak.test.ts src/services/task.service.ts
git commit -m "refactor: extract task streak rules"
```

### Task 3: Add derived streak projection from completion rows

**Files:**
- Modify: `src/services/streak.ts`
- Modify: `src/services/streak.test.ts`

**Step 1: Write failing projection tests**

Add tests for:

- empty completion dates returns current streak `0`
- consecutive daily New York date keys produce the expected count
- skipped weekdays apply the same penalty as `applyCompletionToStreak`
- weekly date gaps match the existing weekly rules
- reaching the target resets current streak to `0`
- dates after a badge completion continue the next prestige cycle

Run: `bun test src/services/streak.test.ts`

Expected: FAIL because projection from completion dates is not implemented.

**Step 2: Implement projection by reusing the characterized rules**

Add:

```ts
export type CompletionForStreak = {
  completedOn: string;
  completedAt: Date;
};

export function deriveStreakFromCompletions(
  completions: CompletionForStreak[],
  options: { repeat: "daily" | "weekly" | "none" | null; targetStreak: number },
): { currentStreak: number; lastCompletedAt: Date | null; projectedPrestigeCount: number };
```

Sort completions oldest to newest and fold through `applyCompletionToStreak` so the write-time and read-time paths cannot drift.

**Step 3: Run tests**

Run: `bun test src/services/streak.test.ts`

Expected: PASS.

**Step 4: Commit**

```bash
git add src/services/streak.ts src/services/streak.test.ts
git commit -m "feat: derive streaks from completion history"
```

---

## Phase 2: Test database and types

### Task 4: Add an in-memory database harness

**Files:**
- Create: `src/db/test-db.ts`
- Create: `src/db/test-db.test.ts`

**Step 1: Write the failing test**

Test that `createTestDb()`:

- opens an in-memory `bun:sqlite` database
- applies migrations in `drizzle/meta/_journal.json` order
- returns a Drizzle database where `select().from(tasks)` works
- exposes a D1-like `batch()` method for service tests

Run: `bun test src/db/test-db.test.ts`

Expected: FAIL because the helper does not exist.

**Step 2: Implement the harness**

Use `drizzle-orm/bun-sqlite` with `new Database(":memory:")`. Read migration files by journal order and split statements on `--> statement-breakpoint`. Execute non-empty statements.

The returned object should be compatible with service code that calls `db.batch([...])`. In tests, the shim may execute the batch against the same SQLite connection inside a transaction.

**Step 3: Run focused tests**

Run: `bun test src/db/test-db.test.ts`

Expected: PASS.

**Step 4: Commit**

```bash
git add src/db/test-db.ts src/db/test-db.test.ts
git commit -m "test: add in-memory database harness"
```

### Task 5: Type the database boundary

**Files:**
- Modify: `src/db/client.ts`
- Modify: `src/services/task.service.ts`
- Modify: `src/services/reward.service.ts`
- Modify: `src/services/user.service.ts`
- Modify tests as needed

**Step 1: Export the production database type**

In `src/db/client.ts`, export:

```ts
export type Database = ReturnType<typeof getDB>;
```

If the test harness returns a compatible but extended type with `batch()`, export that test type from `src/db/test-db.ts`.

**Step 2: Replace `db: any` in service signatures**

Start with service files only. Do not try to remove every `any` in routes in this task.

**Step 3: Fix compiler fallout**

Use focused casts at test boundaries only, for example `as unknown as Database`.

**Step 4: Run TypeScript**

Run: `bunx tsc --noEmit`

Expected: PASS.

**Step 5: Run tests**

Run: `bun test src/services/task.service.test.ts src/services/reward.service.test.ts src/services/user.service.ts`

Expected: PASS, except the last path may have no tests.

**Step 6: Commit**

```bash
git add src/db/client.ts src/services/task.service.ts src/services/reward.service.ts src/services/user.service.ts src/services/*.test.ts
git commit -m "refactor: type service database parameters"
```

---

## Phase 3: Ledger schema

### Task 6: Add ledger tables and badge revocation fields

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/types/index.ts`
- Create: `drizzle/0010_task_ledger.sql`
- Create: `drizzle/meta/0010_snapshot.json`
- Modify: `drizzle/meta/_journal.json`
- Modify: `src/db/schema.test.ts`
- Modify: `src/db/test-db.test.ts`

**Step 1: Add schema definitions**

Add `taskCompletions` and `pointEntries` to `src/db/schema.ts`, plus relations:

- `users.completions`
- `users.pointEntries`
- `tasks.completions`
- `taskAchievements.completions`
- `taskAchievements.pointEntries`
- `earnedBadges.taskCompletion`

Add `taskCompletionId`, `revokedAt`, and `revokedReason` to `earnedBadges`.

**Step 2: Export inferred types**

Export select/insert types for the new tables from `src/types/index.ts`.

**Step 3: Generate or write the migration**

Preferred:

Run: `bunx drizzle-kit generate`

Expected: a new `0010` migration and snapshot.

If Drizzle does not emit the partial unique indexes correctly, manually edit only the generated `0010` SQL to include the indexes listed in "Target data model".

**Step 4: Add schema tests**

Extend `src/db/schema.test.ts` to assert that:

- `taskCompletions.completedOn` exists
- `taskCompletions.achievementId` exists
- `pointEntries.delta` exists
- `earnedBadges.revokedAt` exists

Run: `bun test src/db/schema.test.ts src/db/test-db.test.ts`

Expected: PASS.

**Step 5: Run local migration verification**

Run: `bunx wrangler d1 migrations apply family-kanban --local`

Expected: migrations apply locally without SQL errors.

**Step 6: Run TypeScript**

Run: `bunx tsc --noEmit`

Expected: PASS.

**Step 7: Commit**

```bash
git add src/db/schema.ts src/types/index.ts src/db/schema.test.ts src/db/test-db.test.ts drizzle/0010_*.sql drizzle/meta/_journal.json drizzle/meta/0010_snapshot.json
git commit -m "feat: add task and point ledger schema"
```

---

## Phase 4: Ledger write paths

### Task 7: Add point ledger helpers

**Files:**
- Create: `src/services/point-ledger.service.ts`
- Create: `src/services/point-ledger.service.test.ts`

**Step 1: Write failing tests**

Use `createTestDb()` to test:

- `getPointBalance(db, userId)` returns `SUM(delta)`
- `refreshUserPointCache(db, userId)` sets `users.points` to the ledger sum
- an opening balance row makes `users.points === SUM(delta)`
- a negative entry cannot leave cache and ledger out of sync

Run: `bun test src/services/point-ledger.service.test.ts`

Expected: FAIL because the service does not exist.

**Step 2: Implement minimal helpers**

Add helpers that construct or execute:

- a balance query scoped to one user
- a cache refresh update: `users.points = COALESCE((SELECT SUM(delta) FROM point_entries WHERE user_id = ?), 0)`
- a test-only assertion helper for `users.points === SUM(delta)`

Keep reward and completion-specific behavior out of this helper.

**Step 3: Run tests**

Run: `bun test src/services/point-ledger.service.test.ts`

Expected: PASS.

**Step 4: Commit**

```bash
git add src/services/point-ledger.service.ts src/services/point-ledger.service.test.ts
git commit -m "feat: add point ledger helpers"
```

### Task 8: Add completion ledger service

**Files:**
- Create: `src/services/completion.service.ts`
- Create: `src/services/completion.service.test.ts`
- Modify: `src/services/streak.ts` if needed

**Step 1: Write failing completion tests**

Use `createTestDb()` and real rows. Cover:

- recording a one-off task completion inserts one active `task_completions` row
- recording a repeat task uses `achievement_id` plus `completed_on`
- `completed_on` is `task.cycleDate` when present
- recording inserts a `task_completed` point entry
- recording refreshes `users.points` from ledger sum
- recording the same task/day twice is idempotent
- crossing `targetStreak` inserts an `earned_badges` row tied to `task_completion_id`

Run: `bun test src/services/completion.service.test.ts`

Expected: FAIL because the service does not exist.

**Step 2: Implement `recordCompletion`**

Add an API shaped like:

```ts
export async function recordCompletion(
  db: Database,
  task: Task,
  userId: number,
  now: Date,
): Promise<{ completionId: number | null; earnedBadge: boolean }>;
```

Rules:

- Compute `completedOn` as `task.cycleDate ?? getNewYorkDateKey(now)`.
- Use `task.achievementId` for repeat streak identity.
- Insert the completion row only if no active row exists for that identity.
- Insert a `task_completed` point entry for the inserted completion.
- Refresh `users.points` from `SUM(delta)` in the same batch.
- During migration only, dual-write `task_achievements.current_streak`, `prestige_count`, and `last_completed_at` from derived state.

**Step 3: Run completion tests**

Run: `bun test src/services/completion.service.test.ts`

Expected: PASS.

**Step 4: Write failing undo tests**

Cover:

- undo marks the active completion canceled instead of deleting it
- undo inserts one `completion_undone` point entry
- undo refreshes `users.points` from ledger sum
- undo revokes the badge tied to the completion, if one exists
- undo is idempotent
- redo after undo creates a new active completion and credits points once

Run: `bun test src/services/completion.service.test.ts`

Expected: FAIL until undo is implemented.

**Step 5: Implement `undoCompletion`**

Add:

```ts
export async function undoCompletion(
  db: Database,
  task: Task,
  userId: number,
  now: Date,
): Promise<void>;
```

Rules:

- Find the active completion for the task identity.
- Set `canceled_at` and `cancel_reason = 'undo'`.
- Insert a `completion_undone` point entry with `delta = -task.value`.
- Set `reverses_entry_id` when reversing a known positive completion entry.
- Soft-revoke any badge with the matching `task_completion_id`.
- Refresh `users.points` from `SUM(delta)` in the same batch.
- During migration only, recompute and dual-write legacy streak columns from remaining active completions.

**Step 6: Run focused tests**

Run: `bun test src/services/completion.service.test.ts src/services/point-ledger.service.test.ts`

Expected: PASS.

**Step 7: Commit**

```bash
git add src/services/completion.service.ts src/services/completion.service.test.ts src/services/streak.ts
git commit -m "feat: add completion ledger service"
```

### Task 9: Route task status changes through the ledger

**Files:**
- Modify: `src/services/task.service.ts`
- Modify: `src/services/task.service.test.ts`

**Step 1: Port relevant tests to the real test database**

Replace mock-chain tests for done/undo flows with `createTestDb()` tests:

- `todo -> done` updates task status, completion history, point ledger, point cache, and streak
- `done -> todo` clears `completedAt`, cancels completion, appends reversal, and refreshes point cache
- `done -> archived` does not subtract points
- unassigned tasks do not create point entries
- repeat daily task completion uses the current task's `cycleDate`

Run: `bun test src/services/task.service.test.ts`

Expected: FAIL because `updateTaskStatus` still mutates points and streaks directly.

**Step 2: Rewire `updateTaskStatus`**

Keep:

- task existence read
- parent/child access remains in route/middleware
- status validation remains outside the service

Change:

- done transitions delegate to `recordCompletion`
- undo transitions delegate to `undoCompletion`
- task status update and ledger writes should be batched together where practical
- archived transition preserves completed history and points

**Step 3: Run focused tests**

Run: `bun test src/services/task.service.test.ts src/services/completion.service.test.ts`

Expected: PASS.

**Step 4: Run broader tests**

Run: `bun test`

Expected: PASS, or only unrelated pre-existing failures recorded in Task 1.

**Step 5: Commit**

```bash
git add src/services/task.service.ts src/services/task.service.test.ts
git commit -m "feat: route task completion through ledger"
```

### Task 10: Fix reward redemption with point ledger entries

**Files:**
- Modify: `src/services/reward.service.ts`
- Modify: `src/services/reward.service.test.ts`

**Step 1: Write failing database-backed tests**

Use `createTestDb()` to cover:

- redeem inserts a `reward_redeemed` point entry with negative delta
- redeem refreshes `users.points` from ledger sum
- redeem does not use `childUser.points` as the source of truth
- two sequential redeems that exceed balance cause the second redeem to throw `Insufficient points`
- failed redeem inserts no point entry

Run: `bun test src/services/reward.service.test.ts`

Expected: FAIL because redemption still writes an absolute points value from the session user.

**Step 2: Implement conditional ledger redemption**

Implementation rule:

- Fetch the reward row.
- Insert the negative point entry only from a `SELECT` constrained by the current cached balance, for example `WHERE users.id = ? AND users.points >= ?`.
- Refresh `users.points` from `SUM(delta)` in the same batch.
- After the batch, verify that the redemption event row exists. If not, throw `Insufficient points`.

Do not write `points: childUser.points - reward.cost`.

**Step 3: Run focused tests**

Run: `bun test src/services/reward.service.test.ts src/services/point-ledger.service.test.ts`

Expected: PASS.

**Step 4: Run TypeScript**

Run: `bunx tsc --noEmit`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/services/reward.service.ts src/services/reward.service.test.ts
git commit -m "fix: redeem rewards through point ledger"
```

---

## Phase 5: Backfill

### Task 11: Backfill opening balances and historical completions

**Files:**
- Create: `drizzle/0011_ledger_backfill.sql`
- Create: `drizzle/meta/0011_snapshot.json`
- Modify: `drizzle/meta/_journal.json`
- Create: `src/db/ledger-backfill.test.ts`

**Step 1: Write migration test fixtures**

Add a test that seeds pre-ledger rows, applies the backfill migration, and verifies:

- each user with non-zero points gets one `opening_balance` point entry
- `users.points === SUM(point_entries.delta)`
- completed or completed-archived tasks get active completion rows
- missed archived tasks do not get completion rows
- `task_achievements.last_completed_at` creates a fallback completion only when no task completion can be inferred

Run: `bun test src/db/ledger-backfill.test.ts`

Expected: FAIL because migration does not exist.

**Step 2: Create opening balances**

Insert one `opening_balance` row per user where `users.points != 0`.

Important: do not also create historical positive `task_completed` point entries for past tasks, or the ledger sum will double-count existing balances.

**Step 3: Backfill completion history from task rows**

Insert active completion rows from tasks where:

- `status = 'done'`, or
- `status = 'archived' AND archive_reason = 'completed'`

Use:

- `tasks.assignee_id` for `user_id`
- `tasks.achievement_id` for repeat identity
- `tasks.cycle_date` for repeat `completed_on`
- a documented fallback date from `completed_at`/`archived_at` for non-repeat tasks without `cycle_date`

**Step 4: Add fallback seed completions from achievements**

For achievements with `last_completed_at` but no inferred task completion, add one completion row so derived streaks have a seed.

Document that full pre-ledger streak history is unrecoverable.

**Step 5: Verify locally**

Run: `bun test src/db/ledger-backfill.test.ts`

Expected: PASS.

Run: `bunx wrangler d1 migrations apply family-kanban --local`

Expected: PASS.

**Step 6: Commit**

```bash
git add drizzle/0011_*.sql drizzle/meta/_journal.json drizzle/meta/0011_snapshot.json src/db/ledger-backfill.test.ts
git commit -m "feat: backfill task and point ledger"
```

---

## Phase 6: Derived reads

### Task 12: Hydrate task achievement fields from completions

**Files:**
- Modify: `src/services/task.service.ts`
- Create: `src/services/achievement-projection.service.ts`
- Create: `src/services/achievement-projection.service.test.ts`
- Modify: `src/services/task.service.test.ts`

**Step 1: Write failing projection tests**

Use real DB rows to cover:

- `getActiveTasks` returns achievement objects with derived `currentStreak`
- `getTaskById` returns the same derived shape
- repeat task streaks include completions from older archived task rows with the same `achievement_id`
- `prestigeCount` counts non-revoked `earned_badges`
- `lastCompletedAt` comes from latest active completion
- legacy columns are not consulted by the projection helper

Run: `bun test src/services/achievement-projection.service.test.ts src/services/task.service.test.ts`

Expected: FAIL because reads still return raw `task_achievements`.

**Step 2: Implement achievement projection helper**

Add a helper that accepts a task plus achievement row and returns the current API-compatible achievement object:

```ts
{
  ...achievement,
  currentStreak,
  prestigeCount,
  lastCompletedAt,
}
```

For repeat achievements, query active completions by `achievement_id`. For one-off tasks without an achievement, no projection is needed.

**Step 3: Wire task reads**

Use the helper in:

- `getActiveTasks`
- `getTaskById`

Keep the JSON shape unchanged.

**Step 4: Run focused tests**

Run: `bun test src/services/achievement-projection.service.test.ts src/services/task.service.test.ts`

Expected: PASS.

**Step 5: Commit**

```bash
git add src/services/achievement-projection.service.ts src/services/achievement-projection.service.test.ts src/services/task.service.ts src/services/task.service.test.ts
git commit -m "feat: derive task achievement fields from ledger"
```

### Task 13: Move user achievement and avatar stats to the ledger

**Files:**
- Modify: `src/routes/users.tsx`
- Create/modify: `src/routes/users.test.tsx`
- Modify: `src/client/lib/api.ts` only if generated/API types need a non-breaking type update

**Step 1: Write failing route tests**

Cover `/api/users/:id/achievements`:

- achievement list includes derived `currentStreak`, `prestigeCount`, and `lastCompletedAt`
- revoked badges are excluded from `badges`
- `stats.totalCompleted` counts active completion rows
- `stats.highPriorityCompleted`, `repeatingCompleted`, and `cleanCompleted` derive from completion rows joined to task snapshots/current task rows
- avatar unlock checks use completion count from `task_completions`, not task status/archive state

Run: `bun test src/routes/users.test.tsx`

Expected: FAIL until route logic moves off task status counts.

**Step 2: Replace task-status completion counting**

Remove local `isCompletedTask` logic for stats/unlocks and query `task_completions` where `canceled_at IS NULL`.

**Step 3: Filter revoked badges**

Add `revoked_at IS NULL` to badge reads.

**Step 4: Run focused tests**

Run: `bun test src/routes/users.test.tsx`

Expected: PASS.

**Step 5: Run broader tests**

Run: `bun test src/routes/users.test.tsx src/routes/session.test.tsx src/routes/rewards.test.tsx`

Expected: PASS.

**Step 6: Commit**

```bash
git add src/routes/users.tsx src/routes/users.test.tsx src/client/lib/api.ts
git commit -m "feat: derive user achievement stats from ledger"
```

### Task 14: Verify rollover and cron semantics against ledger dates

**Files:**
- Modify: `src/services/task.service.test.ts`
- Modify: `src/cron.ts` only if needed
- Modify: `src/services/task.service.ts` only if needed

**Step 1: Add rollover tests**

Cover:

- completing a daily task records `completed_on = task.cycleDate`
- rollover archives completed task as `completed`
- rollover creates the next weekday task with the same `achievement_id`
- completing the next task continues the streak from the prior completion row
- missed archived tasks do not create completion rows

Run: `bun test src/services/task.service.test.ts`

Expected: PASS if prior tasks handled this correctly, otherwise FAIL and fix.

**Step 2: Confirm cron has no counter sweep**

The current cron calls `rolloverDailyTasks`; it should not reset streak counters. If any counter update remains in rollover code after this phase, remove it.

**Step 3: Commit**

```bash
git add src/services/task.service.ts src/services/task.service.test.ts src/cron.ts
git commit -m "test: verify rollover ledger semantics"
```

---

## Phase 7: Drop legacy achievement counters

### Task 15: Remove dual-writes and drop counter columns

**Files:**
- Modify: `src/services/completion.service.ts`
- Modify: `src/services/task.service.ts`
- Modify: `src/services/achievement-projection.service.ts`
- Modify: `src/db/schema.ts`
- Modify: `src/types/index.ts`
- Create: `drizzle/0012_drop_achievement_counters.sql`
- Create: `drizzle/meta/0012_snapshot.json`
- Modify: `drizzle/meta/_journal.json`
- Modify tests as needed

**Step 1: Remove legacy dual-writes**

Delete writes to:

- `taskAchievements.currentStreak`
- `taskAchievements.prestigeCount`
- `taskAchievements.lastCompletedAt`

Run: `bunx tsc --noEmit`

Expected: FAIL anywhere a dropped field is still required.

**Step 2: Remove columns from Drizzle schema**

Delete the three legacy columns from `taskAchievements` in `src/db/schema.ts`.

**Step 3: Generate migration**

Run: `bunx drizzle-kit generate`

Expected: new `0012` migration and snapshot.

Verify the SQL drops only:

- `current_streak`
- `prestige_count`
- `last_completed_at`

**Step 4: Fix compiler fallout**

Anything still reading the removed columns should use `achievement-projection.service.ts`.

Run: `bunx tsc --noEmit`

Expected: PASS.

**Step 5: Run tests**

Run: `bun test`

Expected: PASS.

**Step 6: Verify local migrations**

Run: `bunx wrangler d1 migrations apply family-kanban --local`

Expected: PASS.

**Step 7: Commit**

```bash
git add src/services/completion.service.ts src/services/task.service.ts src/services/achievement-projection.service.ts src/db/schema.ts src/types/index.ts drizzle/0012_*.sql drizzle/meta/_journal.json drizzle/meta/0012_snapshot.json
git commit -m "refactor: derive achievement counters from ledger"
```

---

## Phase 8: Cleanup and invariants

### Task 16: Replace remaining service mock-chain tests

**Files:**
- Modify: `src/services/task.service.test.ts`
- Modify: `src/services/reward.service.test.ts`
- Modify: any remaining `src/services/*.test.ts` with hand-rolled query-chain mocks

**Step 1: Find remaining mocks**

Run: `rg "select\\(\\).*from|return \\{\\s*from\\(|where: async|then\\(resolve" src/services -n`

Expected: identify remaining mock-chain tests.

**Step 2: Port tests to `createTestDb()`**

Keep small pure-function tests as pure tests. Port persistence behavior to the in-memory database.

**Step 3: Run service tests**

Run: `bun test src/services`

Expected: PASS.

**Step 4: Commit**

```bash
git add src/services/*.test.ts
git commit -m "test: replace service query-chain mocks"
```

### Task 17: Add ledger consistency scenario tests

**Files:**
- Create: `src/services/ledger-consistency.test.ts`

**Step 1: Write scenario tests**

Create tests that run realistic operation sequences across three children:

- complete task
- undo completion
- redo completion
- redeem reward
- attempt over-budget reward
- complete repeat tasks across rollover-created rows
- undo badge-earning completion

Assert after every operation:

- `users.points === SUM(point_entries.delta)`
- no child has negative points
- active completions have no duplicate active identity
- revoked badges are excluded from `prestigeCount`
- derived streak matches `deriveStreakFromCompletions`

Run: `bun test src/services/ledger-consistency.test.ts`

Expected: PASS.

**Step 2: Run full verification**

Run: `bunx tsc --noEmit`

Expected: PASS.

Run: `bun test`

Expected: PASS.

Run: `bunx wrangler d1 migrations apply family-kanban --local`

Expected: PASS.

**Step 3: Commit**

```bash
git add src/services/ledger-consistency.test.ts
git commit -m "test: add ledger consistency scenarios"
```

---

## Out of scope follow-ups

- Per-family configurable timezone. This plan preserves the existing New York date semantics.
- Client store simplification. API shape stays compatible in this plan.
- Reworking `archived` out of the task workflow enum.
- Full historical reconstruction before ledger deployment. The backfill creates opening balances and best-effort completion seeds only.
- Admin manual point adjustments, except reserving the `manual_adjustment` reason.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| D1 `batch()` is not an interactive transaction | Build ledger writes as idempotent batchable statements and refresh point cache from ledger sum instead of arithmetic increments. |
| Repeat streaks split across archived/current task rows | Store `achievement_id` on completions and derive repeat streaks by achievement, not task. |
| UTC/local date mismatch | Use `task.cycleDate ?? getNewYorkDateKey(now)` for `completed_on`. |
| Undo corrupts audit history | Soft-cancel completions, append reversing point entries, and soft-revoke badges. |
| Existing profile/avatar stats still read task status | Explicitly migrate `/api/users/:id/achievements` and avatar unlock checks to `task_completions`. |
| Backfill double-counts points | Use `opening_balance` for pre-ledger points; do not insert historical positive task point entries. |
| Drizzle generated migration misses partial indexes | Verify and manually add the partial unique indexes to the generated SQL before applying migrations. |
| Deleting tasks with history loses context | Completion rows use `ON DELETE SET NULL`; future UX can prefer archive over hard delete for historical tasks. |


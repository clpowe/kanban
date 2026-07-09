# Task System Overhaul Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the mutable-counter task/points/streak design with an event-based ledger: completions and point changes become immutable rows, streaks and balances become derived values, and every multi-step write becomes atomic.

**Architecture:** Two new append-only tables (`task_completions`, `point_entries`) become the source of truth. Streaks are computed by folding completion dates through the existing pure logic in `src/services/streak.ts`. `users.points` stays as a denormalized cache, updated in the same D1 batch as the ledger entry that changes it. Legacy counter columns on `task_achievements` are dual-written during migration, then dropped. The HTTP API shapes are preserved so the Solid client is untouched.

**Tech Stack:** Hono, Drizzle ORM, Cloudflare D1 (`db.batch()`), Bun test with in-memory `bun:sqlite`.

---

## Why (current design flaws)

1. **No completion history.** The midnight cron flips `done → todo` and discards the fact that the task was ever done. Streaks therefore require mutable counters (`currentStreak`, `missedDaysInARow`) plus `prev_*` snapshot columns just to support undo. Analytics has no raw data.
2. **No atomicity.** `updateTaskStatus` performs up to 5 sequential writes (task status, user points, achievement select, badge insert, achievement update). A worker eviction mid-sequence leaves points credited without the streak, or a badge without prestige.
3. **Points are a mutable total.** Undo is subtraction; redeem (`reward.service.ts`) reads the session's stale `points` value and writes an absolute number — two concurrent redeems lose an update. No audit trail.
4. **`db: any` across the service layer** — no type checking exactly where points and badges are computed.
5. **Tests are hand-rolled mock chains** that assert call shapes, not behavior.

## Target schema

```sql
-- 0010_task_ledger.sql
CREATE TABLE `task_completions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `task_id` integer NOT NULL REFERENCES `tasks`(`id`) ON DELETE CASCADE,
  `user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `completed_on` text NOT NULL,             -- UTC calendar date 'YYYY-MM-DD'
  `created_at` integer NOT NULL             -- epoch ms timestamp
);
--> statement-breakpoint
CREATE UNIQUE INDEX `task_completions_task_day_unique`
  ON `task_completions` (`task_id`, `completed_on`);
--> statement-breakpoint
CREATE INDEX `task_completions_user_idx`
  ON `task_completions` (`user_id`, `completed_on`);
--> statement-breakpoint
CREATE TABLE `point_entries` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `user_id` integer NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `delta` integer NOT NULL,                 -- positive = earn, negative = spend/undo
  `reason` text NOT NULL,                   -- 'task_completed' | 'completion_undone' | 'reward_redeemed' | 'opening_balance'
  `task_id` integer REFERENCES `tasks`(`id`) ON DELETE SET NULL,
  `reward_id` integer REFERENCES `rewards`(`id`) ON DELETE SET NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `point_entries_user_idx` ON `point_entries` (`user_id`);
```

Dropped at the end (`0011_drop_streak_counters.sql`): `task_achievements.current_streak`, `missed_days_in_a_row`, `prev_streak`, `prev_last_completed_at`, `prev_missed_days_in_a_row`, `last_completed_at`, `prestige_count`. Kept: `name`, `target_streak` (configuration, not state). Prestige count becomes `COUNT(*)` over `earned_badges`.

## Key decisions

- **`users.points` stays** as a read cache; every write to it happens in the same `db.batch()` as its ledger entry. A `SUM(delta)` consistency check runs in tests.
- **Undo deletes the completion row and its point entry** (same-day undo of a kid's misclick, not a financial ledger). Badge earned by that completion is deleted in the same batch.
- **Badges are still awarded at completion time** (write-time event), not derived — the badge row is itself history.
- **Streak derivation window:** fetch the most recent `target_streak * 2 + missed-day slack` completion dates per task (bounded query), fold through pure logic. Never a full-table scan per request.
- **Migration journal prerequisite:** the drizzle journal already references missing `0007`/`0008` migrations (flagged as separate task "Repair drizzle migration journal mismatch"). Land that first; this plan assumes clean journal state from `0009`.

---

## Phase 1 — Ledger foundations

### Task 1: Migration + schema for ledger tables

**Files:**
- Create: `drizzle/0010_task_ledger.sql` (DDL above)
- Modify: `drizzle/meta/_journal.json` (append idx 10)
- Modify: `src/db/schema.ts` (add `taskCompletions`, `pointEntries` tables + relations)
- Modify: `src/types/index.ts` (export inferred types)

**Step 1:** Write schema tables mirroring the DDL exactly (`completed_on` as `text`, timestamps as `integer { mode: "timestamp" }`).
**Step 2:** Add relations: `users.pointEntries`, `users.completions`, `tasks.completions`.
**Step 3:** `bunx tsc --noEmit` — no new errors.

### Task 2: Typed service layer

**Files:**
- Modify: `src/db/client.ts` (export the concrete `Database` return type of `getDB`)
- Modify: `src/services/task.service.ts`, `reward.service.ts`, `user.service.ts` (replace `db: any` with the exported type)

**Step 1:** Export `export type Database = ReturnType<typeof getDB>`.
**Step 2:** Replace `any` parameter types. Fix whatever the compiler surfaces.
**Step 3:** Existing `bun test` suite still passes (mocks are structurally compatible; cast at the test boundary with `as unknown as Database` where needed).

### Task 3: In-memory test harness (build it early, use it everywhere after)

**Files:**
- Create: `src/db/test-db.ts` — helper that opens `bun:sqlite` `:memory:`, runs all files in `drizzle/` in journal order, returns a drizzle instance
- Create: `src/db/test-db.test.ts`

**Step 1:** Failing test: `createTestDb()` returns a db where `select from tasks` works and `task_completions` exists.
**Step 2:** Implement: `import { Database } from 'bun:sqlite'`, `drizzle(new Database(':memory:'))`, execute each migration file split on `--> statement-breakpoint`.
**Step 3:** Test passes.

## Phase 2 — Dual-write

### Task 4: Completion service (atomic write path)

**Files:**
- Create: `src/services/completion.service.ts`
- Create: `src/services/completion.service.test.ts` (uses `createTestDb`)

API:

```ts
recordCompletion(db, task, userId, now): Promise<{ milestone: StreakMilestone | null }>
removeCompletion(db, task, userId, now): Promise<void>
```

**Step 1:** Failing tests: recording inserts a completion row + point entry + bumps `users.points`, all visible after; recording twice on one day is a no-op (unique index + guard); removal deletes the row, the point entry, and restores `users.points`.
**Step 2:** Implement with `db.batch([...])` so completion row, point entry, points cache, badge insert, and (during dual-write) legacy counter updates commit together. Compute streak via Task 6's derivation, falling back to legacy counters until Phase 3 lands.
**Step 3:** Tests pass; consistency assertion `users.points === SUM(point_entries.delta)` in every test.

### Task 5: Route the status change through the ledger

**Files:**
- Modify: `src/services/task.service.ts` (`updateTaskStatus` delegates the done/undo branches to `completion.service`; keeps status write + parent-assignee validation)
- Modify: `src/services/task.service.test.ts` (port done/undo tests to `createTestDb`; delete the mock chains they replace)

**Step 1:** Failing integration tests: full done-flow awards points + completion + badge at target; undo restores everything; archived transition still skips point changes.
**Step 2:** Rewire. Legacy counters (`currentStreak` etc.) still dual-written here.
**Step 3:** Full suite green.

### Task 6: Fix the redeem race

**Files:**
- Modify: `src/services/reward.service.ts`
- Create/modify: `src/services/reward.service.test.ts`

**Step 1:** Failing test: two sequential redeems that together exceed the balance — second must throw and the balance must never go negative.
**Step 2:** Implement as a batch: insert negative `point_entry` + conditional `UPDATE users SET points = points - ? WHERE id = ? AND points >= ?`; check `rowsAffected`, throw `Insufficient points` and skip the ledger insert if 0 (or run the conditional update first, then insert).
**Step 3:** Tests pass.

### Task 7: Backfill migration

**Files:**
- Create: `drizzle/0011_ledger_backfill.sql`

**Step 1:** `INSERT INTO point_entries (user_id, delta, reason, created_at) SELECT id, points, 'opening_balance', <now> FROM users WHERE points != 0;`
**Step 2:** Synthesize one completion per achievement from `last_completed_at` where present (`INSERT INTO task_completions ... SELECT`), so streak derivation has a seed row. Real history before this date is unrecoverable — accepted.
**Step 3:** Verify on a local D1 copy: `wrangler d1 migrations apply family-kanban --local`, spot-check sums.

## Phase 3 — Derive, then drop the counters

### Task 8: Streak derivation from completions

**Files:**
- Modify: `src/services/streak.ts` (add `deriveStreak(completedDates: Date[], asOf: Date, options: StreakOptions): StreakState` — folds sorted dates through the existing rule logic)
- Modify: `src/services/streak.test.ts`

**Step 1:** Failing tests: consecutive dates → n; single gap inside → frozen per Rule B; double gap → streak restarts after the gap; empty list → zeroes; respects `periodDays: 7`.
**Step 2:** Implement as a left fold reusing `completeTask` internally so the two paths cannot diverge.
**Step 3:** Tests pass.

### Task 9: Read paths and cron go derived

**Files:**
- Modify: `src/services/task.service.ts` (`getActiveTasks`/`getTaskById` attach `currentStreak`, `missedDaysInARow`, `prestigeCount` computed from `task_completions` + `earned_badges`, preserving the current JSON response shape)
- Modify: `src/services/completion.service.ts` (milestone check uses `deriveStreak`)
- Modify: `src/cron.ts` (`resetDailyTasks` drops the counter sweep entirely — status rollover only; missed days are now implicit in the date gaps)
- Modify: tests accordingly

**Step 1:** Failing integration test: complete Mon, skip Tue, complete Wed via the real service → API payload shows streak preserved (grace), no counter columns consulted.
**Step 2:** Implement. Bound the completions query (`ORDER BY completed_on DESC LIMIT 64`).
**Step 3:** Suite green. Legacy dual-writes deleted in the same task.

### Task 10: Drop counter columns

**Files:**
- Create: `drizzle/0012_drop_streak_counters.sql` (drop the seven columns listed under Target schema; SQLite ≥3.35 `ALTER TABLE ... DROP COLUMN` is supported by D1)
- Modify: `src/db/schema.ts`, `src/types/index.ts`

**Step 1:** Remove columns from schema, fix compiler fallout — anything still reading a counter is a missed call site.
**Step 2:** Full suite + `tsc` green.

## Phase 4 — Cleanup

### Task 11: Delete remaining mock-chain tests

Port anything still on hand-rolled fakes to `createTestDb`. Target: zero `select() { return { from() ...` fakes left in `src/services/`.

### Task 12: Consistency guard

**Files:**
- Modify: `src/services/completion.service.test.ts`

Property-style test: random sequence of complete/undo/redeem operations across 3 users → invariants hold (`users.points === SUM(delta)`, no negative balances, streak matches brute-force recomputation from completion dates).

## Out of scope (follow-ups)

- **Per-family timezone** for day boundaries (currently UTC; affects `completed_on` bucketing and the cron hour). Design once ledger lands — it's a pure change to date-bucketing.
- **Client store simplification** and status-model rework (`archived` out of the workflow enum) — API-breaking, separate plan.
- **Weekly-task period semantics** beyond the current floor(days/7) approximation.

## Risks

| Risk | Mitigation |
|---|---|
| D1 `batch()` is not a full interactive transaction | All writes per operation fit in one batch; no read-modify-write spans batches (redeem uses a conditional UPDATE) |
| Backfill on live data | Run on `--local` copy first; opening-balance entries make the ledger self-consistent from day one |
| Journal already inconsistent (missing 0007/0008) | Blocked on the separate repair task before generating 0010+ |
| Streak derivation cost per board load | Bounded `LIMIT 64` query per task with achievement; board has ~10 tasks |

# Recurring Task Reliability Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make daily weekday and weekly tasks recur indefinitely with atomic, idempotent rollover, completion, points, streak, badge, edit, and undo behavior.

**Architecture:** `task_achievements` is the stable recurring-goal/configuration record and `tasks` rows are immutable cycle occurrences linked by `achievement_id` and `cycle_date`. A New York calendar reconciliation job creates the current occurrence and archives stale ones, while completion and point ledgers become the source of truth and all related writes use D1 batches.

**Tech Stack:** TypeScript, Bun test runner, Hono, SolidJS, Drizzle ORM, SQLite/Cloudflare D1, `@js-temporal/polyfill`, Cloudflare Workers Cron Triggers, PostHog.

---

## Execution prerequisites

- Execute in a dedicated `codex/recurring-task-reliability` worktree; do not implement on top of the current dirty workspace.
- Use @superpowers:systematic-debugging for any unexpected failure and @superpowers:verification-before-completion before claiming a phase complete.
- Never rewrite migrations already listed in `drizzle/meta/_journal.json`. Add new ordered migrations only.
- Back up remote D1 before applying reconciliation SQL.
- Keep each commit limited to the task named below.

## Locked behavior

- New York time is authoritative.
- Daily means Monday through Friday; weekends have no eligible or visible daily occurrence and are streak-neutral.
- Weekly cycles start Monday.
- The reconciliation scheduler runs at 00:05 New York time using two DST-safe UTC triggers; only the matching local invocation performs work.
- Recurring history cannot be restored manually.
- Product writes succeed or fail independently of telemetry delivery.

### Task 1: Establish the failing reliability matrix

**Files:**
- Create: `src/utils/new-york-time.test.ts`
- Create: `src/cron.test.ts`
- Modify: `src/services/task.service.test.ts`
- Modify: `src/services/streak.test.ts`
- Modify: `src/index.test.ts`

**Step 1: Add failing calendar-boundary tests**

Add cases that assert:

```ts
expect(getNewYorkWeekKey(new Date("2026-08-03T16:00:00Z"))).toBe("2026-08-03");
expect(getNewYorkWeekKey(new Date("2026-08-09T16:00:00Z"))).toBe("2026-08-03");
expect(getEligibleDailyCycleKey(new Date("2026-08-08T16:00:00Z"))).toBeNull();
expect(getNextEligibleDailyCycleKey(new Date("2026-08-08T16:00:00Z"))).toBe("2026-08-10");
expect(getEligibleDailyCycleKey(new Date("2026-08-10T16:00:00Z"))).toBe("2026-08-10");
```

Cover spring-forward and fall-back dates and Friday-to-Monday weekday counting.

**Step 2: Add failing recurrence tests**

Use `createTestDb()` rather than mocked Drizzle chains. Cover:

- a completed daily occurrence becomes archived as `completed` and Monday is created after a weekend;
- a missed daily occurrence becomes archived as `missed`;
- weekly rollover creates one next-week occurrence;
- duplicate rollover creates nothing and changes no streak twice;
- generic archival excludes recurring tasks;
- a second weekly completion in the same Monday-start week does not advance the streak.

**Step 3: Add failing scheduler-dispatch tests**

Test both summer and winter pairs. Exactly one UTC trigger must dispatch when the New York local time is 00:05. Remove the test that treats `59 23 * * 6` as local Saturday 23:59.

**Step 4: Run the focused matrix and verify failures**

Run:

```bash
bun test src/utils/new-york-time.test.ts src/services/streak.test.ts src/services/task.service.test.ts src/cron.test.ts src/index.test.ts
```

Expected: existing tests pass; new tests fail because week-key helpers, recurrence reconciliation, and idempotency do not exist.

**Step 5: Commit the failing matrix**

```bash
git add src/utils/new-york-time.test.ts src/services/streak.test.ts src/services/task.service.test.ts src/cron.test.ts src/index.test.ts
git commit -m "test: define recurring task reliability behavior"
```

### Task 2: Implement New York cycle helpers

**Files:**
- Modify: `src/utils/new-york-time.ts`
- Test: `src/utils/new-york-time.test.ts`
- Modify: `src/services/streak.ts`
- Test: `src/services/streak.test.ts`

**Step 1: Add explicit cycle helpers**

Implement these exports using `Temporal.PlainDate`, not millisecond arithmetic:

```ts
export function getNewYorkWeekKey(now = new Date()): string;
export function getEligibleDailyCycleKey(now = new Date()): string | null;
export function getNextEligibleDailyCycleKey(now = new Date()): string;
export function getPreviousNewYorkDateKey(now = new Date()): string;
export function countWeekKeysBetween(startKey: string, endKey: string): number;
export function isRecurringRolloverTime(now = new Date()): boolean;
```

`getNewYorkWeekKey` subtracts `dayOfWeek - 1` days from the New York plain date. `isRecurringRolloverTime` accepts only local hour `0`, minute `5`.

**Step 2: Replace weekly elapsed-hour streak logic**

Delete `MILLISECONDS_PER_HOUR`, `hoursBetween`, and the 72/240-hour rules. Compare Monday week keys:

```ts
const previousWeek = getNewYorkWeekKey(lastCompletedAt);
const currentWeek = getNewYorkWeekKey(now);
const elapsedWeeks = countWeekKeysBetween(previousWeek, currentWeek);

if (elapsedWeeks <= 0) return { currentStreak, changed: false };
if (elapsedWeeks === 1) return { currentStreak: currentStreak + 1, changed: true };
const missedWeeks = elapsedWeeks - 1;
return {
  currentStreak: Math.max(0, currentStreak - missedWeeks * 2) + 1,
  changed: true,
};
```

**Step 3: Derive streaks from `completedOn` cycle keys**

Change `deriveStreakFromCompletions` so ordering and duplicate-period detection use `completedOn`. Keep `completedAt` only as display/audit time. Add tests where completion timestamps cross UTC dates while New York cycle keys remain the same.

**Step 4: Run focused tests**

```bash
bun test src/utils/new-york-time.test.ts src/services/streak.test.ts
```

Expected: all calendar and streak tests pass.

**Step 5: Commit**

```bash
git add src/utils/new-york-time.ts src/utils/new-york-time.test.ts src/services/streak.ts src/services/streak.test.ts
git commit -m "fix: use New York cycle keys for streaks"
```

### Task 3: Add the recurring-goal and rollover schema

**Files:**
- Modify: `src/db/schema.ts`
- Modify: `src/db/schema.test.ts`
- Modify: `src/db/test-db.ts`
- Modify: `src/db/test-db.test.ts`
- Create: `drizzle/0013_recurring_reliability.sql`
- Create: `drizzle/meta/0013_snapshot.json`
- Modify: `drizzle/meta/_journal.json`

**Step 1: Write failing schema assertions**

Assert that `taskAchievements` exposes:

```ts
recurrenceKey;
cadence;
taskTitle;
taskPriority;
taskValue;
assigneeId;
streakEnabled;
active;
```

Assert that `rolloverRuns` exposes `rolloverType`, `cycleKey`, `startedAt`, and `completedAt`.

**Step 2: Extend the schema**

Add configuration columns to `task_achievements`:

```ts
recurrenceKey: text("recurrence_key").unique(),
cadence: text("cadence", { enum: ["daily", "weekly"] }),
taskTitle: text("task_title"),
taskPriority: text("task_priority", { enum: ["high", "medium", "low"] }),
taskValue: integer("task_value"),
assigneeId: integer("assignee_id").references(() => users.id),
streakEnabled: integer("streak_enabled", { mode: "boolean" }).notNull().default(true),
active: integer("active", { mode: "boolean" }).notNull().default(true),
```

Add `rolloverRuns` with a unique index on `(rolloverType, cycleKey)`. Add:

- a partial unique index allowing only one non-archived task per non-null `achievement_id`;
- a partial unique badge index on non-null `task_completion_id` so new badge writes are idempotent without deleting ambiguous legacy badges;
- indexes needed to find active goals and current occurrences.

**Step 3: Write the additive migration**

The migration must:

1. add configuration columns without changing `0009` or `0012`;
2. create `rollover_runs`;
3. backfill `recurrence_key` as `legacy:<achievement id>`;
4. backfill cadence and task configuration from the most recent linked recurring task;
5. populate missing `tasks.achievement_id` from legacy `task_achievements.task_id`;
6. assign deterministic current cycle dates where possible;
7. add safe indexes only after backfill queries pass; do not delete legacy badges in a schema migration.

**Step 4: Add clean and upgrade migration tests**

Extend `createTestDb` with an optional ending migration tag so tests can create a database ending at `0012_task_ledger`, insert a representative fixture, apply `0013`, and verify rows and indexes. Include fixtures with:

- recurring task already linked;
- recurring task missing `achievement_id`;
- archived recurring task with no reason;
- nonzero user points and empty point ledger;
- duplicate badge rows.

**Step 5: Run migration tests**

```bash
bun test src/db/schema.test.ts src/db/test-db.test.ts
```

Expected: fresh and upgraded databases pass; `PRAGMA foreign_key_check` returns no rows.

**Step 6: Commit**

```bash
git add src/db/schema.ts src/db/schema.test.ts src/db/test-db.ts src/db/test-db.test.ts drizzle/0013_recurring_reliability.sql drizzle/meta/0013_snapshot.json drizzle/meta/_journal.json
git commit -m "feat: add durable recurring goal schema"
```

### Task 4: Implement recurring task creation and read joins

**Files:**
- Modify: `src/services/task.service.ts`
- Modify: `src/services/task.service.test.ts`
- Modify: `src/routes/users.tsx`
- Test: `src/services/task.service.test.ts`

**Step 1: Replace mocked creation tests with database integration tests**

Add tests proving:

- every daily or weekly task creates a stable goal, even when `streakEnabled` is false;
- goal and occurrence are linked in both read models;
- `cycleDate` is today's eligible daily key or current weekly key;
- creating a daily task on a weekend creates a Monday-keyed occurrence that is hidden and cannot complete before Monday;
- one-off tasks create no goal;
- invalid priority, cadence, assignee, or target streak is rejected before writes.

**Step 2: Add a deterministic recurrence key**

Generate `crypto.randomUUID()` once per create request. Insert the goal and task in one `db.batch` using a subquery on `recurrence_key` to populate `tasks.achievement_id`. Store point value from `priorityPoints`; never trust a client value.

**Step 3: Make the new link authoritative on reads**

Change `getActiveTasks` and `getTaskById` joins from:

```ts
eq(tasks.id, taskAchievements.taskId)
```

to:

```ts
eq(tasks.achievementId, taskAchievements.id)
```

Update the user achievements route to start from the stable goal and use its configuration/current occurrence rather than `taskAchievements.taskId`.

Filter board reads so a future daily occurrence is not returned before its `cycleDate`. Direct completion of a future occurrence must be rejected even if a stale client knows its ID.

**Step 4: Run service and route-adjacent tests**

```bash
bun test src/services/task.service.test.ts src/db/test-db.test.ts
```

Expected: all creation and hydration tests pass.

**Step 5: Commit**

```bash
git add src/services/task.service.ts src/services/task.service.test.ts src/routes/users.tsx
git commit -m "feat: create linked recurring goals and occurrences"
```

### Task 5: Implement idempotent recurrence reconciliation

**Files:**
- Create: `src/services/recurrence.service.ts`
- Create: `src/services/recurrence.service.test.ts`
- Modify: `src/cron.ts`
- Test: `src/cron.test.ts`

**Step 1: Write database-backed reconciliation tests**

Cover these state transitions:

```text
Friday done -> Saturday: archive Friday completed and prepare one Monday-keyed row
Friday todo -> Saturday: archive Friday missed and prepare one Monday-keyed row
Saturday/Sunday board read: hide the prepared Monday row
Sunday -> Monday: reveal the prepared row without creating another
week N weekly done -> week N+1: archive completed and create next Monday row
week N weekly todo -> week N+1: archive missed and create next Monday row
duplicate same-day reconciliation: no changes
missed scheduler dates: archive every stale active row and create only the current row
inactive goal: create nothing
```

Assert copied title, priority, value, assignee, cadence, goal ID, and cycle key.

**Step 2: Implement `reconcileRecurringTasks`**

Export:

```ts
export async function reconcileRecurringTasks(
  db: Database,
  now: Date,
): Promise<{
  cycleKey: string;
  duplicate: boolean;
  archived: number;
  created: number;
}>;
```

The service must:

- derive the New York date, eligible daily key, and weekly key;
- derive the next eligible daily key when today is a weekend;
- return immediately when the day's rollover receipt exists;
- classify stale occurrence archive reason from status;
- set `archivedAt`, `completedAt` when appropriate, and `archiveReason`;
- insert only the eligible current occurrence;
- allow one next-weekday occurrence to be prepared but keep it unavailable until its cycle date;
- write mutations and the receipt in one batch;
- catch only known unique-constraint races, re-read the receipt, and return `duplicate: true`;
- allow unexpected database errors to propagate.

**Step 3: Reduce `src/cron.ts` to orchestration**

Replace mutable streak sweeping and generic recurrence-blind archive calls with `reconcileRecurringTasks`. Keep non-recurring archive as a separate call that runs only on New York Monday and excludes non-null `achievementId`.

**Step 4: Run recurrence tests**

```bash
bun test src/services/recurrence.service.test.ts src/cron.test.ts
```

Expected: all lifecycle and duplicate-delivery cases pass.

**Step 5: Commit**

```bash
git add src/services/recurrence.service.ts src/services/recurrence.service.test.ts src/cron.ts src/cron.test.ts
git commit -m "fix: reconcile recurring occurrences idempotently"
```

### Task 6: Correct scheduler configuration and dispatch

**Files:**
- Modify: `src/index.tsx`
- Modify: `src/index.test.ts`
- Modify: `wrangler.jsonc`
- Modify: `README.md`

**Step 1: Change cron triggers**

Replace the three old expressions with:

```json
"crons": ["5 4 * * *", "5 5 * * *"]
```

These represent 00:05 New York during EDT and EST. The runtime filter still decides which invocation is valid.

**Step 2: Simplify scheduled dispatch**

Both configured cron strings enter the same branch. Call recurrence reconciliation only when `isRecurringRolloverTime(new Date(controller.scheduledTime))` is true. Log rejected DST partner invocations as skipped.

**Step 3: Test summer, winter, and DST transitions**

For each date pair, invoke both cron strings with their real `scheduledTime` and assert exactly one service call. Also assert an unrelated cron expression does nothing.

**Step 4: Run tests and typecheck**

```bash
bun test src/index.test.ts src/cron.test.ts
bunx tsc --noEmit
```

Expected: scheduler tests and typecheck pass.

**Step 5: Commit**

```bash
git add src/index.tsx src/index.test.ts wrangler.jsonc README.md
git commit -m "fix: schedule rollover at New York cycle boundary"
```

### Task 7: Implement atomic, idempotent completion

**Files:**
- Create: `src/services/completion.service.ts`
- Create: `src/services/completion.service.test.ts`
- Modify: `src/services/task.service.ts`
- Modify: `src/routes/tasks.tsx`
- Modify: `src/client/lib/api.ts`
- Modify: `src/client/store/app-store.ts`

**Step 1: Write completion integration tests**

Test one-off and recurring completion with a real test database. For one request assert:

- task becomes `done` with `completedAt`;
- one `task_completions` row exists with the task's cycle key;
- one positive `point_entries` row exists;
- `users.points` equals the ledger sum;
- streak projection updates once;
- a target crossing creates exactly one linked badge;
- repeating the same event ID or sending a concurrent event for the same cycle awards nothing twice.

**Step 2: Add failure injection**

Make the test D1 batch adapter accept an optional statement index to fail. For every write position, assert the database remains identical to its pre-request snapshot.

**Step 3: Implement `completeTask`**

Use an event ID supplied by the client. The service loads the task and stable goal, derives `completedOn` from `cycleDate` for recurring tasks, and builds one batch containing:

1. completion insert;
2. completion point entry;
3. cached points refresh from `SUM(point_entries.delta)`;
4. task status/timestamp update;
5. achievement projection update;
6. optional linked badge insert.

On an active-completion uniqueness conflict, query and return the already-completed state without a second award.

**Step 4: Route `done` transitions through completion service**

Change the status endpoint body to:

```ts
{ status: TaskStatus; eventId: string }
```

The client creates one `crypto.randomUUID()` per user action and reuses it if that request is retried. Other forward status changes remain ordinary task updates.

**Step 5: Run completion tests**

```bash
bun test src/services/completion.service.test.ts src/services/task.service.test.ts
```

Expected: idempotency and every failure-injection case pass.

**Step 6: Commit**

```bash
git add src/services/completion.service.ts src/services/completion.service.test.ts src/services/task.service.ts src/routes/tasks.tsx src/client/lib/api.ts src/client/store/app-store.ts
git commit -m "feat: store task completion atomically"
```

### Task 8: Implement atomic undo and badge revocation

**Files:**
- Modify: `src/services/completion.service.ts`
- Modify: `src/services/completion.service.test.ts`
- Modify: `src/services/task.service.ts`
- Modify: `src/routes/tasks.tsx`

**Step 1: Write undo tests**

Cover:

- undo creates one negative reversal point entry;
- original completion receives `canceledAt` and `cancelReason`;
- linked badge receives `revokedAt` and `revokedReason`;
- streak and prestige recompute from remaining active completions;
- task returns to requested active status;
- repeating the event ID or retrying undo is a no-op;
- archived recurring history cannot be undone or restored;
- failure at every batch statement leaves the completed state intact.

**Step 2: Implement `undoCompletion`**

Find the active completion for the occurrence, derive the projection from all remaining active completions for the goal, and batch cancellation, reversal entry, points refresh, badge revocation, achievement update, and task status update.

Delete the legacy `prevStreak`, `prevLastCompletedAt`, and `prevMissedDaysInARow` runtime logic after ledger-backed undo tests pass. Leave columns in place until a later cleanup migration.

**Step 3: Route done-to-active transitions through undo**

Require an event ID exactly as completion does. Return the hydrated task after the batch commits.

**Step 4: Run tests**

```bash
bun test src/services/completion.service.test.ts src/services/task.service.test.ts
```

Expected: completion, undo, retry, and rollback cases all pass.

**Step 5: Commit**

```bash
git add src/services/completion.service.ts src/services/completion.service.test.ts src/services/task.service.ts src/routes/tasks.tsx
git commit -m "feat: undo task completion atomically"
```

### Task 9: Repair task validation and recurrence editing

**Files:**
- Create: `src/utils/task-input.ts`
- Create: `src/utils/task-input.test.ts`
- Create: `src/routes/tasks.test.tsx`
- Modify: `src/routes/tasks.tsx`
- Modify: `src/services/task.service.ts`
- Modify: `src/services/task.service.test.ts`
- Modify: `src/client/components/Board.tsx`

**Step 1: Add failing validation and route tests**

Test:

- invalid priority/repeat/target/assignee returns `400` without writes;
- changing priority recalculates value;
- changing repeat persists and applies the explicit transition rules;
- title is trimmed and cannot become empty;
- parent assignees are rejected;
- updating a missing task returns `404`;
- archived recurring occurrence edits and restore attempts are rejected.

**Step 2: Implement input parsers**

Add small dependency-free parsers/type guards for create and update payloads. Return typed validation results; do not use `as` casts on untrusted route bodies.

**Step 3: Implement recurrence transitions**

- recurring -> recurring: update stable goal configuration and active occurrence;
- one-off -> recurring: create/link a goal and assign the current eligible cycle;
- recurring -> one-off: deactivate the goal and detach only the active occurrence;
- priority edit: update both priority and `priorityPoints[priority]`;
- repeat/streak edit: update all fields sent by the inspector.

Use a batch whenever more than one row changes.

**Step 4: Keep the inspector synchronized**

After save, reload tasks as well as users so cadence transitions that replace or archive an occurrence cannot leave a stale task ID selected.

**Step 5: Run tests and client typecheck**

```bash
bun test src/utils/task-input.test.ts src/routes/tasks.test.tsx src/services/task.service.test.ts
bunx tsc --noEmit
```

Expected: all validation, transition, and type tests pass.

**Step 6: Commit**

```bash
git add src/utils/task-input.ts src/utils/task-input.test.ts src/routes/tasks.tsx src/routes/tasks.test.tsx src/services/task.service.ts src/services/task.service.test.ts src/client/components/Board.tsx
git commit -m "fix: persist validated recurring task edits"
```

### Task 10: Put reward redemption on the point ledger

**Files:**
- Modify: `src/services/reward.service.ts`
- Modify: `src/services/reward.service.test.ts`
- Modify: `src/routes/rewards.tsx`
- Modify: `src/routes/rewards.test.tsx`
- Modify: `src/client/lib/api.ts`
- Modify: `src/client/store/app-store.ts`

**Step 1: Write ledger and idempotency tests**

Assert that redemption:

- inserts one negative `reward_redeemed` point entry;
- refreshes cached points from the ledger;
- rejects insufficient ledger balance;
- does not double-charge a repeated event ID;
- rolls back completely on injected batch failure.

**Step 2: Implement atomic redemption**

Accept a client event ID, read affordability from the ledger-backed current balance, and batch point entry plus cached balance refresh. Keep reward records immutable.

**Step 3: Update route and client payloads**

Send `{ eventId: crypto.randomUUID() }` on redemption. Keep `400` for insufficient points and `404` for a missing reward.

**Step 4: Run focused tests**

```bash
bun test src/services/reward.service.test.ts src/routes/rewards.test.tsx
```

Expected: the two previously timing-out route tests complete quickly and all reward tests pass.

**Step 5: Commit**

```bash
git add src/services/reward.service.ts src/services/reward.service.test.ts src/routes/rewards.tsx src/routes/rewards.test.tsx src/client/lib/api.ts src/client/store/app-store.ts
git commit -m "fix: redeem rewards through point ledger"
```

### Task 11: Make telemetry non-blocking and register auth once

**Files:**
- Modify: `src/lib/posthog.ts`
- Create: `src/lib/posthog.test.ts`
- Modify: `src/auth/middleware.ts`
- Modify: `src/routes/tasks.tsx`
- Modify: `src/routes/rewards.tsx`
- Modify: `src/routes/session.tsx`
- Modify: `src/index.tsx`
- Modify: `src/index.test.ts`

**Step 1: Write telemetry isolation tests**

Use a fake PostHog client whose delivery rejects. Assert route mutation responses still reflect database success. Assert no network client is created when `POSTHOG_API_KEY` is absent or equals `dummy-key`.

**Step 2: Add a queued telemetry adapter**

Expose a helper that accepts the Worker environment, execution context, and event. It queues capture/shutdown with `waitUntil`, catches delivery failures, and never returns a promise that routes await.

**Step 3: Replace direct PostHog calls**

Remove every route-level `await posthog.captureImmediate(...)`. Route handlers should determine responses entirely from product services.

**Step 4: Remove duplicated middleware registration**

Keep exactly one:

```ts
app.use("/api/*", sessionMiddleware);
app.use("/session/*", sessionMiddleware);
```

Queue identification telemetry in middleware rather than awaiting shutdown before `next()`.

**Step 5: Run route and app tests**

```bash
bun test src/lib/posthog.test.ts src/routes/rewards.test.tsx src/routes/tasks.test.tsx src/routes/session.test.tsx src/index.test.ts
```

Expected: no test waits on external network; all pass.

**Step 6: Commit**

```bash
git add src/lib/posthog.ts src/lib/posthog.test.ts src/auth/middleware.ts src/routes/tasks.tsx src/routes/rewards.tsx src/routes/session.tsx src/index.tsx src/index.test.ts
git commit -m "fix: isolate telemetry from product requests"
```

### Task 12: Derive profile and analytics data from history

**Files:**
- Modify: `src/routes/users.tsx`
- Modify: `src/routes/analytics.tsx`
- Create: `src/routes/analytics.test.tsx`
- Modify: `src/routes/session.test.tsx`

**Step 1: Add history-backed analytics tests**

Create archived recurring occurrences, active and canceled completions, reward debits, and revoked badges. Assert:

- completion totals count active completion rows, not mutable task status;
- recurring totals count each active recurring completion once;
- current points equal point-entry sum;
- only non-revoked badges appear;
- current recurring goal cards use stable goal configuration and active occurrence;
- a missed archived task is not counted as completed.

**Step 2: Rewrite queries**

Use `task_completions`, `point_entries`, and non-revoked `earned_badges`. Stop inferring completion from `done` or generic archived status. Join goals through `tasks.achievementId` or goal configuration, never legacy `taskAchievements.taskId`.

**Step 3: Run analytics and session tests**

```bash
bun test src/routes/analytics.test.tsx src/routes/session.test.tsx
```

Expected: all history-backed counts and authorization cases pass.

**Step 4: Commit**

```bash
git add src/routes/users.tsx src/routes/analytics.tsx src/routes/analytics.test.tsx src/routes/session.test.tsx
git commit -m "fix: derive analytics from completion history"
```

### Task 13: Add audit and reconciliation tooling

**Files:**
- Create: `scripts/audit-recurring-data.sql`
- Create: `scripts/reconcile-recurring-data.sql`
- Create: `docs/operations/recurring-task-reconciliation.md`
- Modify: `README.md`

**Step 1: Write the audit SQL**

Report, without mutation:

- recurring tasks missing a goal;
- active goals missing a current occurrence;
- multiple active occurrences for one goal;
- null or invalid cycle dates;
- archived recurring rows without archive reason/timestamp;
- orphan goals and achievements;
- duplicate active completions;
- `users.points` versus `SUM(point_entries.delta)` mismatches;
- badge/prestige mismatches.

**Step 2: Write reconciliation SQL**

Make it transaction-safe and limited to deterministic repairs:

- create/link missing goals using stable `repair:<task id>` recurrence keys;
- backfill goal configuration;
- mark stranded archived recurrence rows as historical rather than restoring them;
- create one current eligible occurrence when absent;
- create one opening-balance entry per user when needed;
- refresh cached points.

Do not automatically delete ambiguous duplicates; leave them in the audit report for operator review.

**Step 3: Document local, staging, and production commands**

Include:

```bash
bunx wrangler d1 execute family-kanban --local --file scripts/audit-recurring-data.sql
bunx wrangler d1 execute family-kanban --remote --file scripts/audit-recurring-data.sql
bunx wrangler d1 execute family-kanban --remote --file scripts/reconcile-recurring-data.sql
```

Document remote backup, audit review, maintenance window, and post-apply verification.

**Step 4: Verify against a copied local database**

Run audit, apply, audit again. Expected: deterministic issue counts fall to zero, ambiguous duplicates remain reported, and no original archived history is deleted.

**Step 5: Commit**

```bash
git add scripts/audit-recurring-data.sql scripts/reconcile-recurring-data.sql docs/operations/recurring-task-reconciliation.md README.md
git commit -m "ops: add recurring data reconciliation tooling"
```

### Task 14: Run full integration and browser verification

**Files:**
- Create: `src/recurrence.integration.test.ts`
- Modify: `README.md`
- Modify: `docs/plans/2026-08-12-recurring-task-reliability-design.md`

**Step 1: Add an end-to-end service integration scenario**

With one migrated in-memory database:

1. create a daily goal on Friday;
2. complete it and assert points/streak/history;
3. reconcile Saturday and Sunday and assert there is no weekend-keyed or visible daily occurrence while one Monday row is prepared;
4. reconcile Monday and assert that prepared occurrence becomes visible without duplication;
5. complete Monday and assert the same goal's streak advances;
6. replay completion and rollover and assert no changes;
7. undo Monday and assert all linked state reverses;
8. create and complete a weekly goal across two Monday cycles;
9. archive one-off done work and assert recurring rows remain intact.

**Step 2: Run all automated checks**

```bash
bun test
bunx tsc --noEmit
bun run build:client
bunx wrangler deploy --dry-run
```

Expected: zero failures, zero unhandled errors, successful typecheck, client build, and Worker dry run.

**Step 3: Run local scheduled-handler checks**

Start Wrangler with scheduled testing and invoke both UTC expressions with summer and winter timestamps. Expected: exactly one accepted reconciliation per New York date and structured duplicate logs on replay.

**Step 4: Run browser scenarios**

Verify as parent and child:

- create daily and weekly tasks with and without visible streaks;
- edit title, priority, assignee, and recurrence;
- complete, reload, retry, undo, and reload again;
- inspect archive history and confirm recurring history cannot restore;
- redeem a reward and confirm points remain correct;
- simulate Friday-to-Monday and next-week rollover through the local scheduled endpoint.

**Step 5: Update documentation status**

Change the design status from `Approved` to `Implemented` only after every automated and browser check passes. Add exact operational rollout commands and rollback criteria to README.

**Step 6: Final verification commit**

```bash
git add src/recurrence.integration.test.ts README.md docs/plans/2026-08-12-recurring-task-reliability-design.md
git commit -m "test: verify recurring lifecycle end to end"
```

## Production rollout gate

Do not deploy until all of the following are true:

- clean and upgrade migration tests pass;
- staging audit output has been reviewed;
- staging reconciliation leaves no deterministic issues;
- points equal ledger sums for every user;
- no goal has multiple active occurrences;
- full tests and both builds pass;
- scheduled replay is idempotent;
- a remote D1 backup exists.

Deploy migration and compatible Worker code in the same maintenance window. Run the audit immediately after deployment and monitor accepted/skipped rollover logs, completion uniqueness conflicts, point reconciliation, and telemetry errors for one full Monday-to-Sunday cycle.

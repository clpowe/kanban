# Recurring Task Reliability Design

**Date:** 2026-08-12
**Status:** Implemented
**Supersedes:** The unimplemented portions of `2026-07-18-goal-streak-reliability-fixes.md`

## Objective

Make recurring household tasks continue indefinitely on their intended New York calendar cycles, preserve an auditable completion and points history, and remain correct when scheduled events or HTTP requests are retried.

This design also addresses the adjacent failures found during the August 2026 project audit: generic archiving consuming recurring tasks, incorrect UTC scheduling, non-calendar weekly streaks, partially integrated ledger tables, non-atomic completion writes, ignored task edits, blocking analytics calls, and duplicated authentication middleware.

## Product Rules

1. `America/New_York` is authoritative for all recurrence and streak boundaries.
2. A daily task means every weekday, Monday through Friday.
3. Saturdays and Sundays are neutral: they have no weekend-keyed daily occurrence and neither advance nor break a daily streak.
4. A weekly cycle begins Monday at 00:00 and ends Sunday at 23:59:59 New York time.
5. A recurring task has at most one active occurrence.
6. Completing an occurrence awards points and affects its streak at most once.
7. A missed occurrence is archived as `missed`; a completed occurrence is archived as `completed`.
8. Archived recurring occurrences are immutable history and cannot be restored.
9. Reaching a streak target awards one badge and starts the next prestige cycle at zero.
10. Undo is allowed only for the active occurrence's active completion and reverses status, points, streak projection, prestige, and badge together.
11. Analytics and telemetry are non-critical: their failure must never make a successful product mutation appear to fail.

## Chosen Architecture

### Stable recurring goal and immutable occurrences

`task_achievements` becomes the stable identity and configuration record for a recurring goal. Every recurring task receives one goal row, including recurring tasks whose streak display is disabled. The goal stores its recurrence cadence, future-occurrence configuration, active state, and whether streak tracking is enabled.

Each `tasks` row represents one occurrence. It points to the stable goal through `tasks.achievement_id` and identifies its cycle through `tasks.cycle_date`. The row is a snapshot of title, priority, point value, and assignee for that occurrence. Future edits update the goal configuration and the current active occurrence; archived occurrences never change.

The legacy `task_achievements.task_id` link remains nullable during migration but is no longer authoritative. All new joins use `tasks.achievement_id`.

### Calendar cycle keys

- Daily cycle key: a New York `YYYY-MM-DD` weekday.
- Weekly cycle key: the `YYYY-MM-DD` date of that New York week's Monday.
- Daily recurrence never uses a Saturday or Sunday cycle key.
- Streak calculation compares cycle keys, never elapsed hours.

The next weekday occurrence may be prepared during a weekend reconciliation, but it carries Monday's cycle key, is excluded from active board reads until Monday, and cannot be completed early. This makes Monday availability resilient to a missed midnight invocation without creating a weekend streak period.

The scheduler runs through two DST-safe UTC triggers and accepts only the invocation whose New York local time matches the intended rollover time. It reconciles to the current cycle rather than assuming the immediately previous invocation succeeded.

### Idempotent rollover

A new `rollover_runs` table stores a unique `(rollover_type, cycle_key)` receipt. A recurring rollover:

1. determines the current New York daily and weekly keys;
2. loads active recurring goals and occurrences;
3. archives stale occurrences with `completed` or `missed` reason;
4. creates exactly one eligible current occurrence from goal configuration;
5. writes the rollover receipt with all mutations in a D1 batch.

Unique indexes on `(achievement_id, cycle_date)`, one active occurrence per achievement, and one badge per source completion defend against duplicate delivery and concurrency. A duplicate receipt or occurrence causes the competing batch to roll back harmlessly; the service then treats the cycle as already reconciled.

Non-recurring completed tasks use a separate maintenance archive operation. That operation explicitly excludes rows with a recurrence identity.

### Completion and points ledgers

`task_completions` and `point_entries` become the source of truth rather than unused schema:

- one active completion per recurring goal/cycle;
- one active completion per one-off task;
- one idempotent point entry per completion;
- one reversal entry per undone completion;
- cached `users.points` refreshed from the point ledger in the same batch;
- streak and prestige projected from active completion rows;
- badges linked to the completion that earned them and revoked rather than deleted during undo.

Task status, completion, points, streak projection, and badge changes are submitted as one D1 batch. A failed statement rolls back the complete mutation.

Existing nonzero user balances receive one `opening_balance` ledger entry during rollout reconciliation so `SUM(point_entries.delta)` equals `users.points` before the new write path is enabled.

### Recurring task creation and edits

Recurring goal creation uses an application-generated unique recurrence key. The task and goal can therefore be linked by subquery inside one batch without relying on a generated integer ID from an earlier non-atomic statement.

Parent edits follow explicit transitions:

- recurring to recurring: update goal configuration and the active occurrence; cadence changes begin with the current eligible cycle;
- one-off to recurring: create a stable goal and link the existing task as the current occurrence;
- recurring to one-off: deactivate the goal, detach the active occurrence, and preserve archived history;
- priority changes update both priority and derived point value;
- title, assignee, priority, recurrence, and streak settings are validated server-side.

### Telemetry and middleware

Protected routes register session middleware once. PostHog calls move behind a small telemetry adapter that:

- skips network delivery when no real key is configured;
- uses the Worker execution context for background delivery;
- catches and logs telemetry errors;
- is injectable in route tests.

Database success determines API success. Telemetry never changes an HTTP response.

## Data Repair

The rollout includes an additive migration and a one-time reconciliation command. It does not rename or rewrite already-applied migrations.

The repair will:

1. assign a stable goal to every recurring task missing one;
2. backfill goal configuration and deterministic cycle keys;
3. identify recurring rows stranded in `archived` without `archive_reason`;
4. preserve those rows as history and create one current occurrence;
5. add opening point balances;
6. report orphan achievements, duplicate active occurrences, duplicate completions, and point mismatches before making destructive corrections.

The command supports audit-only and apply modes. Production requires a D1 backup and review of the audit output before apply mode.

## Error Handling

- Invalid request data returns `400`; missing resources return `404`; authorization failures retain `401` or `403`.
- Duplicate completion, undo, or rollover requests return the already-established state rather than awarding twice.
- A D1 batch failure returns an error without partial task, point, streak, or badge changes.
- Telemetry errors are logged and suppressed after the product result is determined.
- Scheduler logs include the New York timestamp, cycle key, receipt status, archived count, created count, and duplicate-prevention outcome.

## Testing Strategy

The implementation is test-first at five levels:

1. Pure calendar tests cover weekdays, Monday-start weeks, DST, and cycle gaps.
2. Service integration tests use the migrated in-memory SQLite database and assert complete rows, not mocked query chains.
3. Failure-injection tests prove each D1 batch is atomic.
4. Route tests cover validation, authorization, recurrence edits, duplicate requests, and telemetry isolation.
5. Scheduled-handler and browser tests cover Friday-to-Monday daily recurrence, weekly rollover, retries, archive behavior, points, streaks, and undo.

The existing reward-route timeouts become a release blocker rather than an accepted unrelated failure.

## Delivery Sequence

1. Add calendar helpers and migration coverage without changing production behavior.
2. Ship the additive schema and audit-only reconciliation tooling.
3. Enable occurrence generation and idempotent rollover.
4. Enable atomic completion, undo, and point-ledger writes.
5. Repair task editing, middleware, telemetry, rewards, and analytics.
6. Run local and staging reconciliation, then deploy schema and code together.
7. Monitor structured rollover and ledger reconciliation logs for at least one full weekly cycle.

## Acceptance Criteria

- A daily task creates one usable occurrence for every New York weekday indefinitely.
- Friday transitions to Monday without a weekend miss or permanent archive.
- A weekly task creates one new Monday-cycle occurrence indefinitely.
- Replaying any scheduled event creates no duplicate task and applies no second streak penalty.
- Replaying completion or undo changes points and badges at most once.
- Generic archiving never consumes a recurring goal.
- Points equal the sum of point entries for every user.
- Streak and prestige projections match active completion history.
- Parent task edits persist all displayed fields and preserve recurring history.
- PostHog outages do not change mutation responses.
- The full automated suite, typecheck, Worker build, client build, migration tests, and browser recurrence scenarios pass.

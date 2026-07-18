# Goal Streak Reliability Fixes

**Date:** 2026-07-18  
**Status:** Proposed  
**Scope:** Daily and weekly goal streak calculation, scheduled rollover, recurring task lifecycle, completion atomicity, and migration repair.

## Goal

Make goal streaks deterministic across New York calendar boundaries, daylight-saving changes, weekends, retries, weekly recurrence, completion undo, and fresh database installations.

The work is complete when:

- one eligible day can affect a streak at most once;
- daily streaks use New York weekdays consistently;
- weekends neither advance nor break a daily streak;
- two completions on different eligible New York dates count even when less than 12 hours apart;
- weekly tasks automatically produce a usable next occurrence;
- task status, points, completion history, streak state, and badges commit or roll back together;
- a clean database and an existing database can apply the same ordered migration chain;
- focused unit, integration, migration, and browser tests cover the edge cases.

## Product Rules to Lock In

These rules should be documented in code and tests before implementation:

1. `America/New_York` is the authoritative timezone for task cycles.
2. A daily streak period is one New York weekday, Monday through Friday.
3. Saturday and Sunday are neutral:
   - they do not count as missed streak days;
   - completing a task on a weekend may still award normal task points;
   - a weekend completion does not advance or replace the last qualifying streak completion.
4. Only one completion per eligible date can advance a daily streak.
5. Different eligible dates count even if the elapsed duration is less than 12 hours.
6. A weekly cycle is Monday 00:00 through Sunday 23:59:59 in New York.
7. Only one completion per weekly cycle advances a weekly streak.
8. Missing one or more eligible cycles applies the existing penalty formula unless a separate product decision changes that formula.
9. Reaching `targetStreak` earns exactly one badge, increments prestige once, and starts the next visible prestige cycle at zero.
10. Undoing the completion that earned a badge reverses its points, streak effect, prestige increment, and badge atomically.

## Delivery Strategy

Use two releases so the calendar bugs can be stopped quickly without coupling them to the larger storage change.

### Release A: Calendar and Scheduler Stabilization

Fix duplicate rollover, weekday handling, New York date comparisons, and near-midnight completions. This release should not require the recurring-task migration.

### Release B: Durable Recurrence and Atomic Completion Storage

Repair the migration chain, finish weekly occurrence generation, add completion idempotency, and batch all related writes atomically.

## Phase 1: Establish a Failing Edge-Case Test Matrix

### Files

- Modify `src/services/streak.test.ts`
- Modify `src/index.test.ts`
- Create `src/cron.test.ts`
- Modify `src/services/task.service.test.ts`

### Tests to add first

#### Daily completion

- same New York date, more than 12 hours apart: no second increment;
- Monday 11:30 p.m. to Tuesday 7:00 a.m.: increment;
- Friday to Monday: increment by one eligible period;
- Friday to Tuesday: apply exactly one missed-weekday penalty;
- Saturday and Sunday completions: do not advance or replace streak state;
- late Thursday New York completion does not satisfy Friday;
- DST spring-forward and fall-back boundaries use local dates, not elapsed hours;
- invalid `targetStreak` values are rejected before streak calculation.

#### Daily rollover

- the 03:59 UTC trigger runs only when it is 23:59 in New York;
- the 04:59 UTC trigger runs only when it is 23:59 in New York;
- exactly one of the two triggers runs in summer;
- exactly one of the two triggers runs in winter;
- weekend rollover resets task availability if required, but does not increment missed streak days;
- duplicate delivery of the accepted trigger is idempotent;
- a Friday streak remains unchanged through Saturday and Sunday;
- a late-night New York completion is compared using its New York date key.

#### Weekly lifecycle

- a completed weekly occurrence is archived with `archiveReason: "completed"`;
- a missed weekly occurrence is archived with `archiveReason: "missed"`;
- one next-cycle occurrence is created automatically;
- repeated rollover does not create duplicate occurrences;
- the new occurrence retains achievement identity, assignee, title, priority, and value;
- completing the new occurrence continues the existing streak.

#### Atomicity and idempotency

- failure at each write position leaves status, points, streak, badge, and completion history unchanged;
- two completion requests for the same task cycle award points once;
- a target-crossing completion creates one badge;
- undo reverses the same completion once;
- retrying undo is a no-op.

## Phase 2: Replace Elapsed-Hour Logic With New York Cycle Keys

### Files

- Modify `src/utils/new-york-time.ts`
- Modify `src/services/streak.ts`
- Modify `src/services/task.service.ts`

### Implementation

1. Add explicit cycle helpers:
   - `getNewYorkDateKey(date)`;
   - `isNewYorkWeekday(dateKey)`;
   - `getNewYorkWeekKey(date)`, using the Monday-start week;
   - `countEligibleWeekdaysBetween(startKey, endKey)`;
   - `getPreviousNewYorkDateKey(now)` for rollover.
2. Change the daily streak service to compare date keys before any elapsed-time check.
3. Remove the 12-hour guard.
4. Return an explicit result such as:

   ```ts
   {
     changed: boolean;
     currentStreak: number;
     prestigeCount: number;
     lastCompletedAt: Date | null;
     earnedBadge: boolean;
   }
   ```

5. For the same eligible date, return `changed: false` and preserve the prior `lastCompletedAt`.
6. For a weekend completion, return `changed: false` for streak state. Points and task status may still change.
7. For a later eligible date, calculate missed weekdays from New York date keys and apply the penalty once.
8. Replace weekly hour windows with New York week keys:
   - same week: no streak change;
   - next week: increment;
   - later week: apply missed-week penalty.
9. Validate `targetStreak` server-side as a positive integer in `createTask`.

### Acceptance criteria

- no streak rule depends on raw hour differences;
- all streak period comparisons use New York date or week keys;
- `lastCompletedAt` means the last completion that actually affected the streak.

## Phase 3: Split Task Availability Rollover From Streak Miss Evaluation

### Files

- Modify `src/index.tsx`
- Modify `src/cron.ts`
- Modify `src/utils/new-york-time.ts`
- Modify `wrangler.jsonc`

### Implementation

1. Keep both daily UTC triggers so daylight-saving time is covered.
2. In `handleScheduled`, call daily rollover only when `isDailyRolloverTime(scheduledTime)` is true.
3. Make `isDailyRolloverTime` check local clock time only. Decide weekday eligibility separately so task availability and streak misses are not conflated.
4. At local 23:59 every day:
   - reset the daily task occurrence/status needed for the next calendar day;
   - evaluate a missed streak day only when the ended New York date was Monday through Friday.
5. Change `dailyReset` to accept an ended New York date key rather than a synthetic UTC `Date`.
6. Compare `lastCompletedAt` through `getNewYorkDateKey`.
7. Do not update archived tasks back to `todo`; constrain reset queries to active daily tasks.
8. Add an idempotency boundary:
   - Release A: guard the accepted trigger and make reset updates conditional on the ended date;
   - Release B: store a unique rollover receipt for `daily:<dateKey>` in the database and commit it with rollover mutations.
9. Replace the current weekly trigger with two DST-safe Sunday-night UTC triggers:
   - Monday 03:59 UTC for EDT;
   - Monday 04:59 UTC for EST;
   - filter both through a New York Sunday 23:59 check.

### Acceptance criteria

- one local day produces at most one streak miss evaluation;
- weekends cannot change `missedDaysInARow`;
- rerunning the same rollover is a no-op;
- daily reset never resurrects an archived task.

## Phase 4: Repair the Migration Chain

### Files

- Keep `drizzle/0009_streak_grace_period.sql` unchanged
- Rename/recreate `drizzle/0009_clumsy_rawhide_kid.sql` as the next ordered migration
- Update `drizzle/meta/_journal.json`
- Add the corresponding Drizzle snapshot
- Potentially add a following migration for completion and rollover ledgers

### Implementation

1. Audit local, staging, and production with:
   - the D1 migrations table;
   - `PRAGMA table_info(tasks)`;
   - `PRAGMA index_list(tasks)`;
   - `PRAGMA foreign_key_list(tasks)`.
2. Treat `0009_streak_grace_period` as immutable because it may already be deployed.
3. Remove the filename collision by generating the recurring-cycle schema as `0010_recurring_task_cycles`.
4. Ensure `0010` contains:
   - `tasks.achievement_id`;
   - `tasks.cycle_date`;
   - `tasks.completed_at`;
   - `tasks.archived_at`;
   - `tasks.archive_reason`;
   - unique `(achievement_id, cycle_date)`.
5. Backfill `tasks.achievement_id` from `task_achievements.task_id`.
6. Give active recurring rows a deterministic current `cycle_date`.
7. Add `0011_completion_atomicity` for:
   - `task_completions`;
   - `point_entries`, if the points ledger is implemented now;
   - `rollover_runs`;
   - badge idempotency/linkage columns and unique indexes.
8. Provide a separate reconciliation path for any environment where the unjournaled conflicting migration was manually applied. Do not let the normal migration attempt to add existing columns blindly.

### Migration verification

- apply every migration to an empty local D1 database;
- upgrade a fixture database ending at the deployed `0009`;
- upgrade a fixture containing the manually applied recurring columns;
- verify foreign keys and unique indexes;
- run the service test suite against the upgraded database.

## Phase 5: Finish the Recurring Task Occurrence Lifecycle

### Files

- Modify `src/services/task.service.ts`
- Modify `src/cron.ts`
- Modify `src/db/schema.ts`
- Modify task queries and API response hydration as needed

### Data model

- `taskAchievements.id` is the stable goal identity.
- Each recurring `tasks` row is one occurrence.
- `tasks.achievementId` links every occurrence to the stable goal.
- `tasks.cycleDate` identifies its daily or weekly cycle.
- Archived occurrences remain immutable history.

### Implementation

1. Update task creation so the task and achievement are linked in both directions during migration, with `tasks.achievementId` becoming authoritative.
2. Update task queries to join achievements through `tasks.achievementId`.
3. At weekly rollover, in one atomic operation:
   - mark the current occurrence archived;
   - set `completedAt`, `archivedAt`, and `archiveReason`;
   - create the next Monday-cycle occurrence;
   - preserve achievement ID and task configuration.
4. Use unique `(achievementId, cycleDate)` so retrying rollover cannot duplicate the next occurrence.
5. Ensure the board returns only the active/current occurrence.
6. Ensure the archive returns historical occurrences and disables restoring rollover-generated history.
7. Preserve the goal and streak if a parent edits task title, priority, or assignee for future occurrences.
8. Decide whether daily tasks also move to occurrence rows in this release. If not, keep the daily reset path explicit and isolated from weekly occurrence creation.

### Acceptance criteria

- a weekly goal remains available every week without manual restore;
- archive history and active task rows cannot be confused;
- every weekly occurrence points to the same achievement;
- rollover retries create no duplicates.

## Phase 6: Make Completion and Undo Atomic

### Files

- Create `src/services/completion.service.ts`
- Create `src/services/completion.service.test.ts`
- Modify `src/services/task.service.ts`
- Modify `src/db/schema.ts`
- Add the `0011` migration described above

### Recommended write model

Use a completion ledger and a D1 batch rather than relying only on mutable snapshots.

1. Insert one `task_completions` row per achievement/cycle with a unique key.
2. Insert one linked point entry for the completion.
3. Update the cached user point balance from the point ledger.
4. Derive the new streak from the previous persisted state or completion history.
5. Insert a badge with a unique completion or prestige identity when the target is crossed.
6. Update the achievement projection.
7. Update the task occurrence status and completion timestamp.
8. Submit all statements through one D1 `batch`, with no earlier status or points write.

Suggested uniqueness constraints:

- completion: `(achievement_id, cycle_date)`;
- completion point entry: `(completion_id, reason)`;
- badge: `(user_id, achievement_id, prestige_level)`;
- rollover: `(rollover_type, cycle_date)`.

### Undo

1. Identify the exact completion row being reversed.
2. Mark it revoked or delete it according to the ledger policy.
3. reverse its point entry;
4. revoke its badge if it created one;
5. recompute the achievement projection from remaining active completions;
6. update the task status;
7. commit all changes in one batch.

### Acceptance criteria

- a failed batch leaves no partial state;
- repeated completion requests are idempotent;
- points equal the sum of point entries;
- prestige equals non-revoked earned badges;
- the projected streak matches completion history.

## Phase 7: UI and Observability

### Files

- Modify `src/client/components/Board.tsx`
- Modify `src/client/components/Profile.tsx`
- Modify PostHog event properties in `src/routes/tasks.tsx`

### Improvements

1. After prestige, label the reset clearly, for example `Next cycle: 0/20`, while keeping the permanent `1×` badge.
2. Show whether a goal is daily-weekday or weekly so weekend behavior is understandable.
3. Add a short grace/penalty explanation near streak progress.
4. Emit structured logs for:
   - rollover accepted/skipped;
   - rollover cycle key;
   - duplicate rollover prevented;
   - completion cycle key;
   - badge and prestige changes.
5. Include timezone, cycle key, and whether streak state changed in the existing streak milestone analytics event.

## Phase 8: Final Verification and Rollout

### Automated checks

Run:

```bash
bun test src/services/streak.test.ts
bun test src/cron.test.ts src/index.test.ts
bun test src/services/task.service.test.ts src/services/completion.service.test.ts
bun test
```

Also:

- build the client and Worker;
- apply migrations to a clean temporary D1 database;
- run the migration upgrade fixtures;
- run a local browser flow for daily and weekly goals.

### Browser scenarios

1. Create a daily goal with target `2`.
2. Complete it on one eligible day and verify `1/2`.
3. Simulate the next local rollover and complete the next eligible date.
4. Verify one badge, `1×` prestige, and next-cycle progress.
5. Undo the badge completion and verify points, badge, prestige, and streak all revert.
6. Simulate Friday through Monday and verify the weekend is neutral.
7. Create and complete a weekly goal, run weekly rollover, and verify the next occurrence appears automatically.
8. Retry both rollovers and confirm no duplicate task or streak mutation.

### Deployment order

1. Back up the production D1 database.
2. Deploy Release A code and monitor accepted/skipped cron logs for one full DST-appropriate day.
3. Apply the repaired migration chain to staging.
4. Run the reconciliation audit on existing data.
5. Deploy Release B schema and code together.
6. Verify points, streak projections, badge counts, and active recurring occurrences.
7. Keep temporary reconciliation logging for one weekly cycle.

## Definition of Done

- All new tests pass.
- The complete existing suite passes, including the currently failing reward-route tests or with those failures separately resolved and documented.
- No duplicate daily or weekly rollover is observed.
- Friday streaks survive the weekend unchanged.
- Near-midnight consecutive weekdays increment correctly.
- Weekly goals recur automatically.
- Failure injection proves completion and undo are atomic.
- Fresh and upgraded databases have one unambiguous migration history.
- Production reconciliation shows no point, badge, or streak inconsistencies.

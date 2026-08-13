-- Deterministic, idempotent repairs for recurring reliability data.
-- Do not wrap this file in BEGIN/COMMIT: `wrangler d1 execute --file` uploads
-- the statements as one atomic batch and D1 rejects nested transaction wrappers.

-- Recover an existing legacy task_achievements.task_id relationship first.
UPDATE tasks
SET achievement_id = (
  SELECT goal.id
  FROM task_achievements AS goal
  WHERE goal.task_id = tasks.id
  LIMIT 1
)
WHERE repeat IN ('daily', 'weekly')
  AND achievement_id IS NULL
  AND EXISTS (
    SELECT 1 FROM task_achievements AS goal WHERE goal.task_id = tasks.id
  );

-- Give every remaining recurring row its own stable repair goal. Archived rows
-- get inactive goals so history is linked without restarting an old recurrence.
INSERT OR IGNORE INTO task_achievements (
  task_id,
  recurrence_key,
  cadence,
  task_title,
  task_priority,
  task_value,
  assignee_id,
  streak_enabled,
  active,
  name,
  target_streak,
  current_streak,
  prestige_count,
  missed_days_in_a_row,
  created_at,
  updated_at
)
SELECT
  task.id,
  'repair:' || task.id,
  task.repeat,
  task.title,
  task.priority,
  task.value,
  task.assignee_id,
  0,
  CASE WHEN task.status = 'archived' THEN 0 ELSE 1 END,
  task.title || ' Streak',
  20,
  0,
  0,
  0,
  CAST(unixepoch('now') AS INTEGER) * 1000,
  CAST(unixepoch('now') AS INTEGER) * 1000
FROM tasks AS task
WHERE task.repeat IN ('daily', 'weekly')
  AND task.achievement_id IS NULL;

UPDATE tasks
SET achievement_id = (
  SELECT goal.id
  FROM task_achievements AS goal
  WHERE goal.recurrence_key = 'repair:' || tasks.id
  LIMIT 1
)
WHERE repeat IN ('daily', 'weekly')
  AND achievement_id IS NULL
  AND EXISTS (
    SELECT 1
    FROM task_achievements AS goal
    WHERE goal.recurrence_key = 'repair:' || tasks.id
  );

-- Backfill stable goal configuration from the newest linked occurrence without
-- changing completed or archived task snapshots.
UPDATE task_achievements
SET
  recurrence_key = COALESCE(
    recurrence_key,
    CASE
      WHEN task_id IS NOT NULL THEN 'repair:' || task_id
      WHEN EXISTS (
        SELECT 1 FROM tasks WHERE tasks.achievement_id = task_achievements.id
      ) THEN 'repair:goal-task:' || (
        SELECT MIN(tasks.id)
        FROM tasks
        WHERE tasks.achievement_id = task_achievements.id
      )
      ELSE 'repair:goal:' || id
    END
  ),
  cadence = COALESCE(
    cadence,
    (
      SELECT task.repeat
      FROM tasks AS task
      WHERE task.achievement_id = task_achievements.id
        AND task.repeat IN ('daily', 'weekly')
      ORDER BY (task.status = 'archived') ASC, task.id DESC
      LIMIT 1
    )
  ),
  task_title = COALESCE(
    task_title,
    (
      SELECT task.title
      FROM tasks AS task
      WHERE task.achievement_id = task_achievements.id
      ORDER BY (task.status = 'archived') ASC, task.id DESC
      LIMIT 1
    )
  ),
  task_priority = COALESCE(
    task_priority,
    (
      SELECT task.priority
      FROM tasks AS task
      WHERE task.achievement_id = task_achievements.id
      ORDER BY (task.status = 'archived') ASC, task.id DESC
      LIMIT 1
    )
  ),
  task_value = COALESCE(
    task_value,
    (
      SELECT task.value
      FROM tasks AS task
      WHERE task.achievement_id = task_achievements.id
      ORDER BY (task.status = 'archived') ASC, task.id DESC
      LIMIT 1
    )
  ),
  assignee_id = COALESCE(
    assignee_id,
    (
      SELECT task.assignee_id
      FROM tasks AS task
      WHERE task.achievement_id = task_achievements.id
      ORDER BY (task.status = 'archived') ASC, task.id DESC
      LIMIT 1
    )
  ),
  updated_at = CAST(unixepoch('now') AS INTEGER) * 1000;

-- Preserve stranded archived recurring rows as immutable history.
UPDATE tasks
SET
  archived_at = COALESCE(
    archived_at,
    completed_at,
    CAST(unixepoch('now') AS INTEGER) * 1000
  ),
  archive_reason = COALESCE(
    archive_reason,
    CASE WHEN completed_at IS NOT NULL THEN 'completed' ELSE 'manual' END
  )
WHERE status = 'archived'
  AND repeat IN ('daily', 'weekly')
  AND (archive_reason IS NULL OR archived_at IS NULL);

-- Preserve a legacy cached balance once, then make point_entries authoritative.
WITH ledger_balances AS (
  SELECT
    user.id AS user_id,
    user.points AS cached_points,
    COALESCE(SUM(entry.delta), 0) AS ledger_points
  FROM users AS user
  LEFT JOIN point_entries AS entry ON entry.user_id = user.id
  GROUP BY user.id, user.points
)
INSERT OR IGNORE INTO point_entries (
  event_id,
  user_id,
  delta,
  reason,
  created_at
)
SELECT
  'opening-balance:' || balance.user_id,
  balance.user_id,
  balance.cached_points - balance.ledger_points,
  'opening_balance',
  CAST(unixepoch('now') AS INTEGER) * 1000
FROM ledger_balances AS balance
WHERE balance.cached_points <> balance.ledger_points
  AND NOT EXISTS (
    SELECT 1
    FROM point_entries AS opening
    WHERE opening.user_id = balance.user_id
      AND opening.reason = 'opening_balance'
  );

UPDATE users
SET points = COALESCE(
  (SELECT SUM(entry.delta) FROM point_entries AS entry WHERE entry.user_id = users.id),
  0
);

-- Compute the New York date with current U.S. DST transition rules. Archive a
-- stale non-archived occurrence first so a legacy row cannot masquerade as the
-- current cycle and block the replacement occurrence.
WITH
year_parts AS (
  SELECT strftime('%Y', 'now') AS year
),
transitions AS (
  SELECT
    unixepoch(
      printf(
        '%s-03-%02d 07:00:00',
        year,
        8 + ((7 - CAST(strftime('%w', year || '-03-01') AS INTEGER)) % 7)
      )
    ) AS dst_start,
    unixepoch(
      printf(
        '%s-11-%02d 06:00:00',
        year,
        1 + ((7 - CAST(strftime('%w', year || '-11-01') AS INTEGER)) % 7)
      )
    ) AS dst_end
  FROM year_parts
),
clock AS (
  SELECT date(
    'now',
    CASE
      WHEN unixepoch('now') >= dst_start AND unixepoch('now') < dst_end
        THEN '-4 hours'
      ELSE '-5 hours'
    END
  ) AS ny_date
  FROM transitions
),
configured_goals AS (
  SELECT
    goal.id,
    goal.active,
    CASE
      WHEN goal.cadence = 'weekly' THEN date(
        clock.ny_date,
        printf(
          '-%d days',
          (CAST(strftime('%w', clock.ny_date) AS INTEGER) + 6) % 7
        )
      )
      WHEN goal.cadence = 'daily' THEN CASE
        CAST(strftime('%w', clock.ny_date) AS INTEGER)
        WHEN 0 THEN date(clock.ny_date, '+1 day')
        WHEN 6 THEN date(clock.ny_date, '+2 days')
        ELSE clock.ny_date
      END
      ELSE NULL
    END AS target_cycle
  FROM task_achievements AS goal
  CROSS JOIN clock
)
UPDATE tasks
SET
  status = 'archived',
  archived_at = COALESCE(
    archived_at,
    CAST(unixepoch('now') AS INTEGER) * 1000
  ),
  archive_reason = COALESCE(
    archive_reason,
    CASE WHEN status = 'done' THEN 'completed' ELSE 'missed' END
  ),
  completed_at = CASE
    WHEN status = 'done' THEN COALESCE(
      completed_at,
      CAST(unixepoch('now') AS INTEGER) * 1000
    )
    ELSE completed_at
  END
WHERE status <> 'archived'
  AND EXISTS (
    SELECT 1
    FROM configured_goals AS goal
    WHERE goal.id = tasks.achievement_id
      AND goal.active = 1
      AND goal.target_cycle IS NOT NULL
      AND tasks.cycle_date IS NOT goal.target_cycle
  );

-- Create one eligible current occurrence for every configured active goal that
-- lacks an occurrence for the exact current cycle.
WITH
year_parts AS (
  SELECT strftime('%Y', 'now') AS year
),
transitions AS (
  SELECT
    unixepoch(
      printf(
        '%s-03-%02d 07:00:00',
        year,
        8 + ((7 - CAST(strftime('%w', year || '-03-01') AS INTEGER)) % 7)
      )
    ) AS dst_start,
    unixepoch(
      printf(
        '%s-11-%02d 06:00:00',
        year,
        1 + ((7 - CAST(strftime('%w', year || '-11-01') AS INTEGER)) % 7)
      )
    ) AS dst_end
  FROM year_parts
),
clock AS (
  SELECT date(
    'now',
    CASE
      WHEN unixepoch('now') >= dst_start AND unixepoch('now') < dst_end
        THEN '-4 hours'
      ELSE '-5 hours'
    END
  ) AS ny_date
  FROM transitions
),
configured_goals AS (
  SELECT
    goal.*,
    CASE
      WHEN goal.cadence = 'weekly' THEN date(
        clock.ny_date,
        printf(
          '-%d days',
          (CAST(strftime('%w', clock.ny_date) AS INTEGER) + 6) % 7
        )
      )
      WHEN goal.cadence = 'daily' THEN CASE
        CAST(strftime('%w', clock.ny_date) AS INTEGER)
        WHEN 0 THEN date(clock.ny_date, '+1 day')
        WHEN 6 THEN date(clock.ny_date, '+2 days')
        ELSE clock.ny_date
      END
      ELSE NULL
    END AS target_cycle
  FROM task_achievements AS goal
  CROSS JOIN clock
)
INSERT OR IGNORE INTO tasks (
  title,
  priority,
  value,
  status,
  repeat,
  assignee_id,
  achievement_id,
  cycle_date
)
SELECT
  goal.task_title,
  goal.task_priority,
  goal.task_value,
  'todo',
  goal.cadence,
  goal.assignee_id,
  goal.id,
  goal.target_cycle
FROM configured_goals AS goal
WHERE goal.active = 1
  AND goal.cadence IN ('daily', 'weekly')
  AND goal.task_title IS NOT NULL
  AND goal.task_priority IN ('high', 'medium', 'low')
  AND goal.task_value IS NOT NULL
  AND goal.target_cycle IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM tasks AS current_occurrence
    WHERE current_occurrence.achievement_id = goal.id
      AND current_occurrence.status <> 'archived'
      AND current_occurrence.cycle_date = goal.target_cycle
  );

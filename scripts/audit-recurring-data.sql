-- Read-only recurring reliability audit. Safe to replay locally or remotely.
-- `severity = deterministic` findings are handled by reconcile-recurring-data.sql.
-- `severity = manual_review` findings are intentionally never deleted or guessed at.

SELECT
  'recurring_tasks_missing_goal' AS issue,
  'deterministic' AS severity,
  COUNT(*) AS issue_count,
  COALESCE(GROUP_CONCAT(id), '') AS sample_ids
FROM tasks
WHERE repeat IN ('daily', 'weekly')
  AND achievement_id IS NULL

UNION ALL

SELECT
  'active_goals_missing_current_occurrence',
  'deterministic',
  COUNT(*),
  COALESCE(GROUP_CONCAT(id), '')
FROM task_achievements AS goal
WHERE goal.active = 1
  AND NOT EXISTS (
    SELECT 1
    FROM tasks AS occurrence
    WHERE occurrence.achievement_id = goal.id
      AND occurrence.status <> 'archived'
  )

UNION ALL

SELECT
  'multiple_active_occurrences',
  'manual_review',
  COUNT(*),
  COALESCE(GROUP_CONCAT(achievement_id), '')
FROM (
  SELECT achievement_id
  FROM tasks
  WHERE achievement_id IS NOT NULL
    AND status <> 'archived'
  GROUP BY achievement_id
  HAVING COUNT(*) > 1
)

UNION ALL

SELECT
  'null_or_invalid_cycle_dates',
  'manual_review',
  COUNT(*),
  COALESCE(GROUP_CONCAT(id), '')
FROM tasks
WHERE repeat IN ('daily', 'weekly')
  AND (
    cycle_date IS NULL
    OR strftime('%Y-%m-%d', cycle_date) IS NULL
    OR (repeat = 'daily' AND CAST(strftime('%w', cycle_date) AS INTEGER) IN (0, 6))
    OR (repeat = 'weekly' AND CAST(strftime('%w', cycle_date) AS INTEGER) <> 1)
  )

UNION ALL

SELECT
  'archived_recurring_rows_missing_history_metadata',
  'deterministic',
  COUNT(*),
  COALESCE(GROUP_CONCAT(id), '')
FROM tasks
WHERE status = 'archived'
  AND repeat IN ('daily', 'weekly')
  AND (archive_reason IS NULL OR archived_at IS NULL)

;

SELECT
  'orphan_goals' AS issue,
  'manual_review' AS severity,
  COUNT(*) AS issue_count,
  COALESCE(GROUP_CONCAT(goal.id), '') AS sample_ids
FROM task_achievements AS goal
WHERE NOT EXISTS (
    SELECT 1 FROM tasks WHERE tasks.achievement_id = goal.id
  )
  AND (
    goal.task_id IS NULL
    OR NOT EXISTS (SELECT 1 FROM tasks WHERE tasks.id = goal.task_id)
  )

UNION ALL

SELECT
  'orphan_task_goal_links',
  'manual_review',
  COUNT(*),
  COALESCE(GROUP_CONCAT(task.id), '')
FROM tasks AS task
LEFT JOIN task_achievements AS goal ON goal.id = task.achievement_id
WHERE task.achievement_id IS NOT NULL
  AND goal.id IS NULL

UNION ALL

SELECT
  'duplicate_active_completions',
  'manual_review',
  COUNT(*),
  COALESCE(GROUP_CONCAT(group_key), '')
FROM (
  SELECT
    CASE
      WHEN achievement_id IS NOT NULL
        THEN 'goal:' || achievement_id || ':' || completed_on
      ELSE 'task:' || task_id
    END AS group_key
  FROM task_completions
  WHERE canceled_at IS NULL
  GROUP BY
    CASE
      WHEN achievement_id IS NOT NULL
        THEN 'goal:' || achievement_id || ':' || completed_on
      ELSE 'task:' || task_id
    END
  HAVING COUNT(*) > 1
)

UNION ALL

SELECT
  'cached_points_do_not_match_ledger',
  'deterministic',
  COUNT(*),
  COALESCE(GROUP_CONCAT(id), '')
FROM (
  SELECT user.id
  FROM users AS user
  LEFT JOIN point_entries AS entry ON entry.user_id = user.id
  GROUP BY user.id, user.points
  HAVING user.points <> COALESCE(SUM(entry.delta), 0)
)

UNION ALL

SELECT
  'badge_prestige_mismatches',
  'manual_review',
  COUNT(*),
  COALESCE(GROUP_CONCAT(id), '')
FROM (
  SELECT goal.id
  FROM task_achievements AS goal
  LEFT JOIN earned_badges AS badge
    ON badge.achievement_id = goal.id
    AND badge.revoked_at IS NULL
  GROUP BY goal.id, goal.prestige_count
  HAVING goal.prestige_count <> COUNT(badge.id)
)

;

# Recurring Task Reconciliation Runbook

Use this runbook when introducing the recurring-goal and point-ledger reliability
model to an existing D1 database. The audit is read-only. The reconciliation file
contains only deterministic, idempotent repairs and never deletes task,
completion, point, badge, or achievement history.

## Safety rules

- Run the commands from the repository root with the same Wrangler version as the application.
- Use a dedicated staging D1 database before production. Never point a staging Worker at `family-kanban`.
- Stop writes during the production maintenance window.
- Export a remote backup before applying migrations or reconciliation.
- Review every `manual_review` audit row. The repair script intentionally leaves ambiguous duplicates, invalid historical cycle dates, orphan records, and badge/prestige disagreements untouched.
- Do not add `BEGIN` or `COMMIT` to the reconciliation file. Wrangler uploads a SQL file as an atomic batch; D1 rejects nested transaction wrappers.

## Local rehearsal

Use an isolated persistence directory when rehearsing against copied data:

```bash
bunx wrangler d1 migrations apply family-kanban --local --persist-to .wrangler/reconciliation-rehearsal
bunx wrangler d1 execute family-kanban --local --persist-to .wrangler/reconciliation-rehearsal --file scripts/audit-recurring-data.sql
bunx wrangler d1 execute family-kanban --local --persist-to .wrangler/reconciliation-rehearsal --file scripts/reconcile-recurring-data.sql
bunx wrangler d1 execute family-kanban --local --persist-to .wrangler/reconciliation-rehearsal --file scripts/audit-recurring-data.sql
```

Expected result: every `deterministic` issue count is zero after reconciliation.
Any remaining rows must have `manual_review` severity. Compare row counts before
and after to confirm no archived history was deleted.

## Staging

Provision a separate D1 database named `family-kanban-staging`, bind it only to
the staging Worker, and then run:

```bash
bunx wrangler d1 migrations apply family-kanban-staging --remote
bunx wrangler d1 execute family-kanban-staging --remote --file scripts/audit-recurring-data.sql
bunx wrangler d1 execute family-kanban-staging --remote --file scripts/reconcile-recurring-data.sql
bunx wrangler d1 execute family-kanban-staging --remote --file scripts/audit-recurring-data.sql
```

Save both audit outputs with the release record. Do not continue if a
deterministic issue remains or if any manual finding has not been explained.

## Production maintenance window

1. Verify Cloudflare authentication and capture the current Worker version:

   ```bash
   bunx wrangler whoami
   bunx wrangler versions list
   ```

2. Stop application writes and export D1 outside the repository:

   ```bash
   bunx wrangler d1 export family-kanban --remote --output ../family-kanban-pre-recurring-rollout-YYYYMMDD-HHMM.sql
   ```

3. Apply the additive migration, audit, reconcile, and audit again:

   ```bash
   bunx wrangler d1 migrations apply family-kanban --remote
   bunx wrangler d1 execute family-kanban --remote --file scripts/audit-recurring-data.sql
   bunx wrangler d1 execute family-kanban --remote --file scripts/reconcile-recurring-data.sql
   bunx wrangler d1 execute family-kanban --remote --file scripts/audit-recurring-data.sql
   ```

4. Confirm all deterministic counts are zero, `users.points` matches the point
   ledger, and every active goal has exactly one non-archived occurrence.

5. In the same maintenance window, deploy the compatible Worker and resume writes:

   ```bash
   bun run deploy
   ```

## Rollback criteria

Keep writes stopped and roll back if the migration or SQL batch fails, a
deterministic audit count remains nonzero, point balances change unexpectedly,
multiple active occurrences appear, or the Worker fails its smoke checks.

- Roll back the Worker with `bunx wrangler rollback <previous-version-id>`.
- Restore D1 from the pre-rollout export or use D1 Time Travel for the timestamp immediately before the maintenance window.
- Re-run the read-only audit before resuming writes.

After release, monitor accepted/skipped rollover logs, uniqueness conflicts,
point reconciliation, and telemetry failures for one full Monday-to-Sunday cycle.

# PostHog post-wizard report

The wizard has completed a deep integration of PostHog into the Family Task Board. A `posthog-node` server-side client is initialized per request from Cloudflare Worker bindings (`POSTHOG_API_KEY`, `POSTHOG_HOST`) and uses `flushAt: 1` / `flushInterval: 0` with `captureImmediate()` — the correct pattern for serverless/edge environments. Users are identified on every authenticated request via the session middleware, keeping person profiles (name, email, user type) current. Error tracking is enabled globally via `enableExceptionAutocapture: true`.

| Event | Description | File |
|---|---|---|
| `task created` | Parent creates a new task with title, priority, assignee, and repeat schedule | `src/routes/tasks.tsx` |
| `task status updated` | Any user moves a task to a new status (todo → doing → review → done) | `src/routes/tasks.tsx` |
| `task updated` | Parent edits task details (title, priority, assignee) | `src/routes/tasks.tsx` |
| `task deleted` | Parent removes a task from the board | `src/routes/tasks.tsx` |
| `reward created` | Parent adds a new redeemable reward with title and point cost | `src/routes/rewards.tsx` |
| `reward redeemed` | Child spends points to claim a reward | `src/routes/rewards.tsx` |
| `active user switched` | A family member switches which profile is active in the session | `src/routes/session.tsx` |
| `identify` | Authenticated user identified with name, email, and user type on every request | `src/auth/middleware.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics (wizard) — Dashboard](https://us.posthog.com/project/467270/dashboard/1704078)
- [Task creations over time](https://us.posthog.com/project/467270/insights/5Fq7pcsR)
- [Task completions over time](https://us.posthog.com/project/467270/insights/OYtOxxLs)
- [Reward redemption funnel](https://us.posthog.com/project/467270/insights/485nfL5C)
- [Task creation to completion funnel](https://us.posthog.com/project/467270/insights/NUlI7MfC)
- [Family activity overview](https://us.posthog.com/project/467270/insights/vGw6Cf3R)

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

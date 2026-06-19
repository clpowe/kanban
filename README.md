# Family Kanban

Family Kanban is a household task board for assigning chores, tracking progress, awarding points, and letting children redeem rewards. It combines a SolidJS client with a Cloudflare Worker API, Better Auth sessions, and a Cloudflare D1 database managed through Drizzle migrations.

The app is built for a parent-managed family workflow: parents create child accounts, assign tasks, review completion, configure rewards, and view analytics; children can focus on their assigned board, earn points, and redeem rewards.

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database](#database)
- [Development](#development)
- [Testing](#testing)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Credits](#credits)
- [License](#license)

## Features

- Parent and child authentication with Better Auth username/password login.
- Family session switching so a logged-in family can change the active user.
- Kanban task board with `todo`, `doing`, `review`, `done`, and archived task states.
- Parent-only task creation, child account management, reward creation, and analytics.
- Point awards based on task priority when tasks are completed.
- Reward store where child users can redeem points.
- Archive view for completed or historical work.
- Scheduled Cloudflare cron handlers for daily task resets and weekly archiving.
- PostHog event tracking for reward redemptions.

## Tech Stack

- [Bun](https://bun.sh/) for package management and local scripts.
- [SolidJS](https://www.solidjs.com/) and `@solidjs/router` for the client.
- [Vite](https://vite.dev/) through `vite-plugin-solid` for client builds.
- [Tailwind CSS](https://tailwindcss.com/) and [daisyUI](https://daisyui.com/) for styling.
- [Hono](https://hono.dev/) for the Cloudflare Worker API.
- [Better Auth](https://www.better-auth.com/) for authentication.
- [Drizzle ORM](https://orm.drizzle.team/) with Cloudflare D1/SQLite.
- [Wrangler](https://developers.cloudflare.com/workers/wrangler/) for local Worker development and deployment.

## Getting Started

### Prerequisites

- Bun 1.3 or newer.
- A Cloudflare account if you plan to use remote D1 or deploy the Worker.

### Install Dependencies

```bash
bun install
```

## Environment Variables

For local Worker development, provide the required secrets in your local Wrangler environment. A typical local `.dev.vars` file looks like this:

```bash
BETTER_AUTH_SECRET=replace-with-a-long-random-secret
BETTER_AUTH_URL=http://localhost:8787
POSTHOG_API_KEY=replace-or-use-a-dev-key
POSTHOG_HOST=https://us.i.posthog.com
```

`BETTER_AUTH_URL` and `POSTHOG_HOST` are also defined in `wrangler.jsonc` as non-secret vars. Keep secret values out of committed files.

## Database

This project uses the D1 database binding named `family_kanban`. The production database metadata is configured in `wrangler.jsonc`, and migrations live in `drizzle/`.

Apply migrations to the local D1 database:

```bash
bunx wrangler d1 migrations apply family-kanban --local
```

Apply migrations to the remote D1 database:

```bash
bunx wrangler d1 migrations apply family-kanban --remote
```

To generate a new migration after changing `src/db/schema.ts`:

```bash
bunx drizzle-kit generate
```

There is also a `seed.ts` Worker entry that can create sample family users, rewards, and tasks for development. The seeded users use the password `family123`.

## Development

Start the full local development environment:

```bash
bun run dev
```

The development command starts:

- Cloudflare Worker API: `http://localhost:8787`
- Vite client: `http://localhost:3000`
- Tailwind CSS watcher for `public/app.css`

The Vite dev server proxies `/api` and `/session` requests to the Worker.

Useful scripts:

```bash
bun run dev:client
bun run dev:css
bun run dev:server
```

## Usage

1. Register a parent account at `/register`.
2. Sign in with the parent account at `/login`.
3. Use Settings to create child accounts and configure rewards.
4. Create tasks from the board and assign them to child users.
5. Switch the active user from the header to view the board as a parent or child.
6. Move tasks through the workflow. Completing tasks awards points to the assignee.
7. Open Rewards to view the leaderboard and redeem rewards.
8. Open Analytics as a parent to review status counts and child performance.

## Testing

Run the test suite with Bun:

```bash
bun test
```

Run a focused test file:

```bash
bun test src/auth/auth.test.ts
```

The current tests cover authentication helpers, authorization rules, schema expectations, task and reward service behavior, selected route handlers, and the scheduled Worker entry points.

## Deployment

Build the client and CSS assets before deploying:

```bash
bun run build:css
bun run build:client
```

Deploy the Worker:

```bash
bun run deploy
```

Set production secrets with Wrangler before deploying:

```bash
bunx wrangler secret put BETTER_AUTH_SECRET
bunx wrangler secret put POSTHOG_API_KEY
```

Check `wrangler.jsonc` before deploying to confirm the Worker name, D1 database binding, production `BETTER_AUTH_URL`, trusted auth origins, and cron schedules match your Cloudflare environment.

## Project Structure

```text
src/
  auth/          Better Auth configuration, middleware, and authorization helpers
  client/        SolidJS app, routes, components, API client, and app store
  db/            Drizzle D1 client and SQLite schema
  lib/           Server-side integrations such as PostHog
  routes/        Hono API route modules
  services/      Task, user, and reward data operations
  cron.ts        Scheduled task reset and archive handlers
  index.tsx      Cloudflare Worker entry point
drizzle/         Generated D1/SQLite migrations
public/          Built client assets served by the Worker
docs/plans/      Implementation notes and historical plans
```



## License

No license file is currently included in this repository. Add one before distributing or accepting outside contributions.

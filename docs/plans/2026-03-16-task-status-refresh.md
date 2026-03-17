# Task Status Refresh Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a task status select that updates the task on the server and refreshes the entire tasks container after the status changes.

**Architecture:** Keep inline task edits on the existing `PATCH /task/:id` route. Treat status updates as a special HTMX flow: the status select submits with no swap, the server returns an `HX-Trigger` response header, and `#tasks-container` listens for that event and reloads itself from `GET /tasks`.

**Tech Stack:** Hono, Hono JSX, HTMX, Drizzle ORM, Bun test

---

### Task 1: Add a failing response test

**Files:**
- Modify: `index.test.ts`

**Step 1: Write the failing test**

Add a test that expects the status-refresh helper to return:
- HTTP `200`
- header `HX-Trigger: refreshTasks`
- empty body

**Step 2: Run test to verify it fails**

Run: `bun test index.test.ts`

Expected: FAIL because the helper does not exist yet.

**Step 3: Write minimal implementation**

Add a small helper in `index.tsx` that sets the response header and returns an empty body.

**Step 4: Run test to verify it passes**

Run: `bun test index.test.ts`

Expected: PASS

### Task 2: Wire the HTMX refresh flow

**Files:**
- Modify: `index.tsx`

**Step 1: Update the tasks container**

Make `#tasks-container` listen for both:
- `load`
- `refreshTasks from:body`

Keep it fetching from `GET /tasks`.

**Step 2: Update the task status control**

Make the task status select:
- submit via `PATCH /task/:id`
- trigger on `change`
- use `hx-swap="none"`
- mark the current status as selected

**Step 3: Simplify the patch route**

Unify task updates into a single `PATCH /task/:id` handler:
- support `title`, `priority`, `assigneeId`, and `status`
- when `status` is present, return the refresh helper response
- otherwise return the updated task row HTML

**Step 4: Remove duplicate route logic**

Delete the second duplicate `PATCH /task/:id` handler so only one patch route remains.

**Step 5: Run verification**

Run: `bun test index.test.ts`

Expected: PASS

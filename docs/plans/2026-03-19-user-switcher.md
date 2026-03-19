# User Switcher Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a header-based in-app user switcher that lets a family switch between parent and child views after the initial Basic Auth login.

**Architecture:** Keep Basic Auth as the initial credential gate, then derive an `activeUser` from a signed session cookie on every request. Update the root layout to render a header switcher and add a session route that changes the active user and refreshes HTMX sections.

**Tech Stack:** Bun, Hono, Hono JSX, HTMX, Drizzle, Cloudflare Workers

---

### Task 1: Session auth helpers

**Files:**
- Modify: `src/auth/middleware.ts`
- Modify: `src/auth/auth.test.ts`

**Step 1: Write the failing test**

Add tests that cover:
- resolving `activeUser` from session state when present
- falling back to the login user when session state is missing
- rejecting a user switch to an unknown id

**Step 2: Run test to verify it fails**

Run: `bun test src/auth/auth.test.ts`
Expected: FAIL because the session helper functions do not exist yet.

**Step 3: Write minimal implementation**

Implement small helpers in `src/auth/middleware.ts` to:
- serialize and parse session cookie state
- resolve the active user
- validate a requested active user id

**Step 4: Run test to verify it passes**

Run: `bun test src/auth/auth.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/auth/middleware.ts src/auth/auth.test.ts
git commit -m "feat: add active user session helpers"
```

### Task 2: Request auth integration

**Files:**
- Modify: `src/auth/middleware.ts`
- Modify: `src/index.tsx`
- Test: `src/auth/auth.test.ts`

**Step 1: Write the failing test**

Add a test that shows authorization helpers must read `activeUser` instead of the Basic Auth login owner once session resolution is in place.

**Step 2: Run test to verify it fails**

Run: `bun test src/auth/auth.test.ts`
Expected: FAIL because request helpers still expose only the login user.

**Step 3: Write minimal implementation**

Update middleware and request helpers to:
- store both `loginUser` and `activeUser`
- expose `requireAuthenticatedUser` as the active user accessor
- keep parent/child authorization behavior unchanged from the caller perspective

**Step 4: Run test to verify it passes**

Run: `bun test src/auth/auth.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/auth/middleware.ts src/index.tsx src/auth/auth.test.ts
git commit -m "feat: resolve active user from session"
```

### Task 3: Header switcher UI

**Files:**
- Modify: `src/components/Layout.tsx`
- Create: `src/components/UserSwitcher.tsx`
- Modify: `src/index.tsx`

**Step 1: Write the failing test**

Add a component or response test that expects the root page to render a header with the current active user and a selector containing all users.

**Step 2: Run test to verify it fails**

Run: `bun test`
Expected: FAIL because no header switcher exists yet.

**Step 3: Write minimal implementation**

Render the header and select control. Wire the select with HTMX so a user change submits to the new session route and refreshes the relevant page sections.

**Step 4: Run test to verify it passes**

Run: `bun test`
Expected: PASS for the new coverage.

**Step 5: Commit**

```bash
git add src/components/Layout.tsx src/components/UserSwitcher.tsx src/index.tsx
git commit -m "feat: add header user switcher"
```

### Task 4: Session switching route

**Files:**
- Create: `src/routes/session.tsx`
- Modify: `src/index.tsx`
- Modify: `src/services/user.service.ts`
- Test: `src/auth/auth.test.ts`

**Step 1: Write the failing test**

Add a route-focused test that shows changing the active user updates session state only when the selected user exists in the allowed family list.

**Step 2: Run test to verify it fails**

Run: `bun test src/auth/auth.test.ts`
Expected: FAIL because the session route does not exist.

**Step 3: Write minimal implementation**

Implement the route and any small service helper needed to load a user by id, set the updated session cookie, and trigger HTMX refreshes.

**Step 4: Run test to verify it passes**

Run: `bun test src/auth/auth.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/routes/session.tsx src/index.tsx src/services/user.service.ts src/auth/auth.test.ts
git commit -m "feat: add active user switch route"
```

### Task 5: Full verification

**Files:**
- Verify existing touched files only

**Step 1: Run focused tests**

Run: `bun test src/auth/auth.test.ts src/db/schema.test.ts`
Expected: PASS

**Step 2: Run broader verification**

Run: `bun test`
Expected: PASS

**Step 3: Manual verification**

Run the app and verify:
- a parent can switch to a child and loses parent-only task controls
- a child can switch to a parent and gains parent controls
- task list and users list refresh after switching

**Step 4: Commit**

```bash
git add .
git commit -m "feat: add in-app family user switching"
```

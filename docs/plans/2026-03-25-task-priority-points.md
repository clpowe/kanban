# Task Priority Points Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Automatically store task points from priority at creation time using the fixed mapping `high=10`, `medium=5`, `low=1`.

**Architecture:** Keep the rule in the task service so task creation always derives `tasks.value` from `priority` before inserting. Update the create-task form to remove manual point entry, and verify the stored value with service-level tests.

**Tech Stack:** TypeScript, Hono, Drizzle ORM, Bun test runner, JSX components

---

### Task 1: Add creation tests for priority point mapping

**Files:**
- Modify: `src/services/task.service.ts`
- Test: `src/services/task.service.test.ts`

**Step 1: Write the failing test**

Create `src/services/task.service.test.ts` with tests that call `createTask` using `high`, `medium`, and `low` priorities and assert the returned task rows store values `10`, `5`, and `1`.

**Step 2: Run test to verify it fails**

Run: `bun test src/services/task.service.test.ts`
Expected: FAIL because `createTask` still uses submitted `value`.

**Step 3: Write minimal implementation**

Add a small priority-to-points mapping in `src/services/task.service.ts` and use it when building the insert payload for `createTask`.

**Step 4: Run test to verify it passes**

Run: `bun test src/services/task.service.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/services/task.service.ts src/services/task.service.test.ts
git commit -m "feat: auto-assign task points from priority"
```

### Task 2: Remove manual point entry from the create form

**Files:**
- Modify: `src/components/TaskInputForm.tsx`

**Step 1: Update the form**

Remove the numeric `value` input so parents no longer supply custom points at task creation.

**Step 2: Verify the rendered form still submits required fields**

Run the relevant UI tests if available, or run the app tests to ensure the form still renders and submits correctly.

**Step 3: Commit**

```bash
git add src/components/TaskInputForm.tsx
git commit -m "refactor: remove manual task points input"
```

### Task 3: Verify the change end to end

**Files:**
- Review: `src/services/task.service.test.ts`
- Review: `src/components/TaskInputForm.tsx`

**Step 1: Run focused verification**

Run: `bun test src/services/task.service.test.ts`
Expected: PASS

**Step 2: Run broader regression coverage**

Run: `bun test`
Expected: PASS or only unrelated pre-existing failures

**Step 3: Summarize results**

Document whether task creation now ignores submitted values and stores priority-based points only at creation time.

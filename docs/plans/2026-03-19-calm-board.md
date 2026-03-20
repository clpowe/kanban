# Calm Board Styling Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Restyle the task board into a calm, card-based DaisyUI dashboard while preserving the current Hono and HTMX behavior.

**Architecture:** Keep the current data flow and routes intact, and change only the rendered markup/classes in the shared layout and board components. The page shell will become a soft dashboard, status lanes will become responsive cards, task items will become stacked cards with badges and form controls, and the user summary will render as a companion card.

**Tech Stack:** Bun, Hono JSX, HTMX, Tailwind CSS 4, DaisyUI 5, Bun test

---

### Task 1: Add failing rendering tests for the calm board classes

**Files:**
- Create: `src/components/BoardStyling.test.tsx`

**Step 1: Write the failing test**

Add rendering tests that assert:
- `TaskInputForm` renders a card wrapper and DaisyUI form controls
- `TaskList` renders a responsive board grid and lane cards
- `UsersList` renders a summary card/list treatment

**Step 2: Run test to verify it fails**

Run: `bun test src/components/BoardStyling.test.tsx`
Expected: FAIL because the current markup is still mostly unstyled.

**Step 3: Write minimal implementation**

Update the relevant components to emit the expected card/grid/form classes.

**Step 4: Run test to verify it passes**

Run: `bun test src/components/BoardStyling.test.tsx`
Expected: PASS

**Step 5: Commit**

```bash
git add src/components/BoardStyling.test.tsx
git commit -m "test: cover calm board styling markup"
```

### Task 2: Restyle the page shell and task form

**Files:**
- Modify: `src/index.tsx`
- Modify: `src/components/Layout.tsx`
- Modify: `src/components/TaskInputForm.tsx`

**Step 1: Implement the shell**

Add a soft page background, width container, and dashboard spacing in the layout/index shell.

**Step 2: Implement the form**

Render the task entry form inside a card with DaisyUI `input`, `select`, and `btn` classes.

**Step 3: Run targeted tests**

Run: `bun test src/components/Layout.test.tsx src/components/BoardStyling.test.tsx`
Expected: PASS

### Task 3: Restyle the board lanes and task cards

**Files:**
- Modify: `src/components/TaskList.tsx`
- Modify: `src/components/TaskItem.tsx`

**Step 1: Implement lane cards**

Render the board as a responsive grid with one card per status lane.

**Step 2: Implement task cards**

Render each task as a card with title, badges, assignee text, DaisyUI controls, and a calmer status selector/delete action layout.

**Step 3: Run targeted tests**

Run: `bun test src/components/BoardStyling.test.tsx`
Expected: PASS

### Task 4: Restyle the user summary and verify end-to-end rendering

**Files:**
- Modify: `src/components/UserList.tsx`

**Step 1: Implement user summary card**

Render the user list as a card with per-user rows and point badges.

**Step 2: Run verification**

Run: `bun test src/components/Layout.test.tsx src/components/BoardStyling.test.tsx`
Expected: PASS

Run: `bun run build:css`
Expected: PASS

**Step 3: Inspect diff**

Run: `git diff -- src/index.tsx src/components/Layout.tsx src/components/TaskInputForm.tsx src/components/TaskList.tsx src/components/TaskItem.tsx src/components/UserList.tsx src/components/BoardStyling.test.tsx`
Expected: Only presentation and test changes for the calm board restyle.

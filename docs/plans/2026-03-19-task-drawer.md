# Task Drawer Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move the task creation form out of the board body and into a right-side DaisyUI drawer opened from the header.

**Architecture:** Keep task creation on the same `/tasks` HTMX endpoint and reuse the existing `TaskInputForm` component inside a layout-level drawer shell. The shared layout will host the drawer structure, the header will expose the trigger button for parent users, and the main board content will remain unchanged aside from removing the inline form placement.

**Tech Stack:** Bun, Hono JSX, HTMX, Tailwind CSS 4, DaisyUI 5, Bun test

---

### Task 1: Add a failing layout test for the task drawer

**Files:**
- Modify: `src/components/Layout.test.tsx`

**Step 1: Write the failing test**

Assert that the rendered layout includes:
- a `drawer drawer-end` shell
- a `task-drawer` toggle input
- an `Add Task` trigger in the header
- the task form rendered inside the drawer panel

**Step 2: Run test to verify it fails**

Run: `bun test src/components/Layout.test.tsx`
Expected: FAIL because the layout currently renders the form inline above the board.

**Step 3: Write minimal implementation**

Move the form into a layout-level drawer and wire the header trigger.

**Step 4: Run test to verify it passes**

Run: `bun test src/components/Layout.test.tsx`
Expected: PASS

### Task 2: Move the form into the drawer shell

**Files:**
- Modify: `src/index.tsx`
- Modify: `src/components/Layout.tsx`
- Modify: `src/components/UserSwitcher.tsx`
- Modify: `src/components/TaskInputForm.tsx`

**Step 1: Implement drawer shell**

Wrap the page content in a DaisyUI drawer and mount `TaskInputForm` into the drawer side.

**Step 2: Implement trigger**

Render an `Add Task` button in the header for parents only.

**Step 3: Adjust form presentation**

Keep the form styled for the drawer panel instead of as an inline page card.

**Step 4: Run verification**

Run: `bun test src/components/Layout.test.tsx src/components/BoardStyling.test.tsx`
Expected: PASS

Run: `bun run build:css`
Expected: PASS

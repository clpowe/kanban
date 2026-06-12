# Family Kanban SolidJS Migration Roadmap

This document serves as the official project board and TODO list for migrating the Family Kanban board from Hono JSX/HTMX to a client-side SolidJS SPA using Vite+ (`vp`).

---

## 📋 Project Status Checklist

### 🏁 Epic 1: Client Build and Architecture Setup
- [x] **Task 1.1**: Initialize Vite+ build tooling.
  - [x] Run `vp add -D vite-plugin-solid @types/node` to configure devDependencies.
  - [x] Add `solid-js` and `@solidjs/router` to `package.json` dependencies via `vp add`.
- [x] **Task 1.2**: Create `vite.config.ts` for SolidJS.
- [x] **Task 1.3**: Configure `tsconfig.json` to preserve JSX with SolidJS JSX import source.
- [x] **Task 1.4**: Update `package.json` scripts to run `vp dev` and `vp build`.
- [x] **Task 1.5**: Create the frontend base index HTML at `public/index.html`.
- [x] **Task 1.6**: Set up the Hono catch-all route inside `src/index.tsx` to authenticate and serve the built client bundle via `c.env.ASSETS`.

### 🔌 Epic 2: Backend REST JSON API Migration
- [x] **Task 2.1**: Refactor `/tasks` endpoint to `/api/tasks` returning JSON arrays instead of rendered TSX.
- [x] **Task 2.2**: Refactor `/rewards` endpoint to `/api/rewards` returning JSON arrays.
- [x] **Task 2.3**: Refactor `/users` endpoint to `/api/users` returning sorted user arrays in JSON.
- [x] **Task 2.4**: Migrate active user switching endpoint `/session/active-user` to return JSON status instead of issuing a full browser refresh headers.
- [x] **Task 2.5**: Update Task mutation endpoints (Create, Status Update, edit, delete) to receive JSON payloads and return JSON.
- [x] **Task 2.6**: Update Reward redemption endpoint to return JSON status.

### 🧠 Epic 3: Client State Management & Client Router
- [x] **Task 3.1**: Create `src/client/index.tsx` entry point to mount SolidJS to `#root`.
- [x] **Task 3.2**: Create reactive store (`src/client/store/app-store.ts`) using Solid's `createSignal`/`createStore` to manage all tasks, rewards, users, and the active session.
- [x] **Task 3.3**: Create fetch client hooks/functions to handle authenticated REST calls and update global store.
- [x] **Task 3.4**: Configure SolidJS router to manage paths (`/` for board, `/archived` for archived lists).

### 🎨 Epic 4: SolidJS Core Frontend Views
- [x] **Task 4.1**: Build `src/client/components/Layout.tsx` including active user points card, switcher, and drawer triggers.
- [x] **Task 4.2**: Build `src/client/components/Board.tsx` showing To Do, In Progress, and Done columns.
- [x] **Task 4.3**: Build `src/client/components/Archive.tsx` with filter dropdowns.
- [x] **Task 4.4**: Build `src/client/components/Drawers.tsx` for creation forms.
- [x] **Task 4.5**: Build `src/client/components/RewardList.tsx` supporting redeem triggers and disabled states.

### ✨ Epic 5: Polish & Interactions (Lovable Slice)
- [x] **Task 5.1**: Add smooth visual ticking transition/animations for points score changes.
- [x] **Task 5.2**: Add basic HTML5 drag-and-drop column transitions.
- [x] **Task 5.3**: Style clean form input focus states and slide-out drawer animations.

### 🚀 Epic 6: Authentication & Dashboard Enhancements
- [x] **Task 6.1**: Create glassmorphic login screen and configure Better Auth sessions.
- [x] **Task 6.2**: Add a dedicated Create Account (Register) screen with parent/child role selection.
- [x] **Task 6.3**: Implement a central Navigation Card dashboard component and simplify the header bar.

## 🛠️ Current Focus: All Completed

All migration and dashboard enhancement tasks are completed. Waiting for next instructions.

# User Switcher Design

**Date:** 2026-03-19

## Goal

Add a header control that lets the household switch the active app user between parents and children without re-entering passwords after the initial login.

## Current State

- The app uses `basicAuth` in `src/auth/middleware.ts`.
- The authenticated user is stored directly on the Hono request context as `authUser`.
- Authorization checks for creating, editing, deleting, and updating tasks all read that request-scoped `authUser`.
- The root page in `src/index.tsx` renders HTMX sections for task form, task list, and user list.

This means the visible user and the authorized user are currently the same thing, and they are both derived from the browser's HTTP Basic credentials.

## Chosen Approach

Keep Basic Auth as the initial gate, then create an app session cookie that stores the active in-app user.

### Session model

After a successful Basic Auth request:

- The server ensures a session cookie exists.
- The cookie stores:
  - `familyUserIds`: the set of users available to switch to in this household session
  - `activeUserId`: the user currently acting in the app

For this app, `familyUserIds` can be derived from the `users` table and can include every parent and child because the product is a shared family board.

### Request model

Each request will resolve:

- `loginUser`: the identity that passed Basic Auth on this request
- `activeUser`: the in-app identity from the session cookie, or `loginUser` if the cookie is missing

Authorization helpers and route handlers will switch from `authUser` to `activeUser`.

## UI Changes

Add a header component above the existing main content.

The header will show:

- The current active user name
- The active user role (`parent` or `child`)
- A select control listing every family member

Changing the select will submit to a new session route that updates `activeUserId`, then triggers HTMX refresh events for:

- the task composer area
- the task list
- the users list

This keeps parent-only controls and child-only permissions aligned with the selected user.

## Route Changes

Add a lightweight session route, likely:

- `PATCH /session/active-user`

Responsibilities:

- Read the selected user id from form data
- Validate the id exists and is allowed in the family session
- Persist the updated `activeUserId` to the session cookie
- Return the refreshed header fragment or an HTMX trigger response

## Component Changes

- `src/components/Layout.tsx`
  - Accept the active user and all users
  - Render the new header
- New header component
  - Encapsulate switcher UI and HTMX behavior
- `src/index.tsx`
  - Pass active user and users into layout
  - Keep existing task and user sections

## Auth Changes

- `src/auth/middleware.ts`
  - Preserve the Basic Auth check
  - Store the successful credential owner as `loginUser`
  - Resolve and store `activeUser`
- Add helpers to:
  - read/write signed cookie state
  - validate selected user ids
  - fall back safely when cookie state is absent or stale

## Testing Strategy

Follow TDD:

1. Add auth/session unit tests for resolving the active user and validating allowed switches.
2. Add route-level tests for changing the active user.
3. Implement the smallest session helpers needed to satisfy the tests.
4. Add component tests only if route/auth tests are insufficient to cover the new behavior.

## Risks

- Basic Auth credentials are still sent on every request, so the browser remains authenticated as the original login user. The app must consistently prefer `activeUser` for authorization decisions.
- A stale cookie could reference a removed user. The server must fall back to the login user or reject the switch cleanly.
- Parent-only UI must be refreshed immediately after user changes to avoid stale controls.

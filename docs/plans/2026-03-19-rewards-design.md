# Rewards Design

**Date:** 2026-03-19

## Goal

Let parents create rewards that live in a shared family catalog, and let children redeem those rewards by spending their points immediately.

## Current State

- The app already tracks points on `users.points`.
- Children earn points when assigned tasks move into `done`.
- The database already has a `rewards` table, but it only contains `name` and `value` and is not used anywhere in the app.
- The UI currently exposes task management and a child points summary, but no reward catalog or redemption controls.

## Chosen Approach

Add a simple shared reward catalog with immediate redemption.

### Catalog model

- Rewards belong to the family board as a whole.
- No reward is owned by a specific child.
- A reward stays available after redemption so multiple children can buy it over time.

### Redemption model

- A child can redeem a reward only when `user.points >= reward cost`.
- A successful redemption immediately subtracts the reward cost from that child’s point balance.
- There is no approval step.
- There is no redemption history in this version.

This keeps the first version aligned with the existing app: points are stored directly on the `users` row, and the feature only needs a catalog plus a controlled deduction path.

## Data Model Changes

Expand the existing `rewards` table so it cleanly represents a reward catalog.

- Keep one row per reward.
- Store a label for the reward and a numeric point cost.
- Do not add owner, assignee, or status columns.
- Do not add a redemptions table yet.

The implementation can either keep the existing `name` and `value` column names or rename them to reward-specific naming if that improves readability across the codebase.

## UI Changes

Add a rewards section to the main page alongside the current tasks and points areas.

### Parent experience

- Parents see a simple reward creation form.
- Parents can add rewards to the shared catalog.

### Child experience

- Children see the shared reward catalog.
- Each reward shows its point cost.
- Affordable rewards expose a redeem button.
- Unaffordable rewards render a disabled action state.

### Refresh behavior

After creating or redeeming a reward, the app should refresh the rewards section and the points section so both the catalog and balances stay current.

## Route and Service Changes

Add reward-specific service helpers and routes.

- Parent-only create endpoint for adding rewards.
- Child redemption endpoint that:
  - loads the reward
  - loads the active user
  - validates the user is a child
  - validates the user has enough points
  - subtracts the cost from that child’s points

Use the existing auth middleware and active-user session model so redemption is always performed by the currently selected child.

## Error Handling

- Parent-only routes should continue to return `403` for child users.
- Redemption attempts with insufficient points should fail cleanly without mutating the user balance.
- Missing reward ids should return a not-found style response.

The UI can keep the initial handling minimal as long as server-side validation is authoritative.

## Testing Strategy

Follow TDD in this order:

1. Add service tests for creating rewards and redeeming a reward with sufficient points.
2. Add a failing test for insufficient-point redemption.
3. Add route and component coverage for:
   - parent access to reward creation
   - child access to reward redemption
   - disabled child action when points are too low
4. Implement the minimum schema, service, route, and UI changes needed to satisfy the tests.

## Deferred Work

These are intentionally out of scope for this version:

- redemption history
- parent approval flows
- reward deletion or editing
- inventory limits
- child-specific reward assignment

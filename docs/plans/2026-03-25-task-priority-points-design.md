# Task Priority Points Design

**Date:** 2026-03-25

## Goal

Automatically assign task points when a task is created based on its priority.

## Current State

- Tasks store their point value in `tasks.value`.
- The create-task form currently allows a parent to enter a custom numeric value.
- The task service inserts the submitted `value` directly into the database.
- Changing a task status to `done` awards the stored `value` to the assignee.

## Chosen Approach

Compute the stored point value during task creation from the submitted priority.

- `high` priority tasks store `10`
- `medium` priority tasks store `5`
- `low` priority tasks store `1`

This mapping applies only when the task is created. Editing a task's priority later does not recompute or overwrite its stored point value.

## Enforcement Point

Enforce the mapping in the task service create path rather than in the route or UI.

- The service is the narrowest authoritative boundary before persistence.
- This keeps the rule applied even if another route or caller creates tasks later.
- The UI should still remove the manual points field so the form matches the server behavior.

## UI Changes

- Remove the `Points` input from the create-task form.
- Keep the priority selector unchanged.
- Continue showing the stored point badge on task cards.

## Data Model

- No schema changes are needed.
- `tasks.value` remains the stored numeric field used for score calculations.

## Error Handling

- Unknown or missing priority values should fall back to the existing valid enum flow and not introduce separate custom error handling in this change.
- The server-side mapping remains authoritative even if a client submits an unexpected `value`.

## Testing Strategy

Add task service tests that verify task creation stores:

1. `10` points for `high`
2. `5` points for `medium`
3. `1` point for `low`

The tests should confirm the stored `value` rather than only UI output.

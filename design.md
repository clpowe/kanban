# Design — Family Task

Status: restrained multi-view household workspace (2026-07-28).

Family Task combines Asana’s scan-friendly board density, ClickUp’s practical
view controls, and a docked task-detail inspector. The product is for a family
or small household that needs to see the week’s work quickly, change the level
of detail, and act on one task without losing the surrounding board.

## Tokens

- Cloud canvas: `#f8f7fb`
- Paper surface: `#ffffff`
- Ink: `#282531`
- Muted ink: `#706b7a`
- Periwinkle action: `#6658d9`
- Warm progress: `#c48831`
- Finished green: `#4d896b`
- Fine rule: `#dfdce6`

The interface uses Avenir Next where available for titles and the native UI
stack for controls and dense operational copy. Metadata stays small and quiet;
color identifies state instead of decorating the canvas.

## Layout

The project header owns the Board, List, and Archive views. A compact toolbar
supports search, assignee and priority filters, sorting, compact cards, and
optional streak progress. The board retains three honest household states—To
do, In progress, and Done—on softly tinted columns with light, concise cards.

Selecting a task docks a working inspector to the right edge. The board remains
visible while a parent edits title, state, assignee, priority, or recurrence;
children get the same context with a focused next action. On small screens the
inspector becomes a full-height sheet.

## Signature interaction

The task inspector is the single expressive moment. It slides into the shared
workspace like opening a working document, then stays spatially attached to the
board instead of interrupting the user with a modal.

## Interaction

- Cards remain draggable between active status columns.
- Board and list views share the same live filters.
- Parents can edit and delete from the inspector or add through the existing
  task dialog.
- Compact cards and streak visibility are real per-session view options.
- Controls retain visible keyboard focus and motion is reduced when requested.

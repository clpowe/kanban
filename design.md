# Design — Family Task

Status: GitHub Projects-inspired board system (2026-07-19).

Family Task uses the information density and interaction conventions of a
GitHub Projects board without copying GitHub branding. The visual language is
quiet and operational: cool canvas neutrals, thin borders, compact controls,
status dots, small metadata labels, and horizontally scrolling board columns.

## Tokens

- Canvas: `#f6f8fa`
- Surface: `#ffffff`
- Inset surface: `#f0f3f6`
- Foreground: `#1f2328`
- Muted foreground: `#656d76`
- Border: `#d0d7de`
- Accent: `#0969da`
- Success: `#1a7f37`
- Attention: `#9a6700`
- Danger: `#cf222e`

The body uses the native system UI stack so controls feel at home on every
device. IDs, counts, and task metadata use a monospace utility stack.

## Layout

The global rail behaves like a repository header. The board begins with a
breadcrumb, project identity, view tabs, and an assignee toolbar. The original
three columns—To do, In progress, and Done—stay compact and independently
scannable, with cards that expose title, labels, assignee, streak progress, and
the existing next action.

The signature element is the workload strip above the columns. Every small
segment represents one visible task and carries its real status color, giving
families a glanceable picture of work distribution without adding a chart.

## Interaction

- Cards remain draggable between all active status columns.
- Assignee filtering remains available in the board toolbar.
- Parents open the existing task dialog from the global rail.
- Controls have visible keyboard focus, and motion is reduced when requested.

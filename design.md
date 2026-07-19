# Design — Family Task

Status: intentionally unstyled (2026-07-18, user request).

All theming was stripped to bare bones: no colors, no fonts, no layout system.
`src/styles/app.css` contains only the rules the app needs to function
(screen-reader-only hiding and the add-task drawer's checkbox show/hide).
Tailwind, DaisyUI, Google Fonts, tokens.css, and the character-avatar layer
were removed from the build. Browser defaults everywhere else.

Note for future design passes: utility classes (Tailwind/DaisyUI) are still
present in component markup but are inert — the CSS build no longer includes
those frameworks. Re-adding `@import "tailwindcss"` and the DaisyUI plugin to
`src/styles/app.css` re-activates them.

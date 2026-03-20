# DaisyUI Integration Design

## Summary

Add DaisyUI to the existing Hono + Cloudflare Workers project without restyling the current UI. The goal is to establish a stable CSS pipeline so future component work can use Tailwind CSS 4 utilities and DaisyUI classes.

## Current State

- The app is server-rendered from Hono JSX.
- There is no Tailwind configuration or CSS build pipeline.
- Layout markup is emitted from `src/components/Layout.tsx`.
- Wrangler is configured through `wrangler.jsonc`.

## Selected Approach

Use Tailwind CSS 4 with DaisyUI 5, compile a single CSS entry file into a static asset directory, and serve that directory via Wrangler assets. Link the generated stylesheet from the shared layout component.

## Why This Approach

- It matches DaisyUI's current installation model.
- It keeps CSS delivery explicit and compatible with the existing server-rendered app.
- It avoids premature UI refactors while making DaisyUI available immediately.

## Implementation Notes

- Install `tailwindcss`, `@tailwindcss/cli`, and `daisyui`.
- Create `src/styles/app.css` with Tailwind and DaisyUI directives.
- Add build scripts that compile to `public/app.css`.
- Configure Wrangler static assets to serve `public/`.
- Add a stylesheet link in `Layout`.
- Add or update a test that confirms the layout includes the compiled stylesheet.

## Risks

- Dependency installation requires network access.
- If Wrangler asset serving is misconfigured, the stylesheet may compile successfully but not be served.

## Validation

- Run the layout test and confirm it fails before the stylesheet link is added.
- Re-run the layout test after the change and confirm it passes.
- Run the CSS build and confirm `public/app.css` is produced.

# Design — Family Task

A locked visual system for the whole app. Route-level design changes extend this
system instead of inventing local themes.

## Product context

- Audience: parents and children sharing household work.
- Primary job: see today’s work, move one task forward, understand progress.
- Tone: soft, warm, grown-up playful; never toy-like.

## Genre

Playful-soft. Friendly surfaces and direct language, with restrained motion and
adult typography.

## Macrostructure family

- Auth pages: Split Studio — one concise brand statement beside one form.
- App pages: Bento Grid — broad, asymmetric work zones sized by importance.
- Content pages: not currently present.

## Navigation

N3 Household rail. Desktop routes live in a slim persistent side rail. Mobile
routes use a native `<details>` disclosure in document flow.

## Footer

Ft2 Inline rule. One quiet sentence closes each app route.

## Signature

Real task counts become small bubble matrices. They echo the supplied reference
without copying its content or inventing metrics.

## Theme

Single light theme:

- `--color-paper`: oklch(91% 0.028 48)
- `--color-paper-2`: oklch(95% 0.018 58)
- `--color-paper-3`: oklch(98% 0.009 72)
- `--color-ink`: oklch(19% 0.018 42)
- `--color-ink-2`: oklch(32% 0.020 42)
- `--color-rule`: oklch(83% 0.022 52)
- `--color-accent`: oklch(53% 0.105 125)
- `--color-focus`: oklch(47% 0.175 245)

Pastel blue, yellow, coral, and mint are semantic status surfaces, not competing
brand accents.

## Typography

- Display: Bricolage Grotesque, weight 700, roman.
- Body: Geist, weight 400.
- Data uses tabular figures from Geist; no third family.
- Display tracking: -0.035em.
- Type scale: major-third, with `--text-display` capped at 4.75rem.

## Spacing

4-point named scale in `tokens.css`. Components use named tokens; isolated 1px
optical adjustments are allowed.

## Motion

- Easings: `--ease-out`, `--ease-in`, `--ease-in-out`.
- Button press and task-drag feedback only.
- No decorative entrance sequence or infinite motion.
- Reduced motion: state changes become opacity-only at 120ms.

## Native interaction stance

- Task creation: native `<dialog>` with Escape, backdrop, and explicit close.
- Mobile navigation: native `<details>`.
- Choice controls: native `<select>`, checkbox, and radio elements.
- Progress: native `<progress>` and `<meter>`.
- Destructive deletion: browser-native confirmation.
- Success is visible in place; no celebratory toast.

## CTA voice

- Primary: dark ink fill, compact rounded rectangle, specific verb.
- Secondary: transparent surface with a hairline rule.
- Clickable labels stay on one line.

## CSS structure

- One semantic class at a component or page root.
- Native elements styled through nesting beneath that root.
- Utility wrappers allowed when they control real layout.
- Maximum nesting depth: two levels.
- No BEM names, framework utilities, or redundant text wrappers.

## Per-page allowances

- App pages use function as visual content; no decorative illustration.
- Auth pages may use the bubble matrix as a small CSS-built signature.
- Route data remains factual and live; no invented metrics.

## What pages must share

- Household rail and mobile disclosure.
- Peach field, off-white work surfaces, and olive active signal.
- Bricolage Grotesque + Geist.
- Control height, focus ring, radius, and spacing rhythm.
- Native overlay and disclosure behavior.

## What pages may differ

- Bento spans and panel order.
- One semantic status tint per functional region.
- Density: board and analytics may be denser than auth and settings.

## Exports

`tokens.css` is the implementation source of truth. Remaining formats are
portability references only; Tailwind and shadcn are not runtime dependencies.

### tokens.css

```css
:root {
  --color-paper: oklch(91% 0.028 48);
  --color-paper-2: oklch(95% 0.018 58);
  --color-paper-3: oklch(98% 0.009 72);
  --color-ink: oklch(19% 0.018 42);
  --color-ink-2: oklch(32% 0.020 42);
  --color-rule: oklch(83% 0.022 52);
  --color-accent: oklch(53% 0.105 125);
  --color-accent-ink: oklch(98% 0.009 72);
  --color-focus: oklch(47% 0.175 245);
  --font-display: "Bricolage Grotesque", "Trebuchet MS", sans-serif;
  --font-body: "Geist", "Avenir Next", sans-serif;
  --space-xs: 0.5rem;
  --space-sm: 0.75rem;
  --space-md: 1rem;
  --space-lg: 1.5rem;
  --space-xl: 2.5rem;
  --radius-card: 1.75rem;
  --radius-input: 0.75rem;
  --radius-pill: 999px;
}
```

### Tailwind v4 `@theme` portability reference

```css
@theme {
  --color-paper: oklch(91% 0.028 48);
  --color-paper-2: oklch(95% 0.018 58);
  --color-paper-3: oklch(98% 0.009 72);
  --color-ink: oklch(19% 0.018 42);
  --color-accent: oklch(53% 0.105 125);
  --font-display: "Bricolage Grotesque", sans-serif;
  --font-body: "Geist", sans-serif;
  --spacing-md: 1rem;
  --radius-card: 1.75rem;
}
```

### DTCG tokens.json

```json
{
  "$schema": "https://design-tokens.github.io/community-group/format/",
  "color": {
    "paper": { "$value": "oklch(91% 0.028 48)", "$type": "color" },
    "paper-2": { "$value": "oklch(95% 0.018 58)", "$type": "color" },
    "paper-3": { "$value": "oklch(98% 0.009 72)", "$type": "color" },
    "ink": { "$value": "oklch(19% 0.018 42)", "$type": "color" },
    "accent": { "$value": "oklch(53% 0.105 125)", "$type": "color" },
    "focus": { "$value": "oklch(47% 0.175 245)", "$type": "color" }
  },
  "font": {
    "display": { "$value": "Bricolage Grotesque, sans-serif", "$type": "fontFamily" },
    "body": { "$value": "Geist, sans-serif", "$type": "fontFamily" }
  },
  "space": {
    "md": { "$value": "1rem", "$type": "dimension" },
    "lg": { "$value": "1.5rem", "$type": "dimension" }
  }
}
```

### shadcn/ui portability reference

```css
:root {
  --background: 91% 0.028 48;
  --foreground: 19% 0.018 42;
  --card: 98% 0.009 72;
  --card-foreground: 19% 0.018 42;
  --primary: 53% 0.105 125;
  --primary-foreground: 98% 0.009 72;
  --secondary: 95% 0.018 58;
  --secondary-foreground: 32% 0.020 42;
  --muted: 83% 0.022 52;
  --muted-foreground: 42% 0.020 42;
  --border: 83% 0.022 52;
  --input: 83% 0.022 52;
  --ring: 47% 0.175 245;
  --radius: 1.75rem;
}
```

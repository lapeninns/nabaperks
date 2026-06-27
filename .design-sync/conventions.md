# Wet Ink — building with this design system

Wet Ink is the design language of **Nabaperks**, a loyalty stamp-card product for
independent counter-service venues (coffee shops, cafés). The look is
**riso-print / rubber-stamp**: warm paper, flat spot inks, **hard offset shadows
(never blurred)**, and a slight hand-stamped tilt. Build on-brand by composing
these real components and styling layout glue with the semantic token utilities
below — never reach for raw hex or generic grays.

## Setup & wrapping
- **Import the design system's `styles.css`** once at the root. It carries the
  Wet Ink tokens, the brand fonts (**Bricolage Grotesque** for text/headings,
  **Space Mono** for uppercase meta), and the compiled component CSS. Without it
  everything renders unstyled.
- **Most components are self-contained** — no provider needed. Two exceptions:
  - `Sidebar` and its parts must be wrapped in **`SidebarProvider`** (it reads
    context via `useSidebar`; unwrapped it throws).
  - `Toaster` is the toast *region* — mount it **once** near the root. Fire
    notifications imperatively with `toast(...)` from the `sonner` package
    (the trigger is not part of this bundle; the region is).
- **Dark mode**: add the `dark` class to an ancestor (`<html class="dark">`). The
  tokens below automatically resolve to their dark values; no theme provider.

## Styling idiom — Tailwind v4 utilities on Wet Ink tokens
Style with these **semantic** utility families (all verified in the shipped CSS).
Prefer component props first; use these for your own layout glue.

| Purpose | Utilities |
|---|---|
| Surfaces | `bg-paper`, `bg-paper-deep`, `bg-card`, `bg-secondary`, `bg-muted`, `bg-accent` |
| Spot inks (fills) | `bg-primary`/`bg-stamp` (vermillion), `bg-reward` (leaf green), `bg-seal` (sun amber), `bg-destructive` |
| Text | `text-ink`, `text-ink-soft`, `text-foreground`, `text-muted-foreground`, `text-primary` (+ `*-foreground` on inks) |
| Borders | `border-border`, `border-input`, `border-ink` |
| **Hard offset shadows** | `shadow-xs`, `shadow-sm`, `shadow-md` — Wet Ink's signature, **never** `shadow-lg`-blur or `drop-shadow` |
| Type | `font-sans`/`font-heading` (Bricolage Grotesque), `font-mono` (Space Mono — uppercase meta/eyebrows) |
| Radius | `rounded-full` (pills, stamps) or arbitrary `rounded-[min(var(--radius-4xl),24px)]` for cards |

Domain accent meaning is consistent: **vermillion = primary/stamp**, **leaf
green = reward/ready**, **sun amber = sealed/mystery**. Keep redemptions green,
mysteries amber, primary actions vermillion.

## Where the truth lives
- Each component ships a **`<Name>.prompt.md`** (usage + examples) and
  **`<Name>.d.ts`** (`<Name>Props` API contract) — read these before composing.
- **`DESIGN.md`** (in guidelines) is the full token/typography/spacing spec.
- Read the bound **`styles.css`** for the exact token values.

## Idiomatic example
```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent, StampGrid, Button } from "<design-system>"

// A member card: real components for structure, Wet Ink tokens for glue.
<Card className="max-w-md">
  <CardHeader>
    <CardTitle>Bridge Street Coffee</CardTitle>
    <CardDescription className="font-mono text-xs uppercase text-ink-soft">
      7 of 8 stamps · 1 to go
    </CardDescription>
  </CardHeader>
  <CardContent className="grid gap-4">
    <StampGrid current={7} total={8} rewardSlot="locked" venueInitials="BS" />
    <Button variant="reward" disabled>Redeem free flat white</Button>
  </CardContent>
</Card>
```

# WetInk (nabaperks@0.0.1)

This design system is the published nabaperks React library, bundled as a single
browser global. All 47 components are the real upstream code.

## Where things are

- `_ds_bundle.js` — the whole-DS bundle at the project root; loads every component to `window.WetInk`. First line is a `/* @ds-bundle: … */` metadata header.
- `styles.css` — the single stylesheet entry: it `@import`s the tokens, fonts, and component styles (`_ds_bundle.css`). Link this one file.
- `components/<group>/<Name>/<Name>.prompt.md` (example JSX + variants), `<Name>.d.ts` (types), `<Name>.html` (variant grid).
- `tokens/*.css` — CSS custom properties, names verbatim from upstream.
- `fonts/` — `@font-face` files + `fonts.css` (when the package ships fonts).
- `guidelines/` — the design system's own usage guidance (1 doc(s), see `guidelines/index.md`). Read these before composing larger layouts.

For a specific component, `read_file("components/<group>/<Name>/<Name>.prompt.md")`.

## Loading

Add these two lines to your page once (React must be on the page first):

```html
<link rel="stylesheet" href="styles.css">
<script src="_ds_bundle.js"></script>
```

Components are then available at `window.WetInk.*`. Mount into a dedicated child node (e.g. `<div id="ds-root">`), not the host page's own React root, so the two trees don't collide:

```jsx
const { ActivityFeed } = window.WetInk;
ReactDOM.createRoot(document.getElementById('ds-root')).render(<ActivityFeed />);
```

## Tokens

208 CSS custom properties from nabaperks. Names are
preserved verbatim from upstream. They are declared inside `_ds_bundle.css` (this DS ships one compiled stylesheet rather than separate token files).

- **color** (34): `--color-black`, `--color-white`, `--text-xs`, …
- **spacing** (5): `--tw-ring-inset`, `--tw-inset-shadow`, `--tw-inset-shadow-alpha`, …
- **typography** (14): `--font-sans`, `--font-mono`, `--font-weight-normal`, …
- **radius** (4): `--radius-lg`, `--radius-4xl`, `--radius`, …
- **shadow** (7): `--tw-shadow`, `--tw-ring-shadow`, `--tw-ring-offset-shadow`, …
- **other** (144): `--spacing`, `--container-xs`, `--container-sm`, …

## Components

### data
- `ActivityFeed`
- `DataTable`
- `FunnelChart`

### general
- `Alert`
- `Badge`
- `Button`
- `Card`
- `Empty`
- `Field`
- `Input`
- `InputGroup`
- `InputOTP`
- `Label`
- `Progress`
- `Separator`
- `Sheet`
- `Sidebar`
- `Skeleton`
- `Spinner`
- `Table`
- `Tabs`
- `Textarea`
- `Toaster`

### brand
- `EmptyState`
- `Eyebrow`
- `Icon`
- `Logo`
- `MetricTile`
- `MonoTag`
- `PageTitle`
- `ReceiptCard`
- `SectionHeader`
- `VenueMark`

### forms
- `FormField`
- `FormMessage`
- `OtpInput`

### loyalty
- `ProgressTrack`
- `QrFrame`
- `RewardCelebration`
- `RewardChip`
- `RewardSeal`
- `RewardTeaser`
- `RewardTicket`
- `StampDot`
- `StampGrid`
- `StampJourneyPreview`
- `StatusBanner`

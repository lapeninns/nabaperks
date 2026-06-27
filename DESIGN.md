---
name: Wet Ink (Honey & Ink v2)
colors:
  paper: "#f6f1e6"
  paper-deep: "#ece5d4"
  card: "#fbf8f1"
  ink: "#211c16"
  ink-soft: "#4f473d"
  line: "rgba(33, 28, 22, 0.18)"
  accent-vermillion: "#cf330a"
  on-accent: "#ffffff"
  cobalt: "#2b43c8"
  leaf: "#16733c"
  sun: "#f5a623"
  destructive: "#c0301c"
  background: "#f6f1e6"
  foreground: "#211c16"
  primary: "#cf330a"
  on-primary: "#ffffff"
  stamp: "#cf330a"
  stamp-empty: "rgba(33, 28, 22, 0.18)"
  seal: "#f5a623"
  reward-ready: "#16733c"
  qr: "#111111"
  qr-bg: "#ffffff"
typography:
  marketing-hero:
    fontFamily: Bricolage Grotesque
    fontSize: 56px
    fontWeight: "800"
    lineHeight: "1.05"
    letterSpacing: "-0.01em"
  page-title:
    fontFamily: Bricolage Grotesque
    fontSize: 34px
    fontWeight: "800"
    lineHeight: "1.05"
  card-title:
    fontFamily: Bricolage Grotesque
    fontSize: 21px
    fontWeight: "800"
  body:
    fontFamily: Bricolage Grotesque
    fontSize: 15px
    fontWeight: "500"
    lineHeight: 22px
  small:
    fontFamily: Bricolage Grotesque
    fontSize: 13.5px
    fontWeight: "500"
  mono-meta:
    fontFamily: Space Mono
    fontSize: 11.5px
    fontWeight: "700"
    letterSpacing: "0.06em"
    textTransform: uppercase
  mono-id:
    fontFamily: Space Mono
    fontSize: 10px
    fontWeight: "400"
rounded:
  sm: 4px
  md: 6px
  DEFAULT: 10px
  sheet: 18px
  stamp: 9999px
spacing:
  base: 4px
  card-gap: 14px
  section-gap: 22px
  max-width-customer: 410px
  max-width-merchant: 1060px
  max-width-marketing: 1100px
  tap-target-min: 44px
elevation:
  shadow: "4px 4px 0 ink"
  shadow-sm: "3px 3px 0 ink"
  shadow-pressed: "1px 1px 0 ink"
motion:
  ease: "cubic-bezier(0.2, 0, 0, 1)"
  ease-slam: "cubic-bezier(0.16, 1.2, 0.3, 1)"
  press: 90ms
  move: 320ms
  slam: 380ms
---

## Brand & Style

**Aesthetic — Wet Ink.** Riso-print / rubber-stamp tactility for local
counter-service businesses: flat spot inks on warm paper, hard offset shadows,
perforated receipt edges, rotated stamp marks. The product's core verb —
_stamping_ — is the entire visual language. This is v2 of the design system;
v1 "Honey & Ink" (warm cream / honey amber / pill shapes) is superseded, but
its token names survive as compatibility aliases.

**Voice:** plain, warm, **British** (en-GB). The product talks like a good
barista, not a SaaS.

**Source of truth:** production tokens, wrappers, and route composition are the
authoritative design system. The old downloaded Honey & Ink source package is
not required at runtime and is no longer mirrored in the repo; use this guide,
`app/globals.css`, `components/brand`, and `components/customer` as the
implementation references.

- **Value before friction, in copy too.** "Your first stamp is waiting."
  leads; signup language is banned — it's "Keep your card", "Save my card",
  "one text, no password". Never "register", "create an account".
- **Celebrate in few words.** "That's one." · "Enjoy." Short declaratives at
  emotional peaks; **no exclamation marks, no emoji**.
- **Receipt voice** (Space Mono, uppercase) for facts: "CARD Nº OC-0248",
  "ONE STAMP PER BUSINESS DAY". Spoken voice (Bricolage) for everything human.
  Never mix registers in one line.

## Colors

Riso-print logic: one paper, one ink, a small set of hot spot inks.

- **Paper (`--w-paper` #f6f1e6):** the page background — warm paper, never
  white. Deeper paper (`--w-paper-2` #ece5d4) for wells and tints.
- **Card (`--w-card` #fbf8f1):** the receipt surface, lifted off the paper.
- **Ink (`--w-ink` #211c16):** warm near-black for text, borders, shadows.
  Secondary text is `--w-ink-soft`; hairlines and dashed rules use `--w-line`.
- **Spot inks:** vermillion accent (#cf330a — THE action/stamp ink,
  themeable), cobalt (#2b43c8 — info, joins), leaf (#16733c — success,
  ready-to-redeem), sun (#f5a623 — the mystery seal).
- **QR codes always sit on pure white** inside an ink-bordered frame, even in
  dark mode. No gradients except functional ones (zigzag edge, conic ring).

All shadcn semantic tokens (`--background`, `--primary`, `--muted`, …) alias
the `--w-*` palette in `app/globals.css`, and the v1 token names
(`--paper-cream`, `--espresso-ink`, `--soft-mint`, `--fresh-green`) are kept
as remapped compatibility aliases.

## Typography

- **Bricolage Grotesque** for everything spoken. Headings are always **800**
  with tight leading and slight negative tracking on display sizes. Body is
  weight 500.
- **Space Mono** for everything printed — IDs, codes, dates, eyebrows, feeds,
  metadata. Eyebrows/kickers are short mono uppercase with 0.06em tracking
  (use the `.eyebrow` utility): "SCANNED AT THE COUNTER".

Both families are served through `next/font/google` as
`--font-bricolage-grotesque` and `--font-space-mono`.

## Shapes

Sharp-ish print shapes. **10px radius** (`--radius`) on buttons, inputs,
cards, and keys; **18px** (`--radius-sheet`) on bottom sheets and large
panels. **Full circles are reserved for the stamp family** — stamps, seals,
marks — always rotated -6° to -8°. Borders are **2px solid ink** everywhere;
**2px dashed** (`.w-rule`) for empty slots, receipt rules, and demo chrome.
The mono pill `.w-tag` is the only pill shape outside the stamp family.

## Elevation & Depth

**Hard offset shadows, never blurred.** The Tailwind shadow scale is remapped
in `globals.css`: `shadow-md` is 4px 4px 0 ink (cards), `shadow-sm` 3px 3px 0
(buttons, small surfaces), collapsing to 1px 1px 0 plus a translate on press.

- _Press_ — the shadow collapses into the paper (the system-wide signature):
  the element translates toward its shadow while the offset shrinks.
- _Disabled_ — 45–50% opacity. _Focus_ — vermillion ring.
- Transparency is for scrims only (`rgba(33,28,22,0.5)` under sheets). No
  glassmorphism, no photography; the optional paper grain
  (`<body data-grain="true">`) is the only texture.

## Layout & Spacing

4px base unit. 14px gaps between cards, 22px between sections. Customer
column max ~410px (thumb zone), merchant 1060px, marketing 1100px. Primary
tap targets ≥ 44px (buttons h-11+, PIN keys 60px). Mobile-first, touch-first —
hover effects are minimal.

## Motion

One slam easing (overshoot, `cubic-bezier(0.16, 1.2, 0.3, 1)`) for stamps; one
standard easing (`--w-ease`) for everything else. Press 90ms; sheets/moves
320ms; stamp slam 380ms plus a 300ms paper shake (`--w-dur-shake`).

**Motion lives in Framer Motion, not CSS.** The vocabulary is the `WetInk*`
primitive library in [`components/motion/wet-ink.tsx`](components/motion/wet-ink.tsx),
which reads its timing from [`lib/motion/tokens.ts`](lib/motion/tokens.ts):
`WetInkRise`, `WetInkSlam`, `WetInkSoftStamp`, `WetInkShake`, `WetInkPop`,
`WetInkWiggle`, `WetInkRipple`, `WetInkMarquee`, `WetInkSheet`, plus the composed
`StampSlamSequence` (slam + paper shake). **Production code never uses raw
`animation: w-*` or `animate-[w-*]`** — those CSS keyframes were removed; reach
for a `WetInk*` primitive instead. The press tilt (`.pressable`) stays in
`globals.css`, and the resting stamp tilt is seeded per slot via `--stamp-rot`.
Every primitive renders static children under `prefers-reduced-motion` (no
opacity blanking), and a global reduce rule neutralises any residual animation.

## Iconography

**Icon library = [@hugeicons](https://hugeicons.com) (the free set).** Render
every icon through the brand `Icon` wrapper (`components/brand/icon.tsx`), which
applies the house defaults — 2px stroke, `currentColor`, decorative
(`aria-hidden`) unless given a `label`. Pull glyphs from
`@hugeicons/core-free-icons` and prefer the shared semantic maps in
`components/brand/icons.ts` (`STATUS_ICON`, `ACTIVITY_CATEGORY_ICON`) so the same
meaning always reaches for the same glyph.

The **✱** disc remains the brand signature: it is the wordmark/logo (`Logo`, the
customer-flow header, the marquee), **not** a general-purpose icon — do not swap
it for a Hugeicons glyph. Everything else functional (navigation, buttons, stamp
fills, reward seals, status pills, empty states, the activity feed) uses
`Icon`. Status dots and the dashed empty-slot ring stay as structural CSS.
**Emoji are never used; no exclamation marks** (these tone rules are unchanged).

## Components

The shadcn primitives in `components/ui/` are **not** edited for visual
styling. Wet Ink treatments are applied through theme tokens and the
unlayered "Wet Ink layer" in `app/globals.css`, which targets the primitives'
`data-slot` attributes (button, card, input, textarea, badge, sheet). Keep it
that way: restyle via tokens, the ink layer, wrapper components, or
project-specific variants.

**Layer precedence.** The Wet Ink `[data-slot=…]` block sits deliberately
*outside* any `@layer`, so under Tailwind v4 it beats every layered utility
regardless of specificity. A utility such as `rounded-full` or `shadow-lg`
dropped on a themed primitive will therefore not override it — restyle through a
token, a wrapper, or a variant instead.

**Foundation layer & import rules.** Surface code composes from the foundation
wrappers, never raw shadcn or inline keyframes:

- **Brand** (`components/brand`): `Logo`, `MonoTag`, `ReceiptCard` (`edge`,
  `rotated`, `shaken` props), `VenueMark`, `Eyebrow`/`PageTitle`/`SectionHeader`/
  `MetricTile`/`EmptyState`, and the `Icon` wrapper over `@hugeicons`.
- **Loyalty** (`components/loyalty`): the one stamp/reward vocabulary —
  `StampGrid`/`StampDot`, `RewardChip`, `RewardSeal` (one seal, 3 sizes, 4
  states), `RewardTicket`, `ProgressTrack`, `QrFrame`, `StatusBanner`,
  `RewardCelebration`. The pint reward is retired.
- **Motion** (`components/motion`): the `WetInk*` primitives only (see Motion
  above) — never raw `animation: w-*` / `animate-[w-*]`.
- **Forms / data** (`components/forms`, `components/data`): `FormField`,
  `OtpInput`, `DataTable`, `ActivityFeed`, `FunnelChart`.

Composed patterns: `StampSlamSequence` (slam + paper shake on a `ReceiptCard
shaken`), the `RewardSeal`/`RewardTicket` state machine, and the merchant
loading skeletons that mirror real surface structure. The live reference for
every token, primitive, and loyalty state is the
[`/dev/design-system`](app/dev/design-system/page.tsx) catalog.

### Buttons

2px ink border, 10px radius, weight 700, hard 3px offset shadow. On press the
button translates 2px toward its shadow and the shadow collapses to 1px.
Ghost and link variants stay flat. Primary is vermillion with white text.

### Cards

Card surface (#fbf8f1) with a 2px ink border, 10px radius, and a hard 4px
offset shadow (`.surface-card` for plain elements). Card titles are weight 800. Receipt-style surfaces can add the `.receipt-edge` perforated zigzag.

### Console data tables & record cards

Admin and merchant consoles list dense records through `DataTable`
(`components/data/data-table.tsx`). The default render is a semantic
`<table>` on a `.surface-card` — keep it as a plain table when the rows are
short and stay within a desktop column. When a table is reused on the
admin consoles, where the same data must read on a phone, opt into the
responsive renderer by passing a `mobileCard` (and an optional
`mobileClassName`):

- **Breakpoint.** The single switch is `sm`. Below `sm` the component renders a
  stacked card list (`sm:hidden`); at `sm` and above it renders the semantic
  table (`hidden sm:block`). This replaces a horizontally scrolling
  `overflow-x-auto` table on phones with a readable card per row. The
  `emptyState` is shared and prints in both modes; the `caption`
  labels both the table (`<caption class="sr-only">`) and the mobile list
  (`aria-label`). Omitting `mobileCard` leaves the DOM and classes exactly as
  the plain table, so the opt-in never regresses existing tables.

- **`AdminRecordCard`** (`components/admin/record-card.tsx`) is the shared
  renderer returned from `mobileCard`. Its API is
  `{ title, eyebrow?, status?, fields: { label, value, mono? }[], action? }` on
  a Wet Ink `.surface-card`: an optional `eyebrow`, a bold `title`, an optional
  `status` row (a `StatusPill`/`MonoTag`), then stacked label/value `fields`
  that mirror the desktop columns (`mono: true` for ids and codes). It echoes
  the per-record cards already on the admin merchants ("QR records") and privacy
  ("Data request workflow") pages.

- **Support actions belong in the card body.** Any per-row action — a stamp
  adjustment form, a data-request control — goes in the card's `action` slot
  (full-width at the bottom), never off to the side. On a phone the card is the
  whole row, so the action stays reachable without horizontal scroll. The admin
  customers table is the reference: its `mobileCard` returns an `AdminRecordCard`
  whose `action` is the same `StampAdjustmentForm` rendered in the desktop
  column.

This responsive pair is shared by 7+ admin tables — customers, merchants,
fraud, billing, audit, pilot, and privacy — which is why the mobile renderer
and the record card are one abstraction rather than per-page markup. The live
example is the **Console data** section of the
[`/dev/design-system`](app/dev/design-system/page.tsx) catalog.

### Stamps & Grids

Earned stamps are solid vermillion circles with white marks; empty slots are
dashed ink-line circles. Stamp-family marks rotate -6°. The stamp slam uses
`WetInkSlam` (overshoot easing, scale/opacity only — the disc keeps its
`--stamp-rot` resting tilt), wrapped by `StampSlamSequence` so the receipt
shudders via `WetInkShake`.

### Inputs

Card-background wells with 2px ink borders and 10px radius. OTP boxes are
ink-bordered card cells where the hard shadow acts as the cursor.

### Sheets

Bottom sheets (the counter moment — PIN pad on the customer's phone) use the
18px top radius, 2px ink top border, and rise over an ink scrim.

### Badges & Tags

Mono uppercase pills (Space Mono, 11px, 0.08em tracking) — status semantics
come from the spot inks: vermillion stamp, sun reward, cobalt join, leaf
redeem.

### QR Codes

Always QR ink (#111) modules on a pure white, ink-bordered frame — in both
themes. The QR is a functional graphic, never decorated.

### Progress

Track is deeper paper; fill is leaf (`--reward`) for reward progress.

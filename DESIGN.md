---
name: Wet Ink (Honey & Ink v2)
colors:
  paper: "#f6f1e6"
  paper-deep: "#ece5d4"
  card: "#fbf8f1"
  ink: "#211c16"
  ink-soft: "#4f473d"
  line: "rgba(33, 28, 22, 0.18)"
  line-strong: "rgba(33, 28, 22, 0.5)"
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
    fontSize: "30px (mobile) / 36px (sm+)"
    fontWeight: "800"
    lineHeight: "1.05"
  card-title:
    fontFamily: Bricolage Grotesque
    fontSize: 16px
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
    fontWeight: "700"
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
  max-width-merchant: 1152px
  max-width-marketing: 1152px
  max-width-marketing-chrome: 1280px
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
v1 "Honey & Ink" (warm cream / honey amber / pill shapes) is fully superseded;
its v1 token aliases have been removed from `app/globals.css` (no consumers).

**Voice:** plain, warm, **British** (en-GB). The product talks like a good
barista, not a SaaS.

**Source of truth:** production tokens, wrappers, and route composition are the
authoritative design system. The old downloaded Honey & Ink source package is
not required at runtime and is no longer mirrored in the repo; use this guide,
`app/globals.css`, `components/brand`, and `components/customer` as the
implementation references.

- **Value before friction, in copy too.** "Your first stamp is waiting."
  leads; **in the customer lane** signup language is banned — it's "Keep your
  card", "Save my card", "one text, no password". Never "register", "create an
  account". `customer-join-frictionless-ux` pins that wording on the join form.

  The ban is scoped to the customer lane on purpose (DS 05#56). A merchant is
  opening a business account with an email and a password; "Save my card" would
  be untrue there, and "Create account" is the plain description of what the
  button does. Applying the customer rule to the merchant lane would trade an
  honest label for a friendlier one, which is the opposite of the intent.

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
  dark mode. No gradients except functional ones (zigzag edge, conic ring,
  scrollable-region edge fade).

All shadcn semantic tokens (`--background`, `--primary`, `--muted`, …) alias
the `--w-*` palette in `app/globals.css`. The superseded v1 Honey & Ink aliases
(`--paper-cream`, `--espresso-ink`, `--soft-mint`, `--fresh-green`) and the
unused Material surface tokens (`--surface-dim`, `--surface-container`,
`--surface-container-high`) have been removed — they had no consumers.

**Dark mode is a dormant capability, deliberately.** A full "night printing"
`.dark` token block ships in `globals.css` and next-themes is wired, but no
user-facing toggle exists and none is planned until a product decision says
so — do not flag the unreachable dark tokens as dead code, and do not expose
a toggle outside the `/dev/design-system` catalogue (which carries one for
regression-checking the dark-critical rules: QR stays on pure white, shadows
swap to the dark shadow colour).

## Typography

- **Bricolage Grotesque** for everything spoken. Headings are always **800**
  with tight leading and slight negative tracking on display sizes. Body is
  weight 500.
- **Space Mono** for everything printed — IDs, codes, dates, eyebrows, feeds,
  metadata. Eyebrows/kickers are short mono uppercase with 0.06em tracking
  (use the `.eyebrow` utility): "SCANNED AT THE COUNTER".

**Micro-type scale.** Below `text-xs` there are exactly two sanctioned sizes,
minted as utilities in `app/globals.css`:

- `.mono-meta` — 11.5px Space Mono 700, 0.06em, uppercase (the eyebrow
  metrics without the baked-in muted colour; `.eyebrow` = `.mono-meta` +
  muted).
- `.mono-id` — 10px Space Mono 700, 0.06em, uppercase. **10px is the system
  floor: nothing renders text below it.** The floor is enforced by
  `pnpm tokens:check`, which fails on any arbitrary `text-[…]` under 10px.

Do not hand-roll `font-mono text-[0.x rem] tracking-[…] uppercase` strings —
reach for one of these utilities and add colour at the call site.

Both families are served through `next/font/google` as
`--font-bricolage-grotesque` and `--font-space-mono`.

## Shapes

Sharp-ish print shapes. **10px radius** (`--radius`) on buttons, inputs,
cards, and keys; **18px** (`--radius-sheet`) on bottom sheets and large
panels. **Full circles are reserved for the stamp family** — stamps, seals,
marks — always rotated -6° to -8°.

Named circle exceptions are narrow and intentional: the `IconRoundel` brand
component (`components/brand/icon-roundel.tsx` — the one static, unrotated,
ink-bordered circle for framing a glyph or step number; the `EmptyState` icon
roundel in `components/brand/typography.tsx` is its progenitor), the
customer tab-bar chips, join stepper discs, the poster-chrome guidance chip, and the
legal-link halo family. These are navigation or framing controls, not reward marks; new
framing circles reach for `IconRoundel` rather than hand-rolling
`rounded-full`, and the list does not grow without updating this contract. Borders are **2px solid ink** everywhere; **2px dashed**
(`.w-rule`) for empty slots, receipt rules, and pick-one
suggestion tiles such as reward presets and add-reward affordances. The mono
pill `.w-tag` is the only generic pill shape outside the stamp family.

## Elevation & Depth

**Hard offset shadows, never blurred.** The Tailwind shadow scale is remapped
in `globals.css`: `shadow-md` is 4px 4px 0 ink (cards), `shadow-sm` 3px 3px 0
(buttons, small surfaces), collapsing to 1px 1px 0 plus a translate on press.

- _Press_ — the shadow collapses into the paper (the system-wide signature):
  the element translates toward its shadow while the offset shrinks. Ghost
  and link variants stay flat bar a 1px settle — never a scale.
- _Disabled_ — 45–50% opacity.
- _Focus_ — **one recipe for the whole system**: a 2px vermillion outline at
  2px offset (`outline: 2px solid color-mix(in oklch, var(--ring) 85%,
transparent)`). The 85% mix is a floor, not a taste choice: composited over
  paper it must hold ≥ 3:1 non-text contrast (70% sat at 2.98:1 and failed).
  `.pressable` (every Button) and the themed inputs carry it from the
  unlayered layer; plain interactive elements add `.focus-ring`; composite
  fields whose focus lives on an inner input (prefix/suffix wells) put
  `.focus-ring-within` on the visual box.
  Never reintroduce per-component `focus-visible:ring-*` alphas.
- _Dense tiles_ — a slotted `Card` takes `data-elevation="flat"` for the 2px
  offset (KpiTile, MetricTile beside StatStrip); shadow utilities on slotted
  cards are silently defeated by the layer, so the variant is the recipe.
  For style attributes that cannot use a shadow utility, the named offsets
  `var(--shadow-hard)` (4px) and `var(--shadow-hard-sm)` (2px) exist.
- Transparency is for scrims only (`rgba(33,28,22,0.5)` under sheets). No
  glassmorphism, no photography; the optional paper grain
  (`<body data-grain="true">`) is the only texture. Dashed lines come in two
  tones only: `--w-line` (18%, receipt rules, empty stamp slots) and
  `--w-line-strong` (50%, empty reward slots and ticket perforations).

## Layout & Spacing

4px base unit. 14px gaps between cards, 22px between sections. Customer
column max ~410px (thumb zone — use the `max-w-customer` utility, minted from
`--container-customer`, so one journey ships one width), merchant 1152px
(`max-w-merchant`), marketing content 1152px (`max-w-marketing`), and
marketing chrome/header/footer 1280px (`max-w-marketing-chrome`). Primary tap
targets ≥ 44px (buttons h-11+, PIN keys 60px).
Compact button sizes (`xs`/`sm`/`icon-sm`) are honest: they render at their
declared height on fine pointers and grow to the 44px floor on coarse
(touch) pointers, the FilterPills pattern. Mobile-first, touch-first — hover
effects are minimal.

## Motion

One slam easing (overshoot, `cubic-bezier(0.16, 1.2, 0.3, 1)`) for stamps; one
standard easing (`--w-ease`) for everything else. Press feedback lands
**instantly on the way down** and releases over 90ms (slow where the user
decides, instant where the system responds); sheets/moves 320ms; stamp slam
380ms. Paper shake remains a catalogue/marketing accent, not part of the live
customer transaction: an actionable control and its ancestors never move from
pointer-down through pointer-up or while the stamp request resolves.

**The customer stamp choreography is server-led.** It has five named phases:

1. **Contact (0–90ms):** only the non-hit-test rubber-stamp face compresses.
   The button node, focus, pointer capture, and bounding rectangle stay fixed.
2. **Checking (request duration):** the card keeps its authoritative count,
   dates, earned attributes, and reward state. A bounded neutral process cue
   and “Checking today’s stamp…” acknowledge the request; no looping motion,
   success colour, checkmark, earned mark, or reward reveal appears.
3. **Print (≤380ms after `issued`):** the returned count lands into its exact
   slot(s) with one local `WetInkSlam`. The earned vermillion mark, date, and
   resting tilt appear only now. One attempt produces one slam.
4. **Readback (concurrent):** a permanently reserved status band states the
   exact result — “Stamp 4 of 8 added · 4 to go” — and the next UK
   business-day cue. It replaces its own copy in place, never inserts a panel
   that moves the card or nearby controls.
5. **Threshold (full card only):** the reward ticket changes from sealed to
   unlocked in place with one restrained seal beat. The final-stamp slam stays
   the cause; the reward state is the consequence. The sequence never blocks
   the server-derived “See your reward” action.

Unknown transport outcomes never claim failure: the surface says it could not
confirm the result, performs authoritative readback, and prevents a duplicate
attempt until the card state is known.

**Motion is split by job.** Choreography lives in Framer Motion/Wet Ink:
entrances, stamps, reward reveals, celebrations, marquees, and sheets. CSS is
allowed only for micro-states and pre-hydration loading: `animate-spin` in
`Spinner` and the sonner loading icon; the guarded loading pulse family
(`Skeleton`, `customer-qr-scanner-loader`, the reward-collection QR shimmer,
and static stamp-request busy treatment); `.pressable` press tilt; sidebar width
transition; Radix data-state sheet overlay/content **keyframes**
(tw-animate-css `animate-in`/`animate-out` — Radix Presence only awaits
`animationend` on close, so sheet/dialog exits must be keyframe animations,
never transitions, or the exit silently never plays); and
token-driven hover/focus transitions. CSS animations must be
`motion-reduce:animate-none` guarded or `motion-safe:` scoped. CSS transitions
use the `--w-*` timing tokens for micro-states and loading shells; Wet Ink
primitives handle product choreography.

The vocabulary is the `WetInk*` primitive library in
[`components/motion/wet-ink.tsx`](components/motion/wet-ink.tsx),
which reads its timing from [`lib/motion/tokens.ts`](lib/motion/tokens.ts)
(a hardcoded mirror of the `--w-dur-*`/`--w-ease*` custom properties,
drift-guarded by `tests/unit/motion-tokens.test.mjs`):
`WetInkRise`, `WetInkSlam`, `WetInkSoftStamp`, `WetInkShake`, `WetInkPop`,
`WetInkWiggle`, `WetInkBreathe`, `WetInkRipple`, `WetInkMarquee` (pauses on
an explicit operable control where it runs beyond five seconds), `WetInkSheet`,
plus the composed `StampSlamSequence` (slam + paper shake). This list is the
complete export surface of the primitive library — an exported primitive that
is not documented here (or a documented one that no longer ships) is drift.
`WetInkRise` also has an in-view mode for section entrances: it animates the
semantic section/container itself once as it enters the viewport, with no
opacity blanking. **Production code never uses raw `animation: w-*` or
`animate-[w-*]`** — those CSS keyframes were removed; reach for a `WetInk*`
primitive instead. The resting stamp tilt is seeded per slot via `--stamp-rot`.
Every primitive renders static children under `prefers-reduced-motion` (no
opacity blanking), and a global reduce rule neutralises any residual animation.
The primitive host element is invariant across hydration, active/inactive, and
reduced-motion states: animation props may change, the React/DOM node type may
not. Triggered completion callbacks also settle in reduced motion so business
state never depends on a spatial animation finishing.

Critical stamp/reward transforms use a full `transform` value rather than
Motion’s individual `x`/`y`/`scale` properties; this keeps the compositor path
available in current Motion. Transaction surfaces contain no infinite
decorative loop. `WetInkWiggle` and `WetInkBreathe` are bounded one-shot
invites; a state remains fully legible after they stop.

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
_outside_ any `@layer`, so under Tailwind v4 it beats every layered utility
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
  states), `RewardTicket`, `OfferPass` (the discount pass face — unlimited uses
  inside its window, so never a reward ticket), `ProgressTrack`, `QrFrame`,
  `StatusBanner`, `RewardCelebration`. The pint reward is retired.
- **Motion** (`components/motion`): the `WetInk*` primitives only (see Motion
  above) — never raw `animation: w-*` / `animate-[w-*]`.
- **Forms / data** (`components/forms`, `components/data`): `FormField`,
  `SelectField`, `SubmitButton`, `DataTable`, `ActivityFeed`, `FunnelChart`.

Composed patterns: `StampSlamSequence` (slam + paper shake on a `ReceiptCard
shaken`), the `RewardSeal`/`RewardTicket` state machine, and the merchant
loading skeletons that mirror real surface structure. The live reference for
every token, primitive, and loyalty state is the
[`/dev/design-system`](app/dev/design-system/page.tsx) catalog.

### Buttons

2px ink border, 10px radius, weight 700, hard 3px offset shadow. On press the
button translates 2px toward its shadow and the shadow collapses to 1px.
Ghost and link variants stay flat. Primary is vermillion with white text.

**Destructive is outline danger, never a second filled red.** Primary
(#cf330a) and destructive (#c0301c) sit ~1.1:1 apart, so a filled destructive
button is indistinguishable from a primary action. The danger silhouette is
card ground with destructive border, text, and shadow (the unlayered
`[data-variant="destructive"]` rules) — primary stays the only filled red on
any surface, and the different silhouette says "danger" before the copy does.

### Cards

Card surface (#fbf8f1) with a 2px ink border, 10px radius, and a hard 4px
offset shadow (`.surface-card` for plain elements). Card titles are weight 800
(owned by the unlayered layer) at `CardTitle`'s 16px default — the `card-title`
token records this shipped size, and the slot rule deliberately does not set a
font-size, so call sites may scale up where a surface needs it (`MetricTile`'s
KPI value). Receipt-style surfaces can add the `.receipt-edge` perforated
zigzag.

### Console data tables & record cards

Admin and merchant consoles list dense records through `DataTable`
(`components/data/data-table.tsx`). The default render is a semantic
`<table>` on a `.surface-card` — keep it as a plain table when the rows are
short and stay within a desktop column. When a table is reused on the
admin consoles, where the same data must read on a phone, opt into the
responsive renderer by passing a `mobileCard` (and an optional
`mobileClassName`):

- **Breakpoint.** `cardBreakpoint` has two sanctioned switches: `sm` for
  compact, short-row tables and `xl` for admin consoles. The admin norm is
  `xl`, so dense support records stay as stacked `AdminRecordCard` rows
  through tablet widths and switch to the semantic table at desktop width.
  The old `lg` escape hatch is pruned. The default remains `sm`: below `sm`
  the component renders a stacked card list (`sm:hidden`); at `sm` and above
  it renders the semantic table (`hidden sm:block`). The `emptyState` is
  shared and prints in both modes; the `caption` labels both the table
  (`<caption class="sr-only">`) and the mobile list (`aria-label`). Omitting
  `mobileCard` leaves the DOM and classes exactly as the plain table, so the
  opt-in never regresses existing tables.

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
`--stamp-rot` resting tilt). The live customer route slams only the newly
server-issued slot; it never wraps the receipt in `StampSlamSequence`.
`StampSlamSequence` remains available for non-interactive catalogue and
marketing compositions where no active control can be displaced.

Pending is not an earned stamp. While a request is in flight, the grid keeps
the server-known count and exposes no new `data-stamp-earned`, date, initials,
solid vermillion fill, checkmark, reward state, or “earned/added/saved” copy.
If a pending slot marker is used, it is a separate dashed paper/ink-soft
overlay labelled “Stamp request pending”, never the underlying earned dot.
The issuing response may add multiple stamps through a referral bonus, so the
rendered result always comes from `newStampCount`, never an optimistic `+1`.

**Width pressure.** `StampGrid`'s row layout wraps via auto-fit tracks with a
hard minimum (44px, 36px compact): discs keep their circle and wrap to a new
line rather than compressing into overlapping ellipses in narrow cells. Pass
`showCount` to reserve an always-readable mono "current / total" label above
the grid for dense surfaces (members tables, tight columns). Stamp dates and
chip captions print at the 10px mono-id floor. The redeemed `RewardTicket`
reserves a clear band below the copy for its REDEEMED stamp, so the mark
never sits on the reward name.

### Inputs

Card-background wells with 2px ink borders and 10px radius. One-time passcode
entry is a single native input with `inputMode="numeric"` and
`autoComplete="one-time-code"`; this keeps iOS autofill reliable and is the
only OTP/passcode contract.

**One input story.** The themed `[data-slot=input]` well is the single input
treatment — do not hand-roll `rounded-xl bg-secondary/60` class strings or
private `Field` clones. State styling lives in the unlayered layer itself:
focus swaps the border to vermillion plus the shared outline;
`aria-invalid="true"` swaps it to destructive. Compose fields through
`FormField` (`components/forms`), which wires `id`, `aria-describedby` and
`aria-invalid` into its control, so an invalid field is visible _and_
announced. Native selects compose through `SelectField`, which keeps the same
input well and adds the house chevron with the brand `Icon` wrapper. Pending
submits go through `SubmitButton pendingLabel="Saving…"` (real ellipsis, never
three dots) — it disables itself, announces `aria-busy`, and shows the
`Spinner`.

### Sheets

Bottom sheets (the counter moment — PIN pad on the customer's phone) use the
18px top radius, 2px ink top border, and rise over an ink scrim.

### Badges & Tags

Mono uppercase pills (Space Mono, 11px, 0.08em tracking) — status semantics
come from the spot inks: vermillion stamp, sun reward, cobalt join, leaf
redeem. The metric source of truth is the unlayered `[data-slot="badge"]`
rule; `.w-tag` is its documented alias for plain (non-Badge) elements. Long
copy never overflows a row: the pill caps at its container width and
`MonoTag` truncates its content with an ellipsis — print the venue name as
text and keep the pill for the status word when both must fit.

Merchant activity categories map to the same spot-ink story everywhere:
customer joins are cobalt, stamps are vermillion, rewards are leaf, QR events
are sun, and account events stay quiet secondary/plain.

### FAQ patterns

Both FAQ treatments are sanctioned. Short, pricing-like FAQ lists can use
dashed receipt rows; longer marketing answers use bordered accordion cards.
Do not mix the two treatments inside one route.

### QR Codes

Always QR ink (#111) modules on a pure white, ink-bordered frame — in both
themes. The QR is a functional graphic, never decorated.

### Progress

Track is deeper paper; fill is leaf (`--reward`); radius is the squared
`--radius-sm` print corner. This is encoded in the unlayered
`[data-slot=progress]` rules, so a bare `<Progress>` is on-spec with no
call-site colour overrides, and `FunnelChart` renders the same primitive —
one bar anatomy for the whole system. Heights stay per call site.

### Toasts & feedback

Toasts (sonner) are themed through the `.cn-toast` slot in `globals.css`:
2px ink border, card ground, hard offset shadow, and tone washes that mirror
`StatusBanner` (leaf success, destructive error, vermillion warning, cobalt
info). `richColors` is forced off inside `components/ui/sonner.tsx` — the
stock sonner palette never ships. Inline notices use the bare `Alert` (now
carrying the 2px ink contract from the layer) or, on loyalty surfaces,
`StatusBanner`, which adds the tone washes and semantic icons and includes a
cobalt `info` tone for joins and neutral system notes.

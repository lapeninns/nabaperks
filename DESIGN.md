---
name: Wet Ink (Honey & Ink v2)
colors:
  paper: '#f6f1e6'
  paper-deep: '#ece5d4'
  card: '#fbf8f1'
  ink: '#211c16'
  ink-soft: '#6b6257'
  line: 'rgba(33, 28, 22, 0.18)'
  accent-vermillion: '#e8430f'
  on-accent: '#ffffff'
  cobalt: '#2b43c8'
  leaf: '#1e8a4c'
  sun: '#f5a623'
  destructive: '#c0301c'
  background: '#f6f1e6'
  foreground: '#211c16'
  primary: '#e8430f'
  on-primary: '#ffffff'
  stamp: '#e8430f'
  stamp-empty: 'rgba(33, 28, 22, 0.18)'
  seal: '#f5a623'
  reward-ready: '#1e8a4c'
  qr: '#111111'
  qr-bg: '#ffffff'
typography:
  marketing-hero:
    fontFamily: Bricolage Grotesque
    fontSize: 56px
    fontWeight: '800'
    lineHeight: '1.05'
    letterSpacing: '-0.01em'
  page-title:
    fontFamily: Bricolage Grotesque
    fontSize: 34px
    fontWeight: '800'
    lineHeight: '1.05'
  card-title:
    fontFamily: Bricolage Grotesque
    fontSize: 21px
    fontWeight: '800'
  body:
    fontFamily: Bricolage Grotesque
    fontSize: 15px
    fontWeight: '500'
    lineHeight: 22px
  small:
    fontFamily: Bricolage Grotesque
    fontSize: 13.5px
    fontWeight: '500'
  mono-meta:
    fontFamily: Space Mono
    fontSize: 11.5px
    fontWeight: '700'
    letterSpacing: '0.06em'
    textTransform: uppercase
  mono-id:
    fontFamily: Space Mono
    fontSize: 10px
    fontWeight: '400'
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
  shadow: '4px 4px 0 ink'
  shadow-sm: '3px 3px 0 ink'
  shadow-pressed: '1px 1px 0 ink'
motion:
  ease: 'cubic-bezier(0.2, 0, 0, 1)'
  ease-slam: 'cubic-bezier(0.16, 1.2, 0.3, 1)'
  press: 90ms
  move: 320ms
  slam: 380ms
---

## Brand & Style

**Aesthetic — Wet Ink.** Riso-print / rubber-stamp tactility for local
counter-service businesses: flat spot inks on warm paper, hard offset shadows,
perforated receipt edges, rotated stamp marks. The product's core verb —
*stamping* — is the entire visual language. This is v2 of the design system;
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
- **Spot inks:** vermillion accent (#e8430f — THE action/stamp ink,
  themeable), cobalt (#2b43c8 — info, joins), leaf (#1e8a4c — success,
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

- *Press* — the shadow collapses into the paper (the system-wide signature):
  the element translates toward its shadow while the offset shrinks.
- *Disabled* — 45–50% opacity. *Focus* — vermillion ring.
- Transparency is for scrims only (`rgba(33,28,22,0.5)` under sheets). No
  glassmorphism, no photography; the optional paper grain
  (`<body data-grain="true">`) is the only texture.

## Layout & Spacing

4px base unit. 14px gaps between cards, 22px between sections. Customer
column max ~410px (thumb zone), merchant 1060px, marketing 1100px. Primary
tap targets ≥ 44px (buttons h-11+, PIN keys 60px). Mobile-first, touch-first —
hover effects are minimal.

## Motion

One slam easing (`--w-ease-slam`, overshoot) for stamps; one standard easing
(`--w-ease`) for everything else. Press 90ms; sheets/moves 320ms; stamp slam
380ms plus a 300ms paper shake. Keyframes live in `globals.css` as the
`w-*` vocabulary (`w-rise`, `w-slam`, `w-soft-stamp`, `w-shake`, `w-ripple`,
`w-wiggle`, `w-pop`, `w-sheet-up`, `w-marquee`). Everything respects
`prefers-reduced-motion`.

## Iconography

**No icon library.** The brand communicates with its own geometric
vocabulary: **✱** the stamp glyph (collected visits, the wordmark disc),
**? / ✓** seal states set in Bricolage 800, 11px ink-bordered status dots in
spot inks, dashed circles for empty slots, and unicode glyphs (→ ⌫ ·) inline
with text. Emoji are never used.

## Components

The shadcn primitives in `components/ui/` are **not** edited for visual
styling. Wet Ink treatments are applied through theme tokens and the
unlayered "Wet Ink layer" in `app/globals.css`, which targets the primitives'
`data-slot` attributes (button, card, input, textarea, badge, sheet). Keep it
that way: restyle via tokens, the ink layer, wrapper components, or
project-specific variants.

### Buttons
2px ink border, 10px radius, weight 700, hard 3px offset shadow. On press the
button translates 2px toward its shadow and the shadow collapses to 1px.
Ghost and link variants stay flat. Primary is vermillion with white text.

### Cards
Card surface (#fbf8f1) with a 2px ink border, 10px radius, and a hard 4px
offset shadow (`.surface-card` for plain elements). Card titles are weight
800. Receipt-style surfaces can add the `.receipt-edge` perforated zigzag.

### Stamps & Grids
Earned stamps are solid vermillion circles with white marks; empty slots are
dashed ink-line circles. Stamp-family marks rotate -6°. The stamp slam uses
`w-slam` with the overshoot easing, followed by a `w-shake` of the card.

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

# Wet Ink Design-System Audit — 2026-07-10

**Scope:** the Wet Ink design system (DESIGN.md contract + implementation across
`app/globals.css`, `components/brand|loyalty|motion|forms|data|ui`).
**Method:** three design lenses (anti-slop taste, design-engineering polish,
fluid-interface foundations) + three thorough read-only sweeps (contract drift,
accessibility, motion/performance) + mathematical WCAG contrast verification of
every token pair. All findings carry file:line evidence; suspicions that failed
verification are listed in "Retracted" so future audits don't re-flag them.

---

## Verdict

Wet Ink is a **strong, disciplined, clearly intentional system** — the core
palette passes AA with 5:1–16:1 margins, reduced-motion coverage is exemplary,
touch targets genuinely honour the 44px floor, the screen-reader models
(StampGrid, DataTable, OTP) are textbook, and the motion stack
(`motion@12` + `LazyMotion strict`) is optimally engineered.

The problems cluster in two places:

1. **Two user-visible defects**: the focus-indicator story (the sanctioned ring
   misses AA by a hair; ~30 outlawed ring variants miss it badly), and sheet
   exit animations that silently never play.
2. **A systemic pattern**: every drifted contract (focus dialect, eyebrow
   hand-rolling, circle exceptions) is enforced by **prose or a hand-picked
   file subset**; every machine-enforced contract (10px floor, motion
   vocabulary, token parity, claims) has **zero drift**. The highest-leverage
   fix is not any single item — it is promoting the prose contracts to machine
   enforcement.

---

## Scorecard

| Dimension | Health | Notes |
|---|---|---|
| Color/contrast (core text) | ✅ Excellent | Every text pair 4.5+, most 5–16:1, both modes |
| Color/contrast (edges) | ⚠️ 4 issues | Focus ring 2.98, outlaw rings 1.69, hover /80 3.47, dark seal 1.72 |
| Reduced motion | ✅ Exemplary | Global neutraliser + per-primitive static fallbacks, sync first-frame init |
| Touch targets | ✅ Pass | 44px coarse-pointer growth verified everywhere checked |
| Screen readers | ✅ Good | StampGrid/DataTable/OTP/toasts wired; 2 small gaps |
| Color-only meaning | ✅ Pass | Trend labels always signed; badges glyph+text |
| Forced colors (WHCM) | ⚠️ Gap | No handling anywhere; FilterPills selection vanishes |
| Motion quality | ✅ Strong | 1 real defect (sheet exits), 2 polish items |
| Bundle/perf | ✅ Strong | LazyMotion strict, no scroll listeners, no transition:all |
| Contract ↔ code parity | ⚠️ Drifted | ~75 violations across 2 contracts, all outside guard scope |
| Enforcement coverage | ⚠️ The root cause | Prose-only contracts drift; machine contracts hold |

---

## P0 — Fix first (user-visible / compliance)

### 1. Focus-indicator system: sanctioned ring under AA, outlaw rings far under
- The one system recipe `color-mix(in oklch, var(--ring) 70%, transparent)`
  composites to **2.98:1 on paper** (needs 3:1) — `app/globals.css:414`, also
  inputs at `:473`. On card it passes (3.10).
- ~30 usages of the explicitly banned `focus-visible:ring-*` dialect across 20
  files (DESIGN.md:200-203 "Never reintroduce"). Worst: the **customer tab
  bar** `ring-ring/35` = **1.69:1** (`components/layout/customer-tab-bar.tsx:66`).
  Heaviest file: `components/merchant/loyalty-card-form.tsx` (8 occurrences).
  Full list in the drift sweep (agents' item 4): poster-preview-chrome, qr-panel-live,
  disclosure, account-tab-bar, auth forms, customer-card-experience,
  home-card-tile, home-redeem-banner, marketing hero/faq/guides, privacy, terms,
  loyalty-for-pubs, checkout-alert, demo-card.
- **Fix (one pass):** bump the mix to **85%** (→ 3.72:1 on paper; 100% → 4.51),
  replace all outlaw rings with `.focus-ring`, and widen the existing "banned
  dialect" test (`tests/micro-specs/ux-production-polish.test.mjs:90`, currently
  button/input/textarea only) to `app/ components/` repo-wide.

### 2. Sheet exit animations never play (hard cut on close)
- `components/ui/sheet.tsx:14-15` animates with CSS **transitions**
  (`transition-[opacity,transform]` + `data-open/data-closed`), but Radix
  Presence delays unmount only for CSS **animations** (`animationend`). On
  close, the node unmounts immediately — the slide-down/fade-out **never runs**.
  Every sheet pops out: customer legal bottom sheet
  (`components/customer/legal-sheet.tsx:58`), mobile nav drawer (sidebar →
  SheetContent), QR present dialog (`components/merchant/present-qr.tsx:47-50`).
- Violates the system's own spatial-consistency intent (enter/exit along the
  same path) — and DESIGN.md sanctions this exact pattern, so the contract
  carries the defect.
- **Fix:** swap to Presence-aware keyframes — `data-[state=open]:animate-in
  data-[state=closed]:animate-out slide-out-to-bottom fade-out` etc.
  `tw-animate-css` is already imported (`app/globals.css:2`); this is the stock
  shadcn pattern, which exists precisely because of this Radix behaviour. Update
  the DESIGN.md motion clause to match.

---

## P1 — Real issues, small fixes

3. **Admin link hover fails AA** — `hover:text-primary/80` = **3.47:1**
   (`app/admin/merchants/page.tsx:88`, `app/admin/billing/page.tsx:26`).
   Fading toward paper is also off-brand: in a print system hover should *add*
   ink. `hover:text-[color-mix(in_srgb,var(--primary)_80%,var(--ink))]`
   (≈ #ac2e0c) → **5.91:1**.
4. **RewardTicket ready-date at the 10px floor** — the date a customer must
   read to claim a prize renders only at `.mono-id`
   (`components/loyalty/reward-ticket.tsx:96`). Older pub demographic; promote
   to `.mono-meta` or Bricolage `text-xs`.
5. **Sticky hover on the mobile drawer** — two raw `:hover` rules in the
   unlayered block are not `(hover: hover)`-gated (`app/globals.css:668,676`);
   Tailwind auto-gates utility hovers but not raw CSS. Wrap both.
6. **Dark-mode seal glyph 1.72:1 (latent)** — `.dark` leaves
   `--seal-foreground` as flipped ink → cream-on-sun (`app/globals.css:196-222`).
   Pin `--seal-foreground: #211c16;` in `.dark` (→ 8.34:1). Dark is dormant by
   design, but the catalogue regression-checks dark rules — one line now.
7. **Forced-colors (Windows High Contrast): selection cues vanish** — no
   `forced-colors` handling exists anywhere. Cards survive (2px borders), but
   FilterPills' selected state is background+shadow only
   (`components/brand/filter-pills.tsx:61-63`). Add a forced-colors-safe cue
   keyed off `aria-pressed` (underline/outline).
8. **RewardCelebration doesn't self-announce** — labelled section, not a live
   region (`components/loyalty/reward-celebration.tsx:32-34`); relies on host
   surfaces' separate `role="status"`. Add `role="status"` to the component.

---

## P2 — Consistency, polish, and design decisions

9. **Eyebrow hand-rolling (~45 hits / 25 files)** — hand-rolled
   `font-mono text-[…] uppercase` combos instead of `.mono-meta`/`.mono-id`/
   `.eyebrow`, all outside the marketing-only guard
   (`tests/micro-specs/marketing-polish-p2.test.mjs:299`). Worst:
   `customer-flow-system.tsx` (5), `poster-preview-chrome.tsx` (5),
   `customer-readback-table.tsx` (4), `qr-panel-live.tsx` (3). Consistency debt,
   not a rendering break — fix opportunistically, then extend the guard.
10. **Icon-roundel proliferation past the circle contract** — ~7 confident
    unsanctioned full-circle icon/number roundels (announcements page, QR
    scanner + loader, push-notification settings ×2, home-empty-state,
    venue-personas, merchant onboarding steps). The pattern is clearly useful —
    it out-reproduced the contract. **Recommend:** mint a brand `IconRoundel`
    component, name it in DESIGN.md's exception list, retrofit the 7 sites —
    rather than deleting a pattern the product evidently wants.
11. **Primary vs destructive are 1.12:1 apart** — #cf330a vs #c0301c are
    visually the same red; meaning rests on copy alone. Concrete echo:
    KpiTile's no-trend sparkline strokes `var(--primary)` while down-trends
    stroke `var(--destructive)` (`components/brand/kpi-tile.tsx:26-47`) —
    "neutral" and "falling" look identical (mitigated: trend *labels* are
    signed). **Decision, not defect.** Options: outline-danger button treatment
    (card ground, 2px destructive border+text, 5.38:1 ✓) so primary stays the
    only filled red; and default the no-trend sparkline to `var(--w-ink-soft)`.
12. **Dead `hover:shadow-md` on slotted cards** — defeated by the unlayered
    layer exactly as DESIGN.md warns: `home-redeem-banner.tsx:19`,
    `home-card-tile.tsx:47` (their `transition-shadow` is a no-op too). Also
    visual no-ops on `.surface-card` at `loyalty-for-pubs:232`,
    `guide-page.tsx:158` (hover shadow-md == resting shadow-md). Delete or use
    the sanctioned variant.
13. **Marquee has no pause mechanism** — infinite auto-moving content in
    parallel with page content technically requires pause/stop/hide (WCAG 2.2.2,
    Level A) for motion-enabled users (`components/marketing/marquee.tsx:50`).
    Pause on hover/focus or stop after ~3 loops. (aria-hidden + reduced-motion
    already handled — thoughtful.)
14. **Vermillion text margin is zero** — `text-primary` on paper = **4.51:1**
    (passes by 0.01) across ~56 call sites, and the accent is designed to be
    themeable per-merchant. No colour change needed — add contrast assertions
    to `tokens:check` (primary/paper ≥ 4.5, ring-composite/paper ≥ 3,
    on-primary/primary ≥ 4.5) so the first theme can't silently break 56
    surfaces.
15. **Press-down eases over 90ms** — `.pressable`/button `:active` transitions
    are symmetric (`app/globals.css:275-288,426-433`). Polish ideal: instant on
    the way down, eased on release (`transition-duration: 0s` scoped to
    `:active`).
16. **Bricolage as 5 static weights** — `app/layout.tsx:16-21` pins discrete
    weights; loading it as the variable font it is = one smaller file on the
    customer path + enables the `opsz` axis.
17. **Dead/orphaned surface** — `--w-mo: 1` (`app/globals.css:193`, zero
    consumers); `data-grain` documented but never enabled (if ever enabled
    app-wide, the fixed `mix-blend-mode: multiply` overlay defeats compositor
    fast-paths — profile first or use a non-blended tile); `WetInkSheet` has
    zero production consumers and its tokens.ts:104 comment ("used by legal,
    rewards sheets") is stale — adopt it (with `AnimatePresence` + `exit`) or
    re-document as catalogue-only.
18. **Export-surface test is one-directional** —
    `tests/unit/motion-vocabulary.test.mjs:134-150` regex can't see
    `StampSlamSequence`, misses removals of documented primitives, never asserts
    the exact set. Tighten to a two-way set equality.

---

## The systemic recommendation (highest leverage)

Drift concentrated **exactly** where enforcement is prose or scoped to a
hand-picked file subset; machine-enforced contracts show zero drift. Promote to
machine enforcement, in this order:

1. **Contrast assertions in `tokens:check`** (P2-14) — computes from the same
   token source it already parses; protects the themeable-accent future.
2. **Focus-dialect ban repo-wide** (P0-1) — the test string "banned dialect"
   already exists for jump-nav; widen the glob.
3. **Eyebrow rule repo-wide** (P2-9) — same test shape as the marketing guard.
4. **`rounded-full` allowlist scan** (P2-10) — mechanical check against the
   named exception list (after minting `IconRoundel`).

Each is a small, spec-shaped change that fits the repo's Micro-Spec governance
culture.

## Strategic note (from the design-lens review, not the sweeps)

- **The moat is the treatment, not the palette.** Warm-paper + espresso ink is
  a common "AI-default warm-craft" palette family; what makes Wet Ink
  distinctive and defensible is the stamp metaphor, hard offset shadows,
  receipt edges, and mono receipt-voice. Protect those elements hardest; they
  are the brand.
- **The intensity axis wants a third notch.** Loud (customer/marketing raised
  cards) and Quiet (`data-elevation="flat"` console tiles) already ship. A
  documented "calm" tier (hairline border, no offset shadow) for
  billing/legal/trust surfaces would complete the volume dial the system
  already implies — one new elevation variant + a DESIGN.md clause.

---

## Verified excellent — do not churn

- Core text palette: every pair 4.5–16:1 in both modes; dark-mode accent-ink
  flip (5.43) and destructive-fg (4.65) correctly tuned.
- Reduced motion: global neutraliser (`globals.css:822-845`) + every primitive
  short-circuits to static children (no opacity blanking) + synchronous
  `matchMedia` init catches the first frame.
- `motion@12` + `LazyMotion strict` + `motion/react-m` everywhere — zero
  accidental full-bundle imports possible.
- Frequent actions (tabs, FilterPills, table rows): 150ms colour-only, no
  geometry animation, all `motion-reduce`-guarded.
- Hold-to-stamp RAF loop: imperative DOM writes, no per-frame setState, full
  cleanup (`stamp-press-button.tsx:118-173`).
- No `transition: all`, no scroll listeners, no `will-change`, gradient-built
  receipt zigzag, `touch-action: manipulation` on pressables.
- StampGrid SR model ("N of M stamps earned" + per-dot labels, decorative count
  hidden); DataTable dual captioning; OTP single-native-input contract with
  full aria wiring; trend meaning never colour-only (signed labels).
- Sun-as-text hazard already solved correctly in `stat-strip.tsx:24-27`.
- Hex literals confined to sanctioned contexts (email templates, OG image,
  manifest/themeColor) — and manifest/OG colours are cross-checked against
  tokens in CI.
- Copy voice: zero exclamation marks, zero emoji in rendered copy (brand ✱
  excepted, deliberate).

## Retracted during verification (do not re-flag)

- `text-sun` in `qr-panel-live.tsx:61` — sits on `bg-ink` where sun ≈ 8.3:1.
  Correct per the stat-strip rule.
- The sheet's `data-open`/`data-closed` classes — Tailwind v4's built-in
  variant matches Radix's `data-state="open"`; wiring is correct. (The exit
  defect is Presence-vs-transition, not the selectors.)
- Sub-10px text: none found; `tokens:check` floor holds.
- Raw `animate-[w-*]`/`animation: w-*`: zero hits; the removal is complete.
- Palette-hex "bypasses": all in legitimately-literal contexts (see above).

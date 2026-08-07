# Nabaperks UX/UI Redesign Audit — 05: Design System, Primitives, Shells & Cross-cutting A11y

**Scope:** `app/globals.css` (926 lines), `DESIGN.md`, `app/layout.tsx` + every route-group
`layout/loading/error/not-found`, `components/ui/**` (17 files), `components/brand/**` (13 files),
`components/forms/**`, `components/auth/**`, `components/layout/**`, `components/motion/**`.
**Method:** read-only source read of all 434 `.tsx` files under `app/` + `components/`, plus
class-string frequency analysis and computed WCAG contrast ratios for every declared token pair.
**Nothing was modified.** No build/test was run.

---

## 0. Measured baseline (the numbers the rest of the report leans on)

These counts are from a full grep over `app/**/*.tsx` + `components/**/*.tsx`:

| Signal | Count | Contract in DESIGN.md |
| --- | --- | --- |
| Distinct `rounded-*` values in use | 10 (`none, sm, md, lg, xl, 2xl, 3xl, full, t-[18px], [10px]`) | 3 (`10px`, `18px` sheets, `full` stamps) |
| `rounded-lg` / `rounded-md` / `rounded-xl` / `rounded-2xl` | 192 / 31 / 22 / 11 | one radius |
| Distinct radius+shadow combos on a hand-rolled `border-2` surface | **22** | one (`.surface-card`) |
| `.surface-card` uses vs hand-rolled `border-2 border-ink` | 57 vs **153** | `.surface-card` is the recipe |
| Distinct `py-*` section values | **26** | 22px section gap, 14px card gap |
| Distinct `gap-*` values | 16 | 4px base unit |
| `<h1>` rendered at N distinct type scales | **6** | one `page-title` (30/36) |
| `<h2>` rendered at N distinct type scales | **11** | one |
| Hand-rolled `text-[…]` font sizes | 21 sites | two sanctioned sub-`text-xs` utilities only |
| Distinct `tracking-[…]` values | **11** | two (`0.06em`, `0.08em`) |
| Arbitrary Tailwind values (`x-[…]`) total | **606** | — |
| `Button` sizes declared / actually used | 9 / **6** | — |
| `Button` variants declared / actually used | 8 / 7 | — |
| `Badge` variants declared / actually used | 7 / **1** | — |
| `--*` custom properties declared in globals.css | **141** | — |
| `dark:` variants across the whole product | **4** | full dark block ships |
| Skip-links in the product | **1** (marketing only) | 4 shells exist |

Computed contrast (sRGB, light theme):

| Pair | Ratio | Verdict |
| --- | --- | --- |
| `--w-ink` on `--w-paper` | 15.01 | pass |
| `--w-ink-soft` (muted-foreground) on paper / card | 8.10 / 8.60 | pass |
| `--primary` #cf330a on paper | **4.51** | AA by 0.01 |
| `--primary` on `--secondary` (`#ece5d4`) | **4.05** | **fails AA** |
| `--border`/`--input` (`--w-line`, 18% ink) on paper | **1.43** | **fails 1.4.11 (needs 3:1)** |
| `--w-line-strong` (50%) on paper | 3.20 | pass, barely |
| focus ring (85% vermillion) on paper / card | 3.72 / 3.90 | pass |
| `.eyebrow` colour on `ContrastBand` ink ground | **1.85** | **illegible** |
| `--seal` (sun) as text on paper | **1.80** | **illegible as text** |
| disabled state (50% opacity ink-soft on paper) | ~2.25 | informational-disabled fails |

---

## A. Design tokens, scales, and the `globals.css` ↔ `DESIGN.md` contract

### 1. The radius scale is declared four sizes wider than the contract and is being used
- **File(s):** `app/globals.css:67-73`, consumers across `components/**`
- **Current UX/UI Problem:** `@theme inline` mints seven radii — `--radius-sm:4px`, `md:6px`,
  `lg:10px`, `xl:14px`, `2xl:18px`, `3xl:22px`, `4xl:26px`. DESIGN.md sanctions **three** shapes
  (10px, 18px sheets, full circles for the stamp family). The extra rungs are used: `rounded-xl`
  (14px) 22×, `rounded-2xl` (18px) 11×, `rounded-3xl` 1×, `rounded-md` (6px) 31×. Concretely,
  `app/app/rewards/scan/[scanToken]/page.tsx:110` renders a summary `<dl>` at `rounded-xl border-2
  border-ink`, three lines from a `ReceiptCard` at 10px; `app/global-error.tsx` uses `rounded-lg`
  for the panel but `rounded-md` for its own button.
- **Why It Is a Problem:** 14px and 6px corners sit close enough to 10px to read as a rendering
  bug rather than a deliberate contrast. On a print-derived aesthetic where sharpness is the whole
  identity, mixed corner radii is the single most visible "unfinished" tell.
- **Recommended Redesign:** Delete `--radius-xl/2xl/3xl/4xl` from `@theme inline`. Mint
  `--radius-sheet: 18px` into `@theme` so a real `rounded-sheet` utility exists (today `--radius-sheet`
  lives only in `:root`, so it is unreachable as a utility and call sites write `rounded-t-[18px]`
  and `rounded-[var(--radius-sheet)]`). Then codemod: `rounded-xl|2xl|3xl → rounded-lg`,
  `rounded-md → rounded-lg` except where a genuine 4px print corner is wanted (`rounded-sm`).
  Add the surviving three to `scripts/check-design-tokens.mjs` as an allow-list.
- **Priority:** High

### 2. Twenty-two different ways to draw "the Wet Ink card"
- **File(s):** `app/globals.css:313-319` (`.surface-card`), 153 hand-rolled sites incl.
  `components/merchant/loading-skeletons.tsx:537,648`, `components/customer/push-notification-settings.tsx:238`,
  `app/app/offers/[campaignId]/qr/page.tsx:96`, `components/merchant/present-qr.tsx:67`
- **Current UX/UI Problem:** `.surface-card` exists and encodes the exact contract (2px ink,
  10px, `shadow-md`). It is used 57 times. The same surface is hand-rolled 153 times, producing 22
  distinct radius/shadow pairings — `rounded-lg` + nothing (82×), `rounded-md` + nothing (14×),
  `rounded-lg shadow-sm` (13×), `rounded-xl` + nothing (9×), `rounded-2xl
  shadow-[8px_8px_0_var(--w-shadow-color)]` (2×), `rounded-[10px] shadow-[3px_3px_0_var(--w-ink)]`,
  `shadow-hard`, `shadow-[var(--shadow-hard)]`, `shadow-[4px_4px_0_var(--w-shadow-color)]`…
- **Why It Is a Problem:** Elevation is supposed to be semantic in this system (4px = card,
  3px = button, 2px = dense tile, 1px = pressed). With five spellings of "4px" and eight offsets in
  play, elevation no longer communicates anything; a user reading a dashboard cannot tell which
  surfaces are peers.
- **Recommended Redesign:** Make `.surface-card` the only permitted expression for a plain
  element and `<Card>` the only expression for a slotted one. Add `.surface-card-flat` (2px) and
  `.surface-well` (deeper paper, no shadow) as the other two sanctioned surfaces. Ban
  `shadow-[…px…]` arbitrary shadows in `tokens:check`. Replace the four spellings of the 4px offset
  with the `shadow-hard` utility that `@theme` already mints.
- **Priority:** Critical

### 3. `--radius-sheet` never becomes a utility, so sheets are hand-numbered
- **File(s):** `app/globals.css:182` (`:root`), `components/customer/*` (`rounded-t-[18px]`,
  `rounded-[var(--radius-sheet)]`)
- **Current UX/UI Problem:** `--radius-sheet: 18px` is declared in `:root`, not in `@theme inline`,
  so Tailwind never mints `rounded-sheet`. Call sites therefore write `rounded-t-[18px]` (1×),
  `rounded-[var(--radius-sheet)]` (2×), or `rounded-2xl` (which happens to equal 18px, 11×) — three
  spellings of one shape, one of which silently breaks if `--radius` changes.
- **Why It Is a Problem:** The sheet is the counter moment — the single highest-stakes surface in
  the product. Its shape is currently defended by coincidence.
- **Recommended Redesign:** Move `--radius-sheet` into `@theme inline` as `--radius-sheet`, use
  `rounded-t-sheet` everywhere, and delete `--radius-2xl`.
- **Priority:** Medium

### 4. `--border` / `--input` at 18% ink fails WCAG 1.4.11 for every 1px boundary
- **File(s):** `app/globals.css:147-148`; consumers `components/ui/table.tsx:31,64` (`border-b`),
  `components/ui/separator.tsx:22` (`bg-border`), `components/ui/badge.tsx:9` (`border-border`),
  40 further `border border-*` sites
- **Current UX/UI Problem:** `--border: var(--w-line)` = `rgba(33,28,22,0.18)`, computed **1.43:1**
  against paper and **1.45:1** against card. Every 1px separator that uses it — table row rules,
  `Separator`, plain `MonoTag`, the `outline` badge, the marketing footer's `border-t-2
  border-dashed border-border` — is effectively invisible at typical brightness.
- **Why It Is a Problem:** WCAG 2.2 SC 1.4.11 requires 3:1 for boundaries that are the only way to
  perceive a component. Table rows in the admin console are dense records with no zebra striping;
  if the rule is invisible the row grouping collapses. On a bright pub floor (the actual usage
  environment) this is worse, not better.
- **Recommended Redesign:** Keep `--w-line` at 18% for *decorative* dashed receipt rules only, and
  point the semantic `--border`/`--input` aliases at `--w-line-strong` (50%, 3.2:1) or at a new
  `--w-line-ui` at ~38% ink. Then move `Table`'s row rules to `border-b-2 border-dashed
  border-line` so they read as receipt perforations (on-brand) rather than as failed hairlines.
- **Priority:** High

### 5. Sun (`--seal`) is unusable as a foreground yet is exposed as `text-sun`
- **File(s):** `app/globals.css:46,118,156`; `components/data/stat-strip.tsx:27`
- **Current UX/UI Problem:** `--color-sun` is minted as a text colour utility, but `#f5a623` on
  paper is **1.80:1**. `stat-strip.tsx` already works around this with
  `text-[color-mix(in_srgb,var(--color-sun)_55%,var(--color-ink))] dark:text-sun` — a one-off
  inline colour mix, the exact pattern DESIGN.md forbids.
- **Why It Is a Problem:** The token invites a failure. One component has paid the cost of
  discovering it; the next will not.
- **Recommended Redesign:** Add `--w-sun-ink: color-mix(in oklch, var(--w-sun) 55%, var(--w-ink))`
  to `:root`, mint it as `--color-sun-ink`, and document sun as a *fill-only* ink (seal disc,
  `MonoTag tone="sun"`) with `sun-ink` as its text partner. Delete the arbitrary mix in
  `stat-strip.tsx`.
- **Priority:** High

### 6. `.eyebrow` bakes in a colour, so it cannot be used on the inverted band
- **File(s):** `app/globals.css:337-339`, `components/layout/contrast-band.tsx:52`,
  `components/marketing/landing/scarcity-band.tsx:16,31`
- **Current UX/UI Problem:** `.eyebrow` = `.mono-meta` + `color: var(--muted-foreground)`. On
  `ContrastBand` (`bg-ink text-paper`) that colour computes to **1.85:1** — illegible. The one
  component that needed an eyebrow there forked to `mono-meta text-paper/70`, so the ink band now
  carries a second eyebrow implementation.
- **Why It Is a Problem:** DESIGN.md explicitly says "do not hand-roll `font-mono text-[0.x rem]`
  strings — reach for one of these utilities". The utility itself is what forces the fork.
- **Recommended Redesign:** Add `.eyebrow-inverse { color: color-mix(in oklch, var(--w-paper) 72%,
  transparent) }` (7.9:1 on ink), or better, give `Eyebrow` a `tone?: "muted" | "inverse"` prop and
  make `ContrastBand` set `[--eyebrow-color]` so `.eyebrow` reads from a variable.
- **Priority:** Medium

### 7. 141 declared custom properties; ~74 have zero `var()` consumers
- **File(s):** `app/globals.css:9-195`
- **Current UX/UI Problem:** `--stamp-empty` (defined at :148, never referenced),
  `--shadow-2xs`, `--shadow-lg`, `--shadow-xl`, `--shadow-2xl`, `--shadow-hard-sm`,
  `--radius-2xl/3xl/4xl`, `--duration-fast`, `--duration-reveal`, `--ease-stamp`, `--chart-1..5`,
  and the whole `--color-*` alias block have no consumer via `var()`. Some of those (the `--color-*`
  block) are legitimately consumed as Tailwind utilities; but `--stamp-empty`, `--shadow-2xs`,
  `--shadow-hard-sm`, `--duration-fast`, `--duration-reveal`, `--ease-stamp`, `--chart-3/4/5` are
  genuinely dead — the last three because `TrendChart` passes `entry.color` inline.
- **Why It Is a Problem:** A token sheet that contains dead entries stops being trustworthy: the
  next contributor cannot tell which token is the answer, so they invent an arbitrary value. The
  606 arbitrary values in this codebase are the downstream symptom.
- **Recommended Redesign:** Delete `--stamp-empty`, `--shadow-2xs/lg/xl/2xl`, `--shadow-hard-sm`,
  `--duration-fast`, `--duration-reveal`, `--ease-stamp`. Wire `--chart-*` into `TrendChart`
  instead of inline `style={{background: entry.color}}`. Extend `tokens:check` with an
  "every declared token has ≥1 consumer" assertion.
- **Priority:** Medium

### 8. QR tokens exist but every QR surface hard-codes `bg-white`
- **File(s):** `app/globals.css:162-163,37-38`; `components/loyalty/qr-frame.tsx:18,22`,
  `components/merchant/present-qr.tsx:67,74`, `app/app/offers/[campaignId]/qr/page.tsx:96,103`,
  `components/admin/mfa-panel.tsx:109`
- **Current UX/UI Problem:** `--qr: #111111` / `--qr-foreground: #ffffff` are declared in both
  themes and aliased into `@theme` as `--color-qr`/`--color-qr-foreground`, yet all six QR surfaces
  write `bg-white` and `text-black`. `mfa-panel.tsx:109` also uses `rounded-xl` where `qr-frame`
  uses `rounded-lg` + `rounded-md`.
- **Why It Is a Problem:** The single dark-mode-critical rule in the whole system ("QR stays on
  pure white") is enforced by literal `bg-white` in five files rather than by the token that exists
  to enforce it. One `bg-card` slip in dark mode makes a QR unscannable at the counter.
- **Recommended Redesign:** Route every QR through `QrFrame` (already exists) and change it to
  `bg-qr-foreground text-qr`. Make `mfa-panel` and the two `present-qr`/offers pages compose
  `QrFrame` rather than re-implementing the shell with three different radii and two different
  shadow offsets (`8px 8px` vs `shadow-md` vs `6px 6px`).
- **Priority:** High

---

## B. Typography and the micro-type scale

### 9. `<h1>` renders at six different sizes; `<h2>` at eleven
- **File(s):** `components/brand/typography.tsx:69` (`PageTitle`), `app/(auth)/login/page.tsx:80,105`,
  `app/(auth)/signup/page.tsx:81`, plus ~60 further heading sites
- **Current UX/UI Problem:** DESIGN.md declares exactly one `page-title` (30px→36px) and one
  `card-title` (16px). In practice `<h1>` ships at `text-2xl` (11×), `text-3xl` (4×), `text-xl`
  (3×), `text-4xl sm:text-6xl` (2×), `text-3xl sm:text-5xl`, `text-3xl sm:text-4xl`, and
  `text-base sm:text-lg`. `<h2>` ships at eleven distinct scales including `text-sm` (2×) — an h2
  *smaller than body copy*. `PageTitle` itself mints `text-3xl sm:text-4xl` but is then overridden
  at seven call sites with `titleClassName="text-[clamp(2.1rem,4.5vw,3.2rem)]"` and at four with
  `text-[clamp(1.75rem,4vw,2.25rem)]`.
- **Why It Is a Problem:** Heading rank is the primary scanning device on long merchant/admin
  pages. When h2 can be smaller than body text and h1 spans 18px→60px, users cannot use size to
  infer structure, and screen-reader users get a heading tree that visually contradicts itself.
- **Recommended Redesign:** Mint the DESIGN.md scale as real utilities in `@layer components`:
  `.type-hero` (the clamp, replacing both one-offs), `.type-page-title` (30/36),
  `.type-section-title` (20/24), `.type-card-title` (16). Make `PageTitle` accept
  `size?: "hero" | "page"` instead of a `titleClassName` escape hatch, and make `SectionHeader`'s
  `text-lg` the single h2. Add a lint rule banning `text-*` on `h1|h2|h3`.
- **Priority:** High

### 10. Fonts are loaded at 400/700 only, but the system specifies 500 and 800
- **File(s):** `app/layout.tsx:19-50`, `assets/fonts/`, `app/globals.css:256-265`
- **Current UX/UI Problem:** `localFont` registers exactly two Bricolage weights (400 Regular,
  700 Bold) and two Space Mono weights (400, 700). `globals.css` then sets `font-weight: 800` on
  all `h1–h6`, and `[data-slot=card-title]`, `[data-slot=empty-title]`, `[data-slot=sheet-title]`,
  `[data-slot=sidebar-menu-button]` all request 800. DESIGN.md specifies body at **500** and
  headings at **800**. Neither weight is loaded, so browsers synthesise 800 from the 700 file and
  fall back to 400 for 500.
- **Why It Is a Problem:** Synthetic bolding on a display grotesque smears the counters and
  destroys the crisp letterpress feel the whole aesthetic is built on; the difference between
  `font-bold` (700) and `font-extrabold` (800) becomes invisible, so the button/heading weight
  hierarchy collapses. `DESIGN.md` also claims the faces come from `next/font/google`, which is not
  what ships.
- **Recommended Redesign:** Ship the Bricolage Grotesque **variable** font (it is a variable family
  with a 200–800 wght axis) via a single `localFont` entry with `declarations: [{prop:
  "font-variation-settings"}]`, or add the static 500/800 instances. Then set
  `font-synthesis-weight: none` in `@layer base` so a missing weight fails loudly instead of
  silently. Correct the `next/font/google` claim in DESIGN.md.
- **Priority:** High

### 11. Twenty-one hand-rolled `text-[…]` sizes below or around the sanctioned micro scale
- **File(s):** `components/layout/customer-tab-bar.tsx:66` (`text-[0.6875rem]`),
  `components/brand/filter-pills.tsx:70` (`text-[0.625rem]`),
  `components/loyalty/reward-seal.tsx:40` (`text-[0.625rem]`),
  `components/loyalty/stamp-dot.tsx:114` (`text-[0.69rem]`/`text-[0.81rem]`),
  `components/merchant/customer-readback-table.tsx:95,231` (`text-[0.66rem]`),
  `components/customer/customer-flow-system.tsx:97,104` (`text-[1.65rem]`/`text-[2.1rem]`/`text-[0.96rem]`),
  `components/brand/kpi-tile.tsx:63` (`sm:text-[1.75rem]`),
  `components/merchant/present-qr.tsx:83` + `app/app/offers/[campaignId]/qr/page.tsx:113` (`text-[11px]`),
  `components/merchant/launch/billing-activation-asset-preview.tsx:88` (`text-[10px]`)
- **Current UX/UI Problem:** DESIGN.md: "Below `text-xs` there are exactly two sanctioned sizes…
  Do not hand-roll `font-mono text-[0.x rem] tracking-[…] uppercase` strings". Reality: 10px,
  10.5px, 11px, 11.04px, 11px, 12.96px, 15.36px, 26.4px, 28px, 33.6px are all minted ad hoc, and
  `present-qr.tsx:83` is *literally* the banned string (`font-mono text-[11px] tracking-[0.06em]`).
- **Why It Is a Problem:** 0.66rem vs 0.6875rem vs 0.625rem are indistinguishable individually and
  cumulatively make the mono register look mis-set. The customer tab bar in particular sets its
  five labels at an unnamed 11px that matches nothing else in the system.
- **Recommended Redesign:** Route every sub-`text-xs` string through `.mono-id` / `.mono-meta`.
  Add a third *spoken* micro utility `.text-micro` (11.5px Bricolage 500) for the tab bar and
  filter-pill counts, since the two existing utilities are mono-only and the tab bar labels are
  correctly Bricolage. Extend `tokens:check` from "fails below 10px" to "fails on any
  `text-[…]` that is not one of N approved values".
- **Priority:** Medium

### 12. Eleven distinct `tracking-[…]` values against a two-value contract
- **File(s):** 29× `tracking-[0.08em]`, 6× `[0.04em]`, 4× `[0.16em]`, 3× `[0.18em]`, 3× `[0.02em]`,
  3× `[0.12em]`, 3× `[0.1em]`, 3× `[-0.01em]`, 2× `[0.2em]`, 1× `[0.09em]`, 1× `[0.06em]`
- **Current UX/UI Problem:** DESIGN.md sanctions 0.06em (mono-meta/mono-id) and 0.08em (badge/tag).
  The four dev QR-preview pages all use `tracking-[0.16em]`; the OTP inputs use `[0.18em]`;
  `VenueMark`/`MemberMark` use `[0.02em]`.
- **Why It Is a Problem:** Tracking is the loudest signal of "printed" vs "spoken" register in this
  design language. Eleven values means the register is noise.
- **Recommended Redesign:** Mint `--tracking-meta: 0.06em`, `--tracking-tag: 0.08em`,
  `--tracking-code: 0.18em` (a genuine third case: OTP/serials need character separation) in
  `@theme`, then codemod everything else to the nearest of the three. Delete `[0.02em]` (it is
  visually zero) and `[0.09em]`.
- **Priority:** Low

---

## C. Buttons

### 13. Nine declared sizes, six used, and no page-level consistency
- **File(s):** `components/ui/button.tsx:38-52`; 300 call sites
- **Current UX/UI Problem:** The `size` variant declares `xs, sm, default, lg, xl, icon, icon-xs,
  icon-sm, icon-lg`. Actual usage across 300 `<Button>`/`<SubmitButton>` call sites:
  `default` 170, `lg` 70, `sm` 51, `icon` 4, `icon-sm` 4, `xs` 1. `xl`, `icon-xs` and `icon-lg`
  are never used. Worse, `lg` (h-12) and `default` (h-11) are mixed on the *same* surfaces —
  `app/how-it-works/page.tsx:102,105` uses `size="lg"` for a CTA pair while
  `components/layout/merchant-app-shell.tsx:72` uses `size="sm"` for the shell's own pair and
  `components/layout/customer-app-shell.tsx:23` uses the default. There is no rule mapping a size
  to a role.
- **Why It Is a Problem:** 44/48px CTA heights alternating page-to-page makes the product feel
  assembled rather than designed, and on the merchant console the primary action is sometimes the
  same height as a tertiary one.
- **Recommended Redesign:** Cut to four sizes: `sm` (h-9, in-row/table actions), `default` (h-11,
  everything), `lg` (h-12, page-level primary CTA only), `icon` (size-11). Delete `xs`, `xl`,
  `icon-xs`, `icon-lg`. Document the mapping in DESIGN.md § Buttons and enforce with a lint rule
  that `size="lg"` may appear at most once per route.
- **Priority:** High

### 14. The `stamp` and `reward` variants are visually identical to `default` / `Badge reward`
- **File(s):** `components/ui/button.tsx:24-29`, `app/globals.css:152,159`
- **Current UX/UI Problem:** `variant="stamp"` renders `bg-stamp text-stamp-foreground`, and
  `--stamp: var(--w-accent)`, `--stamp-foreground: var(--w-accent-ink)` — i.e. byte-identical to
  `variant="default"`'s `bg-primary text-primary-foreground`. Two variants, one pixel output.
  `variant="reward"` (19 uses) is the only non-primary filled button in the system and is leaf
  green — a *filled* colour silhouette that DESIGN.md's destructive rationale explicitly argues
  against ("primary stays the only filled red on any surface"; there is no equivalent ruling for
  leaf).
- **Why It Is a Problem:** A variant that produces no visual difference is a trap: a contributor
  picks `stamp` for semantic reasons and gets no feedback that it did nothing, and the next
  themer who diverges `--stamp` from `--primary` silently changes 10 buttons.
- **Recommended Redesign:** Delete `variant="stamp"` (alias it to `default` at the type level with
  a deprecation). Decide `reward` explicitly: either promote leaf to a documented second filled
  silhouette in DESIGN.md § Buttons, or convert it to the outline-danger treatment
  (`card ground + leaf border/text/shadow`) so the "one filled ink" rule holds.
- **Priority:** Medium

### 15. `link` variant's `rounded-none` is silently overridden to 10px by the unlayered layer
- **File(s):** `components/ui/button.tsx:31-32`, `app/globals.css:467-470`
- **Current UX/UI Problem:** The cva sets `link: "h-auto rounded-none p-0 …"` but
  `[data-slot="button"][data-variant="link"] { border-radius: var(--radius-lg) }` is unlayered and
  therefore wins. A zero-padding inline link now carries a 10px radius that has no visible effect
  except on its focus outline, which rounds off around a text run.
- **Why It Is a Problem:** Small, but it is the exact failure mode DESIGN.md warns about
  ("a utility class placed on a themed primitive will NOT win"), shipped inside the primitive
  itself. It also makes the link focus ring inconsistent with the `.focus-ring` links used in the
  marketing footer and auth prompts (which are `rounded-full`).
- **Recommended Redesign:** Drop `link` from the radius rule's selector, or set
  `border-radius: 0` for `[data-variant="link"]` explicitly. Then unify: every text-link affordance
  in the product should be `rounded-full` with the shared `min-h-11` pad, since that is what the
  17 hand-rolled link classes already do.
- **Priority:** Low

### 16. Ghost/link press travels 2px down, not the documented 1px settle
- **File(s):** `components/ui/button.tsx:16` (`active:translate-y-px`), `app/globals.css:301-303`
  (`.pressable:active { transform: translate(1px, 1px) }`)
- **Current UX/UI Problem:** Every button carries `.pressable` (transform translate 1,1) *and*
  `active:translate-y-px` (translate 0,1). For bordered variants the unlayered rule cancels the
  transform (`transform: none`) and sets `translate: 2px 2px` — correct. For **ghost and link**
  nothing cancels either, so they compose: 1px right + 2px down.
- **Why It Is a Problem:** DESIGN.md: "Ghost and link variants stay flat bar a 1px settle — never a
  scale." A diagonal 1×2 press is a different physical gesture from the 2×2 diagonal of a bordered
  button, and on the sheet close button (`variant="ghost"`) it makes the glyph drift off-centre.
- **Recommended Redesign:** Remove `active:translate-y-px` from the cva base string entirely and
  let `.pressable` own the settle; add an explicit
  `[data-slot="button"][data-variant="ghost"]:active, [data-variant="link"]:active { transform:
  translate(0,1px) }` rule so the documented behaviour is stated once.
- **Priority:** Medium

### 17. `outline` variant declares a 1px `border-input` that can never render
- **File(s):** `components/ui/button.tsx:28`, `app/globals.css:448-456`
- **Current UX/UI Problem:** `outline: "border border-input bg-background shadow-xs …"`. The
  unlayered block forces `border: 2px solid var(--w-ink)` on every non-ghost/link/destructive
  button, so both the width and the colour are dead. `shadow-xs` (2px) is likewise overwritten to
  3px. 39 call sites choose `outline` believing they are getting a lighter-weight button; they get
  a button that differs from `secondary` only by background.
- **Why It Is a Problem:** `outline` (39 uses) and `secondary` (90 uses) are nearly
  indistinguishable — paper vs deeper-paper ground under identical 2px ink borders and 3px shadows.
  Merchants pick between them arbitrarily, so secondary/tertiary hierarchy is not communicated.
- **Recommended Redesign:** Collapse `outline` into `secondary` (or make `outline` genuinely
  distinct: `bg-transparent` so the page paper shows through, and no shadow, giving a true
  tertiary rung). Strip the dead `border border-input` and `shadow-xs` tokens from the cva so the
  file reads as what it renders.
- **Priority:** Medium

---

## D. Cards and surfaces

### 18. `Card`'s stock 24px radius survives on nested images and its `ring-1` survives everywhere
- **File(s):** `components/ui/card.tsx:14` and `:31,:88`
- **Current UX/UI Problem:** The Card base string is
  `rounded-[min(var(--radius-4xl),24px)] … shadow-sm ring-1 ring-foreground/5 …
  *:[img:first-child]:rounded-t-[min(var(--radius-4xl),24px)]
  *:[img:last-child]:rounded-b-[min(var(--radius-4xl),24px)]`. The unlayered layer fixes the card's
  own radius to 10px and the shadow to 4px — but **not** the `ring-1 ring-foreground/5` (a stray
  hairline ring sitting outside the 2px ink border) and **not** the image corner rules (24px image
  corners inside a 10px card). `CardHeader:31` and `CardFooter:88` also keep 24px `rounded-t/b`.
- **Why It Is a Problem:** Any card that leads with an image renders a visible 24px/10px corner
  mismatch. The `ring-1` adds a faint 1px halo that fights the hard-edged print aesthetic on every
  one of the ~100 Card instances.
- **Recommended Redesign:** Strip `ring-1 ring-foreground/5 dark:ring-foreground/10` and replace
  the three `min(var(--radius-4xl),24px)` occurrences with `var(--radius-lg)` — or better, add
  `[data-slot="card"] > img:first-child { border-radius: var(--radius-lg) var(--radius-lg) 0 0 }`
  to the unlayered layer and delete the arbitrary utilities entirely.
- **Priority:** High

### 19. `Card`'s `overflow-hidden` clips the rotated stamp family
- **File(s):** `components/ui/card.tsx:14`; consumers `components/brand/receipt-card.tsx`,
  `components/loyalty/stamp-grid.tsx`
- **Current UX/UI Problem:** `Card` sets `overflow-hidden` on the root. Every stamp/seal/venue mark
  in the system is `rotate(-6deg)` and `WetInkSlam` scales it to **2.6×** on the way in. A slam that
  starts at 2.6× inside a card with `overflow-hidden` is clipped to the card box for the first
  ~60% of the 380ms animation.
- **Why It Is a Problem:** The stamp slam is *the* signature moment of the product. Clipping its
  overshoot turns a "slammed onto paper" beat into a "grew inside a box" beat.
- **Recommended Redesign:** Change the Card root to `overflow-clip` only where an image is present
  (`has-[>img]:overflow-hidden`), or give `ReceiptCard` a `overflow-visible` override plus explicit
  `rounded-lg` clipping on the inner content wrapper. Verify against the `/dev/design-system`
  motion playground.
- **Priority:** High

### 20. `CardTitle` renders at `text-base font-medium` and relies on CSS to fix the weight
- **File(s):** `components/ui/card.tsx:40-46`, `app/globals.css:525-527`
- **Current UX/UI Problem:** `CardTitle` = `font-heading text-base font-medium`; the layer sets
  `font-weight: 800`. So `font-medium` is dead, and a reader of the component sees a 500 title.
  `MetricTile` then overrides with `text-2xl font-extrabold` and `KpiTile` with
  `text-2xl sm:text-[1.75rem] font-extrabold` — two different KPI value scales for two components
  that sit side by side on the merchant dashboard.
- **Why It Is a Problem:** Adjacent KPI tiles at 24px and 28px read as an alignment bug. The dead
  `font-medium` misleads every future contributor.
- **Recommended Redesign:** Delete `font-medium` from `CardTitle`. Merge `KpiTile` and `MetricTile`
  into one component with a `sparkline?` and `helper?` prop — they already share `Card size="sm"
  data-elevation="flat"`, the `.eyebrow` label, the `.numeric-tabular` value and the `mono-id`
  trend line. One KPI value scale (`text-2xl`), one label min-height.
- **Priority:** Medium

### 21. `ReceiptCard`'s four padding presets fork the 14/22px spacing contract
- **File(s):** `components/brand/receipt-card.tsx:7-12`
- **Current UX/UI Problem:** `PADDING` maps `none/sm/md/lg` to `0 / 16px / 24px / 32px` via
  `--card-spacing`, while `Card` itself defaults to `--spacing(5)` = 20px and `size="sm"` to 16px.
  So a Card can have 16, 20, 24 or 32px internal padding depending on which wrapper you used, and
  DESIGN.md's stated rhythm (14px card gap, 22px section gap) matches none of them.
- **Why It Is a Problem:** Sibling cards on the same page (a `Card` beside a `ReceiptCard`) show
  visibly different internal margins, which makes a two-column merchant layout look misaligned.
- **Recommended Redesign:** Reduce to two paddings: `--card-spacing: 16px` (dense/`sm`) and `20px`
  (default). Delete `lg` (32px is the single biggest contributor to merchant page height — see §I).
  Change DESIGN.md's `card-gap: 14px` to the real shipped value or change the code to 14px, but
  make them agree.
- **Priority:** Medium

---

## E. Inputs, fields and forms

### 22. Three input heights (44/48/48) and a hand-rolled fourth well
- **File(s):** `components/ui/input.tsx:14` (`h-11`), `components/auth/auth-field.tsx:33`
  (`h-12 text-sm`), `components/forms/select-field.tsx:17` (`h-12`),
  `components/merchant/account/cancellation-interview-form.tsx:15`
- **Current UX/UI Problem:** The base `Input` is `h-11` (44px). Every auth field overrides to
  `h-12 text-sm` (48px). `SelectField` is `h-12 text-sm`. And
  `cancellation-interview-form.tsx:15` hand-rolls
  `"focus-ring min-h-11 w-full rounded-2xl border border-input bg-secondary/60 px-4 text-sm
  outline-none"` — a verbatim copy of the *stock shadcn* input string that DESIGN.md names as the
  banned anti-pattern ("do not hand-roll `rounded-xl bg-secondary/60` class strings or private
  `Field` clones"), and which will render an 18px radius + 1px hairline because it has no
  `data-slot`.
- **Why It Is a Problem:** A merchant filling the onboarding form sees 48px wells; the same
  merchant on the account page sees 44px wells; the cancellation form shows an 18px-radius,
  hairline-bordered field that belongs to a different product.
- **Recommended Redesign:** Set the base `Input` to `h-12` (48px is the better touch target for the
  counter context anyway) and delete every `h-12` override. Give the cancellation form a
  `<Textarea>`/`<SelectField>` from `components/forms`. Add a lint rule banning
  `bg-secondary/60` + `border-input` outside `components/ui`.
- **Priority:** High

### 23. Form labels are 11.5px uppercase mono
- **File(s):** `components/auth/auth-field.tsx:24` (`label={<Eyebrow>{label}</Eyebrow>}`)
- **Current UX/UI Problem:** Every auth field label ("Email", "Password", "Confirm password",
  "Email code") renders through `Eyebrow` → `.eyebrow` → 11.5px Space Mono 700 uppercase with
  0.06em tracking.
- **Why It Is a Problem:** DESIGN.md is explicit that mono/uppercase is the *printed* register
  for "IDs, codes, dates, eyebrows, feeds, metadata" and Bricolage is for "everything human". A
  field label is the most human thing on the form. Uppercase mono at 11.5px is also measurably
  slower to read and is the classic accessibility complaint for form labels (all-caps defeats word
  shape recognition, and 11.5px is below the 12px practical floor for dyslexic readers).
- **Recommended Redesign:** Move labels to `text-sm font-bold` Bricolage (the `Label` primitive's
  own register) and keep `.eyebrow` for the *section* kicker above a field group. Reserve mono for
  the OTP field's value, not its label.
- **Priority:** High

### 24. No password visibility toggle, but a "Confirm password" field on two flows
- **File(s):** `components/auth/signup-details-form.tsx:129,161`,
  `components/auth/reset-password-form.tsx:241,274`
- **Current UX/UI Problem:** Both flows render `type="password"` with no reveal control, then add a
  second `Confirm password` field to compensate. Each confirm field costs ~92px (11.5px label +
  12px gap + 48px well + 12px gap) plus its own error slot.
- **Why It Is a Problem:** This is the single clearest height + friction win available in the auth
  area. Modern guidance (NCSC, NIST 800-63B) is that a reveal toggle replaces confirmation; the
  confirm field measurably increases abandonment and adds a whole extra error state to design.
- **Recommended Redesign:** Add a `PasswordField` to `components/forms` — an `Input` with a
  `pr-12` and an `IconRoundel`-free `Button size="icon-sm" variant="ghost"` inside the well
  carrying `aria-pressed` and `aria-label="Show password"`. Delete both `confirmPassword` fields
  and their validators. Saves ~184px across the two flows and removes two error states.
- **Priority:** High

### 25. `PasswordRequirements` announces a count on every keystroke
- **File(s):** `components/auth/password-requirements.tsx:50-62`
- **Current UX/UI Problem:** A `role="status" aria-live="polite" aria-atomic="true"` paragraph
  recomputes "Password meets 1 of 3 rules" / "2 of 3" / "all 3" on every input change. The three
  rule chips above it also change colour independently, so a sighted user gets two simultaneous
  feedback channels for the same three facts.
- **Why It Is a Problem:** Polite live regions that update per keystroke queue up in screen readers
  and produce a stream of interruptions while typing. The chips already convey state visually and
  each carries its own `sr-only` "Met:"/"Not met:" prefix, so the summary is a third redundant
  channel.
- **Recommended Redesign:** Debounce the live region to fire on blur (or after 600ms idle), and
  drop the per-chip `sr-only` prefixes in favour of `aria-checked` on a `role="list"` of
  `role="listitem"`. Alternatively keep the live region and delete the chips — the summary line
  alone is far more compact (~20px vs ~44px) and reads better.
- **Priority:** Medium

### 26. `focus-ring` on `tabIndex={-1}` recovery containers never renders
- **File(s):** `components/auth/auth-form.tsx:152`, `components/auth/reset-password-form.tsx:156,311`
- **Current UX/UI Problem:** Three error-recovery blocks are `<div|form tabIndex={-1}
  className="focus-ring grid gap-3 rounded-xl">` and are focused programmatically. `.focus-ring`
  keys off `:focus-visible`, which browsers do **not** apply to programmatic focus on a
  non-interactive `tabindex="-1"` element.
- **Why It Is a Problem:** The whole point of these blocks is "an OTP failed, look here". The focus
  moves silently: sighted keyboard users see nothing change and lose their place entirely.
- **Recommended Redesign:** Switch these to `.focus-ring-within` on the visual box with a real
  focusable target inside (the resend `SubmitButton`), or change the selector to
  `[data-focus-target]:focus { outline: … }` (plain `:focus`, since programmatic focus is exactly
  the intended trigger). Also set `scroll-margin-top` so the focused block is not under the sticky
  header. Note the identical `rounded-xl` (14px) here is off-scale — see §1.
- **Priority:** High

### 27. `field.tsx` ships 240 lines of which six exports have zero consumers
- **File(s):** `components/ui/field.tsx`
- **Current UX/UI Problem:** `FieldSet`, `FieldLegend`, `FieldGroup`, `FieldTitle`, `FieldContent`
  and `FieldSeparator` have **0** consumers outside `components/ui`. `FieldSeparator` is the sole
  consumer of `components/ui/separator.tsx`, which therefore also has zero real consumers. Only
  `Field`, `FieldLabel`, `FieldDescription` and `FieldError` are reachable, all via `FormField`.
  `globals.css:647-650` even pre-themes `[data-slot="field-label"]:has(> [data-slot="field"])`
  for a choice-card pattern the comment admits has "zero consumers today".
- **Why It Is a Problem:** The forms area has no fieldset/legend grouping anywhere in the product,
  which is exactly the accessibility affordance long forms need (the signup form's four fields, the
  reset form's four, and the merchant onboarding form's many all render as flat field lists with
  no programmatic grouping).
- **Recommended Redesign:** Either delete the dead exports plus `separator.tsx`, or — better —
  *adopt* `FieldSet`/`FieldLegend` to group the auth forms ("Your details" / "Your password") and
  the merchant onboarding form. Grouping is also the cheapest height fix available: a fieldset can
  collapse to a summary row once complete (see §I.34).
- **Priority:** Medium

### 28. Two competing inline-notice systems: `Alert` (13 uses) and `StatusBanner` (113)
- **File(s):** `components/ui/alert.tsx`, `components/loyalty/status-banner.tsx`, consumers across
  auth + merchant
- **Current UX/UI Problem:** `Alert` has exactly two variants (`default`, `destructive`) and no
  icon, no tone washes. `StatusBanner` has four tones with washes and semantic icons. All five auth
  forms use bare `Alert`, and two of them (`signup-verify-form.tsx:203`,
  `reset-password-form.tsx:421`) hand-patch a success state with `className="bg-accent"` +
  `AlertDescription className="text-accent-foreground"` — i.e. a manually reconstructed success
  tone with no icon.
- **Why It Is a Problem:** The auth funnel — the highest-anxiety surface in the product — is the
  one place with the *weakest* feedback treatment: an unadorned box whose success and error states
  differ only by border colour, with no icon to carry the semantic for colour-blind users.
- **Recommended Redesign:** Give `Alert` the same four tones as `StatusBanner` in the unlayered
  layer (`[data-slot="alert"][data-variant="success"|"warning"|"info"]` washes mirroring the
  `.cn-toast` rules that already exist at `globals.css:674-688`) plus a default leading icon. Then
  make `StatusBanner` a thin wrapper over `Alert` so there is one notice anatomy, and delete the
  `bg-accent` hand-patches.
- **Priority:** High

---

## F. Feedback primitives: Badge, Empty, Skeleton, Progress, Toast

### 29. `Badge` ships 7 variants; exactly one is reachable, and its 1.5px border is defeated
- **File(s):** `components/ui/badge.tsx:9-30`, `components/brand/mono-tag.tsx:42-44`,
  `app/globals.css:362-378` (`.w-tag`)
- **Current UX/UI Problem:** `<Badge>` is used in exactly one place — inside `MonoTag`, always with
  `variant="outline"`. `default`, `secondary`, `reward`, `destructive`, `ghost` and `link` are
  dead. Separately, `.w-tag` declares `border: 1.5px solid var(--w-line)` in `@layer components`
  while the badge cva emits the `border` + `border-border` *utilities*; under Tailwind v4 utilities
  beat components, so **every `MonoTag` renders a 1px border, not the documented 1.5px**, and the
  `plain` tone's colour comes from `--border` (1.43:1 — invisible, see §4). `h-5` (20px) is also a
  fixed height fighting `.w-tag`'s `padding: 4px 11px`.
- **Why It Is a Problem:** DESIGN.md names `.w-tag` as "the metric source of truth… `.w-tag` is its
  documented alias" — but the alias and the primitive disagree, and the plain tone (used for the
  `account` activity category and every admin sidebar status tag) has no perceivable boundary.
- **Recommended Redesign:** Move the border declaration into the unlayered `[data-slot="badge"]`
  block (which already owns the font metrics) so it cannot be defeated: `border: 1.5px solid
  var(--w-line-strong)`. Remove `h-5` in favour of `min-h-5` so tall tones don't clip. Delete the
  six dead variants, or wire `reward`/`destructive` into `CategoryBadge`/`StatusPill` so they earn
  their place.
- **Priority:** High

### 30. `Empty` primitive renders no border and 48px padding; `EmptyState` overrides both
- **File(s):** `components/ui/empty.tsx:10`, `components/brand/typography.tsx:197`
- **Current UX/UI Problem:** `Empty` base = `… gap-4 rounded-3xl border-dashed p-12 …`. Tailwind's
  preflight sets `border-width: 0`, so `border-dashed` **alone draws nothing** — the primitive's
  dashed frame never renders. `EmptyState` (54 uses, the only consumer) patches it with
  `border-2 bg-card p-6`, so the base's `p-12` and `rounded-3xl` are both dead. `EmptyMedia` (with
  its `rounded-xl bg-muted` icon chip) has zero consumers; `EmptyState` hand-rolls its own
  `size-11 rounded-full border-2 border-ink bg-secondary` roundel instead of using `IconRoundel`,
  which exists for exactly this and is documented as the sanctioned framing circle.
- **Why It Is a Problem:** Two-thirds of a shipped primitive is unreachable, and the one reachable
  path duplicates `IconRoundel size="lg" tone="secondary"` character-for-character.
- **Recommended Redesign:** Fix `Empty`'s base to `border-2 border-dashed border-line-strong
  rounded-lg p-6` and delete the `EmptyState` overrides. Replace the hand-rolled roundel with
  `<IconRoundel icon={icon} size="lg" />`. Delete `EmptyMedia`.
- **Priority:** Medium

### 31. `EmptyState` renders its title as a `<div role="heading">`
- **File(s):** `components/ui/empty.tsx:64-76`, `components/brand/typography.tsx:204`
- **Current UX/UI Problem:** `EmptyTitle` is a `<div data-slot="empty-title">` and `EmptyState`
  passes `role="heading" aria-level={headingLevel}`. It is used as the `<h1>` on
  `app/app/error.tsx`, `app/app/not-found.tsx`, `app/not-found.tsx` and `app/admin/error.tsx` —
  i.e. four routes whose entire page heading is a synthetic ARIA heading.
- **Why It Is a Problem:** `role="heading"` on a div is valid but strictly weaker than a native
  element: it is excluded from some heading-navigation implementations, from `document.title`
  heuristics, and from reader-mode extraction. For a 404/500 page — where the heading *is* the
  content — this is a real loss.
- **Recommended Redesign:** Make `EmptyTitle` render a real element via an `as` prop
  (`as={`h${headingLevel}`}`), defaulting to `h2`. Remove the `role`/`aria-level` pair.
- **Priority:** Medium

### 32. `Skeleton` fill is 1.3:1 and route skeletons don't mirror their surfaces
- **File(s):** `app/globals.css:600-602`, `app/admin/loading.tsx`, `app/app/loading.tsx`,
  `components/merchant/loading-skeletons.tsx`
- **Current UX/UI Problem:** `[data-slot="skeleton"]` is `color-mix(… var(--w-ink) 13%,
  transparent)` = **1.30:1** on paper — at the very edge of perceptibility on a warm ground, and
  the only motion cue is `animate-pulse`, which is `motion-reduce:animate-none`, so reduced-motion
  users see a near-invisible static block. `app/app/loading.tsx` renders a *single* page-title
  skeleton for every `/app/*` route, so the merchant console shows one grey bar then pops an
  entire dashboard.
- **Why It Is a Problem:** A loading state that cannot be seen is a blank page; a loading state
  that does not mirror the incoming layout guarantees a full-page layout shift (CLS) on arrival.
  `app/app/scan/loading.tsx` gets this exactly right (real header, real card frame) and is the
  model — but it is the only route that does.
- **Recommended Redesign:** Raise the skeleton fill to ~20% ink (≈1.6:1) *and* add a static
  `border-2 border-dashed border-line` under `motion-reduce` so the placeholder is perceivable
  without animation. Then give the four highest-traffic `/app/*` routes their own `loading.tsx`
  built from `components/merchant/loading-skeletons.tsx` (which already contains the right
  shapes), following the `app/app/scan/loading.tsx` pattern.
- **Priority:** High

### 33. `Progress` is 8px tall with no accessible label and no indeterminate state
- **File(s):** `components/ui/progress.tsx:14-27`, `app/globals.css:576-584`
- **Current UX/UI Problem:** `h-2` (8px) default, `bg-muted`/`bg-primary` classes both dead
  (overridden to paper-2/leaf by the layer), no `aria-label`, and the indicator uses
  `translateX(-{100-value}%)` with `value || 0` — so `value={undefined}` (Radix's indeterminate
  contract) renders as a *completely empty determinate* bar rather than an indeterminate one.
- **Why It Is a Problem:** An 8px leaf bar against `--w-paper-2` on paper carries very little
  signal at a glance, and the loyalty context (progress toward a reward) is the one place where the
  bar must read instantly. The missing indeterminate state means any "we don't know yet" case
  silently renders as 0%.
- **Recommended Redesign:** Raise the default to `h-3` (12px) with a 2px ink border to match the
  system's other surfaces, require an `aria-label`, and add
  `[data-slot="progress"][data-state="indeterminate"] [data-slot="progress-indicator"]` with a
  guarded shimmer (the loading-pulse family is already sanctioned in DESIGN.md § Motion).
- **Priority:** Medium

---

## G. Sheets, sidebar and table

### 34. Bottom sheets have no max-height and no internal scroll
- **File(s):** `components/ui/sheet.tsx:20` (`data-[side=bottom]:h-auto`)
- **Current UX/UI Problem:** The bottom sheet is `inset-x-0 bottom-0 h-auto` with no `max-h` and no
  `overflow-y-auto`. Only one consumer works around it (`max-h-[min(85vh,640px)]` found in the
  customer legal sheet). Any bottom sheet whose content exceeds the viewport — the PIN pad plus a
  status band, the legal text — grows off the top of the screen with no way to reach the top.
- **Why It Is a Problem:** This is the counter moment on a phone in a busy pub. A sheet that
  overflows the viewport with the title above the fold is unrecoverable.
- **Recommended Redesign:** Add to the base:
  `data-[side=bottom]:max-h-[min(85dvh,40rem)] data-[side=bottom]:overflow-y-auto
  data-[side=bottom]:overscroll-contain` and
  `data-[side=bottom]:pb-[max(1.5rem,env(safe-area-inset-bottom))]`. Also cap the sheet width
  (`data-[side=bottom]:mx-auto data-[side=bottom]:max-w-customer`) — today a bottom sheet spans the
  full 1920px on desktop.
- **Priority:** Critical

### 35. Sheet overlay fades in 150ms while the sheet slides 320ms; and its `shadow-xl` is meaningless
- **File(s):** `components/ui/sheet.tsx:17-20`
- **Current UX/UI Problem:** `sheetOverlayClass` uses `duration-[var(--w-dur-fast)]` (150ms);
  `sheetContentClass` uses `duration-[var(--w-dur-move)]` (320ms). DESIGN.md: "sheets/moves 320ms".
  The content also carries `shadow-xl` = `6px 6px 0 ink` — a hard offset shadow on an element
  anchored flush to a viewport edge, so half of it is off-screen and the visible half reads as a
  rendering artefact. `bg-black/30` on the overlay is dead (the layer forces `rgba(33,28,22,0.5)`).
- **Why It Is a Problem:** The scrim landing 170ms before the sheet reads as two separate events
  rather than one gesture.
- **Recommended Redesign:** Move the overlay to `duration-[var(--w-dur-move)]`. Replace
  `shadow-xl` with a side-aware offset in the unlayered layer
  (`[data-side=bottom] { box-shadow: 0 -4px 0 var(--w-shadow-color) }`) or drop the shadow — the
  2px ink top border plus the scrim is already the documented treatment. Delete `bg-black/30`.
- **Priority:** Medium

### 36. `SidebarMenuButton`'s `size` prop has no effect
- **File(s):** `components/ui/sidebar.tsx:289-317` (`min-h-10` / `min-h-12`),
  `app/globals.css:731-737` (`min-height: 2.75rem`), `components/layout/console-sidebar-nav.tsx:109`
- **Current UX/UI Problem:** The component offers `size: "default" | "lg"` mapping to `min-h-10`
  (40px) and `min-h-12` (48px); the unlayered layer forces `min-height: 2.75rem` (44px) onto every
  `[data-slot="sidebar-menu-button"]`. Both values are defeated. `console-sidebar-nav.tsx:109`
  passes `size="lg"` believing it gets 48px.
- **Why It Is a Problem:** Beyond the dead API, `min-h-10` (40px) is below the documented 44px tap
  floor — the only thing saving it is the layer, which means the *component in isolation* is
  off-contract and any future non-layer consumer inherits the bug.
- **Recommended Redesign:** Delete the `size` prop and its classes; document that the layer owns
  nav-item height. If two heights are genuinely wanted, express them as
  `[data-slot="sidebar-menu-button"][data-size="lg"] { min-height: 3rem }` in the layer.
- **Priority:** Medium

### 37. The mobile nav drawer hides its close button and offers no visible dismissal
- **File(s):** `components/ui/sidebar.tsx:147-156` (`[&>button]:hidden`)
- **Current UX/UI Problem:** The mobile sidebar is a `SheetContent` with `[&>button]:hidden`,
  which suppresses the sheet's own close affordance. There is no replacement inside
  `SidebarHeader` for either shell — `MerchantAppShell` puts its `SidebarTrigger` in a
  `md:hidden` header *behind* the open drawer, and `AdminShell` does the same. Dismissal is
  overlay-tap or Escape only.
- **Why It Is a Problem:** No visible affordance to close a full-height modal drawer is a
  discoverability failure and, for switch/voice-control users who cannot reliably target the
  narrow overlay strip, a trap.
- **Recommended Redesign:** Render a close control inside `SidebarHeader` when
  `isMobile && openMobile` — `<Button variant="ghost" size="icon" aria-label="Close menu">` with
  `Cancel01Icon`, right-aligned in the existing `data-sidebar-header-row` flex.
- **Priority:** High

### 38. `Table`'s horizontal-scroll container is a focus stop with no accessible name
- **File(s):** `components/ui/table.tsx:8-15`
- **Current UX/UI Problem:** `<div data-slot="table-container" className="relative w-full
  overflow-x-auto" tabIndex={0}>` — focusable (correct, for keyboard scrolling) but with no
  `role="region"` and no `aria-label`, so a keyboard user lands on an unnamed, unannounced stop.
  Every cell also carries `whitespace-nowrap`, so wide admin tables *always* scroll horizontally
  rather than ever wrapping.
- **Why It Is a Problem:** WCAG 2.2 §4.1.2 / the standard scrollable-region pattern requires
  `role="region"` + a name when a container is made focusable. `whitespace-nowrap` on every cell
  also means the `xl` `cardBreakpoint` DESIGN.md mandates for admin consoles is doing all the
  responsive work — anything that misses it scrolls sideways at every width.
- **Recommended Redesign:** Add `role="region"` and thread the `caption` through as `aria-label`
  (`DataTable` already has one). Move `whitespace-nowrap` from `TableCell` to an opt-in
  `data-nowrap` so long text columns wrap instead of forcing scroll.
- **Priority:** High

---

## H. Shells and layouts

### 39. Only one of four shells has a skip link
- **File(s):** `components/layout/marketing-layout.tsx:74-79` (has one);
  `components/layout/merchant-app-shell.tsx`, `components/layout/customer-app-shell.tsx`,
  `components/layout/admin-shell.tsx` (none)
- **Current UX/UI Problem:** `MarketingLayout` correctly ships
  `<a href="#main" class="sr-only focus:not-sr-only …">Skip to content</a>`. The merchant console
  (behind a 17rem sidebar with ~10 nav items), the admin console (same), and the customer app
  (header + 5-item bottom tab bar) have none. In the merchant console a keyboard user tabs through
  the logo, the sidebar trigger, ~12 nav links and the log-out button before reaching page content
  — **on every navigation**.
- **Why It Is a Problem:** WCAG 2.4.1 Bypass Blocks. This is the single highest-severity a11y
  defect in the audit scope, and the fix already exists three files away.
- **Recommended Redesign:** Extract the skip-link markup into `components/layout/skip-link.tsx` and
  mount it as the first child of all four shells, targeting `SidebarInset`'s `<main>`
  (add `id="main"` there) and `CustomerAppShell`'s `<main>`. Consider a second
  "Skip to navigation" link in the console shells.
- **Priority:** Critical

### 40. `CustomerShell` uses `overflow-x-hidden`, which the codebase's own comment forbids
- **File(s):** `components/layout/customer-shell.tsx:13`, `app/globals.css:238-249`
- **Current UX/UI Problem:** `globals.css` carries a five-line comment explaining that `clip` is
  used instead of `hidden` "because `hidden` makes the element a scroll container, which silently
  breaks `position: sticky` on every descendant". `CustomerShell` then sets
  `overflow-x-hidden` on its `<main>`. Every customer route rendered through `CustomerShell` —
  `/scan`, `/home/login`, `/q/[qrId]`, `/m/[merchantSlug]` — therefore cannot host a sticky
  element.
- **Why It Is a Problem:** The customer journey is the one place a sticky "Add stamp" / status band
  would matter most, and the mechanism is silently disabled. `MerchantAppShell:64,103` uses
  `overflow-x-clip` correctly, so the two shells behave differently for identical markup.
- **Recommended Redesign:** Change to `overflow-x-clip`. Grep for the same slip elsewhere.
- **Priority:** High

### 41. Four different full-height conventions across shells and boundaries
- **File(s):** `min-h-svh` (13 uses: `app/error.tsx`, `app/not-found.tsx`, `admin/layout.tsx`,
  `customer-app-shell.tsx:15`, `merchant-app-shell.tsx:62`, `sidebar.tsx:123`),
  `min-h-[100dvh]` (5: `marketing-layout.tsx:71`, `customer-shell.tsx:13`),
  `min-h-[50vh]` (`app/admin/error.tsx`, `app/app/error.tsx`),
  `min-h-[60dvh]` (`app/home/(authed)/error.tsx`)
- **Current UX/UI Problem:** `svh`, `dvh` and `vh` are three different behaviours on mobile Safari
  (small / dynamic / large viewport). The marketing layout and customer shell use `dvh`
  (grows and shrinks with the URL bar); the app shells use `svh` (stable, smallest). Error
  boundaries pick `50vh` or `60dvh` arbitrarily.
- **Why It Is a Problem:** A user navigating marketing → signup → console sees the page's
  full-height behaviour change under them as the URL bar collapses, producing a visible jump.
- **Recommended Redesign:** Standardise on `min-h-svh` for shells (stable, no jump) and delete the
  `[100dvh]` arbitraries. For error boundaries, use a single `.state-panel` utility
  (`grid min-h-[24rem] place-items-center py-10`) rather than three viewport fractions.
- **Priority:** Medium

### 42. `AdminShell` is 80rem wide while `MerchantAppShell` is 72rem
- **File(s):** `components/layout/admin-shell.tsx:103` (`max-w-7xl`),
  `components/layout/merchant-app-shell.tsx:104,183` (`max-w-merchant`)
- **Current UX/UI Problem:** DESIGN.md declares one console measure — "merchant 1152px
  (`max-w-merchant`)". Admin uses `max-w-7xl` (1280px), which is the *marketing chrome* width. The
  two consoles share a sidebar, a nav component, a record-card system and seven table patterns, but
  not a content measure.
- **Why It Is a Problem:** Admin tables get 128px more line length than merchant tables for the same
  `AdminRecordCard` component, so column proportions diverge and the shared abstraction stops
  producing a shared result.
- **Recommended Redesign:** Change to `max-w-merchant`. If admin genuinely needs a wider measure for
  8-column tables, mint `--container-console-wide: 80rem` and document it in DESIGN.md § Layout
  rather than reusing the marketing token by number.
- **Priority:** Medium

### 43. `AdminShell` has no desktop sidebar control and no `hideMobileChrome` parity
- **File(s):** `components/layout/admin-shell.tsx:40,83-90` vs
  `components/layout/merchant-app-shell.tsx:118,127-131`
- **Current UX/UI Problem:** Admin uses `collapsible="offcanvas"` and places its only
  `SidebarTrigger` inside an `md:hidden` header, so on desktop the 17rem sidebar can never be
  collapsed — on a 1280px laptop that is 21% of the width permanently spent on nav for tables that
  scroll horizontally (§38). Merchant uses `collapsible="icon"` with a `hidden md:flex` trigger and
  a cookie-persisted state.
- **Why It Is a Problem:** Admin is the *denser* of the two consoles, so it is the one that needs
  the reclaimable width more.
- **Recommended Redesign:** Switch admin to `collapsible="icon"`, mirror the merchant header-row
  trigger and the `sidebar_state` cookie seed, and reuse the same
  `data-collapse-hide`/`data-collapse-label` hooks that `globals.css:804-825` already implements.
- **Priority:** Medium

### 44. `AdminShell` sidebar footer stacks four `MonoTag` chips of pure decoration
- **File(s):** `components/layout/admin-shell.tsx:54-80`
- **Current UX/UI Problem:** The footer stacks `Operator: …` plus three static strings
  ("Service-role readbacks", "Audited support actions", "MFA-aware access") plus a verified tag —
  five truncating pills, each ~28px + `gap-2`, ≈170px of permanently-consumed sidebar height. The
  three middle items are never-changing marketing copy inside an internal tool.
- **Why It Is a Problem:** It pushes the operator identity and the MFA state — the two facts that
  actually matter — into a wall of identical pills, and it forces the nav list to scroll sooner on
  short laptops.
- **Recommended Redesign:** Delete the three static `supportStatusItems`. Keep the operator email
  (truncated, with `title`) and the AAL tag as a single row: `MemberMark` initials + email +
  tone chip. Reclaims ~120px.
- **Priority:** Medium

### 45. `PageTitle` fakes baseline alignment with `md:pt-8`
- **File(s):** `components/brand/typography.tsx:87`
- **Current UX/UI Problem:** The `actions` slot is `flex flex-wrap gap-2 md:justify-self-end
  md:pt-8` — a hard-coded 32px top pad chosen to bottom-align the buttons against a title that has
  an eyebrow. When `eyebrow` is omitted (which the API allows and several routes do), the actions
  float 32px below the title's baseline for no reason.
- **Why It Is a Problem:** Conditional-by-coincidence alignment; every page without an eyebrow has a
  subtly misaligned header action.
- **Recommended Redesign:** Replace with `md:items-end` on the grid and `md:self-end` on the
  actions, or make the pad conditional: `eyebrow && "md:pt-8"`.
- **Priority:** Low

### 46. `CustomerAppShell` reserves 128px of bottom padding for a 56px tab bar
- **File(s):** `components/layout/customer-app-shell.tsx:30` (`pb-32`),
  `components/layout/customer-tab-bar.tsx:52` (`min-h-14` + `pb-[env(safe-area-inset-bottom)]`)
- **Current UX/UI Problem:** The tab bar is 56px plus safe area (≤34px on iPhone) = ~90px worst
  case. `main` reserves `pb-32` = 128px, and the tab bar has no shadow or overhang. On a 667px
  iPhone SE viewport that is ~40px of dead space at the bottom of *every* customer screen.
- **Why It Is a Problem:** The customer column is the tightest real estate in the product (410px ×
  a phone viewport) and the loyalty card is meant to fill it.
- **Recommended Redesign:** `pb-[calc(3.5rem+env(safe-area-inset-bottom)+1rem)]`, or set a
  `--tab-bar-h: 3.5rem` variable on the shell and use `pb-[calc(var(--tab-bar-h)+env(safe-area-inset-bottom)+0.75rem)]`
  so the two values can never drift.
- **Priority:** Medium

### 47. The marketing footer is a 4-column, 13-link, 44px-per-row block on every page
- **File(s):** `components/layout/marketing-layout.tsx:101-131`
- **Current UX/UI Problem:** The non-focused footer renders a `grid-cols-2 lg:grid-cols-4` nav with
  13 links, each `min-h-11` (44px), plus a 5-link legal row (also `min-h-11` each, wrapping to 2–3
  rows on a phone), plus the identity row. On a 390px viewport: 2 columns × 7 rows × 44px = ~616px,
  plus ~40px of headings, plus a ~132px legal/identity block ≈ **790px of footer** — taller than
  the viewport, on every marketing page.
- **Why It Is a Problem:** Nearly a full screen of chrome at the end of every page, most of it
  duplicating the header nav and the "Guides" cluster that has three entries.
- **Recommended Redesign:** On mobile, collapse the four columns into `<details>` accordions
  (`summary` = the column heading, `min-h-11`), with only "Product" open by default — cuts to
  ~250px. On `lg:` keep the 4-up grid but tighten `gap-y-5 → gap-y-2` and drop the per-link 44px
  floor to `min-h-9` with `py-1.5` (footer links are not primary targets; WCAG 2.5.8's 24px
  minimum is the applicable floor, and inline-list spacing already provides separation). Merge
  "Guides" into "Product".
- **Priority:** High

---

## I. Loading, error and not-found states

### 48. No error boundary moves focus or announces itself
- **File(s):** `app/error.tsx`, `app/global-error.tsx`, `app/admin/error.tsx`, `app/app/error.tsx`,
  `app/home/(authed)/error.tsx`, `app/home/login/error.tsx`, `app/scan/error.tsx`,
  `app/m/[merchantSlug]/error.tsx`, `app/q/[qrId]/error.tsx`, `app/reward/[rewardId]/error.tsx`,
  `app/card/[membershipId]/error.tsx` (11 boundaries)
- **Current UX/UI Problem:** Every boundary renders a static panel. None carries `role="alert"`,
  none focuses its heading or its retry button on mount. A screen-reader or keyboard user whose
  content was replaced by an error gets no signal at all — focus stays wherever it was, often on a
  node that no longer exists.
- **Why It Is a Problem:** An unannounced content replacement is the classic SPA a11y failure. It
  is also a UX failure for sighted users on long pages: the error may render above the fold while
  the user is scrolled elsewhere.
- **Recommended Redesign:** Add a shared `ErrorBoundaryPanel` in `components/brand` that wraps
  `EmptyState`, sets `role="alert"`, and focuses its heading (`tabIndex={-1}` + `useEffect` focus)
  on mount. Use it in all 11 boundaries — they currently duplicate two nearly-identical shapes
  (`CustomerErrorState` × 5, inline `EmptyState` × 4).
- **Priority:** High

### 49. `global-error.tsx` speaks a different design system
- **File(s):** `app/global-error.tsx:20-38`
- **Current UX/UI Problem:** The panel is `rounded-lg border-2 border-ink bg-card p-6 shadow-xs`
  (2px offset, not the card's 4px) and the button is `rounded-md` (6px), `h-11`, `border-2
  border-ink bg-primary` with **no** shadow and no press behaviour. So the last-resort page shows a
  6px-radius, shadowless button next to a 2px-elevation card — three deviations from the contract
  in ten lines.
- **Why It Is a Problem:** The comment says it "stays deliberately minimal… while still speaking
  Wet Ink through the token classes" — but the token classes it picked are the wrong rungs. It is
  also the one page a user might screenshot and send to support.
- **Recommended Redesign:** Use `surface-card p-6` and give the button the exact `.pressable`
  recipe: `pressable inline-flex h-11 w-full items-center justify-center rounded-lg border-2
  border-ink bg-primary px-4 font-bold text-primary-foreground shadow-sm`. These are all plain
  utilities/`@layer components` classes with no component imports, so the "no brand imports"
  constraint is preserved.
- **Priority:** Medium

### 50. Loading fallbacks use `role="status"` on a container with no `aria-live` guarantee and no `aria-busy`
- **File(s):** `app/admin/loading.tsx:12-16`, `app/app/loading.tsx:11-15`,
  `app/app/scan/loading.tsx:14-19`
- **Current UX/UI Problem:** All three set `role="status" aria-label="Loading …"`. `role="status"`
  is an implicit `aria-live="polite"` region, but the label is set at mount time on a region that is
  *replaced wholesale* when content arrives — so nothing is ever announced (the live region is
  removed, not updated). There is no `aria-busy` on the surrounding region either.
- **Why It Is a Problem:** Screen-reader users get silence during the load and silence on arrival.
- **Recommended Redesign:** Keep the visual skeleton but move the announcement to a persistent
  `<p class="sr-only" aria-live="polite">` in the shell whose text is driven by
  `useLinkStatus()`/`usePathname` — announce "Loading" and then the new page title. The
  `NavPendingIndicator` in `console-sidebar-nav.tsx:132` already reads `useLinkStatus`, so the hook
  is available.
- **Priority:** Medium

### 51. Four route-level `not-found` variants with three different container recipes
- **File(s):** `app/not-found.tsx:12` (`grid min-h-svh place-items-center px-6 py-10` +
  `max-w-sm`), `app/app/not-found.tsx:15` (`mx-auto grid max-w-xl gap-6 px-6 py-10 sm:px-0 sm:py-0`),
  `app/app/qr/poster/[template]/not-found.tsx`, plus 4 more scoped ones
- **Current UX/UI Problem:** Seven `not-found.tsx` files, three container patterns, two heading
  levels, and `sm:px-0 sm:py-0` in one of them (padding that vanishes at `sm`, so the merchant 404
  is flush against the shell edge on tablet+ while the root 404 is centred at `min-h-svh`).
- **Why It Is a Problem:** 404s are already a moment of disorientation; inconsistent framing
  compounds it, and the `sm:py-0` case produces a visibly broken layout at exactly the width where
  the shell padding does not compensate.
- **Recommended Redesign:** One `NotFoundPanel` composition with a `variant: "page" | "in-shell"`
  prop — `page` = `grid min-h-svh place-items-center px-6 py-10`, `in-shell` = `grid place-items-center
  py-12` (the shell already pads). Delete the `sm:px-0 sm:py-0`.
- **Priority:** Low

---

## J. Auth flows — length, grouping and affordance

### 52. The reset-password confirm step is ~840px tall on a phone
- **File(s):** `components/auth/reset-password-form.tsx:167-348`
- **Current UX/UI Problem:** Counting the rendered stack at 390px: read-only "Venue email" field
  (~92px) + "Reset code" field (~92px) + "New password" field (~92px) + `PasswordRequirements`
  (~48px: a wrapping 3-chip row + a summary line) + "Confirm password" (~92px) + submit (~44px) +
  `gap-4` × 6 (~96px) + the recovery block: optional alert (~64px) + countdown line (~20px) +
  ghost resend button (~44px) + two-line help text (~40px) + "Wrong email? Use a different email"
  (~44px, wraps to 2 rows) + "Remembered it? Back to log in" (~44px) + `gap-3` × 5 (~60px).
  **≈ 840–900px**, i.e. ~1.3 viewports, for a task with one real input (the code) and one real
  decision (the new password).
- **Why It Is a Problem:** The user arrives here from an email, in a hurry, usually one-handed. The
  primary action ("Set new password") sits below the fold on every phone, under a read-only field
  they cannot change and a validator they have not yet triggered.
- **Recommended Redesign:** (a) Replace the read-only email `AuthField` with a compact summary row —
  `<div class="flex items-center justify-between gap-2 py-2"><span class="eyebrow">Venue
  email</span><span class="text-sm font-bold truncate">…</span></div>` — saves ~60px; (b) delete
  "Confirm password" in favour of a reveal toggle (§24) — saves ~92px; (c) collapse
  `PasswordRequirements` to the single summary line, expanding only on focus/error — saves ~28px;
  (d) merge the three trailing escape hatches into one row of two inline links — saves ~90px;
  (e) move the resend control behind a `<details>` "Didn't get the code?" summary — saves ~70px.
  Net ≈ **340px**, bringing the form to a single viewport with the submit visible.
- **Priority:** High

### 53. `SignupVerifyForm` renders three escape-hatch paragraphs containing four 44px links
- **File(s):** `components/auth/signup-verify-form.tsx:235-255`
- **Current UX/UI Problem:** After the OTP field and verify button the page renders: an email-echo
  panel above (~64px), a resend form with a ghost button + two-line help (~90px), then
  "Wrong email? *Back to sign up*", then "Used this email before? *Log in* or *reset your
  password*". Each inline link is `inline-flex min-h-11 px-3 py-2` — so the last sentence is three
  44px pill-shaped links inside a flowing paragraph, which on a 390px viewport wraps to **three
  lines of 44px each** ≈ 132px for one sentence.
- **Why It Is a Problem:** 44px-tall inline links inside running prose break the line rhythm badly
  (the text baseline jumps), and three competing recovery paths at the bottom of a verification
  screen is decision paralysis at the worst moment.
- **Recommended Redesign:** Keep exactly one inline recovery link ("Wrong email?") and move the
  other two into a single `<details class="w-rule">` "Having trouble?" disclosure. For inline links
  inside prose, drop the `min-h-11` pill and use `underline underline-offset-4 focus-ring
  rounded-sm` — WCAG 2.5.8 explicitly exempts inline links in a sentence from the target-size
  minimum. Saves ~110px and restores the paragraph baseline.
- **Priority:** High

### 54. `AuthPromptLink` is duplicated verbatim in three files
- **File(s):** `components/auth/auth-form.tsx:208-228` (`SwitchPromptLink`),
  `components/auth/signup-details-form.tsx:208-228`, `components/auth/signup-verify-form.tsx:284-304`,
  plus two more inline copies in `components/auth/reset-password-form.tsx:342,358`
- **Current UX/UI Problem:** The same 5-line component with the identical class string
  `"focus-ring inline-flex min-h-11 items-center rounded-full px-3 py-2 font-bold text-primary
  underline-offset-4 hover:bg-accent hover:text-accent-foreground hover:underline"` exists five
  times. `auth-form.tsx:128` has a sixth near-copy that drops `py-2` and the hover background.
- **Why It Is a Problem:** Six copies means six places to fix, and the sixth has already diverged
  (no hover ground), so the "Forgot password?" link behaves differently from every other auth link.
- **Recommended Redesign:** One exported `AuthLink` in `components/auth/`, or better a general
  `TextLink` in `components/brand` — the marketing footer's `footerLinkClass` and the 17 other
  `focus-ring … text-primary underline-offset-4` strings across the product are the same component.
- **Priority:** Medium

### 55. OTP resend is a borderless ghost button whose label reflows every second
- **File(s):** `components/auth/otp-resend-control.tsx:32,41-50`
- **Current UX/UI Problem:** The default `variant="ghost"` gives the resend control no border, no
  ground and no shadow — the weakest affordance in the button inventory — for the action a stuck
  user most needs. While cooling down it is `disabled` (50% opacity → ~2.25:1, see §0) and its
  label becomes `"Resend code in 43s"` → `"…42s"`, changing the text width every second on a
  `w-full` centred button.
- **Why It Is a Problem:** A disabled, low-contrast, borderless control that also visibly twitches
  reads as broken rather than as "wait a moment". `reset-password-form.tsx:162` already overrides
  to `variant="default"` for the same component, proving the default is wrong.
- **Recommended Redesign:** Default to `variant="secondary"` (bordered, on-contract). Keep the
  label fixed at "Resend code" and move the countdown to a separate `numeric-tabular` line below
  (`Available in 43s`) so the button never reflows. Replace `disabled` with `aria-disabled` +
  an inert click handler so the control keeps its contrast and stays focusable/announceable.
- **Priority:** High

### 56. Both auth flows use banned "create an account" copy
- **File(s):** `components/auth/signup-details-form.tsx:190,194`
- **Current UX/UI Problem:** The submit is "Create account" and the switch prompt is "Already have
  an account? Log in". DESIGN.md § Brand & Style: "signup language is banned… Never 'register',
  'create an account'."
- **Why It Is a Problem:** Whether the ban was intended to cover the merchant lane or only the
  customer lane, the contract as written is violated and the copy is the one thing the design
  system is most explicit about. It is also inconsistent with the surrounding page, which says
  "Start your launch" three times.
- **Recommended Redesign:** "Start your launch" / "Already launched? Log in". If the ban is meant
  to be customer-only, scope the sentence in DESIGN.md explicitly — an unqualified prohibition that
  production violates is worse than no rule.
- **Priority:** Medium

---

## K. Motion layer

### 57. `WetInkMarquee` pauses on hover only — no operable pause control
- **File(s):** `components/motion/wet-ink.tsx:470-502`, `lib/motion/tokens.ts` (`marquee.duration: 26`)
- **Current UX/UI Problem:** DESIGN.md claims the marquee "pauses on an explicit operable control
  where it runs beyond five seconds". The implementation pauses on `onPointerEnter` /
  `onPointerLeave` only. There is no button, no keyboard path, and no `prefers-reduced-motion`
  *pause* (reduced motion stops it entirely, which is correct, but that is a different user).
- **Why It Is a Problem:** WCAG 2.2.2 (Pause, Stop, Hide) requires a *mechanism* for content that
  moves automatically for more than 5 seconds. A 26-second loop with hover-only pause fails for
  keyboard and touch users, and the DESIGN.md claim states the opposite of what ships.
- **Recommended Redesign:** Render a real `<Button size="icon-sm" variant="secondary"
  aria-pressed={paused} aria-label="Pause the ticker">` adjacent to the strip, wired to the same
  `pausedRef`, and hoist `paused` to state so the button can reflect it. Keep hover pause as an
  extra.
- **Priority:** High

### 58. `WetInkRipple` returns `null`, breaking the documented host-invariance rule
- **File(s):** `components/motion/wet-ink.tsx:433-458`
- **Current UX/UI Problem:** `if (!shouldAnimate || !active) return null`. DESIGN.md § Motion:
  "Every primitive renders static children under `prefers-reduced-motion`… The primitive host
  element is invariant across hydration, active/inactive, and reduced-motion states: animation
  props may change, the React/DOM node type may not."
- **Why It Is a Problem:** The mount/unmount changes the sibling index of anything after it in a
  layout, and it is a documented invariant that the library itself breaks — which undermines trust
  in the other nine primitives' guarantees.
- **Recommended Redesign:** Render the `m.span` unconditionally with
  `animate={shouldAnimate && active ? {…} : {opacity: 0, scale: 0.4}}` and `pointer-events-none`.
  Or amend DESIGN.md to carve out decorative-only leaves explicitly.
- **Priority:** Low

### 59. `WetInkWiggle` / `WetInkBreathe` are documented as one-shot but read as loops in the token file
- **File(s):** `lib/motion/tokens.ts` (wiggle 2.6s, breathe 3.2s), `components/motion/wet-ink.tsx:358-427`
- **Current UX/UI Problem:** Neither primitive sets `repeat`, so both are genuinely one-shot —
  which matches DESIGN.md ("bounded one-shot invites"). But `wiggle`'s token block carries no
  comment (unlike `breathe`, which explains the one-shot decision), and the primitive's own docstring
  says "Rotates gently ±3° **on a loop**". Only `marquee` sets `repeat: Infinity` — and
  `WetInkMarquee` doesn't consume `repeat` at all (it drives a motion value by hand), so that token
  field is dead.
- **Why It Is a Problem:** A docstring that contradicts the behaviour is how the next contributor
  adds `repeat: Infinity` to "fix" it and reintroduces an infinite loop on a transaction surface —
  the exact thing DESIGN.md forbids.
- **Recommended Redesign:** Fix the `WetInkWiggle` docstring to "one bounded ±3° tease, then
  rests". Delete `repeat: Infinity` from the `marquee` token (unused). Add a unit assertion that no
  `wetInkTransition` entry contains `repeat`.
- **Priority:** Low

### 60. The global reduced-motion rule nukes `transition-duration` on *everything*, including press feedback
- **File(s):** `app/globals.css:903-919`
- **Current UX/UI Problem:** `*, *::before, *::after { transition-duration: 0.01ms !important }`.
  This kills every colour/border transition in the product — including hover feedback on nav items,
  focus-border swaps on inputs, and the deliberate 90ms press release that DESIGN.md calls "the
  system-wide signature". The block then re-adds a *transform* for `.pressable:active` but not the
  timing.
- **Why It Is a Problem:** `prefers-reduced-motion` targets vestibular triggers — large-area
  movement, parallax, zoom. Colour and border-colour transitions are explicitly *not* in scope, and
  removing them makes the UI feel jumpy and cheap for the users who opted in. It also defeats the
  carefully-tuned `--w-dur-press` release that the design system treats as its identity.
- **Recommended Redesign:** Narrow the rule to the properties that actually move things:
  `transition-property: transform, translate, scale, rotate; transition-duration: 0.01ms !important`
  applied via a scoped selector, and keep `animation-duration`/`iteration-count` as-is. Leave
  colour/border/opacity transitions alone.
- **Priority:** Medium

---

## L. Cross-cutting accessibility, responsiveness and theming

### 61. `enableSystem` is on while dark mode is an untested dormant capability
- **File(s):** `components/theme-provider.tsx:53-58`, `app/layout.tsx:93-97`, `app/globals.css:197-232`
- **Current UX/UI Problem:** `NextThemesProvider attribute="class" defaultTheme="light"
  enableSystem`. DESIGN.md: "Dark mode is a dormant capability, deliberately… no user-facing toggle
  exists and none is planned." Only **4** `dark:` variants exist in the entire product
  (`badge.tsx` ×2, `card.tsx` ×1, `stat-strip.tsx` ×1), so no component has been designed against
  the dark palette. The `viewport.themeColor` already ships a dark entry, and `.dark` overrides
  `--w-shadow-color`, `--destructive`, `--seal-foreground`, `--reward-foreground`. Meanwhile no
  `color-scheme` property is declared anywhere, so native scrollbars, `<select>` popups and date
  pickers stay light regardless.
- **Why It Is a Problem:** `enableSystem` is one config flag away from shipping an unvalidated
  theme to every dark-OS user — and it is the flag most likely to be flipped by someone "enabling
  system theme". The four `dark:` variants also mean any dark render will have bugs no one has seen
  (e.g. `bg-white` QR frames are correct, but `text-paper/70` on `bg-ink` inverts to dark-on-dark).
- **Recommended Redesign:** Set `enableSystem={false}` and `forcedTheme="light"` at the root, and
  pass `enableHotkey`/`forcedTheme={undefined}` only from `/dev/design-system` (the provider already
  accepts overrides). Add `color-scheme: light` to `:root` and `color-scheme: dark` to `.dark`.
  Keep the token block — it is documented as intentional — but make the runtime path explicit.
- **Priority:** High

### 62. `focus-visible` recipe is sound, but seven interactive surfaces opt out of it
- **File(s):** `app/globals.css:438-443` (the recipe — good);
  `components/merchant/customer-readback-table.tsx:213` (`outline-none`, no `.focus-ring`),
  `components/merchant/dashboard-next-actions.tsx:72` (`border-transparent`, no `.focus-ring`),
  `components/customer/legal-sheet.tsx:98` (`outline-none` on a `tabIndex` section),
  `components/merchant/present-qr.tsx:44`, plus the three `tabIndex={-1}` cases in §26
- **Current UX/UI Problem:** The system has exactly one focus recipe and it computes to 3.72:1 —
  genuinely good. But `outline-none` appears on 7 interactive elements without a `.focus-ring`
  companion. `customer-readback-table.tsx:213` is a `<summary>`-like control with
  `outline-none` and nothing else; `dashboard-next-actions.tsx:72` is a clickable row that relies on
  `border-2 border-transparent` + `transition-colors` with no focus state declared.
- **Why It Is a Problem:** These are the merchant console's primary drill-down rows — a keyboard
  user tabbing the dashboard sees the focus indicator vanish entirely on the most important
  controls.
- **Recommended Redesign:** Add `.focus-ring` to all seven. Then add a lint rule (or a
  `tokens:check` assertion) that `outline-none` may only appear on the same element as
  `focus-ring`, `focus-ring-within`, `pressable`, or `data-slot="input|textarea"`.
- **Priority:** High

### 63. Compact sizes honour 44px on coarse pointers — except the four that don't
- **File(s):** `components/ui/button.tsx:39-51` (correct: `[@media(pointer:coarse)]:min-h-11`),
  `components/brand/filter-pills.tsx:56` (correct);
  **not** honoured: `components/ui/badge.tsx:9` (`h-5`, and `[a]:hover` variants make it a link),
  `components/ui/sidebar.tsx:311` (`min-h-10`), `components/ui/table.tsx:88` (`h-10` head cells with
  interactive sort/action content), `components/layout/marketing-layout.tsx:13` (footer links are
  44px but the legal row wraps them to 2px gaps, violating the *spacing* half of 2.5.8)
- **Current UX/UI Problem:** The `[@media(pointer:coarse)]:min-h-11` pattern is a genuinely good
  idea, applied in exactly two places. `Badge` is 20px tall and supports `asChild` + `[a]:hover`
  styling, i.e. it is designed to be a link — at 20px.
- **Why It Is a Problem:** A 20px tappable pill on a phone misses on roughly one tap in three.
- **Recommended Redesign:** Extract the pattern into a `.tap-floor` utility in `@layer components`
  (`@media (pointer: coarse) { min-height: 2.75rem; min-width: 2.75rem }`) and apply it to any
  `Badge` rendered with `asChild`, plus the sidebar menu button and any interactive table cell.
- **Priority:** High

### 64. `Icon` sizes are passed as numbers, producing 9 distinct glyph sizes with no scale
- **File(s):** `components/brand/icon.tsx:18` (`size = 20`), call sites passing 10, 13, 14, 16, 18,
  20, 22, and `Math.round(size*0.5)` in `venue-mark.tsx:64`
- **Current UX/UI Problem:** `Icon` takes a numeric `size`. Across the product that number is 10,
  13, 14, 16, 18, 20 and 22 — including 13 (`MonoTag`, `KpiTile`) and 14 (`MetricTile`) for
  adjacent surfaces, and `strokeWidth` overrides of 2, 2.25 and 2.5 alongside them. DESIGN.md
  specifies "2px stroke" as the house default with no exceptions listed.
- **Why It Is a Problem:** 13px vs 14px glyphs on neighbouring KPI tiles, at 2.25 vs 2.25 stroke,
  is a visible weight mismatch in a design language built on consistent line weight. Non-integer
  stroke widths also render unevenly on non-retina displays.
- **Recommended Redesign:** Replace the numeric `size` with a token scale
  (`xs:14 | sm:16 | md:20 | lg:24`), keep `strokeWidth` at 2 with no per-call override, and
  document the four sizes in DESIGN.md § Iconography. Codemod the 13/14/18/22 call sites to the
  nearest rung.
- **Priority:** Medium

### 65. `Section` and `ContrastBand` own marketing rhythm, but nothing owns console/customer rhythm
- **File(s):** `components/layout/section.tsx:21-28` (5 sizes: `py-7 sm:py-10`, `py-4 sm:py-10`,
  `py-4 sm:py-5`, `py-3 sm:py-4`, `py-0`), `components/layout/contrast-band.tsx:21-26` (3 more),
  vs the 26 distinct `py-*` values elsewhere
- **Current UX/UI Problem:** Marketing has a real, well-documented rhythm owner ("was a per-file
  `py-12 sm:py-16` scattered across ~16 components"). The merchant console, admin console and
  customer app have none: `merchant-app-shell.tsx:176` hard-codes `px-4 py-8 pb-16 sm:px-6
  md:pb-10`, `admin-shell.tsx:102` `px-4 py-8 sm:px-6`, `customer-app-shell.tsx:30` `px-4 pt-6
  pb-32 sm:px-6`, and every page then adds its own `grid gap-6` / `gap-8` / `space-y-4`.
- **Why It Is a Problem:** The consoles are the long, tall surfaces — the ones where a rhythm owner
  pays off most. Eight different vertical gaps between panels on one dashboard reads as drift.
- **Recommended Redesign:** Mint `<ConsoleSection size="default"|"dense">` mirroring
  `Section`'s API (`gap-5` / `gap-8`, one `scroll-mt`) and route every `/app/*` and `/admin/*` page
  section through it. Also unify the three shell paddings to one
  `px-4 py-6 sm:px-6 sm:py-8` (the `py-8` → `py-6` change alone reclaims 16px on every console
  page).
- **Priority:** Medium

### 66. `Section size="default"` is `py-7 sm:py-10` while `ContrastBand` is `py-9 sm:py-12`
- **File(s):** `components/layout/section.tsx:22`, `components/layout/contrast-band.tsx:22`
- **Current UX/UI Problem:** Two sibling rhythm owners on the same marketing page use 28/40px and
  36/48px respectively. `ContrastBand`'s own docstring explains it carries no margin so its border
  provides separation — but then it pads 8px more than its neighbours, so an ink band always reads
  as slightly taller than the section above it for no semantic reason.
- **Why It Is a Problem:** Sections on the same page having different internal rhythm is exactly
  the drift `Section` was created to eliminate.
- **Recommended Redesign:** Make `ContrastBand` consume `Section`'s `sizePad` map directly
  (export it) so the two can never diverge, and set `default` to `py-8 sm:py-11` for both.
- **Priority:** Low

### 67. `numeric-tabular` exists and is used 42 times, but the countdowns don't use it
- **File(s):** `app/globals.css:352-354`; `components/auth/otp-resend-control.tsx:48`,
  `components/auth/signup-verify-form.tsx:181`;
  vs `components/auth/reset-password-form.tsx:316` (uses raw `tabular-nums`)
- **Current UX/UI Problem:** The `.numeric-tabular` utility exists specifically so digits do not
  jitter. The three per-second countdowns — `Resend code in {n}s`, `Try again in {n}s`,
  `Try this code again in {n}s` — are the only strings in the product that update every second, and
  two of them omit it; the third uses the raw Tailwind `tabular-nums` instead of the house utility.
- **Why It Is a Problem:** Proportional digits make a 1-second tick visibly shuffle the whole
  sentence, which reads as instability at exactly the moment the user is anxious.
- **Recommended Redesign:** Add `.numeric-tabular` to all three, and delete the raw `tabular-nums`
  in favour of the utility (or delete the utility in favour of `tabular-nums` — but pick one; the
  utility is a one-line alias with no added value).
- **Priority:** Low

---

## Top 5 highest-impact changes

1. **Ship a skip link in all four shells (§39) and restore focus indication on the seven
   `outline-none` controls (§62).** Two small, mechanical fixes that together resolve the only
   Critical/High WCAG failures in the shared layer. Merchant console keyboard users currently tab
   through ~14 chrome controls before reaching content on every single navigation.

2. **Cap and scroll the bottom sheet (§34).** `data-[side=bottom]:max-h-[min(85dvh,40rem)]
   overflow-y-auto overscroll-contain max-w-customer mx-auto`. The counter moment — a PIN pad on a
   customer's phone — can currently grow off the top of the viewport with no recovery. One line in
   `sheet.tsx`.

3. **Collapse the surface zoo to `.surface-card` + two variants, and delete the four extra radius
   rungs (§1, §2, §18).** 153 hand-rolled cards producing 22 radius/shadow combinations is the
   single largest source of "this looks unfinished" across every page. `.surface-card` already
   exists and is correct; this is a codemod plus a `tokens:check` rule, and it makes elevation
   semantic again.

4. **Load the real 500 and 800 font weights (§10) and mint the type scale as named utilities
   (§9).** Every heading in the product is currently faux-bolded from a 700 file, and `<h1>` ships
   at six sizes while `<h2>` ships at eleven — including an `<h2>` at `text-sm`. Fixing the font
   loading is a five-line change with a product-wide visual payoff; the scale utilities stop the
   drift recurring.

5. **Cut the auth funnel's height by ~35% (§24, §52, §53, §55).** Reveal-toggle instead of
   "Confirm password", a summary row instead of a read-only email field, one recovery link instead
   of four, and a `<details>` for the resend block. This takes the reset-password confirm step from
   ~870px to ~530px — a single viewport with the submit button visible — and removes two error
   states and a full field from the flow.

---

## Cross-cutting patterns (repeated offenders)

**P1 — "The unlayered layer will fix it."** Fourteen distinct dead declarations ship inside
`components/ui/*` because the Wet Ink layer overrides them: `Button`'s `rounded-full`,
`border border-input`, `shadow-xs`; `Input`/`Textarea`'s `rounded-2xl border-input bg-secondary/60`;
`Card`'s `rounded-[…24px]` and `shadow-sm`; `CardTitle`'s `font-medium`; `Progress`'s `bg-muted` and
`bg-primary`; `Sheet`'s `bg-black/30`; `SidebarMenuButton`'s `min-h-10/12`; `Empty`'s
`rounded-3xl`; `SheetTitle`'s `font-medium`. Two of them are *not* actually overridden and ship
visibly wrong (Card's `ring-1` and its 24px image corners, §18). The layer is the right
architecture; the primitives should be pruned to match it so a reader can trust the file.

**P2 — The right abstraction exists and is bypassed.** `.surface-card` (57 used / 153 bypassed),
`IconRoundel` (bypassed by `EmptyState` and 6 other hand-rolled framing circles), `QrFrame`
(bypassed by 3 QR surfaces), `.mono-meta`/`.mono-id` (bypassed by 21 `text-[…]` sites),
`.numeric-tabular` (bypassed by the 3 countdowns that need it most), `shadow-hard` (bypassed by 4
spellings of the same offset), `SelectField` (bypassed by
`cancellation-interview-form.tsx:15`'s stock-shadcn clone). In almost every case the bypass is
*worse* than the abstraction — this is a discoverability problem, not a capability gap. A short
"reach for this, not that" table at the top of DESIGN.md plus `tokens:check` assertions would close
most of it.

**P3 — Declared-but-unreachable API surface.** `field.tsx`: 6 of 10 exports unused;
`separator.tsx`: fully unreachable; `empty.tsx`: `EmptyMedia` unused and `Empty`'s own
padding/border unreachable; `Badge`: 6 of 7 variants unused; `Button`: 3 of 9 sizes and 1 of 8
variants unused (`stamp` is byte-identical to `default`); `card.tsx`: `CardAction` unused;
`table.tsx`: `TableFooter` unused; `sheet.tsx`: `SheetFooter` unused; ~8 CSS custom properties with
no consumer. Roughly 400 lines of shipped, maintained, type-checked code that nothing renders — and
it actively harms decision-making, because a contributor scanning `button.tsx` sees nine sizes and
picks one at random.

**P4 — Colour tokens without a contrast partner.** `--seal`/sun (1.80:1 as text), `--primary` on
`--secondary` (4.05:1), `--border`/`--input` (1.43:1), `.eyebrow` on the ink band (1.85:1),
disabled at 50% opacity (~2.25:1). In every case the palette exposes a foreground/background pair
that cannot legally be combined, and in three of the five a component has already discovered this
and shipped an inline `color-mix` workaround. Each spot ink needs a documented "text partner" and a
documented "fill partner", and `tokens:check` should assert every declared pairing.

**P5 — Vertical rhythm has an owner on marketing and nowhere else.** `Section` (5 sizes) and
`ContrastBand` (3 sizes) discipline the marketing lane — and even they disagree by 8px (§66). The
merchant console, admin console, customer app and auth funnel have 26 distinct `py-*` values, 16
distinct `gap-*` values, and three shell paddings between them. The tallest surfaces in the product
are the ones with no rhythm owner. The highest-leverage structural fixes are all vertical:
`<details>` for the marketing footer (~540px, §47), progressive disclosure in the auth funnel
(~340px, §52–53), tighter shell padding (~16px/page, §65), and the customer shell's over-reserved
`pb-32` (~40px, §46).

**P6 — Contract drift between DESIGN.md and the implementation.** DESIGN.md says fonts come from
`next/font/google` (they are local, at the wrong weights); that the marquee has an operable pause
(hover only); that compact sizes grow to 44px on coarse pointers (2 of 6 do); that `.w-tag` is 1.5px
(renders 1px); that `--radius-sheet` is the sheet radius (it is not a utility); that every primitive
keeps its host node (`WetInkRipple` returns null); and that "create an account" is banned copy (it
ships). A design contract that production contradicts in seven places is a document people stop
reading. Each of these is a one-line fix in either the doc or the code — but they should be
reconciled deliberately, and `tokens:check` extended to guard the ones that are mechanically
checkable.

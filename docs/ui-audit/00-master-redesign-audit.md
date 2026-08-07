# Nabaperks — Full Interface Redesign Audit

**Scope:** 434 `.tsx` files across marketing, customer app, merchant console, admin back-office,
shared design system. **Method:** component-by-component read of JSX + className strings against
`DESIGN.md` and `app/globals.css` (Wet Ink), with measured heights and grep-quantified inconsistency.

**Total findings: 347** — 33 Critical / 131 High / 146 Medium / 37 Low.

| Area | Findings | Crit | High | Med | Low |
|---|---|---|---|---|---|
| A. Marketing & legal | 69 | 4 | 25 | 31 | 9 |
| B. Customer journey | 70 | 10 | 29 | 26 | 5 |
| C. Merchant console | 67 | 5 | 20 | 34 | 8 |
| D. Admin & data display | 74 | 11 | 29 | 27 | 7 |
| E. Design system & a11y | 67 | 3 | 28 | 28 | 8 |

## Measured page heights (375px phone)

| Surface | Height | Viewports |
|---|---|---|
| `/loyalty-for-pubs` | ~8,500-9,000px | ~13 |
| `/home/activity` (40 rows) | ~5,800px | ~9 |
| `/` landing | ~5,400px | ~8 |
| `/how-it-works` | ~4,600px | ~7 |
| `/pricing` | ~3,500px | ~5 |
| `/app` dashboard | ~1,800px | ~4.6 |
| `/app/qr` print channel | ~2,400px | ~3.6 |
| `/card/[id]/stamp` | ~1,100px | primary control at y900 |
| Marketing footer (every route) | ~650px | — |

## Quantified inconsistency (full-codebase grep)

- **22** distinct radius+shadow combinations for "the Wet Ink card"; **153** hand-rolled surfaces vs **57** using the existing `.surface-card`
- **10** distinct `rounded-*` values against a 3-shape contract; **26** distinct `py-*` section values
- `<h1>` at **6** sizes; `<h2>` at **11** sizes (including an `<h2>` at `text-sm`)
- **591-606** arbitrary Tailwind values; **11** `tracking-[…]` values against a 2-value contract
- **21** hand-rolled micro type sizes below the sanctioned scale
- `Badge` ships **7** variants, **1** reachable; `Button` ships **9** sizes, **6** used, `stamp` byte-identical to `default`
- **~74 of 141** CSS custom properties have zero `var()` consumers
- **113** `StatusBanner` vs **13** `Alert` — two competing inline-notice systems
- Only **4** `dark:` variants product-wide while `enableSystem` is on
- `active:` variants: **10** occurrences / 8 files (press feedback largely absent outside Button)

---



# A. Marketing & Legal Surface (16 public routes)

# Nabaperks — UX/UI Redesign Audit
## Area 01: Public marketing + legal surface

**Scope:** `app/page.tsx`, `/pricing`, `/how-it-works`, `/about`, `/faq`, `/start`, `/demo`,
`/loyalty-for-{pubs,bars,cafes,takeaways}`, `/guides/*`, `/terms`, `/privacy`, `/cookies`,
`/merchant-terms`, `/data-processing`, `/offline`, `components/marketing/**`,
`components/layout/{marketing-layout,marketing-header-nav,contrast-band,section}.tsx`,
`components/legal/legal-document-page.tsx`.

**Method:** read-only source review against `DESIGN.md` (Wet Ink) and `app/globals.css`. No files
were modified, no builds or tests run. Heights below are estimated from the actual class strings
(padding scale, line-height, item counts pulled from `lib/marketing/facts.ts`) at a 375 × 667 phone.

**Baseline measurements used throughout**

| Surface | Composition | Est. mobile height |
|---|---|---|
| `/` (landing) | 8 bands + footer | **≈ 5,400 px ≈ 8 viewports** |
| `/how-it-works` | 8 bands + footer | **≈ 4,600 px ≈ 7 viewports** |
| `/pricing` | 6 bands + footer | **≈ 3,500 px ≈ 5 viewports** |
| `/loyalty-for-pubs` | hero + 8 guide sections + footer | **≈ 8,500–9,000 px ≈ 13 viewports** |
| `/privacy` | 12 clauses, single 880 px measure | **≈ 3,200 px** |
| Marketing footer (every page) | 4 link columns @ `min-h-11` + legal row | **≈ 620–660 px** |

---

## A. Global marketing chrome — `components/layout/*`

### 1. Primary navigation is entirely absent below 768 px
- **File(s):** `components/layout/marketing-header-nav.tsx:28-49`; `components/layout/marketing-layout.tsx:80-90`
- **Current UX/UI Problem:** the nav list is `className="hidden items-center gap-1 md:flex"`, and the
  "Log in" button is `className="max-sm:hidden"`. So on a phone the sticky header contains only the
  `Logo` and a single `size="sm"` "Start your launch" button. How it works, Pricing, FAQ and Log in
  are unreachable from the header. The component's own docblock says "the footer carries the full
  link set — no hamburger, so the header never traps focus on the acquisition path."
- **Why It Is a Problem:** on `/` the footer is ~5,400 px below the fold. A mobile visitor who wants
  the price must either scroll eight viewports or guess a URL. Between 640–767 px the layout is
  worse still: "Log in" appears but the three content links do not, so the header advertises a
  secondary action while hiding all primary ones. Avoiding a focus trap is a solved problem
  (`Sheet` already ships in `components/ui`), not a reason to ship zero mobile navigation.
- **Recommended Redesign:** keep the no-hamburger stance but add a second chrome row below `md`: a
  full-bleed `overflow-x-auto` pill rail under the header bar carrying How it works · Pricing · FAQ ·
  Log in as `min-h-11` chips (the `SnapRail` idiom already exists in this codebase), or a persistent
  bottom `sticky` action bar with `Pricing` + `Start your launch`. Failing that, mount the existing
  `Sheet` primitive behind a `size="icon"` menu button and let Radix own focus.
- **Priority:** Critical

### 2. The marketing footer is a 650 px tax on every page
- **File(s):** `components/layout/marketing-layout.tsx:101-131`, `12-13`, `20-57`
- **Current UX/UI Problem:** `FOOTER_COLUMNS` renders 4 headings and 13 links, each link
  `inline-flex min-h-11 items-center rounded-full px-3`, in a `grid grid-cols-2 gap-x-3 gap-y-5`
  until `lg:grid-cols-4`. On a phone: column 1 has 5 × 44 px links, column 2 has 3, column 3 has 3,
  column 4 has 2 — two grid rows ≈ 400 px — plus a 5-link legal nav that wraps to ~3 rows of 44 px
  (≈ 140 px), plus the identity block and motto. Total ≈ 620–660 px.
- **Why It Is a Problem:** the footer alone is a full mobile viewport, repeated on 16 public routes.
  It is also, per finding 1, currently the *only* navigation on a phone — so the site's nav is a
  650 px wall at the bottom of an 8-viewport page.
- **Recommended Redesign:** below `sm`, collapse each `FooterColumn` into a native
  `<details><summary class="eyebrow min-h-11">` disclosure (zero JS, matches the `FaqList` and
  `GuaranteeStack` idiom already in the repo) and leave only "Company" open; keep the 4-across grid
  from `sm:` up rather than `lg:`. Drop the legal nav to a single wrapped `text-sm` sentence with
  inline `·` separators instead of five 44 px pills — legal links are low-frequency and do not need
  primary tap targets. Expected saving: ~350 px on every page.
- **Priority:** High

### 3. `Section` size tokens do nothing on desktop and collapse into each other on mobile
- **File(s):** `components/layout/section.tsx:21-28`
- **Current UX/UI Problem:** the scale is `default: "py-7 sm:py-10"`, `dense: "py-4 sm:py-10"`,
  `compact: "py-4 sm:py-5"`, `tight: "py-3 sm:py-4"`. `default` and `dense` are **identical from
  `sm:` up** (`py-10` both), and `dense` and `compact` are **identical below `sm`** (`py-4` both).
  So a page that alternates `size="default"` and `size="dense"` (e.g. `/`) has no rhythm at all on
  desktop, and a page that alternates `dense` and `compact` (`/pricing`, `persona-page`) has no
  rhythm at all on mobile.
- **Why It Is a Problem:** the component's whole stated purpose is "the single owner of marketing
  vertical rhythm", but three of five tokens are aliases of each other at one breakpoint or the
  other. Authors reach for `dense` believing they are compressing and get nothing. It is why
  `/how-it-works` and `persona-page` read as one undifferentiated stack.
- **Recommended Redesign:** make the scale monotonic and actually distinct at both breakpoints,
  e.g. `default: "py-8 sm:py-14"`, `dense: "py-5 sm:py-9"`, `compact: "py-3 sm:py-6"`,
  `tight: "py-2 sm:py-3"`. Then sweep call sites: the page should open at `default` and step down.
  Also add `sm:px-8` — `px-6` is currently fixed at every width while the header uses `px-4 sm:px-6`.
- **Priority:** High

### 4. Content gutter does not match chrome gutter, so the logo never aligns with the H1
- **File(s):** `components/layout/section.tsx:53`; `components/layout/marketing-layout.tsx:81`, `101`
- **Current UX/UI Problem:** `Section` is `mx-auto w-full scroll-mt-24 px-6` (24 px, all widths).
  The header container is `px-4 py-3 sm:px-6` (16 px on mobile) and the footer container is `px-6`.
  `ContrastBand`'s inner is `px-6`.
- **Why It Is a Problem:** on every phone the ✱ logo sits 8 px left of the hero headline and the
  footer text. It is a small thing that makes the whole page read as slightly untidy, and it is
  visible on the very first paint of the highest-traffic surface.
- **Recommended Redesign:** unify on one responsive gutter token — `px-5 sm:px-6 lg:px-8` — applied
  by `Section`, `ContrastBand`, and both `marketing-layout` containers. Also add
  `max-w-marketing-chrome` alignment: chrome is 1280 px and content is 1152 px, so the logo is
  64 px outside the content column on desktop; that is defensible but should be deliberate.
- **Priority:** Medium

### 5. Four different sticky/scroll-margin offsets for one 68 px header
- **File(s):** `components/layout/section.tsx:53` (`scroll-mt-24` = 96 px);
  `components/marketing/pubs/guide-section.tsx:25` (`scroll-mt-28` = 112 px);
  `components/legal/legal-document-page.tsx:72` (`scroll-mt-28`);
  `components/marketing/pubs/guide-spine.tsx:59` (`lg:top-24` = 96 px);
  `components/legal/legal-document-page.tsx:36` (`lg:top-20` = 80 px)
- **Current UX/UI Problem:** the actual sticky header is `py-3` around a `min-h-11` logo ≈ **68 px**.
  Anchors clear it by 96 px in one place, 112 px in another; sticky asides pin at 96 px on the hub
  and 80 px on legal pages.
- **Why It Is a Problem:** jumping to `/#pricing`, `#options` or `#data-retention` produces a
  different amount of dead space each time, and the two sticky rails sit on different baselines.
  On the pub hub the `IntersectionObserver` uses yet a fifth number: `rootMargin: "-96px …"`.
- **Recommended Redesign:** mint one `--marketing-header-h: 4.25rem` custom property in
  `globals.css`; drive `scroll-mt`, both `lg:top-*` values, and the observer `rootMargin` from it
  (`scroll-mt-[calc(var(--marketing-header-h)+1rem)]`). One number, five consumers.
- **Priority:** Medium

### 6. Header nav pills use `rounded-full` outside the sanctioned circle exceptions
- **File(s):** `components/layout/marketing-header-nav.tsx:38`; `components/layout/marketing-layout.tsx:13`
- **Current UX/UI Problem:** nav links and footer links are `rounded-full`, while the `Button` beside
  them is forced to `border-radius: var(--radius-lg)` (10 px) by the unlayered
  `[data-slot="button"]` rule in `globals.css`. So the header shows a 9999 px pill immediately
  next to a 10 px key.
- **Why It Is a Problem:** DESIGN.md · Shapes reserves full circles for the stamp family and names
  the exceptions explicitly ("customer tab-bar chips, join stepper discs, the poster-chrome guidance
  chip, and the legal-link halo family… the list does not grow without updating this contract").
  The public header nav is not on that list. It also makes the active state (`bg-accent`) read as a
  soft SaaS pill rather than a printed key.
- **Recommended Redesign:** switch both `NAV_ITEMS` links and `footerLinkClass` to
  `rounded-(--radius-md)` (6 px) so they read as smaller siblings of the 10 px button, keeping
  `min-h-11` and the `focus-ring`. If the pill is genuinely wanted, add the marketing nav to the
  named exception list in DESIGN.md rather than leaving it as silent drift.
- **Priority:** Low

### 7. Skip link radius and border are one-offs
- **File(s):** `components/layout/marketing-layout.tsx:74-79`
- **Current UX/UI Problem:** `focus:rounded-md focus:border-2 focus:border-ink focus:bg-card
  focus:px-4 focus:py-2 focus:text-sm focus:font-bold` — 6 px radius, no offset shadow, no
  `focus-ring` outline recipe.
- **Why It Is a Problem:** the one element a keyboard-only user meets first is the one element that
  does not look like the system: every other bordered surface carries `--radius` 10 px and a hard
  offset shadow, and every other focusable element carries the 2 px vermillion outline.
- **Recommended Redesign:** `focus:rounded-(--radius-lg) focus:border-2 focus:border-ink
  focus:bg-card focus:shadow-sm focus:min-h-11 focus:inline-flex focus:items-center` and add the
  `focus-ring` class so it inherits the single sanctioned outline recipe.
- **Priority:** Low

### 8. `ContrastBand` has only three sizes and is used twice, at two unrelated densities
- **File(s):** `components/layout/contrast-band.tsx:21-26`; `app/how-it-works/page.tsx:74`;
  `components/marketing/landing/scarcity-band.tsx:13`
- **Current UX/UI Problem:** the band ships `default: "py-9 sm:py-12"`, `dense: "py-6 sm:py-12"`,
  `compact`. `/how-it-works` uses the implicit `default` (36 px mobile) and `ScarcityBand` uses
  `dense` (24 px). Both sit between `Section`s padded at `py-4`/`py-7`, so the ink band's own padding
  is 1.5–2× its neighbours' and it reads as a chapter break rather than a peer section.
- **Why It Is a Problem:** the band's docblock explicitly says it carries no margin "which removes
  the single biggest source of dead vertical space" — but it then reintroduces the same problem via
  oversized internal padding. Two ink bands on `/pricing` + `/how-it-works` cost ~140 px of pure
  padding between them.
- **Recommended Redesign:** align `ContrastBand`'s inner padding to the `Section` scale exactly
  (`default: "py-8 sm:py-14"` etc.) and let the 2 px ink border do the separating. Make the two
  call sites use the same size so the ink band means one thing.
- **Priority:** Medium

---

## B. Landing page `/` — composition, length and repetition

`app/page.tsx:55-63` renders: `LandingHero` → `Marquee` → `ProofLine` → `CommercialEvidenceProof`
→ `ProductMoment` → `FitNote` → `LandingPricing` → `FinalCta`. Eight bands, ~5,400 px on a phone.

### 9. Marquee and ProofLine are adjacent and say the same four things
- **File(s):** `app/page.tsx:57-58`; `components/marketing/marquee.tsx:4-9`;
  `components/marketing/landing/proof-line.tsx:10-15`
- **Current UX/UI Problem:** the marquee scrolls `["One venue QR", "28-day platform pilot",
  "No POS setup", "Fast at the counter"]`. The `ProofLine` immediately below it renders
  `[BRAND.pointOfView, "A browser-based loyalty card — no app to download", "Return visits shown in
  your dashboard", SCARCITY.capLine]`. Both are four short bold claims; the marquee is
  `aria-hidden="true"` so it contributes nothing to AT or SEO; `ProofLine`'s own docblock calls
  itself "the page's first break in rhythm" — but it is the *second* consecutive fact strip.
- **Why It Is a Problem:** ~215 px of stacked vertical space for one idea, delivered twice, one copy
  of which is invisible to half the audience and costs a `requestAnimationFrame` loop. It also
  breaks the "value before friction" voice rule by front-loading marketing assertions before the
  product has been shown.
- **Recommended Redesign:** delete the `Marquee` from `/` (keep it on `/how-it-works` where its items
  genuinely mirror the five launch steps) and merge the two into one strip. Render `ProofLine` as a
  `grid grid-cols-2 gap-x-6 divide-x-2 divide-dashed sm:grid-cols-4` with the mono `✱` between
  items so the riso texture survives without the animation. Saving ≈ 120 px + one client component.
- **Priority:** High

### 10. `FinalCta` restates the hero headline verbatim and stacks against the pricing CTA
- **File(s):** `components/marketing/landing/final-cta.tsx:17-27`;
  `components/marketing/landing/hero.tsx:30-31` (`LANDING.hero.headline`);
  `components/marketing/landing/landing-pricing.tsx:64-71`
- **Current UX/UI Problem:** hero H1 = "Give your weekend crowd a reason to come back on a Tuesday".
  `FinalCta` H2 = "Give your weekend customers a reason to come back midweek". `FinalCta` body is
  `{PLAN_LINE} {OFFER.riskFraming}` — `OFFER.riskFraming` is *also* the description of
  `GuaranteeStack` and `PLAN_LINE` restates the pricing card directly above. Both bands are
  `size="dense"` (`py-4`) so there are 32 px between the pricing CTA and a second CTA card.
- **Why It Is a Problem:** the page closes by paraphrasing its own opening, in a card, 12 px from an
  identical `size="lg"` "Start your launch" button. It reads as padding, and it makes the pricing
  band feel unfinished (why would the CTA need repeating one card later?).
- **Recommended Redesign:** delete `FinalCta` as a band and fold its two useful assets —
  `Eyebrow "Ready when you are"` and `PRODUCT.cancelLine` — into the `LandingPricing` sheet footer.
  If a closing beat is wanted, make it a single `ContrastBand size="compact"` with one line and one
  button, no card, no eyebrow, no repeated cancel line. Saving ≈ 340 px.
- **Priority:** High

### 11. `ProductMoment` is a 1,100 px single-column band until 1024 px
- **File(s):** `components/marketing/landing/product-moment.tsx:26`
- **Current UX/UI Problem:** `className="grid gap-8 pt-8 sm:pt-10 lg:grid-cols-3 lg:gap-10"`. The
  three beats (QR ≈ 176 px + caption block, `StampGrid` ≈ 120 px + caption, `RewardTicket` ≈ 150 px
  + caption) stack full-width at every width below `lg`. Each beat's visual is capped at
  `max-w-[11rem]` / `max-w-[13rem]` and centred via `grid flex-1 place-items-center`, so on a 768 px
  tablet you get three 176 px objects floating in 768 px of white space over ~900 px of scroll.
- **Why It Is a Problem:** this is the page's *one dominant composition* per its own docblock, and it
  is the single tallest band on `/`. Three tiny centred glyphs stacked vertically read as three
  unrelated illustrations, not one three-beat sequence — the horizontal relationship *is* the
  meaning ("scan → stamp → reward").
- **Recommended Redesign:** go horizontal much earlier: `grid-cols-3 gap-4 sm:gap-8` from the base
  breakpoint (the objects are ≤ 208 px, they fit three-across at 375 px if the captions go below the
  row), or `sm:grid-cols-3`. Add a dashed connector (`before:` rule) between beats so the sequence
  reads. Expected saving: **≈ 600 px on mobile, ≈ 700 px on tablet.**
- **Priority:** High

### 12. Every multi-column marketing layout jumps 1 → N at `lg`, so tablets render as phones
- **File(s):** `product-moment.tsx:26` (`lg:grid-cols-3`); `guarantee-stack.tsx:40`
  (`lg:grid-cols-2`); `scarcity-band.tsx:14` (`lg:grid-cols-[7fr_5fr]`);
  `commercial-evidence-proof.tsx:24` (`lg:grid-cols-3`); `pub-fit-test.tsx:20` (`lg:grid-cols-2`);
  `persona-page.tsx:138` (`lg:grid-cols-2`); `app/how-it-works/page.tsx:75`, `94`;
  `hero.tsx:26`, `process-hero.tsx:34`, `pub-guide-hero.tsx:39` (all `lg:grid-cols-…`)
- **Current UX/UI Problem:** eleven layouts in scope use `lg:` (1024 px) as their *first* column
  break, with no `sm:` or `md:` step. Tailwind's `md` (768 px) is used nowhere in the landing family
  except `landing-pricing.tsx:33`.
- **Why It Is a Problem:** iPad portrait (768/810), half-screen laptop windows, and Surface-class
  devices — a material share of B2B traffic — get the 375 px composition rendered at 768 px: single
  column, `max-w-md` paragraphs marooned in white space, and the full mobile page height. It is the
  single biggest systemic cause of excess vertical height on this surface.
- **Recommended Redesign:** introduce a `md:` step everywhere: two-up content becomes
  `md:grid-cols-2`, three-up becomes `sm:grid-cols-2 lg:grid-cols-3`, hero splits become
  `md:grid-cols-[5fr_6fr]`. This is a mechanical sweep and would cut roughly 35–45 % off tablet
  height across `/`, `/how-it-works`, `/pricing` and `/loyalty-for-pubs` with no copy changes.
- **Priority:** Critical

### 13. `CommercialEvidenceProof` blocks the whole landing render and vanishes with no fallback
- **File(s):** `app/page.tsx:59`; `components/marketing/landing/commercial-evidence-proof.tsx:12-15`
- **Current UX/UI Problem:** `export async function CommercialEvidenceProof()` awaits
  `getPublishedCommercialEvidence()` and is rendered **directly** in `app/page.tsx` with no
  `<Suspense>` boundary. `if (!cases.length) return null` — the section disappears silently.
- **Why It Is a Problem:** (a) time-to-first-byte for the entire landing page, including the hero, is
  gated on a database read that only affects band four; (b) when there is no approved evidence the
  page loses its only third-party proof and the layout collapses without any substitute, so the
  reader goes hero → fact strip → product demo with nothing in between; there is no empty state.
- **Recommended Redesign:** wrap the band in `<Suspense fallback={<EvidenceSkeleton />}>` so the hero
  streams immediately (the repo already has `Skeleton` with guarded pulse). Replace the bare `null`
  with an honest fallback that the brand voice supports — e.g. the "What you can check"
  `ProofStrip` — so the slot is never structurally empty.
- **Priority:** High

### 14. Heading scale on `/` is three unrelated sizes for the same rank
- **File(s):** `product-moment.tsx:23` (`h2 text-3xl sm:text-4xl`); `fit-note.tsx:18` and
  `final-cta.tsx:17` (`h2 text-2xl sm:text-3xl`); `components/brand/typography.tsx:117`
  (`SectionHeader` → `h2 text-lg`, used by `landing-pricing.tsx:28` and
  `commercial-evidence-proof.tsx:19`)
- **Current UX/UI Problem:** on one scroll a reader meets `h2` at **18 px** (Pricing, Merchant
  evidence), **24 px** (Built for one kind of pub, the closing CTA) and **36 px** (This is the whole
  thing). `SectionHeader`'s `h2` is fixed `text-lg` with no responsive step at all, so on a 1440 px
  desktop the "Pricing" heading is 18 px — smaller than the 20 px `text-lg` reward name inside the
  card beneath it.
- **Why It Is a Problem:** heading size is the reader's only map of a long page. Three sizes for one
  rank means the page has no visible hierarchy; the 18 px variant actively inverts it (section
  heading smaller than in-card titles). DESIGN.md declares exactly two display sizes
  (`marketing-hero` 56 px, `page-title` 30/36 px) and it is honoured in none of these.
- **Recommended Redesign:** give `SectionHeader` a `size` prop (`"band"` → `text-2xl sm:text-3xl`,
  `"panel"` → `text-lg`) and default marketing bands to `"band"`. Then pin the whole surface to
  three steps only: H1 `text-4xl sm:text-[3.5rem]` (56 px, per the token), band H2
  `text-2xl sm:text-3xl`, card H3 `text-base sm:text-lg`. Delete every ad-hoc `text-3xl sm:text-4xl`.
- **Priority:** High

### 15. Hero headline scale skips the whole tablet range and misses its own token
- **File(s):** `components/marketing/landing/hero.tsx:30`; `process-hero.tsx:38`
- **Current UX/UI Problem:** `text-4xl leading-[1.03] … sm:text-6xl` — 36 px below 640 px, 60 px at
  and above. DESIGN.md's `marketing-hero` token is **56 px**. `max-w-xl` (576 px) means the 60 px
  headline wraps to 3–4 lines at 640–1024 px.
- **Why It Is a Problem:** a 24 px jump at a single breakpoint is a visible layout snap on resize,
  and a 4-line 60 px headline at 700 px viewport is 250 px of headline before any content. The
  token drift (60 vs 56) also means the design contract and the code disagree on the single most
  prominent type object on the site.
- **Recommended Redesign:** `text-[clamp(2.25rem,6vw,3.5rem)]` — fluid from 36 px to the 56 px token
  with no snap — and widen the measure to `max-w-[16ch] sm:max-w-[20ch]` so line count stays at 2–3
  at every width. Apply identically to `process-hero.tsx` and `pub-guide-hero.tsx` (see finding 33).
- **Priority:** Medium

### 16. The hero's secondary action is a 20 px-tall tap target
- **File(s):** `hero.tsx:40-45`; also `process-hero.tsx:48-53`, `fit-note.tsx:31-36`,
  `pub-guide-hero.tsx:57-59`, `options-matrix.tsx:134-138`, `guide-page.tsx:114-119`
- **Current UX/UI Problem:** `className="focus-ring rounded-sm text-sm font-bold text-foreground
  underline underline-offset-4"` on a `<Link>` — no `inline-flex`, no `min-h-11`, no padding. The
  rendered hit area is the text box: ~14 px tall, ~150 px wide, sitting on the same baseline as a
  48 px `size="lg"` button.
- **Why It Is a Problem:** DESIGN.md · Layout & Spacing: "Primary tap targets ≥ 44px". This is the
  hero's only route to the live demo — arguably the highest-intent secondary action on the site —
  and it fails WCAG 2.5.8 (Target Size Minimum, 24 px) as well as the house rule. The pattern is
  repeated at six call sites.
- **Recommended Redesign:** mint one `marketingTextLink` class:
  `focus-ring inline-flex min-h-11 items-center rounded-(--radius-md) px-1 text-sm font-bold
  underline underline-offset-4` and use it at all six sites. Alternatively use
  `<Button variant="link" size="default">`, which already carries `.pressable`'s 2.75 rem
  `min-height` and the shared focus recipe.
- **Priority:** High

### 17. The hero sample card runs an infinite animation with no pause mechanism
- **File(s):** `components/marketing/landing/hero-sample-card.tsx:59-63`;
  `components/loyalty/use-stamp-journey-loop.ts:32-85`
- **Current UX/UI Problem:** `useStampJourneyLoop(3)` schedules
  `520 ms + 3 × 780 ms + 420 ms + 2600 ms ≈ 5.9 s` per cycle and calls `resetCycle()` forever. The
  card is mounted on `/` **and** on `/loyalty-for-pubs` (`pub-guide-hero.tsx:82`). There is no pause
  or stop control. By contrast `WetInkMarquee` explicitly pauses on `onPointerEnter` precisely
  because "auto-moving content that runs longer than 5 s needs a user pause mechanism (WCAG 2.2.2)".
- **Why It Is a Problem:** the same WCAG criterion applies to the card loop, which is longer-running
  and far more visually assertive (stamps slam, a seal reveals) than the mono strip that got the
  pause treatment. `prefers-reduced-motion` is honoured, but 2.2.2 requires a mechanism for users
  who have not set that flag. It also keeps a `setTimeout` chain alive for the whole session.
- **Recommended Redesign:** add a `min-h-11` mono toggle beneath the card ("Pause the demo" /
  "Play") wired to the existing `shouldReduceMotion` short-circuit, and stop the loop when the card
  leaves the viewport (`IntersectionObserver` — the pattern already exists in `guide-spine.tsx`).
  Also give the marquee a real focusable pause control: `onPointerEnter` alone is not reachable by
  keyboard, and the wrapper is `aria-hidden` and non-focusable.
- **Priority:** High

### 18. `ProofLine` renders four sentences as an unseparated wrapped stack
- **File(s):** `components/marketing/landing/proof-line.tsx:19-27`
- **Current UX/UI Problem:** `<ul className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y-2
  border-ink py-3">` with `<li className="text-sm leading-6 font-bold">`. `SCARCITY.capLine` and
  `BRAND.pointOfView` are full clauses, so on a 375 px screen all four wrap to their own lines with
  8 px between them and no bullet, rule, or mono marker.
- **Why It Is a Problem:** four bold 14 px sentences stacked 8 px apart inside one ink-bordered box
  read as a single run-on paragraph in bold — the worst possible legibility treatment. The
  `items-center` + `gap-x-6` layout only works at ≥ 1024 px where all four fit on one line.
- **Recommended Redesign:** `grid grid-cols-1 divide-y-2 divide-dashed divide-border sm:grid-cols-2
  sm:divide-y-0 sm:divide-x-2 lg:grid-cols-4`, each cell `py-2 sm:px-4`, and prefix each with a
  `mono-id` index (`01`–`04`) so it reads as a printed fact ledger — the receipt idiom the page
  already owns.
- **Priority:** Medium

### 19. `FitNote` is a centred grey block with no visual anchor
- **File(s):** `components/marketing/landing/fit-note.tsx:16-38`
- **Current UX/UI Problem:** `<div className="mx-auto grid max-w-2xl justify-items-center gap-5
  text-center">` — an H2, a bare `<ul className="grid gap-1.5">` of three unmarked lines each
  `text-base leading-7`, a muted paragraph, and a 20 px underlined link. No card, no border, no
  eyebrow, no icons.
- **Why It Is a Problem:** it is the only centred, chromeless band on `/`, sandwiched between the
  heavily-composed `ProductMoment` and the bordered `LandingPricing` sheet, so it reads as a page
  break rather than a self-selection gate. The three `LANDING.fit.lines` are qualification criteria
  rendered as an unmarked list — the reader cannot tell they are a checklist.
- **Recommended Redesign:** make it a left-aligned two-column `md:grid-cols-[minmax(0,1fr)_auto]`
  band: the three lines as `CheckmarkCircle02Icon` list items in a `ReceiptCard edge` on the left,
  the honest disqualifier and the `/loyalty-for-pubs` link as a dashed aside on the right. Reuses
  the icon-list idiom from `PlanIncludesList` and removes ~90 px of centred stack.
- **Priority:** Medium

### 20. `LandingPricing` violates the pricing system's own "never beside it" rule and forks the plan
- **File(s):** `components/marketing/landing/landing-pricing.tsx:33-95`;
  `components/marketing/pricing/takeover-anchor.tsx:8-15`
- **Current UX/UI Problem:** the band is `md:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)]` with the
  Growth Plan card left and the bespoke takeover card right. `TakeoverAnchor`'s docblock states:
  "Deliberately stacked BELOW the pricing sheet, **never beside it**: a side-by-side column would
  read as a third tier, which the offer explicitly is not." Separately, `PLAN_INCLUDES.slice(0, 4)`
  silently drops the fifth include ("Optional location checks at your venue") that `/pricing` shows.
- **Why It Is a Problem:** two surfaces present the same commercial offer with different geometry
  and different content. A prospect who compares `/` and `/pricing` sees a two-tier grid on one and
  a single sheet + anchor on the other, and a 4-item vs 5-item feature list. It also means the
  landing page ships three CTAs in one band (`Start your launch`, `See full pricing`, `Talk to us`).
- **Recommended Redesign:** render `<GrowthPlanPricing variant="compact" />` on `/` (add a variant
  that hides the three-row `ol` timeline and the fine-print strip, keeping the hero price, the
  annual lockup and the full `PLAN_INCLUDES`), then `<TakeoverAnchor />` stacked beneath it —
  identical structure to `/pricing`. Drop "See full pricing" (redundant once the real sheet is shown)
  so the band has one primary action.
- **Priority:** High

### 21. `FinalCta` uses an arbitrary card-spacing override instead of the existing padding token
- **File(s):** `components/marketing/landing/final-cta.tsx:14`;
  `components/brand/receipt-card.tsx:7-12`
- **Current UX/UI Problem:** `className="items-center gap-3 text-center sm:gap-4
  sm:[--card-spacing:--spacing(8)]"` — a hand-rolled arbitrary property when `ReceiptCard` already
  exposes `padding="lg"` mapped to exactly `--spacing(8)`.
- **Why It Is a Problem:** the component's padding API is bypassed, so a future change to `PADDING.lg`
  will not reach this card and the two will drift. It also hides a responsive padding change from
  anyone reading the props.
- **Recommended Redesign:** `padding="md"` on mobile is already the default; if a responsive step is
  genuinely needed, add `padding="responsive"` to the `PADDING` map rather than an arbitrary value
  at the call site.
- **Priority:** Low

---

## C. `/how-it-works` — the tallest of the "story" pages

`app/how-it-works/page.tsx:68-122`: `ProcessHero` → `Marquee` → `ProblemPains` → `LaunchSteps` →
`FeaturesListicle` → `OutcomeTransformation` → `ContrastBand` → `#diy Section`. ≈ 4,600 px mobile.

### 22. The five launch steps are printed twice, ~800 px apart
- **File(s):** `components/marketing/landing/process-hero.tsx:16-22`, `85-101`;
  `components/marketing/landing/launch-steps.tsx:46-87`; `app/how-it-works/page.tsx:57-63`, `69`
- **Current UX/UI Problem:** `ProcessHero`'s `LaunchTicket` prints `STEP_TICKET_LINES` = ["Venue +
  card setup", "Rewards configured", "Automations on", "Posters printed + posted", "You go live"].
  The `MARQUEE_STEPS` const in the page prints **the identical five strings** again 40 px lower.
  `LaunchSteps` then prints `DFY_LAUNCH.steps` — the same five steps in spoken voice — as five
  full-width bordered cards over ≈ **1,250 px**.
- **Why It Is a Problem:** the same sequence is delivered three times within the first two viewports,
  and the third delivery is the single tallest block on the page. Readers who understood the ticket
  have 1,250 px of restatement to scroll past; readers who did not are not helped by a mono strip.
- **Recommended Redesign:** delete the `MARQUEE_STEPS` marquee from this page (it is `aria-hidden`
  and duplicates the ticket verbatim). Convert `LaunchSteps` to `sm:grid-cols-2 lg:grid-cols-5` with
  the roundel + step number + `h3` above a two-line detail — a horizontal print timeline, ~320 px
  instead of 1,250 px. Keep the vertical dashed spine only below `sm`, and there make steps 2–5
  `<details>` with step 1 open. Expected saving: **≈ 900 px.**
- **Priority:** Critical

### 23. `ProblemPains` states eight objections and answers none of them in place
- **File(s):** `components/marketing/landing/problem-pains.tsx:15-52`;
  `lib/marketing/facts.ts` `PROBLEM.pains` (8 items)
- **Current UX/UI Problem:** eight quoted objections as numbered dashed tickets. On mobile they ride
  a `SnapRail` of `w-[76vw]` cards → **≈ 2,380 px of horizontal scroll** in eight swipes. At `sm`
  they become `sm:grid-cols-2 lg:grid-cols-4` → four rows ≈ 700 px at 640 px width. The band closes
  with `PROBLEM.turn` = "Every one of those is answered below" — the answers live 1,900 px further
  down, in `FeaturesListicle`'s 10 px `feature.removes` footers.
- **Why It Is a Problem:** eight consecutive negative statements with a deferred promise is a hard
  read, and the pairing that makes the section work (objection → answer) is split across two bands
  separated by the 1,250 px `LaunchSteps`. Eight swipes on a rail with no pagination indicator is
  also well past the point where a rail is discoverable.
- **Recommended Redesign:** merge `ProblemPains` and the `removes` line of `FeaturesListicle` into a
  single "Objection → what we do about it" band: `sm:grid-cols-2` rows, the quote in
  `text-sm font-bold` left, the answer in `text-sm text-muted-foreground` right, dashed rule
  between. Cut from 8 pains to the 5 that map to a `FEATURES` entry. Deletes one whole band and
  ≈ 550 px, and makes the remaining copy stronger.
- **Priority:** High

### 24. `FeaturesListicle` sets full sentences in 10 px uppercase mono
- **File(s):** `components/marketing/landing/features-listicle.tsx:77-79`
- **Current UX/UI Problem:** `<p className="mono-id mt-auto border-t-2 border-dashed border-border
  pt-2.5 text-primary uppercase">{feature.removes}</p>` where `feature.removes` is e.g.
  `Removes the "download our app" objection at the counter.` — a 52-character sentence at
  **10 px Space Mono 700, 0.06em, uppercase, vermillion on card (4.79:1)**.
- **Why It Is a Problem:** DESIGN.md is explicit — "Receipt voice (Space Mono, uppercase) for facts…
  Spoken voice (Bricolage) for everything human. Never mix registers in one line." A sentence with a
  verb and an object is spoken voice. At 10 px, uppercase, tracked, in the accent colour, it is the
  least readable text on the page and it is carrying the card's payload. `mono-id` is documented as
  the floor for IDs, not prose.
- **Recommended Redesign:** render `removes` as `text-sm leading-6 font-bold text-foreground` with a
  `mono-id text-muted-foreground` label above it ("REMOVES"). Same fix required for
  `PRODUCT.cancelLine` (see finding 25).
- **Priority:** High

### 25. `PRODUCT.cancelLine` — 96 characters of material commercial information — is rendered at 10 px in nine places
- **File(s):** `hero.tsx:47-49`, `process-hero.tsx:55-57`, `final-cta.tsx:28-30`,
  `landing-pricing.tsx:72-75`, `growth-plan-pricing.tsx:160-164`, `persona-page.tsx:206-208`,
  `guide-page.tsx:140-142`, `hub-handoff.tsx:67-69`, `app/how-it-works/page.tsx:117-119`
- **Current UX/UI Problem:** every one is `className="mono-id text-muted-foreground uppercase"` —
  10 px Space Mono, uppercase, tracked — carrying *"Card required — cancel renewal anytime after a
  short exit review from your billing page."* In `growth-plan-pricing.tsx` the `FinePrintStrip`
  concatenates it with `billingDisclosure` and `processingFeeLine` into a ~200-character
  `mono-meta` (11.5 px) uppercase paragraph.
- **Why It Is a Problem:** this is ASA material information about a recurring charge. Uppercase mono
  at 10 px destroys word-shape recognition and roughly halves reading speed; a 200-character
  all-caps run is effectively unread. It is also nine independent renderings of one legal string
  with no shared component, so a wording change touches nine files.
- **Recommended Redesign:** create `<FinePrint>` in `components/brand`: `text-xs leading-5
  text-muted-foreground` (12 px sentence case) with an optional `mono-id` label. Reserve `mono-id`
  for genuine IDs and dates. Use it at all nine call sites and inside `FinePrintStrip`.
- **Priority:** High

### 26. `OutcomeTransformation` puts a bare decorative `<li>` inside a labelled list, and the rail semantics break at `sm`
- **File(s):** `components/marketing/landing/outcome-transformation.tsx:31-80`;
  `components/marketing/landing/snap-rail.tsx:29-38`
- **Current UX/UI Problem:** the `SnapRail` renders `<ul aria-label="Before and after the launch"
  tabIndex={0}>`; its children are `SnapRailItem` (before), a raw `<li aria-hidden="true"
  className="hidden sm:grid">` holding the arrow roundel, and `SnapRailItem` (after). The grid class
  is `sm:grid-cols-[1fr_auto_1fr]`.
- **Why It Is a Problem:** an `aria-hidden` list item still occupies a position in the list for some
  AT implementations, so the labelled 2-item comparison announces as a 3-item list. On mobile the
  arrow — the element that carries the entire "transformation" idea — is `hidden`, so the swipe from
  Before to After has no directional cue beyond the `mono-id` "Swipe to see every card →" hint.
- **Recommended Redesign:** move the roundel out of the `<ul>` into an absolutely-positioned
  decorative span on the wrapper, or use `role="presentation"` on a wrapping `div` and keep the
  `<ul>` to real items. On mobile, show the arrow as a full-width dashed divider with the roundel
  centred on it between the two stacked cards, so the transformation reads without a swipe.
- **Priority:** Medium

### 27. `SnapRail`'s only affordance is a 10 px vermillion hint that is announced to screen readers
- **File(s):** `components/marketing/landing/snap-rail.tsx:26-28`, `29-35`, `52-56`
- **Current UX/UI Problem:** `<p className="mono-id flex items-center justify-end gap-1 text-primary
  uppercase sm:hidden">Swipe to see every card <span aria-hidden>→</span></p>` — 10 px, vermillion
  (4.79:1 on card, i.e. exactly at the AA floor), right-aligned, not `aria-hidden`. Items are
  `w-[76vw] max-w-xs`, the rail is `-mx-6 px-6 overflow-x-auto snap-x snap-mandatory` with
  `tabIndex={0}`.
- **Why It Is a Problem:** (a) the only cue that 8 cards exist is the smallest, lowest-contrast text
  on the page; (b) it instructs screen-reader users to "swipe", which is not their interaction; (c)
  there is no progress indicator, so a user cannot tell whether they are on card 2 or card 7 of 8;
  (d) `76vw` peek means the next card is only ~24 % visible on a 375 px screen — enough to hint, but
  the design relies entirely on that peek.
- **Recommended Redesign:** `aria-hidden="true"` the hint; render it as `mono-meta` (11.5 px)
  `text-muted-foreground` for legibility; add a `1 / 8` counter or dot row driven by
  `scroll-snap` + `IntersectionObserver`; and give the rail visible left/right `size="icon-sm"`
  buttons from `sm:` down. Cap rail item counts at 5 — beyond that use a "show all" disclosure.
- **Priority:** Medium

### 28. The `#promise` contrast band gives the honest disclaimer a lighter treatment than the promise
- **File(s):** `app/how-it-works/page.tsx:74-92`
- **Current UX/UI Problem:** "What we promise" is `text-xl sm:text-2xl font-extrabold` on the bare
  ink ground; "What we never promise" sits in a `rounded-lg border-2 border-dashed border-paper/40
  p-4` box at `text-base leading-7`. The dashed `paper/40` border computes to **3.5:1** against ink
  — acceptable for a non-text boundary but visually faint — and the box has no fill.
- **Why It Is a Problem:** the boundary statement is the ASA-critical half of the pair and the whole
  reason the band exists ("the honesty is part of the offer" per `GuaranteeStack`'s docblock), but
  it is set two sizes smaller inside the weakest container on the page. `lg:grid-cols-2` also means
  the pair stacks vertically on tablets, destroying the promise/limit contrast entirely.
- **Recommended Redesign:** `md:grid-cols-2`; give the "never promise" panel a real ground
  (`bg-paper/10`) and a solid `border-paper/60`; match both statements at `text-lg sm:text-xl` so
  the pair reads as equal-weight halves of one contract.
- **Priority:** Medium

### 29. The `#diy` section's H2 is smaller than the quote beside it
- **File(s):** `app/how-it-works/page.tsx:96-100`, `110-120`;
  `components/brand/typography.tsx:117`
- **Current UX/UI Problem:** `SectionHeader` renders "The same five steps, whenever you're ready" as
  `h2 text-lg` (18 px). The `ReceiptCard` in the adjacent column renders `"{GUARANTEE.line}"` as
  `text-base leading-7 font-extrabold` (16 px) — nearly the same size, and the card's ink border +
  4 px offset shadow makes it far more prominent than the heading.
- **Why It Is a Problem:** the page's final section reads as a card with a caption, not a section
  with a supporting card. Combined with finding 14, `SectionHeader` is the single largest source of
  hierarchy failure on this surface (it is used in 8 marketing components).
- **Recommended Redesign:** as finding 14 — `SectionHeader size="band"`. Locally, also swap
  `lg:grid-cols-[7fr_5fr]` for `md:grid-cols-[7fr_5fr]` so the CTA and the guarantee sit side by
  side on tablets rather than stacking into another 400 px.
- **Priority:** Medium

---

## D. `/pricing` and the pricing component family

`app/pricing/page.tsx:58-94`: `PageTitle` + `GrowthPlanPricing` + `TakeoverAnchor` → maths
`ReceiptCard` → `GuaranteeStack` → `ScarcityBand` → `#pricing-faq`.

### 30. The pricing sheet is a ~1,200 px single column with eight unequal blocks
- **File(s):** `components/marketing/growth-plan-pricing.tsx:41-165`;
  `components/marketing/pricing/pricing-sheet.tsx:46`
- **Current UX/UI Problem:** `PricingSheetBody` is `grid gap-6 p-5 sm:p-7`, holding: tag row, `h2`,
  hero `PriceLockup` + note, `hr`, annual lockup + note + two tags, a 3-row `ol` of prose, a "Both
  choices include" line, a 5-item `PlanIncludesList`, and one button — then a `FinePrintStrip`. At
  375 px that is ≈ 1,150–1,250 px of continuous scroll before the reader reaches the CTA. Nothing
  goes multi-column until `sm:` and even then only `PlanIncludesList columns={2}` splits.
- **Why It Is a Problem:** the price, the schedule, the timeline and the includes are four different
  *kinds* of information given identical visual weight and a uniform 24 px gap, so there is no
  scanning path. A pricing page's job is to answer "how much and what do I get" in one screen; here
  it takes four.
- **Recommended Redesign:** two-column the sheet from `md:` —
  `md:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]` with price + annual lockup + CTA in the left rail
  and the `ol` timeline + `PlanIncludesList` on the right. Convert the three `ol` rows from
  `flex flex-wrap` to `grid grid-cols-[9rem_1fr]` so the mono label and its sentence sit on one
  baseline instead of wrapping to two lines each. Expected saving: **≈ 450 px on tablet+, ≈ 150 px
  on mobile** (from the `ol` fix alone).
- **Priority:** High

### 31. Two `role="group"` regions with no visible headings and no choice to make
- **File(s):** `components/marketing/growth-plan-pricing.tsx:59-63`, `78-83`
- **Current UX/UI Problem:** `<div data-payment-option="28-day" role="group" aria-label="Pay as you
  go">` and `<div data-payment-option="annual" role="group" aria-label="Prepay a year">`. Sighted
  users see two prices separated by an `hr.w-rule` with **no label at all** on the first one; the
  second's label appears only as a `MonoTag` floated to the right at `sm:`. The docblock explicitly
  states there is deliberately no billing toggle.
- **Why It Is a Problem:** `role="group"` + `aria-label` announces a grouping that implies a
  selectable option set to AT users, while sighted users get no label for the primary price at all —
  the accessible and visual experiences disagree about what the page contains. The £69.99 hero
  numeral is unlabelled: a reader has to infer "pay as you go" from the sub-line.
- **Recommended Redesign:** replace `role="group"` with plain `<section aria-labelledby>` and render
  the labels **visibly** as `mono-meta` eyebrows above each `PriceLockup` ("PAY AS YOU GO" /
  "PREPAY A YEAR"). One label, both audiences, no implied control.
- **Priority:** Medium

### 32. Buttons on ink grounds lose their border and shadow entirely
- **File(s):** `components/marketing/pricing/takeover-anchor.tsx:41-43`;
  `components/marketing/landing/scarcity-band.tsx:34-36`;
  `app/how-it-works/page.tsx:74-92` (band ground)
- **Current UX/UI Problem:** the unlayered rule in `globals.css` gives every non-ghost button
  `border: 2px solid var(--w-ink)` and `--tw-shadow: 3px 3px 0 var(--w-shadow-color)` where
  `--w-shadow-color: var(--w-ink)`. `TakeoverAnchor` places a `variant="secondary"` button on
  `bg-ink`; `ScarcityBand` places a default (vermillion) `size="lg"` button on `bg-ink`. In both
  cases the ink border and the ink offset shadow are invisible against the ink ground, so the
  button loses the press affordance and the printed silhouette that defines the system. The
  `TakeoverAnchor` `<aside>` itself carries `shadow-md` on an ink ground — also invisible.
- **Why It Is a Problem:** the press choreography ("the shadow collapses into the paper") is
  DESIGN.md's "system-wide signature", and it silently does not exist on the two highest-intent
  conversion surfaces (the bespoke enquiry and the scarcity CTA). The button also loses its
  perceived edge against the band.
- **Recommended Redesign:** add an `onInk` treatment to the unlayered layer — e.g.
  `[data-on-ink] [data-slot="button"] { border-color: var(--w-paper); --tw-shadow: 3px 3px 0
  var(--w-paper); }` — and set `data-on-ink` on `ContrastBand` and `TakeoverAnchor`. Remove
  `shadow-md` from the `TakeoverAnchor` aside.
- **Priority:** High

### 33. `TakeoverAnchor` and the landing bespoke card are two renderings of one offer
- **File(s):** `components/marketing/pricing/takeover-anchor.tsx:18-44`;
  `components/marketing/landing/landing-pricing.tsx:78-94`
- **Current UX/UI Problem:** `/pricing` renders the takeover as an ink `<aside>` with a sun-toned
  `MonoTag`, `text-2xl sm:text-3xl` seal-coloured price, and a `w-fit` secondary button. `/` renders
  the same `TAKEOVER` facts as a paper `Card` with a plain `MonoTag`, `text-2xl sm:text-3xl`
  foreground price, and a `w-full` secondary button. Different ground, different tag tone, different
  button width, different qualifier sentence ("Enquiry only; no online checkout." vs "Not a Growth
  Plan tier — no self-serve checkout.").
- **Why It Is a Problem:** the same commercial object looks like two different products depending on
  where you land, and the two copies of the disclaimer are worded differently, which is a compliance
  risk as well as a design one.
- **Recommended Redesign:** delete the landing copy and render `<TakeoverAnchor />` on `/` (see
  finding 20). One component, one truth.
- **Priority:** Medium

### 34. `GuaranteeStack`'s disclosure summary is a 10 px control label with three sibling dialects
- **File(s):** `components/marketing/landing/guarantee-stack.tsx:54-70`;
  `components/marketing/landing/faq.tsx:18-32` and `61-83`
- **Current UX/UI Problem:** three `<details>` treatments coexist on the marketing surface:
  1. `GuaranteeStack`: `summary` is `focus-ring mono-id flex min-h-11 …` — **10 px uppercase mono**
     reading "HOW IT WORKS — AND THE CONDITIONS", `+`/`−` as raw text characters, and the open body
     (`<p className="text-sm …">`) has **no top padding**, so the answer butts the summary.
  2. `FaqList`: `summary` is `text-sm font-bold px-4 py-3`, `+`/`−` at `mono-meta`, card has no
     shadow.
  3. `LandingFaq`: same as (2) plus a `mono-id` index, `shadow-sm`, and an answer indented to
     `pl-[3.25rem]`.
- **Why It Is a Problem:** the same interaction (expand to read more) is presented at three type
  scales, two glyph sizes and two elevations, on pages the user visits in sequence. The 10 px
  variant is the worst: a control label below the readable floor for prose, on a `min-h-11` row that
  looks empty.
- **Recommended Redesign:** extract one `<Disclosure>` primitive in `components/brand` — `summary`
  at `text-sm font-bold min-h-11 px-4 py-3`, glyph via `Icon` (`PlusSignIcon` / `MinusSignIcon`,
  16 px) per the Hugeicons contract rather than text `+`/`−`, body `border-t-2 border-dashed px-4
  py-3`. Use it in all three places and delete `FaqList`/`LandingFaq`'s duplicate markup (see
  finding 36).
- **Priority:** Medium

### 35. The "Does the maths work?" receipt exists twice at two type scales
- **File(s):** `app/pricing/page.tsx:67-82`;
  `components/marketing/landing/outcome-transformation.tsx:82-99`
- **Current UX/UI Problem:** both render `VALUE_MATH.assumptionLine` / `coverLine` /
  `illustrativeNote` inside a `ReceiptCard edge padding="md"` with the same `mono-meta` eyebrow
  "Does the maths work?". `/pricing` sets `coverLine` at `text-xl leading-snug`;
  `/how-it-works` sets it at `text-2xl sm:text-3xl` **and** adds `rotated` +
  `wrapperClassName="mx-auto max-w-2xl pt-5 sm:pt-7"`.
- **Why It Is a Problem:** identical content, two components, two type scales, one rotated and one
  not. The rotation is the brand signature — its absence on the pricing page makes the same object
  read as a different, lesser component.
- **Recommended Redesign:** extract `<ValueMathReceipt rotated? />` into
  `components/marketing/pricing/` and use it at both call sites with `coverLine` at
  `text-xl sm:text-2xl`.
- **Priority:** Medium

### 36. `FaqList` and `LandingFaq` are the same component with a number bolted on
- **File(s):** `components/marketing/landing/faq.tsx:10-40` and `48-104`
- **Current UX/UI Problem:** ~95 lines in one file, of which the two `<details>` blocks differ only
  by: an index `<span className="mono-id w-6">`, `shadow-sm` on the card, `flex-1` on the question,
  and the answer's `pl-[3.25rem]` vs `px-4`. `/pricing` renders `FaqList`, `/faq` renders
  `LandingFaq`. The file's own comment says they are "Kept separate… so this page's presentation can
  evolve on its own" — which has not happened; they have only drifted.
- **Why It Is a Problem:** the same nine questions look different on two pages a user visits back to
  back, and the shadow difference means the pricing FAQ sits flat while the FAQ page's floats.
- **Recommended Redesign:** one `<FaqList items numbered? />`. Default `numbered={false}`, pass
  `numbered` on `/faq`. Delete ~45 lines.
- **Priority:** Low

### 37. `/pricing`'s FAQ stretches a 14 px accordion across 1,152 px
- **File(s):** `app/pricing/page.tsx:85-94`; `components/marketing/landing/faq.tsx:10-16`
- **Current UX/UI Problem:** `<Section id="pricing-faq">` is `max-w-marketing` (1152 px);
  `FaqList` renders `<div className="grid gap-3">` with no measure constraint, so each question row
  is a 1,152 px-wide box containing a `text-sm font-bold` question at the left edge and a `+` at the
  right edge, ~1,050 px apart. Answers run the full width at `text-sm leading-6` ≈ **155 characters
  per line**.
- **Why It Is a Problem:** the `+` affordance is a thousand pixels from the label it belongs to, and
  the answer measure is roughly double the readable maximum. `LandingFaq` on `/faq` correctly caps at
  `mx-auto max-w-3xl` — so the same content is readable on one page and not on the other.
- **Recommended Redesign:** add `mx-auto max-w-3xl` inside `FaqList` (or switch the section to
  `width="narrow"`). Cap answer paragraphs at `max-w-[68ch]` as the guides already do.
- **Priority:** High

### 38. `ScarcityBand` and `GuaranteeStack` restate `CLAIMS_BOUNDARY` for the third and fourth time
- **File(s):** `components/marketing/landing/guarantee-stack.tsx:74-85`;
  `components/marketing/landing/scarcity-band.tsx:19-27`; `app/how-it-works/page.tsx:83-89`;
  `components/marketing/landing/proof-strip.tsx:31`
- **Current UX/UI Problem:** `CLAIMS_BOUNDARY.never` appears on `/pricing` (in the "The catch" dashed
  box), on `/how-it-works` (the `#promise` band), on `/about` (prose), on `/loyalty-for-*`
  (`persona-page.tsx:186`), on `/loyalty-for-pubs` (`vendor-questions.tsx:52`), and lowercased inside
  `ProofStrip`. `SCARCITY.capLine` + `capReason` appear on `/pricing` (ScarcityBand),
  `/how-it-works` (`#promise`), `/`(ProofLine), `/about`, and `persona-page`.
- **Why It Is a Problem:** on `/pricing` alone the reader meets the capacity limit in `GuaranteeStack`'s
  catch box and then again 32 px later as the `ScarcityBand` H2 — the same sentence twice in one
  scroll. Repetition of a limitation reads as defensiveness rather than honesty.
- **Recommended Redesign:** on `/pricing`, delete the "The catch" box from `GuaranteeStack` and let
  `ScarcityBand` (which is right below it and is *about* the cap) own `capLine`/`capReason`; keep
  `CLAIMS_BOUNDARY.never` in one place per page. Saving ≈ 200 px on `/pricing` and a clearer story.
- **Priority:** Medium

---

## E. `/faq`, `/about`, `/demo`, `/start`, `/offline`

### 39. `/faq` misaligns its H1 axis against its own content column
- **File(s):** `app/faq/page.tsx:45-51`; `components/marketing/landing/faq.tsx:57`
- **Current UX/UI Problem:** the `<Section id="faq">` is `max-w-marketing` (1152 px). `PageTitle`
  renders full-width inside it (heading capped at `max-w-3xl`, description at `max-w-2xl`, both
  left-aligned at x = 0). `LandingFaq showHeader={false}` returns
  `<ol className="mx-auto grid w-full max-w-3xl …">` — **centred** at 768 px. So on a 1440 px screen
  the H1 starts at the container's left edge and the question list starts ~192 px to its right.
- **Why It Is a Problem:** two competing vertical axes on a page with only two elements. It reads as
  a layout bug.
- **Recommended Redesign:** `<Section id="faq" width="narrow">` and remove the `mx-auto max-w-3xl`
  from `LandingFaq` (let the section own the measure). Same fix serves finding 37.
- **Priority:** Medium

### 40. `/faq` closes with three equal-weight `size="lg"` buttons
- **File(s):** `app/faq/page.tsx:52-62`
- **Current UX/UI Problem:** `flex flex-wrap items-center gap-3` holding one `default` and two
  `secondary` `size="lg"` (h-12) buttons. On a 375 px screen these stack into a **168 px CTA tower**;
  on desktop they read as three peer choices. The same pattern appears in
  `hub-handoff.tsx:56-66` (3 buttons) and `demo/page.tsx:44-51`, `about/page.tsx:94-101`,
  `persona-page.tsx:198-205`, `guide-page.tsx:132-139` (2 buttons each).
- **Why It Is a Problem:** three primaries is no primary. It also duplicates navigation the header
  and footer already provide, in the most expensive possible form (48 px buttons).
- **Recommended Redesign:** one `size="lg"` primary ("Start your launch") plus a single line of
  inline `min-h-11` text links for the two secondary destinations. Apply the same one-primary rule
  at all six call sites; expected saving ≈ 100 px per page.
- **Priority:** Medium

### 41. `/about` is five 14 px paragraphs at a 105-character measure, with no subheadings
- **File(s):** `app/about/page.tsx:58-90`
- **Current UX/UI Problem:** `<div className="grid gap-4 pt-6">` containing five
  `<p className="text-sm leading-7 text-muted-foreground">`. The section is `width="narrow"` =
  `max-w-3xl` = 768 px. At 14 px Bricolage that is ≈ **105 characters per line**. There is not a
  single `h2` between the H1 and the `ProofStrip` component.
- **Why It Is a Problem:** DESIGN.md's body token is 15 px / 22 px; the guide pages use
  `text-base leading-7` capped at `max-w-[68ch]`. `/about` is the only prose page in the product
  using 14 px at a 768 px measure, and it has no scanning structure at all — the document outline is
  H1 → (ProofStrip H2) → nothing. Readers looking for "who are these people" have no entry points.
- **Recommended Redesign:** `text-base leading-7 max-w-[68ch]` on the paragraphs, and break the five
  paragraphs into three `<section>`s with `SectionHeader`-style `h2`s ("The pattern we built for",
  "What we actually do", "What we won't promise"). It reads better and shortens nothing — the
  height is already appropriate here.
- **Priority:** Medium

### 42. `/about` ends with a bare button row and a hardcoded `pb-10`
- **File(s):** `app/about/page.tsx:93-102`; also `persona-page.tsx:190`, `guide-page.tsx:123`
- **Current UX/UI Problem:** `<Section width="narrow" size="compact" className="pb-10">` wrapping
  only two buttons — no heading, no context sentence, no card. The `className="pb-10"` override
  appears verbatim at three call sites to compensate for the section scale being too tight at the
  page bottom.
- **Why It Is a Problem:** an unheaded button pair reads as leftover chrome. And the repeated
  `pb-10` is the tell that `Section` lacks a "last section before footer" affordance — three files
  now encode the same magic number.
- **Recommended Redesign:** add `last` to the `SectionSize` map (`"py-7 pb-12 sm:py-10 sm:pb-16"`)
  and use `size="last"`. Give the closing block one `text-base font-extrabold` line of context above
  the buttons.
- **Priority:** Low

### 43. `/demo` builds its rhythm from four different `pt-*` values instead of a gap
- **File(s):** `app/demo/page.tsx:25-52`
- **Current UX/UI Problem:** inside one `<Section width="narrow">`: `PageTitle` (left-aligned),
  then `<div className="mx-auto w-full max-w-sm pt-8">`, then a tag row `pt-6`, then a paragraph
  `pt-4`, then a button row `pt-6`. Four hard-coded top paddings, and the alignment flips from
  left (PageTitle) to centre (everything after).
- **Why It Is a Problem:** padding-based rhythm cannot be tuned in one place and does not collapse;
  the mixed alignment makes the page read as two designs stitched together. The disclaimer — the
  one piece of copy that prevents a prospect misreading the demo as a live card — is set at
  `text-xs leading-5` (12 px), the smallest body text on the page.
- **Recommended Redesign:** one `<div className="grid justify-items-center gap-6 pt-8">` wrapper;
  set `PageTitle` to centred (`className="justify-items-center text-center"`) or left-align the rest;
  promote the disclaimer to `text-sm leading-6` inside a `border-2 border-dashed` note so it reads
  as a deliberate caveat rather than fine print.
- **Priority:** Medium

### 44. `/start` stacks two equal-weight `size="lg"` buttons 8 px apart
- **File(s):** `app/start/page.tsx:42-57`
- **Current UX/UI Problem:** `<div className="grid gap-2">` holding `Button size="lg"` (default,
  vermillion, "Scan a QR"), `Button variant="secondary" size="lg"` ("Open my cards") and a
  `variant="ghost" size="sm"` merchant sign-in. Both `lg` buttons are 48 px, 8 px apart, full width.
- **Why It Is a Problem:** 8 px between two 48 px full-width buttons is below the spacing that makes
  a stacked button group legible as separate targets (the system's own card gap is 14 px), and the
  secondary is visually as heavy as the primary because both carry the 2 px ink border and 3 px
  offset. The merchant route — a genuinely distinct audience — is a 36 px ghost link.
- **Recommended Redesign:** `gap-3`; make "Open my cards" `variant="outline"` so the primary reads
  alone; and separate the merchant path below the dashed rule with its own `mono-meta` label
  ("RUNNING A VENUE?") rather than burying it as a tertiary underline.
- **Priority:** Medium

### 45. `/offline` uses an empty `href` and a variant nothing else on the surface uses
- **File(s):** `app/offline/page.tsx:35-40`
- **Current UX/UI Problem:** `<Button asChild><a href="">Try again</a></Button>` — an empty string
  href — and `<Button asChild variant="outline">` for the secondary. `outline` appears nowhere else
  in the marketing/legal surface; every other secondary action is `variant="secondary"`.
- **Why It Is a Problem:** `href=""` resolves to the current URL and works, but it is flagged by
  axe/eslint-jsx-a11y and reads as a bug to any reviewer; more importantly there is no live status
  ("still offline" / "back online") so the button gives no feedback when pressed while still
  offline. The `outline` variant is a one-off in the secondary-button vocabulary.
- **Recommended Redesign:** use the current pathname explicitly, add an `aria-live="polite"` status
  line driven by the existing `OfflineAutoReload` client component, and switch to
  `variant="secondary"` for consistency with the rest of the public surface.
- **Priority:** Low

---

## F. `/loyalty-for-pubs` — the buyer's-guide hub (the tallest page on the site)

`components/marketing/pubs/pubs-page.tsx:80-102`: hero + a `grid gap-12 lg:gap-16` of **8**
`GuideSection`s, each with prose plus a structured payload. Estimated ≈ **8,500–9,000 px mobile**.

### 46. 96 px between sections, on the longest page in the product
- **File(s):** `components/marketing/pubs/pubs-page.tsx:95`
- **Current UX/UI Problem:** `<div className="grid gap-12 pt-6 lg:gap-16 lg:pt-0">` — 48 px gap on
  mobile, 64 px from `lg`. `GuideSection` itself adds `grid gap-4` internally, and each payload adds
  its own `grid gap-3`/`gap-4`/`gap-5`. Across 8 sections that is **336 px of pure gap on mobile,
  448 px on desktop**, on a page that is already 13 viewports tall.
- **Why It Is a Problem:** it is the largest inter-section gap token used anywhere in the marketing
  surface (compare `Section`'s `py-4`/`py-7`) and it is applied to the page that can least afford it.
- **Recommended Redesign:** `gap-8 sm:gap-10 lg:gap-12`, and rely on the `Nº01` eyebrow markers plus
  a `border-t-2 border-dashed` rule at the top of each `GuideSection` for separation — the rule
  costs 2 px and does the job the 48 px gap is currently doing. Saving ≈ 150 px.
- **Priority:** Medium

### 47. `OptionsMatrix` renders 20 label/value pairs as stacked cards on mobile
- **File(s):** `components/marketing/pubs/options-matrix.tsx:99-130`; `lib/marketing/facts.ts`
  `PUB_LOYALTY_OPTIONS` (4 options) × `ASPECTS` (5 rows)
- **Current UX/UI Problem:** below `lg` the table is replaced by
  `<ul className="grid gap-3 sm:grid-cols-2 lg:hidden">` where each `<li>` holds an `h3` plus a `dl`
  of 5 `dt`(`mono-id`, 10 px) + `dd`(`text-sm leading-6`, prose) pairs. Each option card is
  ≈ 380 px; four of them ≈ **1,550 px** for one comparison.
- **Why It Is a Problem:** this is the hub's declared centrepiece and on a phone it is a 1,550 px
  vertical read where the whole point is *lateral comparison*. A reader cannot hold "what your guest
  does" for Paper in mind while scrolling 380 px to read it for QR. The 10 px `dt` labels repeat 20
  times, adding noise without adding structure.
- **Recommended Redesign:** invert the mobile layout — group by **aspect**, not by option: five
  `<details>` (one per `ASPECTS` row, first open) each containing four short `dt`/`dd` pairs, so the
  four options sit adjacent under one question. That is the comparison the reader wants and it
  collapses to ≈ 400 px closed. Alternatively a horizontal `SnapRail` of option columns with a
  sticky aspect-label gutter.
- **Priority:** High

### 48. The desktop comparison table horizontally scrolls at every laptop width
- **File(s):** `components/marketing/pubs/options-matrix.tsx:53-54`;
  `components/marketing/pubs/pubs-page.tsx:92`; `components/ui/table.tsx:9-13`
- **Current UX/UI Problem:** the table is `hidden … lg:block` with `<Table className="min-w-[56rem]">`
  (896 px). At `lg` the available content column is `1024 − 48 (gutter) − 192 (spine) − 48 (gap)
  ≈ 736 px`. `Table` wraps itself in `overflow-x-auto tabIndex={0}`, so the "table from lg up"
  **always scrolls horizontally** between 1024 px and ~1,280 px.
- **Why It Is a Problem:** the stated reason for gating the table at `lg` is that "four prose columns
  need the width" — but at `lg` they do not have it. A horizontally scrolling 5-row table with no
  frozen first column means the reader loses the aspect label as soon as they scroll to compare
  columns three and four. There is also no visible scroll affordance (no fade, no shadow, no hint).
- **Recommended Redesign:** gate the table at `xl:` (1280 px) and let the improved card/accordion
  layout (finding 47) serve `lg`. If the table stays at `lg`, make the aspect `<TableHead scope="row">`
  `sticky left-0 bg-card z-10` so the row label survives the scroll, and add a right-edge gradient
  hint plus `mono-id` "scroll to compare →" text.
- **Priority:** High

### 49. `GuideSpine` collapses after hydration, shifting the layout on every mobile load
- **File(s):** `components/marketing/pubs/guide-spine.tsx:61-88`; `lib/motion/use-hydrated`
- **Current UX/UI Problem:** the toggle button is `hydrated ? "flex" : "hidden"` and the `<ol>` is
  `hydrated && !open ? "hidden lg:block" : "grid"`. So the server sends the **full 8-link list**
  visible on mobile; on hydration the list disappears and a 44 px toggle button appears in its
  place — a ~300 px layout shift on the site's longest page.
- **Why It Is a Problem:** measurable CLS on a page that is also the SEO hub (an Article with a
  `dateModified`), and a visible flash of content that then vanishes, which reads as a bug.
- **Recommended Redesign:** use a native `<details>`/`<summary>` for the mobile variant — collapsed
  by default in HTML, no JS required, no hydration branch, no shift, and the "every link still jumps
  with JS off" guarantee is preserved. Keep the `IntersectionObserver` scroll-spy purely as a
  progressive `aria-current` enhancement on the `lg:` rail.
- **Priority:** High

### 50. `VendorQuestions` gives the answer more visual weight than the question
- **File(s):** `components/marketing/pubs/vendor-questions.tsx:20-45`
- **Current UX/UI Problem:** each of the six rows is `sm:grid-cols-[5fr_6fr]`. The left cell (the
  question the reader is meant to *ask a vendor*) is bare text on the page ground; the right cell
  (our answer) is `rounded-lg border-2 border-ink bg-card p-3.5` — a bordered card with a lighter
  ground. The answer column is also the *wider* one (6fr vs 5fr).
- **Why It Is a Problem:** the section's whole premise is "ask these of anyone you talk to, us
  included" — a due-diligence checklist. Rendering our own answers as the visually dominant,
  wider, carded element turns a checklist into a sales sheet, undermining the credibility the
  section is built to earn. `p-3.5` (14 px) is also a one-off outside the 16/20/24 padding scale
  used by every sibling component.
- **Recommended Redesign:** flip the weight — question in a `ReceiptCard`-style bordered cell at
  `text-base font-extrabold` on the left (`6fr`), our answer as plain indented prose under a
  `mono-id "OUR ANSWER"` label on the right (`5fr`), separated by the existing dashed rule.
  Normalise padding to `p-4 sm:p-5`.
- **Priority:** Medium

### 51. `TillMoment` hand-rolls a circle that `IconRoundel` already owns
- **File(s):** `components/marketing/pubs/till-moment.tsx:17-22`;
  `components/brand/icon-roundel.tsx:6-13`
- **Current UX/UI Problem:** `<span className="mono-meta grid size-7 place-items-center rounded-full
  border-2 border-ink bg-card text-foreground">{index + 1}</span>` — a 28 px numbered circle.
  `IconRoundel size="sm"` is exactly this at 32 px, with `children` as the documented "step number"
  mode, and DESIGN.md says "new framing circles reach for `IconRoundel` rather than hand-rolling
  `rounded-full`".
- **Why It Is a Problem:** documented drift, and a 4 px size mismatch with the numbered discs used by
  `LaunchSteps` and `ProcessHero`, so the same "step N" idiom is two sizes across two pages.
- **Recommended Redesign:** `<IconRoundel size="sm" tone="card">{index + 1}</IconRoundel>`.
- **Priority:** Low

### 52. `StaffTime`'s three-up grid produces a ~25-character measure at `sm`
- **File(s):** `components/marketing/pubs/staff-time.tsx:19-33`
- **Current UX/UI Problem:** `<ul className="grid gap-3 sm:grid-cols-3">` with each card
  `p-4 sm:p-5` holding a `MonoTag` and a `text-sm leading-6` paragraph. At 640 px inside the guide
  column, each column is ≈ 190 px wide minus 32 px padding = ~158 px → **≈ 24 characters per line**
  for a 2–3 sentence paragraph.
- **Why It Is a Problem:** ragged 24-character prose columns are harder to read than a single stack,
  and the cards become very tall and unequal, breaking the visual rhythm of three "phases".
- **Recommended Redesign:** `grid gap-3 md:grid-cols-3` (768 px, ~230 px columns) — or better, since
  the content is `when → detail` pairs, render as a `dl` with `md:grid-cols-[8rem_1fr]` rows so the
  timing labels align and the prose keeps a full measure.
- **Priority:** Medium

### 53. `PubGuideHero` stacks three ink-bordered surfaces around one card
- **File(s):** `components/marketing/pubs/pub-guide-hero.tsx:67-84`
- **Current UX/UI Problem:** an `aria-hidden` `bg-seal` sheet rotated 2° behind a
  `rounded-[var(--radius-sheet)] border-2 border-ink bg-cobalt p-5 shadow-md sm:p-7` panel, which
  contains the `HeroSampleCard` (itself a warm-paper card with a drop-shadow filter and a 1.5°
  tilt). Three nested bordered surfaces, two rotations, three grounds (sun → cobalt → card).
- **Why It Is a Problem:** it is the only place in the product where the warm-paper card sits on
  saturated cobalt, and the sun sheet peeking from behind adds a fourth colour to a hero that
  already carries a cobalt `MonoTag` and a sun `MonoTag`. The result competes with the H1 rather
  than supporting it, and the nested `p-5 sm:p-7` adds ~80 px of height for decoration alone.
- **Recommended Redesign:** drop the cobalt panel; keep the sun offset sheet directly behind the
  card (one rotation, two surfaces), and move the "The QR option" tag + "Try it live" link to a
  dashed caption bar *below* the card. Fewer grounds, ~90 px shorter, and the card stays the hero.
- **Priority:** Medium

### 54. Five different page-title scales across six page types
- **File(s):** `hero.tsx:30` (`text-4xl sm:text-6xl`); `process-hero.tsx:38` (same);
  `pub-guide-hero.tsx:43` (`text-3xl sm:text-5xl`); `components/brand/typography.tsx:69`
  (`text-3xl sm:text-4xl`); `app/terms/page.tsx:64`, `privacy/page.tsx:65`,
  `legal-document-page.tsx:56` (`text-[clamp(2.1rem,4.5vw,3.2rem)]`)
- **Current UX/UI Problem:** the H1 renders at 36→60 px on `/` and `/how-it-works`, 30→48 px on
  `/loyalty-for-pubs`, 30→36 px on `/pricing`, `/faq`, `/about`, `/demo`, and a fluid 33.6→51.2 px on
  the five legal pages — the legal H1 is therefore *larger* than the pricing page's H1 on desktop.
- **Why It Is a Problem:** page titles are the strongest signal of where you are in a site. Five
  scales means the cookie notice announces itself more loudly than the pricing page. DESIGN.md
  defines exactly two: `marketing-hero` 56 px and `page-title` 30/36 px.
- **Recommended Redesign:** two classes only. `hero-title` = `text-[clamp(2.25rem,6vw,3.5rem)]`
  (landing, how-it-works, pub hub); `page-title` = `text-3xl sm:text-4xl` (everything else,
  including legal — delete the `titleClassName` clamp override at three call sites).
- **Priority:** Medium

---

## G. `/loyalty-for-{bars,cafes,takeaways}` — the persona spokes

### 55. Three routes, one template, zero vertical-specific content
- **File(s):** `app/loyalty-for-bars/page.tsx`, `-cafes`, `-takeaways` (21 lines each);
  `components/marketing/persona-page.tsx:79-226`
- **Current UX/UI Problem:** the three spokes differ only in `persona.title`, `persona.audience`,
  `persona.offerName` and `persona.fitNote`. Everything below the H1 — `CORE_OFFER`, `GUARANTEE`,
  `GUARANTEE_ROI`, `CLAIMS_BOUNDARY`, `PLAN_LINE`, `SCARCITY` — is pub-worded copy from
  `lib/marketing/facts.ts`. All three are `robots: { index: false, follow: true }`.
- **Why It Is a Problem:** a visitor who lands on `/loyalty-for-cafes` reads a page whose own fit
  note tells them the product is built for pubs, then four sections of pub copy, then a CTA. There is
  no café example reward, no café till scenario, no café-relevant proof. The pages are noindexed, so
  they exist only for direct/paid traffic — which makes the generic content worse, not better.
- **Recommended Redesign:** either (a) collapse to one dynamic route `/loyalty-for/[vertical]` and
  invest in three vertical-specific blocks (an example reward pool, a counter scenario, a fit note),
  or (b) redirect all three to `/loyalty-for-pubs` and stop paying the maintenance and crawl cost.
  A noindexed page with borrowed copy is not worth the surface area.
- **Priority:** High

### 56. `PersonaSpokePage` renders four content types with one identical treatment
- **File(s):** `components/marketing/persona-page.tsx:111-189`
- **Current UX/UI Problem:** four consecutive `<Section size="compact">` (`py-4 sm:py-5` — i.e. no
  rhythm change at all, see finding 3). `CORE_OFFER` items are
  `border-b-2 border-dashed border-border pb-2.5` + `text-sm text-muted-foreground`;
  `MARKET.qualify` items are `border-b-2 border-dashed border-border pb-2` + `text-sm
  text-muted-foreground`; `MARKET.disqualify` items are **identical**. The only card on the whole
  page is the guarantees `ReceiptCard`. No icons, no colour, no imagery, no rail.
- **Why It Is a Problem:** "what you get", "who it's for", and "who it's not for" are three different
  jobs rendered as three visually identical grey dashed lists, ~1,200 px of them. A reader cannot
  tell where one list ends and the next begins without reading the `SectionHeader` — which is
  `text-lg` (finding 14).
- **Recommended Redesign:** give each list its own idiom: `CORE_OFFER` → `PlanIncludesList` with leaf
  checkmarks (the component already exists); qualify → `CheckmarkCircle02Icon` list in a bordered
  card; disqualify → `Cancel01Icon` list in a dashed card — exactly the treatment
  `pub-fit-test.tsx` already uses on the hub. Two-up them at `md:grid-cols-2`. Saves ~350 px and
  makes three sections legible at a glance.
- **Priority:** High

### 57. `MonoTag tone="ink"` makes the disqualifier louder than the qualifier
- **File(s):** `components/marketing/persona-page.tsx:140`, `155`;
  `components/marketing/pubs/pub-fit-test.tsx:22`, `44`; `components/brand/mono-tag.tsx:15`
- **Current UX/UI Problem:** "Right for you" uses `tone="leaf"` (green fill, white text);
  "Not right yet" uses `tone="ink"` — a **solid near-black fill**, the heaviest tone in the
  `MonoTag` palette. `pub-fit-test.tsx`'s own docblock says "The disqualify column is styled as
  quietly as the qualify column on purpose: a fit test that visually punishes the 'no' answer isn't
  a fit test" — but the tag directly contradicts that intent.
- **Why It Is a Problem:** on a warm-paper page the solid ink pill is the highest-contrast element in
  the section; the eye lands on "NOT RIGHT YET" first. It reads as a warning label.
- **Recommended Redesign:** `tone="plain"` for the disqualify tag (the dashed card and the muted
  `Cancel01Icon` already carry the semantic), keeping `tone="leaf"` for qualify.
- **Priority:** Low

### 58. The persona spokes never show a price
- **File(s):** `components/marketing/persona-page.tsx:190-209`
- **Current UX/UI Problem:** the closing section renders `PLAN_LINE` (a prose sentence) and
  `SCARCITY.capLine`, then two `size="lg"` buttons and the 10 px `cancelLine`. There is no
  `PriceLockup`, no `£299.99`, no `£69.99` numeral anywhere on the page.
- **Why It Is a Problem:** a landing page for paid/direct traffic that never displays a price forces
  a second click before the primary objection can be resolved. Every other conversion surface on the
  site leads with the numeral.
- **Recommended Redesign:** insert `<PriceLockup size="lead" amount={PRODUCT.priceAmount}
  cadence={PRODUCT.priceCadence} />` plus the launch-fee line above the CTA row, or render
  `<GrowthPlanPricing variant="compact" />` (see finding 20).
- **Priority:** Medium

---

## H. `/guides/*`

### 59. A hardcoded display date that will silently contradict the machine-readable one
- **File(s):** `components/marketing/guides/guide-page.tsx:56-59`
- **Current UX/UI Problem:** `<time dateTime={guide.updatedOn}>19 July 2026</time>` — the visible
  text is a **string literal**, while the `dateTime` attribute and the `articleSchema`
  `dateModified` come from `guide.updatedOn`. All three guides therefore display the same date
  regardless of their real `updatedOn`.
- **Why It Is a Problem:** an E-E-A-T byline that is wrong is worse than no byline; the visible date
  and the structured data will disagree the moment any guide is revised, which is both a
  credibility problem for readers and a schema-mismatch signal for crawlers.
- **Recommended Redesign:** format `guide.updatedOn` with the same `Intl.DateTimeFormat("en-GB", {
  day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })` helper already used in
  `commercial-evidence-proof.tsx:5-10`.
- **Priority:** High

### 60. Guides have no on-page navigation while their two neighbours have two different ones
- **File(s):** `components/marketing/guides/guide-page.tsx:61-87` (5 sections, ~1,500 words);
  compare `components/marketing/pubs/guide-spine.tsx` (sticky rail) and
  `components/legal/legal-document-page.tsx:36-49` (aside TOC)
- **Current UX/UI Problem:** `GuidePage` renders `<article className="grid gap-8">` of five
  `h2 text-xl` sections with no anchors, no ids, no TOC, no "back to top". The hub next door has a
  sticky scroll-spy spine; the legal pages have a sticky aside list.
- **Why It Is a Problem:** three different answers to "how do I navigate a long document" across
  three page families a user moves between, and the one with the *most* prose has none. The
  `h2`s also have no `id`, so a reader cannot deep-link a section of a guide at all.
- **Recommended Redesign:** reuse `GuideSpine` (make it generic over a section list) on the guides,
  or at minimum add `id` + `scroll-mt` to each `h2` and a collapsed `<details>` "On this page" above
  the article. Pick one TOC pattern for the whole site.
- **Priority:** Medium

### 61. Guide body prose is 14 px at a 768 px measure, with a flat 1.43 heading ratio
- **File(s):** `components/marketing/guides/guide-page.tsx:65-74`
- **Current UX/UI Problem:** `h2 text-xl leading-snug` (20 px) over `p text-sm leading-7`
  (14 px), inside `Section width="narrow"` (768 px) with no `max-w-[Nch]` cap → **≈ 108 characters
  per line**. The hub's `GuideSection` gets this right: `text-base leading-7` capped at
  `max-w-[68ch]`.
- **Why It Is a Problem:** the guides are the longest-form reading on the marketing surface and they
  use the smallest body size at the widest measure. The 20/14 heading ratio gives the sections
  almost no separation, so a 1,500-word article reads as one block.
- **Recommended Redesign:** `p` → `text-base leading-7 max-w-[68ch]`; `h2` →
  `text-xl sm:text-2xl` with a `mono-meta` eyebrow above it (matching `GuideSection`). Cost: zero
  extra height, since the wider type at a narrower measure is roughly height-neutral.
- **Priority:** Medium

### 62. `ComparisonTable` switches to a table at 640 px — a 26-character column
- **File(s):** `components/marketing/guides/comparison-table.tsx:26-52`
- **Current UX/UI Problem:** `<div className="hidden overflow-x-auto … sm:block">` with a
  three-column prose table. At 640 px, inside `Section width="narrow"` with `px-6`, each column is
  ≈ 197 px minus the `p-2` cell padding → **≈ 26 characters per line** of `text-sm leading-6` prose,
  over 6 rows. Meanwhile the hub's equivalent matrix waits until `lg` (finding 48).
- **Why It Is a Problem:** two comparison tables in the same product break to a table at breakpoints
  384 px apart, and the earlier one produces an unreadable column width. The `overflow-x-auto` on
  the wrapper is also redundant — `Table` already provides its own scroll container, so this nests
  two scroll regions (which `options-matrix.tsx:52` explicitly warns against).
- **Recommended Redesign:** gate the table at `md:` (768 px, ~230 px columns) and remove the outer
  `overflow-x-auto` (keep the border/rounded wrapper). Extend the mobile card list to `sm` and give
  it `sm:grid-cols-2`.
- **Priority:** Medium

---

## I. Legal surface — `/terms`, `/privacy`, `/cookies`, `/merchant-terms`, `/data-processing`

### 63. The table of contents renders *below* the document on mobile
- **File(s):** `components/legal/legal-document-page.tsx:36`; `app/terms/page.tsx:44`;
  `app/privacy/page.tsx:45`
- **Current UX/UI Problem:** `<aside className="surface-card order-last p-4 lg:sticky lg:top-20
  lg:order-none">` — `order-last` puts the "On this page" nav after the `<article>` in the grid at
  every width below `lg`. On `/privacy` that means the 12-item TOC appears after ≈ **3,200 px** of
  legal prose.
- **Why It Is a Problem:** a table of contents that a reader only reaches after reading the whole
  document is dead weight — it costs ~600 px (12 links × 44 px) at the bottom of the page and
  delivers nothing. Mobile is also where a TOC matters most.
- **Recommended Redesign:** move it above the article on mobile as a collapsed
  `<details><summary class="eyebrow min-h-11">On this page · 12 sections</summary>` (the
  `GuideSpine` pattern, but without the hydration branch), keeping `lg:sticky lg:order-none` for the
  desktop rail. Net: −600 px at the bottom, +56 px at the top, and a usable TOC.
- **Priority:** High

### 64. Legal clause bodies run at a ~125-character measure
- **File(s):** `components/legal/legal-document-page.tsx:77-79`; `app/terms/page.tsx:117`;
  `app/privacy/page.tsx:152`
- **Current UX/UI Problem:** `<p className="text-sm leading-6 text-muted-foreground">` inside a
  `ReceiptCard` inside `Section` (`max-w-marketing` 1152 px) minus a 240 px aside minus a 32 px gap
  minus card padding ≈ **840 px of text at 14 px ≈ 125 characters per line**, for 10–12 consecutive
  clauses.
- **Why It Is a Problem:** these are the longest continuous prose blocks in the product and they run
  at roughly double the 45–75 character readable measure. At 14 px with 24 px leading, line-return
  errors become frequent — exactly the failure mode you least want in a privacy notice. The guides
  and the pub hub both cap at `max-w-[68ch]`; the legal pages, which need it most, do not.
- **Recommended Redesign:** `text-base leading-7 max-w-[68ch] text-foreground` on the clause body
  (raise from 14 px to 16 px and drop `muted-foreground` — legal body text should not be secondary
  colour), and let the `ReceiptCard` keep the full width for the clause headings and rules.
- **Priority:** Critical

### 65. Clause headings are 11.5 px uppercase mono — smaller than the body they head
- **File(s):** `components/legal/legal-document-page.tsx:74-76`; `app/terms/page.tsx:116`;
  `app/privacy/page.tsx:151`
- **Current UX/UI Problem:** `<h2 className="mono-meta tracking-[0.08em] text-foreground">` — 11.5 px
  Space Mono 700 uppercase — above a 14 px body paragraph. Ten to twelve of these per page, with no
  number, no size step, no colour differentiation.
- **Why It Is a Problem:** hierarchy is inverted: the heading is 2.5 px *smaller* than the text it
  introduces, so a 12-clause privacy notice presents as an undifferentiated grey slab. It also
  contradicts DESIGN.md's register rule — clause titles like "How we use your information" are
  spoken voice, not printed metadata. And `tracking-[0.08em]` is an arbitrary override of
  `mono-meta`'s own `0.06em`, applied at three call sites.
- **Recommended Redesign:** `h2` → `text-base sm:text-lg font-extrabold text-foreground`, with a
  `mono-id` clause number (`§04`) rendered as a self-linking anchor beside it so clauses become
  deep-linkable and countable. Delete the `tracking-[0.08em]` overrides.
- **Priority:** High

### 66. `.w-rule` is applied to `<section>` elements, injecting 14 px margins the parent thinks it removed
- **File(s):** `components/legal/legal-document-page.tsx:72`; `app/terms/page.tsx:114`;
  `app/privacy/page.tsx:149`; `app/globals.css` `.w-rule`
- **Current UX/UI Problem:** each clause is
  `<section className="w-rule focus-ring grid scroll-mt-28 gap-2 pt-4">` inside a parent
  `<ReceiptCard className="grid gap-0">`. `.w-rule` is defined as
  `border: none; border-top: 2px dashed var(--w-line); margin: 14px 0;` — an `<hr>` treatment. So
  every clause silently gains a 14 px top **and** bottom margin on top of its `pt-4`, and adjacent
  margins collapse to 14 px, giving ~30 px between clauses despite the parent declaring `gap-0`.
- **Why It Is a Problem:** the author wrote `gap-0` intending tight stacking and got 30 px anyway;
  the spacing is unreachable from the parent. Reusing an `<hr>` utility as a section border is also
  a maintenance trap — a future change to `.w-rule`'s margin will silently reflow all five legal
  pages.
- **Recommended Redesign:** drop `.w-rule` from the section and use
  `border-t-2 border-dashed border-border pt-5 first:border-t-0 first:pt-0` with the parent at
  `gap-5`. Explicit, tunable from one place, and the first clause stops carrying a stray rule under
  the card title.
- **Priority:** Medium

### 67. `/terms` and `/privacy` are hand-rolled copies of `LegalDocumentPage`
- **File(s):** `app/terms/page.tsx:38-120`; `app/privacy/page.tsx:38-155`;
  `components/legal/legal-document-page.tsx:21-95`
- **Current UX/UI Problem:** all three render the identical shell — `Section as="div"
  grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]`, the same `aside` TOC, the same `PageTitle` with
  the same `titleClassName` clamp, the same `ReceiptCard edge grid gap-0` with the same
  `cardTitle`/`docNumber` header row, the same section renderer, the same related-link button row.
  `/terms` has a private `TermsBlock` and `/privacy` a private `PolicyBlock` that are
  character-for-character identical to the inline renderer in `LegalDocumentPage`.
- **Why It Is a Problem:** three copies of one page shell means every fix in this section (findings
  63–66) has to be made three times, and they will drift. `/privacy` has already drifted — it adds
  two `surface-card` callouts that the shared component has no slot for.
- **Recommended Redesign:** extend `LegalDocumentPage` with optional `intro` and `outro` `ReactNode`
  slots (which is all `/privacy` needs), then delete `TermsBlock`, `PolicyBlock` and both page
  bodies. ~150 lines removed and one place to apply findings 63–66.
- **Priority:** High

### 68. Legal pages carry no effective date, version or print treatment
- **File(s):** `lib/legal/content.ts` (`*_META` exposes `eyebrow`, `title`, `description`,
  `cardTitle`, `docNumber` only); `components/legal/legal-document-page.tsx:60-66`
- **Current UX/UI Problem:** the card header shows `cardTitle` and `Nº {docNumber}`. There is no
  "last updated" date, no version number, no change summary, and no `@media print` treatment. The
  `docNumber` is presented as mono metadata with no explanation of what it identifies.
- **Why It Is a Problem:** "when did these terms change" is the single most common question a
  merchant or a regulator asks of a terms page, and it is unanswerable here. Merchants who need to
  file the terms will print the page and get the sticky header, the TOC aside and the site footer.
- **Recommended Redesign:** add `effectiveOn` to the `*_META` type and render it beside the doc
  number as `mono-id` (a genuine use of the mono register). Add a small print stylesheet: hide
  `header`, `footer`, `aside`; force `max-w-none`; expand all `<details>`.
- **Priority:** Medium

### 69. Related-link rows use three different button treatments across five legal pages
- **File(s):** `app/terms/page.tsx:87-94` (two `variant="secondary"` default size);
  `app/privacy/page.tsx:127-129` (one `variant="secondary" className="w-fit"`);
  `components/legal/legal-document-page.tsx:84-90` (N `variant="secondary"`, wrapped)
- **Current UX/UI Problem:** the same "go to the related document" affordance is a two-button row on
  `/terms`, a single `w-fit` button on `/privacy`, and a variable-length wrapped row on the other
  three (up to three buttons on `/data-processing`).
- **Why It Is a Problem:** cross-document navigation between five interlinked legal pages should be
  identical on all five so a reader learns it once. Three 44 px buttons at the bottom of
  `/data-processing` is also 44 px of chrome per link for a low-frequency action.
- **Recommended Redesign:** one shared `<RelatedDocuments />` block for all five: a
  `border-t-2 border-dashed` footer with an `eyebrow "Related documents"` label and inline
  `min-h-11` text links, not buttons. Falls out of finding 67 automatically.
- **Priority:** Low

---

## Cross-cutting patterns (repeated offenders)

**P1 — `lg:` is used as the first column break in 11 layouts.** `product-moment`, `guarantee-stack`,
`scarcity-band`, `commercial-evidence-proof`, `pub-fit-test`, `persona-page`, `how-it-works`
(×2), `hero`, `process-hero`, `pub-guide-hero`. Every tablet renders the phone composition at
full page height. One mechanical `md:` sweep is the highest leverage change available.

**P2 — `SectionHeader`'s `h2` is fixed at `text-lg` (18 px)** and is used by 8 marketing components,
producing section headings that are smaller than the card titles beneath them. Directly causes
findings 14 and 29, and contributes to 56.

**P3 — `mono-id` (10 px uppercase Space Mono) is used for prose, not IDs**, in at least 12 places:
`cancelLine` ×9, `feature.removes`, the SnapRail swipe hint, `options-matrix` `dt` labels,
`hub-handoff` fine print, `pub-guide-hero` byline. DESIGN.md reserves the mono register for
"printed" facts; a 96-character sentence in 10 px all-caps is a readability failure and, for the
cancellation term, a compliance risk.

**P4 — Underlined text links have no `min-h`,** at 6 call sites (`hero`, `process-hero`, `fit-note`,
`pub-guide-hero`, `options-matrix`, `guide-page`) plus the guide-page sibling list. Every one is a
~14 px-tall target beside a 48 px button.

**P5 — Duplicated components rather than shared ones:** `FaqList`/`LandingFaq`; `ProofLine`/`ProofStrip`;
the maths receipt (`/pricing` vs `outcome-transformation`); `TakeoverAnchor` vs the landing bespoke
card; `/terms` + `/privacy` vs `LegalDocumentPage`; the landing pricing card vs `GrowthPlanPricing`.
Six pairs, all already drifted in type scale, padding or content.

**P6 — CTA repetition without hierarchy.** "Start your launch" appears at 18 call sites in scope; the
landing page renders it 3× (header, hero, pricing, final CTA = 4 including the header). Six surfaces
end with 2–3 equal-weight `size="lg"` buttons that stack into 100–170 px towers on mobile.

**P7 — Three accordion dialects and three TOC answers.** `<details>` is styled three ways
(`GuaranteeStack`, `FaqList`, `LandingFaq`); long-document navigation is solved three ways (sticky
spine on the hub, aside TOC on legal, nothing on guides).

**P8 — Hand-rolled circles and one-off spacing values outside the scale.** `till-moment`'s `size-7`
disc (vs `IconRoundel size="sm"`), `vendor-questions`' `p-3.5`, `final-cta`'s
`sm:[--card-spacing:--spacing(8)]`, `pl-[3.25rem]` in `LandingFaq`, `tracking-[0.08em]` at three
legal call sites, `pb-10` at three section call sites.

**P9 — No hover, loading or empty states on the marketing surface.** The only hover treatments are
colour changes on nav/spine links and a 2 px icon translate in `hub-handoff`. There is no skeleton
anywhere (findings 13), no empty state for missing evidence, and the system's signature press/shadow
affordance never appears on a linked card.

---

## Top 5 highest-impact changes

1. **Add a `md:` column break to the 11 `lg:`-gated layouts (P1, findings 11, 12, 28, 29, 30, 52).**
   One mechanical sweep removes roughly 35–45 % of the vertical height on every tablet across `/`,
   `/how-it-works`, `/pricing` and `/loyalty-for-pubs`, with zero copy or component changes. Highest
   ratio of impact to risk on this surface.

2. **Give phones a header navigation (finding 1).** Right now Pricing, How it works, FAQ and Log in
   are 5,400 px away from a mobile visitor. A scrollable pill rail under the header — or the
   existing `Sheet` primitive — is a small change that fixes the most consequential usability gap in
   the audit.

3. **Cut `/how-it-works` from ~4,600 px to ~3,200 px (findings 22, 23).** Delete the duplicate
   `MARQUEE_STEPS` strip, horizontalise `LaunchSteps` at `sm:grid-cols-2 lg:grid-cols-5`, and merge
   `ProblemPains` with `FeaturesListicle`'s `removes` line into one objection→answer band. Removes
   ~1,450 px and two full bands of repetition while making the argument tighter.

4. **Fix the legal reading experience (findings 63, 64, 65, 67).** Cap clause bodies at
   `max-w-[68ch] text-base`, promote clause headings from 11.5 px mono to 16–18 px Bricolage, move
   the TOC above the article on mobile as a `<details>`, and collapse `/terms` + `/privacy` into
   `LegalDocumentPage`. This is the site's longest prose at its worst measure, and one component
   change fixes all five pages.

5. **Unify the type scale: two title sizes, one `SectionHeader` band size, and stop setting prose in
   `mono-id` (findings 14, 24, 25, 54; P2, P3).** Five H1 scales, three H2 scales for the same rank,
   and 12 places where 10 px uppercase mono carries sentences — including the cancellation term.
   Fixing the scale is the single change that most improves perceived quality across every page in
   scope, and the `cancelLine` fix has a compliance dimension as well as a legibility one.



# B. Customer / Member Journey

# Nabaperks — Customer (Member) Journey UX/UI Redesign Audit

**Scope:** `app/home/**`, `app/card/[membershipId]/**`, `app/offer/[token]/**`,
`app/pass/[entitlementId]/**`, `app/scan`, `components/customer/**`,
`components/loyalty/**`, `components/layout/customer-*`, `components/pwa/app-pwa.tsx`.

**Method:** read-only source read of every file in scope plus the primitives they
compose (`components/ui/button|card|alert|empty`, `components/brand/*`) and the
`app/globals.css` Wet Ink layer. Heights below are computed from the actual
Tailwind scale in the markup (`--card-spacing: --spacing(6)` = 24px on
`ReceiptCard padding="md"`, `gap-6` = 24px, `pb-32` = 128px, etc.) against two
reference viewports: **iPhone SE 375×667** and **iPhone 14 Pro Max 430×932**.
The customer column is capped at `--container-customer: 25.625rem` = **410px**.

**Reference measure used throughout.** At 375px the shell is `px-4` → 343px of
content; a `ReceiptCard` at `padding="md"` removes 48px → **295px of usable
inner width**. At 430px the column caps at 410px → **362px inner**. Every
"does it fit" judgement below uses those two numbers.

---

## A. Customer shell, chrome and navigation

### 1. Authed shell reserves 128px of bottom padding for a 58px tab bar
- **File(s):** `components/layout/customer-app-shell.tsx:30`; `components/layout/customer-tab-bar.tsx:52-55`
- **Current UX/UI Problem:** `<main className="… px-4 pt-6 pb-32 sm:px-6">` reserves
  `pb-32` = 128px. The bar it clears is `min-h-14` (56px) + `border-t-2` (2px) +
  `pb-[env(safe-area-inset-bottom)]`, i.e. 58px on an SE and ~92px on a notched
  device. That is **70px of dead paper on an SE** and ~36px on a Pro Max, at the
  bottom of every home tab.
- **Why It Is a Problem:** On the surface where vertical budget is scarcest, a
  fixed magic number wastes most of a card-tile row and makes every page feel
  like it has an unexplained tail. It also means the last real element never
  sits near the thumb rest.
- **Recommended Redesign:** Replace the magic number with a token derived from
  the bar itself: define `--customer-tabbar-h: calc(3.5rem + 2px)` in
  `globals.css`, then `pb-[calc(var(--customer-tabbar-h)+env(safe-area-inset-bottom)+0.75rem)]`.
  Apply the identical token in `CustomerCardExperience`'s `className="pb-28"`
  (`components/customer/customer-card-experience.tsx:87`) and
  `app/pass/[entitlementId]/page.tsx:62`, which currently use a *different*
  magic number (112px) for the same bar.
- **Priority:** Medium

### 2. Sticky header spends ~70px on a logo and a "Log out" button
- **File(s):** `components/layout/customer-app-shell.tsx:16-28`
- **Current UX/UI Problem:** The sticky header is `py-3` around a `Logo`
  (`min-h-11`) and a default-size `Button` (`h-11`) → ~70px permanently
  occupied. "Log out" is the single most destructive and least frequent action
  in the member journey, and it is the only header action, rendered at full
  `variant="secondary"` weight with a 3px hard shadow.
- **Why It Is a Problem:** On an SE the header + tab bar consume 128px of 667px
  (19% of the viewport) before any content. Giving the sign-out the loudest slot
  in the chrome inverts the hierarchy — a member's most common intent is "show my
  card", not "log out".
- **Recommended Redesign:** Drop the header to `py-2` and `Logo compact` on
  `<640px`, and move "Log out" into the Profile tab (which already has a
  "Your details" surface and a `Member since …` footer line at
  `app/home/(authed)/profile/page.tsx:58`). If a header action must stay, make it
  `size="icon-sm" variant="ghost"`. Net saving ≈ 24px on every authed page, plus
  a calmer hierarchy.
- **Priority:** Medium

### 3. Tab-bar labels use an unsanctioned micro-type size
- **File(s):** `components/layout/customer-tab-bar.tsx:66`
- **Current UX/UI Problem:** `text-[0.6875rem]` = 11px Bricolage. `DESIGN.md`
  states that below `text-xs` (12px) there are **exactly two** sanctioned sizes,
  both Space Mono: `.mono-meta` (11.5px) and `.mono-id` (10px). This is a third,
  hand-rolled size in the *spoken* face, in the most-seen component in the app.
- **Why It Is a Problem:** Contract drift in the navigation sets the precedent
  every other surface copies; and 11px Bricolage 700 at 5-across is genuinely
  tight on a 320px device (82px → 64px per tab).
- **Recommended Redesign:** Either promote the labels to `text-xs` (12px) and
  reduce the icon chip from `size-9` to `size-8` to keep the 56px bar height, or
  adopt `.mono-meta` for the labels so the receipt voice carries the nav
  (consistent with `Eyebrow` usage everywhere else). Do not keep an arbitrary
  value.
- **Priority:** Medium

### 4. Tab-bar tap target is 56px tall but the visual affordance is only 36px
- **File(s):** `components/layout/customer-tab-bar.tsx:65-82`
- **Current UX/UI Problem:** The `<Link>` is `min-h-14` and full column width so
  the hit area is fine, but the *only* visual state change is the `size-9` (36px)
  roundel filling with ink. An inactive tab has `border-transparent` and a
  hover-only `group-hover:border-ink/30` — there is no `active:` press feedback
  and no `data-active` underline/rule. On touch there is no hover, so the tab bar
  gives **zero** feedback between tap and route change.
- **Why It Is a Problem:** On a slow dynamic route (`/home` and `/scan` are both
  server-rendered with real I/O) the member taps and nothing happens for
  hundreds of milliseconds — the classic "did it register?" moment, which
  produces double taps.
- **Recommended Redesign:** Add `active:translate-y-px` and an instant pressed
  fill (`active:bg-secondary`) on the roundel, plus a 2px ink rule above the
  active tab (`data-[active=true]:before:…` or a `-mt-0.5 h-0.5 bg-ink` marker).
  Use `useLinkStatus`/`usePathname` optimistic state so the tapped tab flips to
  active immediately rather than after navigation commits.
- **Priority:** High

### 5. `CustomerShell` and `CustomerAppShell` are two different columns for one journey
- **File(s):** `components/layout/customer-shell.tsx:13`; `components/layout/customer-app-shell.tsx:30`; `components/customer/customer-flow-system.tsx:48-56`
- **Current UX/UI Problem:** Three shells wrap the same 410px measure with three
  different rhythms: `CustomerShell` = `px-4 pt-6 pb-[max(1.5rem,safe)] sm:px-6 sm:pt-10 sm:pb-10`;
  `CustomerAppShell` = `px-4 pt-6 pb-32 sm:px-6`; `CustomerFlowShell` = `px-4 pt-5 pb-[max(1.25rem,safe)] sm:px-6 sm:pt-8`
  (or `pt-4` when `dense`). A member moving `/home` → `/card/x` → `/pass/y` gets
  24px, then 20px, then 20px of top padding, and a `max-w-customer` column that
  is `min-h-svh` in one shell and `min-h-[100dvh]` in another.
- **Why It Is a Problem:** Sibling screens in one journey should share a rhythm;
  the drift is small enough to read as sloppiness rather than intent, and the
  `svh`/`dvh` mismatch produces different scroll behaviour when the iOS URL bar
  collapses.
- **Recommended Redesign:** Extract one `CustomerColumn` primitive owning
  `px-4`, `pt-5`, the safe-area bottom, `min-h-[100dvh]` and `max-w-customer`;
  let the three shells differ only in whether they render the app header/tab bar.
  Delete the `sm:` overrides (see finding 6).
- **Priority:** Medium

### 6. `sm:` / `md:` breakpoints inside a 410px-capped column are inert or misleading
- **File(s):** `components/layout/customer-shell.tsx:13`; `components/customer/customer-flow-system.tsx:49,55`; `components/loyalty/reward-ticket.tsx:80,83,130`; `components/customer/customer-qr-scanner.tsx:232`; `components/brand/typography.tsx:61,87`
- **Current UX/UI Problem:** The customer column never exceeds 410px, yet the
  markup is full of viewport queries: `sm:px-6` (fires at 640px viewport where
  the column is already capped — so it only shrinks content inside an already
  centred column), `RewardTicket`'s `sm:p-4` / `sm:w-[88px]` stub, the scanner's
  `sm:grid-cols-2` exits, `PageTitle`'s `md:grid-cols-[minmax(0,1fr)_auto] md:pt-8`
  action rail. None of these respond to the thing that actually varies — the
  **column width**, which is 343px at SE and 362px at Pro Max.
- **Why It Is a Problem:** The reward ticket is physically *smaller* on a 430px
  phone (`w-20` stub, `p-3`) than on a desktop browser showing the same 410px
  column (`w-[88px]`, `p-4`). Responsiveness is being applied to the wrong axis,
  so the design cannot be tuned for the phones it actually ships to.
- **Recommended Redesign:** Put `@container` on the `max-w-customer` div and
  convert every customer-surface `sm:`/`md:` to `@sm:`/`@md:` container variants,
  or delete them and pick a single mobile value. Introduce one real phone
  breakpoint that matters — `min-[400px]:` — for the handful of places where a
  430px phone can genuinely afford more (stamp disc size, reward-ticket stub).
- **Priority:** High

---

## B. Home dashboard (`/home`)

### 7. No loyalty card is visible on first paint on a 375px phone
- **File(s):** `app/home/(authed)/page.tsx:33-61`
- **Current UX/UI Problem:** Measured stack above the first `HomeCardTile`, at
  375×667 with one redeemable reward:
  header 70 + `pt-6` 24 + `PageTitle` ~107 (eyebrow 15 + `gap-3` 12 + `text-3xl`
  ~36 + `gap-3` 12 + 2-line description ~44) + `gap-6` 24 + `HomeSummaryStrip`
  ~40 + `gap-6` 24 + `HomeRedeemBanner` ~190 + `gap-6` 24 = **~503px**. The
  viewport above the tab bar is ~609px. The first card tile is ~330px tall, so
  roughly **the top 100px of one card** is visible, with nothing readable.
- **Why It Is a Problem:** The product's entire proposition — "here are your
  stamps" — is below the fold on the most common UK phone size. Three pieces of
  chrome (title, summary, banner) outrank the object the member opened the app
  to see.
- **Recommended Redesign:** (a) delete `PageTitle` here — the tab bar already
  says *Home* and the venue names are the real headings; replace with a single
  `Eyebrow`-sized line or nothing. (b) Fold `HomeSummaryStrip` into that line.
  (c) Demote `HomeRedeemBanner` to a 56px-tall pinned summary row that expands,
  or delete it because the redeemable card is already sorted first
  (`sortHomeCards` in `lib/customer/home-dashboard.ts:8-25` puts it at index 0
  and its tile already carries a green "Reward ready" `MonoTag` and a
  "Open reward QR" tag). Saving: **≈300px**, putting a whole card above the fold.
- **Priority:** Critical

### 8. `HomeRedeemBanner` duplicates the first card tile verbatim
- **File(s):** `components/customer/home-redeem-banner.tsx:13-39`; `components/customer/home-card-tile.tsx:44-89`
- **Current UX/UI Problem:** The banner prints `MonoTag "Ready for scan"`,
  `MonoTag {businessName}`, the reward name at `text-lg`, a support sentence, and
  a `mono-id` "Open reward QR" affordance — ~190px. The tile immediately below it
  prints the same business name (`text-lg` h2), the same "Reward ready" leaf tag,
  the same "Open reward QR" tag, and links to the same `/reward/{id}`.
- **Why It Is a Problem:** Two identical calls to action stacked adjacently
  halve the perceived credibility of both and cost a third of a screen. It also
  creates two competing `Link`s to one destination for screen-reader users.
- **Recommended Redesign:** Delete `HomeRedeemBanner`. Instead give the
  already-first tile a redeemable treatment: `bg-accent`, a leaf top rule, and
  promote its inline `MonoTag` to a real `Button variant="reward" size="sm"`
  inside the tile (outside the wrapping `Link`, as the pass chips already do at
  `home-card-tile.tsx:141-143`).
- **Priority:** High

### 9. `HomeSummaryStrip` is a low-value 40px band with off-contract styling
- **File(s):** `components/customer/home-summary-strip.tsx:15`
- **Current UX/UI Problem:** `rounded-[var(--radius)] border-2 border-dashed
  border-ink/25 bg-card px-4 py-3 mono-meta tracking-[0.08em]` renders
  "2 cards / 1 reward ready / 2 stamps today" — every fact is derivable by
  looking at the tiles below. Three contract breaks in one line: `border-ink/25`
  is a **third dashed tone** (DESIGN.md sanctions exactly `--w-line` 18% and
  `--w-line-strong` 50%), `rounded-[var(--radius)]` is an arbitrary value where
  `rounded-lg` is the token, and `tracking-[0.08em]` re-declares tracking that
  `.mono-meta` already sets to `0.06em` (so the utility silently overrides the
  contract metric).
- **Why It Is a Problem:** Redundant information at the top of the scarcest
  screen, styled with three off-token values, in a system whose whole premise is
  a tight token contract.
- **Recommended Redesign:** Delete the strip, or reduce it to one `Eyebrow` line
  under the (removed) page title: `<Eyebrow>2 cards · 1 reward ready</Eyebrow>`.
  If a bordered container is kept, use `.w-rule`-toned `border-line` and
  `rounded-lg`, and drop the `tracking-` override.
- **Priority:** Medium

### 10. `HomeCardTile` is ~330px tall and stacks up to six sub-blocks per venue
- **File(s):** `components/customer/home-card-tile.tsx:59-158`
- **Current UX/UI Problem:** One tile can render, vertically:
  ReceiptCard 24px padding → venue header (eyebrow + `text-lg` h2 + locality +
  48px `VenueMark`) ≈ 61 → `gap-4` → tag row ≈ 26 → `gap-4` → stamp grid box
  (`rounded-lg bg-accent p-3`, 2 rows of ~40px compact discs + reward-chip label)
  ≈ 124 → `gap-4` → reward chip *or* status line ≈ 24-100 → `gap-4` →
  `ReferralBonusBankMini` ≈ 90 → `gap-4` → `TileGiftChip` ≈ 100 → close 24; then
  **outside** the card: `TilePassChip` (~130 each), `ReferralShareButton` (44),
  `GoogleReviewButton` (44). A fully-loaded tile exceeds **600px**. Three venues
  → ~1,500-1,800px of scrolling.
- **Why It Is a Problem:** A dashboard tile should be a scannable summary, not a
  full card page. At this height only one venue is ever on screen, which defeats
  the purpose of a multi-venue wallet.
- **Recommended Redesign:** Make the tile a fixed-height **summary row** (~120px):
  `grid grid-cols-[auto_minmax(0,1fr)_auto]` with the 40px `VenueMark`, a
  two-line lockup (venue + `n/m stamps`), a right-aligned state chip, and a
  single-row `StampGrid layout="row" flow="horizontal" compact` under it. Move
  gift/pass/referral/review to the card page only — they are all already
  rendered there (`customer-card-experience.tsx:327-352`). Keep at most one
  contextual chip per tile. Saving: **≈200px per venue**.
- **Priority:** Critical

### 11. Tile accessible name contradicts its destination when a reward is ready
- **File(s):** `components/customer/home-card-tile.tsx:41-43,61-64`
- **Current UX/UI Problem:** `href` becomes `/reward/{stampRewardId}` when a
  reward is redeemable, but `aria-label` is hard-coded
  `` `Open your ${card.businessName} card` ``. The visible `MonoTag` in the same
  link says "Open reward QR".
- **Why It Is a Problem:** WCAG 2.5.3 (Label in Name) — the accessible name does
  not contain the visible label, and it describes the wrong destination. Voice
  control users saying "open reward QR" will not match the link.
- **Recommended Redesign:** Derive the label from the same branch:
  `aria-label={card.stampRewardId ? `Open your ${card.businessName} reward QR` : `Open your ${card.businessName} card`}`.
- **Priority:** High

### 12. The unavailable-card branch renders an empty 26px dashed box
- **File(s):** `components/customer/home-card-tile.tsx:102-104`
- **Current UX/UI Problem:** When `stampsRequired === null || !card.available`
  the tile renders `<div className="rounded-lg border-2 border-dashed border-ink/20 bg-card p-3" />`
  — a bordered box with **no children**: 2px border + 12px padding top and
  bottom = ~26px of empty dashed rectangle. `border-ink/20` is another
  off-contract dashed tone.
- **Why It Is a Problem:** It reads as a rendering failure, not a state. The
  member gets an empty box plus a separate paragraph (`homeCardStatusCopy`) that
  says "This card is unavailable right now" — the box adds nothing but noise.
- **Recommended Redesign:** Render nothing in that branch and let the status
  paragraph carry the state; or if a placeholder is wanted, use a `.w-rule`
  hairline with a `mono-id` caption ("No stamp row while this card is paused").
  Replace `border-ink/20` with `border-line`.
- **Priority:** Medium

### 13. Gift, pass and bonus-bank chips are three visually identical blocks
- **File(s):** `components/customer/home-card-tile.tsx:106-119,168-191,231-247`; `components/customer/referral-bonus-bank-panels.tsx:51-69`; `components/customer/customer-card-experience.tsx:364-397,464-490`
- **Current UX/UI Problem:** Five separate components all render
  `grid gap-1.5 rounded-lg border-2 border-ink bg-seal/15 p-3` with a 14-16px
  icon + `Eyebrow` + `text-sm font-extrabold` + a `mono-id` chip
  (`bg-seal/25 border-2 border-ink px-2 py-0.5`). Revealed reward, discount pass,
  gift, referral bonus bank mini and the card-page equivalents are
  indistinguishable at a glance — same sun wash, same border, same rhythm.
- **Why It Is a Problem:** Three different promises with three different rules
  (single-use reward vs unlimited-use pass vs bonus-stamp bank) are given one
  visual identity, which is exactly the confusion the code comments say they are
  trying to prevent.
- **Recommended Redesign:** Extract one `PromiseChip` primitive with a `kind`
  prop (`reward | pass | gift | bonus`) and differentiate by spot ink per
  `DESIGN.md`: reward → `bg-reward/12` leaf, pass → `bg-cobalt/10`, gift →
  `bg-seal/15` sun, bonus bank → plain `bg-secondary`. One implementation, four
  tones, and the duplicated markup in `home-card-tile` / `customer-card-experience`
  collapses into one file.
- **Priority:** High

### 14. `HomeEmptyState` is ~500px of nested cards with conflicting max-widths
- **File(s):** `components/customer/home-empty-state.tsx:22-55`; `components/brand/typography.tsx:196-213`; `components/ui/empty.tsx:5-15,84-94`
- **Current UX/UI Problem:** `EmptyState` renders `Empty` with `p-12` (48px each
  side). Inside `EmptyContent` (which is `max-w-sm`, 384px) sits a
  `ReceiptCard className="w-full max-w-xl"` (576px) — the inner `max-w-xl` can
  never take effect. Net content width at 375px: 343 − 96 (`p-12`) − 32
  (`padding="sm"`) = **215px** for a numbered how-it-works list plus a full-width
  `size="lg"` button. Total height: icon roundel 44 + title + description + card
  (~230) + 96 padding ≈ **500px**.
- **Why It Is a Problem:** The first-run screen — the one moment where clarity
  matters most — is the most cramped surface in the app, with a 215px measure for
  3 lines of instructions and a CTA.
- **Recommended Redesign:** Drop `p-12` to `p-5` for the customer column
  (`EmptyState` should take a `padding` prop or the customer surface should pass
  `className="p-5"`), remove the nested `ReceiptCard` entirely (an empty state
  inside a card inside an empty state), and render the three steps as a flat
  `ol` on the paper. Remove the dead `max-w-xl`. Recovered width: **+64px**;
  recovered height: **≈150px**.
- **Priority:** High

### 15. `HomeActivitySnippet` repeats the Activity tab at full row weight
- **File(s):** `components/customer/home-activity-snippet.tsx:27-56`; `app/home/(authed)/activity/page.tsx:52-72`
- **Current UX/UI Problem:** The snippet renders the *identical* row markup as
  the Activity page (`surface-card grid gap-2 p-4` + tag row + title + 2-line
  description) — ~110px per row, plus a `SectionHeader` (eyebrow + `text-lg` h2)
  ≈ 50 and a "See all activity" link. Three items ≈ **420px** appended to the
  bottom of a dashboard that already scrolls ~1,800px, duplicating a tab that is
  one thumb-tap away in the bar.
- **Why It Is a Problem:** Pure duplication of a first-class destination,
  charged at maximum height, at the point where members have already stopped
  scrolling.
- **Recommended Redesign:** Either delete it (the Activity tab exists) or render
  it as three single-line `mono-meta` rows: `<time>` + one clause, `py-2` each
  (~34px per row) under a plain `Eyebrow`. Saving: **≈300px**.
- **Priority:** High

### 16. Home page rhythm does not match its own loading skeleton
- **File(s):** `app/home/(authed)/page.tsx:34,48`; `components/customer/loading-skeletons.tsx:260-280`
- **Current UX/UI Problem:** The page is `grid gap-6` with an inner `grid gap-4`;
  `CustomerHomeSkeleton` is `grid gap-5` with an inner `grid gap-3.5`. The
  skeleton also renders `ReceiptCard edge` (adds the 12px `.receipt-edge`) and an
  `<hr className="w-rule" />` (28px of margin) that the real `HomeCardTile` does
  **not** render, and omits the tag row, the `bg-accent p-3` stamp well, the
  status line and every chip.
- **Why It Is a Problem:** The file's own docblock promises "the swap to real
  content never shifts the layout". In practice each tile jumps by ~40px on
  arrival and the whole stack shifts by 4px per gap — visible content shift at
  exactly the moment of first paint (CLS).
- **Recommended Redesign:** Derive the skeleton from the real components: use
  `gap-6`/`gap-4`, drop `edge` and the `hr`, add a `h-[26px]` tag-row skeleton and
  an `h-[124px] rounded-lg bg-accent` stamp-well block. Better: add a
  `loading` prop to `HomeCardTile` so there is one layout, not two.
- **Priority:** Medium

### 17. `HomeBirthdayPrompt` is a full card for an optional, dismissible nudge
- **File(s):** `components/customer/home-birthday-prompt.tsx:62-81`
- **Current UX/UI Problem:** A `ReceiptCard` (24px padding, hard shadow, ink
  border) with a `MonoTag`, an `h2`, a 2-line paragraph and two `size="sm"`
  buttons ≈ **185px**, injected between the redeem banner and the cards. It uses
  the same surface weight as an actual loyalty card.
- **Why It Is a Problem:** An optional data-collection ask is given the same
  visual authority as the member's stamps, and it pushes the cards further below
  the fold (compounding finding 7).
- **Recommended Redesign:** Move it below the card list, and render it as a
  single dismissible row: `flex items-center gap-3 rounded-lg border-2 border-dashed border-line p-3`
  with one line of copy, a `size="sm"` link and an `icon-sm` ghost dismiss.
  Height ≈ 60px. Alternatively surface it only on the Profile tab, where the
  member is already in a details mindset.
- **Priority:** Medium

---

## C. Card and stamp experience (`/card/[membershipId]`, `/card/[membershipId]/stamp`)

### 18. The stamp button — the product's primary verb — is the last element on the screen
- **File(s):** `components/customer/stamp-collector.tsx:235-282`; `components/customer/customer-flow-system.tsx:298-333`
- **Current UX/UI Problem:** `CustomerStampCard` renders in strict DOM order:
  `StampGrid` → `afterGrid` (the 112px `StampStatusBand`) → `RewardTicket` →
  `children` (the `StampPressButton`). Measured at 375×667:
  `pt-5` 20 + flow header 36 + `gap-5` 20 + headline block ~130 + `gap-5` 20 +
  receipt [24 padding + `VenueMark` 58 + `.w-rule` 30 + grid ~110 + `gap-4` 16 +
  status band 112 + 16 + reward ticket ~120 + 16 + `pt-2` 8 + button 112 + 24]
  ≈ 646 + edge 12 → **the 112px stamp disc starts at ≈ y 900px**. The viewport is
  667px. The member must scroll ~350px to reach the only control on the screen.
- **Why It Is a Problem:** This is the counter moment: one hand, a queue behind
  them, a phone half-out of a pocket. Requiring a scroll to find the stamp
  button is the single largest usability defect in the member journey.
- **Recommended Redesign:** Reorder to **grid → status band → stamp button →
  reward ticket**, and make the reward ticket collapsible on this screen (it is
  purely motivational during the stamp act). Additionally, on `/card/[id]/stamp`
  drop the flow-shell headline block (`vm.headline` "Stamp it here" +
  `supportLine` = merchant name duplicates the `VenueMark` and eyebrow already in
  the receipt) — `hideHeaderText` is already used, so the outer headline is the
  duplicate. Combined saving above the button: **≈300px**, which puts the disc
  in the lower third of an SE viewport where the thumb is.
- **Priority:** Critical

### 19. The stamp status band reserves a fixed 112px scroll container
- **File(s):** `components/customer/stamp-collector.tsx:63-91`
- **Current UX/UI Problem:** `grid h-28 grid-rows-[1.5rem_1fr] content-start
  gap-1 overflow-y-auto rounded-lg border-2 px-4 py-3` — a hard 112px box with
  its own scrollbar, present in every phase including idle, where it contains
  only "Ready for today's stamp." / "Tap the stamp, or press and hold, to print
  today's mark." (about 60px of real content). The 52px of slack exists so the
  longest state string does not reflow the card.
- **Why It Is a Problem:** The reserved-band decision is correct (DESIGN.md's
  readback rule) but 112px is the wrong size for it: it is measured against the
  worst case rather than the common case, and `overflow-y-auto` means a long
  blocked-state message becomes an unnoticed inner scroll region on a phone.
- **Recommended Redesign:** Use `min-h-20` (80px) with `grid-rows-[auto_1fr]` and
  drop `overflow-y-auto` — let it grow. Growth below the grid does not move the
  grid (the rule that matters), and the two-line worst case fits 80px at
  `text-sm/leading-5`. Recovers 32px and removes a hidden scroll trap.
  Also replace `border-line` (an 18% hairline colour used at 2px width, line 82)
  with `border-ink` for the resting state, matching every other 2px border in the
  system.
- **Priority:** High

### 20. Card screen appends five optional rails below the card, unbounded
- **File(s):** `components/customer/customer-card-experience.tsx:327-354`
- **Current UX/UI Problem:** After the receipt the panel stacks, each in
  `grid gap-4`: `CardGiftChip` (~110), one `CardOfferPassChip` per pass (~130
  each), `ReferralBonusBankNotice` (~230: header + headline + a 3-column `dl` of
  bordered stat tiles + detail paragraph + a bordered "Stamp rule" block),
  `ReferralSharePanel` (~290: icon + heading + paragraph + two `size="lg"`
  full-width buttons + a manage row), `GoogleReviewButton` (44), and
  `CardDetailsDisclosure`. Worst case adds **≈850px** below a ~650px card.
- **Why It Is a Problem:** The card page becomes a 1,500px marketing scroll. The
  referral panel alone is taller than the stamp grid it is meant to support, and
  two full-width `size="lg"` buttons ("Share your link", "Copy link") for one
  intent is a duplicated primary action.
- **Recommended Redesign:** Collapse the rails into a single "More from
  {venue}" section using `Accordion`/`details` with three rows (Passes & gifts ·
  Bring a regular · Leave a review), closed by default. In `ReferralSharePanel`
  keep one `Button size="lg"` ("Share your link") and demote copy to a
  `variant="link" size="sm"` under it — `navigator.share` already falls back to
  clipboard (`referral-share-panel.tsx:83`), so the second button is redundant on
  every device that has a share sheet. Saving: **≈500px**.
- **Priority:** Critical

### 21. The card screen prints one headline three times
- **File(s):** `components/customer/customer-card-experience.tsx:83-89`; `lib/customer/experience/copy.ts:213-224`; `components/customer/customer-flow-system.tsx:299-306`
- **Current UX/UI Problem:** For `card_collecting`, `vm.eyebrow = merchantName`
  and `vm.headline = cardName`, so the flow shell prints a `MonoTag` with the
  merchant name and an `h1` at `text-[2.1rem]` with the card name — then
  `CustomerStampCard` is passed `hideHeaderText`, which removes them from the
  receipt but keeps the `VenueMark` (a 58px disc with the venue's initials). On
  `justJoined` the headline becomes `Welcome to {merchantName}` **and** a
  `StatusBanner` inside the receipt says `Welcome to {merchantName}.` again
  (line 258).
- **Why It Is a Problem:** At 2.1rem the headline consumes ~70-105px (it wraps to
  2-3 lines for names like "The Old Crown Girton Loyalty Card") before any
  content, and the celebration banner then restates it. Three utterances of one
  fact.
- **Recommended Redesign:** On the card route drop `vm.headline` to
  `text-[1.35rem]` (or reuse `dense`), and make the welcome `StatusBanner` say
  the *new* thing only ("Your first stamp is on the card") without repeating the
  venue. Saving ≈ 60px and one duplicated sentence.
- **Priority:** High

### 22. `CustomerFlowShell` headline uses arbitrary type sizes outside the scale
- **File(s):** `components/customer/customer-flow-system.tsx:97,104`
- **Current UX/UI Problem:** `dense ? "text-[1.65rem]" : "text-[2.1rem]"` (26.4px
  / 33.6px) and the description at `text-[0.96rem]` (15.36px). `DESIGN.md`
  specifies page-title at 30px mobile / 36px `sm+` and body at 15px — none of
  these three values exist in the Tailwind scale or the design contract, and
  `PageTitle` (used by the home tabs) uses `text-3xl sm:text-4xl` for the same
  role.
- **Why It Is a Problem:** Two headline scales in one journey: `/home` titles are
  30px, `/card` titles are 33.6px, `/card` in dense mode is 26.4px. No systematic
  relationship, so vertical rhythm drifts page to page.
- **Recommended Redesign:** Delete the arbitraries. Use `text-2xl` (24px) for
  dense and `text-3xl` (30px) otherwise — matching `PageTitle` — and `text-[15px]`
  → `text-sm leading-6` for the description (the contract body size).
- **Priority:** Medium

### 23. `CardDetailsDisclosure` hides a summary row that could carry real state
- **File(s):** `components/customer/customer-card-experience.tsx:512-531`
- **Current UX/UI Problem:** A `<details>` whose entire payload is one `dl` row:
  `CARD Nº XXXXXXXX` and `One stamp per UK business day` at `mono-id` (10px). The
  summary trigger itself is `text-xs font-bold` — an unlabelled 12px link at the
  very bottom of a 1,500px page.
- **Why It Is a Problem:** A disclosure that hides 20px of content is pure
  interaction cost; and the one genuinely useful fact ("one stamp per UK business
  day") is the rule members most often ask about, buried behind a tap at the
  bottom of the longest page.
- **Recommended Redesign:** Delete the disclosure and print the stamp rule as the
  receipt's `footerRight` (the `CustomerReceipt` already supports
  `footerLeft`/`footerRight` and defaults to exactly this string — see
  `customer-flow-system.tsx:153`), with `footerLeft` as the card number. That is
  what `hideFooter` is currently switching off in order to re-implement it worse.
- **Priority:** Medium

### 24. Stamp press disc has no disabled/secured visual and no error affordance in place
- **File(s):** `components/customer/stamp-press-button.tsx:258-314,27-70`
- **Current UX/UI Problem:** When `inactive` (`disabled || secured`) the button
  keeps `aria-disabled` and swaps `cursor-pointer` → `cursor-default`, but
  `StampDiscFace` renders identically to the active state unless `confirmed` or
  `pending` is set. `DESIGN.md` specifies **disabled = 45-50% opacity**; the disc
  never applies it. There is also no `focus-visible` ring difference between
  active and inactive, and the blocked state (`phase === "blocked"`) is
  communicated only by the separate status band above.
- **Why It Is a Problem:** A member who has already stamped today taps a disc
  that looks fully live and nothing happens — the reason is 112px above, in a
  scrollable band they may not have scrolled to. That reads as a broken button.
- **Recommended Redesign:** Add `inactive && "opacity-50"` to the disc face (and
  a dashed ink border for the closed state), and render the one-line reason
  directly under the disc at `text-xs` when `inactive` — the same string already
  in `view.statusBody`. Keep the band for the readback, but never let the control
  be silent about its own state.
- **Priority:** High

### 25. Hold-to-stamp gesture is discoverable only to screen readers
- **File(s):** `components/customer/stamp-press-button.tsx:309-313`
- **Current UX/UI Problem:** "Tap, or press and hold, to add today's stamp" lives
  in an `sr-only` span. The 600ms hold with a charging ring is a signature
  interaction, and sighted members have no visual hint that it exists; the ring
  only appears **after** 130ms of holding.
- **Why It Is a Problem:** An invisible affordance is not an affordance. Members
  will always tap, so the hold path (and its haptics) is dead weight for
  virtually everyone.
- **Recommended Redesign:** Print the hint visibly under the disc at
  `.mono-meta text-muted-foreground` ("TAP OR HOLD TO STAMP") — it costs ~16px
  and replaces nothing. Or show a faint idle ring at ~8% opacity so the ring's
  existence is legible before the gesture starts.
- **Priority:** Medium

### 26. Location notice is a permanent grey block below the primary control
- **File(s):** `components/customer/stamp-collector.tsx:274-280`
- **Current UX/UI Problem:** `rounded-lg bg-secondary px-3 py-2 text-center
  text-xs leading-5 text-muted-foreground` renders two lines of geofence
  explanation (~56px) directly under the stamp disc, on every qualifying visit,
  before the member has done anything. It uses `rounded-lg` + `bg-secondary` with
  no border — a fourth surface treatment that matches nothing else in the system
  (every other note is either `StatusBanner`, `CustomerActionNote` or a
  `surface-card`).
- **Why It Is a Problem:** Pre-emptive apology for a check that usually
  succeeds, occupying the space directly below the primary control (where a
  result should land), in an unowned visual style.
- **Recommended Redesign:** Move it into the status band's idle `statusBody`
  (one clause: "This venue may check your location"), or render it as a
  `mono-id` line. Remove the bespoke surface.
- **Priority:** Medium

---

## D. Loyalty primitives

### 27. Stamp grid produces ragged, unbalanced rows at 6/8/10 stamps
- **File(s):** `components/loyalty/stamp-grid.tsx:200-228`
- **Current UX/UI Problem:** The default row layout is
  `repeat(auto-fit, minmax(min(2.75rem,100%), 1fr))` with `gap-2`. Computed
  against the real 295px receipt inner width at 375px:
  `n ≤ (295+8)/52 → 5 columns`, disc = 52.6px.
  - 6 stamps + reward chip = 7 slots → **5 + 2** (row 2 is 60% empty).
  - 8 + reward = 9 slots → **5 + 4**.
  - 10 + reward = 11 slots → **5 + 5 + 1** — a single lonely reward chip
    occupying a whole third row (~68px including its `mono-id` label).
  At 430px (362px inner) it becomes 6 columns → 6+1 / 6+3 / 6+5, i.e. the
  layout reflows completely between two common phones.
- **Why It Is a Problem:** A loyalty card is a *designed object*; a 5+1 or 5+2
  ragged row reads as a bug, not a card. The reward chip stranded alone on row 3
  disconnects it from the row it terminates. And because the column count is
  viewport-derived, the same card looks materially different on an SE and a Pro
  Max.
- **Recommended Redesign:** Choose the column count from the stamp total, not
  from available width — `wrapColumns` already exists for this. Map
  `total → columns`: ≤5 → `total+1` (one row); 6 → 4 (rows of 4+3, balanced);
  8 → 3 (3+3+3, the reward closing the last row); 10 → 4 (4+4+3). Pass
  `layout="wrap"` with that value on the customer card, so every card length has
  an intentional shape. `CustomerStampCard` already computes a `wrapColumnCount`
  (`customer-flow-system.tsx:295-296`) but only for `total ≤ 4` — extend that
  table rather than falling back to `auto-fit`.
- **Priority:** High

### 28. Stamp discs scale by count, so a 3-stamp card has 68px discs and a 10-stamp card 52px
- **File(s):** `components/loyalty/stamp-grid.tsx:211`; `components/loyalty/stamp-dot.tsx:59-66`
- **Current UX/UI Problem:** Because the tracks are `1fr`, the disc size is a
  function of how many fit per row: 4 slots → (295−24)/4 = **67.8px**; 5 slots →
  **52.6px**; compact tile at 6 per row → **40.2px**. The `min-h-11` floor never
  binds. Inside the disc, earned stamps print venue initials at `text-[0.81rem]`
  (13px) over a date at `.mono-id` (10px) with `tracking-[0.09em]`; at 40px the
  date is truncated to `date.split(" ")[0]` (`stamp-dot.tsx:184-189`), so the
  compact tile shows a bare day number with no month.
- **Why It Is a Problem:** The card's most important object has no consistent
  size across venues, and its printed date is legible at 68px, tight at 52px and
  meaningless at 40px. A bare "12" reads as a stamp *number*, not a date, next to
  empty slots that literally show numbers (`showEmptySlotNumbers`).
- **Recommended Redesign:** Pin the disc to two sizes only — 56px on the card
  page and 40px in tiles — via a fixed track (`repeat(var(--cols), 3.5rem)`)
  with `justify-content: space-between`, so a short card gets whitespace rather
  than balloon discs. At 40px drop the date entirely (the `aria-label` already
  carries it) and keep only the initials, so a day number never masquerades as a
  slot number.
- **Priority:** High

### 29. `RewardChip` is a square in a row of circles, breaking the stamp family rule
- **File(s):** `components/loyalty/stamp-grid.tsx:56-82`
- **Current UX/UI Problem:** The reward slot renders
  `aspect-square … rounded-md border-2 -rotate-6` with a `RewardSeal size="sm"`
  (a 20px circle, `size-5`) centred inside it — a rounded *square* containing a
  tiny circle, sitting in a row of 52px circles, plus a `mono-id` caption below
  it that the stamp dots do not have. The `size-5` seal inside a ~52px square
  means the meaningful mark occupies 15% of the slot's area.
- **Why It Is a Problem:** The row's terminal object is visually weaker than
  every stamp preceding it, so the goal reads as less important than the steps.
  The caption also makes the reward column taller than the stamp columns,
  pushing the row's baseline out of alignment.
- **Recommended Redesign:** Make the reward slot a full-bleed `RewardSeal`
  at the disc's own size (circle, `-rotate-6`, sun while sealed, leaf when
  ready) with a 2px dashed `border-line-strong` ring when locked — one shape
  family, one size, no caption (the `aria-label` already says "Mystery reward,
  sealed"). If a caption is required, reserve the same caption height on the
  stamp dots so baselines align.
- **Priority:** Medium

### 30. Reward ticket stub steals 27% of the measure and its terms get 213px
- **File(s):** `components/loyalty/reward-ticket.tsx:128-144,78-101`
- **Current UX/UI Problem:** The stub is `w-20` (80px, `sm:w-[88px]`) plus a 2px
  perforation, leaving the face **213px** at 375px (295 − 82) for
  eyebrow + `text-lg` reward name + a `text-sm leading-6` description carrying
  merchant reward terms. Terms of ~120 characters wrap to 5-6 lines at that
  measure → the ticket alone is 150-180px. The stub itself contains only a 48px
  seal and a `mono-id` word ("Sealed"/"Ready").
- **Why It Is a Problem:** 27% of the scarcest measure in the app is spent on a
  decorative stub that repeats state already carried by the ticket's border style
  and eyebrow (`KICKER[state]`), while the actual reward terms are squeezed into
  a newspaper column.
- **Recommended Redesign:** Reduce the stub to `w-14` (56px) with a 32px seal, or
  move the seal to a `-top-2 -right-2 absolute` corner mark and give the face the
  full width. Clamp the terms to `line-clamp-2` with a "Full terms" disclosure —
  the legal sheet infrastructure already exists (`components/customer/legal-sheet.tsx`).
  Recovered: **+56px of measure and ~60px of height**.
- **Priority:** High

### 31. `RewardTicket` and `StampGrid`'s reward chip show the same seal twice on one screen
- **File(s):** `components/customer/customer-flow-system.tsx:307-330`; `components/loyalty/stamp-grid.tsx:56-82`
- **Current UX/UI Problem:** `CustomerStampCard` passes `rewardSlot` to
  `StampGrid` (rendering a sealed `RewardSeal size="sm"` at the end of the row)
  **and** renders a `RewardTicket` immediately below (rendering a sealed
  `RewardSeal size="md"` in its stub) with the same `MYSTERY_REWARD_SEALED_LABEL`.
  On a full card the `RewardCelebration` adds a third (`size="lg"`,
  `reward-celebration.tsx:50`). The comment at lines 291-296 says "never two
  seals competing in one view", but the code passes both.
- **Why It Is a Problem:** Three sizes of the same "?" disc in one viewport
  dilutes the mystery-seal signal that the whole reward mechanic depends on, and
  costs ~60px.
- **Recommended Redesign:** On the card page pass `rewardSlot={undefined}` when a
  `RewardTicket` is rendered below (and vice versa on dense previews). Enforce it
  in `CustomerStampCard` — it already knows both — by deriving `rewardSlot` as
  `ticketVisible ? undefined : …` instead of accepting it as a free prop.
- **Priority:** Medium

### 32. `StatusBanner` is used for instructions, confirmations, warnings and errors alike
- **File(s):** `components/loyalty/status-banner.tsx:7-14`; `customer-card-experience.tsx:308-319,430-453`; `reward-panels.tsx:43-45,73,113-115`; `profile-gate-forms.tsx:50-58,78-80,146-149`
- **Current UX/UI Problem:** One component in five tones carries: an instruction
  ("Scan the venue code to add your stamp", neutral), a confirmation ("Stamp
  secured.", success), a wait notice ("Give it a day to breathe", **warning** —
  vermillion wash for good news), a form heading ("A few details before this
  one's yours", neutral), a legal statement ("Verified email", neutral) and real
  errors. On `/reward/[id]` a member sees up to three stacked banners.
- **Why It Is a Problem:** When everything is a banner, nothing is. The
  vermillion `warning` wash on "Give it a day to breathe" and on
  `JoinFirstStampRecoveryPanel`'s "Your first stamp is still waiting" signals
  failure for states that are not failures. Each banner also costs 60-90px
  (`px-4 py-3` + icon column + title + description).
- **Recommended Redesign:** Reserve `StatusBanner` for **outcomes** (success /
  error / blocked). Route instructions to `CustomerActionNote` (which already
  exists, `customer-flow-system.tsx:355-393`, and is quieter), route section
  headings to `SectionHeader`, and route the waiting state to the reward
  ticket's own `readyDate` chip (`reward-ticket.tsx:102-108`) rather than a
  second block. Re-tone the wait states from `warning` to `info` (cobalt) or
  `neutral`.
- **Priority:** High

### 33. `QrFrame` double-pads the QR and offers no counter-mode presentation
- **File(s):** `components/loyalty/qr-frame.tsx:15-24`; `components/customer/reward-collection-qr.tsx:89-112`; `components/customer/offer-pass-qr.tsx:78-101`
- **Current UX/UI Problem:** `QrFrame` is `border-2 p-4` wrapping an inner
  `rounded-md bg-white p-2` — 12px of doubled white padding on top of the QR
  image's own quiet zone. Inside a `CustomerReceipt` at 375px the chain is
  343 (column) − 48 (receipt) − 32 (`p-4`) − 16 (`p-2`) = **247px of actual QR**.
  There is no brightness boost, no full-screen/"show at counter" mode, and the QR
  sits *below* the reward ticket and a `StatusBanner` (`reward-panels.tsx:64-78`),
  so it is typically ~500px down the page.
- **Why It Is a Problem:** This is the transaction. A 247px code, at whatever
  screen brightness the member happens to have, requiring a scroll, in a pub with
  the phone at arm's length over a bar, is the highest-friction moment in the
  product. The doubled padding costs 48px of code size for no visual benefit.
- **Recommended Redesign:** Collapse to a single `p-3` white frame (+24px of
  code). Hoist the QR **above** the reward ticket on `/reward/[id]` and
  `/pass/[id]` — the ticket is context, the code is the job. Add a "Show at the
  counter" affordance that renders the QR full-bleed on paper with
  `screen.brightness` maximised where available (or at minimum a
  `max-w-none w-[85vw]` presentation mode), and keep the refresh control
  underneath.
- **Priority:** Critical

### 34. `RewardCelebration` uses the sheet radius and an unbounded confetti layer
- **File(s):** `components/loyalty/reward-celebration.tsx:38,10-16`
- **Current UX/UI Problem:** `rounded-2xl` = `calc(var(--radius) + 8px)` = 18px,
  which is `--radius-sheet` — the radius `DESIGN.md` reserves for bottom sheets
  and large panels. Every sibling surface on the card uses `rounded-lg` (10px).
  The confetti dots are absolutely positioned with fixed offsets (`left-7`,
  `right-10`, `top-8`) inside `px-5 py-6` — at 295px width, `right-1/3` and
  `left-1/3` dots land within 20px of the 96px `RewardSeal size="lg"`.
- **Why It Is a Problem:** The peak emotional beat of the product uses the wrong
  shape token, and the confetti visually collides with the seal it is supposed to
  frame on narrow phones.
- **Recommended Redesign:** `rounded-lg`. Move confetti offsets to percentages
  with a minimum radial distance from centre (e.g. `top-2 left-[12%]`,
  `top-3 right-[14%]`), and reduce `py-6` → `py-5`.
- **Priority:** Low

### 35. `ProgressTrack` and `RewardTeaser` are dead/duplicate progress vocabulary
- **File(s):** `components/loyalty/progress-track.tsx:5-31`; `components/loyalty/reward-teaser.tsx:13-34`
- **Current UX/UI Problem:** `ProgressTrack` renders an `eyebrow` + a leaf
  `MonoTag` "3 / 8" + a `Progress` bar — a *second* progress readout for a system
  whose entire design is that the stamp grid is the progress readout (the comment
  at `customer-flow-system.tsx:290-292` says exactly this). `RewardTeaser` is a
  documented `@deprecated` shim around `RewardTicket`. Neither is referenced from
  the customer surfaces read here, yet both are exported from
  `components/loyalty/index.ts`.
- **Why It Is a Problem:** Two exported components represent superseded ideas. A
  future contributor reaching for "show progress" will find the bar and
  reintroduce the duplicate readout the system deliberately removed.
- **Recommended Redesign:** Delete `RewardTeaser` and migrate any remaining call
  sites to `RewardTicket` with an explicit state. Either delete `ProgressTrack`
  or restrict it to merchant analytics surfaces and remove it from the loyalty
  barrel so it cannot reach a customer screen.
- **Priority:** Low

---

## E. Rewards, passes and the collection moment

### 36. `/home/rewards` stacks four permanently-expanded sections with full headers
- **File(s):** `app/home/(authed)/rewards/page.tsx:20-110`
- **Current UX/UI Problem:** Up to four `<section>`s (`Ready for scan`,
  `Coming soon`, `History · Redeemed`, `History · Expired`) at `grid gap-8`
  (32px), each opening with a `SectionHeader` (eyebrow 15 + `gap-2` 8 + `text-lg`
  h2 22 + optional description 24 ≈ **50-70px**) and then one `ReceiptCard` per
  reward. `RedeemableReward` ≈ 230px (tag row + `text-lg` name + description +
  expiry note + a full-width `size="lg"` button); `QuietReward` ≈ 120px. A
  realistic member (2 ready, 1 upcoming, 5 redeemed, 1 expired) gets
  2×230 + 70 + 120 + 70 + 5×120 + 70 + 120 + 70 + `PageTitle` 107 + 3×32 gaps ≈
  **1,850px**, of which ~720px is closed history that nobody scrolls to read.
  Two of the four headers say "History".
- **Why It Is a Problem:** Live rewards (the only actionable content) are
  outnumbered 3:1 by archive, and every archive item is charged at full card
  weight with a hard offset shadow.
- **Recommended Redesign:** Two zones. Zone 1 "Ready & coming" — keep the cards.
  Zone 2 "History" — one `<details>`/`Accordion` labelled "Past rewards (6)",
  closed by default, containing 44px single-line rows (`flex justify-between`,
  venue `MonoTag` + reward name truncated + `mono-id` date) instead of cards.
  Collapse the two "History" headers into one. Saving with the numbers above:
  **≈900px**, and the ready rewards land above the fold.
- **Priority:** High

### 37. `RedeemableReward` repeats the venue name three times in one card
- **File(s):** `components/customer/reward-list-cards.tsx:28-56`; `lib/customer/issued-reward-display.ts`
- **Current UX/UI Problem:** The header row renders `MonoTag {businessName}`,
  then `MonoTag {rewardSourceBadge(source, businessName)}` (which itself embeds
  the business name for merchant-sent rewards), then `MonoTag "Ready"` — three
  pills on `flex-wrap` at 295px, which wraps to two rows for any venue name over
  ~14 characters. The `MonoTag` content span truncates
  (`mono-tag.tsx:47`), so a long name becomes `THE OLD CROWN GI…` twice.
- **Why It Is a Problem:** A wrapped, truncated, thrice-repeated venue name is
  the first thing read on the member's most valuable object.
- **Recommended Redesign:** One venue `MonoTag` on the left, one state `MonoTag`
  on the right, and put the source ("Birthday treat") in the description line as
  plain sentence text. Give the row `flex-nowrap min-w-0` with the venue tag
  `flex-1 truncate` so it degrades predictably.
- **Priority:** Medium

### 38. Reward-ready screen shows the QR behind a scroll, under two other blocks
- **File(s):** `components/customer/reward-panels.tsx:53-87`
- **Current UX/UI Problem:** `RewardReadyPanel` renders inside a
  `CustomerReceipt`: `RewardTicket` (~150) → `StatusBanner "Ready for merchant
  scan."` (a title-only banner, ~54px, saying what the ticket's `KICKER` already
  says — `reward-ticket.tsx:15` prints "Your reward · ready") →
  `RewardCollectionLive` → `RewardCollectionQr` (247px QR + `p-4` frame + a
  `rounded-xl bg-secondary` caption ~40). Plus the flow shell's headline
  (reward name at 2.1rem) and support line above. QR top edge ≈ **y 520px** on an
  SE; QR bottom ≈ y 830px — the code cannot be fully framed by a scanner without
  scrolling.
- **Why It Is a Problem:** Same as finding 33 but specific: the redundant
  success banner and the duplicated reward name (shell headline + ticket
  heading) are what push the code off-screen.
- **Recommended Redesign:** Delete the title-only `StatusBanner` (zero new
  information). Order the receipt: **QR → ticket → terms**. Drop the shell
  headline on this route (`vm.headline` is the reward name, which the ticket
  prints at `text-lg` anyway) and use the eyebrow only.
- **Priority:** Critical

### 39. Two near-identical QR components drifted apart
- **File(s):** `components/customer/reward-collection-qr.tsx:57-118`; `components/customer/offer-pass-qr.tsx:66-121`
- **Current UX/UI Problem:** The pass QR (docblock: "Mirrors
  `reward-collection-qr.tsx`") returns the error state **early**, replacing the
  whole component; the reward QR renders the error state *inline* and keeps its
  caption. The pass QR has a persistent `Button size="lg" variant="secondary"`
  "Show a fresh code"; the reward QR has that button **only in the error state** —
  so a member whose reward code was just scanned/expired mid-queue has no way to
  force a refresh and must wait for the interval. Error copy differs
  ("Pull down to refresh" vs "Try again, or ask a team member"), and the reward
  version tells members to pull-to-refresh inside a non-refreshable page.
- **Why It Is a Problem:** The two most important screens in the product behave
  differently in the same failure, and one of them gives an instruction that does
  nothing.
- **Recommended Redesign:** Extract one `ScanCodePanel` taking
  `{ src, alt, label, signInHref, caption }`. Always render the "Show a fresh
  code" control (both codes are single-use with a TTL), use one error copy, and
  drop "Pull down to refresh".
- **Priority:** High

### 40. QR caption blocks use `rounded-xl` — a radius that exists nowhere in the contract
- **File(s):** `components/customer/reward-collection-qr.tsx:114`; `components/customer/offer-pass-qr.tsx:102`; `components/customer/customer-login-form.tsx:96`; `components/customer/push-notification-settings.tsx:238`; `components/customer/push-notification-settings-disclosure.tsx:49`
- **Current UX/UI Problem:** Five customer surfaces use `rounded-xl`
  (`calc(--radius + 4px)` = 14px). `DESIGN.md` sanctions exactly two radii —
  10px (`--radius`) and 18px (`--radius-sheet`) — plus `rounded-full` for the
  stamp family. The login success box compounds it with `border border-reward/30`:
  a **1px** border in a system where "borders are 2px solid ink everywhere", in a
  colour (reward at 30%) that appears nowhere else.
- **Why It Is a Problem:** A 14px radius next to 10px siblings is visible at
  arm's length and reads as a different component library; the 1px reward-tinted
  border reads as a disabled or ghosted element rather than a confirmation.
- **Recommended Redesign:** Global replace `rounded-xl` → `rounded-lg` in the
  customer surfaces. Convert the login success box to
  `StatusBanner tone="success"` — the shared face already exists and is used two
  lines above for the error case (`customer-login-form.tsx:90`).
- **Priority:** Medium

### 41. `/pass/[entitlementId]` prints the discount and venue three times before the code
- **File(s):** `app/pass/[entitlementId]/page.tsx:56-82`; `components/loyalty/offer-pass.tsx:143-165`
- **Current UX/UI Problem:** The flow shell's `title` is
  `` `${pass.discountPercent}% off at ${pass.venueName}` `` at `text-[2.1rem]`
  (2 lines ≈ 70px), plus a `description`; then `OfferPass` prints the same fact
  as a `text-5xl` (48px) numeral with "off the whole bill at {venueName}" beside
  it, plus a date chip, plus a `passLead` sentence repeating the window, plus a
  bulleted terms list. Only after all of that (~430px) does `PassBody` render the
  QR.
- **Why It Is a Problem:** Three renderings of one number push the scannable
  code — the only reason the page exists — well below the fold, on a screen used
  while standing at a till.
- **Recommended Redesign:** Remove the flow-shell `title` on this route (pass
  `eyebrow` only, since `OfferPass` owns the h2 lockup), move `<PassBody>` to sit
  **directly under** the `text-5xl` lockup and date chip, and collapse
  `passLead` + the `<ul>` terms into a `<details>` "Terms" row. Saving:
  **≈250px**, putting the code in the top half of the screen.
- **Priority:** High

### 42. `OfferPass` terms list is the only bulleted list in the customer journey
- **File(s):** `components/loyalty/offer-pass.tsx:171-182`
- **Current UX/UI Problem:** `<ul className="grid list-disc gap-1.5 pl-4 text-xs leading-5 text-muted-foreground">`
  — browser disc bullets at 12px. Nothing else in the member journey uses
  `list-disc`; every other enumeration uses numbered `IconRoundel` discs
  (`home-empty-state.tsx:34-41`, `join-welcome-step.tsx:117-129`) or plain rows.
- **Why It Is a Problem:** Default browser bullets are the one un-designed
  element on an otherwise fully-inked surface, and 12px grey terms on a card the
  member is asked to show to staff is below the practical reading size across a
  counter.
- **Recommended Redesign:** Replace with `.w-rule`-separated rows at
  `text-xs leading-5` with a 4px ink square marker, or a `grid gap-1` of
  `mono-id` label + sentence. Raise to `text-sm` for the no-stacking rule, which
  is the one staff enforce.
- **Priority:** Low

---

## F. Activity and Profile

### 43. `/home/activity` renders 40 unbounded ~110px rows with no grouping or paging
- **File(s):** `app/home/(authed)/activity/page.tsx:42-72`; `lib/customer/activity.ts:26`
- **Current UX/UI Problem:** `getCustomerActivity()` defaults to
  `DEFAULT_LIMIT = 40`. Each `ActivityRow` is
  `surface-card grid gap-2 p-4` → 32 padding + tag row 26 + `gap-2` 8 + title 20
  + 8 + 2-line description 48 ≈ **142px**, plus `gap-3` between. 40 rows ≈
  **5,800px** of scrolling with no date separators, no filters, no venue grouping
  and no pagination. Timestamps are `.mono-id` (10px).
- **Why It Is a Problem:** A five-screen wall of visually identical cards with no
  landmarks. Finding "when did I last visit the Old Crown" requires reading every
  row. 10px relative timestamps are the smallest type in the app on the one
  screen that is entirely about time.
- **Recommended Redesign:** (a) Group by day with sticky `.eyebrow` date
  headers. (b) Compress the row: two lines (`title` + `mono-meta` venue · time)
  in a `flex` with a 24px category icon roundel on the left, `py-3`, separated by
  `.w-rule` hairlines instead of individual shadowed cards → **≈56px per row**,
  a 60% height cut. (c) Raise timestamps to `.mono-meta` (11.5px). (d) Add
  `FilterPills` (the primitive exists at `components/brand/filter-pills.tsx`) for
  Stamps / Rewards / Joins, and cap the initial render at 15 with a "Show more"
  button.
- **Priority:** High

### 44. Activity rows are duplicated between the snippet and the page
- **File(s):** `components/customer/home-activity-snippet.tsx:30-48`; `app/home/(authed)/activity/page.tsx:52-72`
- **Current UX/UI Problem:** The `<li>` markup, the `toneByCategory` map (both
  files declare it independently, lines 10-17 in each) and the `formatRelativeTime`
  usage are copy-pasted.
- **Why It Is a Problem:** Guaranteed drift: any density fix (finding 43) will be
  applied to one and not the other, and the two surfaces will diverge visibly.
- **Recommended Redesign:** Extract `<ActivityRow item density="compact|full" />`
  into `components/customer/activity-row.tsx` with the tone map beside it, and
  import it in both places.
- **Priority:** Medium

### 45. Profile is three near-identical `surface-card p-5` sections, ~150px of which is heading chrome
- **File(s):** `app/home/(authed)/profile/page.tsx:28-61`; `profile-about-you.tsx:83-84`; `profile-marketing-consent.tsx:64-65`; `push-notification-settings-disclosure.tsx:21-33`
- **Current UX/UI Problem:** Three consecutive `section.surface-card.p-5` blocks,
  each opening with a `SectionHeader` (eyebrow + `text-lg` h2 ≈ 50px) —
  "About you / Your contact details", "Marketing / Updates from your venues",
  "Push / Browser notifications". Total page ≈ 107 (`PageTitle`) + 334 + 340 + 90
  + gaps 96 + `pt-6` 24 + `pb-32` 128 ≈ **1,120px** for what is functionally a
  settings list with 4 read-only values and 6 toggles. Only the push section is a
  disclosure; the other two are always expanded.
- **Why It Is a Problem:** Repetitive section cards with duplicated heading
  patterns, ~150px of pure chrome, and inconsistent progressive disclosure (one
  of three collapses, for no user-visible reason).
- **Recommended Redesign:** Convert all three to one `Accordion` on a single
  `surface-card`, with "Your contact details" open by default and Marketing /
  Push closed. Replace the three `SectionHeader`s (eyebrow + h2) with single
  `text-base font-extrabold` summary rows carrying a state hint on the right
  ("3 verified" / "Email on" / "Push off"). Estimated height: **~420px** — a
  60% cut — with every setting still one tap away.
- **Priority:** High

### 46. Consent and push toggles are bare native checkboxes at `size-5`
- **File(s):** `components/customer/profile-marketing-consent.tsx:143-155`; `components/customer/push-notification-settings.tsx:292-302`; `components/customer/join-forms.tsx:170-214`
- **Current UX/UI Problem:** `<input type="checkbox" className="size-5 shrink-0
  accent-primary">` inside a `-m-3 … min-h-11 min-w-11 p-3` label. The hit area
  is correct, but the control is the **browser default** checkbox tinted with
  `accent-primary` — no 2px ink border, no hard offset shadow, no press collapse,
  no dashed empty state. Every other control in the system is fully inked. The
  `shadcn` `Switch`/`Checkbox` primitives (which the globals.css Wet Ink layer is
  built to theme) are not used.
- **Why It Is a Problem:** The only un-branded interactive controls in the
  journey sit on the consent screen — the exact place where trust and
  deliberateness matter most (GDPR consent must be an unambiguous affirmative
  act, and a system-default control undercuts the perceived care). It also means
  the toggle looks different on iOS, Android and desktop.
- **Recommended Redesign:** Use `components/ui/switch` for the two preference
  lists (a switch is the right affordance for auto-saving settings) and
  `components/ui/checkbox` for the join consent gate, and add the corresponding
  `[data-slot="switch"]` / `[data-slot="checkbox"]` rules to the Wet Ink layer
  (2px ink border, `--radius-sm`, hard 2px offset, vermillion fill).
- **Priority:** High

### 47. Marketing toggles auto-submit with no visible pending state on the control
- **File(s):** `components/customer/profile-marketing-consent.tsx:121-155`
- **Current UX/UI Problem:** `onChange` calls `form.requestSubmit()` and the
  checkbox is `disabled={pending}` with `disabled:opacity-60`. The confirmation
  arrives in a `role="status"` paragraph **above** the control, inside the text
  column. On a slow connection the member sees a checkbox fade to 60% with no
  spinner and a message rendering in a different visual block.
- **Why It Is a Problem:** Save-on-change without inline feedback at the point of
  interaction is the classic "did that save?" pattern; the message appearing in
  the description column reads as body copy rather than a response.
- **Recommended Redesign:** Put the state beside the control: a
  `mono-id` "SAVING…" → "SAVED" chip at the switch's trailing edge, or use the
  `Switch` with a `data-pending` treatment. Keep the `aria-live` region for
  screen readers but make the visual confirmation local.
- **Priority:** Medium

### 48. Push settings' skeleton bears no relation to its content
- **File(s):** `components/customer/push-notification-settings-disclosure.tsx:46-58`
- **Current UX/UI Problem:** `PushSettingsFallback` renders `h-16` status box,
  `h-9 w-32` button and three `h-10 rounded-lg bg-muted` bars. The real content
  (`push-notification-settings.tsx:238-305`) is an `h-[76px]` status box, a
  `size="sm"` button (36/44px) and three two-line rows (~55px each) with
  right-aligned toggles. The skeleton's rows are `bg-muted` with **no border**,
  unlike every other skeleton in the app which uses the themed
  `[data-slot="skeleton"]` fill.
- **Why It Is a Problem:** The disclosure visibly jumps ~50px when the chunk
  lands, and the fallback uses a different grey than every other loading state.
- **Recommended Redesign:** Use `<Skeleton>` (the themed primitive) with the real
  dimensions: `h-[76px] rounded-lg`, `h-11 w-32 rounded-lg`, three `h-14`.
- **Priority:** Low

### 49. Profile disclosure trigger uses `IconRoundel` as a +/− toggle with no state semantics
- **File(s):** `components/customer/push-notification-settings-disclosure.tsx:25-33`
- **Current UX/UI Problem:** The `<summary>` has `list-none` and a hand-rolled
  `IconRoundel size="sm" className="bg-transparent font-mono text-sm font-black"`
  printing a literal `"-"` / `"+"` character. There is no `.focus-ring` on the
  summary (unlike `CardDetailsDisclosure`, which does add it —
  `customer-card-experience.tsx:515`), no `aria-expanded` beyond the native
  `details` semantics, and the +/− glyphs are text characters rather than the
  `Icon` wrapper the design system mandates for all functional glyphs.
- **Why It Is a Problem:** Keyboard users get no visible focus on a primary
  disclosure; and a hyphen rendered as a "minus" is optically off-centre and
  visually inconsistent with the `ArrowDown01Icon` chevron used for the other
  disclosure in the same journey.
- **Recommended Redesign:** Add `focus-ring rounded-lg` to the summary, and swap
  the +/− for the same `Icon icon={ArrowDown01Icon}` with
  `group-open:rotate-180` used by `CardDetailsDisclosure` — one disclosure
  vocabulary for the journey.
- **Priority:** Medium

---

## G. Join wizard and login

### 50. The join wizard's step 3 is the tallest form in the app and buries its CTA
- **File(s):** `components/customer/join-wizard.tsx:143-173,219-264`; `components/customer/join-forms.tsx:160-244`
- **Current UX/UI Problem:** `TermsStep` (dense shell) stacks: header 36 +
  `gap-4` + headline `text-[1.65rem]` ~35 + description 2 lines 48 + `gap-4` +
  `TermsFirstStampPreview` [`surface-card p-3` 24 + venue row 40 + `gap-3` +
  compact `StampGrid` (8 stamps + reward at 271px inner, 6 cols → 2 rows ≈ 92) +
  `gap-3` + `RewardTicket` ~120 ≈ **300px**] + `gap-4` + the consent `fieldset`
  [`p-4` 32 + loyalty row ~90 + `.w-rule` 30 + marketing row ~66 ≈ **218px**] +
  `gap-4` + completion hint 2 lines 40 + `gap-4` + `Button size="lg"` 48.
  Total ≈ **830px**; the "Get my first stamp" button sits at ≈ y 780px. With the
  keyboard closed on an SE (667px) it is two-thirds of a screen below the fold.
- **Why It Is a Problem:** The final conversion step — the one the whole funnel
  exists for — requires a scroll past a decorative preview to reach its button.
  The preview also duplicates the welcome step's `StampJoinPreview` content the
  member saw two screens earlier.
- **Recommended Redesign:** Remove `TermsFirstStampPreview`'s `RewardTicket`
  (keep the stamp row only, ~120px saved) or replace the whole preview with a
  single-line `mono-meta` reminder ("STAMP 1 OF 8 · MYSTERY REWARD"). Merge the
  completion hint into the button's own supporting line. Target: CTA at
  **y < 560px**, in-viewport with the keyboard down.
- **Priority:** Critical

### 51. The 3-step progress bar lies on the no-QR path
- **File(s):** `components/customer/join-wizard.tsx:396-415`; `components/customer/customer-flow-system.tsx:117-143`
- **Current UX/UI Problem:** `joinProgress` maps `join_phone` to step
  `hasQr ? 2 : 1`, `join_otp` to **2**, `join_terms` to **3**, always out of
  `ONBOARDING_STEPS = 3`. On the no-QR path the member sees: phone = "Step 1 of
  3", code = "Step 2 of 3", terms = "Step 3 of 3" — fine. On the QR path they see
  welcome = 1, phone = 2, **code = 2** (the bar does not advance), terms = 3.
  Submitting the phone form and landing on the code screen leaves the progress
  bar visually unchanged.
- **Why It Is a Problem:** A progress indicator that does not move after a
  successful submit is read as "my submission failed", at the exact step (SMS
  code entry) with the highest abandonment risk.
- **Recommended Redesign:** Either use 4 steps on the QR path (welcome · phone ·
  code · terms) and 3 on the direct path, or keep 3 steps and show sub-progress
  in the label the component already supports (`"Verify number · Code"` is
  already passed — surface it as a filled half-segment). At minimum make the
  bar's second segment 50%-filled on `join_phone` and 100% on `join_otp`.
- **Priority:** High

### 52. The consent fieldset's checkbox rows have unequal hit areas and no error affordance on the row
- **File(s):** `components/customer/join-forms.tsx:168-222`
- **Current UX/UI Problem:** `<label className="flex items-start gap-3">` with a
  `size-5 mt-0.5` checkbox. The label is the hit target, but it wraps
  `CustomerLegalConsentLinks`, which contains three `<button>` sheet triggers
  ("venue terms", "Nabaperks customer terms", "privacy notice") that call
  `stopPropagation` (`legal-sheet.tsx:107-109`). So roughly 40% of the loyalty
  consent row's surface is *not* a toggle. On error, `loyaltyTermsError` renders
  a `<p>` **outside** the fieldset (line 216-222) and the checkbox gets
  `aria-invalid` but **no visual change** — `accent-primary` on a native checkbox
  cannot express invalid.
- **Why It Is a Problem:** The member taps the row to accept, hits a legal link,
  a sheet opens, and the checkbox stays unchecked — a well-known consent-flow
  failure. And when they submit, the error is visually disconnected from the
  control.
- **Recommended Redesign:** Separate the two: put the checkbox + a short label
  ("I accept the loyalty terms") in the tappable row, and move the three legal
  links to a line **below** it at `text-xs`. Use `components/ui/checkbox` so
  `aria-invalid` can drive a `border-destructive` ring, and render the error
  inside the fieldset immediately under the row.
- **Priority:** Critical

### 53. The OTP field is a single free-text input, not a code field
- **File(s):** `components/customer/join-otp-form.tsx:84-101`; `components/customer/customer-login-form.tsx:117-127`; `components/customer/profile-gate-forms.tsx:157-171`
- **Current UX/UI Problem:** Three separate places render
  `<input inputMode="numeric" autoComplete="one-time-code" className={`${customerInputClass} font-mono`}>`
  — a plain 48px full-width text box. The join version strips non-digits on
  `onInput`; the login version does not (it only sets `maxLength`); the profile
  version does neither beyond `maxLength`. None uses `components/ui/input-otp`
  (the shadcn OTP primitive) and none shows the expected code length visually.
- **Why It Is a Problem:** A wide empty box gives no affordance for "6 digits",
  no per-character feedback, and no auto-submit on completion — the member must
  find and press a separate 48px "Check code" button while holding a phone that
  just buzzed. Three divergent implementations of one field guarantee three
  different behaviours.
- **Recommended Redesign:** One `<OtpField>` component wrapping `InputOTP` with
  `maxLength={otpFieldMaxLength()}`, 6 slotted 44×52px ink-bordered cells, and
  auto-submit on the final digit. Theme the slots in the Wet Ink layer
  (`[data-slot="input-otp-slot"]`). Use it in all three call sites.
- **Priority:** High

### 54. Login page's two forms stack into one long column with two competing submits
- **File(s):** `components/customer/customer-login-form.tsx:44-144`
- **Current UX/UI Problem:** After a code is requested, the page shows: phone
  field + hint + a `role="status"` message box + a `Button` reading
  **"Resend code"**, then the OTP field + a second `Button` "Open my cards".
  Both are `variant="default"` (vermillion, `h-11`), stacked 100px apart. The
  member's next action ("enter the code") is below a button that would restart
  the flow.
- **Why It Is a Problem:** Two primary vermillion buttons on one screen, with the
  *destructive-to-progress* one first in reading order. On a phone with the
  keyboard up (~300px of viewport), "Resend code" is often the only visible
  button.
- **Recommended Redesign:** Once `otpSent`, collapse the phone form to a
  read-only summary row (`Phone ending 3456` + a `variant="link" size="sm"`
  "Change") — exactly the pattern `join-otp-form.tsx:137-171` already uses — and
  demote "Resend code" to `variant="link" size="sm"`. Only "Open my cards" keeps
  the vermillion slot.
- **Priority:** High

### 55. Login and join phone steps set different expectations for the same SMS
- **File(s):** `components/customer/customer-login-form.tsx:83`; `components/customer/join-forms.tsx:84`; `lib/customer/experience/copy.ts:54-63`
- **Current UX/UI Problem:** Login shows `JOIN_PHONE_CODE_HINT` = "We'll send a
  one-time code by text." Join shows `JOIN_PHONE_RETENTION_HINT` = "Use a UK
  number that can receive texts. Your card and progress stay linked to this
  number." (2 lines vs 1). Login's field has no `autoFocus`; join's does. Login's
  contact error uses `role="alert"`; join's does not (`join-forms.tsx:76`).
- **Why It Is a Problem:** Same field, same job, three behavioural differences —
  including an accessibility one, where the join flow's inline error is silent
  for screen readers while login's announces.
- **Recommended Redesign:** One `<PhoneField>` component with `autoFocus`,
  `role="alert"` inline errors and a single hint string, consumed by both.
- **Priority:** Medium

### 56. Welcome step's numbered step markers are a fourth circle dialect
- **File(s):** `components/customer/join-welcome-step.tsx:119-128`
- **Current UX/UI Problem:** `<span className="mt-0.5 grid size-5 shrink-0
  -rotate-6 place-items-center rounded-full border-2 border-ink bg-primary
  text-[0.7rem] leading-none font-extrabold text-primary-foreground">` — a 20px
  rotated vermillion disc with 11.2px text. `DESIGN.md` explicitly names
  `IconRoundel` as the sanctioned framing circle ("new framing circles reach for
  `IconRoundel` rather than hand-rolling `rounded-full`"), and `IconRoundel
  size="sm"` is 32px, **unrotated**. `HomeEmptyState` uses `IconRoundel` for the
  identical pattern (`home-empty-state.tsx:35-41`).
- **Why It Is a Problem:** Two how-it-works lists in one journey render their
  step numbers at 20px-rotated and 32px-static respectively; `text-[0.7rem]` is a
  fifth unsanctioned micro size; and rotation is reserved for the *reward/stamp*
  family, so a step number wearing a stamp tilt implies it is earnable.
- **Recommended Redesign:** Use `IconRoundel size="sm" tone="primary"` with
  `font-mono text-xs font-extrabold`, exactly as `HomeEmptyState` does.
- **Priority:** Medium

### 57. `UnlockingReminder` truncates the venue · card compound to two clamped lines
- **File(s):** `components/customer/join-wizard.tsx:198-217`
- **Current UX/UI Problem:** `<span className="line-clamp-2 text-sm leading-tight
  font-extrabold break-words">{merchant.name} · {card.name}</span>` inside a
  `flex` row whose fixed siblings are a 40px `VenueMark` and a 20px `RewardSeal`,
  plus `gap-3` ×2 → the text column is 271 − 40 − 20 − 24 = **187px**. At
  `text-sm` that is ~26 characters per line; "The Old Crown Girton · Coffee
  Loyalty Card" clamps mid-phrase.
- **Why It Is a Problem:** The member's motivation strip — the *why* at the
  highest-friction step — becomes "The Old Crown Girton · Coffee Loyalt…".
- **Recommended Redesign:** Split onto two rows: venue name as `Eyebrow`
  (truncating), card name as the `text-sm font-extrabold` line. Or drop the
  `RewardSeal` (the seal appears on the previous and next screens) to recover
  32px of measure.
- **Priority:** Medium

---

## H. Scan (`/scan`)

### 58. No torch, no manual entry, no aiming reticle — the pub-lighting case is unhandled
- **File(s):** `components/customer/customer-qr-scanner.tsx:28-33,201-230`
- **Current UX/UI Problem:** `SCAN_CONFIG` is `{ fps: 10, qrbox: {width:250,
  height:250}, aspectRatio: 1, disableFlip: false }`. There is no torch toggle
  (html5-qrcode exposes `getRunningTrackCapabilities().torch`), no zoom, no
  "enter the code manually" fallback, and the viewfinder is a plain
  `aspect-square … border-2 border-dashed border-border` box with **no corner
  reticle** — nothing tells the member where to aim. The only failure branch is
  `camera-error` (permission/hardware); a QR that simply will not decode in low
  light produces the unchanging line "Scanning for a Nabaperks QR…" forever.
- **Why It Is a Problem:** This is the entry point to the entire product, used in
  dim pubs, at arm's length, one-handed. No torch is the single most requested
  scanner affordance; no timeout means the member has no idea whether to keep
  trying.
- **Recommended Redesign:** Add (a) a torch `Button size="icon-lg"` overlaid
  bottom-right of the viewfinder when the capability exists; (b) four 24px ink
  corner marks inset 12px in the viewfinder so aiming is obvious; (c) a 12-second
  no-decode timeout that swaps the status line for "Struggling? Try more light,
  or ask the team for the code" plus a manual-code path; (d) haptic
  (`navigator.vibrate(24)`) on successful decode — `StampPressButton` already
  establishes the pattern.
- **Priority:** Critical

### 59. `qrbox` is a fixed 250px inside a viewfinder that is 247-314px wide
- **File(s):** `components/customer/customer-qr-scanner.tsx:31`
- **Current UX/UI Problem:** The viewfinder's width is the receipt inner
  measure: **247px at 320px viewport**, 295px at 375, 314px at 430. The scan box
  is hard-coded to 250×250 — larger than the viewfinder on a 320px phone, and 20%
  smaller than it on a Pro Max.
- **Why It Is a Problem:** On small phones the scan region exceeds the visible
  video, so the member aims at a region they cannot see; on large phones a fifth
  of the visible frame is dead. Either way the visible box and the decode box do
  not agree.
- **Recommended Redesign:** Pass a function
  `qrbox: (w, h) => { const s = Math.floor(Math.min(w, h) * 0.75); return { width: s, height: s } }`
  and draw the reticle at the same 75% so the visible frame *is* the decode
  region.
- **Priority:** High

### 60. The scanner's primary exit sends authed members out of the app
- **File(s):** `components/customer/customer-qr-scanner.tsx:232-239`; `app/scan/page.tsx:20-26`
- **Current UX/UI Problem:** The exits are `grid gap-3 sm:grid-cols-2` with
  `<Link href="/start">Back to start</Link>` and `<Link href="/home">Open my
  cards</Link>`. When a session exists, `ScanPage` wraps the scanner in
  `CustomerAppShell` (with the tab bar), so a signed-in member gets **two**
  navigation systems plus a link to the marketing switchboard `/start` they have
  no reason to visit. The `sm:grid-cols-2` never fires on a phone, so both are
  full-width 44px buttons stacked below an aspect-square viewfinder, adding ~100px.
- **Why It Is a Problem:** Redundant navigation duplicating the tab bar, one exit
  pointing outside the member journey, and ~100px of chrome under a viewfinder
  that already sits low.
- **Recommended Redesign:** When `session` is truthy, render **no** exit buttons
  (the tab bar is the navigation) and keep only the retry button in the
  camera-error state. When unauthenticated, keep a single "Open my cards" and
  drop "Back to start".
- **Priority:** High

### 61. The invalid-QR state is a silent text swap that keeps scanning
- **File(s):** `components/customer/customer-qr-scanner.tsx:107-113,159-168`
- **Current UX/UI Problem:** A non-Nabaperks QR sets `status: "invalid"` and
  changes the `aria-live` line to a 3-line sentence; `hasDecodedRef` stays false
  so the camera keeps decoding and can flip the status back and forth. There is
  no colour change, no border flash on the viewfinder, no haptic.
- **Why It Is a Problem:** In a busy venue the member will not notice a small
  text change under the video; they will keep holding the phone at a code that
  will never work.
- **Recommended Redesign:** On `invalid`, flash the viewfinder border to
  `border-destructive` for 600ms, fire `navigator.vibrate([12, 60, 12])`, and
  render the guidance as a `StatusBanner tone="warning"` under the frame (the
  banner is already imported across the customer surfaces). Debounce so repeated
  decodes of the same wrong code do not re-flash.
- **Priority:** Medium

### 62. Loader and loaded scanner duplicate ~40 lines of chrome that can drift
- **File(s):** `components/customer/customer-qr-scanner-loader.tsx:20-65`; `components/customer/customer-qr-scanner.tsx:180-241`
- **Current UX/UI Problem:** The two files repeat the `IconRoundel` + `Eyebrow` +
  `h1` + description block and the two exit buttons verbatim — and have **already
  drifted**: the loader's "Open my cards" is `variant="default"` (vermillion)
  while the loaded scanner's is `variant={undefined}`→default with "Back to
  start" as `secondary`, and in the loaded retry state the variants swap again.
  So the vermillion slot moves between three different buttons across the
  loading→loaded→error sequence.
- **Why It Is a Problem:** The primary-action colour visibly jumps between
  buttons as the chunk loads — a flicker of hierarchy at first paint.
- **Recommended Redesign:** Extract `<ScannerChrome>{children}</ScannerChrome>`
  holding the header and the exits, and have both the loader and the scanner
  render it, so the vermillion slot is decided in one place.
- **Priority:** Medium

---

## I. Offer claim (`/offer/[token]`)

### 63. `OfferShell` is a fourth customer column with its own padding and no tab bar
- **File(s):** `app/offer/[token]/page.tsx:227-253`
- **Current UX/UI Problem:** `<main className="min-h-svh bg-background px-4 py-10">`
  with `mx-auto grid w-full max-w-customer gap-6` — `py-10` (40px) where every
  other customer surface uses `pt-5`/`pt-6`, `gap-6` where the flow shell uses
  `gap-5`, `min-h-svh` where the flow shell uses `min-h-[100dvh]`, a bare `Logo`
  instead of the ✱ + wordmark header lockup used by `CustomerFlowShell`, and no
  safe-area bottom padding at all.
- **Why It Is a Problem:** The poster-scan landing is many members' *first ever*
  Nabaperks screen and it does not look like the rest of the product; the missing
  `env(safe-area-inset-bottom)` means the claim button can sit under the iOS home
  indicator.
- **Recommended Redesign:** Render it through `CustomerFlowShell` (passing
  `eyebrow`/`title` for the recovery states) so the header lockup, column,
  rhythm and safe area are inherited. Delete `OfferShell`.
- **Priority:** High

### 64. Offer landing states the same benefit up to four times before the CTA
- **File(s):** `components/customer/offer-claim-landing.tsx:89-149,223-251`
- **Current UX/UI Problem:** For a "2 stamps + 20% off" campaign the member
  reads, in order: venue `MonoTag`; `Eyebrow` campaign name; `h1`
  "2 bonus stamps and 20% off to start with"; merchant description; a `<ul>` of
  `benefitLines` restating "2 bonus stamps added to your card the moment you
  join" and "A 20% discount pass you can use as often as you like"; a
  `CardProgress` block with a `MonoTag` "2 welcome stamps" + stamp grid + "6 more
  visits and you reach X"; then a full `OfferPass` face restating "20% off the
  whole bill at {venue}" at `text-5xl` with its own terms list. Measured ≈
  **760px** before `claimAction`.
- **Why It Is a Problem:** The claim button — the entire purpose of the poster —
  is ~2 screens down on an SE, after four restatements of one promise. Poster
  scans are impulsive; every 100px of scroll costs conversions.
- **Recommended Redesign:** Promise once (h1) → prove once (the stamp row **or**
  the pass face, whichever is the headline benefit) → claim. Move
  `benefitLines`, the second benefit's face and the terms into a "What you get"
  disclosure below the button. Hoist `claimAction` to sit directly under the
  headline block with a sticky variant (`sticky bottom-4`) so it is always
  reachable. Target: CTA at **y < 400px**.
- **Priority:** Critical

### 65. Offer recovery states are a bare paragraph and an underlined text link
- **File(s):** `app/offer/[token]/page.tsx:124-132,146-160`
- **Current UX/UI Problem:** The rate-limited state renders only a `text-sm`
  paragraph inside `OfferShell` — no icon, no `StatusBanner`, and **no action at
  all**. The expired/paused/not-started states add `<p className="text-sm"><Link
  className="underline">Go to Nabaperks</Link></p>` — a plain inline link where
  every comparable dead-end in the journey uses `UnavailableRecoveryActions`
  (two `size="lg"` buttons, `components/customer/unavailable-recovery.tsx`).
- **Why It Is a Problem:** A member who scanned a poster and hit an expired
  campaign is given a 14px underlined link as their only exit, in a product whose
  stated rule is "never a dead end" (the comment at `join-wizard.tsx:430`).
- **Recommended Redesign:** Wrap the message in `StatusBanner` with the right
  tone (`info` for not-started, `neutral` for expired, `warning` for rate-limit)
  and render `<UnavailableRecoveryActions />` beneath it in every non-claimable
  branch, including the rate-limit branch.
- **Priority:** High

### 66. `CardProgress` on the offer landing hard-codes a 5-column stamp grid
- **File(s):** `components/customer/offer-claim-landing.tsx:179-187`
- **Current UX/UI Problem:** `<StampGrid layout="wrap" wrapColumns={5} compact
  rewardSlot="locked" …>` regardless of `stampsRequired`. For a 6-stamp card
  (6 + reward = 7 slots) that is 5 + 2 — a row with three empty columns; for a
  10-stamp card, 5 + 5 + 1 — a stranded reward chip. The offer landing renders
  inside `ReceiptCard` at `padding="md"` with no additional padding, so at 375px
  the tracks are (295 − 24)/5 = 54px — larger than the "compact" 36px intent.
- **Why It Is a Problem:** The first impression of the card mechanic is a ragged
  grid, and "compact" discs render larger here than on the member's real card
  tile (40px), so the preview does not match what they will get.
- **Recommended Redesign:** Apply the same `total → columns` table proposed in
  finding 27, and drop `compact` (or fix the track to `2.25rem` rather than
  `1fr`) so the preview matches the real card.
- **Priority:** Medium

---

## J. Loading, error and PWA states

### 67. One home skeleton stands in for four structurally different tabs
- **File(s):** `app/home/(authed)/loading.tsx:1-8`; `components/customer/loading-skeletons.tsx:260-280`
- **Current UX/UI Problem:** The file's own comment says it "covers the
  dashboard, activity, rewards, and profile tabs". `CustomerHomeSkeleton` renders
  a page title plus **two card-tile receipts with stamp rows**. Navigating to
  Profile shows two fake loyalty cards, then swaps to three settings sections;
  Activity shows two fake cards, then a 40-row feed.
- **Why It Is a Problem:** The skeleton actively lies about what is arriving,
  which is worse than a neutral shimmer — it produces a large, jarring
  re-layout on every tab switch and undermines the perceived speed the skeleton
  is meant to create.
- **Recommended Redesign:** Add `loading.tsx` to each tab segment with a matching
  skeleton (`CustomerActivitySkeleton`: title + 6 compact rows;
  `CustomerRewardsSkeleton`: title + 2 reward cards + a history summary row;
  `CustomerProfileSkeleton`: title + 3 collapsed section rows). All three are
  ~15 lines each in the existing file.
- **Priority:** High

### 68. Error boundaries centre content in a 60dvh box and lose the page's identity
- **File(s):** `app/home/(authed)/error.tsx:13-21`; `app/card/[membershipId]/error.tsx:14-21`; `app/scan/error.tsx`; `app/home/login/error.tsx`
- **Current UX/UI Problem:** `grid min-h-[60dvh] content-center py-8` (home) and
  `CustomerShell className="grid content-center"` (card/scan/login) both centre a
  `CustomerErrorState`, which renders a 56px `VenueMark` captioned **"Nabaperks"**
  — not the venue whose card failed — plus a `StatusBanner tone="error"` and up
  to two `size="lg"` buttons. Four boundaries, three different container
  strategies, and a generic brand mark where the member expects their venue.
- **Why It Is a Problem:** A card failure shows a Nabaperks-branded roundel and
  "Card unavailable", giving no clue which of their venues broke. Vertical
  centring in a 60dvh box also means the retry button lands at a different height
  on every route.
- **Recommended Redesign:** One `CustomerErrorShell` with consistent top-aligned
  layout (`pt-10`, not centred — errors should be readable without hunting), and
  pass the venue name/initials through to `VenueMark` where the route knows it
  (the card route has `membershipId` and could render initials from a cached
  name, or omit the mark entirely rather than showing the wrong one).
- **Priority:** Medium

### 69. PWA install prompt overlaps the primary action area on customer routes
- **File(s):** `components/pwa/app-pwa.tsx:277-323,79-89`
- **Current UX/UI Problem:** The prompt is `fixed right-3 left-3 z-50` at
  `bottom-[calc(env(safe-area-inset-bottom)+4.5rem)]` on tab-bar routes — a
  ~130px card (icon + title + 2-line description + two `size="sm"` buttons; ~190px
  with the iOS two-step strip) floating over the bottom third of the viewport.
  `hasCustomerTabBar` deliberately excludes `/scan`, so on the scanner it drops to
  `bottom-[max(0.75rem, safe)]` — directly over the retry / exit buttons. It also
  fires on `/card/*` and `/reward/*`, i.e. over the stamp button and the reward QR.
- **Why It Is a Problem:** An optional install nudge can cover the stamp disc at
  the counter or the QR being scanned. The `isEditingText` guard handles keyboards
  but not the two transactional moments that matter most.
- **Recommended Redesign:** Suppress the prompt on `/card/*/stamp`, `/reward/*`,
  `/pass/*` and `/scan` entirely (add them to the early-return list beside
  `/app/launch`, which is already excluded for exactly this reason). Prefer
  showing it once on `/home` after a successful stamp, where it is contextually
  earned.
- **Priority:** High

### 70. Install prompt's iOS step chips use 1px borders and a non-token radius
- **File(s):** `components/pwa/app-pwa.tsx:304-311`
- **Current UX/UI Problem:** `rounded-md border border-ink/20 bg-secondary px-3
  py-2` — a **1px** border at a third dashed/solid ink alpha (`/20`), on
  `rounded-md` (6px) where the system uses 10px. The card itself uses
  `shadow-xs` (2px) where every other floating surface uses `shadow-md` (4px).
- **Why It Is a Problem:** The most "OS-like" surface in the product is the one
  that least matches the design system, which reads as a third-party banner and
  reduces install intent.
- **Recommended Redesign:** `rounded-lg border-2 border-line bg-secondary` for
  the chips, `shadow-md` on the aside, and give the two chips explicit
  `IconRoundel` step numbers to match the how-it-works vocabulary.
- **Priority:** Low

---

## Cross-cutting patterns (repeated offenders)

1. **Duplicated information is the dominant height cost.** The redeem banner
   duplicates the first tile (8); the summary strip duplicates the tiles (9); the
   activity snippet duplicates the Activity tab (15); the flow-shell headline
   duplicates the receipt heading on `/card`, `/pass` and `/reward` (21, 38, 41);
   the offer landing states one promise four times (64); the reward seal renders
   at three sizes on one screen (31); "Give it a day to breathe" appears as both a
   ticket chip and a banner (32). **Removing duplication alone recovers an
   estimated 1,200-1,500px across the journey**, before any density work.

2. **The primary action is consistently the last thing on the page.** Stamp
   button after the reward ticket (18); reward QR after ticket + banner (38);
   pass QR after three restatements (41); join CTA after a 300px preview (50);
   offer claim after 760px (64). The journey's pattern should be inverted:
   **act → context → terms**, not context → terms → act.

3. **Six unsanctioned micro type sizes** — `text-[0.6875rem]` (tab bar, 3),
   `text-[0.7rem]` (join steps, 56), `text-[0.69rem]`/`text-[0.81rem]` (stamp
   dot), `text-[0.96rem]`/`text-[1.65rem]`/`text-[2.1rem]` (flow shell, 22) — in
   a system whose contract names exactly two sizes below `text-xs` and two
   headline sizes. Every one of these should resolve to `.mono-meta`, `.mono-id`,
   or a Tailwind scale step.

4. **Four dashed/solid ink alpha tones outside the two-tone contract:**
   `border-ink/25` (summary strip), `border-ink/20` (tile placeholder, PWA chips),
   `border-ink/15` (login rule), `border-ink/30` (tab-bar hover),
   `border-ink/10` (legal sheet header), `border-reward/30` (login success).
   `DESIGN.md` sanctions `--w-line` (18%) and `--w-line-strong` (50%) only.

5. **Three radii outside the contract:** `rounded-xl` (14px) in five customer
   files (40), `rounded-2xl` (18px, the sheet radius) on `RewardCelebration` (34),
   `rounded-md` (6px) on PWA chips (70). The contract is 10px and 18px-for-sheets.

6. **`sm:`/`md:` viewport variants inside a 410px column** (6) — the customer
   surface has no container queries, so it cannot respond to the only dimension
   that varies between an iPhone SE and a Pro Max. This is the root cause of the
   stamp-grid reflow (27) and the reward-ticket size inversion (30).

7. **Copy-pasted components that have already drifted:** activity rows (44),
   the two QR panels (39), the scanner chrome (62), the five sun-washed chips
   (13), three OTP fields (53), two phone fields (55), two how-it-works lists
   (56). Each pair is a future inconsistency waiting to ship.

8. **Native browser controls on the highest-trust screens** — checkboxes on
   consent and push (46) — are the only un-inked interactive elements in the
   product.

9. **Loading skeletons do not match their content** (16, 48, 67), so first paint
   shifts on the home dashboard, the push disclosure and every non-dashboard tab.

10. **Feedback is text-only at the counter.** No haptics on scan decode (58), no
    torch (58), no visual invalid-QR signal (61), no local pending state on
    toggles (47), no disabled treatment on the stamp disc (24) — the product asks
    members to operate it one-handed in a pub but communicates almost entirely
    through small grey paragraphs.

---

## Top 5 highest-impact changes

1. **Invert the card/stamp screen order so the stamp button is reachable
   without scrolling** (findings 18, 19, 20, 21). Move the press disc directly
   under the status band, collapse the five optional rails into one accordion,
   and drop the duplicated flow-shell headline. Currently the app's core verb sits
   at ≈y 900px on a 667px viewport. **Estimated saving above the button: ~300px;
   total page: ~800px.**

2. **Rebuild the home dashboard around the cards** (7, 8, 9, 10, 15). Delete the
   page title, summary strip, redeem banner and activity snippet; convert
   `HomeCardTile` to a ~120px summary row. Today no card is legible on first
   paint on a 375px phone; after this, two to three venues are. **Estimated
   saving: ~300px of chrome + ~200px per venue.**

3. **Make the QR the first thing on every collection screen, and make it big**
   (33, 38, 41). Single-padded frame (+24px of code), QR hoisted above the ticket
   and terms, a "show at the counter" full-bleed/brightness mode, and one shared
   `ScanCodePanel` for reward and pass. This is the transaction; it currently
   sits ~500px down at 247px wide.

4. **Fix the join and offer conversion steps** (50, 52, 64, 51). Terms step CTA
   above y 560px, consent checkbox separated from its legal links (currently ~40%
   of the consent row opens a sheet instead of toggling), offer claim button above
   y 400px, and a progress bar that actually advances between phone and code.
   These four are directly on the acquisition funnel.

5. **Give the scanner a torch, a reticle, a sized scan box and failure feedback**
   (58, 59, 61). The single entry point to the product currently offers no help
   whatsoever in the low-light, arm's-length, one-handed conditions it was
   designed for, and cannot tell the member that the code they are pointing at
   will never work.

---

## Appendix — measured heights (375×667 unless stated)

| Surface | Approx. height | Fits one viewport? |
|---|---|---|
| `/home` chrome above first card | ~503px | first card ~100px visible |
| `/home` with 3 venues (loaded tiles) | ~1,800-2,200px | no (~3.5 screens) |
| `/card/[id]` collecting, all rails | ~1,500px | no |
| `/card/[id]/stamp` (button at ~y 900) | ~1,100px | **no — primary control off-screen** |
| `/reward/[id]` ready (QR at ~y 520) | ~900px | no |
| `/pass/[id]` (QR at ~y 430) | ~850px | no |
| `/home/rewards` (2 ready, 6 history) | ~1,850px | no |
| `/home/activity` (40 rows) | ~5,800px | no |
| `/home/profile` | ~1,120px | no |
| `/m/…/join` terms step (CTA at ~y 780) | ~830px | **no — CTA off-screen** |
| `/offer/[token]` (claim at ~y 760) | ~900px | **no — CTA off-screen** |
| `/scan` (viewfinder + exits) | ~700px | marginal |
| `/home/login` (code requested) | ~640px | marginal, fails with keyboard up |



# C. Merchant Console

# Nabaperks — Merchant Console UX/UI Redesign Audit

**Scope:** `app/app/**`, `components/merchant/**`, `components/layout/merchant-app-shell.tsx`,
`console-sidebar-nav.tsx`, `console-nav.ts`, `components/brand/kpi-tile.tsx`.
**Method:** read-only source review of JSX + className strings against `DESIGN.md` (Wet Ink) and
`app/globals.css`. No files modified, no builds run.

**Design contract used as the yardstick (DESIGN.md):** one radius family (`--radius` 10px,
`--radius-sheet` 18px, full circles reserved for the stamp family); borders are **2px solid ink**
everywhere, **2px dashed** (`.w-rule`) for empty/receipt rules; hard non-blurred offset shadows
(`shadow-md` 4px, `shadow-sm` 3px); micro-type floor of exactly two sanctioned sub-`text-xs`
utilities (`.mono-meta`, `.mono-id`) with a hard 10px floor and an explicit ban on hand-rolled
`font-mono text-[0.x rem] tracking-[…]`; one input story (`FormField` / `SelectField` /
`SubmitButton`); one console table story (`DataTable` + `AdminRecordCard`, breakpoints `sm` or `xl`
only); merchant column max 1152px (`max-w-merchant`); 44px tap-target floor.

---

## 1. App shell, sidebar and console navigation

### 1. Merchant shell content padding is one fixed rhythm from 320px to 1920px
- **File(s):** `components/layout/merchant-app-shell.tsx:172-188`
- **Current UX/UI Problem:** the content wrapper is
  `"w-full px-4 py-8 pb-16 sm:px-6 md:pb-10"` and the inner column is
  `"mx-auto w-full max-w-merchant"`. There is no `lg:`/`xl:` step in either axis, and `py-8 pb-16`
  (32px top / 64px bottom) is applied on a phone where vertical space is scarcest. Meanwhile
  `MerchantSetupReminder` (`app/app/layout.tsx:42-44` → `merchant-setup-reminder.tsx:27`) injects a
  `className="mb-6"` ReceiptCard *above* every page's `PageTitle`, so on a phone the first pixel of
  real page content sits ~32px + full readiness card + 24px down the page.
- **Why It Is a Problem:** 96px of pure padding per screen on the smallest viewport is the single
  biggest contributor to console scroll length; and because the shell never widens its gutters at
  `lg+`, a 1440px screen renders a 1152px column with 24px gutters — the console reads cramped on
  desktop and airy on mobile, the opposite of what each needs.
- **Recommended Redesign:** move to `px-4 py-5 pb-10 sm:px-6 sm:py-6 lg:px-8 lg:py-8 md:pb-8`.
  Make the setup reminder a *slot* the page opts into next to its title (or a one-line strip inside
  `PageTitle`'s `actions`) rather than an unconditional stacked card with its own bottom margin.
- **Priority:** High

### 2. Mobile chrome is a bare hamburger + logo; the documented bottom tab bar does not exist
- **File(s):** `components/layout/merchant-app-shell.tsx:43-46` (prop doc), `:158-166` (render)
- **Current UX/UI Problem:** the `hideMobileChrome` prop is documented as dropping "the mobile sticky
  header **+ bottom tab bar**", but only a header is rendered:
  `<header className="sticky top-0 z-30 flex min-h-14 items-center gap-3 …">` containing a
  `SidebarTrigger` and `Logo`. There is no bottom tab bar anywhere in the merchant shell. Every
  navigation on a phone therefore costs: tap hamburger → drawer animates → tap item → drawer closes.
- **Why It Is a Problem:** the merchant's two highest-frequency counter actions (Scan, Poster/QR)
  are two taps and a full-screen overlay away, on a device held one-handed behind a bar. The
  customer side already ships `components/layout/customer-tab-bar.tsx`, so the pattern exists and is
  simply not applied to the console.
- **Recommended Redesign:** add a 4-item bottom tab bar for `md:hidden` — Dashboard, Scan, Poster,
  Members — reusing the customer tab-bar chip vocabulary, with `pb-[env(safe-area-inset-bottom)]`,
  `min-h-14` and 44px targets; keep the drawer for the long tail (Setup, Activity, Announce, Offers,
  Account). Then the shell's `pb-16` mobile padding becomes a real tab-bar offset rather than dead
  space. Fix the prop doc either way.
- **Priority:** Critical

### 3. Sidebar is a flat 7-item list with no grouping and no counts
- **File(s):** `components/layout/console-nav.ts:87-110`, `components/layout/console-sidebar-nav.tsx:44-62`
- **Current UX/UI Problem:** `merchantNavItems` renders Dashboard, Setup, Poster, Members, Activity,
  Announce, Offers as one ungrouped `SidebarMenu`; only the two account items get a
  `SidebarGroupLabel` ("Account"). The seven items mix *setup-time* surfaces (Setup, Poster) with
  *daily-operations* surfaces (Members, Activity, Scan-adjacent) and *growth* surfaces (Announce,
  Offers) at identical visual weight.
- **Why It Is a Problem:** no scent of task frequency; a launched venue keeps staring at "Setup"
  forever, and a pre-launch venue gets Offers/Announce it cannot use. Nothing indicates state
  (rewards ready to redeem, unread activity, setup steps remaining).
- **Recommended Redesign:** three labelled groups — **Counter** (Dashboard, Scan, Poster),
  **Members** (Members, Activity), **Grow** (Offers, Announce) — plus the existing Account group;
  demote Setup into a readiness chip in the sidebar header while incomplete and drop it from the
  main list once `readiness.launchReady`. Add a right-aligned `MonoTag` count on Members ("3 ready")
  reusing the readback already computed in `customer-readback-table.tsx:410-422`.
- **Priority:** High

### 4. Nav labels do not match the page titles they lead to
- **File(s):** `components/layout/console-nav.ts:88-109` vs `app/app/qr/page.tsx:37`,
  `app/app/launch/page.tsx:85`, `app/app/customers/page.tsx:70`, `app/app/announcements/page.tsx:31`
- **Current UX/UI Problem:** "Poster" → page titled **Venue QR**; "Setup" → page eyebrow **Merchant
  setup** with a dynamic heading; "Members" → **Loyalty members**; "Announce" → **Message your
  regulars**. Four of seven nav items rename their destination.
- **Why It Is a Problem:** breaks the "did I land where I tapped" confirmation loop, and makes the
  active-item highlight the only continuity cue. It also makes support copy ambiguous ("go to
  Poster" vs "the Venue QR page").
- **Recommended Redesign:** pick one noun per surface and use it in the nav item, the `PageTitle`
  and the eyebrow: `Poster kit` / `Venue QR` (choose one), `Setup`, `Members`, `Announcements`.
- **Priority:** Medium

### 5. Navigation pending feedback is a 6px dot at 60% opacity
- **File(s):** `components/layout/console-sidebar-nav.tsx:132-142`
- **Current UX/UI Problem:** `NavPendingIndicator` renders
  `className="ml-auto size-1.5 shrink-0 rounded-full bg-current opacity-0 … data-[pending=true]:opacity-60"`.
  6px at 60% opacity, appearing after a 100ms delay, is the only signal that a
  `force-dynamic` merchant route (every one of them) is loading.
- **Why It Is a Problem:** on a slow venue Wi-Fi connection the merchant taps, sees nothing move,
  and taps again. It is also invisible in the collapsed icon rail (`data-collapse-hide`).
- **Recommended Redesign:** swap for the shared `Spinner` at `size-4` in the same `ml-auto` slot, or
  animate the item's left border to vermillion while pending; in the collapsed rail, render the
  spinner in place of the glyph rather than hiding the indicator.
- **Priority:** Medium

### 6. Log out and Account are unreachable from the mobile header
- **File(s):** `components/layout/merchant-app-shell.tsx:143-155` (footer, inside the drawer) vs
  `:60-102` (the setup variant, which *does* expose Dashboard / Account / Log out inline)
- **Current UX/UI Problem:** in the full console the sign-out form and the account items live only
  inside the sidebar drawer footer; the mobile header has trigger + logo and nothing else. The setup
  variant header, by contrast, carries three controls at `size-sm`/`size="icon-sm"`.
- **Why It Is a Problem:** two different chrome grammars for the same product, and shared-device
  venues (a tablet behind the bar) cannot sign out without discovering the drawer.
- **Recommended Redesign:** unify: give the full-console mobile header the same right-hand cluster
  (Account `icon-sm`, Log out `sm`), or move sign-out into an avatar menu present in both variants.
- **Priority:** Medium

### 7. Active sidebar item and primary CTAs share the same filled vermillion
- **File(s):** `app/globals.css:756-763` (`[data-slot="sidebar-menu-button"][data-active="true"]` →
  `background: var(--sidebar-primary)`), vs `Button` default variant
- **Current UX/UI Problem:** the "you are here" state is a solid `--w-accent` fill with a 2px ink
  shadow — visually identical to the page's primary action button.
- **Why It Is a Problem:** DESIGN.md reserves the filled vermillion as "THE action/stamp ink";
  spending it on a passive location marker weakens every real CTA on the page and produces two
  competing "hottest thing on screen" elements.
- **Recommended Redesign:** active nav item = card ground + 2px ink border + a 3px vermillion left
  bar (`border-l-4 border-primary`) and weight 800 label. Keep the fill for the stamp/action family.
- **Priority:** Medium

---

## 2. Dashboard (`/app`)

Rough height audit at 390px wide: setup reminder card (~180px) + `PageTitle` with three stacked
full-width buttons (~230px) + `DashboardQrCard` (~380px) + billing notice + section header (~110px)
+ 2×2 KPI grid (~230px) + trend card (~230px) + recent-activity card with 4 rows (~420px)
≈ **1,800px, ~4.6 phone screens**, before any activity row is read.

### 8. Three full-width stacked buttons sit between the title and the first data
- **File(s):** `components/merchant/dashboard-header-actions.tsx:41-62`, rendered via
  `app/app/page.tsx:57`
- **Current UX/UI Problem:** `flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row` with three
  `className="w-full sm:w-auto"` buttons — Offers (ghost), Announce (secondary), Scan code
  (primary). On a phone that is 3×44px + 2×8px = **148px** of chrome, and the ghost variant renders
  as an unbordered full-width block that reads as a broken button.
- **Why It Is a Problem:** two of the three (Offers, Announce) are low-frequency and already in the
  nav; only Scan is a counter action. The stack pushes the KPI grid and the QR below the fold.
- **Recommended Redesign:** keep one primary — **Scan code** — as `w-full sm:w-auto`, and move
  Offers/Announce into the nav (they are already there) or into an overflow `…` menu at `sm+`. If
  the bottom tab bar in finding #2 lands, Scan moves there and the header keeps zero buttons on
  mobile.
- **Priority:** High

### 9. `PageTitle` fakes baseline alignment with a magic `md:pt-8`
- **File(s):** `components/brand/typography.tsx:86-90`
- **Current UX/UI Problem:** the actions slot is
  `"flex flex-wrap gap-2 md:justify-self-end md:pt-8"`. The 2rem top padding is hand-tuned to sit
  the button row roughly on the h1 baseline, but the h1 is `text-3xl sm:text-4xl` **with an optional
  eyebrow above it**, so the offset is only correct for one of the four eyebrow/description
  permutations. Compare `/app` (eyebrow + description) against `/app/account` (no eyebrow,
  `app/app/account/page.tsx:43`) — the same class yields visibly different alignment.
- **Why It Is a Problem:** every console page inherits the drift; the actions row floats high or low
  depending on which optional slots the page passed.
- **Recommended Redesign:** drop `md:pt-8` and align the two grid tracks with
  `md:items-end` on the wrapper (already `md:items-start`) plus `self-end` on the actions div, so
  actions bottom-align to the title block regardless of eyebrow/description presence.
- **Priority:** Medium

### 10. KPI tiles use an arbitrary off-scale value size and produce ragged heights
- **File(s):** `components/brand/kpi-tile.tsx:56-84`, consumed at
  `components/merchant/dashboard-home-streams.tsx:93-111`
- **Current UX/UI Problem:** the value is
  `"numeric-tabular min-w-0 text-2xl leading-none font-extrabold sm:text-[1.75rem]"` — an arbitrary
  28px that is on no type scale. The trend caption (`:79-83`) renders only when `trend` is truthy,
  and the **Members** tile is deliberately `trend: null`
  (`dashboard-home-streams.tsx:52`), so tile 1 has two rows of content while tiles 2–4 have three.
  `h-full` stretches the card but not the internal rows, so the four values do not share a baseline
  and tile 1 has a hanging gap.
- **Why It Is a Problem:** a KPI strip's whole job is fast horizontal comparison; ragged internals
  and a bespoke size break the scan and the type system at once.
- **Recommended Redesign:** use `text-2xl sm:text-3xl`; give `KpiTile` a reserved trend row
  (`<p className="mono-id min-h-4">` rendering a `—` or "no change" when `trend` is null) so all four
  tiles share an internal grid; consider `grid-rows-[auto_1fr_auto]` on the CardHeader.
- **Priority:** Medium

### 11. KPI grid stays 2-up from 640px all the way to 1024px
- **File(s):** `components/merchant/dashboard-home-streams.tsx:93`
- **Current UX/UI Problem:** `"grid grid-cols-2 gap-3 lg:grid-cols-4"`. Between `sm` and `lg` the
  tiles are 2-up and extremely wide relative to their content (a 3-character number + a 64px
  sparkline in a ~350px cell), and the grid is two rows tall.
- **Why It Is a Problem:** wasted horizontal space on tablet, an unnecessary extra row of height,
  and the sparkline never scales into the extra width (`sm:w-20` caps at 80px).
- **Recommended Redesign:** `grid-cols-2 sm:grid-cols-4` and let the sparkline grow
  (`w-16 sm:w-full sm:max-w-28`). If four across is too tight at `sm`, use
  `grid-cols-2 md:grid-cols-4`.
- **Priority:** Medium

### 12. The dashboard QR ticket is the tallest block on the page and repeats the Poster page
- **File(s):** `components/merchant/dashboard-qr-card.tsx:124-219`
- **Current UX/UI Problem:** the card renders a 9.25rem (148px) `QrFrame` with a 7.25rem image, a
  "Tap to show full screen" caption, an eyebrow + status tag, a `text-xl sm:text-2xl` venue heading,
  a body line, and then **three** actions (`Show full screen`, `CopyUrlButton`, `Poster & print`) —
  and on mobile they stack because the primary is `w-full sm:w-auto` while the other two are not,
  producing a mixed-width button row. Total ≈380px, first thing under the title.
- **Why It Is a Problem:** the QR is genuinely the counter moment, but it is competing with the KPIs
  for the top of the page, and its three actions duplicate what the whole `/app/qr` page does.
- **Recommended Redesign:** collapse to a **single-tap ticket**: 96px QR + venue name + status tag
  in a `grid-cols-[auto_1fr_auto]` row, with the whole row as the full-screen trigger and one
  overflow control for Copy/Poster. Reclaims ~200px and keeps the one action that matters. On `md+`
  put it side-by-side with the KPI grid (`md:grid-cols-[18rem_minmax(0,1fr)]`) instead of stacked.
- **Priority:** High

### 13. Dashboard "Do next" exists as a component but is only wired into the dev harness
- **File(s):** `components/merchant/dashboard-next-actions.tsx` (whole file) — the only importers are
  `app/dev/app-harness/dashboard/page.tsx:23,201`; `app/app/page.tsx` never renders it
- **Current UX/UI Problem:** the production dashboard has KPIs, a chart and a raw activity list, but
  no answer to "what should I do now". The written component (rewards ready to redeem, members gone
  quiet, repeat-member progress) is shipped and unused.
- **Why It Is a Problem:** the dashboard is currently a *reporting* surface for an operator who
  needs a *task* surface; the highest-value merchant action (someone has a reward waiting) is buried
  in the Members table's `readyCount` badge.
- **Recommended Redesign:** render `MerchantNextActions` on `/app` directly under the QR ticket,
  above the KPI grid, and make its two rows deep-link into `/app/customers?filter=ready`. Then the
  KPI grid can safely fold behind a "See the numbers" disclosure on mobile.
- **Priority:** High

### 14. Billing notice is inside the metrics stream, so it pops in late and shifts the page
- **File(s):** `components/merchant/dashboard-home-streams.tsx:79` inside `MerchantDashboardStream`,
  which is Suspended at `app/app/page.tsx:73-77`
- **Current UX/UI Problem:** `<MerchantBillingNotice status={dashboard.billingStatus} />` is the
  first child of the streamed metrics component, but `MerchantDashboardMetricsSkeleton` reserves no
  space for it (`loading-skeletons.tsx:71-112` starts straight at the section header).
- **Why It Is a Problem:** a past-due banner injects itself above already-read content after the
  stream resolves — layout shift on the most consequential message on the page.
- **Recommended Redesign:** hoist the billing status read into the page shell (it is already
  request-cached alongside `getMerchantLaunchReadiness`) and render the notice above the Suspense
  boundaries, or reserve its height in the skeleton.
- **Priority:** Medium

### 15. Empty-state and populated dashboards have different vertical rhythms
- **File(s):** `app/app/page.tsx:52` (`grid gap-6`), `dashboard-home-streams.tsx:86` (`grid gap-3`),
  `:113` (ReceiptCard `padding="md"`), `:172` (`grid gap-4`)
- **Current UX/UI Problem:** four different gap values stack inside one page: page `gap-6`, metrics
  section `gap-3`, trend card internal `gap-3`, activity card `gap-4`. DESIGN.md specifies 14px
  between cards and 22px between sections.
- **Why It Is a Problem:** the eye cannot tell which blocks are siblings and which are nested,
  because the nesting gap (12px) and the sibling gap (24px) are not consistently applied.
- **Recommended Redesign:** two tokens only — `gap-[22px]` (or `gap-6`) between page sections,
  `gap-3.5` (14px) between cards inside a section, and `gap-2`/`gap-3` inside a card. Apply
  mechanically across `/app/**`.
- **Priority:** Low

---

## 3. Members (`/app/customers`)

### 16. The members table hand-rolls a second responsive renderer instead of using `DataTable`'s
- **File(s):** `components/merchant/customer-readback-table.tsx:51-198` (mobile card + list),
  `:586-641` (`lg:hidden` / `hidden … lg:block` split)
- **Current UX/UI Problem:** the component renders the **whole filtered list twice** — once as
  `CustomerMobileList` inside `<div className="lg:hidden">` and once as `DataTable` inside
  `<div className="hidden min-w-0 lg:block">`. DESIGN.md's "Console data tables & record cards"
  section explicitly sanctions only `cardBreakpoint` `sm` or `xl` via `DataTable`'s `mobileCard`
  slot, with `AdminRecordCard` as the shared renderer; the inline comment at `:586-591` acknowledges
  it is "a bespoke lg split".
- **Why It Is a Problem:** (a) both DOM trees mount for every row — on a 50-row page that is 100
  rendered records, 100 `StampGrid`s, and two copies of every `data-customer-highlight` marker (the
  effect at `:443-454` has to filter by `offsetParent !== null` to work around it); (b) the two
  renderers have already drifted — the mobile card exposes "Open scanner" + "Send reward" only when
  *selected*, the desktop row always shows Scan/Send; (c) the design system now has two member-row
  vocabularies to maintain.
- **Recommended Redesign:** move the split into `DataTable` — either extend the shared contract with
  an `lg` breakpoint (one line in the shared component, then delete ~150 lines here) or accept `xl`
  and use column priority to fit the table at `lg`. Render the card via `AdminRecordCard` with the
  per-row action in its `action` slot, as the admin customers table already does.
- **Priority:** Critical

### 17. The Reward column stacks up to three controls, inflating every row
- **File(s):** `components/merchant/customer-readback-table.tsx:285-329`
- **Current UX/UI Problem:** the cell is
  `<span className="flex flex-col items-start gap-1.5">` containing a `MonoTag`, a conditional
  `Scan` button and an always-present `Send` button, each `size="sm"` with
  `[@media(pointer:coarse)]:min-h-11`. A redeemable row is therefore ~44+36+36+2×6 = **128px tall**
  before the `StampGrid` column is considered.
- **Why It Is a Problem:** ten members fill more than a laptop screen; the table stops being a
  table. Two persistent buttons per row also means 100 competing CTAs on a 50-row page, none of
  which is the row's actual primary action.
- **Recommended Redesign:** collapse the column to the `MonoTag` alone, and put the actions in a
  single right-hand `…` overflow (or reveal Scan/Send only on row selection, as the mobile card
  already does at `:142-164`). Add a bulk "Scan next ready reward" affordance to the header row
  instead of one per line.
- **Priority:** High

### 18. Search and filter only cover the loaded page, and the UI apologises in prose
- **File(s):** `components/merchant/customer-readback-table.tsx:512-554`,
  `app/app/customers/page.tsx:117-123`
- **Current UX/UI Problem:** filtering runs client-side over one `CUSTOMERS_PAGE_SIZE` window
  (`filterCustomers`, `:358-372`), and the honesty note at `:548-554` reads *"search and filters
  cover this page only. Older members are on the later pages."* Pagination is prev/next only
  (`:657-704`).
- **Why It Is a Problem:** for any venue past one page, search is functionally broken — the merchant
  types a member's initials, gets "No members match your filter", and has no way to know which page
  the member is on. The apology paragraph is UI debt made visible.
- **Recommended Redesign:** move `q` and `filter` into the URL and the server loader (they already
  round-trip `?page=`), matching the pattern `activity-detail-feed.tsx:235-267` already uses. Then
  delete the disclaimer paragraph, and add first/last + numbered page controls to the
  `CustomersPaginationRow`.
- **Priority:** Critical

### 19. Hand-rolled sub-`text-xs` mono breaks the documented micro-type contract
- **File(s):** `components/merchant/customer-readback-table.tsx:95` and `:231`
- **Current UX/UI Problem:** both renderers print the phone line as
  `"font-mono text-[0.66rem] font-bold tracking-[0.04em] text-muted-foreground"` — 10.56px with a
  bespoke 0.04em tracking. DESIGN.md: *"Do not hand-roll `font-mono text-[0.x rem] tracking-[…]`
  strings — reach for one of these utilities."*
- **Why It Is a Problem:** a third mono size alongside `.mono-meta` (11.5px) and `.mono-id` (10px),
  duplicated in two places, one token check away from failing.
- **Recommended Redesign:** replace both with `className="mono-id text-muted-foreground"`.
- **Priority:** Medium

### 20. Row selection is a 1px translucent ring on a 2px-ink system
- **File(s):** `components/merchant/customer-readback-table.tsx:68` (card) and `:630-639` (row)
- **Current UX/UI Problem:** selected state is
  `"bg-primary/10 ring-1 ring-primary/30 ring-inset"` in both renderers. A 1px ring at 30% alpha over
  a 10% vermillion wash is a low-contrast, non-Wet-Ink treatment.
- **Why It Is a Problem:** it will not meet 3:1 non-text contrast, and it is the *only* signal that
  the row's expanded actions belong to that member. It also reintroduces per-component ring alphas,
  which DESIGN.md bans ("Never reintroduce per-component `focus-visible:ring-*` alphas").
- **Recommended Redesign:** selected row = `bg-secondary` + a 3px solid vermillion left cell border
  (`[&>td:first-child]:border-l-4 [&>td:first-child]:border-primary`); selected card = the
  `.surface-card` border switched to `border-primary` with the standard hard shadow.
- **Priority:** Medium

### 21. Disabled pagination buttons render a non-focusable `<span>`
- **File(s):** `components/merchant/customer-readback-table.tsx:671-701`
- **Current UX/UI Problem:** `<Button asChild={pagination.hasPrev} … disabled={!pagination.hasPrev}>`
  swaps between a `Link` and a bare `<span>Previous page</span>`. With `asChild=false` the `disabled`
  prop lands on a real `<button>` — but the child is a `<span>`, so the accessible name is fine while
  the element is removed from the tab order with no `aria-disabled` explanation of *why*.
- **Why It Is a Problem:** keyboard users tabbing through the pager skip an element whose presence
  they can see, with no state announced.
- **Recommended Redesign:** always render a `<Button disabled aria-disabled="true">` with plain text
  children (no `asChild`) for the inert case, and add
  `<span className="sr-only">, first page</span>`; or hide the control entirely at the boundaries and
  keep only "Page X of Y".
- **Priority:** Low

### 22. Five stacked control blocks precede the first member row
- **File(s):** `components/merchant/customer-readback-table.tsx:495-575`
- **Current UX/UI Problem:** in order: `StatStrip` (3 stats), search + `FilterPills` row (4 pills,
  `flex-wrap` so 2 lines on a phone), the multi-page honesty paragraph, the conditional scan banner
  (`surface-card … px-4 py-3`), then the list — inside a `grid min-w-0 gap-4`. On a 390px phone that
  is roughly 90 + 130 + 40 + 70 = **330px** of chrome, plus the page title above it.
- **Why It Is a Problem:** the merchant is on this page to find one person; a third of the first
  screen is meta.
- **Recommended Redesign:** merge `StatStrip` into the `FilterPills` counts (the pills already show
  `count` — `:536-541`), so the strip is redundant; put search and pills on one row at `sm+`
  (`sm:grid-cols-[minmax(0,20rem)_1fr]`, already half-done at `:512`); demote the scan banner to a
  `MonoTag` on the selected row.
- **Priority:** High

### 23. Three separate empty/edge states with three different treatments
- **File(s):** `components/merchant/customer-readback-table.tsx:462-489` ("Nothing on this page" /
  passthrough `emptyState`), `:577-583` ("No members match your filter"),
  `app/app/customers/page.tsx:131-145` (`EmptyState` with a CTA)
- **Current UX/UI Problem:** two of the three are bespoke
  `<div className="surface-card px-4 py-10 text-center">` blocks with an `<p className="text-sm
  font-semibold">` title, while the third uses the brand `EmptyState` (icon roundel, `p-6`,
  `EmptyTitle`). Different padding (`py-10` vs `p-6`), different type, no icon, and only one offers
  a recovery action.
- **Why It Is a Problem:** inconsistent voice at exactly the moments the merchant needs guidance;
  "No members match your filter" offers no "Clear filters" button despite naming the fix in prose.
- **Recommended Redesign:** use `EmptyState` for all three with `headingLevel={3}`, and give the
  filter case a real `actions={<Button onClick={clearFilters}>Clear filters</Button>}`.
- **Priority:** Medium

---

## 4. Invite customers (`/app/customers/invite`)

### 24. An 8-row textarea plus a 340px rail makes a ~1,900px first screen on mobile
- **File(s):** `components/merchant/invite-customers-form.tsx:76-149`, `:152-165` (`DeskLayout`),
  `:179-191` (`rows={8}`)
- **Current UX/UI Problem:** `DeskLayout` is
  `"grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8"` — below `lg` the
  rail (`InvitationPreview` receipt card + the four-step `WhatHappensNext` list) stacks **below** the
  form. The form itself is a `rounded-lg border border-border bg-card p-4 sm:p-6` holding a
  `SectionHeader`, an 8-row textarea with a 3-line hint, a live count line, and a submit.
- **Why It Is a Problem:** on a phone the merchant scrolls past the entire compose form to reach the
  reassurance content that should have preceded the paste, then scrolls back. The 8-row textarea is
  ~200px of empty box before anything is typed.
- **Recommended Redesign:** `rows={5}` with `field-sizing-content` growth; hoist the invitation
  preview *above* the form on mobile (`order-first lg:order-none`) so the payoff is seen before the
  work; fold `WhatHappensNext` into a `<Disclosure label="How it works">` below `lg`.
- **Priority:** High

### 25. `border-[1.5px]` is used as a de-facto fourth border width
- **File(s):** `invite-customers-form.tsx:335`, `:358`, `:477`; also
  `offer-campaign-form.tsx:242`, `:382`, `:581`; `offers/page.tsx:152`, `:202`;
  `offer-rules-summary.tsx:152`; `reward-pool-form.tsx:594`; `loyalty-card-form.tsx:150`, `:317`
- **Current UX/UI Problem:** eleven call sites render selection tiles, radio cards, stat tiles and
  reward rows with `border-[1.5px]`. DESIGN.md states borders are **2px solid ink** everywhere, with
  2px dashed for empty/receipt rules; there is no 1.5px in the system.
- **Why It Is a Problem:** at 1.5px the ink hairline renders differently on 1x vs 2x displays and
  reads as a "cheap" third weight between the 1px `border-border` and the 2px ink; interactive
  choice tiles end up looking *less* substantial than the static cards around them.
- **Recommended Redesign:** global find-and-replace `border-[1.5px]` → `border-2`, and let the
  unselected state carry a low-alpha ink colour (`border-ink/25`) rather than a thinner stroke — the
  pattern `reward-pool-form.tsx:311-317` already uses correctly.
- **Priority:** Medium

### 26. The sent confirmation is a dead end
- **File(s):** `components/merchant/invite-customers-form.tsx:72-74`, `:491-505`
- **Current UX/UI Problem:** `if (state.message) return <SentConfirmation … />` replaces the whole
  form with a centred card — icon roundel, "Invitations queued", "Done.", and the message. There is
  no link, no button, no way back to Members, and no way to send another batch without a browser
  back or a nav tap.
- **Why It Is a Problem:** terminal state with no exit; the merchant's next natural action ("watch
  them arrive") is undiscoverable.
- **Recommended Redesign:** add an `actions` row — primary `Back to members`, secondary
  `Send another batch` (resets the action state) — and show the live campaign progress card
  (`CampaignStatusCard`, `:392-465`) instead of a static message, since the campaign is now
  "sending".
- **Priority:** High

### 27. Compliance radio tiles carry the legal weight but read as ordinary form rows
- **File(s):** `components/merchant/invite-customers-form.tsx:328-372`
- **Current UX/UI Problem:** the lawful-basis radios and the attestation checkbox are
  `border-[1.5px] border-border bg-card p-3` tiles with a native
  `className="mt-0.5 size-4 shrink-0 accent-[var(--w-ink)]"` control. A 16px native radio is below
  the 44px tap floor, and the checked state is only `has-checked:border-ink` — a border-colour
  change from 18%-alpha to full ink.
- **Why It Is a Problem:** these attestations are the GDPR gate for the whole feature; they need to
  be unmistakably answered. A 16px target and a subtle border swap fail both the tap-target floor and
  the "did I definitely select that" test.
- **Recommended Redesign:** keep the native input for semantics but scale it (`size-5`), give the
  label `min-h-11 p-3.5`, and make the checked state carry the full Wet Ink treatment:
  `has-checked:border-ink has-checked:bg-secondary has-checked:shadow-[var(--shadow-hard-sm)]`.
  Same fix applies to the identical markup in `offer-campaign-form.tsx:239-267`, `:382-398`, `:507`.
- **Priority:** High

---

## 5. Send a reward (`/app/customers/send-reward`)

### 28. 1px `border-border` cards on a 2px-ink system
- **File(s):** `app/app/customers/send-reward/page.tsx:54`, `:63`; also
  `reward-pool-form.tsx:238`, `offer-campaign-form.tsx:159`, `:179`, `:467`,
  `invite-customers-form.tsx:116`, `loyalty-card-form.tsx:98`, `launch/birthday-panel.tsx:30`
- **Current UX/UI Problem:** nine surfaces render `rounded-lg border border-border bg-card p-4 sm:p-6`
  — a 1px, 18%-alpha border with **no shadow** — while their siblings on the same screens use
  `.surface-card` / `ReceiptCard` (2px ink + 4px hard offset). On `/app/customers/send-reward` the
  page has two of these flat panels and nothing else, so the page reads as un-styled next to every
  other console page.
- **Why It Is a Problem:** two card grammars coexist across the console; the merchant sees "real"
  cards on the dashboard and ghost cards in the forms, which reads as unfinished rather than as
  hierarchy.
- **Recommended Redesign:** replace all nine with `ReceiptCard` (or `.surface-card` for plain
  elements) at `padding="md"`. Where a genuinely quieter surface is wanted, use
  `bg-secondary/40` inside a 2px-ink parent instead of thinning the border.
- **Priority:** High

### 29. Three different `<select>` treatments in one console
- **File(s):** `components/merchant/send-reward-form.tsx:122-136`
  (`h-12 rounded-lg border-2 border-ink bg-card px-3`), `components/merchant/loyalty-card-form.tsx:195-209`
  (`h-11 w-full rounded-lg border border-input bg-background px-3 text-sm`), vs the sanctioned
  `SelectField` used at `onboarding-form-fields.tsx:78-96` and `profile-form.tsx:93-105`
- **Current UX/UI Problem:** two hand-rolled native selects with different heights (48px vs 44px),
  different border weights (2px ink vs 1px input), different grounds (card vs background) and
  **no house chevron**, sitting next to `Field`/`TextareaField` inputs that all come from the themed
  `[data-slot=input]` well.
- **Why It Is a Problem:** DESIGN.md is explicit: *"Native selects compose through `SelectField`,
  which keeps the same input well and adds the house chevron."* The bare selects also inherit the OS
  arrow, breaking the print aesthetic, and the `border-input` one is nearly invisible on paper.
- **Recommended Redesign:** convert both to `SelectField` inside a `FormField` so label, hint,
  `aria-describedby` and error wiring come for free — and the hand-rolled `<label>` +
  `<p className="text-sm text-destructive">` error blocks at `send-reward-form.tsx:118-142` and
  `loyalty-card-form.tsx:188-219` disappear with them.
- **Priority:** High

### 30. "Recently sent" is an unbounded list with no empty state and no status legend
- **File(s):** `app/app/customers/send-reward/page.tsx:62-73`, `:78-93`
- **Current UX/UI Problem:** `getMerchantSentRewards` results render as an unpaginated `<ul>` of
  `bg-secondary px-3 py-2.5` rows; the section is simply omitted when empty (`sent.length > 0 ?`),
  and the `MonoTag tone={reward.statusTone}` labels have no key explaining what "Pending"/"Claimed"
  mean.
- **Why It Is a Problem:** a venue that sends weekly rewards gets an ever-growing page; a new venue
  gets no indication the history feature exists at all.
- **Recommended Redesign:** cap at 5 with a `Disclosure label="Older sent rewards"`, add an
  `EmptyState` ("Nothing sent yet") so the section is stable, and move the whole block into a
  right-hand rail at `lg+` (`lg:grid-cols-[minmax(0,1fr)_22rem]`) so the form and its history read
  side by side instead of stacked.
- **Priority:** Medium

---

## 6. Offers (`/app/offers`, `/new`, `/[id]/qr`)

### 31. Step pills are full circles, banned outside the stamp family
- **File(s):** `components/merchant/offer-campaign-form.tsx:571-600`
- **Current UX/UI Problem:** `StepTrack` renders each step as
  `"mono-meta rounded-full border-[1.5px] px-2.5 py-1"` with a `›` separator. DESIGN.md: *"Full
  circles are reserved for the stamp family… The mono pill `.w-tag` is the only generic pill shape
  outside the stamp family."*
- **Why It Is a Problem:** a stadium-shaped step chip competes visually with `MonoTag`/`w-tag`
  status pills that mean something entirely different, and the 1.5px border compounds finding #25.
  It also wraps to three lines on a phone (`flex flex-wrap`) with the `›` separators orphaned.
- **Recommended Redesign:** use `.w-tag` metrics with the 10px radius, and on mobile collapse to a
  single `Step 2 of 3 · Set the rules` line plus a 3-segment `Progress` bar — the wrapped pill
  cluster is ~70px of chrome above every step.
- **Priority:** Medium

### 32. The review step stacks two full StatusBanners plus a locked-terms card before the publish button
- **File(s):** `components/merchant/offer-campaign-form.tsx:458-543`
- **Current UX/UI Problem:** in order: optional "Offer saved" success banner, `SectionHeader`,
  `OfferRulesSummary` (7 dashed rows + a terms card), an **info** banner ("The link is the
  eligibility", 4 lines), a **neutral** banner ("New members only", 3 lines), an acknowledgement
  checkbox card, two buttons and a trailing paragraph — inside a `grid gap-5` on a
  `lg:grid-cols-[minmax(0,1fr)_360px]` with a full customer-landing preview in the second column.
- **Why It Is a Problem:** three consecutive banner tones (`success`, `info`, `neutral`) desensitise
  the merchant to banners right before the only irreversible action in the product. On a phone the
  publish button is roughly 1,400px down.
- **Recommended Redesign:** merge the two policy banners into two bullet lines inside the
  acknowledgement card (they *are* what is being acknowledged); keep exactly one banner slot for
  action outcomes. Make the publish row a sticky footer bar
  (`sticky bottom-0 -mx-4 border-t-2 border-ink bg-card/95 px-4 py-3`) so the commit control is
  always reachable while the merchant reads the readback.
- **Priority:** High

### 33. Lifecycle confirmations appear *above* the button that was pressed
- **File(s):** `components/merchant/offer-campaign-panel.tsx:268-416`
- **Current UX/UI Problem:** `LifecycleControls` renders the confirm `<form>` block first
  (`:272-354`), then the trigger row (`:356-390`), then the warning banner (`:392-415`). Pressing
  "End this offer" injects a "Yes, end this offer" submit button **above** the trigger and a warning
  banner **below** it, pushing the trigger row down mid-interaction.
- **Why It Is a Problem:** the confirm target moves away from the finger/pointer at the exact moment
  precision matters, on a destructive, irreversible action. It also means the warning explaining the
  consequence renders *after* the button that performs it, in DOM order.
- **Recommended Redesign:** render as one stable stack: trigger row → warning banner → confirm row,
  with the confirm control appended in place (never above the trigger). Better: use the shared
  `AlertDialog`/`Sheet` so the destructive confirmation is modal, focus-trapped and cannot be
  mis-clicked. Also reconsider `variant="destructive"` on **Rotate the link** (`:334`) — rotation is
  reversible-by-reprint, not destruction.
- **Priority:** High

### 34. Five metric tiles in a `grid-cols-2 lg:grid-cols-5` leave an orphan on every mid-size screen
- **File(s):** `components/merchant/offer-campaign-panel.tsx:428-454`
- **Current UX/UI Problem:** five `MetricTile`s at `grid-cols-2 lg:grid-cols-5`: from 320px to
  1023px that is 3 rows with a lone tile on row 3. Each tile also carries a `helper` sentence
  (`MetricTile` renders it in `CardContent`, `typography.tsx:171-175`), so the block is ~420px tall
  on a phone.
- **Why It Is a Problem:** ragged trailing row plus five explanatory sentences that repeat the
  caveat already stated in the paragraph at `:457-460` and elaborated in the `Disclosure` at `:461`.
- **Recommended Redesign:** `grid-cols-2 sm:grid-cols-3 xl:grid-cols-5` and drop the per-tile
  `helper` (keep it in the existing "How these are counted" disclosure) — that alone reclaims
  ~140px and makes the tiles scannable.
- **Priority:** Medium

### 35. The campaign QR page renders a full-bleed ink hero *and* the entire management panel again
- **File(s):** `app/app/offers/[campaignId]/qr/page.tsx:61-142`
- **Current UX/UI Problem:** the hero is
  `"grid justify-items-center gap-5 rounded-lg border-2 border-ink bg-ink p-6 text-paper sm:p-10"`
  wrapping a QR at `w-[min(80vmin,30rem)]` in a `rounded-2xl` frame (`:96`) — up to 480px of QR plus
  120–160px of section padding — and then re-renders `<OfferCampaignPanel>` in full below it
  (`:132-141`), including the rules summary, lifecycle controls and all five metric tiles.
- **Why It Is a Problem:** ~3 screens on a phone for a page whose stated job is *"the one screen a
  merchant holds up"*; the duplicated management panel means two identical "End this offer" controls
  exist on the same journey. `rounded-2xl` (18px) is also off-scale for a frame — 18px is reserved
  for sheets and large panels.
- **Recommended Redesign:** make this a genuine present-mode surface — the ink hero, the claim URL,
  the download button, and a single "Back to offers" link. Delete the second `OfferCampaignPanel`
  (or reduce it to a `Disclosure label="Manage this offer"`). Change `rounded-2xl` → `rounded-lg`.
- **Priority:** High

### 36. Offers hub explains the three benefit presets on every visit, forever
- **File(s):** `app/app/offers/page.tsx:132-170`
- **Current UX/UI Problem:** `OffersEmptyState` renders an `EmptyState` **and** a three-card "What an
  offer can give" grid **and** a trailing eligibility paragraph — shown to every venue with no live
  campaign, including one that has run six offers already (ended campaigns go to `OfferHistory`, so
  the empty state returns).
- **Why It Is a Problem:** first-run education becomes permanent noise; the "Create an offer" CTA is
  above ~300px of explanatory cards a returning merchant has read many times.
- **Recommended Redesign:** show the preset grid only when `history.length === 0`; otherwise render
  the `EmptyState` with the CTA plus the collapsed history. Alternatively wrap the grid in
  `<Disclosure label="What an offer can give" defaultOpen={history.length === 0}>`.
- **Priority:** Medium

---

## 7. Poster / QR asset kit (`/app/qr` + four print routes)

### 37. Four near-duplicate print routes with four different chromes
- **File(s):** `app/app/qr/poster/[template]/page.tsx` (114 lines),
  `app/app/qr/tent/[design]/page.tsx` (100), `app/app/qr/nfc/[design]/page.tsx` (139),
  `app/app/qr/nfc-square/[design]/page.tsx` (143); renderers
  `components/merchant/qr-poster/a4-poster.tsx`, `table-tent/a4-tent.tsx`,
  `nfc-card/a4-nfc-card.tsx`, `nfc-square/a4-nfc-square.tsx`
- **Current UX/UI Problem:** a diff of `tent` against `nfc` shows they differ only in the design
  lookup, the destination URL and the error copy — the load / notFound / render-PNG / error-fallback
  skeleton is byte-identical. But the *chrome* has diverged badly: `A4Poster` gets
  `PosterPreviewChrome` (sticky header with back, title, sidebar trigger, print CTA, a guidance
  toggle, and a horizontally scrolling **template switcher**), a `PosterDesktopSidecar` and a sticky
  `PosterActionBar`; `A4Tent` gets a bespoke `styles.chrome` header with a Back button and a
  `variant="reward"` print button, **no design switcher, no guidance, no sidecar, no action bar**.
- **Why It Is a Problem:** switching between poster designs is one tap; switching between tent
  designs requires navigating back to `/app/qr`, scrolling to the tent lane, and opening another
  tab (all four lanes use `target="_blank"`). Four maintenance surfaces for one job, and the print
  CTA changes variant, size and position depending on which asset you opened.
- **Recommended Redesign:** one route — `/app/qr/print/[kind]/[design]` — with `kind ∈ {poster, tent,
  nfc, nfc-square}` driving a shared registry (the `poster-renderer-registry.tsx` pattern already
  exists). One `PrintPreviewChrome` with a **kind tab row** (Poster · Tent · NFC card · NFC plate)
  above the existing design strip, one sidecar, one action bar, one error component.
- **Priority:** Critical

### 38. Tent / NFC / NFC-square print previews double-stack headers on mobile
- **File(s):** `lib/navigation/merchant-shell.ts:19-21`, `components/layout/merchant-app-shell.tsx:58`,
  `components/merchant/qr-poster/table-tent/a4-tent.tsx:52-79`
- **Current UX/UI Problem:** `isPosterPrintPath` matches only `"/app/qr/poster/"`. The tent, NFC and
  NFC-square routes therefore keep the shell's `md:hidden` sticky header (trigger + logo, `min-h-14`)
  **and** render their own `styles.chrome` header with Back + Print — two stacked sticky bars above a
  scaled A4 sheet on a phone, and the tent's own scaler measures only its stage width, not the
  shell chrome height.
- **Why It Is a Problem:** ~110px of the phone viewport is header before the artwork begins; the
  sheet under-scales or scrolls under the shell bar. The poster route, which does suppress the shell
  chrome, looks and behaves differently from its three siblings.
- **Recommended Redesign:** widen the predicate to
  `path.startsWith("/app/qr/poster/") || path.startsWith("/app/qr/tent/") || path.startsWith("/app/qr/nfc/") || path.startsWith("/app/qr/nfc-square/")` —
  or better, derive it from a single `/app/qr/print/` prefix once finding #37 lands.
- **Priority:** High

### 39. The print channel dumps four asset lanes into one endless column
- **File(s):** `components/merchant/launch/qr-redesign-concept.tsx:179-237`,
  `qr-redesign-concept-parts.tsx:178-314`
- **Current UX/UI Problem:** selecting "Print for the till" renders, in one
  `lg:grid-cols-[minmax(0,1.1fr)_minmax(16rem,0.9fr)]` column: the poster picker (8 templates in a
  horizontally scrolling strip, then a `lg:grid` stack), the `PosterProof` preview aside,
  `TableTentLinks` (`lg:col-span-2`, `border-t-2 pt-5`), `NfcCardLinks` (same), `NfcSquareLinks`
  (same), the promo notice and the email button. Each lane is a heading + description + a
  `sm:grid-cols-2 lg:grid-cols-3` grid of `min-h-14` links.
- **Why It Is a Problem:** at 390px that section alone is roughly **2,400px**; the merchant scrolls
  past three lanes they did not ask for to reach the one they did. Every lane also opens in a new
  tab (`target="_blank" rel="noreferrer"`), so the back path is a tab close.
- **Recommended Redesign:** replace the three stacked `border-t-2` lanes with a single asset-type
  tab row (`Posters · Table tents · NFC cards · Wall plates`) driven by the same
  `workspaceHref(base, channel, template)` query pattern already in use — one lane visible at a
  time, ~600px instead of 2,400px. Keep `target="_blank"` only for the final print sheet.
- **Priority:** Critical

### 40. The QR workspace hero repeats the venue QR the dashboard already showed
- **File(s):** `components/merchant/launch/qr-redesign-concept.tsx:81-144`
- **Current UX/UI Problem:** a `surface-card` with its own `border-b-2 bg-paper-deep/55 p-4 sm:p-6`
  header (eyebrow, `text-2xl sm:text-3xl` h2, description, status tag, status action), then a
  `lg:grid-cols-[minmax(15rem,0.7fr)_minmax(0,1.3fr)]` body with a `max-w-[18rem]` QR in a 6px-offset
  frame, a caption, an eyebrow, an h3, a paragraph, a dashed link well and two buttons — before the
  distribution section even starts.
- **Why It Is a Problem:** it is a second, larger copy of `DashboardQrCard` (finding #12), on a page
  the merchant reached *specifically* to print something. The h2 "Launch your counter QR" also
  contradicts the `PageTitle` h1 "Venue QR" directly above it (`app/app/qr/page.tsx:35-39`).
- **Recommended Redesign:** collapse the hero to a single `grid-cols-[auto_minmax(0,1fr)_auto]`
  status strip — 96px QR, venue name + status tag, Copy + Pause controls — and let the distribution
  picker be the page. Remove the duplicated h2.
- **Priority:** High

### 41. Four copies of one render-error surface
- **File(s):** `app/app/qr/poster/[template]/page.tsx:83-106`,
  `tent/[design]/page.tsx:69-…`, `nfc/[design]/page.tsx:86-…`, `nfc-square/[design]/page.tsx`
- **Current UX/UI Problem:** each route defines its own `…RenderError` returning the identical
  `<main className="grid min-h-dvh place-items-center bg-[var(--w-paper)] p-6">` +
  `ReceiptCard max-w-md` + `PageTitle titleClassName="sm:text-2xl"` + `StatusBanner tone="error"` +
  outline Back button, differing only in the noun ("Poster"/"Tent"/"Card").
- **Why It Is a Problem:** four places to fix a copy or a11y change; already drifting (the NFC route
  adds a second `NfcCardReviewSetupError` variant, `nfc/[design]/page.tsx:86-113`).
- **Recommended Redesign:** one `<PrintAssetError kind={…} reason={…} backHref={…} />` component in
  `components/merchant/qr-poster/`.
- **Priority:** Low

---

## 8. Setup / launch hub (`/app/launch`) and readiness

### 42. The launch page renders its heading block twice
- **File(s):** `app/app/launch/page.tsx:84-99`
- **Current UX/UI Problem:** a mobile-only block
  (`<div className="grid gap-1 sm:hidden">` with an eyebrow, an `h1` and a context paragraph) and a
  `<div className="hidden sm:grid">` wrapping the full `PageTitle` — both always in the DOM, both
  carrying the page heading, differing only in copy (`header.mobileContext` vs
  `header.description`).
- **Why It Is a Problem:** two heading sources to keep in sync, duplicated text for crawlers and
  screen-reader "list all headings" (only one renders visually, but the pattern is fragile), and a
  bespoke `text-2xl` h1 that does not match `PageTitle`'s `text-3xl sm:text-4xl` — so the heading
  size *jumps* at the `sm` boundary by two steps.
- **Recommended Redesign:** one `PageTitle` with `descriptionClassName="hidden sm:block"` plus a
  mobile-only short line, or pass a responsive description. Let `PageTitle` own the h1 at every
  breakpoint.
- **Priority:** Medium

### 43. The readiness panel states the same progress three ways at once
- **File(s):** `components/merchant/launch-readiness-panel.tsx:140-293`
- **Current UX/UI Problem:** inside one `ReceiptCard` the panel can render: a `MonoTag`
  "N of M complete" in the header (`:155-157`), a mobile `Progress` bar + a second `MonoTag` "N / M"
  (`:182-195`), the `LaunchStepRail` (5 stamps with state captions), the desktop `<ol>` of 5 step
  links each with a stamp + label + "Ready/Next up/To do" caption (`:212-268`), a `ProgressTrack`
  with its own "Setup progress" label (`:271-276`), **and** an ink CTA strip repeating
  "Next up: …" (`:278-292`). That is up to six representations of a five-item checklist.
- **Why It Is a Problem:** the file is 545 lines for one checklist; on a phone the launch hub spends
  ~300px on progress chrome before the active panel starts, and the merchant sees "3 of 5" three
  times in three type registers.
- **Recommended Redesign:** one representation per breakpoint. Mobile: the sticky step rail +
  a single 4px `Progress` bar. Desktop: the 5-step `<ol>` (the stamps already encode state) + the
  next-step CTA. Delete the `ProgressTrack` and the duplicate `MonoTag`. Target ≤250 lines.
- **Priority:** High

### 44. The launch flow has two competing "next step" CTAs on the same screen
- **File(s):** `components/merchant/launch-readiness-panel.tsx:278-292` (ink CTA strip) and
  `components/merchant/launch/launch-flow-footer.tsx:8-33` (rendered at
  `app/app/launch/page.tsx:210`)
- **Current UX/UI Problem:** the readiness card ends with a full-width ink strip "Next up: X" +
  button, and the page ends with a `surface-card bg-muted` footer reading "Next step / Keep your
  setup moving" + a button. Both link to the resolved next tab.
- **Why It Is a Problem:** the merchant cannot tell whether these are the same action; the footer's
  copy ("Keep your setup moving") carries no information the strip has not already given.
- **Recommended Redesign:** keep exactly one. The footer is better placed (bottom of the panel the
  merchant just completed) — so suppress the readiness strip whenever `tabMode` is on (the panel
  already has that flag at `:92`) and let `LaunchFlowFooter` be the single forward action, labelled
  with the concrete next step.
- **Priority:** Medium

### 45. Onboarding puts a 6-field address form and a roadmap aside in an awkward 3-child grid
- **File(s):** `app/app/onboarding/page.tsx:25-46`,
  `components/merchant/onboarding-journey-orientation.tsx:27`
- **Current UX/UI Problem:** the page is
  `"mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"` with **three** children.
  The roadmap `<aside>` pins itself with `lg:col-start-2 lg:row-span-2 lg:row-start-1`, so the layout
  only works by explicit placement — remove that class and the form jumps into the 320px column. The
  first child is a `ReceiptCard` whose only always-visible content is the `PageTitle`, because the
  summary line inside it is `lg:hidden` (`onboarding-journey-orientation.tsx:16`). On desktop it is a
  receipt card containing a heading and nothing else.
- **Why It Is a Problem:** fragile implicit placement, and a card whose payload disappears at the
  breakpoint where it has the most room.
- **Recommended Redesign:** make the placement explicit and robust — a two-column grid with a single
  left `<div className="grid gap-4">` holding title + form, and the aside as the second child. Drop
  the ReceiptCard around the title (a `PageTitle` does not need a card) and let the roadmap show at
  every breakpoint, collapsing into a `Disclosure` below `lg`.
- **Priority:** Medium

### 46. The onboarding form validates only on submit and commits with one full-width button
- **File(s):** `components/merchant/onboarding-form.tsx:216-345`
- **Current UX/UI Problem:** validation is an `onSubmit` sweep of five required fields
  (`:221-252`) that `preventDefault`s, sets `clientErrors`, and focuses the first invalid input. There
  is no blur-time validation, no per-field success state, and the postcode/city fields never format.
  The submit is `<Button type="submit" disabled={pending} aria-busy={pending} className="w-full">`
  with a manual `{pending ? "Saving…" : "Finish setup"}` — not the documented `SubmitButton`.
- **Why It Is a Problem:** the merchant fills six fields, presses the one button, and is thrown back
  up the form; on a phone the focused field may be off-screen behind the keyboard. `SubmitButton`
  would give `aria-busy`, the `Spinner` and the disabled state for free and consistently.
- **Recommended Redesign:** validate required fields on `blur` (keeping the submit sweep as the
  backstop), render a summary `Alert` listing the invalid fields with anchor links above the
  submit, and swap the button for `<SubmitButton pendingLabel="Saving…">Finish setup</SubmitButton>`.
- **Priority:** Medium

### 47. The reward-pool form is an endless scroll with a fixed bottom bar and a padding hack
- **File(s):** `components/merchant/reward-pool-form.tsx:235-532`
- **Current UX/UI Problem:** one `<section>` renders: header + counter tag, an sr-only status, a
  helper paragraph, a preset well containing up to 9 dashed tiles in `sm:grid-cols-2
  lg:grid-cols-3`, a selection bar, a feedback paragraph, an empty state, the reward list, and an
  "Add a reward" dashed button. The selection bar is
  `"fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 … sm:static"` — a fixed
  overlay on mobile that becomes a static row at `sm` — and the section compensates with
  `selectedPresetIds.length > 0 && editingId === null && "pb-[8.75rem] sm:pb-6"`, a hard-coded
  140px spacer whose value is coupled to the bar's rendered height.
- **Why It Is a Problem:** the spacer is guesswork (two lines of copy + a two-button row wraps
  differently at 320px), so the last reward row can sit under the bar; the whole surface is
  ~1,700px on a phone; and this is the launch-blocking step, so height directly costs activation.
- **Recommended Redesign:** wrap the presets in `<Disclosure label="Reward ideas" defaultOpen={items.length === 0}>`
  so returning merchants see their pool first; make the selection bar a real sticky footer
  (`sticky bottom-0 -mx-3 border-t-2 border-ink bg-card/95 px-3 py-2.5`) so it participates in flow
  and the `pb-[8.75rem]` hack disappears; shorten the bar to one line
  ("+3 selected → 5 active") with the two buttons inline.
- **Priority:** High

### 48. The reward pool mixes four radii, three border weights and a bespoke pending label
- **File(s):** `reward-pool-form.tsx:238` (`rounded-lg border border-border`), `:594`
  (`rounded-lg border-[1.5px]`), `:713` (`rounded-2xl` on the active toggle), `:784`
  (`rounded-lg border-2 border-ink … shadow-sm`), `:846-848`
- **Current UX/UI Problem:** the section uses a 1px border, reward rows use 1.5px, the active/off
  switch is `rounded-2xl` (18px — the *sheet* radius) at `h-5`, and the open editor uses 2px ink with
  `shadow-sm`. The editor's submit is `<Button type="submit" disabled={pending}>{pending ? "Saving…"
  : …}</Button>` instead of `SubmitButton`, so it announces no `aria-busy` and shows no `Spinner`.
- **Why It Is a Problem:** an 18px radius on a 20px-tall pill makes it a full stadium — the shape
  DESIGN.md reserves for stamps/tags — and it sits directly beside a 6px-radius icon button
  (`:636`, `rounded-md`). Four radii in one card is visual noise on the launch-critical step.
- **Recommended Redesign:** section → `ReceiptCard`; rows → `border-2 border-ink/25`; the toggle →
  `.w-tag` metrics (already referenced in the comment at `:707`) at the 10px radius; the editor's
  submit → `<SubmitButton pendingLabel="Saving…">`.
- **Priority:** Medium

### 49. Only one long console form has a sticky save bar
- **File(s):** `components/merchant/loyalty-card-form.tsx:235-239` (has one) vs
  `venue-location-form.tsx:188-190`, `profile-form.tsx:141`, `onboarding-form.tsx:336-343`,
  `announcement-compose.tsx:260-268` (none)
- **Current UX/UI Problem:** the card form wraps its submit in
  `"sticky bottom-3 z-10 border-t border-border/80 bg-card/95 pt-3 backdrop-blur-sm sm:static …"`.
  The venue form (address + Google autocomplete + GPS disclosure, ~1,400px), the profile form, the
  onboarding form and the announcement composer all end with a plain button at the bottom of the
  scroll.
- **Why It Is a Problem:** inconsistent commit affordance across sibling forms in the same console;
  on the venue form the merchant edits a field near the top and has no idea a save exists without
  scrolling. The one sticky bar also uses a 1px `border-border/80` top rule, off-system.
- **Recommended Redesign:** extract a `<FormActionBar>` (sticky at `<sm`, static at `sm+`, 2px ink
  top rule, `bg-card/95`, safe-area padding) and use it on every merchant form longer than one
  viewport. Add a dirty-state indicator ("Unsaved changes") in its left slot.
- **Priority:** Medium

### 50. The card builder's stepper and preset row are three different selection grammars
- **File(s):** `components/merchant/loyalty-card-form.tsx:123-175`, `:280-332`
- **Current UX/UI Problem:** "Visits to reveal" offers (a) a `Stepper` — an
  `inline-flex … rounded-lg bg-secondary` group with `min-h-9 w-11` −/+ buttons and a
  `border-x-[1.5px]` readout — and (b) three cadence preset cards
  (`min-h-16 rounded-lg border-[1.5px]`, selected = `border-ink bg-ink text-paper shadow-sm`), and
  (c) a hint paragraph that changes with the preset. The stepper buttons are `min-h-9` (36px) on fine
  pointers, growing only via `[@media(pointer:coarse)]:min-h-11`.
- **Why It Is a Problem:** two controls for one value with no visual link between them (changing the
  stepper does not visibly deselect a preset card unless the number happens to differ); the inverted
  ink-fill selected preset is a heavier treatment than the primary submit button below it.
- **Recommended Redesign:** make the presets the primary control (three `min-h-14` tiles with the
  count as the large numeral) and demote the stepper to a small "or choose a custom number" row
  beneath, with an `aria-describedby` linking them. Selected preset = 2px ink border + `bg-secondary`
  + a check glyph, not a full ink fill.
- **Priority:** Medium

---

## 9. Activity (`/app/activity`)

### 51. Activity cards lift on hover but are not clickable
- **File(s):** `components/merchant/activity-detail-card.tsx:28`
- **Current UX/UI Problem:** the `<article>` carries
  `"group/activity surface-card border-ink px-4 py-3 transition-[border-color,box-shadow,transform] … hover:-translate-y-0.5"`.
  The card itself has no click handler or link — only the optional `primaryAction` button inside it
  does (`:54-65`).
- **Why It Is a Problem:** a hover lift is the system's strongest "this is pressable" signal (it is
  used on real links in `qr-redesign-concept-parts.tsx:202`, `:249`, `:296`). Applying it to an inert
  card trains the merchant to click things that do nothing.
- **Recommended Redesign:** remove the transform, or make the whole card a link to the row's
  detail target where one exists (the row model already carries `primaryAction.href`), using a
  stretched-link overlay so the inner button stays independently focusable.
- **Priority:** Medium

### 52. "Load more" grows the list by 50 with no ceiling feedback and no virtualisation
- **File(s):** `components/merchant/activity-detail-feed.tsx:307-329`,
  `app/app/activity/page.tsx:121-127`
- **Current UX/UI Problem:** `loadMoreHref` sets `limit = limit + 50`, and the page clamps at 250.
  Each press re-renders the whole grouped timeline; the footer only says "N events loaded, more
  available." There is no indication that 250 is the wall, and no jump-to-top after a load.
- **Why It Is a Problem:** at 250 rows the page is roughly 25,000px of DOM with a `WetInkRise`
  wrapper per date group; the merchant loses their scroll anchor on each load, and hitting the
  invisible 250 ceiling reads as a bug.
- **Recommended Redesign:** switch to date-window paging ("Older activity →" by week) or add
  `?before=<cursor>` paging; keep the loaded window to ~50 rows. Announce the ceiling explicitly
  when reached, and add a "Back to top" control in the footer.
- **Priority:** Medium

### 53. The search + filter block is duplicated between Activity and Members
- **File(s):** `activity-detail-feed.tsx:127-180` vs `customer-readback-table.tsx:512-543`
- **Current UX/UI Problem:** both render the same composition by hand — an absolutely positioned
  `Icon icon={Search01Icon} size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 …"`
  over an `<Input type="search" className="pl-9">`, followed by `FilterPills className="flex-wrap"`
  and a `role="status"` count line. The two differ in wrapper (`surface-card p-3 sm:p-4` vs a bare
  grid), in whether search writes to the URL (Activity debounces to the router; Members does not),
  and in the count wording ("N shown from M" vs "Showing members A–B of C").
- **Why It Is a Problem:** two near-identical toolbars that behave differently; a merchant learns
  that search "sticks" on one page and not the other.
- **Recommended Redesign:** extract `<ConsoleFilterBar search={…} pills={…} resultLabel={…} />` into
  `components/data/`, URL-backed by default, and use it on both pages (and any future console list).
- **Priority:** Medium

---

## 10. Announcements (`/app/announcements`)

### 54. The composer fights its own surface class
- **File(s):** `components/merchant/announcements/announcement-compose.tsx:146-149`
- **Current UX/UI Problem:** the form className is
  `"surface-card grid min-w-0 gap-5 rounded-lg border-2 border-ink bg-card p-4 shadow-xs sm:p-5"`.
  `.surface-card` (globals.css:313-319) already sets the 2px ink border, the 10px radius, the card
  ground **and** `box-shadow: var(--shadow-md)` (4px hard offset). The utility then restates three of
  those and overrides the elevation down to `shadow-xs`.
- **Why It Is a Problem:** the composer sits at a different elevation from every other console card
  for no stated reason, and the redundant classes hide that fact from anyone reading the file.
- **Recommended Redesign:** `className="surface-card grid min-w-0 gap-5 p-4 sm:p-5"`. If a flatter
  tile is genuinely wanted, use the sanctioned `data-elevation="flat"` recipe on a `Card`.
- **Priority:** Low

### 55. Character counters are decorative, and the limit is enforced silently
- **File(s):** `announcement-compose.tsx:209-251`
- **Current UX/UI Problem:** each field pairs a `<Label>` with
  `<span className="numeric-tabular text-xs font-semibold text-muted-foreground">{title.length}/{TITLE_LIMIT}</span>`,
  wired via `aria-describedby`. The counter never changes colour approaching the limit, and both
  controls use `maxLength` so typing simply stops at 80/180 characters with no message.
- **Why It Is a Problem:** a merchant pasting a longer message loses the tail without being told; the
  counter is announced only when the field receives focus, not as it changes.
- **Recommended Redesign:** make the counter a live region (`aria-live="polite"`) that turns
  `text-destructive` in the last 10%, and replace the hard `maxLength` with soft validation + a
  `FormMessage` ("Trim 12 characters") so the paste survives and the merchant edits it.
- **Priority:** Medium

### 56. The disabled Send button never says why
- **File(s):** `announcement-compose.tsx:105-110`, `:260-268`
- **Current UX/UI Problem:** `canSubmit` is a conjunction of five conditions (eligible audience,
  under the daily limit, non-empty title, non-empty body, not pending). When false the button
  renders `variant="secondary" disabled` with no `aria-describedby` pointing at a reason. Two of the
  five reasons *do* get banners (no audience, daily limit) but the other three are silent.
- **Why It Is a Problem:** a disabled primary action with no stated cause is the classic dead-end;
  screen-reader users get "Send announcement, dimmed" and nothing more.
- **Recommended Redesign:** keep the button enabled and validate on submit (surfacing a
  `FormMessage` under the offending field), or keep it disabled with
  `aria-describedby="send-blocked-reason"` and a visible one-line reason next to it.
- **Priority:** Medium

---

## 11. Account, profile and billing

### 57. The account tab bar is styled as a primary CTA
- **File(s):** `components/merchant/account/account-tab-bar.tsx:17-38`
- **Current UX/UI Problem:** the active tab is
  `"bg-primary text-primary-foreground"` inside a `rounded-lg border-2 border-ink bg-card p-1
  shadow-sm` island, with inactive tabs as plain muted text. There are only two tabs (Profile,
  Billing) and they use `auto-cols-fr grid-flow-col` full width on mobile.
- **Why It Is a Problem:** same issue as finding #7 — the filled vermillion is the action ink, and a
  full-width filled block at the top of the page reads as "press me" rather than "you are here".
  With two tabs, a full-width segmented control is also more chrome than the choice warrants.
- **Recommended Redesign:** underline-style tabs (2px ink bottom rule on the active item, ink-soft
  labels otherwise), `sm:inline-flex` at every breakpoint, and consider merging the two panels into
  one scrollable Account page with anchor links given how short the Profile panel is.
- **Priority:** Medium

### 58. Billing receipt rows use 1px borders and a `py-1` container
- **File(s):** `components/merchant/account/billing-panel-view.tsx:284-288`, `:326-359`
- **Current UX/UI Problem:** both `<dl>`s are
  `"grid gap-0 rounded-lg border border-border bg-secondary/40 px-3 py-1 text-sm"` — a 1px border and
  4px of vertical padding around a stack of `PlanRow`s, sitting inside a `ReceiptCard edge`.
- **Why It Is a Problem:** this is the money surface; the thinnest border in the system and almost
  no internal padding makes it read as an afterthought. `py-1` also means the first and last rows'
  dashed separators sit flush against the container edge.
- **Recommended Redesign:** `.w-rule` dashed separators on a transparent ground with `py-2` rows —
  i.e. an actual receipt block inside the receipt card — or `border-2 border-ink/20 px-4 py-2`.
- **Priority:** Medium

### 59. `StatusBanner` titles smuggle `<h2>` elements into banners
- **File(s):** `billing-panel-view.tsx:124`, `:262`, `:290`, `:371`
- **Current UX/UI Problem:** four call sites pass `title={<h2>Billing details could not be loaded</h2>}`
  into the banner's title slot, while every other console banner passes a string
  (e.g. `qr-panel.tsx:79`, `offer-campaign-panel.tsx:107`).
- **Why It Is a Problem:** a transient error notice becomes a document-outline heading, and the
  billing tab's heading structure changes depending on whether Stripe returned an error. The
  `StatusBanner` presumably styles its title slot, so the injected `h2` also inherits an unintended
  size.
- **Recommended Redesign:** pass plain strings; if the banner genuinely needs a heading role, add a
  `headingLevel` prop to `StatusBanner` and set it once.
- **Priority:** Medium

### 60. Off-scale `rounded-xl` on profile feedback and scan detail lists
- **File(s):** `components/merchant/profile-form.tsx:127`, `:136`;
  `app/app/rewards/scan/[scanToken]/page.tsx:110`;
  `app/app/offers/scan/[passToken]/page.tsx:114`
- **Current UX/UI Problem:** the profile form's error and success paragraphs use
  `rounded-xl border border-destructive/30` / `rounded-xl border border-reward/30`, and both scan
  pages render their member/card `<dl>` as `rounded-xl border-2 border-ink bg-card p-4`. `--radius-xl`
  is 14px — between the 10px card radius and the 18px sheet radius, and used nowhere else in the
  console.
- **Why It Is a Problem:** a fourth radius introduced in four places; on the scan pages the 14px
  detail box sits directly beneath a `RewardTicket`/`ReceiptCard` at 10px, so the mismatch is
  visible in a single glance.
- **Recommended Redesign:** `rounded-lg` everywhere; replace the profile form's hand-rolled feedback
  paragraphs with `Alert`/`StatusBanner`, which already carry the 2px ink contract.
- **Priority:** Low

### 61. `min-h-11 w-full sm:w-fit` is pasted onto buttons that are already 44px tall
- **File(s):** `billing-panel-view.tsx:194`, `:202`, `:216`, `:306`, `:379`;
  `activity-detail-feed.tsx:221`; `activity-detail-card.tsx:59`;
  `activity-compact-feed.tsx:52`; `customer-readback-table.tsx:300`, `:316`;
  `poster-preview-chrome.tsx:77`; `table-tent/a4-tent.tsx:57`, `:74`
- **Current UX/UI Problem:** twelve-plus call sites re-assert the tap floor by hand, in three
  different dialects: `min-h-11`, `min-h-11 sm:min-h-9`, and
  `[@media(pointer:coarse)]:min-h-11`. DESIGN.md states compact button sizes are already
  *"honest — they render at their declared height on fine pointers and grow to the 44px floor on
  coarse (touch) pointers"*, so `Button size="sm"` should need none of this.
- **Why It Is a Problem:** if the Button variant's coarse-pointer growth is working, these are
  no-ops that also break the honest compact height on desktop (a `min-h-11` `size="sm"` button is a
  44px button pretending to be small). If it is not working, the fix belongs in one place.
- **Recommended Redesign:** verify the `size` variants' coarse-pointer floor once, then delete every
  hand-written `min-h-11` from call sites. Where a button truly must be full-height, use
  `size="default"`.
- **Priority:** Medium

### 62. The cancellation page is a single card with a full-width secondary escape
- **File(s):** `app/app/account/cancel/page.tsx:22-42`
- **Current UX/UI Problem:** `PageTitle` + one `ReceiptCard edge padding="md" className="gap-5"`
  containing the interview form and, at the bottom, `Button asChild variant="secondary"
  className="w-full sm:w-fit"` → "Back to billing". When `cancellable` is false the card shows one
  muted sentence and the same full-width button.
- **Why It Is a Problem:** the "stay" path (Back to billing) is the outcome the product wants, yet it
  is a secondary control below the fold of a form; and the non-cancellable state renders a nearly
  empty card rather than an `EmptyState` with a clear next step.
- **Recommended Redesign:** put "Back to billing" in the `PageTitle` actions slot (visible on
  arrival), use `EmptyState` for the non-cancellable branch, and keep the destructive continue
  action at the form's foot with the outline-danger silhouette.
- **Priority:** Low

---

## 12. Counter scanning (`/app/scan`, `/app/rewards/scan/*`, `/app/offers/scan/*`)

### 63. The scan page breaks the console's column width and puts an `h1` inside a card
- **File(s):** `app/app/scan/page.tsx:12-16`, `components/merchant/merchant-reward-scanner.tsx:21-34`,
  `:270-306`
- **Current UX/UI Problem:** the page is `<div className="mx-auto w-full max-w-xl">` (576px) inside
  a shell that already constrains to `max-w-merchant` (1152px), and the page's only heading is
  `ScanCardHeader`'s `<h1 className="text-3xl leading-tight font-extrabold tracking-[-0.01em]
  sm:text-4xl">` rendered **inside** the `ReceiptCard`. Every other console route puts the `PageTitle`
  above the card.
- **Why It Is a Problem:** navigating from `/app` (1152px, title outside) to `/app/scan` (576px,
  title inside a card) is a jarring layout jump on desktop, and it means the scan page has no page
  chrome the merchant can orient by.
- **Recommended Redesign:** render a normal `PageTitle` above a `max-w-xl` centred scanner card, and
  reduce the in-card header to an `Eyebrow` + status line. Keep the `h1` at page level.
- **Priority:** Medium

### 64. Camera failure offers only "Try again" — no manual code entry
- **File(s):** `components/merchant/merchant-reward-scanner.tsx:90-105`, `:284-301`
- **Current UX/UI Problem:** the four camera error reasons are well written, but the only recovery
  control is a `Try again` button plus a `Back to dashboard` link. There is no way to type or paste
  the customer's reward code, no torch toggle, and no camera-picker for devices with several
  cameras. The viewfinder itself is a `min-h-64` dashed box with no framing guide beyond the library's
  `qrbox`.
- **Why It Is a Problem:** in a dim bar with a denied permission (a very common state on a shared
  tablet), the merchant is completely blocked from honouring a reward the customer is standing there
  holding.
- **Recommended Redesign:** add a persistent secondary path — "Enter the code instead" opening a
  short numeric/`inputMode="text"` field that resolves the same
  `normalizeScannedRewardDestination` route — plus a torch toggle where
  `MediaStreamTrack.applyConstraints({advanced:[{torch:true}]})` is supported.
- **Priority:** High

### 65. Both scan detail pages stack full-width buttons in a grid
- **File(s):** `app/app/rewards/scan/[scanToken]/page.tsx:145-152`, `:157-167`;
  `app/app/offers/scan/[passToken]/page.tsx:145-152`, `:201-212`
- **Current UX/UI Problem:** `ScanShell` renders `<section className="grid gap-4">` and the buttons
  are direct grid children, so they stretch full width and stack — "Scan another reward" (primary)
  above "Back to dashboard" (secondary), each ~44px + 16px gap. The two files are otherwise
  near-identical shells (`PageTitle` + `max-w-xl` + a `grid gap-4` section), duplicated rather than
  shared.
- **Why It Is a Problem:** two full-width buttons of equal size at the end of a counter flow read as
  equal-weight choices; and any change to the shell has to be made twice.
- **Recommended Redesign:** wrap the actions in `<div className="flex flex-wrap gap-2">` so the
  primary sizes to its content and the secondary reads as an escape; extract the shared
  `<CounterScanShell>` used by both routes.
- **Priority:** Low

---

## 13. Skeletons, loading and error surfaces

### 66. The generic route skeleton is a page title only, so every route "pops in"
- **File(s):** `app/app/loading.tsx:7-16`, vs the structural skeletons in
  `components/merchant/loading-skeletons.tsx`
- **Current UX/UI Problem:** `/app/*` route transitions render `MerchantPageTitleSkeleton` alone — one
  eyebrow bar, one title bar, one description bar, one action block. Every page then streams its own
  structural skeleton *inside* Suspense. So a navigation shows: title skeleton → real title +
  section skeleton → content. Three layout states per navigation.
- **Why It Is a Problem:** the comment at `:3-6` calls this "a single predictable step", but in
  practice the merchant sees the page height jump twice. On `/app/customers` the difference between
  a lone title skeleton and the real page (StatStrip + toolbar + 50 rows) is thousands of pixels.
- **Recommended Redesign:** give the high-traffic routes their own `loading.tsx` composed from the
  existing structural skeletons (`MerchantCustomersTableSkeleton`, `ActivityFeedSkeleton`,
  `OfferCampaignPanelSkeleton`) so the route fallback and the stream fallback are the same shape —
  `app/app/scan/loading.tsx:11-29` already does exactly this and is the model to copy.
- **Priority:** Medium

### 67. The console error boundary offers one action and no support path
- **File(s):** `app/app/error.tsx:16-30`
- **Current UX/UI Problem:** `min-h-[50vh] … max-w-2xl` `EmptyState` with a single `Try again`
  button. No "Back to dashboard", no error digest surfaced, no contact route — despite the
  boundary rendering inside the shell where nav is available.
- **Why It Is a Problem:** if `reset()` fails twice the merchant has nowhere to go but the browser
  back button, and support has no reference to ask for.
- **Recommended Redesign:** add a secondary `Back to dashboard` link and print the `error.digest` as
  `mono-id` text ("Reference: abc123") so a merchant can quote it. `min-h-[50vh]` is also an
  arbitrary viewport unit inside a padded shell — `py-16` is enough.
- **Priority:** Low

---

## Cross-cutting patterns (repeated offenders)

1. **Two card grammars.** `.surface-card` / `ReceiptCard` (2px ink + hard shadow) vs
   `rounded-lg border border-border bg-card p-4 sm:p-6` (1px, no shadow) — the latter in 9 places
   (`send-reward/page.tsx:54,63`, `reward-pool-form.tsx:238`, `offer-campaign-form.tsx:159,179,467`,
   `invite-customers-form.tsx:116`, `loyalty-card-form.tsx:98`, `birthday-panel.tsx:30`). Every one
   of them is a *form* surface, so the console's most important screens are its least-styled.
2. **`border-[1.5px]` as a phantom third border weight** — 11 call sites (finding #25). Always on
   selectable tiles, i.e. exactly where the ink contract should be loudest.
3. **Off-scale radii.** `rounded-2xl` (`reward-pool-form.tsx:713`, `offers/[id]/qr/page.tsx:96`),
   `rounded-xl` (`profile-form.tsx:127,136`, both scan pages), `rounded-full` on non-stamp pills
   (`offer-campaign-form.tsx:581`). Four radii in a two-radius system.
4. **Hand-rolled form primitives beside the sanctioned ones.** Two bare `<select>`s
   (`send-reward-form.tsx:122`, `loyalty-card-form.tsx:195`) next to `SelectField`; three
   hand-rolled error paragraphs (`reward-pool-form.tsx:448,840`, `onboarding-form-fields.tsx:112`,
   `venue-location-form.tsx:183`, `profile-form.tsx:127`) instead of `Alert`/`FormMessage`; two
   manual `{pending ? "Saving…" : …}` buttons (`onboarding-form.tsx:342`,
   `reward-pool-form.tsx:847`, `loyalty-card-form.tsx:237`) instead of `SubmitButton`.
5. **Tap-target floors re-asserted at 12+ call sites** in three dialects (finding #61) — either the
   Button variants are not doing their documented job, or these are all dead weight.
6. **Progress and status stated 2–3 times per surface.** Launch readiness (finding #43), the members
   toolbar (`StatStrip` + pill counts, finding #22), the offer QR page (hero + full panel, finding
   #35), the dashboard (QR card + poster page, findings #12/#40).
7. **Duplicated markup instead of shared components** — the members table's two renderers (#16), the
   four print routes (#37/#41), the two scan shells (#65), the two search toolbars (#53), the two
   dashboard/poster QR heroes (#40).
8. **Vertical height is nobody's budget.** No console page uses a two-column layout below `lg`
   except `invite` and `loyalty-card-form`; almost nothing uses tabs or accordions to fold optional
   content, even though `Disclosure` (`launch/disclosure.tsx`) is already built, accessible and used
   in exactly four places.

---

## Top 5 highest-impact changes

1. **Cut the four print routes and the four stacked asset lanes down to one tabbed print workspace**
   (findings #37, #38, #39, #41). This removes ~1,800px of scroll from `/app/qr`, fixes the
   double-header on tent/NFC previews, gives tent/NFC users the design switcher posters already
   have, and collapses four route files + four error components into one.
2. **Make the members table one responsive component with server-side search and paging**
   (#16, #17, #18, #22). Today the page renders every row twice, apologises in prose that search
   does not work past page one, and spends 330px on chrome before the first member. Fixing it
   restores the console's most-used screen and deletes ~150 lines of bespoke markup.
3. **Give the dashboard a task layer and halve its height** (#8, #12, #13). Ship the already-written
   `MerchantNextActions`, shrink the QR ticket to a one-row counter strip, drop two of the three
   header buttons, and put the QR beside the KPIs at `md+`. Roughly 1,800px → ~900px, with the
   highest-value action ("someone has a reward waiting") finally visible.
4. **Add the mobile bottom tab bar the shell already claims to have** (#2), and regroup the sidebar
   by task frequency (#3). Every counter action is currently two taps and a drawer animation away on
   the device the merchant actually holds.
5. **Unify the form surface and its primitives** (#25, #28, #29, #48, #49): one card grammar
   (2px ink), one border weight, `SelectField`/`SubmitButton`/`Alert` everywhere, and one shared
   sticky `FormActionBar` for the four forms longer than a viewport. This is a mechanical pass that
   touches ~15 files and makes the console's setup path — the activation-critical path — look like
   the same product as its dashboard.



# D. Admin Back-office, Shared Data Display & Dev Surfaces

# Nabaperks — UX/UI Redesign Audit: Internal Admin / Back-Office & Shared Data Display

**Scope:** `app/admin/**`, `components/admin/**`, `components/data/**`,
`components/layout/admin-shell.tsx`, `app/dev/design-system/**`, `app/dev/app-harness/**`
**Method:** read-only source review of JSX + `className` strings against `DESIGN.md` (Wet Ink) and
`app/globals.css`. No files were modified; no builds or tests were run.
**Reference contract used:** 4px base unit, 14px card gap / 22px section gap, `max-w-merchant`
(72rem) for consoles, 2px ink borders, hard non-blurred offset shadows, 10px radius (18px sheets),
two dashed tones only (`--w-line` 18% / `--w-line-strong` 50%), one focus recipe, one input story
(`Input`/`Textarea`/`SelectField` + `FormField`), 44px tap floor, mono micro-type limited to
`.mono-meta` (11.5px) and `.mono-id` (10px).

---

## 0. Headline: the console is far taller than it needs to be

Rough stacked-height estimates from the markup (desktop >=1280px, default readbacks):

| Route | Structure | Est. height |
|---|---|---|
| `/admin/privacy` | PageTitle + **4 stacked panels**, 25 record cards x2 panels, feed, 25-row table, **3 independent paginators** | **~13,000-14,000px** desktop, ~20,000px+ on phone |
| `/admin/merchants` | PageTitle + 100-row table + **100 QR `AdminRecordCard`s in a plain grid** (no pagination, no reveal) | **~20,000px+** at every breakpoint |
| `/admin/customers` | 25-row membership table where **every desktop row embeds a 2-field + submit form (~160px/row)** + 25-row rewards table with per-row cancel forms | **~7,000-8,000px** |
| `/admin/fraud` | 100 flags x a row containing **two full `AdminActionForm`s, each with a required text input** (~250px/row) | **~26,000px** |
| `/admin/audit` | 100 unpaginated rows, no filters, no sticky header | ~6,000px |
| `/admin/billing` | 100 rows; phone card renders **11 stacked label/value fields** (~800px/card) | ~8,000px desktop, ~80,000px phone |
| `/dev/design-system` | 9 `gap-12` sections, 992 lines of demos, **no table of contents** | ~15,000px |

The pattern behind all of it is identical: **one panel per concern, stacked vertically, with every
per-record write form rendered inline and expanded.** Every fix below is a variant of four moves —
**tabs/segmented views instead of stacked panels**, **row expansion instead of inline forms**,
**pagination/reveal on every list**, and **two-column density on md+**.

---

## A. Admin shell, navigation and wayfinding

### 1. Admin sidebar cannot be collapsed on desktop, and its width fights the table breakpoint
- **File(s):** `components/layout/admin-shell.tsx:40` (`<Sidebar collapsible="offcanvas">`), `:83-90` (trigger only inside the `md:hidden` header), `components/layout/console-sidebar-nav.tsx:19-23` (`--sidebar-width: 17rem`); contrast `components/layout/merchant-app-shell.tsx:118` (`collapsible="icon"`) and `:127-131` (a desktop `SidebarTrigger`).
- **Current UX/UI Problem:** the admin `Sidebar` is `offcanvas`, so at `md+` it renders as a fixed 272px rail (`fixed inset-y-0 w-(--sidebar-width) md:flex`) with **no trigger anywhere on desktop** — the only `SidebarTrigger` lives in the `md:hidden` header. On a 1280px laptop the content column is `1280 - 272 - 48 (px-6) ~= 960px`, yet every admin `DataTable` switches from cards to the semantic table at `cardBreakpoint="xl"` — a **viewport** query at 1280px.
- **Why It Is a Problem:** the console renders 6-7 column tables into ~960px exactly at the width where it decides they fit. Combined with `TableCell`'s inherited `whitespace-nowrap` (finding 59) this guarantees horizontal scrolling on the most common admin viewport, and the operator has no way to reclaim the 272px. It also diverges from the merchant console, which can collapse.
- **Recommended Redesign:** switch to `collapsible="icon"`, add the same `hidden shrink-0 md:flex` `SidebarTrigger` to `SidebarHeader` that `merchant-app-shell.tsx:127` uses, and persist via the existing sidebar cookie. Then move `DataTable`'s breakpoint off the viewport: wrap the panel body in `@container` and use `@6xl:block` / `@6xl:hidden` so the table appears when *the panel* is wide enough, not the window.
- **Priority:** Critical

### 2. Admin content column uses an unsanctioned max width
- **File(s):** `components/layout/admin-shell.tsx:102-103` (`px-4 py-8 sm:px-6` -> `mx-auto w-full max-w-7xl`).
- **Current UX/UI Problem:** `max-w-7xl` (80rem/1280px) is a raw Tailwind value; `DESIGN.md` mints `--container-merchant: 72rem` and the `max-w-merchant` utility for exactly this job, used at `merchant-app-shell.tsx:184`.
- **Why It Is a Problem:** the two consoles measure differently for no product reason and the 80rem value is outside the token contract, so it will drift again. Panel descriptions also run past the `max-w-2xl` that `SectionHeader` assumes.
- **Recommended Redesign:** use `max-w-merchant`, or mint `--container-admin` in `globals.css` and record it in `DESIGN.md`'s spacing block. Keep the `px-4 py-8 sm:px-6` rhythm — that part already matches merchant.
- **Priority:** Medium

### 3. The MFA banner is a permanent, non-actionable strip on every admin page
- **File(s):** `components/layout/admin-shell.tsx:91-101` (`role="status"` ... `border-b-2 border-ink bg-reward/12 px-4 py-3 text-sm font-semibold`).
- **Current UX/UI Problem:** "MFA enforcement is enabled for this admin session." renders full-width above the content on every route, always, with no dismiss and no link — ~49px plus border, forever.
- **Why It Is a Problem:** a banner that never changes is banner-blindness fuel; it also devalues the identical treatment (`bg-reward/12` + 2px ink) that `AdminActionForm` uses for real success messages (`components/admin/action-form.tsx:51`), so a genuine "Stamps adjusted" reads as chrome. `role="status"` on a static string is noise on every navigation.
- **Recommended Redesign:** demote to a `MonoTag tone="leaf"` in the sidebar footer beside the existing "AAL2 verified" chip (they say the same thing) and delete the strip. If a page-level signal is required, render it only for an *unsatisfied* state.
- **Priority:** High

### 4. Sidebar footer is three decorative marketing chips, and there is no sign-out
- **File(s):** `components/layout/admin-shell.tsx:18-22` (`supportStatusItems`), `:54-80`.
- **Current UX/UI Problem:** the footer stacks five `MonoTag`s — operator email, "Service-role readbacks", "Audited support actions", "MFA-aware access", "AAL2 verified" — about 170px of sidebar. Three are static product claims, not state. There is **no log-out control at all** (merchant has one at `merchant-app-shell.tsx:143-155`) and no link to `/admin/security` in the account area.
- **Why It Is a Problem:** an internal console's footer should carry identity and session controls, not copy. An operator on a shared machine cannot end an admin session from within the console.
- **Recommended Redesign:** replace with an account block: truncated operator email with `title`, one `MonoTag tone="leaf"` for AAL state, a "Security" link, and `<form action={signOutAction}><Button variant="secondary" className="w-full justify-start">` matching the merchant shell. Delete `supportStatusItems`.
- **Priority:** High

### 5. Sidebar has 11 flat nav items with no grouping
- **File(s):** `components/layout/console-nav.ts` `adminNavItems` (11 entries), consumed at `components/layout/admin-shell.tsx:45-49`; `console-sidebar-nav.tsx:45-61` already supports `secondaryItems`/`secondaryLabel`, which admin does not pass.
- **Current UX/UI Problem:** Overview, Pilot, Evidence, Merchants, Customers, Referrals, Billing, Privacy, Fraud, Audit, Security render as one undifferentiated `min-h-12` list about 570px tall.
- **Why It Is a Problem:** the items span three unrelated jobs (support/lookup, commercial/analytics, compliance/security). A flat list makes scanning positional rather than semantic and will not survive the next two routes.
- **Recommended Redesign:** use the existing group support: **Support** (Overview, Merchants, Customers, Billing, Referrals), **Insight** (Pilot, Evidence), **Compliance** (Privacy, Fraud, Audit, Security) via `secondaryItems`/`secondaryLabel` and `SidebarGroupLabel`.
- **Priority:** Medium

### 6. No global search / command palette; five routes have no filter at all
- **File(s):** `components/admin/lookup-controls.tsx:21-69` is mounted only at `app/admin/customers/customer-memberships-panel.tsx:51` and `app/admin/privacy/data-request-workflow-panel.tsx:53`. `merchants`, `audit`, `fraud`, `referrals`, `billing` mount no search.
- **Current UX/UI Problem:** to find one merchant an operator loads `/admin/merchants`, which returns the newest 100 rows (`lib/admin/data.ts` `getAdminMerchants().limit(100)`) with no filter, no pagination and no total, then browser-finds by eye.
- **Why It Is a Problem:** the most common admin task (find this venue / this event) is unsupported on 5 of 11 routes, and the 100-row cap is invisible, so an operator can conclude a merchant "does not exist".
- **Recommended Redesign:** promote `AdminLookupControls` to a shell-level sticky filter bar under the page title (`sticky top-0 z-20 bg-background/95`), give every list route a lookup plus `AdminLookupPagination`, and add a Cmd-K palette over the same query params. At minimum print "showing newest 100 of N" wherever a hard `.limit(100)` exists.
- **Priority:** Critical

---

## B. `/admin` overview

### 7. The overview repeats the entire sidebar as a button grid
- **File(s):** `app/admin/page.tsx:132-143`.
- **Current UX/UI Problem:** all `adminNavItems` render again as `variant="secondary"` buttons in `sm:grid-cols-2 lg:grid-cols-4` — 11 links, about 160px. The adjacent comment still says "8 nav links", so it is stale by three items and the `lg:grid-cols-4` rationale no longer matches the row count.
- **Why It Is a Problem:** duplicated navigation with no added information (no counts, no state, no recency), below the fold of a page that already has a persistent sidebar. It is pure height.
- **Recommended Redesign:** delete the grid. If a hub is wanted, render 4-6 **task** cards with live counts ("3 billing issues", "2 open fraud flags", "1 overdue data request") linking into pre-filtered views.
- **Priority:** High

### 8. KPI tiles are dead ends and under-specified
- **File(s):** `app/admin/page.tsx:59-75`.
- **Current UX/UI Problem:** three `MetricTile`s (Merchants / Customers / Billing issues) in `sm:grid-cols-3`, none wrapped in a link, none carrying a `trend`, and "Billing issues" — the only actionable one — is styled identically to the two vanity counts.
- **Why It Is a Problem:** the one number an operator must act on has no affordance and no visual priority; clicking a KPI is the natural gesture and does nothing.
- **Recommended Redesign:** wrap each tile in a `Link` to its filtered route, give "Billing issues" a tone treatment (destructive wash plus a `StatusPill`), and pass `trend` where a delta exists. Consider `StatStrip` — it packs the same three numbers into ~90px rather than ~260px.
- **Priority:** Medium

### 9. Funnel panel's derived-metrics footer uses a one-off hairline
- **File(s):** `app/admin/page.tsx:87` (`border-t border-ink/20 pt-4`).
- **Current UX/UI Problem:** a 1px solid `ink/20` rule. Elsewhere the same job is done by `border-b` (1px `--border`) at `customers/customer-memberships-panel.tsx:42`, by `border-t-2 border-dashed border-ink/20` at `evidence/page.tsx:135`, and by `border-y border-dashed border-ink/30` at `app/dev/app-harness/trial/admin/page.tsx:29`. `.w-rule` — the sanctioned 2px dashed receipt rule — is used **zero times** in the admin tree.
- **Why It Is a Problem:** four rule treatments for one semantic ("divide a panel"), none of which is the documented one. `DESIGN.md` sanctions exactly two dashed tones; `ink/20` and `ink/30` are neither.
- **Recommended Redesign:** standardise on `<hr className="w-rule" />` inside panels and `border-b-2 border-ink` for panel-header separation. Delete `border-ink/20` and `border-ink/30`.
- **Priority:** Medium

---

## C. `/admin/customers`

### 10. Every desktop membership row embeds a live two-field write form
- **File(s):** `app/admin/customers/customer-memberships-panel.tsx:180-184` (column `action` -> `StampAdjustmentForm`), `:207-235`.
- **Current UX/UI Problem:** the `Audited action` column renders `AdminActionForm` with a `Delta` number input plus helper text, a `Reason` input and a 44px submit — a `min-w-[280px]` block about 160px tall — for **all 25 rows**. The mobile card folds the identical form behind `AdminRecordActions` (`:120-126`). `DESIGN.md` calls these "the same `StampAdjustmentForm`"; they are, but only one is progressively disclosed.
- **Why It Is a Problem:** about 4,000px of always-visible form for an action taken on maybe one row per session; 25 simultaneous focusable form groups wreck tab order; row height makes member scanning impossible; and 25 copies of "Positive adds stamps, negative removes them." is pure repetition.
- **Recommended Redesign:** make the desktop cell a single `Button variant="secondary" size="sm">Adjust` that expands an inline detail row (`<tr>` + `colSpan`) or opens a `Sheet`, reusing the `AdminRecordActions` exclusive-accordion `group` so only one row is open. Target row height about 56px; print the helper once, inside the disclosure.
- **Priority:** Critical

### 11. Reward cancellation renders its destructive form inline on every eligible row
- **File(s):** `app/admin/customers/customer-rewards-panel.tsx:154-166`, `:189-209`.
- **Current UX/UI Problem:** each eligible desktop row shows a `Reason` input, a two-line irreversibility helper, a required `AdminConfirmCheck` and a `variant="destructive"` submit — about 190px per row. Ineligible rows print the bare sentence "No action available" in the same column.
- **Why It Is a Problem:** 25 armed destructive controls on screen at once is a mis-click surface, not a safety design; the safety copy loses all weight through repetition; and the mixed "form vs sentence" column makes the table ragged.
- **Recommended Redesign:** collapse to `Button variant="destructive" size="sm">Cancel...` opening an `AlertDialog`/`Sheet` that holds reason + confirm check, so the danger copy appears exactly once at the moment of decision. Replace "No action available" with a muted em dash or `StatusPill tone="neutral"` so the column keeps one shape.
- **Priority:** Critical

### 12. Two panels, two paginators, one URL — and only one has a search box
- **File(s):** `app/admin/customers/page.tsx:47-78` (`page` + `rewardsPage` params), `customer-memberships-panel.tsx:51` (lookup) vs `customer-rewards-panel.tsx` (none).
- **Current UX/UI Problem:** the route owns two independently paginated lists. Paging Rewards re-renders the whole route and returns the operator to the top, above about 4,000px of memberships. Rewards cannot be searched at all, though the venue/contact fragment is already parsed.
- **Why It Is a Problem:** two paginators on one scroll surface is a classic orientation failure; the operator loses their place on every page change, and the shared search silently applies to only one list.
- **Recommended Redesign:** convert to a segmented view — `Memberships | Rewards` via `FilterPills` (`components/brand/filter-pills.tsx`, already in the system and unused in admin) driven by a `?view=` param — so exactly one list, one paginator and one search bar are on screen. Removes roughly half the page height.
- **Priority:** High

---

## D. `/admin/privacy` — the tallest page in the product

### 13. Four stacked panels with three independent paginators
- **File(s):** `app/admin/privacy/page.tsx:65-113` (`DataRequestWorkflowPanel` -> `UnaffiliatedCustomersPanel` -> `LoggedRequestsPanel` -> `ConsentLogPanel`), params `page` / `consentPage` / `unaffiliatedPage` at `:38-40`.
- **Current UX/UI Problem:** four full `AdminPanel`s in `grid gap-6`. Panel 1 renders up to 25 `AdminRecordCard`s (~230px each => ~5,750px), panel 2 up to 25 more (~170px each => ~4,250px), panel 3 an `ActivityFeed`, panel 4 a 25-row table with its own paginator. Estimated **~13,000-14,000px desktop**.
- **Why It Is a Problem:** nothing below panel 1 is discoverable; three paginators mutate one URL so each page change re-lays the whole document; and the four panels serve three jobs (service a request / find an orphan account / track SLA / read evidence) never needed simultaneously.
- **Recommended Redesign:** tabs — `Requests | Unaffiliated | Activity | Consent log` — driven by the URL (`?panel=requests`) so deep links survive, with the shared venue/contact lookup lifted into a page-level sticky filter bar above the tab strip. Each tab then owns one paginator; height drops to one screen plus one list. Keep `AdminPanel className="p-0"` where the body is a table so it stays flush.
- **Priority:** Critical

### 14. The lookup control filters a panel it does not sit in
- **File(s):** `app/admin/privacy/data-request-workflow-panel.tsx:53-57` (lookup inside panel 1); `unaffiliated-customers-panel.tsx:42` — the description literally reads "Filtered by the contact search at the top of the page."
- **Current UX/UI Problem:** panel 2's filtering affordance is thousands of pixels above it and visually owned by panel 1; the only signpost is a sentence.
- **Why It Is a Problem:** a control governing a region it is not adjacent to is a discoverability failure; the operator will assume panel 2 is unfiltered and mis-read an empty state as "no such customer".
- **Recommended Redesign:** promote the lookup to page level (finding 13) and show applied filters as dismissible chips (`MonoTag` + a remove control) directly above each filtered list, so scope is visible where results are.
- **Priority:** High

### 15. Privacy record cards make three raw UUID chips the loudest element
- **File(s):** `app/admin/privacy/data-request-workflow-panel.tsx:107-116`.
- **Current UX/UI Problem:** a `References` field renders three `AdminIdChip`s (`customer:`, `merchant:`, `membership:`) side by side, each an 8-hex-character truncation with a dotted underline.
- **Why It Is a Problem:** three near-identical mono strings dominate the card while being the least often needed; the dotted underline reads as a hyperlink but is a copy button; and an 8-character prefix is not safe to quote in a GDPR record.
- **Recommended Redesign:** move references behind the existing `AdminRecordActions` disclosure ("References"), or render one primary chip (membership) with the rest in a popover. Restyle `AdminIdChip` per finding 51.
- **Priority:** Medium

### 16. Two different write forms sit side by side in one disclosure with no headings
- **File(s):** `app/admin/privacy/data-request-workflow-panel.tsx:119-124` (`grid gap-4 xl:grid-cols-2` -> `ConsentOptOutForm` + `DataRequestForm`).
- **Current UX/UI Problem:** below `xl` the two forms stack with only `gap-4` and no headings — Channel/Reason/[Record opt-out] runs straight into Request type/Channel/Notes/[Log request]. `xl:grid-cols-2` is again a viewport query inside a card nested three levels deep, so at 1280px each column is about 330px.
- **Why It Is a Problem:** two unlabelled forms sharing a "Channel" field read as one form; submitting the wrong one writes the wrong audit record. That is a correctness risk, not just aesthetics.
- **Recommended Redesign:** give each form an `Eyebrow` heading ("Record consent opt-out" / "Log a data request") separated by `.w-rule`; switch the split to `@container` (`@2xl:grid-cols-2`); keep the differing submit variants and add the headings.
- **Priority:** High

### 17. Consent-log "Source" is a whole column of identical pills
- **File(s):** `app/admin/privacy/consent-log-panel.tsx:121-127` (desktop column), `:82-85` (mobile field).
- **Current UX/UI Problem:** every row renders `<SourceLabel>Source: {record.source}</SourceLabel>` — a pill whose first word is the constant "Source:" — while the panel header already carries `Source: consent_records` (`:35`).
- **Why It Is a Problem:** about 14 characters of constant text times 25 rows, in a column competing for width on a table that already overflows.
- **Recommended Redesign:** drop the "Source:" prefix inside rows (the header says it), render the value as plain mono text, and merge it into the `Channel` cell (`email . self_serve`). Reserve `SourceLabel` for panel headers.
- **Priority:** Low

---

## E. `/admin/merchants`

### 18. 100 QR records render as an unpaginated card wall
- **File(s):** `app/admin/merchants/page.tsx:243-266` (`qrCodes.map` into a plain `grid gap-3`), `:268-303` (`QrRecord`); data cap `lib/admin/data.ts getAdminQrCodes().limit(100)`.
- **Current UX/UI Problem:** unlike every other admin list, QR records do not use `DataTable`, have no pagination, no `ShowMoreList`, no search and no breakpoint switch — 100 `AdminRecordCard`s (about 200px each with their disclosure) at **all** widths, roughly 20,000px, appended below a 100-row merchant table.
- **Why It Is a Problem:** the page is effectively infinite; the `#qr-records` cross-link from a merchant row (`:111`) jumps about 8,000px with no return path; finding one venue's QR is a manual scroll.
- **Recommended Redesign:** convert to `DataTable` with `cardBreakpoint="xl"`, `mobilePageSize={10}` and columns `QR id . Merchant . State . Created . Actions`, plus a venue lookup and `AdminLookupPagination`. Better still, make QR records a tab on this page (`?view=accounts|qr`) so the two lists never co-exist, and have the cross-link switch tabs.
- **Priority:** Critical

### 19. Destructive styling is inverted between the two QR controls
- **File(s):** `app/admin/merchants/page.tsx:305-335` (`QrStateForm`: `variant={nextActive ? "secondary" : "destructive"}`, **no** `AdminConfirmCheck`) vs `:337-354` (`RegenerateQrForm`: `variant="secondary"` **with** `AdminConfirmCheck`).
- **Current UX/UI Problem:** "Disable QR" — reversible, and the helper itself says "the QR can be re-enabled later" — gets the destructive silhouette and no confirmation. "Regenerate QR" — which permanently invalidates every printed poster in the venue — gets the neutral secondary silhouette, with the confirm checkbox carrying the entire warning load.
- **Why It Is a Problem:** the colour system tells the operator the opposite of the truth. `DESIGN.md` makes the destructive silhouette semantic ("the different silhouette says danger before the copy does"); here it says danger on the safe action.
- **Recommended Redesign:** `Regenerate QR` -> `variant="destructive"`, keep the confirm check, move it behind a confirm dialog. `Disable QR` -> `variant="secondary"` with a short confirm check ("Scans stop immediately"). `Enable QR` stays `secondary`.
- **Priority:** Critical

### 20. Cross-links are four 12px underlined words with no tap target
- **File(s):** `app/admin/merchants/page.tsx:83-116` (`text-xs`, `focus-ring rounded-sm`, `gap-x-3 gap-y-1`), duplicated near-verbatim at `app/admin/billing/page.tsx:23-44`.
- **Current UX/UI Problem:** Members / Billing / Privacy / QR records render as `text-xs` primary-coloured underlined links inside the first table cell, with no `min-h`, no icon and no `[@media(pointer:coarse)]:min-h-11` — unlike every other compact control in the system.
- **Why It Is a Problem:** four adjacent ~16px-tall targets fail the 44px coarse-pointer floor the contract sets, and four stacked links under the business name make the merchant column the visual centre of gravity of the table.
- **Recommended Redesign:** extract one `AdminCrossLinks` component (the billing copy is a duplicate) rendering `Button variant="link" size="xs"` items, which already carry the coarse-pointer floor, or move the links into a row-level "Open" menu. Reduce to two (Members, Billing) and put the rest in the row detail.
- **Priority:** High

### 21. Merchants page has no lookup, no pagination and no total
- **File(s):** `app/admin/merchants/page.tsx:55-75`; `lib/admin/data.ts getAdminMerchants().limit(100)`.
- **Current UX/UI Problem:** the merchant list is the console's spine and is the only major list with no `AdminLookupControls`, no `AdminLookupPagination` and no row count — while `/admin/customers` and `/admin/privacy` both search *by merchant name*.
- **Why It Is a Problem:** an operator cannot answer "is this venue on the platform?" without scrolling; past 100 merchants the answer becomes silently wrong.
- **Recommended Redesign:** reuse `AdminLookupControls basePath="/admin/merchants"` with a `venue` param plus `AdminLookupPagination` (both already generic), and surface `meta.total` in the panel header as a `MonoTag`.
- **Priority:** High

---

## F. `/admin/billing`

### 22. The mobile billing card is an 11-field wall
- **File(s):** `app/admin/billing/page.tsx:192-259` (11 `fields` entries), rendered by `components/admin/record-card.tsx:57-74` (`dl grid gap-2.5`, label above value).
- **Current UX/UI Problem:** every field is a two-line `dt`/`dd` stack, so one card is about 22 lines / 800px before its `BillingFulfilmentActions` disclosure. With 100 rows and **no `mobilePageSize`**, the phone view is tens of thousands of pixels.
- **Why It Is a Problem:** no operator reads 11 labelled fields per merchant; the decision-relevant ones (status, fulfilment, period end) are buried among Stripe refs.
- **Recommended Redesign:** cut to 4 headline fields plus a "Details" `AdminRecordActions` disclosure holding the rest; add `mobilePageSize={10}`; and give `AdminRecordCard` an inline layout option (`grid-cols-[minmax(0,8rem)_1fr] items-baseline`) which alone halves card height.
- **Priority:** High

### 23. The desktop "Launch fulfilment" cell stacks four `text-xs` lines
- **File(s):** `app/admin/billing/page.tsx:140-167` (`grid min-w-48 gap-2` with a `StatusPill` plus three `text-xs` lines).
- **Current UX/UI Problem:** each row prints Delivery / Pilot end / Stripe sync as three 12px muted lines; with the `Stripe refs` column (`:168-179`, two more mono lines) and the `Controls` disclosure, the table has three multi-line columns and a comfortable minimum width well past the ~960px it gets (finding 1).
- **Why It Is a Problem:** 12px muted text is the wrong register for dates an operator must verify, and the horizontal pressure forces the nowrap scroll.
- **Recommended Redesign:** keep only the `StatusPill` plus the single most decision-relevant date; move the rest into the row's `Details` disclosure. Use `.mono-meta` for dates rather than `text-xs` muted so printed facts are typographically distinct from prose.
- **Priority:** Medium

### 24. Stripe references are plain text, not copyable chips
- **File(s):** `app/admin/billing/page.tsx:171-178` (`font-mono text-xs` spans), mobile equivalents `:239-248` (`mono: true`).
- **Current UX/UI Problem:** the two identifiers an operator most often pastes into the Stripe dashboard are the only ids in the console rendered as plain mono, while audit and privacy ids get `AdminIdChip` with click-to-copy.
- **Why It Is a Problem:** inconsistent identifier affordance; the operator hand-selects an id inside a horizontally scrolling cell.
- **Recommended Redesign:** render both through `AdminIdChip` (`prefix="sub"` / `prefix="cus"`) and make `AdminIdChip` the single id renderer for the console.
- **Priority:** Medium

### 25. Billing panel header is a lone source pill with no title
- **File(s):** `app/admin/billing/page.tsx:78-83` (`<div className="border-b p-5"><SourceLabel>...</SourceLabel></div>`).
- **Current UX/UI Problem:** unlike every sibling panel there is no `SectionHeader` — just a 1px-bordered strip containing a provenance pill, so the header block is about 60px of nothing.
- **Why It Is a Problem:** breaks the panel anatomy (eyebrow/title/description/actions) the rest of the console teaches, and wastes a header row.
- **Recommended Redesign:** add `<SectionHeader title="Subscriptions & poster fulfilment" description="..." actions={<SourceLabel>...</SourceLabel>} />` to match merchants/customers/privacy.
- **Priority:** Low

---

## G. `/admin/audit`

### 26. 100 log rows, no filter, no pagination, no sticky header
- **File(s):** `app/admin/audit/page.tsx:22-138`; `lib/admin/data.ts getAdminAuditLogs(limit = 100)`.
- **Current UX/UI Problem:** the audit table renders 100 rows (`mobilePageSize={10}` covers phones only) with no filter on action, actor, merchant or date, and `TableHeader` does not stick, so column meaning is gone after about 8 rows of scroll.
- **Why It Is a Problem:** an audit log is a search surface by definition ("what did operator X do to merchant Y last Tuesday?"). Without filters or a date range it only answers "what happened most recently".
- **Recommended Redesign:** add `FilterPills` for action category (support / privacy / security / billing), a date-range pair and `AdminLookupPagination`; make the header `sticky top-0 z-10 bg-secondary` inside the scroll container; paginate desktop as well as phone.
- **Priority:** High

### 27. Action names ship raw and snake_cased
- **File(s):** `app/admin/audit/page.tsx:96` (`<span className="font-bold">{log.action}</span>`), mobile card title `:60`.
- **Current UX/UI Problem:** `data_request_logged`, `customer_pii_erased` print as-is in bold Bricolage, while the fraud panel humanises the same class of value (`fraud-flags-panel.tsx:73` `flag.signal.replaceAll("_", " ")`) and privacy does too (`logged-requests-panel.tsx:96`).
- **Why It Is a Problem:** snake_case in the display face is a register violation (mono is the printed voice, Bricolage the spoken one), and the same data reads three ways on three pages.
- **Recommended Redesign:** one `formatAdminAction()` helper in `components/admin/support.tsx` used by audit, fraud, privacy and the overview feed; render the raw key as `.mono-id` beneath where operators need the exact token.
- **Priority:** Medium

---

## H. `/admin/fraud`

### 28. Every flag row carries two complete write forms — about 250px per row, 100 rows
- **File(s):** `app/admin/fraud/fraud-flags-panel.tsx:121-125` (`Review` column), `:189-247` (`FraudFlagActions` -> two `FraudFlagResolutionForm`s, each an `AdminField` + required `Input` + `SubmitButton`).
- **Current UX/UI Problem:** the desktop table renders "Review reason" + input + `Mark reviewed` (filled vermillion primary) **and** "Dismissal reason" + input + `Dismiss` for every row, in a `min-w-56` cell. The mobile card folds the pair behind a disclosure (`:151-155`), so again only one mode is disclosed.
- **Why It Is a Problem:** roughly 26,000px of page; 200 focusable inputs; 100 filled-primary buttons marching down the page, destroying the "one filled red equals the action" rule in `DESIGN.md`; and severity cannot be scanned because rows are 250px apart.
- **Recommended Redesign:** replace the cell with one `Button variant="secondary" size="sm">Review...` opening a row expansion or `Sheet` containing both outcomes as a single form with a `reviewed | dismissed` choice and one reason field. Row height target about 64px. Add bulk selection so a burst of identical low-severity flags can be dismissed together.
- **Priority:** Critical

### 29. Warning and danger tones are visually indistinguishable
- **File(s):** `components/admin/support.tsx:122-130` (`warning` -> `bg-primary/15`, `danger` -> `bg-destructive/15`), consumed at `fraud-flags-panel.tsx:37-45` (`medium` -> warning, `high` -> danger) and `merchants/page.tsx:40-49`.
- **Current UX/UI Problem:** the warning wash is a 15% tint of vermillion `#cf330a` and the danger wash a 15% tint of `#c0301c` — colours `DESIGN.md` itself records as sitting **~1.1:1 apart**. At 15% over card they are effectively one swatch; only the `STATUS_PILL_ICON` glyph differs.
- **Why It Is a Problem:** severity triage by scan — the entire point of the fraud page — does not work. The same collision hits merchant account status (paused vs cancelled) and billing tones.
- **Recommended Redesign:** move `warning` to the sun spot ink (`bg-seal/20 text-foreground`, the documented attention ink) and keep `danger` on destructive; keep both icons; verify each wash holds >=3:1 non-text contrast on card. Document the four tones in `/dev/design-system`.
- **Priority:** High

### 30. Status pills and provenance labels are the same object
- **File(s):** `components/admin/support.tsx:94-109` (`SourceLabel`: `border-ink bg-secondary text-muted-foreground`) vs `:111-135` (`StatusPill` neutral: `border-ink bg-secondary text-secondary-foreground`).
- **Current UX/UI Problem:** a neutral status pill and a "Source: audit_logs" provenance pill share mono face, border and background, differing only in text colour. On `consent-log-panel.tsx` and `pilot/page.tsx` both appear in the same row.
- **Why It Is a Problem:** state and metadata must not share a silhouette; the operator cannot pre-attentively separate "this record is pending" from "this data came from a table".
- **Recommended Redesign:** give `SourceLabel` a quieter, distinct treatment — no border, `.mono-id`, `text-muted-foreground`, a small database glyph — and reserve the bordered pill exclusively for state.
- **Priority:** Medium

### 31. No filters on a triage surface; resolved and open flags interleave
- **File(s):** `app/admin/fraud/page.tsx:10-26`, `fraud-flags-panel.tsx:105-108` (status is a display-only column).
- **Current UX/UI Problem:** flags arrive newest-first regardless of status or severity; there is no default "open only" view and no severity filter, though `FilterPills` exists in the brand layer and is used nowhere in admin.
- **Why It Is a Problem:** the operator scrolls past resolved flags to find work, and high-severity items have no priority position.
- **Recommended Redesign:** default to `status=open`, expose `FilterPills` for `Open / High / All` with counts (the component supports `count`), and sort by severity then recency.
- **Priority:** High

### 32. Redemption-failures panel is three columns of almost nothing
- **File(s):** `app/admin/fraud/redemption-failures-panel.tsx:30-94`.
- **Current UX/UI Problem:** a full `AdminPanel` + `SectionHeader` + `DataTable` (with `xl` card mode and a mobile card renderer) to display Event / Merchant / When — three short values.
- **Why It Is a Problem:** about 350px of chrome for a list that is structurally an activity feed, and it is the second stacked panel making the fraud page taller.
- **Recommended Redesign:** render as `ActivityFeed` (title = event, description = merchant, `timestamp`), or make it the second tab of a `Flags | Failures` segmented view.
- **Priority:** Medium

---

## I. `/admin/referrals`

### 33. Referral rows print unmasked customer emails, breaking the console-wide masking rule
- **File(s):** `app/admin/referrals/referral-ops-panel.tsx:65-69` (`row.referrerEmail`, `row.referredEmail`) and `:127-128`; contrast `maskAdminCustomer` used on customers, privacy, audit, fraud and the overview.
- **Current UX/UI Problem:** every other admin surface renders customer contact through `maskAdminCustomer()` (`components/admin/support.tsx:189-196`) producing `jo***@domain`; the referral panel prints both parties' full addresses at `text-xs`.
- **Why It Is a Problem:** an inconsistency in a privacy control is a privacy incident waiting to happen, and it teaches operators that masking is decorative. It is also the only place raw PII sits at 12px.
- **Recommended Redesign:** route both through `maskAdminCustomer({ email })`, with reveal behind an explicit audited action if full contact is genuinely required.
- **Priority:** Critical

### 34. Referral state tones never signal success, and the whole table is 12px
- **File(s):** `referral-ops-panel.tsx:19-25` (`statusTone` returns only `neutral | warning | danger`), `:64`, `:90`, `:114` (`text-xs leading-5`).
- **Current UX/UI Problem:** an awarded or qualified referral renders as a neutral grey pill — there is no `good` branch — while merchants and privacy both use `tone="good"`. Four of five columns render at `text-xs`, including the identity column.
- **Why It Is a Problem:** the happy path is invisible, so the operator cannot see at a glance whether settlement is working. 12px is below the 13.5px `small` size the type contract sets for anything that is not mono metadata.
- **Recommended Redesign:** add `awarded`/`qualified` -> `"good"`; lift row text to `text-sm` and reserve `text-xs`/`.mono-meta` for timeline and counters; add a status filter and pagination — this list is also capped at 100 with no indication.
- **Priority:** Medium

---

## J. `/admin/pilot` and `/admin/evidence`

### 35. The evidence capture form is a 13-field wall above the ledger it produces
- **File(s):** `app/admin/evidence/page.tsx:51-154` — four field groups (`md:grid-cols-2 xl:grid-cols-4`, `lg:grid-cols-2` with four `Textarea`s, `md:grid-cols-3`, then a `sm:grid-cols-[minmax(0,1fr)_220px_auto]` footer).
- **Current UX/UI Problem:** one always-expanded form with 13 controls including four textareas, roughly 900-1,100px, rendered *above* the "Evidence ledger" the operator usually came to read. There is no step structure, no draft indication, and the merchant-approval checkbox — the legal gate — is a 16px native checkbox in the footer row (`:136-143`).
- **Why It Is a Problem:** capture is occasional and reading is frequent, yet the frequent task sits below a screen of form. The approval gate carries the least visual weight on the page despite being the highest-consequence control.
- **Recommended Redesign:** put capture behind a "Capture an evidence case" button opening a `Sheet`, or split into `Ledger | Capture` tabs with Ledger default. Inside, use three steps (Subject & window -> Narrative -> Sources & approval) with `Eyebrow` step headers and `.w-rule` separators, and promote the approval gate into a bordered `StatusBanner tone="warning"` with a proper `Checkbox`.
- **Priority:** High

### 36. Evidence ledger cards bury a long narrative inside a stacked `dl`
- **File(s):** `app/admin/evidence/page.tsx:163-207` (`lg:grid-cols-2` of `AdminRecordCard`, an `After` field carrying up to 1,200 characters, plus a `Reproducibility` field concatenating version + truncated hash + date).
- **Current UX/UI Problem:** `AdminRecordCard` renders every `dd` at `text-muted-foreground` (`record-card.tsx:66`), so a 1,200-character narrative prints as muted body text in a label/value list, and `metric_snapshot_hash.slice(0, 12)...` is plain text rather than an `AdminIdChip`, so it cannot be copied.
- **Why It Is a Problem:** the card format is designed for short values; a paragraph in a `dd` produces wildly uneven heights in a 2-col grid and unreadable hierarchy, and the reproducibility handle is unusable.
- **Recommended Redesign:** give the narrative its own block below the `dl` (foreground colour, `text-sm leading-6`, `line-clamp-4` plus a "Read more" disclosure), render the hash via `AdminIdChip`, and add a `body` slot to `AdminRecordCard` for exactly this.
- **Priority:** Medium

### 37. The pilot note form is a fixed 4-track grid inside a nested card
- **File(s):** `components/admin/pilot-note-fields.tsx:37-84` (`sm:grid-cols-2 xl:grid-cols-[220px_160px_minmax(0,1fr)_auto]`), mounted at `app/admin/pilot/page.tsx:178-188` inside `AdminRecordActions` inside `AdminRecordCard` inside `ShowMoreList` inside `AdminPanel`.
- **Current UX/UI Problem:** `xl:` is a viewport query but the element sits four containers deep: at a 1280px viewport the available width is roughly 900px minus panel `p-5`, card `p-4` and disclosure `px-3`, about **820px**, into which the rule asks for `220 + 160 + 1fr + auto`. A `Textarea rows={2}` then sits beside a `min-h-11` select and a number input, so baselines do not align.
- **Why It Is a Problem:** the layout switches to its widest form exactly when it least fits, and the submit lands `xl:self-end` against a two-row textarea. Same root cause as finding 1.
- **Recommended Redesign:** container queries (`@container` on the disclosure body, `@2xl:grid-cols-[minmax(0,14rem)_minmax(0,10rem)_minmax(0,1fr)_auto]`) with `items-end` on the track; or simply keep two columns and let the textarea span.
- **Priority:** Medium

### 38. Pilot page mixes three list idioms on one screen
- **File(s):** `app/admin/pilot/page.tsx:43-57` (`MetricTile` grid), `:73-134` (`DataTable`), `:145-195` (`ShowMoreList` of `AdminRecordCard`s).
- **Current UX/UI Problem:** four KPI tiles, then a 4-column metrics table whose `Source` column is a pill per row (finding 17 again), then a card list with an embedded note form — three renderings of "a list of labelled values" inside about 2,500px.
- **Why It Is a Problem:** the operator re-learns the reading pattern three times, and the metrics table and KPI tiles show overlapping data in different shapes.
- **Recommended Redesign:** fold the checklist tiles and metrics table into one `DataTable` with a leading `StatusPill` for pass/fail, or keep tiles and demote the table to a `Details` disclosure; split notes onto a `Merchants` tab.
- **Priority:** Medium

---

## K. Security, MFA enrolment and step-up

### 39. The authenticator QR breaks the QR contract
- **File(s):** `components/admin/mfa-panel.tsx:105-110` (`className="h-44 w-44 rounded-xl bg-white p-2"`).
- **Current UX/UI Problem:** `rounded-xl` is `--radius + 4px` = 14px, there is no ink border, and `QrFrame` (`components/loyalty`) — the system's one QR treatment ("QR ink modules on a pure white, ink-bordered frame, in both themes") — is used nowhere in admin.
- **Why It Is a Problem:** a direct violation of a documented rule; in the dormant dark theme this QR has no frame separating white module ground from dark paper; and 14px is a third radius in a system that sanctions 10px and 18px.
- **Recommended Redesign:** wrap the `<img>` in `QrFrame` (or a `rounded-lg border-2 border-ink bg-white p-3` box if the frame API takes a matrix rather than an image) and size it at least 176px.
- **Priority:** High

### 40. The TOTP secret cannot be copied
- **File(s):** `components/admin/mfa-panel.tsx:111-113` (`<p className="font-mono text-xs break-all">Key: {enrollment.secret}</p>`).
- **Current UX/UI Problem:** a 32-character base32 secret printed as break-all mono text with no copy control, while every UUID in the console has one (`AdminIdChip`).
- **Why It Is a Problem:** manual transcription of a 32-character secret is the highest-error step of enrolment, and `break-all` mid-token wrapping makes it worse.
- **Recommended Redesign:** render through a copy affordance (an `AdminIdChip`-style button with a copy icon and the full value, `.mono-meta`, grouped in 4-character blocks) plus an explicit "Copy key" `Button variant="secondary" size="sm"`.
- **Priority:** High

### 41. Turning **off** two-factor is an outline button with no confirmation
- **File(s):** `components/admin/mfa-panel.tsx:47-58` (`<SubmitButton variant="outline" pendingLabel="Removing...">Turn off two-factor`).
- **Current UX/UI Problem:** the most security-weakening action in the console uses the neutral `outline` variant with no `AdminConfirmCheck`, no reason field and no confirm dialog — while cancelling a single customer reward requires a reason *and* a ticked consequence statement.
- **Why It Is a Problem:** consequence and friction are inverted across the console; one mis-click removes AAL2 from an admin account.
- **Recommended Redesign:** `variant="destructive"` plus `AdminConfirmCheck label="I understand admin sign-in will no longer require a code."` and a required reason written to the audit log, ideally inside an `AlertDialog`.
- **Priority:** Critical

### 42. Enrolment is a two-step machine with no step indicator, no back and no cancel
- **File(s):** `components/admin/mfa-panel.tsx:63-134` (`EnrollPanel` swaps its whole body when `enrollment.ok`).
- **Current UX/UI Problem:** pressing "Set up two-factor" replaces the card with "Scan and confirm". There is no "Step 1 of 2", no way back, no way to abandon a started enrolment, and the pending state is a hand-rolled `{starting ? "Starting..." : ...}` on a plain `Button` (`:91-93`) rather than the system `SubmitButton` recipe with its `Spinner`/`aria-busy`.
- **Why It Is a Problem:** an operator who cannot scan is trapped in the second state, and two pending idioms in one file mean one of them lacks the busy announcement.
- **Recommended Redesign:** add an `Eyebrow` step counter, a `Button variant="ghost">Back` that clears `enrollment`, and use `SubmitButton`/`useActionState` (or `Spinner` + `aria-busy`) for the begin action so all pending states match.
- **Priority:** Medium

### 43. The step-up wall has no escape hatch
- **File(s):** `components/admin/mfa-step-up.tsx:20-56`; gate at `app/admin/layout.tsx:40-42`.
- **Current UX/UI Problem:** when step-up is required this card is the only admin surface rendered. It offers a 6-digit field and "Verify" — no recovery-code path, no sign-out, no support or escalation link, and no indication of what happens after repeated failures.
- **Why It Is a Problem:** an operator with a lost or drifted authenticator has literally no next action inside the product, and cannot even end the session.
- **Recommended Redesign:** add a `Button variant="ghost"` sign-out beneath the submit, a "Use a recovery code" link (or an explicit escalation route), and a clock-skew hint. Keep the `max-w-sm` card but show the operator email as a `MonoTag` rather than mid-paragraph.
- **Priority:** High

### 44. The security page opts out of the console's page anatomy
- **File(s):** `app/admin/security/page.tsx:29-39` (`space-y-6`, hand-rolled `<header>` with `Eyebrow` "Security" and `h1 text-3xl`), `metadata = PRIVATE_ROUTE_METADATA` (`:10`); contrast every other admin route: `grid gap-6` + `<PageTitle eyebrow="Internal admin" ...>` + `metadata = { title: "Admin — ..." }`.
- **Current UX/UI Problem:** different spacing utility (`space-y` vs `grid gap`), different heading scale (`text-3xl` with no `sm:text-4xl`), a different eyebrow taxonomy, no description, and a generic tab title. `AdminMfaPanel` then uses `surface-card space-y-4 p-6` where `AdminPanel` is `surface-card grid gap-4 p-5`, with a `text-xl` heading where `SectionHeader` is `text-lg`.
- **Why It Is a Problem:** four small drifts compound into a page that visibly does not belong to the console, and the tab title makes it unfindable among several admin tabs.
- **Recommended Redesign:** `PageTitle eyebrow="Internal admin" title="Two-factor authentication" description="..."`, `grid gap-6`, `metadata = { title: "Admin — Security" }`, and rebuild both `AdminMfaPanel` states on `AdminPanel` + `SectionHeader`.
- **Priority:** Medium

### 45. The access-denied screen is a dead end
- **File(s):** `app/admin/layout.tsx:21-35`.
- **Current UX/UI Problem:** a `max-w-sm` card with "Access denied" and the raw `access.reason`, and no actions at all — no sign-in link, no sign-out, no route home, no support contact.
- **Why It Is a Problem:** the user is stranded and the reason string is developer-facing.
- **Recommended Redesign:** reuse `EmptyState` (which has an `actions` slot) with a primary "Sign in" and secondary "Back to home", keeping the technical reason as `.mono-id` "Reference:" text exactly as `app/admin/error.tsx:30-34` already does.
- **Priority:** Medium

---

## L. Shared admin components

### 46. Admin invents a second input story for `<select>`
- **File(s):** `components/admin/support.tsx:28-29` (`adminSelectClasses`), used at `privacy/data-request-workflow-panel.tsx:142,163,172`, `evidence/page.tsx:57,67,145`, `pilot-note-fields.tsx:44`; contrast `components/forms/select-field.tsx` (`data-slot="input"`, `h-12`, `appearance-none` plus the house chevron).
- **Current UX/UI Problem:** `adminSelectClasses` is a hand-rolled string (`min-h-11 rounded-lg border-2 border-ink bg-card px-3 text-sm`) with **no `data-slot="input"`**, **no `appearance-none`**, **no chevron**, **no `w-full`** and a different height (44 vs 48px) from `SelectField`. `DESIGN.md` states plainly: "Native selects compose through `SelectField`... do not hand-roll".
- **Why It Is a Problem:** admin selects show the OS chevron beside Wet Ink inputs that show the house one; they are 4px shorter than sibling `Input`s so rows do not baseline-align; without `w-full` a `<select>` sizes to its longest option, so the `grid-cols-2` pairs in the privacy form come out unequal; and the focus/`aria-invalid` rules keyed on `[data-slot=input]` never apply.
- **Recommended Redesign:** delete `adminSelectClasses` and use `SelectField` everywhere. If the console needs a 44px density, add a `size="sm"` variant to `SelectField` rather than a parallel string.
- **Priority:** High

### 47. `AdminField` is a second label system, and it folds helper text into the accessible name
- **File(s):** `components/admin/support.tsx:48-73` (`<label>` wrapping `<Eyebrow>` + control + helper `<span>`); contrast `components/forms/form-field.tsx` (`FieldLabel htmlFor`, `aria-describedby`, `aria-invalid` wiring).
- **Current UX/UI Problem:** admin action forms label with an 11.5px uppercase mono `Eyebrow` inside an implicit `<label>`, while `mfa-panel`/`mfa-step-up` on the same console use `FormField` with the normal `FieldLabel`. Because the helper `<span>` is *inside* the `<label>`, a screen reader announces "DELTA POSITIVE ADDS STAMPS, NEGATIVE REMOVES THEM" as the field name, and the helper is never exposed as a description.
- **Why It Is a Problem:** two label registers in one console; uppercase mono at 11.5px is the hardest legible form for dense data entry; and the a11y contract `FormField` exists to guarantee (`aria-describedby`, `aria-invalid` -> destructive border) is silently absent from every admin write form.
- **Recommended Redesign:** re-implement `AdminField` as a thin wrapper over `FormField` (passing `description` for the helper), keeping the compact visual if wanted but restoring `htmlFor`/`aria-describedby`/`aria-invalid`. At minimum move the helper out of the `<label>` and wire `aria-describedby` by hand.
- **Priority:** High

### 48. `AdminConfirmCheck` — the irreversibility gate — is a 16px native checkbox
- **File(s):** `components/admin/support.tsx:81-92` (`<input type="checkbox" className="focus-ring mt-0.5 size-4 shrink-0 accent-primary">`); same pattern at `evidence/page.tsx:136-143` for the merchant-approval gate.
- **Current UX/UI Problem:** the required consent control for QR regeneration and reward cancellation is a 16x16 native box styled only with `accent-primary`, with no `[@media(pointer:coarse)]` growth and no Wet Ink treatment (no ink border, no offset shadow).
- **Why It Is a Problem:** 16px fails the 44px tap floor on a control that gates irreversible actions; browser-default checkbox rendering is the one place the console falls back to an unstyled default; and a `required` checkbox with no client validation messaging fails quietly on submit in some browsers.
- **Recommended Redesign:** use the shadcn `Checkbox` primitive at `size-5` inside a `min-h-11 flex items-start gap-3` label row (so the whole row is the target), styled `border-2 border-ink data-[state=checked]:bg-primary`, and pair it with a `StatusBanner tone="warning"` for the consequence copy on the most severe actions.
- **Priority:** High

### 49. `AdminActionForm` hand-rolls success/error notices instead of using the system banner
- **File(s):** `components/admin/action-form.tsx:47-74`; contrast `components/loyalty/status-banner.tsx` (`bg-reward/12` / `bg-destructive/10`, 2px ink, semantic `Icon`).
- **Current UX/UI Problem:** the success `<p>` reproduces `StatusBanner`'s success classes by hand with no icon; the error `<p>` reproduces the error tone with no icon; and the download link is a third bespoke bordered treatment (`:56-66`).
- **Why It Is a Problem:** state now reads by colour alone (`DESIGN.md`: "state reads as icon + colour + copy, never colour alone"); the success wash is identical to the always-on MFA banner (finding 3); and three near-copies of one recipe will drift.
- **Recommended Redesign:** render `<StatusBanner tone="success"|"error" title={state.message} />` and turn the export link into a `Button asChild variant="secondary"` with a download icon. Additionally fire a `toast` — `sonner` is themed via `.cn-toast` and used **nowhere** in admin.
- **Priority:** High

### 50. Action results can be invisible after a revalidation
- **File(s):** `components/admin/action-form.tsx:38-42` (resets on success), rendered inside `components/admin/record-actions.tsx:24` (`Disclosure name={group}` — a native exclusive accordion).
- **Current UX/UI Problem:** the outcome message renders *inside* the collapsed disclosure of a record potentially thousands of pixels down the page; opening another record's panel closes this one (that is the point of the shared `name`), taking the confirmation with it. There is no page-level status region.
- **Why It Is a Problem:** the operator can perform an audited mutation and receive no perceivable confirmation, which for a support console is a correctness problem, not polish.
- **Recommended Redesign:** add the toast (finding 49) alongside the inline banner; scroll the disclosure summary into view on completion and stamp the record card with a transient `StatusPill tone="good">updated`.
- **Priority:** High

### 51. `AdminIdChip` truncation is unusable as an identifier, and copy feedback shifts layout
- **File(s):** `components/admin/id-chip.tsx:45-66`.
- **Current UX/UI Problem:** the chip shows `prefix:` + `value.slice(0, 8)` — 8 hex characters of a UUID — styled `underline decoration-dotted` (link-like) with no copy glyph. On success it *inserts* `<span>copied</span>` into the flex row, widening the control inside a `whitespace-nowrap` table cell. Sizing is `text-xs` mono, a third mono register beside `.mono-meta` and `.mono-id`.
- **Why It Is a Problem:** 8 hex characters is not collision-safe to quote in a GDPR or audit record; the dotted underline promises navigation and delivers a clipboard write; and the width change nudges neighbouring content on copy.
- **Recommended Redesign:** render `first8...last4` (`3fa9c1b2...7d0e`), add a leading 16px copy `Icon` so the affordance is explicit and drop the underline, and swap "copied" for a *fixed-width* icon change (copy -> check) so the box never resizes. Standardise on `.mono-meta` and make this the console's single id renderer (findings 24, 36).
- **Priority:** Medium

### 52. `AdminRecordCard` renders all values as muted, stacked and single-column
- **File(s):** `components/admin/record-card.tsx:57-74` (`dl grid gap-2.5`; `dd` always `text-muted-foreground`; `mono` fields `font-mono text-xs`).
- **Current UX/UI Problem:** every field is a two-line `dt`/`dd` stack, and every value — merchant names, emails, stamp counts, narratives — takes `--muted-foreground`. Only the title escapes. There is no emphasis mechanism, no inline layout for short values and no slot for prose.
- **Why It Is a Problem:** with 5-11 fields (privacy, billing, evidence) the card is a wall of uniform grey with flattened hierarchy, and each field costs about 44px — which is why billing cards reach 800px (finding 22).
- **Recommended Redesign:** add (a) `emphasis?: boolean` per field so the primary value renders `text-foreground font-semibold`; (b) `layout?: "stacked" | "inline"` defaulting to inline at `@sm` (`grid-cols-[minmax(0,8rem)_1fr] items-baseline gap-x-3 gap-y-2`), which alone halves card height; (c) a `body` slot for prose. Use `.mono-meta` rather than `font-mono text-xs` for `mono` fields.
- **Priority:** High

### 53. `AdminRecordActions` disclosure uses an off-contract dashed tone
- **File(s):** `components/admin/record-actions.tsx:24` -> `components/merchant/launch/disclosure.tsx:38-42` (`border-2 border-dashed border-ink/25 bg-secondary/40`).
- **Current UX/UI Problem:** a 2px dashed rule at 25% ink. The contract sanctions exactly two dashed tones: `--w-line` (18%) and `--w-line-strong` (50%).
- **Why It Is a Problem:** a third dashed tone in the most-repeated admin chrome (it wraps every per-record action on six routes), so the drift is systemic rather than local.
- **Recommended Redesign:** `border-line` for the resting disclosure and `border-line-strong` when open — both already minted as `--color-line` / `--color-line-strong`.
- **Priority:** Low

### 54. Panel headers carry instructional paragraphs that never collapse
- **File(s):** `privacy/data-request-workflow-panel.tsx:50` (about 250 characters), `customer-memberships-panel.tsx:45`, `merchants/page.tsx:128`, `evidence/page.tsx:46`, `pilot/page.tsx:63`.
- **Current UX/UI Problem:** every panel prints a two-to-three-line procedural description (`max-w-2xl text-sm leading-6`) on every load, forever, to operators who have read it a hundred times. On the privacy page alone that is about 200px of instruction.
- **Why It Is a Problem:** onboarding copy permanently taxing expert users; it pushes the actual controls below the fold and makes `SectionHeader`'s `sm:items-end` alignment put the source pill at an awkward baseline.
- **Recommended Redesign:** keep one short descriptive line and move procedure into a `Disclosure label="How this works"` or an icon-triggered popover beside the title. Give sibling panels one length budget (about 90 characters).
- **Priority:** Medium

### 55. Lookup controls have no pending state and shift layout on clear
- **File(s):** `components/admin/lookup-controls.tsx:32-68`.
- **Current UX/UI Problem:** the `next/form` submit triggers a navigation with no pending affordance (no `useFormStatus`, no `SubmitButton`); the `Clear` ghost button appears only when a filter is active (`:62-66`), so the button row width changes as the operator searches; and there is no "N results for ..." summary near the controls (the count lives in `AdminLookupPagination` far below).
- **Why It Is a Problem:** on a service-role readback that can take a second the operator gets no feedback and will re-submit, and the appearing/disappearing button is a small constant instability.
- **Recommended Redesign:** use `SubmitButton pendingLabel="Searching..."`; always render `Clear`, `disabled` when no filter is active; render applied filters as dismissible chips plus a result count immediately under the form.
- **Priority:** Medium

### 56. Pagination is Previous/Next only, with no page jump and no page-size control
- **File(s):** `components/admin/lookup-controls.tsx:77-147`; `ADMIN_LOOKUP_PAGE_SIZE = 25`, `ADMIN_LOOKUP_MAX_PAGE = 999` in `lib/admin/lookup-query.ts`.
- **Current UX/UI Problem:** with 25 rows per page and up to 999 pages, navigation is one step at a time; the disabled ends render as greyed `size="sm"` buttons; and `justify-between` splits the count line and the buttons to opposite ends of a panel that can be 900px wide.
- **Why It Is a Problem:** reaching page 40 takes 39 round trips, and the split layout forces the eye across the panel to confirm the current page after every press.
- **Recommended Redesign:** add first/last controls and a numeric "Go to page" input, group the count with the controls on the right, and add a rows-per-page select (25/50/100) wired to a `size` query param. Keep the link-based approach — that part is right.
- **Priority:** Medium

### 57. The `p-0` panel override and the "de-styled EmptyState" are copied incantations
- **File(s):** `AdminPanel className="p-0"` + inner `border-b p-5` at `customer-memberships-panel.tsx:41-42`, `customer-rewards-panel.tsx:37-38`, `consent-log-panel.tsx:30-31`, `merchants/page.tsx:124-125`, `audit/page.tsx:35-36`, `billing/page.tsx:78-79`, `pilot/page.tsx:59-60`. `EmptyState className="rounded-none border-0 p-0 shadow-none"` (or the `p-0`-less variant) at `page.tsx:121`, `data-request-workflow-panel.tsx:78,86`, `unaffiliated-customers-panel.tsx:65,73`, `logged-requests-panel.tsx:50`, `merchants/page.tsx:261`, `fraud-flags-panel.tsx:65`, `redemption-failures-panel.tsx:41`, `pilot/page.tsx:200`, `customer-memberships-panel.tsx:71,78`, `customer-rewards-panel.tsx:60`.
- **Current UX/UI Problem:** two de-styling strings copied 7 and 11+ times with inconsistent membership — `p-0` is present in some and absent in others, so the flush/padded empty state differs between panels.
- **Why It Is a Problem:** any change to the panel or empty-state recipe must be made in eighteen places, and the inconsistency is already visible (some empty states are inset by `p-6`, some are flush).
- **Recommended Redesign:** add `AdminPanel` variants — `<AdminPanel variant="flush">` rendering `p-0` with an `<AdminPanelHeader>` owning `border-b-2 border-ink p-5` — and an `EmptyState variant="inline"` that drops border/shadow/radius. Delete every ad-hoc override.
- **Priority:** Medium

### 58. Action-column naming differs on every table
- **File(s):** `customer-memberships-panel.tsx:182` ("Audited action"), `customer-rewards-panel.tsx:156` ("Audited action"), `fraud-flags-panel.tsx:123` ("Review"), `billing/page.tsx:182` ("Controls"), `merchants/page.tsx:294` ("QR controls" as a disclosure label).
- **Current UX/UI Problem:** four labels for one column concept, and the disclosure labels differ again ("Adjust stamps", "Cancel reward", "Privacy actions", "Fulfilment controls", "Review actions", "QR controls").
- **Why It Is a Problem:** the operator cannot build one mental model of where actions live, and the column header is the only per-table hint that a row is actionable.
- **Recommended Redesign:** one header word — `Actions` — across every admin table, with the specific verb reserved for the disclosure/button label inside the cell.
- **Priority:** Low

---

## M. `components/data` — shared data display

### 59. Table cells inherit `whitespace-nowrap`, so no admin table can wrap
- **File(s):** `components/ui/table.tsx` `TableCell` (`"p-2 align-middle whitespace-nowrap"`); `components/data/data-table.tsx:149-157` overrides padding (`px-4 py-3 align-top text-sm`) but **not** the nowrap.
- **Current UX/UI Problem:** every cell in every admin table is nowrap. Long merchant names, emails, evidence sentences and the multi-line fulfilment cells widen the table until `overflow-x-auto` engages. The workaround already exists in the codebase: `components/admin/support.tsx:67` adds `whitespace-normal` to `AdminField`'s helper with a comment describing this exact bug ("inside a table cell the helper would inherit the cell's nowrap").
- **Why It Is a Problem:** this is the mechanical cause of horizontal scrolling across the console; with finding 1 the operator scrolls sideways at exactly the widths where table mode was chosen. A commented workaround at one call site proves the default is wrong.
- **Recommended Redesign:** set `whitespace-normal` in `DataTableCore`'s `TableCell` classes and opt *into* `whitespace-nowrap` per column via `column.className` (dates, ids, pills). Add `break-words` / `[overflow-wrap:anywhere]` for email and id columns.
- **Priority:** Critical

### 60. `DataTable` has no sorting, no `aria-sort`, no column control, no sticky header
- **File(s):** `components/data/data-table.tsx:15-20` (`DataTableColumn` has only `key`/`header`/`cell`/`className`), `:121-135` (header markup).
- **Current UX/UI Problem:** headers are inert text; nothing can be sorted by severity, date, status or amount on any admin table; there is no column-visibility control for the 7-column tables; and `TableHeader` does not stick inside the `overflow-x-auto` container, so on a 100-row audit table column meaning disappears after one screen.
- **Why It Is a Problem:** sorting is the second most basic table affordance after filtering; without it triage depends on the server having chosen the right order for every task, which it cannot.
- **Recommended Redesign:** add `sortable?: boolean` + `sortKey` to `DataTableColumn`, render sortable headers as `<button>` with `aria-sort="ascending|descending|none"` and a chevron `Icon`, driven by `?sort=`/`?dir=` params (consistent with the existing link-based lookup). Make `TableHeader` `sticky top-0 z-10 bg-secondary`. Add an optional column toggle for the wide tables.
- **Priority:** High

### 61. The table header applies two competing type recipes
- **File(s):** `components/data/data-table.tsx:124-132` — `TableHead` gets `text-xs font-extrabold whitespace-nowrap text-muted-foreground uppercase` **and** wraps its content in `<Eyebrow>` (`.eyebrow` = 11.5px Space Mono 700 uppercase muted, as a `<p>`).
- **Current UX/UI Problem:** the `th` sets a 12px Bricolage uppercase style that the nested `<p class="eyebrow">` then overrides to 11.5px mono; a block `<p>` inside a `<th>` also defeats the `h-10` vertical centring.
- **Why It Is a Problem:** dead, contradictory styles that will mislead the next editor, plus one extra element per header cell.
- **Recommended Redesign:** keep `<Eyebrow>` and drop the four conflicting `th` classes, or apply `.eyebrow` directly to the `th` and remove the wrapper element.
- **Priority:** Low

### 62. The horizontal scroll region is unlabelled and unsignposted
- **File(s):** `components/ui/table.tsx` (`<div data-slot="table-container" className="relative w-full overflow-x-auto" tabIndex={0}>`), consumed at `data-table.tsx:118`.
- **Current UX/UI Problem:** the scroll container is focusable (good) but has no `role="region"`/`aria-label`, and there is no visual signal that content continues to the right — no edge fade, no shadow, no hint.
- **Why It Is a Problem:** screen-reader users land on an unnamed focusable div; sighted users may never discover the hidden columns, which on the billing and fraud tables include the action controls.
- **Recommended Redesign:** pass `role="region"` + `aria-label={caption}` from `DataTable` (the caption string already exists) and add a right-edge gradient mask that disappears at scroll end — the one sanctioned functional gradient case.
- **Priority:** Medium

### 63. `mobilePageSize` is applied on 2 of 8 admin tables
- **File(s):** set at `consent-log-panel.tsx:47` and `audit/page.tsx:44`; **absent** on `customer-memberships-panel`, `customer-rewards-panel`, `merchants`, `billing`, `fraud-flags-panel`, `redemption-failures-panel`, `referral-ops-panel`. The prop is documented at `data-table.tsx:67-74` explicitly to prevent "a ~9,000px page at 375px".
- **Current UX/UI Problem:** the mitigation exists and is inconsistently applied — billing (100 rows x about 800px cards) and merchants (100 rows) are the worst offenders and have none.
- **Why It Is a Problem:** the phone experience of the console varies by an order of magnitude between routes for no reason.
- **Recommended Redesign:** default `mobilePageSize` to `10` inside `DataTable` and let call sites opt out rather than in; extend the same reveal to the tablet card path, since `cardBreakpoint="xl"` means tablets get cards too.
- **Priority:** High

### 64. `ShowMoreList` reveals but never collapses
- **File(s):** `components/data/show-more-list.tsx:38-67`.
- **Current UX/UI Problem:** `visibleCount` only increases — there is no "Show fewer" — so an operator who expands 100 pilot merchants must reload to recover their scroll position. The `role="status"` count sits *below* the button, and the button is `w-full sm:w-auto` centred, so on desktop it floats mid-panel.
- **Why It Is a Problem:** one-way progressive disclosure turns a bounded page into an unbounded one with no undo.
- **Recommended Redesign:** add a `Show fewer` secondary control once `visibleCount > initialCount`, move the "Showing X of Y" count inline to the left of the button (`flex items-center justify-between`), and prefer real pagination on the admin routes since the server already supports it.
- **Priority:** Medium

### 65. `ActivityFeed` rows have no action slot, and the SLA feed cannot be acted on
- **File(s):** `components/data/activity-feed.tsx:61-105` (`grid gap-2 p-4 sm:grid-cols-[1fr_auto]`); consumer `app/admin/privacy/logged-requests-panel.tsx:40-52`.
- **Current UX/UI Problem:** below `sm` the timestamp drops beneath the content instead of staying right-aligned; each row is `p-4` with no compact mode; and there is no row-level link or action slot, so the privacy panel can show an **overdue** GDPR request with no way to act on it.
- **Why It Is a Problem:** an SLA-tracking surface whose overdue item is not clickable forces the operator to scroll back to the workflow panel and re-find the subject by hand.
- **Recommended Redesign:** add an optional `action`/`href` per item rendered as a right-aligned `Button variant="link" size="xs"`, plus a `density="compact"` variant (`p-3 gap-1`) for admin feeds. Keep the dashed `[&>li+li]:border-t-2 border-line` separators — those are on contract.
- **Priority:** Medium

### 66. `FunnelChart` bars carry no proportion label and clamp silently
- **File(s):** `components/data/funnel-chart.tsx:26-49` (`Math.max((item.value / max) * 100, 4)`).
- **Current UX/UI Problem:** every bar is normalised to the largest step and clamped to a 4% minimum, but only the absolute count is printed — no percentage of previous step, no drop-off. A step of 1 out of 400 renders identically to a step of 16.
- **Why It Is a Problem:** on the admin overview this is the primary activation-analysis instrument and it cannot answer "where do merchants fall out?".
- **Recommended Redesign:** print `value` plus `down n% from previous` in `.mono-meta` on each row, and mark clamped bars (a hairline tick at true position) so a floored bar is not read as real volume.
- **Priority:** Medium

### 67. `StatStrip` is unused by admin despite being the densest KPI option
- **File(s):** `components/data/stat-strip.tsx:36-76`; admin uses `MetricTile` at `page.tsx:59-75` and `pilot/page.tsx:43-57`.
- **Current UX/UI Problem:** `StatStrip` packs four values into a single ruled card about 90px tall; a `MetricTile` grid costs about 130px per row plus gaps, and considerably more on the pilot page where each tile carries `helper` content.
- **Why It Is a Problem:** the console pays a large height premium for its summary rows while a denser, already-designed, already-themed alternative sits in the same folder.
- **Recommended Redesign:** use `StatStrip` for the admin overview counters and the pilot checklist; reserve `MetricTile` for tiles that genuinely carry helper or trend content.
- **Priority:** Low

---

## N. Developer-facing surfaces

### 68. `/dev/design-system` is a 992-line single scroll with no table of contents
- **File(s):** `app/dev/design-system/page.tsx:183-190` (`mx-auto grid w-full max-w-6xl gap-12 px-6 py-10`), nine `<Section id=...>` blocks (`tokens`, `typography`, `surfaces`, `forms-feedback`, `iconography`, `motion`, `loyalty`, `console-viz`, `console-data`).
- **Current UX/UI Problem:** every section already carries an `id` and `scroll-mt-6`, but **nothing on the page links to them** (count of `href="#...">` on the page: 0). The catalogue is roughly 15,000px with `gap-12` between sections, no sticky nav, no section index, no search and no back-to-top.
- **Why It Is a Problem:** the file describes itself as "the acceptance gate for the foundation layer", yet finding the button sizes or the loyalty states means scroll-hunting. The anchors exist purely for external deep links.
- **Recommended Redesign:** add a sticky left rail (`lg:grid-cols-[200px_minmax(0,1fr)]`, `sticky top-6`) listing the nine sections with `aria-current` on the in-view one, plus a compact chip row on mobile (reuse `FilterPills` or `ConsoleSidebarNav` markup), and a back-to-top affordance per section.
- **Priority:** High

### 69. The catalogue's console section demonstrates the wrong breakpoint
- **File(s):** `app/dev/design-system/page.tsx:889-960` — the section description says "Admin consoles use **xl**...", the eyebrow at `:896` says "Responsive DataTable . admin **xl** cards", but the `DataTable` at `:897-960` passes **no `cardBreakpoint`**, so it renders the `sm` default.
- **Why It Is a Problem:** the one live reference for the admin table pattern demonstrates behaviour contradicting its own caption and the `DESIGN.md` contract; a developer copying from the catalogue ships the wrong breakpoint.
- **Recommended Redesign:** pass `cardBreakpoint="xl"` and `mobilePageSize={10}`, and show both switches side by side with labels ("sm — compact tables" / "xl — admin consoles").
- **Priority:** High

### 70. The catalogue does not document the admin vocabulary it is supposed to gate
- **File(s):** `app/dev/design-system/page.tsx` imports only `AdminRecordCard` (`:22`) and `StatusPill` (`:23`) from the admin layer.
- **Current UX/UI Problem:** `AdminPanel`, `AdminField`, `adminSelectClasses`, `AdminIdChip`, `AdminRecordActions`, `AdminConfirmCheck`, `AdminLookupControls`, `AdminLookupPagination`, `AdminLookupErrorState`, `SourceLabel`, the four `StatusPill` tones, `AdminActionForm`'s success/error/download states and the admin loading/error states appear nowhere in the catalogue.
- **Why It Is a Problem:** every drift in this report — two select stories, two label systems, four rule tones, three mono registers, inverted destructive semantics — is a direct consequence of the console's own vocabulary having no reference surface, while the catalogue calls itself the acceptance gate.
- **Recommended Redesign:** add a tenth `<Section id="admin">` covering panel anatomy (header/flush), the four `StatusPill` tones beside `SourceLabel`, `AdminField` vs `FormField`, the select treatment, `AdminIdChip` rest/copied, `AdminRecordActions` open/closed, the destructive recipe (reason + confirm + variant), lookup + pagination + error state, and the admin loading skeleton.
- **Priority:** High

### 71. The app harness has no index and its navigation leaves the harness
- **File(s):** `app/dev/app-harness/layout.tsx:93-102` mounts the real `MerchantAppShell`; `components/layout/console-nav.ts merchantNavItems` point at `/app`, `/app/customers`, ... There is no `app/dev/app-harness/page.tsx` and no `app/dev/page.tsx`.
- **Current UX/UI Problem:** `/dev` and `/dev/app-harness` both 404, so the developer must already know the 19 lane URLs. Once inside a lane, every sidebar item links to the **real** authenticated `/app` route, so one click ejects the developer out of the harness and into a login redirect.
- **Why It Is a Problem:** the harness exists to make surfaces screenshot-provable, and its own navigation actively breaks that workflow; discovering which lanes exist requires reading the file tree.
- **Recommended Redesign:** add `app/dev/page.tsx` and `app/dev/app-harness/page.tsx` index pages listing every lane as link cards grouped by surface, documenting the `?w=` width override (`app/dev/layout.tsx:51-79`) and `?sidebar=collapsed` — neither of which is surfaced anywhere. Pass a `basePath`/`hrefResolver` into `ConsoleSidebarNav` so the harness rewrites `/app/x` -> `/dev/app-harness/x`.
- **Priority:** High

### 72. Harness pages have no in-page index either
- **File(s):** `app/dev/app-harness/skeletons/page.tsx:106-127` (12 sections, `grid gap-12`, `h2` at `font-mono text-sm break-all`), `app/dev/app-harness/states/page.tsx:152-167` (4 sections).
- **Current UX/UI Problem:** both pages use ids plus `scroll-mt-6` with nothing linking to them, and the skeletons page presents 12 entries with no filter or jump.
- **Why It Is a Problem:** the same class of problem as finding 68 at smaller scale; screenshotting one skeleton means scrolling past eleven.
- **Recommended Redesign:** a shared `HarnessIndex` component rendering a chip row of anchors at the top of every harness page (derivable from the same section list), plus `?only=<id>` to render a single section for clean screenshots.
- **Priority:** Medium

### 73. `/dev/app-harness/trial/admin` renders an admin surface with a fourth divider tone
- **File(s):** `app/dev/app-harness/trial/admin/page.tsx:29` (`border-y border-dashed border-ink/30 py-4 sm:grid-cols-3`), `:22` (`font-heading text-xl font-extrabold` heading instead of `SectionHeader`).
- **Current UX/UI Problem:** the harness mock of the billing/fulfilment panel introduces a fourth dashed tone (`ink/30`) and a bespoke `text-xl` heading, so the fixture does not match the surface it stands in for (`billing/page.tsx` uses `SectionHeader` and `border-b`).
- **Why It Is a Problem:** a harness whose fixture diverges from production yields false screenshot proof.
- **Recommended Redesign:** rebuild the fixture from `SectionHeader` + `.w-rule` + `AdminRecordCard` so the harness renders the same components as the real route.
- **Priority:** Low

### 74. Admin has no per-panel loading skeletons; the whole page waits on the slowest readback
- **File(s):** `app/admin/loading.tsx:9-28` (page title placeholder + **one** panel block), `app/admin/privacy/page.tsx:42-63` (`Promise.all` of four readbacks), `app/admin/customers/page.tsx:36-45` (two); contrast `components/merchant/loading-skeletons.tsx` which exports nine surface-shaped skeletons and is exercised at `app/dev/app-harness/skeletons`.
- **Current UX/UI Problem:** every `/admin/*` segment shares one fallback showing a single panel, while privacy shows four and customers two — so the paint-in shifts layout substantially. There are no `<Suspense>` boundaries per panel, so a slow consent readback blocks the membership lookup the operator actually wanted.
- **Why It Is a Problem:** perceived performance on the console is governed by its slowest query, and the layout jump on resolve is large.
- **Recommended Redesign:** wrap each panel in `<Suspense>` with an `AdminPanelSkeleton` (title line, description line, table/card block) so panels stream independently; add `AdminTableSkeleton` and `AdminRecordCardSkeleton` to a `components/admin/loading-skeletons.tsx` mirroring the merchant pattern, and render them in the harness for proof.
- **Priority:** High

---

## O. Cross-cutting patterns (repeated offenders)

1. **Viewport breakpoints used inside deeply nested containers.** `xl:*` utilities and `cardBreakpoint="xl"` are applied to elements sitting inside a 272px-narrower sidebar inset, a `p-5` panel, a `p-4` card and a `px-3` disclosure — `data-table.tsx:89-92`, `admin-shell.tsx:40+103`, `pilot-note-fields.tsx:39`, `data-request-workflow-panel.tsx:120`, `billing-fulfilment-actions.tsx:24`, `merchants/page.tsx:295`, `customer-memberships-panel.tsx:211`. **Fix once:** `@container` + container queries throughout the admin tree.
2. **Per-record write forms rendered expanded, everywhere.** Customers (stamps), customers (reward cancel), fraud (two forms per row), merchants (two QR forms), privacy (two forms), billing (three fulfilment forms), pilot (note form). Mobile folds them behind `AdminRecordActions`; desktop mostly does not. **Fix once:** one `AdminRowActions` pattern — a compact trigger plus row expansion/sheet — used identically in both modes.
3. **Panel-per-concern stacking instead of tabs.** Privacy (4), customers (2), fraud (2), merchants (2), pilot (3), evidence (2). None of these panels needs to be co-visible. **Fix once:** a `?view=`/`?panel=` segmented-view helper on top of `FilterPills`, keeping URLs linkable.
4. **Divider and dashed-tone zoo.** `border-b` (1px `--border`), `border-t border-ink/20`, `border-t-2 border-dashed border-ink/20`, `border-y border-dashed border-ink/30`, `border-2 border-dashed border-ink/25` — five treatments; `.w-rule` used zero times in admin.
5. **Two of everything in forms.** Two select stories (`SelectField` vs `adminSelectClasses`), two label systems (`FormField` vs `AdminField`), two pending idioms (`SubmitButton` vs hand-rolled `starting ? ...`), two feedback treatments (`StatusBanner` vs `AdminActionForm`'s hand-rolled `<p>`s), three mono registers (`.mono-meta`, `.mono-id`, `font-mono text-xs`).
6. **Copied de-styling strings.** `AdminPanel className="p-0"` + `border-b p-5` (7x), `EmptyState className="rounded-none border-0 p-0 shadow-none"` (11x+), the cross-link `focus-ring rounded-sm font-semibold text-primary underline underline-offset-2 hover:text-[color-mix(...)]` string (2 files, 6 instances).
7. **Hard `.limit(100)` with no total and no pagination.** Merchants, QR codes, audit, fraud flags, redemption failures, referrals, pilot merchants. The operator is never told the list is truncated.
8. **Colour carrying meaning it cannot carry.** `StatusPill` warning (`bg-primary/15`) vs danger (`bg-destructive/15`) at ~1.1:1; `StatusPill neutral` vs `SourceLabel` identical; referral success rendered neutral.
9. **Tap targets below the 44px floor on consequential controls.** `AdminConfirmCheck` (16px), evidence approval checkbox (16px), merchant/billing cross-links (~16px), `AdminIdChip` (has a coarse-pointer floor — the correct pattern the others should copy).
10. **No sorting, filtering, bulk action, toast, or command palette anywhere in the console** — the four affordances that define a back-office are all absent, while `FilterPills`, `sonner`, `Sheet` and `AlertDialog` all exist in the codebase, unused by admin.

---

## P. Top 5 highest-impact changes

1. **Collapse per-row forms into row expansion (findings 10, 11, 28).** Replacing three inline-form columns with a compact trigger plus one expanded row removes an estimated **~30,000px** from `/admin/customers` and `/admin/fraud` alone, restores scan-ability, fixes the destructive-safety problem, and makes the tables usable at 960px.
2. **Convert stacked panels to URL-driven tabs (findings 12, 13, 18, 32, 35, 38).** `/admin/privacy` drops from ~13,500px to roughly one screen plus one list; merchants, customers, fraud, pilot and evidence each halve. One paginator, one filter and one mental model per view.
3. **Fix the width story: collapsible sidebar + container queries + wrapping cells (findings 1, 2, 59, 60, 62).** These four together end horizontal scrolling in the console, which currently affects every table at the most common admin viewport, and unlock sticky headers and sorting.
4. **Give every list a filter, a total and pagination — and add a global lookup (findings 6, 21, 26, 31, 63).** Five routes currently offer no way to find a record and silently truncate at 100. This is the single largest functional gap for day-to-day support work.
5. **Repair destructive-action and feedback semantics (findings 19, 29, 41, 48, 49, 50).** Invert the QR variants, move `warning` off vermillion, make "Turn off two-factor" destructive-and-confirmed, replace the 16px native checkbox, and route every action outcome through `StatusBanner` plus a `toast`. Today the console can perform an irreversible action and show no perceivable confirmation, and its colour system points the wrong way on severity.



# E. Design System, Primitives, Shells & Accessibility

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

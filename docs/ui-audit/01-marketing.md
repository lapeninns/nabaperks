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

| Surface                       | Composition                             | Est. mobile height                  |
| ----------------------------- | --------------------------------------- | ----------------------------------- |
| `/` (landing)                 | 8 bands + footer                        | **≈ 5,400 px ≈ 8 viewports**        |
| `/how-it-works`               | 8 bands + footer                        | **≈ 4,600 px ≈ 7 viewports**        |
| `/pricing`                    | 6 bands + footer                        | **≈ 3,500 px ≈ 5 viewports**        |
| `/loyalty-for-pubs`           | hero + 8 guide sections + footer        | **≈ 8,500–9,000 px ≈ 13 viewports** |
| `/privacy`                    | 12 clauses, single 880 px measure       | **≈ 3,200 px**                      |
| Marketing footer (every page) | 4 link columns @ `min-h-11` + legal row | **≈ 620–660 px**                    |

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
  It is also, per finding 1, currently the _only_ navigation on a phone — so the site's nav is a
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
  itself "the page's first break in rhythm" — but it is the _second_ consecutive fact strip.
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
  `{PLAN_LINE} {OFFER.riskFraming}` — `OFFER.riskFraming` is _also_ the description of
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
  - caption) stack full-width at every width below `lg`. Each beat's visual is capped at
    `max-w-[11rem]` / `max-w-[13rem]` and centred via `grid flex-1 place-items-center`, so on a 768 px
    tablet you get three 176 px objects floating in 768 px of white space over ~900 px of scroll.
- **Why It Is a Problem:** this is the page's _one dominant composition_ per its own docblock, and it
  is the single tallest band on `/`. Three tiny centred glyphs stacked vertically read as three
  unrelated illustrations, not one three-beat sequence — the horizontal relationship _is_ the
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
- **Current UX/UI Problem:** eleven layouts in scope use `lg:` (1024 px) as their _first_ column
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
  10 px Space Mono, uppercase, tracked — carrying _"Card required — cancel renewal anytime after a
  short exit review from your billing page."_ In `growth-plan-pricing.tsx` the `FinePrintStrip`
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
  _kinds_ of information given identical visual weight and a uniform 24 px gap, so there is no
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
  `ScarcityBand` (which is right below it and is _about_ the cap) own `capLine`/`capReason`; keep
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
  vertical read where the whole point is _lateral comparison_. A reader cannot hold "what your guest
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
  question the reader is meant to _ask a vendor_) is bare text on the page ground; the right cell
  (our answer) is `rounded-lg border-2 border-ink bg-card p-3.5` — a bordered card with a lighter
  ground. The answer column is also the _wider_ one (6fr vs 5fr).
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
  dashed caption bar _below_ the card. Fewer grounds, ~90 px shorter, and the card stays the hero.
- **Priority:** Medium

### 54. Five different page-title scales across six page types

- **File(s):** `hero.tsx:30` (`text-4xl sm:text-6xl`); `process-hero.tsx:38` (same);
  `pub-guide-hero.tsx:43` (`text-3xl sm:text-5xl`); `components/brand/typography.tsx:69`
  (`text-3xl sm:text-4xl`); `app/terms/page.tsx:64`, `privacy/page.tsx:65`,
  `legal-document-page.tsx:56` (`text-[clamp(2.1rem,4.5vw,3.2rem)]`)
- **Current UX/UI Problem:** the H1 renders at 36→60 px on `/` and `/how-it-works`, 30→48 px on
  `/loyalty-for-pubs`, 30→36 px on `/pricing`, `/faq`, `/about`, `/demo`, and a fluid 33.6→51.2 px on
  the five legal pages — the legal H1 is therefore _larger_ than the pricing page's H1 on desktop.
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
  three page families a user moves between, and the one with the _most_ prose has none. The
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

### 63. The table of contents renders _below_ the document on mobile

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
- **Why It Is a Problem:** hierarchy is inverted: the heading is 2.5 px _smaller_ than the text it
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

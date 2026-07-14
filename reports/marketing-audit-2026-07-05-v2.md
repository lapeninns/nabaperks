# Marketing & Landing Audit — 2026-07-05 (v2, deep pass)

Second audit of the day, run against the **uncommitted working tree** (the morning
fix pass is staged but not committed). `reports/marketing-audit-2026-07-05.md` is
the morning baseline this report regresses against — hence the `-v2` filename;
the baseline was deliberately not overwritten.

Scope: all 12 indexable marketing routes, source + rendered HTML (dev server),
JSON-LD graph, cross-route duplicate-sentence analysis, mobile scroll
measurement at 375×812 (Playwright), and the full verification-gate suite.
Audit only — no fixes applied.

## Executive summary

The conversion-spine restructure has landed well: `/` is a tight 7.7 mobile
screens with zero broken anchors, every FAQ/HowTo schema slice is byte-synced to
visible copy, the cancellation-terms invariant holds on all 12 routes, and five
of the morning GEO audit's quick wins (guide dates, guide stats, footer guides
cluster, `poweredByHeader`, `/demo` robots) are already resolved in the tree.
The two real defects found are both invisible to the current guards: the
**pub hub emits a HowTo at home's reserved `@id` with different step text**
(a cross-page schema collision `jsonld:check` doesn't test for), and
**`/signup` — an indexable, sitemap-listed route — has no metadata export at
all** (inherited 212-char description, no canonical while accepting `?email=`
params). The biggest structural cost is spoke cloning: after reading any one of
cafe/bar/takeaway, a second spoke offers only ~2.5–3 new screens out of 9 —
~6.0 screens (4,910px) of the tail are byte-identical — which is
intentional-by-spec today but worth a deliberate trim decision.

## Scorecard

| Lens | Score /100 | Top issue |
|------|-----------|-----------|
| Redundancy & IA | 74 | Cafe/bar/takeaway tails byte-identical for ~6.0 of 9.0 mobile screens |
| SEO | 80 | `/signup` indexable with no metadata/canonical; `/about` description 161 chars |
| GEO / AI citability | 84 | HowTo `@id` collision `/` ↔ `/loyalty-for-pubs`; llms.txt "Rivals…" overclaim |
| Conversion & copy | 86 | Spoke close stacks 3 CTA bands back-to-back; wording drift in plan-includes teaser |
| E-E-A-T & trust | 83 | "9 independent pubs" quotes lack operator-relationship disclosure on `/how-it-works` |
| Design & UX | 88 | Spoke repeat fatigue on multi-spoke journeys; otherwise density discipline holds |
| Accessibility | 92 | Nothing broken found; native `<details>`, skip link, `aria-pressed` chips all present |
| Code quality | 84 | `jsonld:check` misses hub `@id` + 2 of 3 guides; the retired methodology check rejected `reports/` |

## Section matrix

Mobile screens measured at 375×812; words = rendered visible text.

| Route | Words | Screens | Sections (in order) | `/signup` CTAs |
|---|---|---|---|---|
| `/` | 1,228 | 7.7 | Hero · CounterFlow · Proof (strip+index body) · VenuePersonas · TrustPricing · FAQ×4 · FinalCta | 5 (hero, pricing card, close, header, footer) |
| `/how-it-works` | 2,152 | 9.9 | Page header · CounterFlow · ComparisonTable · CounterVerifiedStamp · LandingProof (3 tabs) · VenueBenefits · SeparateMarketing · FAQ×8 · FinalCta | 4 |
| `/pricing` | 503 | 3.1 | Receipt card · maths · after-day-30 · FAQ×5 | 4 |
| `/about` | 690 | 4.6 | Story+principles+operator card · VenueProof · estate grid · close | 3 |
| `/loyalty-for-pubs` | 1,446 | 10.0 | Hero+benefits · 5 pain points · PubCounterFlow · NabaperksProof · ComparisonTable · RegularsCalculator · guides rail · FinalCta | 5 |
| `/loyalty-for-cafes` | 1,363 | 9.0 | Hero+benefits · 5 pain points · CounterFlow · NabaperksProof · ComparisonTable · RegularsCalculator · mechanism cross-link · FinalCta | 5 |
| `/loyalty-for-bars` | 1,341 | 9.0 | (identical composition to cafes) | 5 |
| `/loyalty-for-takeaways` | 1,362 | 9.2 | (identical composition to cafes) | 5 |
| `/guides/best-loyalty-ideas-for-pubs` | 705 | 4.4 | Breadcrumb · header+dateline · 5 sections · hub link · related rail · FinalCta | 3 |
| `/guides/reward-regulars-without-an-app` | 702 | 4.3 | (same template, 5 sections) | 3 |
| `/guides/paper-vs-qr-loyalty-for-pubs` | 709 | 4.4 | (same template, 4 sections + table) | 3 |
| `/signup` | 300 | 2.3 | PageTitle+trust points · receipt form | — |

Heading hygiene: every route has exactly one H1, all unique, all
intent-matched. H2 order is logical everywhere; proof panels correctly demote
to h3 under shared h2s ([nabaperks-proof.tsx:26-30](components/marketing/landing/nabaperks-proof.tsx:26)).

## Copy overlap matrix

66 distinct sentences (≥45 chars) render on 2+ routes. Classified:

| Repeated copy | Routes | Tag |
|---|---|---|
| `PRODUCT.cancelLine` ("Card required — cancel anytime…") | ×12 (all) | **intentional-legal** — CI-enforced single source ([facts.ts:92](lib/marketing/facts.ts:92)) |
| FinalCta block ("Set up your venue this afternoon.") | ×9 | **intentional-chrome** — the close |
| Counter-Loyalty Index band + citable blockquote | ×6 | **intentional-proof** — same `@id`, byte-identical payload on all 6 |
| ComparisonTable (full table + wedge + intro) | ×5 (hiw + 4 spokes) | **intentional-by-spec / accidental-bloat cross-spoke** — see P1-3 |
| CounterFlow four beats | ×5 (`/`, hiw, 3 spokes) | **intentional** — HowTo byte-parity (PS-3) requires visible steps |
| RegularsCalculator | ×4 spokes | **intentional** — ungated tool, persona conversion asset |
| "The mechanism / How counter-verified stamps work." cross-link section | ×3, byte-identical ([cafes:207-222](app/loyalty-for-cafes/page.tsx:207), [bars:207-222](app/loyalty-for-bars/page.tsx:207), [takeaways:207-222](app/loyalty-for-takeaways/page.tsx:207)) | **accidental-template** — cheap to personalise |
| Persona hooks (home card ↔ spoke hero, verbatim ×4) | `/` ↔ each spoke | **intentional-teaser** — scent continuity |
| Home FAQ = first 4 of hiw's 8 | `/` ↔ hiw | **intentional-subset** (CS-3, schema-synced) |
| planIncludes teaser (4 items) vs pricing superset (5) | `/` ↔ `/pricing` | **intentional-teaser**, but wording drift — see P2-2 |
| Benefits bullet "Counter-verified stamps that can't be faked or double-claimed" | ×3 (pub, cafe, takeaway; bar has a variant) + `PRODUCT.posLine` ×4 heroes | **partial re-template** — see P2-6 |
| Guide proof sentence ("…46.8% of 1,842 loyalty members returned") | ×3 guides | **intentional-SEO** — lead-ins already vary; keep |
| VenueProof (9 pub quotes) | `/about` + hiw tab | **intentional** — E-E-A-T flagship + proof tab; disclosure gap, see P2-5 |
| "one stamp per customer per UK date" | ~10 surfaces | **intentional** — the anti-fraud catchphrase; brand rule, keep |

## Findings

### P0 — fix before ship

**None.** No banned claims, no legal/ASA contradiction, no schema fabrication,
no broken marketing links (the `/login` 500 is this machine's documented
env-gap — `.env.local` lacks customer-auth secrets since the 2026-07-04
environment split; CI carries them). The cancellation invariant renders
correctly on all 12 routes.

### P1 — high impact

1. **HowTo `@id` collision between `/` and `/loyalty-for-pubs`.**
   [howToSchema](lib/seo/structured-data.ts:212) defaults to
   `https://nabaperks.com/#how-it-works`, which the spine spec reserves for the
   home graph. Home emits it with `counterFlowSteps`; the pub hub calls
   `howToSchema(pubCounterFlowSteps)` with **no id override**
   ([loyalty-for-pubs/page.tsx:110](app/loyalty-for-pubs/page.tsx:110)), so the
   same entity URI carries two different step texts depending on the page
   crawled (step 1: "The permanent venue QR opens the card…" vs "A regular
   scans the permanent QR on the bar…"). Rendered-HTML diff confirms 2 distinct
   payloads at 1 `@id`. Answer engines that merge graphs get contradictory
   assertions about the same node — this dilutes exactly the citable-mechanism
   asset the site is built around. The three newer spokes do this correctly
   (`/loyalty-for-cafes#howto` etc.).
   **Fix:** pass `{ id: `${absoluteUrl(ROUTES.pubHub)}#howto` }` at
   [loyalty-for-pubs/page.tsx:110](app/loyalty-for-pubs/page.tsx:110), and add
   the missing hub `@id` assertion to
   [check-jsonld.mjs:265-270](scripts/check-jsonld.mjs:265) (the spoke blocks
   at [:286-292](scripts/check-jsonld.mjs:286) already assert theirs — the hub
   block is the one gap, which is why the guard is green today).

2. **`/signup` is indexable with no route metadata.**
   [signup/page.tsx](app/(auth)/signup/page.tsx) exports no `metadata`; there
   is no `(auth)/layout.tsx` supplying one. Rendered head: title = root default
   ("Nabaperks — No-app QR loyalty for UK food & drink venues"), description =
   root fallback at **212 chars** ([app/layout.tsx:37-38](app/layout.tsx:37)) —
   40% over the site's own 145–159 budget — **no canonical, no OG block**
   (1 og tag total). The route is in the sitemap at priority 0.7 by design and
   accepts `?email=` params ([signup/page.tsx:22-30](app/(auth)/signup/page.tsx:22)),
   so parameterised URLs have no canonical pointing back to `/signup`.
   **Fix:** add a metadata export — title ~"Start your free pilot", a 145–159
   description ending in `PRODUCT.cancelLine`, `alternates.canonical:
   ROUTES.signup`, OG/twitter matching the other routes. Zero design change.

3. **Spoke template cloning — the blunt numbers.**
   Cafe/bar/takeaway are one composition with copy-swapped heroes and pain
   points. Rendered-sentence analysis: cafe∩takeaway share **39 sentences
   (~844 words)**, cafe∩bar 38 (~833), bar∩takeaway 39 (~852) — out of ~54
   sentences per page. From `#how-it-works` (≈2,400px) to page bottom
   (≈7,300px), the three spokes are **byte-identical for ~4,910px ≈ 6.0 of
   9.0 mobile screens** (CounterFlow → NabaperksProof → ComparisonTable →
   RegularsCalculator → mechanism cross-link → FinalCta). A landlord who reads
   the cafe page then opens the bar page gets ~2.5–3 screens of new words.
   Against the pub hub the overlap is 28 sentences (~668 words, ~3.6 screens:
   proof + comparison + calculator). Per-route this is deliberate spec
   composition (PS-1 lists these components), and pain points/heroes ARE
   venue-true since the morning fix — the issue is only the shared tail on
   multi-spoke journeys and near-duplicate long-tail content signatures.
   **Recommendation** (needs an owner decision and matching contract-test
   change): replace **ComparisonTable** on the three spokes with a 2–3 sentence
   wedge + link to [/how-it-works#no-app](app/how-it-works/page.tsx) folded
   into the existing mechanism cross-link section (one band instead of two).
   Keeps HowTo/Dataset schema intact (PS-3 untouched — ComparisonTable carries
   no schema on spokes), saves ~1.3 screens per spoke (9.0 → ~7.7, matching the
   home spine), cuts the biggest duplication block, and strengthens
   `/how-it-works` as the single comparison authority. Keep the table on
   `/how-it-works` and the pub hub (flagship + PDF query spectrum). Do **not**
   trim CounterFlow (visible-copy ⇔ HowTo parity) or RegularsCalculator
   (unique interactive value).

### P2 — polish

1. **`/about` meta description is 161 code points** ([about/page.tsx:20](app/about/page.tsx:20)) —
   2 over the 145–159 budget the morning pass enforced on the other routes
   (verified by code-point count, avoiding the GEO report's byte/length false
   positive). Trim ~one word, e.g. drop "built and" → "run by".
2. **planIncludes drift between teaser and superset.**
   [trust-pricing.tsx:10-15](components/marketing/landing/trust-pricing.tsx:10)
   says "Weekly digest of visits and redemptions"; [pricing/page.tsx:54-60](app/pricing/page.tsx:54)
   says "Weekly digest of visits, regulars, and redemptions" — and that Oxford
   comma contradicts the site-wide "visits, regulars and redemptions" (e.g.
   [loyalty-for-pubs/page.tsx:94](app/loyalty-for-pubs/page.tsx:94)). The 4-vs-5
   item split is a fine teaser/superset; single-source the list in `facts.ts`
   with a slice, or at least align the digest wording.
3. **llms.txt overclaims vs visible copy.** [public/llms.txt:6](public/llms.txt)
   states "Rivals that say 'no app' still require an Apple/Google Wallet pass"
   (absolute); the visible claim is hedged — "**Most** 'no-app' loyalty cards…"
   ([comparison-table.tsx:138-140](components/marketing/landing/comparison-table.tsx:138)).
   llms.txt is the surface engines quote verbatim; align it to "Most rivals…".
4. **`/pricing` description is 109 chars** ([pricing/page.tsx:24](app/pricing/page.tsx:24)) —
   well under the 145 floor; ~50 chars of free SERP space for an
   included-features hook ("Unlimited stamps and members…").
5. **Operator-relationship disclosure on the "What pubs say" tab.**
   "What 9 independent pubs say about Nabaperks"
   ([venue-proof.tsx:27](components/marketing/landing/venue-proof.tsx:27)) is
   co-located with the operator story and estate grid on `/about`, but on
   `/how-it-works` "Lapen Inns" appears only in JSON-LD, never in visible copy.
   The quotes are from the operator's own estate; one mono-meta line ("All nine
   are run by Lapen Inns, the operator behind Nabaperks") makes the provenance
   ASA-watertight where the tab renders standalone. (Not re-flagging the
   paraphrased-signoff treatment itself — that's the approved design.)
6. **Benefits bullet re-templating (partial regression-shape).** Bullet 2
   "Counter-verified stamps that can't be faked or double-claimed" is identical
   on pub/cafe/takeaway ([cafes:86](app/loyalty-for-cafes/page.tsx:86),
   [takeaways:86](app/loyalty-for-takeaways/page.tsx:86),
   [pubs:93](app/loyalty-for-pubs/page.tsx:93)); bars got a venue-true variant
   ([bars:86](app/loyalty-for-bars/page.tsx:86)). The morning fix differentiated
   bullets 1/3/4 — finish the job on bullet 2 for cafe/takeaway.
7. **Same-page repetition on `/pricing`:** "Optional location checks can flag
   out-of-range/odd visits without blocking legitimate customers" appears in
   two FAQ answers ([pricing/page.tsx:69](app/pricing/page.tsx:69),
   [:77](app/pricing/page.tsx:77)) plus the plan list — 3× in 503 words.
8. **`reviewedByOperator` inconsistency.** Home, `/pricing`, pub hub attach
   `reviewedBy`/`author` = operator; `/about` — the operator page itself — does
   not ([about/page.tsx:58-64](app/about/page.tsx:58)). Add
   `reviewedByOperator: true` there (and consider `/how-it-works`).
9. **jsonld guard covers 1 of 3 guides** ([check-jsonld.mjs:333-350](scripts/check-jsonld.mjs:333))
   and asserts no Article dates. Loop all three guides and assert
   `datePublished`/`dateModified` now that they exist.
10. **Home title vs spoke ownership (owner call).** "No-App QR Loyalty Cards
    for UK **Pubs & Cafes**" ([app/page.tsx:32](app/page.tsx:32)) competes with
    the pub hub and cafe spoke titles for their head terms. Option: home takes
    the category term ("…for UK Venues" / "…for UK Food & Drink"), letting
    spokes own vertical queries. Mild cannibalisation risk, not a defect.
11. **Curly quotes in `counter-verified-stamp.tsx`** ([:64-65](components/marketing/landing/counter-verified-stamp.tsx:64),
    "not "mitigated"") — known cosmetic carryover from the morning pass.

## Redundancy verdict table

| Repeated element | Appears on | Verdict | Recommendation |
|---|---|---|---|
| ComparisonTable | /how-it-works + 4 spokes | intentional-by-spec, bloated ×3 | **Trim to link-wedge on cafe/bar/takeaway** (PS-1 amendment); keep hiw + pub hub |
| Mechanism cross-link section | 3 spokes, byte-identical | accidental-template | Personalise one sentence per vertical, or merge into comparison wedge |
| CounterFlow / PubCounterFlow | `/`, hiw, 4 spokes | intentional (HowTo parity) | Keep |
| NabaperksProof (index band) | 6 routes | intentional-proof | Keep — consistent payload is the point |
| RegularsCalculator | 4 spokes | intentional tool | Keep |
| FinalCta | 9 routes | intentional chrome | Keep; optionally guide-specific close on guides |
| FAQ 4-slice vs 8 | `/` vs hiw | intentional subset (CS-3) | Keep |
| planIncludes 4 vs 5 | TrustPricing vs /pricing | intentional teaser, drifting | Single-source in facts.ts, align wording |
| cancelLine | ×12 | intentional-legal | Keep (CI-enforced) |
| Persona hooks ↔ spoke heroes | `/` ↔ 4 spokes | intentional teaser | Keep |
| VenueProof | /about + hiw tab | intentional | Keep + disclosure line (P2-5) |
| Benefits bullet 2 / posLine | 3–4 spokes | partial re-template | Vary bullet 2 on cafe/takeaway |
| Guide proof sentence | 3 guides | intentional-SEO | Keep |

## Route-by-route notes

- **`/`** — Spine works: 7.7 screens (down from 13.4 pre-spine), 1,228 words,
  FAQ 4=schema 4 byte-synced, all three surviving anchors resolve, header is
  the shared default (CS-1..CS-6 verified in rendered HTML). Canonical is
  bare-origin vs sitemap `…/` (known-optional).
- **`/how-it-works`** — Earns its URL: 2,152 words, the only page with
  comparison + anti-fraud + proof tabs + consent posture + FAQ×8. Route-distinct
  `@id`s correct. Missing: visible operator line for the quotes tab (P2-5);
  `reviewedByOperator` absent (P2-8).
- **`/pricing`** — Clean commercial superset; receipt card + 5 FAQs; Offer
  schema byte-aligned (29.00 GBP, /pricing URL). Description under-length
  (P2-4); same-page location-check repetition (P2-7).
- **`/about`** — Strong E-E-A-T co-location (story → quotes → estate grid).
  Description 161 chars (P2-1); page graph is WebPage+Breadcrumb only — the
  operator page deserves the operator attribution (P2-8).
- **`/loyalty-for-pubs`** — The best spoke: unique PubCounterFlow, guides rail,
  bespoke anchor nav. One defect: default HowTo `@id` (P1-1). At 10.0 screens
  it's the longest route — the guides rail justifies it.
- **`/loyalty-for-cafes` / `-bars` / `-takeaways`** — Heroes, pain points and
  metadata are genuinely venue-true (morning fix held; bar copy is the
  strongest). Composition and the 6-screen shared tail are clones (P1-3);
  mechanism cross-link byte-identical ×3; benefits bullet 2 identical on 2 of 3
  (P2-6). Titles 54/58/57 chars — SERP-safe.
- **Guides ×3** — Now dated (visible "Published 27 June 2026 · updated 5 July
  2026" + Article `datePublished`/`dateModified`) and each carries the citable
  index stat with varied lead-ins — both GEO quick-wins landed. ~705 words each
  (GEO target of 1,100–1,400 remains open). Breadcrumbs visible + schema-matched.
- **`/signup`** — Metadata gap (P1-2). Page itself converts fine (trust points
  + cancelLine ×2, 2.3 screens).

## Recommended trim plan (optional implementation)

**Phase A — no spec change, ~1 hour, do any time:**
1. Pub-hub HowTo id override + guard assertion (P1-1) — 2 lines + 4 test lines.
2. `/signup` metadata export (P1-2).
3. `/about` description −2 chars; `/pricing` description +40 chars (P2-1/4).
4. llms.txt "Most rivals…" (P2-3).
5. planIncludes single-source + digest wording (P2-2).
6. Cafe/takeaway benefits bullet 2 variants (P2-6); mechanism cross-link
   one-sentence personalisation ×3.
7. Guard: loop all 3 guides + assert dates in check-jsonld (P2-9).
8. Operator line on the hiw quotes tab (P2-5) + `reviewedByOperator` on
   `/about` (P2-8).

**Phase B — owner decision + marketing persona spokes amendment:**
9. ComparisonTable → comparison wedge + `/how-it-works#no-app` link on the
   three spokes, merged with the mechanism cross-link into one band. Spokes go
   9.0 → ~7.7 screens; cross-spoke shared sentences drop ~40%. Contract test
   + 12 visual baselines regenerate.

**Not recommended:** removing CounterFlow from spokes (breaks HowTo visible
parity), thinning the proof band (the consistency IS the citable asset), or
touching the FAQ slice mechanics.

## Regression check vs prior audits

**Resolved since the morning GEO report (verified in tree):**
guide dates visible + in schema ✓ · guide first-party stat ×3 ✓ · footer guides
cluster (depth-1 discovery) ✓ · `poweredByHeader: false` ✓
([next.config.ts:7](next.config.ts:7)) · `/demo` robots-disallowed ✓
([metadata.ts:26-27](lib/seo/metadata.ts:26)).

**Still open from the GEO report (deliberate/off-page or awaiting owner):**
`sameAs: []` until real profiles exist · query-shaped H2 answer block on `/` +
spokes (tension with spine minimalism — owner call) · guides depth ~705 words
vs 1,100–1,400 target · 4th guide (GDPR) · SoftwareApplication
image/screenshot · IndexNow/Bing · "9 pubs vs press 'eight'" off-repo verify ·
home bare-origin canonical.

**Regressed / newly found:** `/about` description 161 (the 145–159 pass missed
it or it drifted) · benefits bullet 2 re-duplication on 2 of 3 spokes (partial
regression of the morning differentiation) · pub-hub HowTo `@id` (pre-existing,
never before flagged) · `/signup` metadata (never in the 10-route trim scope).

**Morning baseline invariants re-verified intact:** cancelLine ×12 with no bare
"cancel anytime" · one FAQ face (`FaqDetailsList`) on all 3 accordion surfaces ·
persona titles ≤60 chars · `id="fit"` orphans gone · "See more →" tap targets
`min-h-11` ([venue-personas.tsx:59](components/marketing/landing/venue-personas.tsx:59)).

## Verification log

| Gate | Result |
|---|---|
| `pnpm typecheck` | ✓ |
| `pnpm claims:check` | ✓ 67 marketing/SEO files, 540 review-voice files |
| the retired methodology check | ✗ **pre-existing/expected** — only `reports/*.md` (the two morning audit reports, outside any active-spec blast radius; this file will trip it too) |
| `pnpm test` (marketing-redesign, auth-legal, multipage, landing-conversion-spine, persona-spokes) | ✓ 259/259 |
| `pnpm build` | ✓ (dev server on :3000 still healthy after) |
| `pnpm jsonld:check` | ✓ — green **despite** P1-1, confirming the hub-`@id` guard gap |
| Rendered audit (12 routes) | all 200; titles/descs/canonicals per route logged; sitemap 14 URLs = registry; robots + llms.txt 200 |
| Internal links | all 200 except `/login` 500 — **local env-gap** (missing customer-auth secrets post env-split), not a site defect |
| Anchors | zero dangling hash links on any route |
| Mobile scroll (375×812) | `/` 7.7 · hiw 9.9 · spokes 9.0–10.0 · pricing 3.1 · about 4.6 · guides ~4.4 · signup 2.3 screens |

## Deliberately NOT changed / not re-flagged

Per the morning report + standing decisions, reviewed and left alone:
`/signup` stays in the sitemap (e2e-pinned) · `jump-nav.tsx` file retained
([spec pin](contract tests/platform/landing-conversion-spine.md:101); barrel
export harmless) · home H1 "The loyalty card that just opens." (owner-approved;
GEO's query-shaped-H2 suggestion listed as open question instead) · sitemap
omits `lastModified` (honesty call) · Counter-Loyalty Index is real first-party
data · `organizationSchema().sameAs` empty · named competitors (Stamp Me, Loopy
Loyalty) — comparison rows remain structural facts, accurate today, keep on
review cadence · paraphrased/neutral quote signoffs (approved treatment) ·
redeem/collect + poster copy forks · `SHOW_PERSONA_SPOKES` vestigial flag +
dormant `PilotProofStrip` (documented placeholders; the unreachable
`SHOW_PERSONA_SPOKES` branch at
[venue-personas.tsx:63-70](components/marketing/landing/venue-personas.tsx:63)
can go in the next tidy, zero urgency).

## Open questions for owner

1. **Trim ComparisonTable from the three spokes?** (Phase B — needs PS-1
   amendment + baseline regen. My recommendation: yes.)
2. **Home title:** keep "Pubs & Cafes" or cede vertical head terms to the
   spokes and take the category term?
3. **Disclose the operator relationship on the `/how-it-works` quotes tab?**
   (One line; `/about` already discloses.)
4. **Add a query-shaped answer H2 near the top of `/`** (GEO rec) or protect
   spine minimalism?
5. **Working tree is uncommitted** (morning fix pass + staged component
   deletions). Visual baselines will be stale again once committed — schedule
   the 4-browser refresh with the push, per the established runbook.

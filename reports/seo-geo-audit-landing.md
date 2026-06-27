# SEO & GEO Audit — Nabaperks Landing Page
_Audited 2026-06-27 against "Advanced SEO Playbook" (16 chapters) • 8 dimensions • adversarially verified_

## Executive summary

The Nabaperks landing page (`app/page.tsx`) is a technically excellent, genuinely GEO-aware build: server-rendered RSC with no `ssr:false` on the critical path, a connected schema `@graph` with stable `@id`s, a named citable framework (the "Counter-Verified Stamp" `DefinedTerm`), real first-party loyalty data that is honestly gated, and nine AI crawlers explicitly allow-listed. What holds it back is conversion of assets it already owns into machine-ingestible, attributable facts — and a missing site spine. The single biggest lever is the **orphaned hub**: every link-earning, intent-spanning, and topical-authority gap collapses into one root cause — the four persona spoke pages and any top-of-funnel content do not exist, so a strong bottom-funnel page has no roads feeding it and no rankable long-tail URLs. The second-biggest lever is **attribution**: the page's one un-synthesizable asset (real numbers: 1,842 members / 1,180 redemptions / 46.8% repeat) lives only in decorative HTML with no `Dataset` schema, no `<strong>` snippet, no methodology line, and zero presence in `llms.txt`; and the entire site has no `Person`/founder entity to stand behind its anti-fraud and GDPR claims.

**Overall: 68/100 (C+)**

## Scorecard

| Dimension | Score | Grade | One-line |
| --- | --- | --- | --- |
| Technical — Core Web Vitals & Rendering | 88 | A− | Clean SSR/RSC; only decorative Framer Motion on the critical path is undeferred. |
| Semantic Entities & Topic Coverage | 84 | B | Genuinely entity-mapped (DefinedTerm + semantic comparison table); gaps are at the schema-completeness layer. |
| Technical — Crawlability & Advanced Schema | 78 | B− | Connected graph + complete crawl plumbing; thin Organization node and an unemitted HowTo. |
| AI Search / GEO / Answer-Targeting | 73 | B− | Three of four answer-moats ship; proprietary data is not citation-bound and there is no author entity. |
| Search Intent & Query Spectrum | 71 | B− | Stages 2–4 are best-in-class; site is a barbell with no Stage-0/1 roads in. |
| E-E-A-T & Trust Infrastructure | 52 | D+ | Strong structural trust, but zero human/registered-entity identity behind YMYL-adjacent claims. |
| Topical Authority, Hub-Spoke & Internal Linking | 52 | D+ | Strong standalone hub, but the spoke cluster is unbuilt, unlinked, and absent from the sitemap. |
| Link-Earning Assets, Citable Snippets & PR Readiness | 38 | D | Real named IP and real data, but almost none of it is converted into link-earning or citable material. |

## Prioritized action plan

| # | Action | Severity | Effort | Dimension | Files |
| --- | --- | --- | --- | --- | --- |
| 1 | Build the 4 persona spoke pages, wire bidirectional links, add to sitemap + llms.txt, flip `SHOW_PERSONA_SPOKES` | P0 | L | Topical, Intent, Link-Earning | `app/loyalty-for-*/page.tsx` (new), `app/sitemap.ts`, `components/marketing/landing/persona-data.ts`, `components/marketing/landing/venue-personas.tsx`, `public/llms.txt` |
| 2 | Make the proprietary data citable: add `Dataset` schema (gated), wrap stat values in `<strong>`, add stats + methodology to `llms.txt`, render a source line | P0 | M | AI-Search, Link-Earning, Entities | `app/page.tsx`, `components/marketing/landing/nabaperks-proof.tsx`, `components/marketing/landing/nabaperks-proof-data.ts`, `public/llms.txt` |
| 3 | Add a named `Person`/founder entity + attribution; wire as `author`/`reviewedBy` on the DefinedTerm and as a quote source on the data band | P1 | M | E-E-A-T, AI-Search, Link-Earning | `app/page.tsx`, `components/marketing/landing/operator-proof.tsx`, `components/marketing/landing/nabaperks-proof.tsx`, `lib/seo/structured-data.ts` |
| 4 | Finalize Privacy policy + name a real data controller and contact email; link ICO/ASA out to source | P1 | M | E-E-A-T | `app/privacy/page.tsx`, `lib/legal/content.ts`, `components/marketing/landing/separate-marketing.tsx` |
| 5 | Enrich the `SoftwareApplication` node: add `audience`, `areaServed`, `featureList` (resolves WHO/WHERE + sub-vertical gaps) | P1 | S | Entities | `app/page.tsx` |
| 6 | Enrich `organizationSchema()`: populate `sameAs`, add `contactPoint`, `legalName`, `foundingDate`, `address` | P1 | S | E-E-A-T, Schema, AI-Search, Link-Earning | `lib/seo/structured-data.ts` |
| 7 | Emit the 4-step counter-flow as `HowTo` schema (export `steps`, add node) | P1 | M | Schema | `components/marketing/landing/counter-flow.tsx`, `app/page.tsx` |
| 8 | Add an `/about` (or `/company`) fact sheet; link from footer + sitemap; mirror into `organizationSchema` | P1 | M | E-E-A-T | `app/about/page.tsx` (new), `components/layout/marketing-layout.tsx`, `app/sitemap.ts`, `lib/seo/structured-data.ts` |
| 9 | Fix the dangling `#glossary` `DefinedTermSet` + add a `WebPage` node (`isPartOf` → `WEBSITE_ID`); align the DefinedTerm `@id` fragment to the real section id | P2 | S | Schema, Topical, AI-Search, Entities | `app/page.tsx`, `components/marketing/landing/counter-verified-stamp.tsx` |
| 10 | Ship one product-led interactive (Loyalty ROI / repeat-regular calculator) as an embeddable section with its own schema + anchor | P1 | L | Link-Earning, Intent | `components/marketing/landing/*` (new section), `app/page.tsx` |
| 11 | Add a Stage-0 "Sound familiar?" diagnostic block (symptom-first, 0% sales) before the product is named | P2 | M | Intent | `components/marketing/landing/operator-proof.tsx` (or new block), `app/page.tsx` |
| 12 | Add og:image (1200×630) + switch Twitter card to `summary_large_image` | P2 | M | Schema | `app/layout.tsx`, `app/opengraph-image.tsx` or `public/og/home.png` (new) |
| 13 | Coin and register the "browser card" wedge as a second `DefinedTerm` under the glossary set | P2 | M | Topical | `app/page.tsx`, `components/marketing/landing/comparison-table.tsx`, `public/llms.txt` |
| 14 | Name the data franchise (e.g. "Counter-Loyalty Index"); reframe the proof band as brand-as-source | P2 | S | Link-Earning, AI-Search | `components/marketing/landing/nabaperks-proof-data.ts`, `public/llms.txt` |
| 15 | Introduce "EPOS" once as a synonym for "POS"; add keyword + one `llms.txt` mention | P2 | S | Entities | `components/marketing/landing/proof-strip.tsx`, `app/page.tsx`, `public/llms.txt` |
| 16 | Add `optimizePackageImports` for `@hugeicons/react`/`@hugeicons/core-free-icons` (5,474-line barrel) | P3 | S | Technical | `next.config.ts` |
| 17 | Defer/`LazyMotion` the decorative Framer Motion runtime below LCP; make the reduced-motion finished frame the SSR baseline | P2/P3 | M | Technical | `components/motion/wet-ink.tsx`, `components/marketing/landing/hero-sample-card.tsx`, `lib/motion/use-reduced-motion.ts`, `components/loyalty/use-stamp-journey-loop.ts` |

## Findings by dimension

### Semantic Entities & Topic Coverage — 84/100 (B)

**Working well**
- Owns the concept, not just the product: the anti-fraud mechanism ships as a schema.org `DefinedTerm` "Counter-Verified Stamp" (`app/page.tsx:122-128`) with a dedicated section enumerating five checks as a semantic `<ol>` (`counter-verified-stamp.tsx:67-87`) — a citable entity for "how are digital loyalty stamps verified" queries.
- Relationship edges are machine-liftable structure, not prose: `comparison-data.ts:35-42` encodes browser-card vs wallet vs paper vs POS as six structural boolean facts, rendered as a real `<table>` with scoped `<th>`, an sr-only `<caption>`, and sr-only Yes/No (`comparison-table.tsx:55-116`).
- Attributes stated as concrete values and byte-synced to schema: £29 / GBP / 30-day pilot / per-venue / InStock appear as bolded prose (`trust-pricing.tsx:30,46-52`) and as `Offer` JSON-LD (`app/page.tsx:102-110`).
- Hidden-intent/PAA coverage is dual-encoded: eight visible FAQs (`faq.tsx:11-43`) map 1:1 to real SERP fears and are emitted verbatim as `FAQPage` `mainEntity` from the same exported array (`app/page.tsx:113-119`).
- No keyword stuffing: a tight 7-phrase keyword array (`app/page.tsx:40-48`); body copy reads as operator voice with related-entity context.

**[P1] DefinedTerm references a `DefinedTermSet` (`#glossary`) that is never defined — dangling entity edge** — playbook Ch1 (entity completeness)
Current state: the named entity points at a glossary container that does not exist in either graph.
Evidence: `app/page.tsx:127` — `inDefinedTermSet: ${SITE_URL}/#glossary`; a repo-wide grep for `DefinedTermSet`/`glossary` returns this single line only.
Recommendation: in `buildPageGraph()` add `{ "@type": "DefinedTermSet", "@id": ${SITE_URL}/#glossary, name: "Nabaperks loyalty glossary", hasDefinedTerm: { "@id": ${SITE_URL}/#counter-verified-stamp } }`.
Effort: S. _(Merged with the Schema and Topical/AI-Search reports — same root; see action #9.)_

**[P1] `SoftwareApplication` declares no `audience` and no `areaServed` — the product entity never states WHO/WHERE** — playbook Ch1
Current state: the most-lifted product node lists only `name`/`@id`/`applicationCategory`/`operatingSystem`/`description`/`url`/`publisher`/`offers`.
Evidence: `app/page.tsx:92-111`; `areaServed` exists only on `Organization` (`lib/seo/structured-data.ts:26`); `audience`/`featureList` appear in no schema node.
Recommendation: add `audience: { "@type": "BusinessAudience", audienceType: "UK food & drink venues — cafes, takeaways/chippies, pubs, dessert and bubble-tea shops" }`, `areaServed: { "@type": "Country", name: "United Kingdom" }`, and a `featureList` lifted from shipped copy. This single edit also resolves the sub-vertical gap below.
Effort: S.

**[P2] "EPOS" — the dominant UK term for a till system — is entirely absent** — playbook Ch1 (high-salience synonym)
Current state: the page uses "POS" and "till" widely but never "EPOS", the term Square/Loyverse/Lightspeed market under in the UK.
Evidence: a word-boundary grep for `epos` across the repo returns zero standalone matches (only substrings inside `capturePostHogEvent`/`resolvePosterAccent`); "POS" at `comparison-data.ts:25`, `app/page.tsx:45,99`, `proof-strip.tsx:14`, `faq.tsx:25`, `final-cta.tsx:25`.
Recommendation: introduce "EPOS" once as a parenthetical synonym where "POS" first carries weight (e.g. `proof-strip.tsx:14` → "No hardware, no POS or EPOS"); add keyword "loyalty without EPOS" to `app/page.tsx:40-48` and one `llms.txt` mention.
Effort: S.

**[P3] Vertical entities (chippy, bubble tea) are in visible copy but missing from the schema/llms layer** — playbook Ch1
Current state: high-intent sub-verticals are named in prose but the layer engines cite under-represents them.
Evidence: `persona-data.ts:39,53` name the verticals; grep confirms they appear in no JSON-LD node; `llms.txt:3` lists "cafes, takeaways, casual restaurants, pubs and dessert shops" — no chippy, no bubble tea.
Recommendation: fold the full list into the new `SoftwareApplication.audience.audienceType` and add "chippies"/"bubble tea" to the `llms.txt:3` venue list.
Effort: S.

**[P3] The named entity is not linked to its own evidence section — DefinedTerm fragment matches no DOM id** — playbook Ch1
Current state: an engine resolving the term to a citable on-page location finds a dead fragment.
Evidence: DefinedTerm `@id` is `${SITE_URL}/#counter-verified-stamp` (`app/page.tsx:123`) with no `url`; the section enumerating the five checks renders with `id="anti-fraud"` (`counter-verified-stamp.tsx:49`).
Recommendation: set `id="counter-verified-stamp"` on the section (cleanest — makes the `@id` a live deep-link) or add `url: ${SITE_URL}/#anti-fraud` to the DefinedTerm.
Effort: S. _(See action #9.)_

**[P3] Real first-party proof attributes have no machine-readable surface** — playbook Ch1
Current state: substantiated figures live only in human HTML.
Evidence: `nabaperks-proof-data.ts:51-79` ships 1,842 members / 812 visited / 1,180 of 2,934 redeemed / 46.8% repeat; the `SoftwareApplication` node (`app/page.tsx:92-111`) has no `interactionStatistic`/`aggregateRating` and there is no `Dataset`.
Recommendation: surface a conservative slice as `interactionStatistic` `InteractionCounter`s, gated behind the same `nabaperksProofReady()`. Do not use `aggregateRating` (usage counts, not reviews).
Effort: M. _(Merged into action #2.)_

### Search Intent & Query Spectrum — 71/100 (B−)

**Working well**
- Stage 2 (Solution-Aware) is best-in-class: `comparison-data.ts:35-42` ships six structural-fact rows across the exact four columns the playbook asks for, with an ASA/CAP-safe "no competitor prices" rule.
- Stage 3 (Product-Aware) is strong and honest: the named DefinedTerm (`app/page.tsx:122-128`), "three faults we designed out" (`operator-proof.tsx:10-23`), four real gated stats (`nabaperks-proof-data.ts:51-76`), and a direct competitor-comparison FAQ naming Stamp Me / Loopy (`faq.tsx:41-43`).
- Stage 4 (Solution-Ready) is frictionless and byte-synced to the `Offer` schema; ReassuranceBar risk-reversal repeats across hero, mid-page, pricing, and final CTA.
- Objection/"fear" intents are comprehensive and self-contained (`faq.tsx:11-44`), each quotable in 1-2 sentences.
- On-page intent routing is better than first credited: `jump-nav.tsx:8-15` is a crawlable, no-JS TOC whose every anchor resolves to a real section, giving skimmers stage-appropriate "learn" jumps.

**[P1] Site-level barbell: every indexable route is Stage 2–4 — no Stage-0/1 roads feed the storefront** — playbook Ch3/Ch6
Current state: a well-built bottom-funnel page is starved of top-funnel inbound.
Evidence: `app/sitemap.ts:13-19` lists exactly 5 routes (`/`, `/pricing`, `/signup`, `/privacy`, `/terms`); a filesystem sweep found zero blog/MDX/guide files; `persona-data.ts:18` `SHOW_PERSONA_SPOKES = false` and the four spoke URLs exist only as strings.
Recommendation: ship the four planned persona spokes as Stage-0/1 pages and seed 2-3 problem-aware guides; add to sitemap; flip the flag.
Effort: L. _(Single highest-leverage gap; merged into action #1.)_

**[P2] No dedicated Stage-0 (Problem-Unaware) diagnostic block — symptom language is only incidental** — playbook Ch3
Current state: the page opens at Solution-Aware; owner symptoms appear only inside feature bullets and testimonials.
Evidence: `hero.tsx:28-33` (category + mechanism H1, no symptom hook); `operator-proof.tsx:35` frames it as "what loyalty apps get wrong" (Stage 1/2); symptoms scattered at `venue-benefits.tsx:29`, `venue-proof-data.ts:25`, `faq.tsx:21`.
Recommendation: add one short "Sound familiar?" diagnostic block mirroring the owner's symptoms before the product is named; it doubles as the H1/intro for the future spokes.
Effort: M. _(Action #11.)_

**[P3] Every primary CTA is the Stage-4 "Start free pilot", and the persona section dead-ends while spokes are off** — playbook Ch3
Current state: real but narrow — the "learn" anchors the page wanted already exist in `jump-nav`.
Evidence: "Start free pilot" → `/signup` repeats at `hero.tsx:40`, `mid-page-cta.tsx:30`, `trust-pricing.tsx:78`, `final-cta.tsx:30`; `venue-personas.tsx:46-53` renders no link when the flag is false; but `jump-nav.tsx:8-15` already surfaces `#no-app`/`#how-it-works`/`#anti-fraud`.
Recommendation: once spokes ship, give persona cards a stage-appropriate "See [cafes] guide →" learn-CTA; keep "Start free pilot" primary everywhere.
Effort: S.

### E-E-A-T & Trust Infrastructure — 52/100 (D+)

**Working well**
- Real first-party proof, honestly gated: `nabaperks-proof-data.ts:51-76` carries per-stat `substantiated:true` and `nabaperksProofReady()` hard-gates the band (`nabaperks-proof.tsx:18` returns null otherwise); two supplied metrics are deliberately withheld to avoid a contradiction. **Do not touch this discipline.**
- Testimonial integrity: entries set no `attribution` and the renderer falls back to a neutral "From the team" (`venue-proof-reviews.tsx:152`); the type comment forbids inventing names. **Not a dark pattern — do not re-flag.**
- Coherent cross-referencing entity graph with stable `ORG_ID`/`WEBSITE_ID` (`lib/seo/structured-data.ts`); HTTPS; Privacy/Terms linked from footer and `separate-marketing.tsx`.

**[P1] No author/founder `Person` entity anywhere — the "from the counter" voice is fully anonymous** — playbook Ch7
Current state: the page's strongest asset (operator voice) is faceless.
Evidence: `operator-proof.tsx:6` comment "Operator/team voice, no named founder"; grep for `"@type": "Person"`/founder/jobTitle/worksFor across lib/app/components = 0; `app/layout.tsx:93` emits only Organization + WebSite.
Recommendation: add a real named operator/founder credit in `operator-proof.tsx` and a `Person` node `@id ${SITE_URL}/#founder` (`jobTitle`/`worksFor` → `ORG_ID`), set as `founder` on the Organization.
Effort: M. _(Action #3 — unblocks two P3s below.)_

**[P1] Organization schema is thin: `sameAs` empty, no `contactPoint`/`address`/`legalName`/`foundingDate`** — playbook Ch11
Evidence: `lib/seo/structured-data.ts:30` `sameAs: [] as string[]`; TODO at lines 27-29; `organizationSchema()` (17-32) has no `contactPoint`/`address`/`legalName`/`foundingDate`.
Recommendation: populate `sameAs` with 2-3 real off-site nodes (LinkedIn, X, Companies House — highest-trust, lowest-effort first); add `contactPoint` and `PostalAddress` (or `addressCountry: "GB"`).
Effort: S. _(Action #6 — also closes the Schema-dimension P1 and the Link-Earning P3.)_

**[P1] No About page / Organization fact sheet — legal name, founded, who, where are nowhere public** — playbook Ch7
Evidence: `find app -iname '*about*' -o -iname '*company*'` returns nothing; footer (`marketing-layout.tsx:55-73`) exposes only Log in / Start free pilot / Pricing / Terms / Privacy; `lib/legal/content.ts:132` contact body is placeholder "Ask the venue team".
Recommendation: add `/about` via `MarketingLayout` with full legal name, founded date, operator name, UK city, real support email, Companies House number; add to footer + sitemap; mirror into `organizationSchema`.
Effort: M. _(Action #8.)_

**[P1] GDPR/ICO trust claims made with no named data controller and a non-final policy** — playbook Ch7 (most acute of the four identity findings)
Current state: a confident compliance claim borrowing ICO authority sits on an explicitly non-final policy under an unnamed controller.
Evidence: `separate-marketing.tsx:39-46` asserts UK-GDPR/ICO compliance and "never sold on"; `app/privacy/page.tsx:54-61` renders a visible "Review required — not final legal wording" alert; grep of legal content for controller/registered/company number/`contactPoint`/`legalName` and any contact email = 0 (only placeholder).
Recommendation: finalize the policy and remove the alert; name the data controller and a real privacy/DPO email in `lib/legal/content.ts`; link "ICO"/"soft opt-in" out to ico.org.uk guidance.
Effort: M. _(Action #4.)_

**[P2] No outbound citations to the authorities the page invokes (ICO, ASA/CAP)** — playbook Ch7
Evidence: `separate-marketing.tsx:40-42` "the way the ICO expects" is plain text; the ASA/CAP rule lives only in a `comparison-data.ts:7` comment; grep for ico.org/asa.org/gov.uk outbound URLs in landing components = 0.
Recommendation: turn named authorities into real outbound links (`target=_blank rel="noopener noreferrer"`) to the specific ICO soft-opt-in guidance and a short ASA CAP Code line near the comparison table.
Effort: S. _(Folded into action #4.)_

**[P3] Real-data band shows no on-page source, methodology, or attributable author** — playbook Ch12/Ch15
Evidence: `nabaperks-proof.tsx:30-54` renders the four stats with no methodology link, no per-venue breakdown, no named owner; provenance + the Nabatable continuity caveat live only in `nabaperks-proof-data.ts:4-8` comments.
Recommendation: add a visible source/methodology note under the band and attribute it to the named operator (from action #3).
Effort: S. _(Merged into action #2.)_

**[P3] YMYL-adjacent anti-fraud DefinedTerm has no `reviewedBy`/`author`** — playbook Ch7
Evidence: `app/page.tsx:122-128` asserts a five-part anti-fraud method with no author/reviewedBy/citation; `counter-verified-stamp.tsx` makes the same claims with no named reviewer.
Recommendation: attach the operator/founder `Person` as `author` (or `reviewedBy`) on the DefinedTerm plus a one-line on-page attribution. Depends on action #3.
Effort: S.

### Topical Authority, Hub-Spoke & Internal Linking — 52/100 (D+)

**Working well**
- `jump-nav.tsx:8-15` is a correctly-executed CSS-only navigational ToC; all six hash targets verified to resolve (`#how-it-works`, `#no-app`, `#anti-fraud`, `#for-venues`, `#pricing`, `#faq`).
- The hub is genuinely comprehensive standalone content (15 distinct sections), not a thin link-list portal.
- Named IP moat shipped consistently: "Counter-Verified Stamp" as DefinedTerm + full `#anti-fraud` section + `SoftwareApplication.description` + `llms.txt:24`.
- Anti-cannibalization / anti-404 discipline is encoded in code: `persona-data.ts:10-18` documents spokes must not duplicate the hub, and `venue-personas.tsx:46-53` renders the spoke link only when the flag is true.

**[P0] Orphaned Hub: the entire persona spoke cluster is unbuilt, unlinked, and absent from the sitemap** — playbook Ch4/Ch5
Current state: zero topical internal links and no rankable long-tail URLs.
Evidence: repo-wide grep for `loyalty-for-` hits only `persona-data.ts:34,41,48,55`; `find app -type d -name "loyalty-for*"` returns nothing; `sitemap.ts:12-18` omits all four; `SHOW_PERSONA_SPOKES = false` (`persona-data.ts:18`).
Recommendation: build the 4 spoke routes (~600-900 words each, persona-specific, not duplicating the hub `<li>`); wire hub→spoke (flip the flag), spoke→hub (`/#for-venues`, `/#anti-fraud`), spoke↔spoke; add all 4 to `sitemap.ts` (priority ~0.8) and `llms.txt`; ship pages + sitemap + links together.
Effort: L. _(Action #1 — the dominant lever; resolves the Intent P1 and a Link-Earning gap too.)_

**[P1] Hub has zero editorial/topical internal links — only utility and conversion links** — playbook Ch4
Evidence: every static href is utility/conversion/anchor (`/signup`, `/pricing`, `/login`, `/terms`, `/privacy`, `#how-it-works`); footer (`marketing-layout.tsx:55-73`) is utility-only. (Note: `/signup` and `/login` resolve via the `app/(auth)/` route group — not 404s.)
Recommendation: when spokes ship, add keyword-rich anchor-text hub→spoke links inside persona hooks plus a `<nav aria-label="By venue type">` spoke row in the footer. Blocked by action #1.
Effort: M.

**[P2] Dangling `DefinedTermSet`: the Counter-Verified Stamp term references a `#glossary` node never emitted** — playbook Ch11
Evidence: `app/page.tsx:127` `inDefinedTermSet: ${SITE_URL}/#glossary`; grep for `glossary`/`DefinedTermSet` returns only that line.
Recommendation: add the `DefinedTermSet` node so the reference resolves and gives a real container for the next coined term.
Effort: S. _(Action #9 — same fix the Entities/Schema/AI-Search reports flagged.)_

**[P2] The "browser card" wedge is the primary differentiator but is never coined as ownable, citable IP** — playbook Ch15
Evidence: lowercase generic prose throughout (`comparison-table.tsx:43,57,123`, `venue-personas.tsx:25`, `app/page.tsx:99`, `llms.txt:6`, `structured-data.ts:25`); `comparison-data.ts:22` title-case "Browser card" is only a UI label, not a coined term — contrast the DefinedTerm treatment of Counter-Verified Stamp.
Recommendation: coin and capitalize the wedge (e.g. "Browser Card" / "Open-Browser Loyalty Card"), register it as a second `DefinedTerm` under the new `#glossary` set, use the capitalized form in hero/comparison/SoftwareApplication, add a second "named term to cite" line to `llms.txt`.
Effort: M. _(Action #13.)_

### Technical — Core Web Vitals & Rendering — 88/100 (A−)

**Working well**
- Rendering ("final boss"): `hero.tsx` has no `"use client"`; H1, value paragraph, £29/mo line, and both CTAs are server HTML. Only three client islands on the rendered path (`hero-sample-card.tsx`, `venue-proof-reviews.tsx`, the marquee/nav); `seal-break-demo.tsx` is not imported on the landing path.
- The two highest-value GEO assets render without JS: comparison is a semantic `<table>`; FAQ uses native `<details>`/`<summary>`.
- Fonts to spec: `next/font/google` with `display:'swap'` (`layout.tsx:15-27`), wired to theme globals, default `adjustFontFallback` (metric-matched fallback), zero render-blocking font `<link>`s.
- CLS actively reserved against (min-heights at `sample-card-rows.tsx:21,75,83`, `hero-sample-card.tsx:18-19`); animations are transform/opacity only; a `prefers-reduced-motion:reduce` block exists.
- Route stays statically renderable: no `force-dynamic`/`revalidate`, no `ssr:false` on the landing path; `qrcode` runs once on the server and never ships to the browser.

**[P2] Framer Motion (`motion`) ships on the landing critical path purely for decorative loops, undeferred** — playbook Ch8/Ch10
Evidence: `wet-ink.tsx:1,13` (`"use client"` + `import { motion } from 'motion/react'`); above-the-fold hero chain `hero.tsx:88` → `hero-sample-card.tsx` → `StampGrid` (`stamp-grid.tsx:3,52`), `StampDot` (`stamp-dot.tsx:5,45`), `RewardSeal` (`reward-seal.tsx:9`); `package.json:44` pins `motion ^12.40.0`.
Recommendation: defer the runtime below LCP — wrap the decorative islands in `next/dynamic` with `ssr:false` + a static finished-card placeholder (placeholder becomes LCP), or switch `wet-ink.tsx` to `LazyMotion` + `m` with `domAnimation`.
Effort: M. _(Action #17.)_

**[P3] Reduced-motion users get a post-hydration content swap on the above-the-fold hero card** — playbook Ch8
Evidence: `use-reduced-motion.ts:11-23` seeds `false` then sets in `useEffect`; `use-stamp-journey-loop.ts:82-86` returns the finished state only after the effect flips `shouldReduceMotion`, so first paint is `earnedCount=0` then snaps to filled.
Recommendation: make the reduced-motion finished frame the SSR/first-paint baseline (render completed frame by default; pin via a `prefers-reduced-motion: reduce` CSS rule).
Effort: M. _(Folded into action #17.)_

**[P3] `next.config` sets no `optimizePackageImports` for `@hugeicons/core-free-icons` (a large barrel) on the landing page** — playbook Ch8
Evidence: `next.config.ts:1-64` has no `experimental` block; verified in installed Next 16.2.9 that the default list (`node_modules/next/dist/server/config.js:985`) excludes `motion` and `@hugeicons/*`; `@hugeicons/core-free-icons` ships a 5,474-line barrel; consumed via the brand `Icon` in the sticky nav (`marketing-header-nav.tsx:4,6,49`) and `comparison-table.tsx:1`.
Recommendation: add `experimental: { optimizePackageImports: ["@hugeicons/react", "@hugeicons/core-free-icons"] }`. `motion` is already a named/`sideEffects:false` import, so its delta is small — the real motion lever is `LazyMotion`.
Effort: S. _(Action #16.)_

### Technical — Crawlability & Advanced Schema — 78/100 (B−)

**Working well**
- Crawlability fully handled: `robots.ts:6` disallows `/app/ /admin/ /dev/ /api/` for both `*` and a dedicated AI-crawler rule, allow-listing 9 answer-engine bots (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, anthropic-ai, PerplexityBot, Google-Extended, Applebot-Extended, CCBot); sitemap + host emitted.
- `sitemap.ts:12-18` ships 5 public routes with explicit priority + changeFrequency + `lastModified`; private surfaces omitted.
- Canonical `"/"` set against `metadataBase` (`app/page.tsx:39`, `app/layout.tsx:30`).
- Real graph dominance: `SoftwareApplication.publisher` → `ORG_ID`, nested `Offer`, `websiteSchema().publisher` → `ORG_ID`, one shared `@context`+`@graph` envelope.
- `FAQPage` JSON-LD emitted from the same exported `faqs` array that renders the accordion — guaranteed parity.
- `JsonLd` renderer escapes `<` to prevent script-element breakout (`json-ld.tsx:9`).
- Dynamic PWA `manifest.ts` with maskable + any icons, theme color matching viewport, 4 app shortcuts.

**[P1] Organization node has no off-site validation: `sameAs` empty, no `contactPoint`, no `address`** — playbook Ch11
Evidence: `lib/seo/structured-data.ts:30` `sameAs: [] as string[]`; TODO at 27-29; no `contactPoint`/`address` in `organizationSchema()` (17-32).
Recommendation: populate `sameAs` (Companies House first — highest-trust, lowest-effort for a UK Ltd); add `contactPoint` and `PostalAddress`/`addressCountry: "GB"`.
Effort: S. _(Same fix as the E-E-A-T P1; action #6.)_

**[P1] Counter-flow 4-step process not emitted as `HowTo` schema (highest-value untapped opportunity)** — playbook Ch11
Current state: a literal ordered list of four named steps with a free, high-CTR rich-result left on the table.
Evidence: `counter-flow.tsx:1-22` defines `steps` (Scan/Save/Stamp/Reward, property `body`) rendered as `<ol><li>` at 52-67; grep for `HowTo` returns nothing; `steps` is not exported.
Recommendation: export `steps`, then add `{ "@type":"HowTo", "@id":${SITE_URL}/#how-it-works, name:"How Nabaperks no-app loyalty works", step: steps.map((s,i)=>({ "@type":"HowToStep", position:i+1, name:s.title, text:s.body, url:${SITE_URL}/#how-it-works })) }`. Keep text byte-synced; attach per-step `image` once assets exist.
Effort: M. _(Action #7.)_

**[P2] No og:image and Twitter card is "summary" not "summary_large_image"** — playbook Ch11
Evidence: `app/page.tsx:49-56` openGraph + 57-61 twitter have title/description/url but no `images`, card `"summary"` (line 58); `layout.tsx:29-65` has no openGraph block; repo grep for og:image/twitter:image = none; `public/` has only icon PNGs + `llms.txt` + `sw.js`.
Recommendation: add a 1200×630 OG image (static `public/og/home.png` or generated `app/opengraph-image.tsx` via `next/og`); set `openGraph.images` + `twitter.card = "summary_large_image"` in `layout.tsx` so every route inherits it.
Effort: M. _(Action #12.)_

**[P3] Graph-hygiene nits: `BreadcrumbList` has no `@id`; DefinedTerm → undefined `#glossary`; no `WebPage`/`isPartOf` node** — playbook Ch11
Evidence: `app/page.tsx:129-134` BreadcrumbList has no `@id`; line 127 `inDefinedTermSet` → `#glossary` (no backing node); grep for `WebPage`/`isPartOf`/`mainEntityOfPage` = none; `websiteSchema()` is rendered in layout but never linked from the home graph.
Recommendation: give BreadcrumbList a stable `@id`; add the `DefinedTermSet` node (or drop the property); add `{ "@type":"WebPage", "@id":${SITE_URL}/#webpage, url:SITE_URL, isPartOf:{ "@id":WEBSITE_ID }, about:{ "@id":${SITE_URL}/#software }, breadcrumb:{ "@id":${SITE_URL}/#breadcrumb } }` and import `WEBSITE_ID`.
Effort: S. _(Action #9 — same root as the dangling-glossary findings elsewhere.)_

### AI Search / GEO / Answer-Targeting — 73/100 (B−)

**Working well**
- Proprietary named framework shipped as a citable entity: "Counter-Verified Stamp" DefinedTerm (`app/page.tsx:122-128`) backed by a 5-check numbered `<ol>` (`counter-verified-stamp.tsx:18-44,67-87`).
- Comparison asset is real semantic markup (`<table>` + sr-only `<caption>` + scoped headers, `comparison-table.tsx:55-99`) with competitor-named prose (Stamp Me / Loopy at `faq.tsx:42`).
- FAQ is native `<details>` byte-synced to `FAQPage` from the same array.
- AI crawler access deliberately open (`robots.ts:14-29`); `public/llms.txt` is accurate with an explicit "named method to cite" (`llms.txt:23-24`) and its Key pages all exist.
- Site-level entity linkage exists (`SoftwareApplication.publisher` → `ORG_ID` bridges page graph to Organization).
- First-person operator-experience block in copy (`operator-proof.tsx:37-39`); testimonials use correct `<figure>`/`<blockquote>` semantics with crawler-stable SSR defaults.

**[P0] Proprietary loyalty stats have no `Dataset` schema and are absent from `llms.txt` — the one un-synthesizable asset is not citation-bound** — playbook Ch16 (moat #1)
Evidence: `nabaperks-proof-data.ts:51-76` defines four substantiated stats; `nabaperks-proof.tsx:34-50` renders them in `<dd>` with no `<strong>` (line 37); `buildPageGraph()` (`app/page.tsx:90-135`) emits no `Dataset` (grep `Dataset` = 0); `public/llms.txt` contains zero figures.
Recommendation: add a `Dataset` node (only when `nabaperksProofReady()`), sourced from `nabaperksStats` so it stays byte-synced — `creator: { "@id": ORG_ID }`, `variableMeasured` for members/redeemed/repeat, `description` with the as-of date and venue count. Wrap each visible stat value in `<strong>`. Add a "## Proof / results" block to `llms.txt` with the same figures.
Effort: M. _(Action #2 — the second-biggest lever; resolves Link-Earning and Entities gaps too.)_

**[P1] No `Review` schema for testimonials and no `Person`/author entity for the operator-experience moat** — playbook Ch16 (strat 4 / E-E-A-T)
Current state: the actionable core is the absent author entity; the testimonial-`Review` half is currently inert because no entry sets `attribution`.
Evidence: `venue-proof-reviews.tsx:145-147` renders `<blockquote>`; page + layout graphs contain no `Review`/`Person` (grep = 0); `structured-data.ts:30` `sameAs: []`; grep `attribution:` in `venue-proof-data.ts` = 0.
Recommendation: (1) add a named `Person`/`author`/`founder` on the Organization so the operator-experience claim has an attributable entity (load-bearing, independent of testimonial approval); (2) add `sameAs[]`; (3) wire a per-testimonial `Review` emitter gated on `attribution` (`itemReviewed: { "@id": ${SITE_URL}/#software }`) — inert until a venue approves a credit, so lowest urgency.
Effort: M. _(Steps 1-2 are actions #3 and #6.)_

**[P1] Page `@graph` is only thinly linked to the Organization/WebSite graph, and references a `#glossary` `DefinedTermSet` that does not exist** — playbook (cross-ref schema-for-ingestion)
Evidence: two separate scripts (`#ld-site` at `layout.tsx:89-95`, `#ld-home` at `app/page.tsx:159`); within `#ld-home` only `SoftwareApplication` links out; no `WebPage`/`isPartOf`/`mainEntityOfPage` (grep = 0); `inDefinedTermSet` → `#glossary` dangling; `WEBSITE_ID` not imported into `app/page.tsx`.
Recommendation: add a `WebPage` node (`isPartOf` → `WEBSITE_ID`, `about` → `#software`), set `mainEntityOfPage` on `FAQPage` and the new `Dataset`; define the real `DefinedTermSet` (or drop the property); import `WEBSITE_ID`.
Effort: S. _(Action #9.)_

**[P2] No single named-venue case study with before/after numbers — moat #3 is the thinnest** — playbook Ch16 (moat #3)
Evidence: numbers exist only as an anonymous cross-venue aggregate (`nabaperks-proof-data.ts:38-39`); named venues are qualitative-only quotes (`venue-proof-data.ts:14-69`); the two are rendered by separate sections (`app/page.tsx:148,154`) and never correlated.
Recommendation: when one venue approves it, ship a single mini case study (named venue + 2-3 real before/after figures from the on-file SQL) as its own section, represented as a `Review` or `CreativeWork`/`Article` bound to the `SoftwareApplication`.
Effort: M.

**[P3] Proprietary stats are not framed as brand-as-source** — playbook Ch16 (strat 2)
Evidence: the band labels itself "Real numbers" (`nabaperks-proof-data.ts:33`), headline "Joins, stamps and rewards from live venues." (line 36); grep for "Nabaperks programme"/"measured across" = 0, so the brand-as-source bind is absent from the proof band.
Recommendation: reframe to bind the data to the entity (e.g. "The Nabaperks loyalty programme, by the numbers" + "measured across Nabaperks venues"); mirror the phrasing in `llms.txt` and the new `Dataset` name/creator.
Effort: S. _(Pairs with action #14.)_

### Link-Earning Assets, Citable Snippets & PR Readiness — 38/100 (D)

**Working well**
- Named, owned, schema-backed IP framework shipped correctly (DefinedTerm + 5-check `<ol>`) — the Ch15 IP-moat move done right.
- The data is real and rigorously gated, with documented reproducible source SQL and a documented withholding of two contradictory metrics — an honesty/credibility asset.
- Commercials written as bolded, copy-paste-ready snippets and byte-aligned to the `Offer` schema.
- The team already applies `<strong>` snippet emphasis elsewhere (`hero.tsx:50-52`, `counter-verified-stamp.tsx:61`) — confirming the omission on the data band is an oversight, not a capability gap.
- Stable cross-referenced entity graph gives AI one resolvable "Nabaperks" entity to attribute citations to.

**[P1] No interactive, product-led link-earning tool on the page** — playbook Ch12/Ch6
Current state: the core link-earning asset is missing; the hero card is an auto-loop animation (`hero-sample-card.tsx:1-3`, no user controls), and the only interactive control is a toy seal-break toggle (`seal-break-demo.tsx:26-28`, not on the landing path).
Evidence: grep for `calculat|roi|estimat|build-your-card` across app/components/lib returns nothing.
Recommendation: ship one embeddable interactive (e.g. a "Loyalty ROI / repeat-regular calculator": inputs avg spend, covers/day, current repeat rate → extra monthly revenue from a +X% lift vs £29/mo, anchored to the existing "one or two extra regulars a week covers it" line at `hero.tsx:58-61`). Give it an H2 + `#loyalty-calculator` anchor, a `SoftwareApplication`/`WebApplication` schema node, and an "Embed this calculator" snippet. The interactive client infrastructure already exists, so this is less greenfield than "L" implies.
Effort: L. _(Action #10.)_

**[P1] Proprietary data is rendered as decorative tiles, not as bolded copy-paste-ready citable snippets** — playbook Ch15
Evidence: grep for `strong` in `nabaperks-proof.tsx` returns nothing (emphasis is CSS `font-extrabold` only); value/label/helper are three separate elements (`nabaperks-proof.tsx:36-49`); "46.8% of members return" never appears as one sentence.
Recommendation: add a citable lede with semantic emphasis, e.g. `<p>Across UK food-and-drink venues, <strong>46.8% of Nabaperks loyalty members return for a second visit or more</strong>, with <strong>1,180 of 2,934 earned rewards redeemed at the counter</strong> (Nabaperks loyalty data, June 2026).</p>`; reuse the exact strings from `nabaperks-proof-data.ts` so nothing drifts.
Effort: S. _(Merged into action #2.)_

**[P2] No reader-facing methodology / source line — the rigor exists only in a source-code comment** — playbook Ch12/Ch15
Evidence: methodology lives in `nabaperks-proof-data.ts:1-21`; rendered copy is only `NABAPERKS_PROOF_NOTE` (line 79) + "As of June 2026"; `NABAPERKS_VENUES_LIVE=7` (line 27) is flagged "not shown" and imported nowhere.
Recommendation: render a one-line footnote, e.g. "Source: Nabaperks first-party loyalty data, 7 UK food-and-drink venues, Mar 2024 – Jun 2026. Figures reproducible from production records." Surface the venue count + window.
Effort: S. _(Folded into action #2.)_

**[P2] First-party data is not modelled as a `Dataset`/`Claim` and is absent from `llms.txt`** — playbook Ch12/Ch15
Evidence: `buildPageGraph` (`app/page.tsx:90-138`) has no `Dataset`/`DataFeed`/`Claim` (grep empty); `public/llms.txt` numeric content is only "30-day" and "£29/month".
Recommendation: add the `Dataset` node (`temporalCoverage`, `variableMeasured`, `creator` → `ORG_ID`, byte-aligned to the data file) and a stats block to `llms.txt` under "Notes for citation".
Effort: M. _(Merged into action #2.)_

**[P2] Proprietary data is unnamed — no PR-pitchable report franchise** — playbook Ch13-14/Ch15
Evidence: the method is named ("Counter-Verified Stamp") but the data carries only generic labels ("Real numbers", `nabaperks-proof-data.ts:33`); no coined recurring proper-noun.
Recommendation: coin a benchmark name (e.g. "Nabaperks Counter-Loyalty Index" / "UK Counter-Loyalty Benchmark") as the MonoTag/H2, mirror it in the new `Dataset` `name` and `llms.txt` — turning a one-off stat band into a re-releasable PR franchise.
Effort: S. _(Action #14.)_

**[P3] No founder/exec entity — no attributable quote source for press, and `sameAs` is empty** — playbook Ch14/Ch13
Evidence: `operator-proof.tsx:6` "no named founder"; `lib/seo/structured-data.ts:30` `sameAs: []` with TODO; no `Person` node anywhere.
Recommendation: when the business is ready to be quotable, add a founder `Person` (`sameAs` → real LinkedIn), attribute at least one on-page line / the press-facing data quote to that person, and populate `Organization.sameAs`.
Effort: M. _(Actions #3 and #6.)_

## What's already excellent — keep

These cross-dimension strengths are doing real work and should be protected during any refactor:

- **Data honesty discipline.** Per-stat `substantiated:true` gating via `nabaperksProofReady()` (`nabaperks-proof-data.ts:51-90`, `nabaperks-proof.tsx:18`), with two contradictory metrics deliberately withheld and a documented Nabatable continuity caveat. The recommendations above ask you to make this data *more visible and machine-readable* — never to loosen the gate.
- **Testimonial integrity.** No invented names; neutral "From the team" fallback (`venue-proof-reviews.tsx:152`). Do not re-flag as a dark pattern.
- **Visible-copy ↔ schema byte-sync.** `FAQPage` reads from the same exported `faqs` array; the `Offer` mirrors the visible price/terms. Preserve this pattern when adding `HowTo` and `Dataset` (export the source array; source the schema from it).
- **Named, citable IP.** The "Counter-Verified Stamp" DefinedTerm + dedicated `<ol>` section is the template to replicate for the "browser card" wedge.
- **Clean RSC rendering + complete crawl plumbing.** Server-rendered hero/comparison/FAQ, no `ssr:false` on the critical path, `robots.ts` allow-listing 9 AI crawlers, sitemap with priority/changeFrequency/lastModified, escaped JSON-LD. This is the foundation everything else builds on.
- **Connected entity graph with stable `@id`s.** `ORG_ID`/`WEBSITE_ID` cross-referenced via `publisher`; keep new nodes (`WebPage`, `Dataset`, `Person`, `HowTo`, `DefinedTermSet`) wired into the same graph rather than emitted as islands.

## Methodology

Eight specialist auditors each scored one dimension of the Nabaperks landing route (`app/page.tsx` and its dependencies) against the 16-chapter "Advanced SEO Playbook," then an adversarial verifier re-checked every finding against source — confirming, adjusting severity/scope, adding in-scope gaps, or refuting. This report synthesizes only confirmed/adjusted/added findings (refuted findings excluded), deduplicates findings that recurred across dimensions (notably the dangling `#glossary` `DefinedTermSet`, the empty `Organization.sameAs`, and the unschematized first-party data — each merged with cross-references to its playbook chapters), and orders the action plan by impact then effort. The overall score is a weighted average of the eight verified dimension scores, with AI-Search/GEO, Schema, Technical, and E-E-A-T weighted ×1.5 (the playbook's highest-leverage areas) and the rest ×1.0.

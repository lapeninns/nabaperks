# SEO & GEO Audit — Nabaperks (Advanced SEO Playbook)
_Audited 2026-06-27 against the 16-chapter "Advanced SEO Playbook" • 8 dimensions • adversarially verified_

## Executive summary

Nabaperks ships a technically mature, GEO-engineered marketing surface: a fully server-rendered homepage, a connected JSON-LD `@graph` with stable `@id` cross-references, a CI-guarded schema layer, a citable first-party `Dataset` (the "Nabaperks Counter-Loyalty Index"), byte-synced FAQ/HowTo, and an AI-crawler-friendly `robots.ts` + `llms.txt`. The technical and answer-engine fundamentals are strong (CWV 89, AI-Search 87, Schema 83). The single biggest lever is the **funnel breadth gap**: the homepage advertises four verticals (`cafes, takeaways, pubs, bars`) but only the pub spoke (`/loyalty-for-pubs`) is built — three declared personas render as dead, unlinked plain text and there is zero top-of-funnel (Stage-0 symptom) content. Build the missing persona spokes + a thin top-of-funnel layer and this site moves from a strong pub-only cluster to a defensible multi-vertical hub.

**Overall: 78/100 (C+)**

## Scorecard

| Dimension | Score | Grade | One-line |
|---|---|---|---|
| Semantic Entities & Topic Coverage | 79 | C+ | Real two-Org graph + Dataset + DefinedTermSet, but comparison edges flatten to bare Yes/No and the homepage never states "Nabaperks is a…" in copy. |
| Search Intent & Query Spectrum | 63 | D | Deep Stage 2–4 coverage, but the entry funnel is one persona road wide with no Stage-0 symptom content. |
| E-E-A-T & Trust Infrastructure | 69 | D+ | Strong Organization-level trust spine (named operator, 9-pub estate, honesty guards); deliberate ceiling is no Person/author entity + empty brand `sameAs`. |
| Topical Authority, Hub-Spoke & Internal Linking | 66 | D | Correctly-wired pub cluster, but orphaned persona spokes, zero in-body links in guides, and a half-coined IP moat. |
| Technical — Core Web Vitals & Rendering | 89 | B+ | RSC homepage clears the rendering boss; only P2/P3 hardening (eager Framer Motion, no `optimizePackageImports`, dead component). |
| Technical — Crawlability & Advanced Schema | 83 | B | Textbook `robots.ts` + connected, CI-guarded `@graph`; `/pricing` is a metadata/schema dead zone and brand `sameAs` is empty. |
| Link-Earning Assets, Citable Snippets & PR Readiness | 76 | C | Named data asset + ungated calculator + copy-paste blockquote; calculator has no shareable permalink and the index isn't a re-releasable report. |
| AI Search / GEO / Answer-Targeting | 87 | B+ | All four un-synthesizable moats ship; gaps are guide-spoke citation depth and `/about` author binding. |

## Prioritized action plan

Ordered by impact then effort. P0 first.

| # | Action | Severity | Effort | Dimension | Files |
|---|---|---|---|---|---|
| 1 | Build the three persona spokes (cafe/takeaway/bar) the homepage already markets, or remove the personas | P0 | L | Intent, Topical | `app/loyalty-for-{cafes,takeaways,bars}/page.tsx` (new), `components/marketing/landing/persona-data.ts:21,45-65`, `lib/marketing/facts.ts:121`, `app/sitemap.ts:12` |
| 2 | Give `/pricing` metadata + schema (canonical, FAQPage, Offer, WebPage) | P1 | M | Schema | `app/pricing/page.tsx:18-39,95-100`, `lib/marketing/facts.ts` (ROUTES.pricing), `scripts/check-jsonld.mjs` |
| 3 | Add one definitional "Nabaperks is a…" sentence high on the homepage, mirroring `organizationSchema().description` | P1 | S | Entities | `components/marketing/landing/hero.tsx:32-34` or `proof-strip.tsx`, `lib/seo/structured-data.ts:67-81` |
| 4 | Make comparison-table cells self-describing (bind column + feature + value) instead of bare sr-only Yes/No | P1 | S | Entities | `components/marketing/landing/comparison-table.tsx:13-24` |
| 5 | Populate brand `sameAs` (LinkedIn/X/Crunchbase) — one off-page validation node | P1→P2 | S | E-E-A-T, Schema | `lib/seo/structured-data.ts:79`, `lib/marketing/facts.ts` |
| 6 | Add a named Person/author entity (governance-gated) or document the accepted org-only ceiling | P1 | M | E-E-A-T | `lib/marketing/facts.ts:9-13`, `lib/seo/structured-data.ts:9-11,124-127`, `app/about/page.tsx` |
| 7 | Bind `/about` to the operator entity via `reviewedByOperator:true` (+ `isArticle`) | P1 | S | AI-Search | `app/about/page.tsx:55-61` |
| 8 | Add in-body contextual links + heading-anchor ToC to the three guides | P1→P2 | S | Topical | `app/guides/*/page.tsx`, `components/marketing/guides/guide-page.tsx:135-145` |
| 9 | Add 1–2 Stage-0 symptom guides + surface guides from the homepage | P1 | M | Intent | `app/guides/*/page.tsx` (new), `app/sitemap.ts`, `app/page.tsx:73-76`, `components/layout/marketing-layout.tsx:55-68` |
| 10 | Coin the anti-fraud method + the scan→save→stamp→reward loop as proper-noun IP | P1/P2 | M | Topical, Link-earning | `lib/marketing/facts.ts:84`, `lib/seo/structured-data.ts:202,232`, `components/marketing/landing/counter-verified-stamp.tsx`, `counter-flow.tsx` |
| 11 | Defer the one below-the-fold motion island; add `experimental.optimizePackageImports` | P2 | M/S | CWV | `components/marketing/landing/venue-proof.tsx`, `next.config.ts` |
| 12 | Add `datePublished`/`dateModified` to guide Article nodes | P2 | S | Schema, AI-Search | `lib/seo/structured-data.ts:113-128`, `components/marketing/guides/guide-page.tsx:47-48`, `components/marketing/guides/guides-data.ts` |
| 13 | Give the Counter-Loyalty Index a `url`, `keywords`, `distribution` (DataDownload) and a re-release/series frame | P2/P3 | M | Link-earning, AI-Search | `lib/seo/structured-data.ts:150-187`, `lib/marketing/facts.ts:91-106`, `nabaperks-proof.tsx:25` |
| 14 | Add a shareable permalink (querystring serialize/restore) to the RegularsCalculator | P2 | M | Link-earning | `components/marketing/landing/regulars-calculator.tsx:100-103,201-216` |
| 15 | Cite the Counter-Loyalty Index inside the three guides + pass the Dataset into guide `extraNodes` | P2 | M | AI-Search, Link-earning | `app/guides/*/page.tsx`, `components/marketing/guides/guide-page.tsx:47-54` |
| 16 | Add `contactPoint` to both Organization nodes; add `breadcrumb` `@id` cross-reference | P2 | S | E-E-A-T, Schema | `lib/seo/structured-data.ts:77,113-128,131-143` |
| 17 | Add metadata + minimal WebPage schema + `lastUpdated` date to `/terms` and `/privacy` | P3 | S | E-E-A-T, Schema | `app/terms/page.tsx`, `app/privacy/page.tsx`, `lib/legal/content.ts:35-42,77-84` |
| 18 | Render a visible glossary `<dl>` from the same term array as `glossarySchema()`; add WebPage `about`/`mentions` edges | P3 | M | Entities | `app/loyalty-for-pubs/page.tsx`, `lib/seo/structured-data.ts:122,213-248` |
| 19 | Switch homepage Twitter card to `summary_large_image`; wrap key guide claims in `<strong>` | P2/P3 | S | Schema, AI-Search | `app/page.tsx:65`, `app/guides/*/page.tsx` |
| 20 | Delete the dead `SealBreakDemo` client/motion component | P3 | S | CWV | `components/marketing/landing/seal-break-demo.tsx` |

## Findings by dimension

### Semantic Entities & Topic Coverage — 79/100 (C+)

**Working well**
- Real two-entity graph: `organizationSchema()` (Nabaperks) links via `parentOrganization` to `operatorSchema()` (Lapen Inns), which carries all 9 estate pubs as machine-readable `BarOrPub` places with postcodes (`lib/seo/structured-data.ts:44-81`).
- `DefinedTermSet` glossary defines the four core concept entities in JSON-LD and ships on the homepage (`structured-data.ts:213-248`, wired at `app/page.tsx:138`).
- First-party proof modelled as a citable `Dataset` with a named IP entity, `temporalCoverage`, `measurementTechnique`, and units-bearing `PropertyValue` attributes (`structured-data.ts:150-187`).
- `FAQPage` objection coverage is real and byte-synced from the visible `faqs` array (`components/marketing/landing/faq.tsx:12-45` → `app/page.tsx:128-135`).
- Connections expressed as a genuine semantic comparison `<table>` with `scope` headers and an sr-only caption (`comparison-table.tsx:52-114`).
- Single approved facts source (`lib/marketing/facts.ts`) keeps price/pilot/descriptor/proof numbers consistent across copy + schema + `llms.txt`; `PRODUCT.posLine` pre-pairs "POS or EPOS" (`facts.ts:79`).

**[P1] Comparison-table edges flatten to meaningless Yes/No tokens for answer engines** — Ch1 (entities/edges)
- Current state: each comparison cell reaches the DOM as a bare, unbound "Yes"/"No" string with no binding to feature row or product column.
- Evidence: `comparison-table.tsx:13-24` — `Mark()` emits only an `<Icon/>` plus `<span className="sr-only">{value ? "Yes" : "No"}</span>`; grep for `data-`/`aria-label`/`title=` on cells returned zero. The real edges live in `comparison-data.ts:35-42`.
- Recommendation: make each cell self-describing, e.g. `<span className="sr-only">{`${COMPARISON_COLUMNS[colIndex].label}: ${row.feature} — ${value ? "yes" : "no"}`}</span>`; optionally `data-value={String(cell)}`.
- Effort: S

**[P1] Homepage never states the brand-as-entity in copy ("Nabaperks is a …")** — Ch1 (entity definition)
- Current state: NLP must recover "what Nabaperks IS" from JSON-LD rather than visible homepage prose.
- Evidence: `app/page.tsx:39` title is a feature string; `hero.tsx:32-34` H1 is the metaphor "The loyalty card that just opens."; grep shows "Nabaperks is" renders only in `app/about/page.tsx` (lines 19, 43, 45, 70). `ProofStrip` carries setup facts, not a definition.
- Recommendation: add one definitional sentence high in homepage copy mirroring `organizationSchema().description`, e.g. "Nabaperks is a browser-based QR loyalty card for UK pubs, cafes and takeaways — no app, no wallet pass, counter-verified stamps."
- Effort: S

**[P2] Competitor entities named only in prose/table labels, never as a structured separate-from edge** — Ch1 (competitor edges)
- Current state: the "Nabaperks separate-from Loopy/Stamp Me" wedge is never machine-readable.
- Evidence: `comparison-data.ts:23,25` carry "Loopy, Stamp Me" / "Square, Loyverse" only as a column `sub` string; `faq.tsx:42-43` mentions them in answer prose; zero occurrences in `lib/seo/structured-data.ts`.
- Recommendation: add a "Nabaperks vs Loopy Loyalty / Stamp Me" entry to the byte-synced `faqs` array (`faq.tsx`) so the separate-from edge lands in `FAQPage` JSON-LD.
- Effort: M

**[P3] A few secondary pub-loyalty entities are absent (loyalty-economics ones already covered)** — Ch1 (topic coverage)
- Current state: confirmed true zeros across `app`+`components`+`lib`+`public`: footfall, dwell, wet-led, gamification (including the three guides). EPOS, "average spend" and retention are already covered.
- Evidence: EPOS appears in real copy at `app/loyalty-for-pubs/page.tsx:26` and `app/guides/reward-regulars-without-an-app/page.tsx:9` and is paired with POS at `facts.ts:79`; "average spend" is a labelled input at `regulars-calculator.tsx:138`; retention is dense as "repeat-rate/repeat visits/coming back".
- Recommendation: optional — weave "wet-led and food-led pubs" into the existing vertical framing and surface "footfall on quieter days" in the quieter-day pain-point body. Do NOT action EPOS-in-posLine or average-spend-in-calculator — already done.
- Effort: S

**[P3] DefinedTermSet glossary is schema-only — no visible glossary entity on the page** — Ch1 (text-first reinforcement)
- Current state: the four concept definitions never appear as canonical extractable on-page text.
- Evidence: `structured-data.ts:213-248` builds the `DefinedTermSet` and ships it at `app/page.tsx:138`, but no visible `<dl>` definitions block exists and `find` for a `/glossary` route returns nothing.
- Recommendation: render a compact visible "What these terms mean" `<dl>` on `/loyalty-for-pubs` (or a `/glossary` route) sourced from the SAME term array used by `glossarySchema()`.
- Effort: M

**[P3] Concept entities float disconnected — the page graph's `about` edge points only at the Org** — Ch1 (entity-to-page binding)
- Current state: the concept entities are present in the `@graph` but unlinked from the page they describe.
- Evidence: `webPageSchema()` sets a single `about` edge → `ORG_ID` (`structured-data.ts:122`) and no node uses `mentions`.
- Recommendation: add `about`/`mentions` edges from the WebPage to the glossary's `@id` and key `DefinedTerm` names, e.g. `about: [{ '@id': ORG_ID }, { '@id': `${SITE_URL}/#glossary` }]`.
- Effort: S

### Search Intent & Query Spectrum — 63/100 (D)

**Working well**
- Stage 2 served by real semantic comparison markup (`comparison-data.ts:21-42`): a 4-column structural-fact table of honest booleans.
- Stage 3 validation is deep: the Counter-Loyalty Index with a fixed June 2026 snapshot (`facts.ts:91-106`), an Old Crown case-study candidate, operator E-E-A-T with a named 9-pub estate, and a direct competitor FAQ.
- Proactive objection-handling is thorough and honest (`faq.tsx:12-45`), byte-synced to `FAQPage` JSON-LD.
- Crawlable JS-free intent table-of-contents on the homepage (`jump-nav.tsx:11-16`).
- A genuine hub-and-spoke for the pub persona at `/loyalty-for-pubs` with pain points, HowTo, comparison, calculator, and three Stage-1 guides.
- Stage 4 fully served: dedicated `/pricing` with transparent £29/mo + 30-day pilot and its own objection FAQ.

**[P0] Three of four declared personas have no page, no link, and no road in** — Ch2 (query spectrum / barbell)
- Current state: a cafe/takeaway/bar owner searching their vertical hits nothing indexable.
- Evidence: `persona-data.ts:21` hard-codes `SHOW_PERSONA_SPOKES = false`; lines 45-65 declare cafes/takeaways/bars pointing at routes that do not exist (`ls app/` returns only `app/loyalty-for-pubs`). `venue-personas.tsx:44-58` renders the CTA only when `persona.live` (pubs) or the flag is true. Yet `hero.tsx:49` markets "cafes, takeaways and pubs", `app/page.tsx:53` keywords include "cafe loyalty card app UK", and `app/sitemap.ts:12-34` lists zero cafe/takeaway/bar routes.
- Recommendation: build the three spokes mirroring `app/loyalty-for-pubs/page.tsx`, add `ROUTES.cafeHub/takeawayHub/barHub` to `facts.ts`, set each persona `live: true`, flip/remove `SHOW_PERSONA_SPOKES`, register paths in `app/sitemap.ts`. Minimum viable: the cafe spoke (already a targeted keyword with no landing page).
- Effort: L

**[P1] No Stage-0 Problem-Unaware (symptom) content** — Ch2 (top of funnel)
- Current state: the funnel starts at Stage 1 at the earliest.
- Evidence: `app/sitemap.ts:12-34` lists only product/comparison/pricing/about + three product-framed guides (`guides-data.ts:18-40`). Grep for symptom topics (footfall, quiet weeknight, "regulars stopped", win-back) surfaces only a Stage-1 guide summary line.
- Recommendation: add 1–2 Stage-0 guide spokes via the existing `guide-page.tsx` shell, e.g. "Why your regulars stop coming back" and "How to fill quiet weeknights in a pub"; lead with symptom/diagnosis, register in sitemap, link from the hub.
- Effort: M

**[P1] Stage-0/1 guides are buried two clicks deep — homepage gives them no direct road in** — Ch2 (link surfacing)
- Current state: every guide is a 2-hop page from the highest-authority source.
- Evidence: grep for `/guides` across every homepage-rendered component returns nothing. The only path to guides is `/loyalty-for-pubs` (linked from the footer + the single live pubs CTA).
- Recommendation: add a guides index route linked from the footer nav (`marketing-layout.tsx:55-68`), or a 3-card "Go deeper" guides strip on the homepage reusing the `GUIDES` map.
- Effort: S

**[P2] Stage-1 learn-intent guides fire a Stage-4 buy CTA, mismatching intent** — Ch2 (intent matching)
- Current state: each guide ends with the same bottom-funnel `<FinalCta />` used on the homepage/pricing flows; there is no soft learn-stage primary action.
- Evidence: `guide-page.tsx:128` hard-renders `<FinalCta />`; the reward-regulars guide has no mid-content CTA.
- Recommendation: parameterise `GuidePage` with a `primaryCta` prop (default to the hub or the calculator); keep "Start free pilot" as a secondary/outline button.
- Effort: S

**[P3] Qualifier/budget micro-intent has no dedicated, citable cost answer** — Ch2 (budget intent)
- Current state: a budget query like "cheap loyalty app for a small pub" has no on-site cost-comparison answer.
- Evidence: the `RegularsCalculator` IS anchored (`regulars-calculator.tsx:123` `id="regulars-calculator"`) but has no route/sitemap entry, renders on the hub (`loyalty-for-pubs/page.tsx:260`) NOT the homepage, is not linked from `/pricing`, and `/pricing` FAQs (`pricing/page.tsx:18-39`) frame contract/hardware/data, not affordability; comparison cells deliberately omit competitor prices.
- Recommendation: add a "How much does pub loyalty cost?" FAQ/section on `/pricing` with a one-line quotable answer + the £29 maths, and link `#regulars-calculator` from `/pricing` and the hub.
- Effort: M

### E-E-A-T & Trust Infrastructure — 69/100 (D+)

**Working well**
- Real, verifiable Organization fact sheet: named operator (Lapen Inns), region, support/privacy email, and 9 real pub names + postcodes (`facts.ts:18-54`); surfaced as an operator fact card at the TOP of `/about` (`about/page.tsx:104-130`).
- Rich, cross-referenced entity graph emitted once in `app/layout.tsx:90-96` with stable `@id`s and the estate modelled as `BarOrPub` places.
- First-party proof as a citable, honestly-labelled `Dataset`, every stat gated behind a `substantiated` boolean (`nabaperks-proof-data.ts:37-76`), emitted on home + hub.
- Testimonials handled with rare honesty: an explicit anti-fabrication comment guard (`venue-proof-data.ts:5-11`), neutral default signoff "From the team", and zero `Review`/`AggregateRating` schema anywhere.
- Trust pages cite ICO + CAP/ASA, refuse to overclaim, and carry a "Review required" alert (`privacy/page.tsx:62-109`).
- A dedicated first-person Experience block ("We run no-app loyalty with real UK food and drink venues") tied to the operator entity (`operator-proof.tsx:11-37`).
- Author/reviewer attribution is plumbed: `webPageSchema()` supports `author`/`reviewedBy=OPERATOR_ID` and home/hub set `reviewedByOperator:true`.

**[P1] No Person/author entity anywhere — the product has no named, credentialed human** — Ch3/Ch7
- Current state: a deliberate, documented org-only ceiling.
- Evidence: `structured-data.ts:9-11` ("Organization-only — no Person nodes"); `facts.ts:9-13` (governance ban on a named individual/byline); `about/page.tsx` is all first-person-plural; grep for `"@type": "Person"` returns zero E-E-A-T Person nodes.
- Recommendation: obtain ONE genuinely-authorised operator name+role, then relax the `facts.ts` ban for that specific person, add a `Person` node (`worksFor:{@id ORG_ID}`, `sameAs:[LinkedIn]`) referenced as `author`/`reviewedBy`, and add a top-of-page bio box on `/about`. Do NOT fabricate; if none can be named, document the accepted ceiling and strengthen the org entity.
- Effort: M

**[P2] Nabaperks Organization emits an empty `sameAs`** — Ch3 (entity validation)
- Current state: zero off-site corroboration; the brand is, however, anchored via `parentOrganization`.
- Evidence: `structured-data.ts:79` `sameAs: [] as string[]`; contrast operator `sameAs: [OPERATOR.website]` at line 53.
- Recommendation: populate `sameAs` with every real Nabaperks profile (LinkedIn company page, X, Crunchbase, GitHub org); if none exist, create at least a LinkedIn company page. Interim: list the operator website.
- Effort: S

**[P2] No `ContactPoint` or `PostalAddress` on either Organization node** — Ch3 (contactability)
- Evidence: `structured-data.ts:77` exposes `email` only; the only `PostalAddress` is on per-pub `BarOrPub` locations (line 58).
- Recommendation: add a `contactPoint` array (`contactType: "customer support"`, `email`, `areaServed: "GB"`, `availableLanguage: "en"`) to both org nodes — carries no PII and is not covered by the `facts.ts` ban. A registered `PostalAddress` is banned by `facts.ts:9-13`; coordinate governance first.
- Effort: S

**[P2] Experience block and guides invoke no outbound authoritative citations** — Ch3 (expertise signals)
- Current state: the only outbound regulator links are on `/privacy`.
- Evidence: grep `href="https://…"` across `app/guides` + `components/marketing/guides` returns nothing non-internal; the citable consent-separation claim is in the Experience block (`operator-proof.tsx:20-22`), NOT the guides (grep for consent/PECR/GDPR there returns empty).
- Recommendation: cite ICO/PECR on the consent-separation claim in `operator-proof.tsx`; for the guides, cite a UKHospitality/BBPA reference for the behavioural framing.
- Effort: M

**[P3] Legal trust pages carry no last-updated / effective date** — Ch3 (maintenance signal)
- Evidence: `lib/legal/content.ts:35-42,77-84` expose only `docNumber`; grep for any date field across the legal surface returns nothing.
- Recommendation: add a `lastUpdated` ISO date to `PRIVACY_META`/`PLATFORM_TERMS_META`, render it near the doc number, and emit it as `dateModified` on a WebPage node (see next finding).
- Effort: S

**[P3] Privacy and Terms pages emit no JSON-LD at all** — Ch3/Ch6 (entity graph)
- Current state: the two most trust-critical pages are outside the entity graph.
- Evidence: grep for `JsonLd|@context|schema` across `app/privacy` + `app/terms` returns nothing; neither imports `JsonLd`/`marketingPageGraph`, unlike every other marketing route.
- Recommendation: wrap both in a `marketingPageGraph` (or minimal `webPageSchema` + `breadcrumbSchema`) and use that node to carry `dateModified`.
- Effort: S

### Topical Authority, Hub-Spoke & Internal Linking — 66/100 (D)

**Working well**
- Real hub-and-spoke at the pub layer: `/loyalty-for-pubs` is comprehensive standalone content with three built spokes under `app/guides/*`, all in the sitemap.
- Reciprocal flywheel wired through one registry (`guides-data.ts:18-48`): hub→spoke, spoke→hub breadcrumb + CTA, spoke↔spoke `otherGuides()` rail.
- Hub is substantive, not a link-list portal: five pain points, a four-beat flow in step-parity with `howToSchema`, proof, comparison, and an ungated calculator.
- Crawlable JS-free ToC on the homepage (`jump-nav.tsx:10-37`).
- "Nabaperks Counter-Loyalty Index" coined as ownable IP and used consistently (capitalized across `facts.ts`, the `Dataset` node, the proof band, and `llms.txt`).
- No zombie/thin/duplicate/cannibalizing pages; cluster mirrored for AI crawlers in `public/llms.txt:11-15`.

**[P1] Orphaned persona spokes: homepage promises four verticals, only the pub spoke is built** — Ch9/Ch11 (hub-spoke). _See also Intent #1 (P0)._
- Evidence: `persona-data.ts:50,57,64` define cafe/takeaway/bar spokes with no `live:true`; `ls` of all three routes returns "No such file"; `venue-personas.tsx:44-58` renders them as plain text.
- Recommendation: build the three siblings of `/loyalty-for-pubs`, set `live:true`, add paths to `app/sitemap.ts`. If a vertical is not near-term, remove its persona. Note: `SHOW_PERSONA_SPOKES` is inactive-but-wired (gates a branch at `venue-personas.tsx:51`), not unreferenced dead code.
- Effort: L

**[P1] Guide spokes contain zero in-body contextual links** — Ch11 (internal linking)
- Current state: equity flows only through templated chrome.
- Evidence: `grep -cE 'Link|<a '` returns 0 for all three guides; the only `href` is the `GuidePage` identity prop (`paper-vs-qr/page.tsx:64`, `reward-regulars/page.tsx:36`). Only internal links are the breadcrumb, reciprocal CTA, and related rail.
- Recommendation: add 1–2 contextual in-body links per guide with descriptive anchor text (e.g. in best-loyalty-ideas link "confirmed at the counter" → `/loyalty-for-pubs#anti-fraud`). `GuideSection` already accepts `ReactNode` children.
- Effort: S

**[P1] Named-IP moat half-built: the flagship anti-fraud mechanism is left as lowercase generic prose** — Ch12/Ch13 (IP/branding)
- Current state: the differentiator never becomes a proper-noun entity.
- Evidence: grep "Counter-Verified Stamp" (capitalized) returns nothing; lowercase "counter-verified stamp" spans 8 files; `facts.ts:84` stores it lowercase; the `DefinedTerm` name at `structured-data.ts:232` is lowercase. ("Browser-based loyalty card" IS a `DefinedTerm` at `:217`, so it is a named-but-generic-category entity — softens only the secondary sub-claim.)
- Recommendation: coin "the Counter-Verified Stamp" as a capitalized proper noun (change `facts.ts:84`, set the `DefinedTerm` name, capitalize the anchor mention, add a one-line "What is the Counter-Verified Stamp?" definition); keep the lowercase form for body repetition.
- Effort: M

**[P2] Homepage does not surface the pillar hub in its nav and links zero guides** — Ch11 (equity flow)
- Current state: the site's highest-authority page feeds the pillar through one mid-page CTA + a footer link.
- Evidence: `app/page.tsx:73-76` navLinks = `#how-it-works`/`/pricing`/`/login` — no `/loyalty-for-pubs`; the homepage reaches the hub only via the live pub-persona CTA (`venue-personas.tsx:44-50`) + the footer; grep for `loyalty-for-pubs|guides` in `app/page.tsx` returns nothing.
- Recommendation: add "Loyalty for pubs" (`ROUTES.pubHub`) to homepage navLinks and/or a section CTA, plus 1–2 guide links from a relevant homepage section.
- Effort: S

**[P2] Guide spokes ship no on-page ToC and pass no heading anchors** — Ch11 (sitelinks)
- Evidence: `GuideSection` accepts `id` + `scroll-mt-24` (`guide-page.tsx:135-145`) but grep for `GuideSection … id=` in `app/guides/` returns nothing; `GuidePage` renders no in-page ToC.
- Recommendation: give each `GuideSection` a stable slug `id` and render a small crawlable `<a href="#...">` ToC at the top of `GuidePage` (mirror `jump-nav.tsx`).
- Effort: S

**[P3] Hub reaches its spokes through a single auto-generated grid, not contextual deep links** — Ch11 (contextual linking)
- Evidence: `loyalty-for-pubs/page.tsx:274-299` (`GUIDES.map`) is the only place guides are linked; the "Paper cards lost and gamed" pain point (`:74-76`) does not link the paper-vs-qr guide.
- Recommendation: add inline `<Link>`s from the matching hub sections to the relevant guides.
- Effort: S

### Technical — Core Web Vitals & Rendering — 89/100 (B+)

**Working well**
- `app/page.tsx` is an RSC (no `'use client'`) and all 17 directly-mounted landing sections are server components — H1, hero, CTAs, ComparisonTable, FAQ, OperatorProof, VenuePersonas, TrustPricing all in initial HTML.
- The `qrcode` library runs once server-side (`app/page.tsx:82-92`); only a `{size,bits}` matrix reaches the client.
- Fonts via `next/font` with `display:'swap'` as CSS variables (`app/layout.tsx:16-28`); no render-blocking external font `<link>`.
- Zero above-the-fold raster images; `next/image` imported nowhere reachable from the homepage.
- The homepage motion surface is leaner than first scored: only `VenueProofReviews` + the always-on `Marquee` are motion-bearing islands.
- Reduced-motion honored at component level (`wet-ink.tsx:400-408` returns full static content), and a static `venueProofPreview` fallback already exists (`venue-proof-reviews.tsx:261`).

**[P2] Framer Motion ships eagerly to the landing route via the Marquee + VenueProofReviews** — Ch15 (INP/bundle)
- Current state: `motion/react` hydrates on initial load; no code-splitting anywhere.
- Evidence: motion comes from `marquee.tsx:1` → `wet-ink.tsx:411` (`motion.div`) and `venue-proof-reviews.tsx:6`; grep `next/dynamic|React.lazy|Suspense` over the homepage tree returns ZERO. (Correction: `hero-sample-card.tsx` uses no motion; `RegularsCalculator` is on the hub; `SealBreakDemo` is dead.)
- Recommendation: wrap `VenueProofReviews` in `next/dynamic({ ssr: true, loading: () => <StaticVenueProof/> })` using `venueProofPreview` as the fallback; gate the Marquee `motion.div` behind `requestIdleCallback`/IntersectionObserver.
- Effort: M

**[P2] No `experimental.optimizePackageImports` despite barrel + icon imports** — Ch15 (bundle)
- Evidence: `next.config.ts` has no `experimental` block; client surfaces import from broad barrels (`marketing-header-nav.tsx:4` hugeicons; `components/loyalty/index.ts:3` re-exports `RewardCelebration` which pulls motion; `hero-sample-card.tsx:5` imports `RewardTicket` via that same barrel).
- Recommendation: add `experimental: { optimizePackageImports: ['@hugeicons/core-free-icons','@hugeicons/react','@/components/loyalty','@/components/motion','radix-ui'] }`; verify First Load JS via `next build`. Clearest win is the local `@/components/loyalty` barrel (hugeicons already ships `sideEffects:false`).
- Effort: S

**[P3] No images config and `next/image` unused — latent LCP/CLS gap for any future raster hero** — Ch15
- Evidence: `next.config.ts` has no `images` block; raw unsized `<img>` at `reward-collection-qr.tsx:76`, `qr-panel.tsx:165,264` (all off the homepage); `sharp` is installed (`package.json:56`).
- Recommendation: add `images: { formats: ['image/avif','image/webp'], deviceSizes/imageSizes }`; set explicit width/height on the existing QR `<img>` tags; render any future hero with `next/image priority`.
- Effort: S

**[P3] Dead component: `SealBreakDemo` is a fully built `'use client'` Framer Motion island, never rendered** — Ch15 (dead code)
- Evidence: `components/marketing/landing/seal-break-demo.tsx` exports `SealBreakDemo` but a repo-wide grep returns exactly ONE hit — its own declaration (`:17`); not imported by any page or barrel.
- Recommendation: delete it, or wire it behind `next/dynamic` if intended for the Counter-Verified Stamp section.
- Effort: S

### Technical — Crawlability & Advanced Schema — 83/100 (B)

**Working well**
- `robots.ts` disallows `/app//admin//dev//api/` and allow-lists exactly 9 AI crawlers with sitemap + host (`app/robots.ts:6,14-33`).
- True connected `@graph` with stable `@id` cross-references (`structured-data.ts:78,89,120-123`): WebPage `isPartOf`→WebSite, `about`/`publisher`→Org, Org `parentOrganization`→operator.
- High-value schema taken: citable `Dataset`, byte-synced `HowTo` (steps passed from the page), `FAQPage`, `SoftwareApplication`+`Offer`, `DefinedTermSet`.
- The schema graph is regression-guarded in CI: `check-jsonld.mjs` asserts connected `@id`, org-only authorship, the operator link, 9 estate places, and HowTo step parity — wired as `pnpm jsonld:check` (`ci.yml:43`, `package.json:23`).
- Rich `manifest.ts` (maskable icons, four shortcuts, matched theme colors) and a correct self-hosted 1200×630 OG image via `app/opengraph-image.tsx`.
- Per-route canonicals via `alternates.canonical` + `metadataBase` in the root layout.
- `Review`/`AggregateRating` correctly absent — the project leans on a verifiable `Dataset` + estate places instead.

**[P1] `/pricing` is a metadata + schema dead zone** — Ch6 (schema/crawlability)
- Current state: priority-0.9 page with a visible FAQ + concrete Offer falls back to the root default title and sits outside the entity graph.
- Evidence: `app/pricing/page.tsx` exports no `metadata` and injects no `<JsonLd>` (grep returns NONE); listed at `app/sitemap.ts:15` priority 0.9; visible 5-question FAQ (`:18-39`) + £29/month Offer (`:95-100`).
- Recommendation: add `metadata` (title/description, `alternates.canonical: ROUTES.pricing`, OG/Twitter `summary_large_image`) mirroring the hub, plus a `marketingPageGraph` whose `extraNodes` include a `FAQPage` from the `faqs` array and an `Offer`/`Product` referencing `{ '@id': ORG_ID }`. Extend `check-jsonld.mjs` to assert these.
- Effort: M

**[P1] Brand Organization `sameAs` is an empty array** — Ch6 (entity validation). _Same node as E-E-A-T #2._
- Evidence: `structured-data.ts:79` `sameAs: [] as string[]`; ban at `check-jsonld.mjs:82-85` only blocks Companies House / personal `/in/` profiles, leaving room for a compliant company URL.
- Recommendation: populate `sameAs` on Nabaperks (and a second entry for the operator) with at least one compliant external entity URL, sourced into `facts.ts`. Keep the existing prohibition.
- Effort: S

**[P2] BreadcrumbList node is emitted but floats free — no `@id`, no cross-reference** — Ch6 (graph wiring)
- Evidence: `breadcrumbSchema()` returns `itemListElement` only, no `@id` (`structured-data.ts:131-143`); `webPageSchema` (113-128) has no `breadcrumb` property — the one unreferenced node in an otherwise fully cross-linked graph.
- Recommendation: give breadcrumb a stable `@id` (`${url}#breadcrumb`) and add `breadcrumb: { '@id': … }` to `webPageSchema`; thread the page path through `marketingPageGraph`.
- Effort: S

**[P2] Homepage uses Twitter card `summary` (small square) instead of sitewide `summary_large_image`** — Ch6 (social cards)
- Current state: image still renders (root `app/opengraph-image.tsx` file convention supplies it); only the card size is off.
- Evidence: `app/page.tsx:65` `card: 'summary'` while every other page uses `summary_large_image`; `opengraph-image.tsx:4-9` confirms the image resolves for the homepage.
- Recommendation: change `card` to `summary_large_image`; optionally add explicit `images:[OG_IMAGE]` for parity.
- Effort: S

**[P3] `/terms` and `/privacy` export no metadata** — Ch6. _Compounds E-E-A-T #6._
- Evidence: both routes are in the sitemap (`app/sitemap.ts:33-34`) but neither exports `metadata` (grep NONE); they render with only the root default title and no self-canonical.
- Recommendation: add minimal `metadata` (unique title/description + `alternates.canonical`); optionally a lightweight WebPage node.
- Effort: S

**[P2] Guide Article nodes carry no `datePublished`/`dateModified`** — Ch6 (freshness). _Same gap surfaces in AI-Search._
- Evidence: guides set `isArticle:true` (`guide-page.tsx:47-48`) → `webPageSchema` (`structured-data.ts:113-128`) which emits no dateline; grep for `datePublished|dateModified|dateCreated` across `lib/app/components` returns ZERO.
- Recommendation: add optional `datePublished`/`dateModified` to `webPageSchema` when `isArticle`, sourced per-guide (a `published`/`updated` field in `guides-data`/`facts.ts`); extend `check-jsonld.mjs` to assert ISO validity.
- Effort: S

### Link-Earning Assets, Citable Snippets & PR Readiness — 76/100 (C)

**Working well**
- Named proprietary data asset with methodology + integrity gating: the "Nabaperks Counter-Loyalty Index" (`facts.ts:91-106`), hidden when unverified via `nabaperksProofReady()` (`nabaperks-proof-data.ts:32-33,67-76`).
- Genuinely citable snippets: a third-person, branded, copy-paste `<blockquote>` with the headline stat in `<strong>` (`nabaperks-proof.tsx:56-65`), mirrored in `llms.txt:25-28,41` and `old-crown-candidate.tsx:46-55`.
- The data asset is wired as a `Dataset` with stable `@id`, `temporalCoverage`, and per-metric `variableMeasured` (`structured-data.ts:150-187`), emitted on home + hub with one shared `@id`.
- A product-led, ungated tool: the Regulars Calculator paints conservative defaults on first paint (crawler-visible) and stays honest ("Estimate only", `regulars-calculator.tsx:99-116,179-194`).
- Coined IP terms act as a small moat and are formalised in a `DefinedTermSet` glossary.

**[P2] Calculator has no shareable/permalink output — the flywheel is switched off** — Ch12 (tool flywheel)
- Evidence: inputs are local `useState` (`regulars-calculator.tsx:100-103`), never serialised to the URL; outward affordances are only a mailto + clipboard copy (`:201-216`); grep `navigator.share|useSearchParams|permalink` returns EMPTY. `check-banned-claims.mjs:61` bans the literal "embed this calculator".
- Recommendation: reflect the four inputs into the querystring and read them back on load (deep-linkable permalink), then add a "Copy link to this estimate" button. This needs NO guard change (the ban is on "embed", not permalinks); do NOT relax the guard.
- Effort: M

**[P2] The Counter-Loyalty Index is not packaged as a re-releasable report or downloadable asset** — Ch12/Ch13 (PR magnet)
- Evidence: the `Dataset` (`structured-data.ts:150-187`) has no `distribution`/`downloadUrl`/`contentUrl`/`url`; `find public` shows no `.pdf/.csv/.json` artifact; `facts.ts:93` `asOf: "June 2026"` is a single static snapshot.
- Recommendation: add a canonical anchor (`/loyalty-for-pubs#nabaperks-proof` already exists at `nabaperks-proof.tsx:25`) and set `url` on the Dataset; add a `distribution` `DataDownload` (a JSON/CSV endpoint of `PROOF.stats`); reframe `asOf` as a snapshot in a series. Guard-safe (`check-jsonld.mjs:99-105` asserts name + `@id` only).
- Effort: M

**[P2] The scan→save→stamp→reward method has no coined, owned name** — Ch12/Ch13 (process IP). _Pairs with Topical #3._
- Evidence: `loyalty-for-pubs/page.tsx:88-109` are unnamed "Step 01..04"; `counter-flow.tsx:4,31` and `nabaperks-proof-data.ts:36` refer to it only internally as "the four-beat flow"; HowTo `name` is the generic "How Nabaperks loyalty works" (`structured-data.ts:202`).
- Recommendation: coin a name (e.g. "the Counter Loyalty Loop"), add it to `facts.ts`, surface it as the H2 on both how-it-works bands, and set it as the HowTo `name`.
- Effort: S

**[P3] No named executive/founder for quote attribution (governance-gated — not a code defect)** — Ch12/Ch7
- Evidence: `check-banned-claims.mjs:53` bans `founder|Subodh`; `facts.ts:10-13` forbids a named individual; `structured-data.ts:124-127` makes authorship org-only; `/about` attributes everything to "Lapen Inns".
- Recommendation: leave as-is while the guard stands. IF policy relaxes, add one `Person` node + one attributed quote on `/about`. Until then, the org is the citable entity (done well).
- Effort: S

**[P3] Dataset node omits anchoring `url`, `keywords`, `citation`** — Ch12/Ch16. _Overlaps the re-releasable-report finding (same Dataset, same `url` add)._
- Evidence: `structured-data.ts:150-187` omits `url`/`keywords`/`citation`; line 161 reuses the short display string rather than the fuller `PROOF.methodology`.
- Recommendation: add `url`=`absoluteUrl("/loyalty-for-pubs#nabaperks-proof")`, `keywords:["pub loyalty","repeat rate","QR loyalty","UK hospitality"]`, and set `measurementTechnique` to `PROOF.methodology`. Do as one edit with the report finding.
- Effort: S

**[P3] The calculator never cites the Counter-Loyalty Index** — Ch12 (citability tie)
- Evidence: `regulars-calculator.tsx:10` imports only CTA/OPERATOR/PRODUCT/ROUTES — never `PROOF`; on the hub it sits directly after `NabaperksProof` (`loyalty-for-pubs/page.tsx:254-260`) yet the two are not linked.
- Recommendation: add one sentence + link to `#nabaperks-proof`, e.g. "Conservative vs the 46.8% repeat rate in the Nabaperks Counter-Loyalty Index", pulling from `PROOF_DISPLAY.repeatRate`.
- Effort: S

### AI Search / GEO / Answer-Targeting — 87/100 (B+)

**Working well**
- All four un-synthesizable moats ship: proprietary data (`facts.ts:99-105`), a named framework ("Counter-Loyalty Index" + "counter-verified stamps"), a case study with numbers (`old-crown-candidate.tsx:44-55`), and first-hand operator voice (`about/page.tsx:43`).
- `Dataset` schema correctly modelled AND emitted on home (`app/page.tsx:137`) AND the hub (`loyalty-for-pubs/page.tsx:130`).
- Most-citable fact is machine-liftable: a `<blockquote>` with the headline number in `<strong>` (`nabaperks-proof.tsx:57-65`).
- Comparison content is real semantic `<table>` in two places, including inside the paper-vs-qr guide (`app/guides/paper-vs-qr-loyalty-for-pubs/page.tsx:72-131`).
- FAQ is native `<details>` byte-synced to `FAQPage`; AI crawlers explicitly granted (`robots.ts:14-29`); `llms.txt` accurate with a "Notes for citation" block.
- Connected entity graph with stable `@id`s, the estate as `BarOrPub` places, and a `DefinedTermSet`. Proof rendering gated for integrity.

**[P1] The `/about` page — the core experience/E-E-A-T page — emits no author or reviewedBy binding** — Ch16 (named-entity attribution)
- Current state: the page whose entire content is the first-hand experience claim has no edge to the operator entity.
- Evidence: `about/page.tsx:55-61` builds `marketingPageGraph` with no `isArticle`/`reviewedByOperator` (grep confirms neither flag), while home (`app/page.tsx:105`) and hub (`loyalty-for-pubs/page.tsx:124`) both pass `reviewedByOperator:true`.
- Recommendation: add `reviewedByOperator:true` (and arguably `isArticle:true`) to the About page object — a one-line change at `app/about/page.tsx:56`.
- Effort: S

**[P2] Proprietary Counter-Loyalty Index data is not cited inside the three guide spokes** — Ch16 (answer-targeting)
- Current state: the moat reaches home + hub, but the deepest long-tail spokes carry no first-party figure.
- Evidence: grep across `app/guides/` for the proof figures returns nothing; `paper-vs-qr/page.tsx:153-160` ("The data a paper card can't give you") argues retention in pure prose where the 46.8% stat would be the citable payload. (Correction to the original "siloed on home" framing: `NabaperksProof` + the Dataset already ship on the hub at `:130,254`.)
- Recommendation: add one sentence per guide citing the named asset (e.g. `<strong>46.8%</strong>` of members returned), and pass `counterLoyaltyIndexDataset()` into the guide graph's `extraNodes` (`guide-page.tsx:47-54`).
- Effort: M

**[P2] Guide bodies wrap no key claim in `<strong>`** — Ch16 (machine-liftable format)
- Evidence: grep `<strong` across all three guide bodies returns nothing; `paper-vs-qr/page.tsx:144-151` ("cannot be lost, double-stamped or faked") is unwrapped, vs the homepage table which emphasises key phrases. (Correction: guide prose lives in `app/guides/*/page.tsx`, not `guides-data.ts`; the paper-vs-qr guide already ships a `<table>` at `:72`.)
- Recommendation: wrap the 1–2 most citable phrases per `GuideSection` in `<strong>`.
- Effort: S

**[P2] No per-guide FAQPage schema or `<details>` Q&A** — Ch16 (PAA/ingestion)
- Evidence: grep `<details|FAQPage|<summary>` across `app/guides/` returns nothing; the only `FAQPage` is `app/page.tsx:128-135`; `GuidePage` (`guide-page.tsx:47-54`) builds no FAQ node.
- Recommendation: add a per-guide `faqs` array (2–4 self-contained Q&As), render with the existing `LandingFaq` `<details>` pattern, and inject an `FAQPage` node into the guide's `marketingPageGraph` `extraNodes`.
- Effort: M

**[P3] `llms.txt` has no numeric-parity guard or lastmod tie to the snapshot it advertises** — Ch16 (current AI guidance)
- Evidence: `public/llms.txt:26-27` restates the proof numbers as literal prose; these are canonical in `facts.ts:99-105` but `llms.txt` is not generated from them and carries no "Last updated" line. (Correction: `llms.txt` IS in the `check-banned-claims.mjs:36` scan list — but that guards banned strings, not number drift.)
- Recommendation: generate `public/llms.txt` from `facts.ts` via a small `scripts/` generator, or add a parity assertion that the figures match `PROOF_DISPLAY`, plus a "Last updated" line.
- Effort: M

**[P3] Guide Article nodes carry no `datePublished`/`dateModified`** — Ch16 (recency). _Same gap as Schema; do once._
- Evidence: guides set `isArticle:true` (`guide-page.tsx:48`) but `webPageSchema` (`structured-data.ts:113-128`) outputs no date fields; `PROOF.asOf` ("June 2026") provides a defensible date to bind.
- Recommendation: add optional `datePublished`/`dateModified` to `WebPageInput` and emit them in the Article branch.
- Effort: S

## What's already excellent — keep

- **Server-first rendering discipline.** The homepage is a true RSC composing 17 server-component sections; the heavy `qrcode` lib runs once on the server and only a matrix crosses to the client. This is the single biggest reason the technical score is high — protect it when adding interactivity.
- **A connected, CI-guarded entity graph.** One `@graph` emitted in the root layout with stable `@id` cross-references, a two-Organization brand→operator chain, the 9-pub estate as `BarOrPub` places, and `pnpm jsonld:check` (`scripts/check-jsonld.mjs`, `ci.yml:43`) asserting connectivity/authorship/HowTo parity on every build.
- **A citable, honestly-gated first-party data asset.** The "Nabaperks Counter-Loyalty Index" is modelled as a `Dataset`, surfaced as a copy-paste `<blockquote>` with the key stat in `<strong>`, mirrored in `llms.txt`, and hidden whenever any stat is unsubstantiated.
- **Single approved facts source + active honesty guards.** `lib/marketing/facts.ts` single-sources price/pilot/proof/descriptor across copy + schema + `llms.txt`; `check-banned-claims.mjs` and `check-jsonld.mjs` prevent claim drift and fabricated authorship/ratings. No `Review`/`AggregateRating` schema and a neutral testimonial sign-off keep trust signals defensible.
- **AI-crawler readiness.** `robots.ts` allow-lists 9 AI crawlers while keeping `/app /admin /dev /api` private, and `llms.txt` carries an explicit "Notes for citation" block — the GEO fundamentals are in place.

## Methodology

Eight specialist auditors each scored one dimension by reading the repository SOURCE (Read/Grep/Glob), grounding every claim in `file:line` against the 16-chapter "Advanced SEO Playbook" — not a rendered page or a live URL. Every finding was then adversarially re-verified against the same source: refuted findings were dropped, overstated evidence was corrected in place (e.g. the homepage motion surface, the `/about` author binding, the dead `SealBreakDemo`, the empty-`sameAs` severity), and missed gaps were added. Findings overlapping across dimensions (empty brand `sameAs`; guide Article dates; the persona-spoke orphan; the un-coined process/method IP) were merged with cross-references. The overall score is a weighted average of the eight verified dimension scores, weighting the four highest-leverage playbook areas — AI-Search/GEO, Crawlability & Schema, Technical/CWV, and E-E-A-T — at ×1.5 and the rest at ×1.0.

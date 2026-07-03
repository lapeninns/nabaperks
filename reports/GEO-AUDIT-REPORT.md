# GEO Audit Report: Nabaperks

**Audit Date:** 2026-07-02
**URL:** https://nabaperks.com
**Business Type:** SaaS (no-app QR loyalty platform for UK pubs & cafes; operator-built by Lapen Inns)
**Pages Analyzed:** 10 (sitemap); 7 deep-audited
**Method:** 5 specialist subagents (raw-HTTP verified, not markdown) → weighted composite

---

## Executive Summary

**Overall GEO Score: 63/100 (Fair)**

Nabaperks has a **best-in-class technical and structured-data foundation** — full AI-crawler access, a genuine `llms.txt`, server-rendered rich JSON-LD (FAQPage, HowTo, Dataset, SoftwareApplication, Organization, BreadcrumbList), a complete security-header set, and unusually honest content (labeled testimonials, caveated first-party stats). The score is held to "Fair" by a single structural failure: **the entity graph is broken.** The brand's real authority — operator **Lapen Inns**, a verifiable hospitality company (Companies House #15111022, trade-press coverage, industry awards) — is never connected to "Nabaperks" anywhere an AI can see, on-site (`Organization.sameAs` is empty) or off-site (zero third-party footprint). The result: AI systems can read the site perfectly but have no basis to *recognize, trust, or cite* the brand as a known entity.

**The single highest-leverage fix costs one code change:** populate `Organization.sameAs` and add a reciprocal link from lapeninns.com → this bridges an entire reservoir of stranded, verifiable authority to the product.

### Score Breakdown

| Category | Score | Weight | Weighted Score |
|---|---|---|---|
| AI Citability | 74/100 | 25% | 18.50 |
| Brand Authority | 22/100 | 20% | 4.40 |
| Content E-E-A-T | 58/100 | 20% | 11.60 |
| Technical GEO | 94/100 | 15% | 14.10 |
| Schema & Structured Data | 82/100 | 10% | 8.20 |
| Platform Optimization | 61/100 | 10% | 6.10 |
| **Overall GEO Score** | | | **62.9 / 100** |

**Biggest strengths:** Technical infrastructure (94), schema breadth (82), content quotability (74), radical trust honesty.
**Most critical gaps:** No off-site entity footprint (Brand Authority 22), empty `sameAs`, no named author/`Person`, statement-form (not question-form) headings.

---

## Critical Issues (Fix Immediately)

1. **`Organization.sameAs` is empty `[]` on the Nabaperks Organization schema.**
   *Pages:* `/`, all pages (inherited org block). This is the #1 GEO fix on the entire site. `sameAs` is the primary mechanism AI models use to resolve "Nabaperks" to a verified cross-platform entity. **Fix:** populate with Companies House record, a new LinkedIn company page, Crunchbase, any social profiles, and a Wikidata item once one exists. Also fix the Lapen Inns *parent* Org, which currently only self-references `lapeninns.com`.

2. **No third-party entity footprint for "Nabaperks."**
   *Off-site.* Not on Wikipedia, Wikidata, Reddit, LinkedIn, YouTube, review sites, news, or directories. Every "Nabaperks" search collides with NAB/NBA. AI systems cannot corroborate the brand exists and will not confidently cite it. **Fix:** stand up LinkedIn + Crunchbase + a directory listing, and pursue one trade-press mention (Morning Advertiser / Pub & Bar already cover Lapen Inns — a "Lapen Inns launches Nabaperks" angle is realistic).

3. **Operator authority is stranded — no off-site link between Lapen Inns and Nabaperks.**
   The one large reservoir of real, verifiable trust (Lapen Inns: trade press + Companies House + BII awards) does not transfer because nothing external connects it to the product, and the site asserts the relationship one-directionally. **Fix:** add "Nabaperks — our loyalty platform" on lapeninns.com linking here; add `parentOrganization`/`founder` to the Nabaperks Org schema.

---

## High Priority Issues (Fix Within 1 Week)

1. **No question-led headings anywhere.** Homepage and all three guides use statement H2/H3 ("Side by side", "What most loyalty apps get wrong"). The rich FAQPage/HowTo schema gives AI structured data, but the *visible prose* offers no query-matched answer target — the exact pattern AI Overviews and ChatGPT extract most readily. **Fix:** add question-phrased H2/H3s ("How do QR loyalty cards work for pubs?", "Is a QR stamp card better than paper?") with a 40–60 word direct-answer paragraph immediately beneath each.

2. **Guide `Article` schema missing `datePublished`, `dateModified`, `image`, `mainEntityOfPage`.** *Pages:* all `/guides/*`. Fails Google's Article rich-result requirements and strips the freshness signal AI engines use to judge and cite how-to content. **Fix:** emit ISO-8601 dates + a representative image per guide.

3. **Thin, uncited guides with no in-guide evidence.** 380–600 words each, no external citations, no case studies, no data in the guide bodies. **Fix:** expand each to 900–1,500 words; pull the existing Old Crown (Girton) case study into the guides; add 1–2 outbound citations to UK hospitality authorities (UKHospitality, BBPA, CGA); rewrite openings as self-contained enumerated answer blocks.

4. **`/about` is too thin to carry authority (~350 words, names no people).** Despite three officers on Companies House, no founder is named. **Fix:** name the founder/team with roles, add company registration + trading address, add a `Person` entity, and link the 9 venue sites.

5. **All headline statistics are self-published with no methodology anchor.** The Counter-Loyalty Index (1,842 members, 46.8% return) is the best citability asset but has no on-page methodology (sample size, venue count, window). AI systems hedge or drop uncorroborated first-party stats. **Fix:** add a one-line methodology beside the "Real numbers" block; keep/expand the `Dataset` schema with `temporalCoverage` and a stated sample size.

6. **Brand-name collision with NAB / NBA** buries every legitimate query and blocks organic entity formation. **Fix:** always co-mention a disambiguator in titles, schema `alternateName`, and outreach — "Nabaperks — no-app QR loyalty for UK pubs, by Lapen Inns."

---

## Medium Priority Issues (Fix Within 1 Month)

1. **Cross-page numeric inconsistencies.** `/about` says **"9 pubs"**; trade press (June 2025) + `llms.txt` say **8**. Counter-Loyalty Index is labeled **"June 2026"** on-site vs **"March 2024–June 2026"** in `llms.txt`. Extractors surface exactly these mismatches and lower citation confidence. **Fix:** reconcile to one true figure/date range across all surfaces.

2. **No named author / `Person` on guides.** Content is attributed to the org `@id`, never a credentialed human. Author-as-Person with `sameAs` is a materially stronger E-E-A-T signal for answer engines. **Fix:** byline each guide ("By [Name], [role] at Lapen Inns, running loyalty across 8 UK pubs") + an author page.

3. **No `FAQPage` on `/loyalty-for-pubs`** despite 5 Q&A-shaped "friction" items — the FAQ markup already exists on `/` and `/pricing`. **Fix:** mirror it on the hub.

4. **No `<lastmod>` in sitemap** on any of the 10 URLs — removes the freshness signal crawlers use to prioritize re-crawls. **Fix:** emit real per-route `<lastmod>` (git commit date or content `updatedAt`) in `sitemap.ts`.

5. **Bing / Microsoft signals absent.** No `msvalidate.01` tag, `/indexnow.txt` returns 404, no LinkedIn page — the main Bing Copilot readiness levers. **Fix:** enable Bing Webmaster Tools + IndexNow.

6. **Incomplete legal/trust details.** No company registration number, physical trading address, named DPO, or specific data-retention periods in the Privacy Policy. **Fix:** add to footer/About/Privacy.

7. **`llms-full.txt` returns 404.** The `llms.txt` is exemplary; the full-content companion is missing, capping the tier below comprehensive. **Fix:** publish `llms-full.txt`.

---

## Low Priority Issues (Optimize When Possible)

1. **No content dates visible on guides/pillar;** forward-dated "© 2026" in footer. Add published/updated dates + correct the year.
2. **`WebSite` schema has no `SearchAction`.** Add `potentialAction` only if on-site search genuinely exists (do not fake it).
3. **Guides read as vendor-voiced and lightly templated** (repetitive "no app" framing, every guide ends on the same CTA, no counter-perspectives). Add nuance ("when paper genuinely wins") and a named voice.
4. **No refund policy line on `/pricing`** (cancellation is covered; refunds are not). Add one line.
5. **robots.txt bare-prefix breadth** — `/home` and `/start` (no trailing slash) would block any future path starting with those tokens. Harmless today; scope more tightly if such marketing URLs get added.
6. **Reference `llms.txt` from robots.txt** so agents that read robots first can discover it.
7. **Lapen Inns parent Org missing `foundingDate`, `contactPoint`, `logo`;** guide Article `@id` uses `#webpage` suffix (cosmetic).

---

## Category Deep Dives

### AI Citability (74/100)
Unusually well-engineered for extraction. **Strengths:** self-contained definition passages AI can quote verbatim (e.g. `/guides/reward-regulars-without-an-app`: *"A browser-based loyalty card is one that customers open from your QR code. There is nothing to download and no wallet pass to install."*); a *named* first-party data asset (Counter-Loyalty Index) with hard numbers; question-shaped H2s in places; an 8-item homepage FAQ; a reusable comparison table; a list-structured anti-fraud checklist. **Ceiling drivers:** thin guide bodies with fragment lists (no full enumerated "7 best ideas" block to lift wholesale), uncorroborated stats with no methodology, and cross-page numeric mismatches extractors will notice.

### Brand Authority (22/100)
Honest low score. "Nabaperks" as a product entity is effectively invisible to the open web — no Wikipedia/Reddit/LinkedIn/YouTube/review/news/directory presence. The **operator Lapen Inns is genuinely authoritative** (Morning Advertiser + Pub & Bar + Hospitality & Catering News coverage; Companies House #15111022 with named officers Subodh Gautam / Ravi Acharya / Purnaman Bajcharya; BII Sustainability awards; £100k refurb story) — **but that authority is not connected to Nabaperks anywhere off-site**, so almost none of it transfers. This is the single biggest cross-platform ceiling; fixing the entity join is worth more than any content change.

### Content E-E-A-T (58/100)
A sharp split. **Trustworthiness 23/25** (strongest) — HTTPS, transparent flat pricing (£29/mo, 30-day free, no contract), real Privacy/Terms naming the data controller, and radically honest claims (testimonials labeled "paraphrased operator voice," stats carry first-party caveats + date range — no dark patterns). **Experience 16/25** — genuinely operator-built (Lapen Inns, 9 named venues w/ postcodes, real product data), though this lives only on home/About, not the guides. **Expertise 7/25** + **Authoritativeness 5/25** (weakest) — no named author/byline/credential anywhere, thin guides (380–600 words), zero external citations, `/about` too thin to carry authority.

### Technical GEO (94/100)
Best-in-class. **robots.txt** explicitly Allows all 9 major AI crawlers (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, anthropic-ai, PerplexityBot, Google-Extended, Applebot-Extended, CCBot); only functional/app routes disallowed — no over-blocking. **llms.txt present** (200, 3.2 KB, with a "Notes for citation" block). **SSG-prerendered** (`x-nextjs-prerender: 1`) — full content in initial HTML, AI crawlers see everything. **Complete security-header set** (HSTS preload, real CSP, X-Frame DENY, nosniff, Referrer-Policy, Permissions-Policy). Correct title/canonical/meta-robots/OG/Twitter. **Only real gap:** no `<lastmod>` in the sitemap. (CWV inferred favorable from HTML; confirm with CrUX/PageSpeed field data.)

### Schema & Structured Data (82/100)
Above-average, 100% JSON-LD, server-rendered. All 7 GEO-critical SaaS types present somewhere: Organization, WebSite, SoftwareApplication (+Offer £29 GBP InStock), FAQPage (8 Q&A on `/`, 5 on `/pricing`), Article, BreadcrumbList, plus Dataset, HowTo, DefinedTermSet, and BarOrPub ×9 with PostalAddress. Syntactically valid, correctly cross-linked by `@id`, no type collisions. **Real gaps:** empty `Organization.sameAs` (the critical one), no `WebSite` SearchAction, guide `Article` missing dates/image, no `Person` entity, `/loyalty-for-pubs` missing FAQPage.

### Platform Optimization (61/100)

| Platform | Readiness | Highest-impact fix |
|---|---|---|
| Google AI Overviews | **High** (~72) | Add question-phrased headings + 40–60 word answer paragraphs (schema is strong; on-page headings are statement-form) |
| ChatGPT | **Medium** (~58) | Establish a verifiable entity — Wikidata + LinkedIn, then expand `sameAs` |
| Gemini | **Medium** (~62) | Get into Google's Knowledge Graph via a named `Person` founder + YouTube demo + Google Business Profile |
| Bing Copilot | **Medium** (~60) | Turn on Bing Webmaster Tools + IndexNow + LinkedIn page |
| Perplexity | **Low** (~40) | Seed genuine community validation (r/pubs, publican forums, hospitality-tech directories) — zero third-party mentions today |

---

## Quick Wins (Implement This Week)

1. **Populate `Organization.sameAs`** on the Nabaperks + Lapen Inns schema (Companies House, LinkedIn, socials) — the single highest-ROI change on the site. *(1 code change.)*
2. **Add a reciprocal "Nabaperks" link on lapeninns.com** — instantly bridges the operator's real authority to the product.
3. **Add `datePublished` + `dateModified` + `image` to every `/guides/*` Article** — unlocks Article rich results + freshness signal.
4. **Reconcile "9 vs 8 pubs" and the Index date label** across `/about`, homepage, and `llms.txt` — removes trust-eroding numeric mismatches.
5. **Add `<lastmod>` to `sitemap.ts`** — one-line freshness signal for the whole site.

## 30-Day Action Plan

### Week 1: Fix the entity graph (highest leverage)
- [ ] Populate `Organization.sameAs` on Nabaperks + Lapen Inns Org schema
- [ ] Add reciprocal Nabaperks link + mention on lapeninns.com
- [ ] Create a Nabaperks LinkedIn company page + Crunchbase listing
- [ ] Add `alternateName` / disambiguator ("by Lapen Inns") to titles + schema

### Week 2: Content structure for extraction
- [ ] Convert statement H2/H3s to question-led headings + 40–60 word answer paragraphs (homepage + guides)
- [ ] Add `datePublished`/`dateModified`/`image` to all guide Articles
- [ ] Add a named-author byline + `Person` entity; create an author page
- [ ] Reconcile all cross-page stats/dates + add a one-line Index methodology

### Week 3: Depth + authority
- [ ] Expand each guide to 900–1,500 words with the Old Crown case study + 1–2 outbound citations
- [ ] Rebuild `/about`: name founder/team, add company reg + address, link 9 venues
- [ ] Add `FAQPage` to `/loyalty-for-pubs`; publish `llms-full.txt`
- [ ] Complete legal/trust details (reg number, DPO, retention periods)

### Week 4: Off-site + platform presence
- [ ] Pursue one trade-press mention ("Lapen Inns launches Nabaperks")
- [ ] Enable Bing Webmaster Tools + IndexNow; add `WebSite` SearchAction if search exists
- [ ] Seed genuine community validation (relevant Reddit/forum threads, directories)
- [ ] Record a short YouTube product demo (Knowledge Graph + Gemini signal)

---

## Appendix: Pages Analyzed

| URL | Title | Key GEO Issues |
|---|---|---|
| `/` | No-App QR Loyalty Cards for UK Pubs & Cafes \| Nabaperks | Empty `sameAs`; statement headings; Index date label mismatch; no SearchAction |
| `/loyalty-for-pubs` | Loyalty for pubs (hub) | No FAQPage schema; statement headings; stats need methodology |
| `/pricing` | Pricing | Minor — no refund line; WebPage author+reviewedBy (valid but unusual) |
| `/about` | About | No `Person`/founder; ~350w thin; "9 vs 8 pubs"; empty `sameAs` |
| `/guides/best-loyalty-ideas-for-pubs` | Guide | Article missing dates/image; no author; fragment lists; thin |
| `/guides/reward-regulars-without-an-app` | Guide | No dates/author; thin; strong definition block (asset) |
| `/guides/paper-vs-qr-loyalty-for-pubs` | Guide | No dates/author; thin; good comparison content |
| `/signup` | Sign up | App/conversion route (not content-audited) |
| `/privacy` | Privacy | Missing DPO + specific retention periods |
| `/terms` | Terms | OK |

---

*Generated by the `geo-audit` orchestration skill — 5 parallel specialist subagents (geo-ai-visibility, geo-content, geo-technical, geo-schema, geo-platform-analysis), all findings raw-HTTP verified against the live production domain.*

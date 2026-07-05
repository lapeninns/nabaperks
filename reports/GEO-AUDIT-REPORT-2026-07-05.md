# GEO Audit — Nabaperks — 2026-07-05

Run via the `/geo` orchestrator (5 parallel subagents) against the **current source (post-fix)**,
with brand-mentions run against the real web. Rendered HTML sampled from `localhost:3000`.

> **Deploy-gap caveat:** live `nabaperks.com` currently serves the **pre-fix** build. This report
> scores your *staged* surface (titles/descriptions/copy/schema improvements from the 2026-07-05
> marketing pass). Robots, sitemap, llms.txt, and security headers are deploy-stable (identical
> live and local); brand-authority findings are deploy-independent. Everything else improves only
> once deployed.

## Composite GEO Score: **69 / 100**

*Excellent on-page and technical GEO — genuinely near its ceiling for a site this young — dragged
down almost entirely by near-zero off-page entity authority. The pages are built to be quoted;
the brand isn't yet an entity AI engines can recognise, corroborate, or cite.*

| Category | Score | Weight | Contribution |
|---|---|---|---|
| AI Citability & Visibility | 84 | 25% | 21.0 |
| **Brand Authority Signals** | **9** | 20% | **1.8** |
| Content Quality & E-E-A-T | 82 | 20% | 16.4 |
| Technical Foundations | 94 | 15% | 14.1 |
| Structured Data | 88 | 10% | 8.8 |
| Platform Optimization | 71 | 10% | 7.1 |
| **Composite** | | | **69.2** |

**The one number that explains the score:** Brand Authority contributes 1.8 of a possible 20.
Lift it to even 50 and the composite clears 77; to 80 and it clears 83. Nothing on-page moves the
needle comparably — on-page work is near a ceiling. **The entire gap to a great GEO score is
off-page entity grounding.**

## Per-platform readiness (from geo-platform-analysis)

| Platform | Readiness | Why |
|---|---|---|
| Google AI Overviews | **High** | Extractable FAQ + real comparison table + HowTo/Dataset/FAQPage schema + visible June-2026 freshness |
| Bing Copilot | **Medium** | Clean semantics + schema, but no Bing-index acceleration / no brand footprint |
| ChatGPT / SearchGPT | **Medium-Low** | Crawlers allowed + great llms.txt, but empty `sameAs` = nothing to ground "Nabaperks" against |
| Gemini | **Medium-Low** | Rich schema + topical breadth, but no Knowledge Graph entry / no `sameAs` |
| Perplexity | **Low** | SSR + dated content, but Perplexity leans on community/third-party corroboration — Nabaperks has none |

## Convergent findings (flagged independently by 3–4 subagents = high confidence)

### 1. [Critical · off-page] Nabaperks has no external entity footprint
Own-name search returns **zero** results (name collides with "NAB" the Australian bank); Wikipedia
404; nothing on Reddit / LinkedIn / YouTube / G2 / Capterra / Trustpilot. AI engines cite entities
they can corroborate from ≥2 independent sources; Nabaperks currently has exactly one (its own site).
The operator **Lapen Inns** *does* have a real indexed footprint (site, per-pub pages, Facebook, BII
award, trade press) — but Nabaperks doesn't yet inherit it. **This is the dominant weakness and it
cannot be fixed in code.**
- Highest-leverage: create an owned LinkedIn *company* page + free G2/Capterra vendor listings;
  add a Nabaperks mention + link from `lapeninns.com` (already indexed) and reciprocally from `/about`;
  seed 2–3 genuine mentions where UK licensees are (r/pubs, publican forums).

### 2. [High · quick win] `sameAs: []` on the Nabaperks Organization node
`lib/seo/structured-data.ts:79` — empty; operator node (`:53`) lists only `lapeninns.com`. `sameAs`
is the primary entity-disambiguation signal. The Lapen Inns Facebook page **already exists** to wire in.
- Fix: populate both `sameAs` arrays with **real, owned** profiles as they exist.
- ⚠️ **Governance override (see below):** allowed = company Facebook/LinkedIn(`/company/`)/Crunchbase/G2.
  **Not** Companies House, **not** a personal LinkedIn(`/in/`), **not** a `founder`/`Person` node.

### 3. [High · quick win] No `datePublished` / `dateModified` on guides (Article) or the Dataset
Confirmed by content, schema, visibility, and platform agents. Guides are typed `Article` but carry
no dates; the Counter-Loyalty Index `Dataset` has `temporalCoverage` but no `dateModified`. AI engines
discount undated content on time-sensitive topics.
- Root cause: `webPageSchema()` (`lib/seo/structured-data.ts:105-129`) takes no date params;
  `GuideMeta` (`components/marketing/guides/guides-data.ts`) has no date fields; `guide-page.tsx:49-55`
  passes none.
- Fix: add owner-approved ISO dates to `GuideMeta`, thread through the helper, surface a visible
  "Reviewed June 2026" line. **Dates must be real/approved, not invented.**

### 4. [High · quick win] The 3 guides carry no first-party numbers
Grep-confirmed: the citable Counter-Loyalty Index stat lives only on `/` and `/how-it-works`. The
guides are the pages ranking for intent queries ("does QR loyalty increase pub repeat visits") yet
hand the model no stat to quote.
- Fix: add one sentence per guide reusing the **approved** pattern from `facts.ts` PROOF/PROOF_DISPLAY
  ("In the Nabaperks Counter-Loyalty Index (snapshot June 2026), 46.8% of 1,842 members returned…").
  No new claims — reuses single-sourced strings.

## Other findings

**Quick wins (code)**
- [High · platform] H1/titles are poetic, not query-shaped. Add a query-matching H2 answer-target
  ("What is a no-app QR loyalty card?" → 40–60-word definitional answer) near the top of `/` + spokes,
  *keeping* the branded H1. (Echoes the standing conversation point about the metaphor H1.)
- [Medium · platform] Named-competitor comparison table lives only on `/how-it-works` + paper-vs-QR
  guide. Replicate a compact table-backed "Nabaperks vs wallet-pass apps vs POS" block on `/` and each
  spoke, with a visible "compared June 2026" note.
- [Medium · technical] The 3 guides have a single discovery path (persona spokes only, depth-2). Add a
  "Guides" cluster to the server-rendered footer (`components/layout/marketing-layout.tsx`) and/or a
  related-guides block on `/how-it-works` → pulls them to depth-1 with multiple parents.
- [Low · technical] `x-powered-by: Next.js` info-leak → `poweredByHeader: false` in `next.config.ts`.
- [Low · technical] `/demo` is in the header nav but neither in the sitemap nor robots-disallowed —
  decide: add to `PUBLIC_SITE_ROUTES` or to `PRIVATE_ROUTE_PREFIXES`.
- [Low · technical] Homepage canonical is bare-origin (`https://nabaperks.com`) vs sitemap `…/` —
  optional exact-parity alignment.
- [Low · schema] `SoftwareApplication` has no `image`/`screenshot` — add OG image + a product
  screenshot to harden app-result eligibility (needs a screenshot asset).

**Quick wins (off-page infra)**
- [Medium · platform] No Bing-index acceleration — add IndexNow + verify Bing Webmaster Tools.

**Strategic (weeks, off-page)**
- Build the entity: owned profiles → populate `sameAs` (#2) → earn first third-party/directory/press
  mentions (bridge Lapen Inns' press relationships) → Google-ecosystem footprint (a short scan→stamp→
  reward demo video).
- Deepen guides from ~660 → ~1,100–1,400 words with the operator's own worked examples; consider a 4th
  guide ("loyalty card GDPR for pubs") — the /how-it-works "Marketing by choice" section already shows
  that expertise but has no citable page.

**Verify (trust / factual)**
- [Low but trust-relevant] Site says "9 pubs across England" (9 named postcodes in `facts.ts`); June
  2025 trade press (Pub & Bar, Morning Advertiser) reported Lapen Inns "to eight". Most likely 8→9
  growth (press is ~1yr old, third lease was June 2025) so the site is probably current — but AI engines
  may surface the older "eight" against your "9". Confirm 9 is current and, ideally, refresh the press.

## Governance override — corrections to two subagent recommendations

The platform and visibility agents suggested adding a **`Person`/`founder` node**, **Companies House
number (15111022)**, and Companies House to `sameAs`. **Do NOT act on those** — they directly violate
the repo's own `scripts/check-banned-claims.mjs` guardrail (bans `founder`, `company number`,
`Companies House`, personal `linkedin.com/in/`, registered office). The E-E-A-T grounding must stay
**Organization-only**: company Facebook/LinkedIn(`/company/`)/Crunchbase/G2, and the `lapeninns.com`
link. This is a deliberate, enforced policy, not an oversight.

## Corrected false positive
`/guides/reward-regulars-without-an-app` meta description was reported as 163 chars → **verified 153**
(UTF-16 length / code points; 155 bytes due to the em-dash). Within the 145–159 target. Not a finding.

## Deploy-stable strengths (confirmed, don't re-audit)
SSR/RSC — all marketing HTML fully server-rendered (AI crawlers see everything with JS off); hero LCP is
a server-rendered inline SVG QR (no client `qrcode` bundle, 0 `<img>`); robots welcomes all 9 AI crawlers
with no marketing-route collision; 14-URL sitemap valid; canonicals self-referential; strong live
security headers (HSTS preload, full CSP, X-Frame DENY); llms.txt excellent; JSON-LD graph fully
connected with byte-synced FAQ/HowTo and no `Person` (Organization-only by design); `aggregateRating`
correctly absent (testimonials approval-pending — do not fabricate).

# Marketing & Landing Audit — 2026-07-05

Post-ship audit of the marketing restructure (conversion spine + 4 persona spokes +
3 guides), run across four lenses: SEO/GEO, copy & conversion, design/UX & a11y,
and code correctness. **All actionable findings were fixed in the same pass**;
this report records what was found, what changed, and what was deliberately left.

Verification at fix time: `pnpm typecheck` ✓ · `pnpm test` (276 micro-spec +
232 unit) ✓ · `pnpm governance:check` ✓ · `pnpm build` ✓ ·
`scripts/check-banned-claims.mjs` ✓ · `scripts/check-jsonld.mjs` ✓ · rendered
HTML spot-checked against the live dev server.

## P0 — fixed

### Cancellation terms contradicted each other (trust + ASA material-information risk)
- `final-cta.tsx` stacked "Card required — cancel anytime" beside "Cancel on a
  month's notice"; bare "cancel anytime" appeared ~10 places while the real
  notice period was disclosed only on /pricing.
- **Fix:** single-sourced in `lib/marketing/facts.ts` —
  `PRODUCT.cancelLine` ("Card required — cancel anytime, one month's notice.")
  and `PRODUCT.cancelChip`. Every surface (hero reassurance, landing FAQ ×2,
  trust-pricing ×2, final CTA, about, pricing ×4, signup ×2) now renders the
  constant; no bare "cancel anytime" remains in rendered source.
- Contract updated: `tests/micro-specs/marketing-auth-legal.test.mjs` now
  asserts the constant exists, each acquisition surface references it, and
  `doesNotMatch(/cancel anytime/i)` on raw source — the old incomplete claim
  can never come back silently.

## P1 — fixed

1. **Cafe/takeaway/bar spokes were one template, noun-swapped.** Pain-point
   bodies and benefits (bullets 2–5 identical) rewritten venue-true: cafe
   (coffee queue, morning rush, punch cards in the wash, daily habit), takeaway
   (cash-only till, wait-for-collection stamping, counter heat/steam,
   Friday-night order), bar (mid-round scan, last orders, midweek nudge).
   Cross-spoke repeats ("phone never crosses the counter" ×3) reduced to one
   home (pub hub). Kept within approved vocabulary — no "chippy"/"bubble tea",
   no first-person operator claims (PS-2 guard).
2. **Persona titles exceeded 60 chars (SERP truncation).** Now:
   Pub 53 · Cafe 54 · Takeaway 57 · Bar 58 (incl. "| Nabaperks").
3. **Dead components.** `mid-page-cta.tsx`, `operator-proof.tsx` deleted with
   their barrel exports. `jump-nav.tsx` **deliberately retained** — pinned by
   `micro-specs/platform/landing-conversion-spine.md:101` (a marketing-polish-p3
   styling contract reads the file).
4. **"for many cafes" hedge on generic pages** → "for many venues"
   (trust-pricing, /pricing).

## P2 — fixed

- **Meta descriptions trimmed** to 145–159 chars on all 10 marketing routes
  (were 184–242), price + pilot hook preserved.
- **Mobile hero parity:** mobile now carries "no Apple or Google Wallet pass"
  and the authority line (812 stamped / UK tills), matching desktop's beats.
- **/how-it-works schema parity:** now emits `glossarySchema()` +
  `counterLoyaltyIndexDataset()` (terms and index are visible on the page;
  JSON-LD guard green).
- **One FAQ face:** pricing's hand-rolled accordion (which also lacked a
  focus-visible ring) replaced by shared `FaqDetailsList` extracted from
  `LandingFaq`; landing/how-it-works unchanged visually.
- **About title doubling** ("About Nabaperks | Nabaperks") → "About | Nabaperks";
  about description tightened via the OPERATOR template.
- **Wording drift:** "gamed" → "faked" (pub pain, paper-vs-QR guide description).
- **Orphan `id="fit"`** removed from the 3 spokes.
- **Persona "See more →" tap targets** → `min-h-11` (≥44px).

## Deliberately NOT changed (do not re-flag)

- **`/signup` stays in the sitemap** — `tests/e2e/public-route-metadata.spec.ts`
  pins it as part of the approved indexable route registry.
- **`jump-nav.tsx` file retained** — spec-documented (see P1-3 above).
- **Home H1 "The loyalty card that just opens."** — owner-approved spine copy;
  the audit suggestion was an A/B test, not a code fix. Eyebrow + body carry
  the who/what.
- **Sitemap omits `lastModified`** — documented honesty call in `app/sitemap.ts`.
- **Counter-Loyalty Index stats** — real first-party data, attributed + dated
  in visible copy; testimonials remain approval-pending by design.
- **`organizationSchema().sameAs` empty** — no real external profiles yet;
  add when they exist.
- Redeem/collect + poster copy forks; pricing FAQ answer "One month's notice
  from your billing page, any time" (already precise).

## Known follow-ups

1. **Visual baselines are stale** — copy changed on /, /pricing, all four
   spokes and the hero, so `@visual` snapshots will differ. Refresh darwin
   baselines locally (screenshot run overwrites) and linux twins from CI per
   the established runbook after push.
2. Named competitors ("Stamp Me", "Loopy Loyalty") in FAQ/comparison stay
   accurate today — keep on a periodic review cadence.
3. Curly-quote normalisation in `counter-verified-stamp.tsx` (cosmetic) was
   out of scope and remains.

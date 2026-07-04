# Copy duplication & drift — cross-surface audit

_Generated 2026-07-04. Companion to `copy-inventory.md` (the full 2,190-string catalogue)._

**What this is:** an inventory-driven pass over every user-facing string on the landing site,
merchant `/app`, admin console, customer PWA, and shared/notification layer, looking for the
"internal copies" problem — the same message hardcoded in many places (drifts silently) and the
same idea worded several different ways (reads as an inconsistent product).

## Scale

| Surface | copy rows catalogued |
|---|---|
| Landing / marketing / legal | 612 |
| Merchant `/app` | 950 |
| Admin + public storefront | 422 |
| Customer PWA + flows | 539 |
| Shared UI + system + notifications | 231 |
| **Total** | **2,754 rows → 2,190 distinct strings** |

Signal found: **14** substantive strings duplicated across 2+ surfaces, **97** short labels shared
across surfaces (mostly expected), **73** strings repeated 3+ times inside a single surface, and
**34** near-duplicate clusters (same idea, different wording).

**Method & caveats.** Exact-match after normalising case/whitespace/quotes, plus a 5-word-prefix pass
for near-duplicates. Two files (`lib/notifications/venue-announcement-form-copy.ts`,
`components/layout/admin-shell.tsx`) were read by two extractors, creating 19 same-file "duplicates" —
these are **excluded** as artifacts, not real duplication. Snapshot of `main` @ `12617c3b`.
`app/dev/**` harnesses excluded from counts.

---

## P0 — Contradictory / stale copy (fix first: this is wrong, not just repetitive)

The customer-facing loyalty **terms** exist twice with the redemption instruction drifted apart:

| Where | The clause it renders |
|---|---|
| `lib/legal/content.ts:117` | "The assigned reward can be **redeemed** from the next UK business day after it is revealed. **Tap redeem from your reward page** while you are at the venue." |
| `app/merchant/[merchantSlug]/terms/page.tsx:72` | "The assigned reward can be **collected** from the next UK business day after it is revealed. **Show your reward QR at the counter and the venue team scans it** to collect." |

Same clause, **opposite mechanics** — self-serve tap vs. merchant-scan. Redemption is merchant-scan-only,
so the `content.ts` "tap redeem from your reward page" text appears **stale**. Decide the true one and
make both render from a single source. (The storefront terms page imports `getMerchantJoinContext`, not
`lib/legal/content.ts` — it reproduces the clauses inline, which is why they drifted.)

Related sentinel-string risk: `"No additional exclusions configured."` is used as a fallback in
`lib/legal/content.ts:122` **and** `app/merchant/[merchantSlug]/terms/page.tsx:77`, and is compared by
string equality in `components/customer/reward-list-cards.tsx:23`
(`if (terms === "No additional exclusions configured.")`). Change the wording anywhere and that
equality check silently stops matching. Should be a shared constant, not a literal.

---

## Tier 1 — Same substantive copy hardcoded across surfaces (14)

Consolidation candidates — each should live in one module and be imported.

| Copy | Appears in | Locations |
|---|---|---|
| "Something's under there." (mystery teaser) | Landing + Merchant + Customer | `hero-sample-card.tsx:16`, `launch/customer-card-preview.tsx:126`, `customer-card-experience.tsx:108,333` |
| "Mystery reward stays sealed until the final stamp." | Merchant + Customer | `launch/customer-card-preview.tsx:127`, `customer-card-experience.tsx:130`, `stamp-collector.tsx:249` |
| "New here? Scan a venue's QR code to collect your first stamp…" | Landing + Customer | `app/start/page.tsx:58`, `app/home/login/page.tsx:55` |
| "This loyalty programme is unavailable right now." | Merchant + Customer | `lib/merchant/reward-collection.ts:154`, `lib/customer/experience/block-reasons.ts:77` |
| "This browser can receive loyalty updates." | Customer + Shared | `push-notification-settings.tsx:352`, `lib/notifications/catalog.ts:112` |
| "A reward is waiting for you" | Customer + Shared | `app/claim/[token]/page.tsx:119`, `lib/notifications/reward-invite-email.ts:66` |
| "Card required — cancel anytime" | Landing ×3 + Merchant | `mid-page-cta.tsx:31`, `trust-pricing.tsx:84`, `final-cta.tsx:42`, `(auth)/signup/page.tsx:18` |
| "Your first stamp is waiting" | Landing + Merchant | `final-cta.tsx:15`, `(auth)/signup/page.tsx:42` |
| "Dessert on the house" (sample reward) | Landing + Merchant | `hero-sample-rewards.ts:6`, `lib/merchant/reward-presets.ts:38` |
| "Back to the counter" | Merchant + Shared | `(auth)/login/page.tsx:93`, `components/auth/auth-form.tsx:278` |
| The 4 loyalty-terms clauses ("A mystery reward is assigned…", "Collect {n} visit stamps…", "Ask the venue team", "No additional exclusions configured.") | Landing + Admin/storefront | `lib/legal/content.ts` ↔ `app/merchant/[merchantSlug]/terms/page.tsx` (see P0) |

---

## Tier 2 — Terminology drift (same concept, inconsistent word)

The product speaks in several vocabularies for the same things:

| Concept | Competing words in the UI | Notes |
|---|---|---|
| Get the reward | **redeem** vs **collect** | Split across legal terms, errors, buttons. Tied to the redemption-model wording — pick one verb. |
| Reward availability line | "**Valid** / **Redeemable** / **Redeem** / **Available** / yours from the next UK business day" | 5 phrasings: `reward-presets.ts` & `default-reward-pool.ts` ("Valid"), `loyalty-card-copy.ts` ("Redeem"), `seed.sql` ("Redeemable"), `home/(authed)/rewards/page.tsx:60` ("Available"), `join-welcome-step.tsx:95` ("yours"). |
| Trust claim | "**counter-verified**" vs "**till-verified**" stamps | Marketing copy inconsistent (flagged in landing slice). |
| Venue types | "Pubs & **Cafes**" vs "pubs, **cafes and takeaways**" vs "**café**" (accented, demo only) | Casing + scope + accent drift across metadata/hero. |
| The person | "**Members**" vs "**Customers**" vs "**Member**" | Merchant nav/labels vs admin vs activity feed. |
| Loading ellipsis | "Saving**…**" (…) vs "Saving**...**" (3 dots) vs "Starting camera**...**" | Mixed ellipsis glyphs across buttons. |
| Brand | "Nabaperks" vs "Powered by **nabaperks**" (lowercase) | Poster footer lowercases the wordmark. |

> Also worth deciding: the customer app reads **"Nabaperks"** everywhere; **"Stampiee"** (the prod
> project name) appears nowhere in-product. Confirm the intended public brand.

---

## Tier 3 — Near-duplicate variants (same message, worded 2–3 ways)

Not exact dupes, so they can't be swapped 1:1 — but they should be reconciled to one phrasing.
34 clusters total; the clear ones:

- **Onboarding gates (Merchant):** "Complete merchant onboarding before saving **a card** / **rewards** / **a birthday reward**." · "Add your venue before you build your **loyalty card** / **reward pool**." · "Add at least 3 active mystery rewards **before launching the QR** / **so the final stamp can reveal a prize**."
- **OTP prompts (Customer):** "Enter the code we sent to **your email to confirm it** / **{email} to finish your profile** / **{email} to verify it**."
- **Reward-collection errors:** "This reward could not be collected. **Refresh and try again** / **Try again or refresh**."
- **Camera permission (Merchant):** "Allow camera access in your browser **and use HTTPS or localhost** / **, make sure you are on HTTPS or localhost**, then try again."
- **Hero subhead (Landing):** "Reward regulars without an app" has two divergent long-form versions ("…or a CRM. One venue QR **covers** the bar…" vs "…One venue QR **for** the bar…").
- **CTA subhead (Landing):** "Build your card, preview the QR flow, and start a **30-day free pilot. Card required** / **30-day pilot. Then it is £29/month…**."
- **About line (Landing):** "Nabaperks is built and run by Lapen Inns **— a** / **, a** hospitality operator…" (em-dash vs comma).
- **Save-the-card (Customer):** "Save the card to your number **with one text, no app** / **— one text, no app**."
- _Non-issue (left as-is intentionally):_ "Point your camera at the **QR on the member's phone**" (merchant scanning) vs "at the **venue QR on the table**" (customer scanning) — genuinely different actions.

---

## Tier 4 — Within-surface duplication (contained cleanups)

| Surface | Duplicated string | ×  | Fix |
|---|---|---|---|
| Merchant | QR poster copy — "Scan to claim your free stamp", "Everyone wins something", "Powered by nabaperks", "Nabaperks QR code", "Stamp {n} earned" | ×3 each | The 3 poster templates (`poster-copy.ts`, `northstar-poster.tsx`, `thermal-poster.tsx`) re-hardcode the same lines; `poster-copy.ts` should be the source. |
| Merchant | "Proceed to billing" | 5 | across launch/billing/qr/loyalty-card surfaces |
| Merchant | "Your account is created" | 4 | launch/billing/rewards panels |
| Customer | "Open my cards" | 12 | every `error.tsx` hardcodes it — one shared recovery button |
| Customer | "Mystery reward, sealed" | 4 | join steps + reward-seal |
| Customer | "Ask a team member for the current loyalty QR." | 3 | `q/[qrId]`, `m/[slug]`, `join-wizard` |
| Customer | "This loyalty card is unavailable" | 3 | same three files (paired with the line above) |
| Customer | "We'll send a one-time code by text." | 3 | login + join forms (only 1 is from `copy.ts`) |
| Landing | "Start free pilot" | 11 | primary CTA — fine to repeat, but candidate for one constant |

---

## Not a problem — don't chase these

- **Nav labels** ("Billing", "Members", "Activity", "Pricing", "Home", "Profile", "Fraud", "Audit")
  recurring between `console-nav.ts` / `customer-tab-bar.tsx` and their destination pages — expected;
  only worth a shared constant if you want nav↔title to always agree.
- **Brand name** "Nabaperks" and generic verbs ("Save", "Cancel", "Try again", "Log in", "Loading",
  "Close", "Sending…") — normal repetition.
- **Admin "Source: …" chips** (`Source: service-role admin readback`, `Source: audit_logs`,
  `Internal admin`) — deliberately internal operator labels, not customer copy.
- The **2 scope-overlap files** listed under Method — an artifact of how this audit was run.

---

## The underlying structural issue

Shared copy modules already exist but are **under-adopted**, which is why copy drifts:

| Module | Intended as source for | Reality |
|---|---|---|
| `lib/customer/experience/copy.ts` | customer app copy | only ~9 of ~285 customer strings resolve from it |
| `lib/legal/content.ts` | loyalty terms | storefront terms page forks it inline (P0) |
| `lib/marketing/facts.ts` | marketing facts/stats | venue list also duplicated in `venue-proof-data.ts` |
| `lib/merchant/loyalty-card-copy.ts` / `reward-presets.ts` | reward wording | reward-availability verb varies across 5 files |

**Suggested next step:** promote these four modules to real single-sources and migrate the Tier 1/3/4
strings into them, starting with P0 (legal terms) and the redeem/collect verb decision.

---

## Files

- `reports/copy-inventory.md` — full verbatim catalogue, all 2,190 strings, grouped by route/component.
- `reports/copy-slices/inv-{A-landing,B-merchant,C-admin,D-customer,E-shared}.md` — the five per-surface source inventories.

---

## Resolution — applied 2026-07-04

Landed on the `main` working tree. **typecheck ✓ · lint 0 errors · micro-specs 259/1\* · unit 232/0**
(\*the single micro failure is a pre-existing, unrelated primary-reward contract already in flight).
New module `lib/copy/product-copy.ts` — a dependency-free leaf home for copy shown in 2+ places.

**P0 — FIXED.** Corrected the stale redemption clause in `lib/legal/content.ts` ("Tap redeem from your
reward page" self-serve → "Show your reward QR at the counter and the venue team scans it"). This also
fixed the in-app legal sheet, which was rendering the stale text. Storefront
`app/merchant/[merchantSlug]/terms/page.tsx` now renders from `buildVenueTermsSections()` (inline fork
removed). Added `NO_ADDITIONAL_EXCLUSIONS` and used it in content.ts, the terms page, and
`reward-list-cards.tsx` (was a fragile string-equality sentinel).

**Tier 1 — FIXED.** `SEALED_REWARD_NAME`, `SEALED_REWARD_NOTE` (8 sites, landing+merchant+customer),
`LOYALTY_PROGRAMME_UNAVAILABLE` (2 code paths). Left as-is: "Dessert on the house" (illustrative
sample), "Back to the counter" (same-surface auth echo), "This browser can receive loyalty updates."
(UI-status label vs push payload — different roles, coincidental match).

**Tier 2 — FIXED.** `till-verified` → `counter-verified` (2 landing sites, canonical is counter-verified
22:2). Merchant `...` → `…` ellipsis (4 sites, matching house style). Left: "Powered by nabaperks"
lowercase (deliberate poster typography).

**Tier 4 — FIXED.** `OPEN_MY_CARDS_LABEL` (15 sites). Customer error/label copy →
`CARD_UNAVAILABLE_TITLE`, `ASK_TEAM_FOR_QR`, `MYSTERY_REWARD_SEALED_LABEL` (14 sites). Reused existing
`JOIN_PHONE_CODE_HINT`. Three source-scanning contract tests (customer-p2-polish, customer-error-
boundaries, marketing-polish) updated to assert the wired constant instead of the raw literal.

**RECLASSIFIED as NOT drift — no change (audit false positives):**
- **redeem vs collect** — deliberate domain split (collect stamps → redeem rewards; the merchant-scan
  step "collects" the reward). Verified counts: redeem+reward 81, collect+stamp 40, redeem+stamp 3.
- **Poster copy triplication** — concept posters intentionally ship their own copy (documented in
  `poster-copy.ts`).
- **Members vs Customers**, **Nabaperks vs Stampiee** — deliberate per prior decisions.

**DEFERRED (optional next batch — low value / decision-required / contract-guarded):**
- Merchant billing copy ("Proceed to billing" ×5, "Your account is created" ×4) — has period-drift and
  embedded-vs-standalone forms; needs careful handling. Nothing blocks it.
- "Card required — cancel anytime" (~10 sites) — intentional marketing reinforcement, guarded by the
  `marketing-auth-legal` contract test and woven into `PRODUCT.*`-interpolated sentences.
- "New here? Scan…" (2), "A reward is waiting for you" (claim↔invite email, 2) — clean but cross-domain.
- Tier 3 near-dup wording (onboarding-gate variants, OTP-prompt variants, hero subhead variants) — each
  a small wording judgement call.

---
spec_id: MS-analytics-merchant-activation-ledger
status: active
risk_class: rls-rpc-ledger
owner: codex
last_reviewed: 2026-07-10
allowed_blast_radius:
  - micro-specs/analytics/merchant-activation-ledger.md
  - micro-specs/evidence/MS-analytics-merchant-activation-ledger.json
  - supabase/migrations/20260710160000_merchant_activation_ledger.sql
  - lib/analytics/merchant-activation-contract.ts
  - lib/analytics/merchant-activation-events.ts
  - lib/analytics/funnels.ts
  - app/app/launch/layout.tsx
  - app/app/qr/actions.ts
  - app/admin/page.tsx
  - tests/db/merchant-activation-ledger.test.mjs
  - tests/unit/merchant-activation-funnel.test.mjs
  - tests/micro-specs/merchant-activation-ledger.test.mjs
  - tests/e2e/helpers/merchant-activation-ledger.ts
  - tests/e2e/merchant-activation-ledger.spec.ts
  - tests/e2e/merchant-activation-ledger.desktop.spec.ts
implementation_surfaces:
  - micro-specs/analytics/merchant-activation-ledger.md
  - micro-specs/evidence/MS-analytics-merchant-activation-ledger.json
  - supabase/migrations/20260710160000_merchant_activation_ledger.sql
  - lib/analytics/merchant-activation-contract.ts
  - lib/analytics/merchant-activation-events.ts
  - lib/analytics/funnels.ts
  - app/app/launch/layout.tsx
  - app/app/qr/actions.ts
  - app/admin/page.tsx
  - tests/db/merchant-activation-ledger.test.mjs
  - tests/unit/merchant-activation-funnel.test.mjs
  - tests/micro-specs/merchant-activation-ledger.test.mjs
  - tests/e2e/helpers/merchant-activation-ledger.ts
  - tests/e2e/merchant-activation-ledger.spec.ts
  - tests/e2e/merchant-activation-ledger.desktop.spec.ts
related_tests:
  - tests/db/merchant-activation-ledger.test.mjs
  - tests/unit/merchant-activation-funnel.test.mjs
  - tests/micro-specs/merchant-activation-ledger.test.mjs
  - tests/e2e/helpers/merchant-activation-ledger.ts
  - tests/e2e/merchant-activation-ledger.spec.ts
  - tests/e2e/merchant-activation-ledger.desktop.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
  - pnpm test:e2e -- --project=chromium --project=mobile-safari --grep "@MS-analytics-merchant-activation-ledger"
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for the declared verification gates.
  - Live database proof of forced RLS, service-role-only ACLs, replay-safe milestone writes, migration replay, and aggregate accuracy beyond one thousand accounts.
  - Live database proof that referral bonuses, reversals, manual adjustments, and non-QR stamp sources never count as a first customer stamp.
  - Browser proof that the gated admin console renders the authoritative merchant activation cohort on phone and desktop.
  - Source and payload proof that the cohort RPC returns aggregate facts only and exposes no owner, funnel, contact, customer, merchant, or provider identifiers.
approved_exceptions: []
---

# MS-analytics-merchant-activation-ledger — Durable merchant activation ledger and cohort reporting

## 1. Exact Goal and User-Visible Outcomes

Nabaperks can measure whether a newly created merchant reaches a usable venue,
card, three live rewards, venue QR, poster, billing, and first real customer
stamp without relying on inflated raw event totals. Internal operators see one
account-created cohort funnel in the gated admin console, while merchants never
wait for analytics and no raw identity or provider value leaves the first-party
system of record.

## 2. Blast Radius

In scope: one replay-safe Supabase migration, a server-only activation event
writer, first launch-entry and successful poster-email instrumentation, an
aggregate cohort loader and pure presentation contract, the admin overview
funnel, and focused DB/unit/source/browser proof.

Out of scope: Stripe checkout or webhook call sites, subscription mutation,
billing entitlement decisions, changing signup/OTP identity code, customer
journey behavior, browser analytics SDKs, public analytics routes, new cookies
or browser storage, and altering launch/setup UI. Billing callers belong to the
dependent billing-telemetry Micro-Spec; this spec may reserve their closed event
vocabulary and aggregate output columns so that seam does not require a second
reporting contract.

## 3. Strict Constraints and Assumptions

- Supabase remains authoritative. PostHog is an optional pseudonymous mirror
  and can never determine stage completion.
- `merchant_account_created` is the cohort anchor. Its server-resolved auth
  actor may link to the later `merchants.owner_user_id`; missing funnel
  attribution must not erase an otherwise valid account-created milestone.
- Funnel links contain only a UUID owner key and a 64-character lowercase HMAC
  key. The table is FORCE RLS with no anon/authenticated access and is never
  returned by the reporting RPC.
- Activation writes are service-role-only, use a closed event vocabulary and a
  bounded semantic idempotency key, reject unsafe timestamps, and resolve the
  merchant actor inside PostgreSQL.
- Venue, card, reward, and QR readiness are derived from current authoritative
  rows. Three rewards means at least three currently active reward-pool items
  on the active card. Venue readiness mirrors the launch contract: address is
  present and coordinates are present when geofencing is required.
- Poster readiness requires a live venue QR plus either an explicit poster
  print/download event or a poster email recorded only after provider success.
- A genuine first customer stamp is exactly `event_type='earned'`,
  `stamps_delta > 0`, a non-null earned business date, and
  `metadata.source='self_service_qr'`.
- The seven-day outcome is measured from first billing activation: yes when a
  genuine first stamp lands within seven days, no only after the window closes,
  and pending while billing or the window is incomplete.
- Reporting returns one aggregate row for a bounded cohort, not raw account
  rows, so PostgREST's 1,000-row cap cannot under-count the funnel.
- All server-side analytics calls are fail-open and scheduled after the
  response where Next.js permits; a launch page or successful poster email
  must not wait for the ledger or PostHog.

## 4. Decisions Already Made

- Add `occurred_at` and nullable `idempotency_key` to `product_events`, with a
  unique partial index on `(merchant_id, event_name, idempotency_key)`.
- Backfill `occurred_at` from `created_at`; keep `created_at` unchanged as the
  database receipt timestamp.
- Backfill valid owner/funnel links from existing account-created and
  email-verified events, then maintain them with a conflict-safe insert trigger.
- A first valid owner/funnel link wins. Later conflicting identities are
  ignored rather than overwriting attribution or breaking the merchant flow.
- Add service-role-only `record_merchant_activation_event` and
  `get_merchant_activation_cohort_facts` RPCs. The recorder returns the stable
  first-party event UUID; the cohort RPC returns counts and the median
  signup-to-poster duration only.
- Instrument first entry through `app/app/launch/layout.tsx`, leaving the
  heavily shared launch page unchanged. Record poster email only after Resend
  succeeds and replace the current PostHog-only awaited call.
- Replace the admin overview's raw eight-event pilot chart with the
  account-created activation cohort. Keep `/admin/pilot` as the separate
  merchant-to-redemption report.
- Default the admin overview to the trailing 30-day account-created cohort and
  label its mixed authoritative sources explicitly.
- Read the local Next.js layout and `after()` guides before implementation;
  layouts do not rerender for every client navigation, which matches a
  first-entry milestone, and repeated requests remain DB-idempotent.

## 5. Behavioral Requirements (EARS)

- **AL-1:** WHEN a valid attributed account-created or email-verified event is
  inserted, THE database SHALL create at most one conflict-safe owner/funnel
  link without exposing it to anon or authenticated roles.
- **AL-2:** IF an actor UUID, funnel key, timestamp, event name, metadata value,
  or idempotency key is invalid, THEN THE activation ledger SHALL reject or
  ignore that analytics input without mutating product state.
- **AL-3:** WHEN the same merchant milestone is recorded repeatedly or
  concurrently with the same semantic key, THE ledger SHALL retain one row and
  return the same event UUID.
- **AL-4:** WHEN a signed-in merchant first enters `/app/launch`, THE system
  SHALL schedule one `merchant_launch_entered` milestone without delaying or
  changing the rendered launch journey.
- **AL-5:** WHEN poster email delivery succeeds, THE system SHALL schedule one
  first-party `qr_poster_emailed` milestone; IF delivery fails, THEN no poster
  email milestone SHALL be written.
- **AL-6:** WHEN an internal admin loads the activation funnel, THE system
  SHALL count distinct account-created owners in the requested bounded cohort
  and derive later setup stages from authoritative merchant rows and ledgers.
- **AL-7:** WHEN a merchant has at least three currently active reward items on
  its active card, THE cohort SHALL count rewards ready at the third item's
  attainment time; fewer than three SHALL not count.
- **AL-8:** WHEN poster readiness is derived, THE cohort SHALL require a venue
  QR and the first successful print/download or email milestone.
- **AL-9:** WHEN first-customer-stamp facts are derived, THE cohort SHALL count
  only positive earned self-service QR stamps with a business date and SHALL
  exclude referral bonuses, reversals, manual adjustments, and other sources.
- **AL-10:** WHEN billing activation and first-stamp timestamps exist, THE
  cohort SHALL classify the seven-day outcome as yes, no, or pending relative
  to the supplied as-of time without double-counting an account.
- **AL-11:** WHEN the cohort contains more than 1,000 accounts, THE aggregate
  counts SHALL remain exact and the RPC SHALL still return one row.
- **AL-12:** THE cohort RPC SHALL return no UUID, HMAC key, contact value,
  customer identifier, merchant identifier, or Stripe/provider identifier.
- **AL-13:** IF first-party persistence or optional PostHog delivery fails,
  THEN THE launch page and poster-email success response SHALL remain governed
  only by their authoritative product operations.

## 6. Verification Criteria and Task Breakdown

Observable proof:

1. DB tests first fail for the absent columns/table/RPCs, invalid ACLs,
   duplicate writes, >1,000-account aggregation, stage derivation, stamp-source
   exclusions, tri-state seven-day outcome, and migration replay.
2. Pure tests first fail for the fixed stage order, strict RPC row parsing,
   30-day cohort window, median formatting, and no-identifier output contract.
3. Source-contract tests first fail until the launch layout and successful
   poster-email path use the fail-open activation recorder and the admin page
   uses the cohort loader rather than raw pilot-event totals.
4. Implement the replay-safe schema, link trigger, event recorder RPC, cohort
   RPC, FORCE RLS, service-only ACLs, indexes, and PostgREST reload.
5. Implement the server-only recorder, nested launch layout, success-only
   poster wiring, cohort loader, and activation funnel presentation.
6. Run the focused DB, unit, source, and tagged phone/desktop browser proofs
   during Red -> Green. When the spec is complete, commit code first and use
   `governance:advance MS-analytics-merchant-activation-ledger --to implemented`
   as the single complete recorded lifecycle boundary.

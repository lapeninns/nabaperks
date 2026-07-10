---
spec_id: MS-billing-state-durability
status: active
risk_class: migrations
owner: codex
last_reviewed: 2026-07-10
allowed_blast_radius:
  - micro-specs/billing/state-durability.md
  - micro-specs/evidence/MS-billing-state-durability.json
  - supabase/migrations/20260710150000_billing_state_durability.sql
  - tests/db/billing-state-durability.test.mjs
  - tests/micro-specs/billing-state-durability.test.mjs
implementation_surfaces:
  - micro-specs/billing/state-durability.md
  - micro-specs/evidence/MS-billing-state-durability.json
  - supabase/migrations/20260710150000_billing_state_durability.sql
  - tests/db/billing-state-durability.test.mjs
  - tests/micro-specs/billing-state-durability.test.mjs
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/billing.md
  - reports/merchant-journey-ux-audit-2026-07-09.md
related_tests:
  - tests/db/billing-state-durability.test.mjs
  - tests/micro-specs/billing-state-durability.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm test:db
required_playwright_projects: []
evidence_required:
  - Command output for every declared verification gate.
  - Local PostgreSQL proof that concurrent checkout reservations converge on one customer and one fenced attempt, while an interval switch cannot rotate an unrecognised attempt.
  - Local PostgreSQL proof that an older Stripe event cannot overwrite newer billing state and that provider terms and scheduled cancellation facts survive readback.
  - Local PostgreSQL proof that failed and expired webhook leases are reclaimable, active leases are busy, processed events are terminal, and stale workers cannot finalise a newer lease.
  - Migration replay plus exact table, function, RLS, search-path, and service-role-only ACL proof.
approved_exceptions: []
---

# MS-billing-state-durability — Order-safe billing state and recoverable webhook leases

## 1. Exact Goal and User-Visible Outcomes

Billing state remains correct across retries, concurrent tabs, delayed or
out-of-order Stripe events, and worker crashes. The application can durably
remember one Stripe customer and one current Checkout attempt per merchant,
show the exact monthly or annual terms Stripe supplied, show a scheduled
cancellation accurately, and recover abandoned webhook work without allowing a
stale worker to overwrite the recovered result.

## 2. Blast Radius

May add one replay-safe migration and focused source/local-PostgreSQL tests. The
migration may extend `billing_customers`, add one service-role-only Checkout
attempt relation, and add narrowly-scoped database functions for Checkout
attempt reservation, conditional billing-state application, and webhook lease
lifecycle.

Out of scope: Stripe network calls, Checkout or Portal UI, Next.js actions or
route handlers, marketing copy, changing loyalty entitlement rules, hosted
database writes, editing historical migrations, or changing the existing
merchant/admin read policy on `billing_customers` beyond exposing the new
non-secret plan readback columns through that same owner boundary.

## 3. Strict Constraints and Assumptions

- Existing `billing_customers` rows and the `trialing | active | past_due |
  cancelled | suspended` entitlement vocabulary remain valid. A pre-subscription
  Stripe customer is never represented by a permissive billing status.
- Pre-subscription customer and attempt state lives separately from
  `billing_customers`; it is not browser-readable and cannot make a venue
  launch-ready.
- One merchant owns at most one current Checkout attempt across both intervals.
  Its stable attempt UUID is the provider idempotency key; a separate short-lived
  lease UUID fences concurrent workers. A different interval cannot silently
  replace a bound or live attempt.
- Checkout customer binding, rotation, Session finalisation, release, and
  retirement use compare-and-swap semantics against the current lease/attempt.
  Provider recovery and expiration of a superseded Session are application-layer
  preconditions owned by MS-billing-checkout-recovery.
- Billing state is a complete provider snapshot, not a sequence of partial
  status patches. It includes provider subscription status, price id, recurring
  interval, unit amount, currency, current period end, and scheduled-cancellation
  facts.
- Versioned webhook writes carry Stripe `event.created` plus event id. A strictly
  older event for the same Subscription is a no-op. Equal timestamps are never
  ordered lexically by event id; they may reapply the freshly hydrated current
  Subscription so same-second provider changes converge. Unversioned exact-
  session/Portal reconciliation preserves the webhook cursor and still obeys
  the current Subscription's provider-created ordering.
- Webhook claims are database-atomic leases with unguessable UUID fences. Only
  the matching live fence may finalise or fail a claim; processed events are
  terminal and an active lease is not reported as a harmless duplicate.
- Every definer function fixes its search path, revokes default PUBLIC/anon/
  authenticated execution, and grants only the exact service-role signature.
  New internal tables force RLS and revoke all non-service-role table privileges.
- All timestamps and lease expiry decisions are made by PostgreSQL. Errors and
  return shapes contain no secrets, raw SQL, or cross-merchant data.

## 4. Decisions Already Made

- Add nullable authoritative plan columns to `billing_customers` for
  `stripe_subscription_status`, `stripe_subscription_created_at`,
  `stripe_price_id`, `billing_interval`, `unit_amount`, `currency`,
  `cancel_at_period_end`, `cancel_at`, `stripe_state_event_created_at`, and
  `stripe_state_event_id`. Constrain paired cursors, interval, non-negative
  amount, lower-case three-letter currency, and cancellation coherence without
  rewriting valid historical rows.
- Add one internal merchant-keyed Checkout state relation holding stable attempt
  id, interval, price id, exact success/cancel URLs, attempt lifetime, optional
  durable Stripe customer, worker lease, and an all-or-none Session id/URL/expiry
  tuple. Persisting exact parameters is required because an idempotency replay
  must send the same Stripe request.
- A claim returns `claimed`, `busy`, `existing`, `interval_conflict`, or `blocked`
  with only safe attempt fields. Concurrent same-interval claims retain one
  stable attempt id; only the claimant receives a new lease UUID. Customer
  disagreement and active/trialing/past-due/suspended billing fail closed.
- Customer binding and Session finalisation require the live worker lease.
  Releasing or lease expiry preserves the stable attempt and exact parameters so
  an ambiguous provider call can be recovered. Rotation/retirement require the
  exact current attempt and Session identities; applying a Subscription clears
  its completed attempt after authoritative billing commits.
- One conditional webhook billing function verifies the event lease, applies or
  rejects the complete snapshot using Subscription-created/event cursors, and
  marks the event processed in the same transaction. It returns applied/stale so
  callers can suppress stale side effects. A separate current-provider sync path
  uses the same Subscription ordering without advancing an event cursor.
- Replace insert/select/update webhook claiming with database functions that
  return `claimed`, `busy`, or `processed` and a lease UUID only for `claimed`.
  Fresh, explicitly failed, and expired unprocessed events are claimable;
  attempts are counted. Completion/failure require the matching lease UUID.
- A busy webhook claim is retryable work, not successful duplication. The consuming
  route returns a retryable non-2xx response; only `processed` is an idempotent
  2xx duplicate.

## 5. Behavioral Requirements (EARS)

- **SD-1 (authoritative terms):** WHEN a complete billing snapshot is applied,
  THE database SHALL persist its provider status, price, interval, amount,
  currency, period end, and scheduled-cancellation fields together.
- **SD-2 (ordered application):** IF a versioned billing snapshot is strictly
  older than the merchant's stored Stripe event cursor, THEN THE database SHALL
  leave every billing field unchanged and report that the snapshot was stale.
- **SD-3 (subscription replacement):** IF a snapshot concerns another
  Subscription created before the currently stored Subscription, THEN THE
  database SHALL not repoint the merchant even when the old Subscription's event
  arrived later. A newer-created Subscription may replace it.
- **SD-4 (cursor audit):** WHEN an equal or newer versioned current-provider
  snapshot applies, THE database SHALL advance the event cursor without treating
  event ids as sortable; WHEN an unversioned current-provider snapshot applies,
  THE database SHALL preserve the existing event cursor.
- **SD-5 (durable customer):** WHEN a Checkout worker binds a Stripe customer,
  THE database SHALL retain that mapping outside `billing_customers` and SHALL
  not change loyalty eligibility before a real Subscription snapshot.
- **SD-6 (attempt convergence):** WHEN concurrent same-interval claims run, THE
  database SHALL retain one stable attempt UUID/idempotency contract, grant at
  most one live worker lease, and SHALL NOT create parallel resumable attempts.
- **SD-7 (interval conflict):** IF a current recoverable attempt is for another
  interval, THEN a normal reservation SHALL return `interval_conflict`; only a
  rotation after exact recovery/retirement may replace it.
- **SD-8 (session fence):** WHEN customer or Checkout Session state is recorded,
  THE database SHALL accept it only for the matching live lease, reject stale or
  conflicting values, and preserve exact parameters/provider expiry for retry.
- **SD-9 (attempt completion):** WHEN an authoritative subscription snapshot
  applies for a merchant/customer, THE database SHALL clear that merchant's
  current Checkout attempt without deleting the durable customer mapping.
- **SD-10 (lease claim):** WHEN a new, failed, or expired unprocessed Stripe event
  is claimed, THE database SHALL issue a new lease UUID and expiry and increment
  its attempt count.
- **SD-11 (lease contention):** WHILE an unprocessed event has a live lease, THE
  claim function SHALL return `busy` without changing the lease; WHEN it is
  processed, THE function SHALL return `processed` permanently.
- **SD-12 (worker fencing):** IF completion or failure carries an absent or
  superseded lease UUID, THEN THE database SHALL reject it without changing the
  event row. A matching worker may finish after nominal expiry only if nobody
  reclaimed and replaced its UUID.
- **SD-13 (atomic event commit):** WHEN a versioned billing snapshot is handled,
  THE billing mutation or stale no-op and webhook processed marker SHALL commit
  together or both roll back.
- **SD-14 (least privilege):** IF an anonymous or authenticated client attempts
  to read, mutate, or execute the internal Checkout/webhook state interfaces,
  THEN PostgreSQL SHALL deny it; the service role SHALL have only the required
  table and function privileges.

## 6. Verification Criteria and Task Breakdown

1. Pin the schema/function/ACL contract with failing source tests and confirm
   that the absent migration fails for the intended reason.
2. Add the migration and prove on disposable local PostgreSQL: historical-row
   compatibility, constraints, exact terms readback, newer-then-older ordering,
   equal timestamp/current-snapshot idempotency, and unversioned cursor
   preservation.
3. Prove first claim, concurrent same-interval stable-id convergence/one live
   lease, customer bind fencing, parameter persistence, bound-but-unfinalised
   recovery, interval conflict, exact Session retirement/rotation, stale-worker
   denial, and attempt clearing on Subscription.
4. Prove fresh webhook claim, live contention, explicit failure retry, abandoned
   lease expiry/reclaim, stale-worker fencing, processed terminality, atomic
   billing+processed rollback, same-Subscription ordering, old-Subscription
   replacement denial, attempt counts, and exact RLS/ACL/search-path boundaries.
5. Replay the migration against the same local database, rerun all DB tests, run
   every declared gate, record evidence, and advance only after clean readback.

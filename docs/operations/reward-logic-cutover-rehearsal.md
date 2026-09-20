# Reward logic staged cutover rehearsal

Use this runbook with [the production runbook](production-runbook.md). The
production runbook remains authoritative for qualification, approval,
migration admission, application promotion, rollback and retained evidence.
This document defines the reward-logic-specific order and readbacks.

## Release boundaries

Ship three independently reviewed releases:

1. **Qualification harness.** Release only the transition-aware populated
   upgrade harness. It must preserve the dated stamp, reward timing, seeded
   audit and all existing populated invariants. The named activation migration
   alone may transform membership cycle `3/1` to `0/2`, and it must create one
   `cycle_opened_at_policy_cutover` audit row for cycle 1.
2. **Stage A compatibility support.** Release migrations 20260922100000 through
   20260922100200 plus the application consumer that reads database-owned
   collection state for both legacy `3/1` and activated `0/2` memberships. Do
   not include the Step 4 transform, policy-cutover presentation, minimum-spend
   policy, age gates, collection windows, messaging or suspension behaviour.
3. **Stage B activation.** After Stage A is the authenticated production
   baseline, release migrations 20260923100000 through 20261005100300 in
   timestamp order with the remaining application changes. Enter controlled
   maintenance before applying this suffix. Keep the Stage A application serving
   only the maintenance response while the Stage B schema is applied, then promote
   the 2026-09-26 legal content and Stage B application together before reopening
   customer traffic. This prevents the old July terms from describing the new
   05:00 venue trading-day rules and prevents Stage B callers from reaching an
   incomplete schema.

Never combine Stage A and Stage B merely because the combined worktree passes.
Each release needs its own exact commit, clean build, disposable database proof,
browser proof and protected-release evidence.

## Stage B production traffic fence

Stage B requires a project-wide Vercel WAF fence. It preserves the authenticated
Stage A deployment as the production alias while preventing customers from
seeing its July terms after the Stage B schema activates. Vercel documents that
[custom rules take effect immediately without a redeploy](https://vercel.com/docs/vercel-firewall/vercel-waf/custom-rules)
and that a matching bypass rule skips later custom rules while a deny rule stops
the request. The supported request-path, environment and action fields are in
the [rule configuration reference](https://vercel.com/docs/vercel-firewall/vercel-waf/rule-configuration).

Prepare and review these two temporary custom rules before the protected
release. Do not put them in `vercel.json`, because changing that file would
create another deployment and break the exact-baseline identity chain.

1. `reward-logic-release-probes`: match `Environment Equals Production` **and**
   `Request Path Is any of` `/api/health`, `/api/readiness`; action `Bypass`.
   Place it before the deny rule. These are the only exclusions: they are
   read-only release/readiness paths already exercised by the production
   workflow.
2. `reward-logic-customer-fence`: match `Environment Equals Production` **and**
   `Request Path Starts with /`; action `Deny`. Do not configure a persistent
   action, because an IP must not remain denied after the rule is removed.

The release owner must first run `scripts/release/deployed-baseline.mjs` through
the protected workflow and retain the full alias deployment ID and revision.
Publish both reviewed rules together. Then record all of these binary readbacks:

- unauthenticated requests to `/`, `/terms`, `/privacy` and `/sw.js` are denied;
- customer and provider write requests, including POST requests to
  `/api/auth/hooks/send-email` and `/api/twilio/inbound`, are denied;
- `/api/health` remains `200` and reports the same Stage A revision;
- the protected `/api/readiness` probe remains `200` with the same revision;
- a second authenticated `deployed-baseline.mjs` readback has the same alias,
  deployment ID and full revision as the first.

Only after those checks may the protected job write the Stage B schema. Keep the
rules published through candidate deployment and promotion. The normal
`before-promotion` alias readback must still equal Stage A; the immediate
post-promotion authenticated alias readback must equal the exact Stage B
candidate. The workflow health and readiness probes continue through the two
bypass paths.

After the Stage B alias readback and probes pass, remove both temporary rules in
one reviewed WAF publication. Recheck `/`, `/terms`, `/privacy` and `/sw.js`
without any special header, then repeat the exact public health/readiness and
authenticated alias readbacks. Any separately authorised signed Auth-hook
validation runs only after the fence is removed under the existing production
runbook; it is not a fence bypass or an identity probe. If the rules cannot be
read back, an excluded path differs, a customer path is reachable during the
schema interval, or the alias changes unexpectedly, stop without applying or
promoting another step.

The fence also denies Twilio status/inbound callbacks and every scheduled cron
route. Keep customer-message dispatch paused while it is active so the release
does not create callbacks that the Stage A application cannot accept. After the
fence is removed, verify one separately authorised signed callback against the
exact Stage B alias, invoke the notifications cron with its normal protected
credential until the bounded drain reports no due work, and read back the
notification queue age plus the recorded cron outcome. Reconcile any delivery
still marked pending with its provider status before enabling dispatch; do not
treat WAF removal alone as callback or queue catch-up proof.
Retain the before/after rule configuration, HTTP status receipts and both alias
identity records with the release evidence. This runbook does not authorise a
live WAF change; the protected production release remains the approval boundary.

## Local rehearsal target

Use a new task-owned Supabase/Postgres target. Confirm its project ID, container
names and host ports before any mutation. Do not reuse or reset an existing
local tenant. Keep its environment file mode `0600`, outside Git and out of
logs. Disable all delivery workers and provider transports.

When an authorised production data-only restore source and protected target are
available, restore only into that target. Treat the snapshot as PII: do not
print rows, do not copy it into the repository, decide retention explicitly,
and erase only the task-owned copy after evidence retention. Without a restore
source, record the missing prerequisite and run the synthetic populated upgrade;
do not describe synthetic data as production-shape proof.

For each stage:

1. Create the target from the exact preceding release baseline.
2. Record SHA-256 hashes of every candidate migration before application.
3. Run baseline unit/contract and database proof once.
4. Apply the candidate suffix in ledger order with `ON_ERROR_STOP` behaviour.
5. Recalculate migration hashes. Any changed byte requires a clean recreation;
   never rely on a ledger entry for an edited draft.
6. Run the focused reward, trading-day, messaging, window and suspension
   scenarios, followed by the required aggregate database gate.
7. Run the populated-upgrade baseline, candidate and rollback application probes
   against the upgraded schema. Every probe must preserve the upgraded snapshot.
8. Run the rolled-back staging arc: join, earn three dated visit stamps, issue
   the cycle-1 reward, observe membership cycle `2` with count `0`, prove it is
   unavailable on the earning trading day, advance only the synthetic reward to
   its next-trading-day boundary, collect it, and prove the transaction rolled
   back.

## Required binary readbacks

The activation rehearsal passes only when all of these are true:

- the populated membership changes from cycle/count `1/3` to `2/0`;
- exactly one cycle-1 stamp reward remains and its identity, name, terms,
  `redeemable_from`, `expires_at`, `redeemed_at` and `created_at` are unchanged;
- the dated visit stamp retains its `earned_business_date` and `created_at`;
- exactly one `cycle_opened_at_policy_cutover` audit row records cycle 1;
- the invariant `active_cycle_number = 1 + count(distinct stamp-cycle reward
cycle_number)` has zero violations;
- no membership with an open cycle reward remains at or above its card threshold;
- two recovery sweeps leave `reward_cycle_heal_failures` empty;
- no new join recovery has reason `billing_unavailable`;
- baseline named-argument calls still resolve for card, reward-pool, birthday,
  direct reward, invite and notification-delivery RPCs on the upgraded schema;
- public RPC signatures and grants exactly match the reviewed catalogue.

Record read-only production results immediately after activation and repeat
them at +24 hours and +7 days. A successful migration, health endpoint or build
does not replace these data readbacks.

## Stop conditions

Stop before application promotion if a migration byte changes, an application
probe fails, a counter or immutable timestamp changes unexpectedly, a required
audit row is missing/duplicated, an RPC becomes ambiguous, or any required proof
is missing, skipped or stale. Preserve the failed artifact and rebuild the
disposable target from the exact preceding baseline before retrying.

# Nabaperks production runbook

Owner: Lapen Inns product operations  
Technical service: Nabaperks  
Public origin: `https://nabaperks.com`  
Hosting: Vercel  
Database and auth: Supabase (`skonlhwstejberyzobep`, EU West 2)  
Escalation inbox: `info@lapeninns.com`

## Release entry criteria

Do not promote a release until all of these are true:

1. Relevant CI checks pass for the release revision.
2. Required branch-protection checks pass.
3. The stable `Release gate` and CodeQL checks are selected as Vercel
   Deployment Checks, so a build cannot receive production domains early.
4. `pnpm env:check:production`, `pnpm security:audit`,
   `pnpm smoke:supabase:migrations`, `pnpm typecheck` and `pnpm build` pass.
5. The target Supabase migration ledger matches `supabase/migrations`.
6. The `Cost-neutral ephemeral release proof` passes for the exact revision
   against a fresh Supabase CLI stack and the loopback production build. If the
   optional hosted-staging path is later activated, its isolated Supabase
   project and Vercel custom `staging` environment must pass as an additional
   gate.
7. Provider acceptance is recorded for the target environment. Stripe is a
   separate final gate and cannot be inferred from test mode.
8. A rollback candidate (the last healthy Vercel production deployment) is
   identified before promotion.

### Operator-only release qualification

The release ledger compares the exact candidate with the authenticated deployed
baseline. Individually reviewed factory and Vercel-governance tooling is outside
the deployed application. New files under those directories are not implicitly
exempt: unlisted files still require compatibility proof.

A changed `package.json` remains a runtime change unless its exact baseline and
candidate Git blobs prove that only the six enumerated test/factory/benchmark
scripts changed. All dependencies, package-manager settings and other metadata
must match. The audited build, start, prepare and credential-check commands must
match their expected values, with no additional production lifecycle hooks.
Both package blobs are retained in qualification evidence and reread from Git
before every later release stage. A changed build command, dependency, lockfile,
application file or migration still requires populated upgrade and rollback
compatibility proof; this exception does not execute or replace that proof.

### Stripe live acceptance gate

Stripe is accepted only when an operator records all of the following against
the live account:

1. The live product and all three active Price IDs match the published terms:
   the one-time launch is GBP 299.99, the 28-day recurring Price is GBP 69.99
   with `interval=day` and `interval_count=28`, and the prepaid annual Price is
   GBP 699.90 with `interval=year` and `interval_count=1`. Obsolete prices are
   inactive for new checkout while historical subscriptions remain manageable.
2. Both subscription choices complete a controlled Checkout after the same
   28-day trial. The launch fee appears once, the chosen recurring cadence is
   correct, and the webhook-derived merchant billing record matches Stripe.
3. The billing page opens Stripe's payment-method-update flow and returns to
   `/app/account?tab=billing`. Cancellation is available only after the short
   Nabaperks exit review; choosing cancellation opens Stripe's
   cancellation-at-period-end flow and does not cancel immediately.
4. A signed webhook delivery reaches
   `https://nabaperks.com/api/stripe/webhook` on the pinned API version and
   returns a success response.
5. The event ID appears once in `stripe_webhook_events`, with a terminal
   processing state and no duplicate side effects.
6. The affected merchant subscription and entitlement readback match the
   Stripe subscription after the webhook is processed.

Record only masked customer/merchant identifiers, Stripe object IDs, UTC
timestamps, response status, and the database readback; never record secrets or
full webhook payloads.

## Promote and verify

1. Merge the independently reviewed branch through protected `main`; do not
   bypass checks. Merge from an account that is not the release reviewer. The
   `Production approval` environment uses `prevent_self_review` and has one
   reviewer, `amanshresthaa`, and every promotion runs as the account that
   merged. A promotion started by that reviewer's own merge can never be
   approved and holds the release slot until the janitor cancels it. Merge as
   `lapeninns` instead: promotion 35780140771 for `43f3dcb9` ran as
   `lapeninns` on 2026-09-22 and listed `amanshresthaa` as its eligible
   reviewer. A second eligible reviewer would remove this constraint; adding
   one is an environment setting reserved for the repository owner.
2. Wait for exact-main CI and CodeQL. The `Authenticate the deployed baseline`
   job then reads the live Vercel baseline without pausing: it uses the
   `Production` environment only for its read-only `VERCEL_TOKEN`. If the
   complete deployed-to-candidate difference is qualified internal
   documentation only, the run records `production-unchanged` evidence and
   skips staging, approval, database and application deployment, so it needs
   no approval. Record the existing production revision and the separate
   documentation candidate; do not report that candidate as deployed. See
   [change-aware CI](change-aware-ci.md). For application releases, the
   cost-neutral ephemeral proof must start a fresh Supabase CLI stack, build
   the exact revision on the loopback origin, verify the full migration ledger
   and authenticated readiness, replay signed webhooks, and roll back its
   synthetic loyalty journey. Credential-free qualification follows. If the
   optional hosted-staging path is active, wait for that additional gate as
   well.
3. Review the release, then approve the single `Approve production release`
   job in `Production database promotion`. It waits on the secret-free
   `Production approval` environment and records the approved revision and
   run attempt. This one approval covers the database promotion and the
   application deployment of that attempt; neither pauses again, because the
   `Production` environment that holds their credentials has no reviewer.
   The database job refuses an approval from a different revision or run
   attempt, and the application job accepts only the database stage from its
   own attempt, so rerunning a failed stage needs a fresh complete outer run
   and a new approval. The same outer run then calls the reusable application
   stage, `Production deployment`, while retaining the `production-release`
   concurrency lock. It builds and attests one immutable source revision,
   stages a Vercel build without domains, validates its full SHA, canonical
   project/team, READY state and immutable deployment ID, then promotes that
   ID. Immediate public proof remains inside the outer lock. This is one
   release run with one approval.
4. Record the deployment URL and Git commit SHA. Confirm that the
   `Deploy and prove the production alert receiver` step of the
   `Production deployment` job passed. Before promotion, every application
   release redeploys both the `production-alert` and `admin-webauthn` Supabase
   Edge Functions with `--no-verify-jwt`, requires each to be listed `ACTIVE`,
   and only then triggers and resolves the `release-canary` alert
   (`.github/workflows/production-deploy.yml`).
5. Verify the exact revision and both probes:

   ```sh
   curl --fail --silent https://nabaperks.com/api/health | jq
   curl --fail --silent \
     --header "Authorization: Bearer ${PRODUCTION_MONITOR_SECRET}" \
     https://nabaperks.com/api/readiness | jq
   ```

   Liveness must report `status=ok` and readiness must report
   `status=ready`, `checks.database=ok` and `checks.operational=ok`. Its
   `signals` object must include eight cron jobs plus numeric queue-age and
   provider-delivery fields. Both probes must show the promoted revision.

6. Confirm `/` returns 200 and renders the public marketing site. Run
   anonymous smoke checks for `/signup`, `/privacy`, `/terms`, `/cookies`,
   `/merchant-terms`, `/data-processing`, `/login`, `/home/login`, and
   confirm every `/dev/*` route remains 404.
7. Complete one controlled merchant login, one customer login, one QR join,
   one stamp/redeem lifecycle, one email delivery and one OTP delivery in the
   target environment. Never use production customer data as a test fixture.
8. Confirm the automatically triggered `Production smoke` run verified the
   promoted Git SHA, then confirm the next scheduled availability-only run is
   also green. A manual dispatch with `expected_revision` remains available for
   rollback and incident verification.

## Promote the production database

The `Production database promotion` workflow is the only routine production
migration path. Successful `main` CI starts it automatically; it waits for
successful push-triggered CI and CodeQL runs for that exact SHA. After the
release proof and qualification it pauses once, at the secret-free GitHub
`Production approval` environment, before any job that writes with production
credentials can start.
Manual dispatch remains available for recovery and requires the full SHA at the
tip of `main` plus the literal confirmation `PROMOTE_PRODUCTION_DATABASE`.

Configure both environments before first use. `Production approval` holds
the decision and nothing else:

- permit deployments from protected branches only, matching `Production`;
- require the release reviewer, enable `prevent_self_review` and disable
  routine administrator bypass;
- add no secrets or variables. `pnpm ops:github:check` fails if any appear.

`Production` holds the credentials and has no required reviewer. Every job
that uses it for a write needs the approval job first; see
`tests/contracts/production-approval-gate.test.mjs`:

- permit deployments from protected branches only;
- add `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` and the same generated
  `SUPABASE_SEND_EMAIL_HOOK_SECRET` held by Vercel Production as environment
  secrets, plus `SUPABASE_PROJECT_REF` as an environment variable. Never use a
  source-owned fallback for the signing secret;
- add `VERCEL_TOKEN` and `PRODUCTION_MONITOR_SECRET` as environment secrets,
  the Vercel project ID, name and scope come from the reviewed
  `config/vercel-governance-contract.json` source contract;
- disable Vercel's automatic Git deployment for `main` when the build-once
  `Production deployment` workflow is activated, while retaining previews if
  desired.

### Zero-downtime monitor-secret rotation

Vercel sensitive values are non-readable after creation. Rotate the production
readiness credential with a bounded overlap; never export it from a deployment
or print either value:

1. Generate a new high-entropy value and add it to Vercel Production as
   `PRODUCTION_MONITOR_SECRET_NEXT`.
2. Deploy the reviewed revision that accepts both monitor-secret names. Prove
   `/api/readiness` accepts the existing and next values without recording
   either value.
3. Set the new value as `PRODUCTION_MONITOR_SECRET` in both the GitHub
   `Production` and unattended `Monitoring` environments.
4. Require a successful protected staged probe and scheduled public probe using
   the new value, then remove the obsolete repository-scoped copy.
5. Replace Vercel Production `PRODUCTION_MONITOR_SECRET` with the new value,
   remove `PRODUCTION_MONITOR_SECRET_NEXT`, redeploy, and repeat both probes.
6. Verify the next-name metadata is absent in Vercel and the monitor token is
   present only in the two least-privilege GitHub environments that consume it.

Abort and retain the overlap if either probe fails. Do not remove or overwrite
the only value accepted by the currently promoted deployment.

The cost-neutral database-promotion path creates a fresh Supabase CLI stack on
the GitHub runner, builds the exact revision with non-secret provider fixtures,
starts it on the fixed loopback origin, and proves the complete local migration
ledger, authenticated liveness/readiness, signed Stripe and Resend replay, and
the transactionally rolled-back core loyalty journey. It has no production
credential and cannot promote by itself; production database credentials
are released only after the `Approve production release` job succeeds in the
same run attempt.

If hosted staging is later funded, configure a separate GitHub `Staging`
environment before activating that stronger path. It may permit only `main`;
it must not reuse production data or provider credentials. Add these secrets:

- `STAGING_SUPABASE_ACCESS_TOKEN`, `STAGING_SUPABASE_DB_PASSWORD` and
  `STAGING_SUPABASE_DB_URL`;
- `STAGING_VERCEL_TOKEN`, `STAGING_VERCEL_AUTOMATION_BYPASS_SECRET`,
  `STAGING_MONITOR_SECRET`,
  `STAGING_STRIPE_WEBHOOK_SECRET` and `STAGING_RESEND_WEBHOOK_SECRET`.

Add `STAGING_SUPABASE_PROJECT_REF`, `STAGING_VERCEL_ORG_ID` and
`STAGING_VERCEL_PROJECT_ID` as environment variables. In Vercel, create a
custom environment whose slug is exactly `staging`, enable system environment
variables and Vercel Authentication, generate a dedicated Protection Bypass for
Automation secret, and configure its application variables with staging-only
Supabase, Stripe, Resend, Twilio and monitor credentials. The GitHub and Vercel
webhook secrets must describe the same staging endpoints so signed replay can
detect configuration drift.

Configure a GitHub `Monitoring` environment that permits only `main` and does
not require an interactive reviewer, because paging must continue unattended.
Store `PRODUCTION_MONITOR_SECRET`, `PRODUCTION_ALERT_WEBHOOK_URL` and
`PRODUCTION_ALERT_WEBHOOK_SECRET` there. The first is consumed only by the
scheduled public readiness probe. The receiver must validate the
`x-nabaperks-timestamp` and HMAC-SHA256 `x-nabaperks-signature` over
`<timestamp>.<raw-body>`, deduplicate on `dedupKey`, map `trigger` to an
immediate human page, and acknowledge both `trigger` and `resolve` with a 2xx
response. The webhook URL must be public HTTPS without embedded credentials,
query parameters or a non-standard port. Run IDs, the expected revision and a
random delivery ID are the only event identifiers sent; no customer or provider
payload is included.

The reviewed receiver is the `production-alert` Supabase Edge Function. Keep
the matching alert secret, `RESEND_API_KEY` and `RESEND_FROM` in Supabase
Function secrets, never in source. The service-role claim resolves the first
active internal administrator as the human recipient and fails closed if none
exists. Keep a
matching alert-secret copy in the protected GitHub `Production` environment so
the release workflow can prove a real trigger and resolution on the isolated
`release-canary` incident key before promotion. The canary must never use or
change either operational incident key.
The function verifies the signature before parsing, persists delivery and incident
state through service-role-only RPCs, and uses the delivery ID as the Resend
idempotency key. Configure the GitHub `Monitoring` URL and secret only after
the fixed workflow revision and receiver are live; otherwise an older workflow
could resolve an incident using its deprecated comment marker.

Review the migration files before approving the release. After exact-main CI
and CodeQL, the first `Production` job authenticates the deployed baseline
read-only and decides whether application deployment is required. Runtime
releases then run the cost-neutral ephemeral proof described above and qualify
compatibility on a fresh runner without production credentials. Only after
both succeed does `Approve production release` ask for the single approval,
and only after that approval does the database promotion job start.
That job runs a linked dry run immediately before applying forward-only
migrations and fails unless the remote and repository ledgers match. Never
repair, reset or seed production from this path. After successful database
application, the outer run invokes the reusable application workflow. It
generates signed source provenance and a CycloneDX SBOM, stages a hosted Vercel
build with no domain assignment, probes that URL and promotes its validated
immutable ID. The complete outer run retains `production-release`; the
application callee has no competing same-group lock. The admin activation and
bootstrap mutators share that lock, while the non-production recovery drill
uses its own group. Each admin mutator also has its own `Production approval`
job, so it keeps one human approval per dispatch.

Release-triggered `Production smoke` reads the single candidate or explicit
no-deployment artifact from the successful outer run and exact attempt. It
validates the originating workflow, repository, event and artifact identity.
A promotion requires successful candidate metadata and public proof. A
documentation-only outcome requires an independently verified Git difference
and probes the existing baseline revision. The outer run head SHA is not a
substitute for the actual deployed revision. Scheduled availability smoke
remains independent.

Manual recovery dispatches the outer `Production database promotion` workflow
with the full main-tip SHA and `PROMOTE_PRODUCTION_DATABASE`; it repeats
ephemeral proof and the forward-only database path. There is no standalone
application-only dispatch. A failure after database application is an
incomplete release and requires compatibility review before retry or rollback.
GitHub concurrency does not promise FIFO delivery: a newer pending run may
replace an older pending run. Main advancement while waiting for approval may
also invalidate the immutable main-tip guard. Inspect the last completed stage
and actual provider state before proceeding.

Every promotion shares the `production-release` concurrency group with
`cancel-in-progress: false`. A run waiting for its release approval keeps
that slot, so later automatic promotions queue behind it until the approval is
given, rejected or the run is cancelled. Environment approval waiting time does
not count against `timeout-minutes`: the gated job has not started on a runner,
so its timeout never arms, and GitHub reports the job's `started_at` as the
moment it reached the gate.

### Release stage evidence and compatibility admission

The release owner records `qualified → database-applied → candidate-ready →
promoted → verified` using `scripts/release/stage-ledger.mjs`. Every stage binds
the candidate full SHA, authenticated deployed baseline and rollback SHAs,
compressed source archive digest, migration filename/content digest, outer run
and attempt, preceding stage digest and successful evidence bytes. The latest
ledger embeds its predecessors; retain its matching external evidence and the
provider baseline readback as well. Generated evidence stays outside the
checkout so each command can recheck exact clean source identity.

Before database application, the protected job resolves the current public
alias through authenticated Vercel metadata and reads the alias again to reject
a concurrent change. It verifies the qualification and live alias immediately
before writes. The application job downloads the exact run/attempt database
stage, checks it before its first mutation, and rechecks the baseline before
promotion. Full provider alias readback must match the candidate after promotion
and after public proof, before the verified stage can be retained.

The workflow compares the complete baseline-to-candidate Git tree. Changes
limited to narrowly reviewed CI, operations, test and documentation paths can
qualify as unchanged runtime. This compatibility admission is separate from the
narrower documentation-only rule that avoids deployment entirely. Application,
dependency or schema changes run `scripts/release/qualify-runtime.mjs` on the
fresh qualification runner without production credentials. It builds
immutable probes from clean exact baseline/candidate commits with fresh frozen
dependencies, provisions a blank Supabase 17 project without provider secrets,
applies every baseline migration, inserts 18 synthetic records, then applies
the candidate suffix. Baseline, candidate and rollback application domain
functions execute real billing, loyalty and webhook RPCs on the upgraded
schema, with their mutations rolled back and populated invariants rechecked.
The producer currently requires identical numeric Node pins in baseline and
candidate and a matching executing Node version. A changed Node pin fails
closed until separate per-revision runtime provisioning is implemented.
The producer binds successful execution to the current release identity; no
workflow input accepts caller-supplied compatibility evidence. Selected domain
RPC proof does not replace the separate browser and signed-webhook staging job.

Name each new migration so it sorts after the latest existing filename in
`supabase/migrations`, not after today's date: the directory already holds
future-dated migrations. Production applies with `supabase db push --linked
--include-all`, which would still apply an earlier-dated file after later ones,
so production and a fresh database would run it in a different order.
`tests/contracts/migration-order.test.mjs` fails when a migration sorts at or
before its recorded high-water mark.

Before applying production migrations, the live ledger must be a contiguous
prefix of the qualified candidate and include every baseline migration. This
permits a previously completed migration step while refusing missing history,
remote-only migrations, or changed baseline SQL bytes. Full candidate parity
is still required after application. Retain the raw execution, immutable probe
artifacts and stage evidence with the release. The random disposable project is
stopped without backup after qualification; cleanup failure blocks release.

`vercel.json` disables automatic Git deployments. The protected release owner
uses the existing CLI build/deploy/promote path so database admission and
migration application finish before application promotion. Repository pushes
alone must never publish an application that requires a missing database RPC.

Evidence expires after one hour across the whole chain. If approval waiting,
main advancement, provider drift or a partial rerun invalidates it, start a
fresh complete outer run after reviewing the actual completed stages. A stale
ledger must not be redated or accepted to resume a consequential operation.

The `Production promotion janitor`
(`.github/workflows/production-promotion-janitor.yml`) runs every 15 minutes
(minute 9), whenever a new `Production database promotion` run is requested,
and on manual dispatch. GitHub delivers this repository's schedules sparsely,
so the promotion trigger is what bounds a stale wait in practice: a stale gate
only blocks anything once another promotion queues behind it. It lists active `Production database
promotion` runs on `main`, reads each run's pending deployments and measures
how long a `Production approval` gate has waited from the waiting job's gate
entry. The threshold is more than 75 minutes: the one-hour expiry plus headroom
for an approval already in flight. An approval past it can no longer pass the
evidence checks in the database or application job. The credential-holding
`Production` environment has no reviewer, so it never waits and the janitor
ignores it. The janitor re-reads the pending deployments, then rejects the stale gate with
the comment "Promotion janitor: Production approval exceeded the 1h
release-evidence expiry". If GitHub refuses that review, it cancels the run
instead; a `409` means the run already finished. The workflow token is not a
required `Production approval` reviewer, so in practice GitHub refuses the review with
`422` and the janitor cancels the run; the first live pass on 2026-09-22
cancelled a gate that had waited 408 minutes this way. Each action is recorded as a workflow
annotation and in the run summary. The janitor never approves, never touches
other workflows or environments and needs no secrets. After it acts, review
the completed stages and start a fresh complete outer run once a reviewer is
available; do not rerun the rejected attempt. Approval waiting time does not
count against `timeout-minutes`, so this janitor, not a job timeout, bounds how
long a stale gate can hold the release slot. To inspect its decisions locally
without writing, run
`GH_TOKEN="$(gh auth token)" node scripts/release/promotion-janitor.mjs --dry-run`.

### Administrator authentication policy

Administrator MFA is an explicitly accepted product risk. TOTP remains
disabled, and neither a passkey nor another second factor is required for the
admin console. `is_internal_admin()` therefore grants authority only when the
Supabase-authenticated user has a matching active `internal_admins` row. The
application repeats that active-membership check before creating any
service-role client.

The WebAuthn tables and verifier may remain deployed as dormant infrastructure,
but enrolment or possession does not change administrator authority. Do not run
the bootstrap or activation workflows as a prerequisite for database or
application promotion. Confirm instead that an authenticated active admin is
allowed, while an authenticated non-admin and an inactive admin are denied.

The release path keeps that dormant verifier deployed: every application
release redeploys the `admin-webauthn` Edge Function alongside
`production-alert` and fails unless both are `ACTIVE`. A failure there blocks
the release like any other deployment step; it is not evidence that
administrator authority depends on WebAuthn.

This policy increases the impact of a compromised primary account. It must not
be described as remediation of the administrator-MFA finding; record that
finding as accepted risk. Reintroducing mandatory MFA requires a separately
reviewed policy change, migration, recovery design and operator rollout.

### Passwordless Auth configuration sequencing

Database promotion installs the reviewed hook functions but deliberately does
not publish hosted Auth configuration. `Production deployment` then stages the
passwordless application and proves that its hook accepts the protected shared
secret while rejecting an alternate signature. It promotes that verified build
before enabling server-side enforcement so the public application no longer
offers a password flow when password-origin sessions begin failing closed.

Immediately after promotion, the workflow installs and live-probes the
PostgREST pre-request guard, then activates the reviewed hosted Auth
configuration through the Management API. That targeted update enables the
Postgres custom access-token hook and Send Email hook, publishes the protected
hook secret, and explicitly keeps TOTP, phone MFA, WebAuthn MFA and passkeys
disabled. Its readback must prove the exact hook URIs, disabled-factor booleans
and provider-held secret HMAC before the same non-delivering signed canary is
run at the public origin. Any failure after promotion leaves the passwordless UI
in place but holds the security release as incomplete until the missing
server-side activation is retried or the deployment is rolled back. It must
never be worked around by restoring password UI or weakening either guard.

If either canary, Auth update/readback or promotion fails, stop the release and
follow the rollback section. Do not substitute a source-owned hook secret or
re-enable password login. The canary uses a deliberately malformed signed body,
so it cannot create an alias, send an email or mutate an account.

## Rollback

Rollback when readiness is red for two consecutive probes, a P0/P1 regression
is reproduced, auth/session safety is uncertain, or ledger/billing behavior is
not trustworthy.

1. Freeze further merges and announce the incident owner.
2. Once the passwordless Auth configuration has ever been activated, a Vercel
   rollback candidate must also be passwordless-compatible. Resolve the
   candidate deployment's full Git SHA and run the source-owned guard before
   changing domains:

   ```sh
   node scripts/check-passwordless-rollback-revision.mjs "$HEALTHY_GIT_SHA"
   ```

   If the guard rejects the candidate, do not roll back to it: the hosted Auth
   hook would continue rejecting passwords while the old UI asked for one.
   Keep the current passwordless deployment serving and prepare a reviewed
   forward fix from the last passwordless-compatible revision. Do not disable
   the access-token hook to make an old password deployment usable.

3. Roll back only to the verified passwordless-compatible healthy deployment,
   then wait for Vercel to finish:

   ```sh
   vercel rollback "$HEALTHY_DEPLOYMENT_ID" --yes
   vercel rollback status nabaperks
   ```

4. Re-run `/api/health` and `/api/readiness`; record the restored revision.
5. If a forward-only migration caused the incident, do not edit or delete the
   applied migration. Add and verify a compensating migration on a disposable
   database, then deploy it through the normal gate.
6. If data repair is required, preserve an export/evidence snapshot first and
   use a reviewed, bounded SQL script. Never restore a full backup over live
   data without incident-owner approval and an explicit recovery plan.
7. Record timeline, affected users, data impact, provider state, commands,
   deployment IDs and the follow-up issue.

### Email sign-in rollback rules

[Customer email sign-in mode](#customer-email-sign-in-mode) describes each
`CUSTOMER_EMAIL_AUTH_MODE` value and when it may be raised. Two rules hold once
`full` has ever run in an environment:

1. Never set the mode below `existing` while email-only wallets exist. Those
   customers have no phone number, so with email off they cannot sign in at
   all. Before lowering the mode, check with a read-only query:

   ```sql
   select count(*) from public.customers
   where phone_hmac is null
     and email_verified_at is not null
     and coalesce(email, '') not like 'erased+%@privacy.invalid';
   ```

   Any count above zero means `existing` is the lowest safe mode. To stop new
   email wallets, set `existing`, not `off`.

2. Never roll the application back to a build without
   `findCustomerByVerifiedEmail` (`lib/customer/identity.ts`) once email-only
   wallets exist, for the same reason. Treat such a build as incompatible,
   like a password build after the passwordless cut-over, and fix forward.

If email delivery fails, leave the mode alone: the join page tells the
customer "Email codes are delayed. Try again shortly or use your phone." and
the phone path keeps working.

## Backup and recovery boundary

Supabase daily backups are enabled and must be checked before each high-risk
release. Point-in-time recovery is currently disabled, so operations must not
claim minute-level recovery. Backup availability is not restore proof: schedule
a non-production restore drill once isolated staging infrastructure is approved.

For each quarterly drill, use Supabase **Restore to a New Project** from a
completed physical backup. Name the target
`nabaperks-restore-drill-<YYYYMMDD>`, keep it in `eu-west-2`, and do not attach
Vercel, provider webhooks, Edge Functions or customer-facing DNS. Disable any
copied database cron or external extension work before verification. In the
protected GitHub `Recovery Drill` environment configure:

- `RESTORE_DRILL_PROJECT_REF`, `RECOVERY_RTO_MINUTES` and
  `RESTORE_DRILL_STARTED_AT` as variables;
- independently reviewed `RESTORE_DRILL_LINEAGE_JSON` and
  `RESTORE_DRILL_SOURCE_MANIFEST_JSON`, each with a separately pinned
  `RESTORE_DRILL_LINEAGE_SHA256` or `RESTORE_DRILL_SOURCE_MANIFEST_SHA256`;
- `RESTORE_DRILL_DB_URL` for the disposable target and a fine-grained
  `SUPABASE_BACKUP_READ_TOKEN` as secrets.

The environment requires an independent reviewer and permits only `main`.
Dispatch `Recovery drill` with the physical backup ID, matching target ref and
literal confirmation `VERIFY_NON_PRODUCTION_RESTORE`. It fails closed if the
target is production, outside the production organisation/region, not newly
created, unhealthy, outside the measured RTO, or inconsistent with the
reviewed backup lineage and source baseline. Lineage must bind the production
source, exact backup and recovery point, completed provider restore operation
and disposable target. The source manifest must contain the actually applied
migration ledger and aggregate row counts at that recovery point. Migration
filename dates cannot establish the historical ledger. Evidence digests must
be approved independently; hashing a submitted file inside the run does not
authenticate its provenance. RTO runs from the protected recovery start through
the completion of database verification, including its final clock read. Database verification runs
in a read-only transaction and checks forced RLS, core RPCs, valid constraints
and indexes, inactive database cron, and non-sensitive row counts. Retain the
generated evidence artifact for one year. Delete the disposable restored
project only after evidence review and separate operator approval.

## Alert acknowledgement boundary

The scheduled production smoke is the primary availability/readiness alarm.
On failure it first creates or updates the durable GitHub incident, then retries
the signed external page up to three times; paging still runs if GitHub issue
creation fails. A missing or rejecting paging
receiver fails the alert job visibly. On recovery, the workflow resolves the
external incident before closing the GitHub issue, but only after two
consecutive scheduled green runs. A deployment-triggered or manually dispatched
success cannot close an incident, and a new failure resets the recovery streak.
Successful green probes do not emit repeated resolve events when no incident is
open. A receiver 2xx means acceptance only; it does not prove provider delivery or
human acknowledgement. Prepare a controlled monthly rehearsal and obtain
explicit authorisation before sending its page. Record separate receiver
receipt, provider delivered event and human acknowledgement identifiers and
timestamps without copying the signing secret.

`config/independent-monitoring-contract.json` and
`scripts/recovery/monitoring-evidence.mjs` define the stronger independent
monitoring qualification. Detection and paging must not depend on GitHub or
the monitored production Supabase project. Their complete dependency inventory
includes scheduler, runtime, state store, DNS, secrets and delivery. The
current GitHub scheduler and Supabase receiver do not satisfy that independent
requirement. A reviewed evidence file is preparation for qualification, not
proof that an external monitor is configured or remains operational.

## Availability SLO and error budget

`config/production-slos.json` owns the production availability objective:
99% of observed scheduled Production smoke runs over a rolling 30 days. The
smoke cron is nominally every 15 minutes, but GitHub throttles scheduled
workflows and has delivered about 6.8 runs a day, so the report measures the
samples it actually observed instead of nominal cron slots. At that density a
30-day window holds about 200 samples, which leaves an error budget of two
failed runs. Missing scheduled runs are not counted as downtime. Instead, the
observed-sample floor requires at least four samples per observed day
(`minimumObservedSamplesPerDay`); a report below that floor is `breached`
because the monitor itself has stopped providing evidence. The ten-minute
evaluation lag excludes a probe that may still be running.

`Production SLO report` evaluates the window daily, retains its JSON evidence
for one year and starts measurement from its own first workflow run, so older
probe history from a different monitoring contract is excluded. The first
seven observed days are `warming`: the gate is red, but no page or incident is
created. After that minimum, an availability or observed-sample floor miss is
`breached`: the first breached run opens the durable GitHub incident and every
breached run triggers the external `availability-slo` page, which the receiver
deduplicates. Later breached runs do not comment on the open issue; each run's
evidence stays in its artifact and step summary. A later `compliant` result
resolves the external alert, then posts one recovery comment and closes the
issue.

Treat an error-budget breach as an incident signal, then classify current
customer impact using the P0/P1/P2 definitions. Freeze discretionary releases
while the budget is exhausted unless the incident commander records why a
release reduces risk. The metric is conservative: the scheduled run's
conclusion is the outage signal, so a failure elsewhere in the Production smoke
workflow, including a broken alert webhook, counts as unavailable even if its
HTTP probe passed.
The retained report also publishes `errorRate`, the failed scheduled-probe
ratio over the same observed window. Each scheduled run separately enforces the
3-second liveness and 5-second readiness network thresholds from
`config/production-slos.json`.

This SLO is hosted by GitHub and shares part of the release control plane. It
cannot detect a GitHub-wide failure independently and does not replace external
uptime monitoring or provider-native delivery and scheduler telemetry.
The protected readiness endpoint now supplies source-owned queue-age,
cron-failure and provider-delivery aggregates, but those signals still need
independent provider corroboration before claiming complete production
observability.

For the monthly GitHub control readback, authenticate `gh` as a repository
administrator and run `pnpm ops:github:check`. The audit reads only collaborator,
ruleset, environment, secret-name and variable metadata; it never reads secret
values. Retain the output with the release evidence and resolve every `FAIL`
before declaring provider readiness.

## Operational readiness signals

`/api/readiness` reads only aggregate values from
`production_operational_signals()`. It never returns customer identifiers,
destinations, payloads or provider responses. The endpoint becomes
`not_ready` when:

- the oldest due push event exceeds 30 minutes;
- the oldest due loyalty invitation exceeds 15 minutes;
- the 24-hour push/invitation provider failure rate exceeds 10%;
- any scheduled Vercel cron misses its bounded maximum gap; or
- a cron records one consecutive failed run.

New cron monitors have a bounded first-run `warming` state. After that window,
missing runs become `stale` and fail readiness. Inspect only the returned
aggregate signal and the relevant provider/job logs; do not copy raw
notification or invitation rows into incident evidence.

Read back the current state without exposing credentials:

```sh
supabase backups list --project-ref skonlhwstejberyzobep
supabase projects list
```

## Routine operating checks

- Daily: review the retained SLO report, failed Vercel deployments, scheduled
  smoke runs, cron failures, provider delivery failures and unresolved security
  alerts.
- Weekly: review Supabase backups, notification queue age, fraud/support queues,
  and dependency advisories.
- Monthly: rotate or review privileged keys, test rollback, review data
  retention jobs and update this runbook after any provider or architecture
  change.

## Customer email sign-in mode

`CUSTOMER_EMAIL_AUTH_MODE` is `off` unless set, which hides email on the join
page and makes every email sign-in action refuse. `existing` lets a verified
email open the wallet that holds it; `full` also lets email start a new wallet
on the join page. The add-your-email prompts and the email-conflict message
already read the mode, so setting it changes what guests are told about signing
in by email.

- **Precondition:** keep the mode `off` in an environment until the application
  build with the email sign-in and email join flows, and the database
  migrations it needs, are live there. Before that, a non-`off` value promises
  guests a sign-in method the build does not offer.
- **Terms:** before raising the mode above `off` in production, publish
  customer terms that describe joining by email as a new version: a new
  `CUSTOMER_LEGAL_VERSION` and `PLATFORM_TERMS_META` date and number in
  `lib/legal/content.ts`, with the matching `policy_version` guard migration
  and `tests/unit/legal-activation.test.mjs`, as the 2026-09-26 activation did.
  The terms in force until then describe joining by phone only, and joins
  record that version, so the text must not change under it.
- **Rollback:** while `full` has never run in the environment, set the mode
  back to `off` and redeploy. Collected and verified emails stay in place; no
  data migration is required. Once `full` has run, email-only wallets may
  exist, so follow the [email sign-in rollback rules](#email-sign-in-rollback-rules):
  `existing` may be the lowest safe mode.

## Venue code (location-check fallback)

Self-service stamping refuses a stamp when a phone's location is outside the
venue or the unverified-location grace is spent. The fallback is a six-digit
**venue code** that changes every day at 05:00 Europe/London and is shown only
on the owner's `/app` dashboard behind "Show code". A team member reads it out;
the member types it on their own phone and the stamp is issued through the
normal pipeline with only the location check bypassed. The code stands on its
own: a member whose phone cannot share location can use it without a failed
location attempt first (since `20260911120000`; the earlier rule that required
a server-recorded refusal within fifteen minutes was removed because any client
could manufacture that refusal, so it was not a control). Attempts are
throttled per membership, device, venue and network, and five wrong codes lock
the membership for fifteen minutes.

- **Reset a leaked code:** the owner ticks the confirmation under the dashboard
  card and presses "Reset code". The old code stops working immediately and
  the reset is audited (`venue_code_reset`) without the code itself.
- **Evidence:** every code-confirmed stamp carries
  `metadata->>'geo_verification' = 'venue_code'` on `stamp_events` and a row in
  `venue_code_stamp_receipts` whose `entry_context` is
  `after_location_refusal` (the code answered a recorded refusal, which is
  then marked reviewed in `fraud_flags`) or `direct_venue_code` (no prior
  refusal; the refusal columns are null). The owner activity feed labels these
  stamps.
- **Abuse review:** query `product_events` for `venue_code_rejected` and
  `venue_code_stamp_issued` per merchant and day. A venue whose code-confirmed
  stamps outnumber its GPS-verified ones deserves a look.
- **Rollback:** redeploy the previous application revision. The database
  objects stay in place and dormant; no data migration is required.

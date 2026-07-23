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

### Stripe live acceptance gate

Stripe is accepted only when an operator records all of the following against
the live account:

1. The live product and both active price IDs match the published monthly and
   annual GBP amounts, and obsolete prices are inactive.
2. A Customer Portal session opens for a controlled merchant and returns to
   `/app/account?tab=billing`; payment-method update, invoice history, and
   cancellation-at-period-end match the product copy.
3. A signed webhook delivery reaches
   `https://nabaperks.com/api/stripe/webhook` on the pinned API version and
   returns a success response.
4. The event ID appears once in `stripe_webhook_events`, with a terminal
   processing state and no duplicate side effects.
5. The affected merchant subscription and entitlement readback match the
   Stripe subscription after the webhook is processed.

Record only masked customer/merchant identifiers, Stripe object IDs, UTC
timestamps, response status, and the database readback; never record secrets or
full webhook payloads.

## Promote and verify

1. Merge the independently reviewed branch through protected `main`; do not
   bypass checks.
2. Wait for `Production database promotion`: its cost-neutral ephemeral proof
   must start a fresh Supabase CLI stack, build the exact revision on the
   loopback origin, verify the full migration ledger and authenticated
   readiness, replay signed webhooks, and roll back its synthetic loyalty
   journey before the protected production database job becomes eligible. If
   the optional hosted-staging path is active, wait for that additional gate as
   well. Then wait for `Production deployment`, which builds and attests one
   Vercel output, stages it without domains, verifies it and promotes that same
   output.
3. Record the deployment URL and Git commit SHA.
4. Verify the exact revision and both probes:

   ```sh
   curl --fail --silent https://nabaperks.com/api/health | jq
   curl --fail --silent \
     --header "Authorization: Bearer ${PRODUCTION_MONITOR_SECRET}" \
     https://nabaperks.com/api/readiness | jq
   ```

   Liveness must report `status=ok` and readiness must report
   `status=ready`, `checks.database=ok` and `checks.operational=ok`. Its
   `signals` object must include six cron jobs plus numeric queue-age and
   provider-delivery fields. Both probes must show the promoted revision.

5. Confirm `/` returns 404. Run anonymous smoke checks for `/signup`,
   `/privacy`, `/terms`, `/cookies`, `/merchant-terms`, `/data-processing`,
   `/login`, `/home/login`, and confirm every `/dev/*` route remains 404.
6. Complete one controlled merchant login, one customer login, one QR join,
   one stamp/redeem lifecycle, one email delivery and one OTP delivery in the
   target environment. Never use production customer data as a test fixture.
7. Confirm the automatically triggered `Production smoke` run verified the
   promoted Git SHA, then confirm the next scheduled availability-only run is
   also green. A manual dispatch with `expected_revision` remains available for
   rollback and incident verification.

## Promote the production database

The `Production database promotion` workflow is the only routine production
migration path. Successful `main` CI starts it automatically; it waits for
successful push-triggered CI and CodeQL runs for that exact SHA, then pauses at
the protected GitHub `Production` environment before credentials are released.
Manual dispatch remains available for recovery and requires the full SHA at the
tip of `main` plus the literal confirmation `PROMOTE_PRODUCTION_DATABASE`.

Configure the environment before first use:

- permit deployments from `main` only;
- require an independent reviewer and disable routine administrator bypass;
- add `SUPABASE_ACCESS_TOKEN` and `SUPABASE_DB_PASSWORD` as environment
  secrets, plus `SUPABASE_PROJECT_REF` as an environment variable.
- add `VERCEL_TOKEN` and `PRODUCTION_MONITOR_SECRET` as environment secrets,
  plus `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` as environment variables;
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
credential and cannot promote by itself; the independent `Production`
environment remains the only path that can release production database
credentials.

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

Review the migration files before approving the production environment gate.
The workflow first runs the cost-neutral ephemeral proof described above. Only
after it passes can the `Production` environment release credentials. The
production job runs a linked dry run immediately before applying forward-only
migrations and fails unless the remote and repository ledgers match. Never
repair, reset or seed production from this path. A successful run starts the
exact-revision production deployment workflow automatically. That workflow
generates signed build provenance and a CycloneDX SBOM, stages the exact
prebuilt output with no domain assignment, probes that URL and promotes it.
Public-origin smoke starts only after promotion.

## Rollback

Rollback when readiness is red for two consecutive probes, a P0/P1 regression
is reproduced, auth/session safety is uncertain, or ledger/billing behavior is
not trustworthy.

1. Freeze further merges and announce the incident owner.
2. Roll back to the previously identified healthy production deployment, then
   wait for Vercel to finish:

   ```sh
   vercel rollback "$HEALTHY_DEPLOYMENT_ID" --yes
   vercel rollback status nabaperks
   ```

3. Re-run `/api/health` and `/api/readiness`; record the restored revision.
4. If a forward-only migration caused the incident, do not edit or delete the
   applied migration. Add and verify a compensating migration on a disposable
   database, then deploy it through the normal gate.
5. If data repair is required, preserve an export/evidence snapshot first and
   use a reviewed, bounded SQL script. Never restore a full backup over live
   data without incident-owner approval and an explicit recovery plan.
6. Record timeline, affected users, data impact, provider state, commands,
   deployment IDs and the follow-up issue.

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

- `RESTORE_DRILL_PROJECT_REF` and `RECOVERY_RTO_MINUTES` as variables;
- `RESTORE_DRILL_DB_URL` for the disposable target and a fine-grained
  `SUPABASE_BACKUP_READ_TOKEN` as secrets.

The environment requires an independent reviewer and permits only `main`.
Dispatch `Recovery drill` with the physical backup ID, matching target ref and
literal confirmation `VERIFY_NON_PRODUCTION_RESTORE`. It fails closed if the
target is production, outside the production organisation/region, not newly
created, unhealthy, older than the configured RTO, or does not match the
migration ledger expected at the backup timestamp. Database verification runs
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
open. Test the receiver monthly with a controlled workflow dispatch and record
the receiver event ID, acknowledging operator and timestamps without copying
the signing secret.

## Availability SLO and error budget

`config/production-slos.json` owns the production availability objective:
99.9% over a rolling 30 days, measured from the scheduled 15-minute Production
smoke workflow with at least 95% evidence coverage. Failed workflow runs and
missing scheduled slots are reported separately: failures consume service error
budget, while missing slots breach the monitor-coverage floor and are not
mislabelled as confirmed downtime. The ten-minute evaluation lag excludes a
probe that may still be running.

`Production SLO report` evaluates the window daily, retains its JSON evidence
for one year and starts measurement from its own first workflow run, so older
probe history from a different monitoring contract is excluded. The first
seven observed days are `warming`: the gate is red, but no page or incident is
created. After that minimum, an availability or coverage miss is `breached` and
must create or update the durable GitHub incident and trigger the external
`availability-slo` page. A later `compliant` result resolves the external alert
before closing the issue.

Treat an error-budget breach as an incident signal, then classify current
customer impact using the P0/P1/P2 definitions. Freeze discretionary releases
while the budget is exhausted unless the incident commander records why a
release reduces risk. The metric is conservative: a failure elsewhere in the
Production smoke workflow counts as unavailable even if its HTTP probe passed.
The retained report also publishes `errorRate`, the failed scheduled-probe
ratio over the same observed window. Each scheduled run separately enforces the
3-second liveness and 5-second readiness network thresholds from
`config/production-slos.json`.

This SLO is hosted by GitHub and shares part of the release control plane. It
cannot detect a GitHub-wide failure independently and does not replace external
uptime monitoring, Sentry or provider-native delivery and scheduler telemetry.
The protected readiness endpoint now supplies source-owned queue-age,
cron-failure and provider-delivery aggregates, but those signals still need
independent provider corroboration before claiming complete production
observability.

For the monthly GitHub control readback, authenticate `gh` as a repository
administrator and run `pnpm ops:github:check`. The audit reads only collaborator,
ruleset, environment, secret-name and variable metadata; it never reads secret
values. Retain the output with the release evidence and resolve every `FAIL`
before declaring provider readiness.

The protected production deployment sets `SENTRY_RELEASE` to the full approved
Git SHA. The Sentry build integration must create that exact release and upload
its source-map artifacts successfully before Vercel promotion. After promotion,
`node scripts/check-sentry-release.mjs record-deploy` records the immutable
Vercel deployment URL and reads the production marker back from Sentry. A
release mismatch, wrong project, missing artifact upload, API failure or deploy
readback mismatch fails the protected workflow.

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

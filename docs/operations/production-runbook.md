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
3. `pnpm env:check:production`, `pnpm security:audit`,
   `pnpm smoke:supabase:migrations`, `pnpm typecheck` and `pnpm build` pass.
4. The target Supabase migration ledger matches `supabase/migrations`.
5. Provider acceptance is recorded for the target environment. Stripe is a
   separate final gate and cannot be inferred from test mode.
6. A rollback candidate (the last healthy Vercel production deployment) is
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

1. Merge the reviewed branch through protected `main`; do not bypass checks.
2. Wait for the Vercel production deployment to reach `Ready`.
3. Record the deployment URL and Git commit SHA.
4. Verify the exact revision and both probes:

   ```sh
   curl --fail --silent https://nabaperks.com/api/health | jq
   curl --fail --silent \
     --header "Authorization: Bearer ${PRODUCTION_MONITOR_SECRET}" \
     https://nabaperks.com/api/readiness | jq
   ```

   Liveness must report `status=ok` and readiness must report
   `status=ready`, `checks.database=ok`. Both must show the promoted revision.

5. Run anonymous smoke checks for `/`, `/pricing`, `/privacy`, `/terms`,
   `/login`, `/home/login` and confirm every `/dev/*` route remains 404.
6. Complete one controlled merchant login, one customer login, one QR join,
   one stamp/redeem lifecycle, one email delivery and one OTP delivery in the
   target environment. Never use production customer data as a test fixture.
7. Manually dispatch `Production smoke` with the promoted Git SHA as
   `expected_revision`, then confirm the next scheduled availability-only run
   is also green.

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

Read back the current state without exposing credentials:

```sh
supabase backups list --project-ref skonlhwstejberyzobep
supabase projects list
```

## Routine operating checks

- Daily: review failed Vercel deployments, scheduled smoke runs, cron failures,
  provider delivery failures and unresolved security alerts.
- Weekly: review Supabase backups, notification queue age, fraud/support queues,
  and dependency advisories.
- Monthly: rotate or review privileged keys, test rollback, review data
  retention jobs and update this runbook after any provider or architecture
  change.

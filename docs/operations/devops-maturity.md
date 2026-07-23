# DevOps maturity contract

Owner: Lapen Inns product operations
Scope: GitHub, GitHub Actions, Vercel, Supabase and production providers

This is the evidence contract for a 10/10 Nabaperks delivery system. Repository
configuration proves only the controls stored here. Provider settings and live
recovery exercises require separate readback before they may be marked complete.

## Target release path

1. A pull request receives an approval from an independent reviewer and every
   required GitHub check passes.
2. Protected `main` accepts the merge without a bypass.
3. GitHub's stable `Release gate` check covers build, repository quality,
   browser, accessibility, visual, Lighthouse, ZAP and live Supabase proof.
   CodeQL remains a separate required Vercel and GitHub check.
4. Before production credentials are released, a protected custom `staging`
   deployment replays the migration ledger, signed provider webhooks and a
   rolled-back merchant-to-reward loyalty journey against an isolated Supabase
   project.
5. After protected database promotion, GitHub builds one Vercel Build Output
   artifact, signs its provenance and SBOM, and stages that exact artifact
   without assigning production domains.
6. Staged liveness and dependency readiness
   pass before the attested deployment is promoted to production domains.
7. `Production smoke` then waits for the exact 12-character revision and repeats
   liveness and dependency readiness against the public production origin.
8. Production promotion, migration-ledger readback, provider acceptance and
   rollback evidence are recorded against the same Git SHA.

## Repository-owned acceptance

- [x] One stable `Release gate` aggregates every release-critical CI proof.
- [x] Expensive E2E fan-out waits for the fast lint/type/unit lane.
- [x] Successful `main` CI starts the protected database-promotion chain, whose
      completion automatically triggers exact-revision production verification;
      scheduled availability checks remain revision-agnostic so a deliberate
      rollback can be healthy.
- [x] Nightly cross-browser work is isolated by project and every long-running
      job has a timeout.
- [x] Actions use commit-SHA pins and least-privilege workflow permissions.
- [x] Release, rollback and incident procedures are source controlled.
- [x] A protected CI-led database promotion workflow accepts only an exact
      successful `main` revision, proves the forward-only plan and verifies the
      linked Supabase migration ledger after application; manual recovery is
      explicit and fail-closed.
- [x] The promotion workflow requires an isolated custom `staging` target to
      replay migrations, signed Stripe/Resend webhooks and a rollback-only core
      merchant/customer loyalty journey before production credentials are
      released. Live provider provisioning and readback remain provider-owned.
- [x] CI builds the Vercel output once, emits signed build provenance and a
      CycloneDX SBOM, proves the staged artifact and promotes the same output.
- [x] Production probe failures create a durable incident and send a signed,
      retrying, deduplicated external page; recovery is acknowledged externally
      before the incident closes. Live receiver provisioning remains
      provider-owned.
- [x] Scheduled probe history produces a 30-day, 99.9% availability SLO with a
      95% evidence-coverage floor, fail-closed missing-probe accounting, a
      seven-day non-paging warm-up, daily retained evidence and breach paging.
      This GitHub-hosted signal is correlated with the deployment control plane;
      independent uptime evidence remains provider-owned.
- [x] Protected readiness reduces service-role-only database aggregates for
      notification and loyalty-invite queue age, 24-hour provider-delivery
      failures, missed cron schedules and consecutive cron failures. Every
      Vercel cron appends a data-free outcome, scheduled probes enforce the
      source-owned thresholds and network latency, and the rolling SLO reports
      both availability and error rate. Deployment and provider corroboration
      remain provider-owned.
- [x] A protected manual recovery workflow validates a selected physical backup
      and newly created same-region restore target, then proves the as-of-backup
      ledger and core database path without writing to the restored database.
      Executing and recording the provider restore remains provider-owned.

## Provider-owned acceptance

The following settings cannot be proven by source code alone. Record dated
readback in the release evidence before declaring 10/10.

### Live readback: 23 July 2026

| Surface                             | Observed state                                                                                                                                                                                                                                                                                                                                                         | Gap to target                                                                                                                                                                                                                                     |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| GitHub repository rules             | Active ruleset `Main delivery policy` (`19613437`) protects the default branch with no bypass actors. It blocks deletion and force pushes, requires linear history, one fresh code-owner approval after the latest push, resolved conversations and strict `Release gate`, CodeQL analysis and dependency-review checks. Classic branch protection has been retired.   | Add a second trusted collaborator and independent `CODEOWNERS` identity; `lapeninns` is currently the repository's only collaborator and routine PR author, so the approval requirement intentionally remains unsatisfied for self-authored work. |
| GitHub `Staging` environment        | Protected-branch deployments and manual approval are required; self-review is prohibited. The verified Vercel organisation and project IDs are configured, but no isolated Supabase project or staging credentials exist.                                                                                                                                              | Provision a dedicated Nabaperks staging Supabase project, staging-only provider credentials and a second trusted reviewer before activating promotion.                                                                                            |
| GitHub `Production` environment     | Protected-branch deployments and manual approval are required; self-review is prohibited. Verified Vercel and Supabase identifiers are configured. `lapeninns` is the repository's only collaborator, so the environment is intentionally fail-closed; release credentials are not installed.                                                                          | Add a second trusted collaborator as the independent reviewer and install dedicated release credentials before activating promotion.                                                                                                              |
| GitHub `Monitoring` environment     | The unattended environment exists and permits protected branches only. Signed external paging secrets are not configured. The source-owned SLO uses GitHub-hosted smoke history, so it cannot detect a GitHub-wide monitoring failure independently.                                                                                                                   | Install the two alert webhook secrets, prove trigger/resolve acknowledgement reaches a human, and add an independent uptime monitor.                                                                                                              |
| GitHub `Recovery Drill` environment | Protected-branch deployments and manual approval are required; self-review is prohibited and a 30-minute RTO variable is configured. No disposable restored project or restore credentials are configured.                                                                                                                                                             | Add a second trusted reviewer, restore a physical backup to a new same-region project and retain the successful read-only workflow evidence.                                                                                                      |
| Vercel deployment checks            | Only Vercel `Lint` and `TypeCheck` are configured for Production, and both are non-blocking.                                                                                                                                                                                                                                                                           | Add blocking GitHub `Release gate`, CodeQL and `Database promotion` checks to Production after this branch is merged and those check names are discoverable on `main`; enabling them earlier would hold production aliases indefinitely.          |
| Vercel environments and protection  | An empty custom `staging` target exists without branch tracking or copied production values. Git integration still deploys `main` automatically. All 93 obsolete application-secret copies scoped to six merged historical branches have been removed; Preview now contains only the shared Google Maps browser key and therefore cannot run the complete application. | Populate `staging` and Preview with isolated non-production credentials, then disable automatic `main` deployments only after the build-once GitHub workflow has its protected release credentials and staged path.                               |
| Sentry production observability     | Sentry server, edge and browser instrumentation plus protected source-map upload are source-controlled, but Vercel Production has no Sentry-named variables.                                                                                                                                                                                                           | Configure `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` and protected `SENTRY_AUTH_TOKEN`, then prove a production release and source-map association.                                                                                 |
| Production revision and DB ledger   | Public liveness reports revision `46ae53a7b920`, while the linked Supabase ledger is missing `20260722100500` and `20260723113000`.                                                                                                                                                                                                                                    | Apply and verify the reviewed forward-only migrations, then make ledger readback a pre-promotion control so application deployment cannot outrun its schema.                                                                                      |
| Supabase backups                    | WAL-G and completed daily physical backups are present for the latest eight days; point-in-time recovery is disabled.                                                                                                                                                                                                                                                  | Enable PITR, approve RPO/RTO and complete a non-production restore drill before claiming recovery readiness.                                                                                                                                      |

This readback records visible settings, not secret values. Re-read the controls
after every change rather than treating this table as permanent truth.

Run `pnpm ops:github:check` from an authenticated operator shell to validate the
ruleset, independent ownership, protected environments, required secret names,
non-secret variables, staging isolation and repository-secret scope. It reads
metadata only and intentionally exits non-zero until every target control has
live evidence.

Run `pnpm ops:vercel:check` from an authenticated Vercel operator shell to
validate the linked project, Git security, custom staging target, source/live
cron parity, blocking Deployment Checks, and environment-variable names and
protected storage without decrypting or printing values. It also intentionally
exits non-zero until the provider-owned target state is live.

Run `pnpm ops:supabase:check` from an authenticated Supabase operator shell to
validate the production project identity and health, exact source/remote
migration-ledger parity, WAL-G, PITR, backup region, freshness, continuity and
provider backup status. It selects only metadata and intentionally exits
non-zero while the production ledger or recovery posture is behind the target.

### GitHub

- An active `main` GitHub ruleset requires pull requests, conversation
  resolution, fresh approval after the last reviewable push, `Release gate`,
  CodeQL and dependency review.
- Normal administrators are not bypass actors. A separate break-glass identity
  may bypass only with a recorded incident or release decision.
- `CODEOWNERS` includes at least one independent reviewer who is not the routine
  PR author. Code-owner review is required only after that reviewer exists.
- Force pushes and branch deletion are blocked; signed commits are required if
  every authorised automation identity supports them.
- The `Production` environment requires an independent reviewer, permits only
  `main`, disables routine administrator bypass and supplies
  `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`,
  `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` and
  `PRODUCTION_MONITOR_SECRET` only to protected promotion jobs.

### Vercel

- Production Deployment Checks require `Release gate`, CodeQL and
  `Database promotion`. A successful build may be staged, but custom production
  domains are not assigned before all checks pass.
- Automatic Vercel Git deployments from `main` are disabled when the GitHub
  build-once workflow is activated; preview deployments may remain Git-driven.
- The exact `.vercel/output` represented by its signed provenance and SBOM is
  staged with `--skip-domain`, probed, and only then promoted.
- Force Promote is break-glass only and its actor, reason, revision and follow-up
  are recorded.
- The promoted deployment reports the intended Git revision and passes the
  automatic exact-revision smoke workflow.
- Production secrets, Sentry release/source-map settings and cron ownership have
  dated readback without copying secret values into evidence.

### Supabase and recovery

- An isolated staging project exists with migration and RLS parity.
- Point-in-time recovery is enabled for production, with an owner-approved RPO
  and RTO. Proposed targets are RPO <= 5 minutes and RTO <= 30 minutes.
- A quarterly non-production restore drill proves backup usability, migration
  ledger consistency and the core loyalty read path.
- Forward-only migrations use expand/contract sequencing so the old and new
  application revisions remain compatible throughout promotion and rollback.

### Observability and response

- Sentry release tracking and source maps are active for production.
- P0/P1 alerts page a human outside GitHub; GitHub issues remain the durable
  incident record, not the only notification channel.
- The source-owned availability objective is 99.9% over a rolling 30 days with
  at least 95% scheduled-probe coverage. Missing probes after monitor start
  breach the evidence-coverage floor without being misreported as service
  downtime. The first seven observed days are a fail-closed, non-paging warm-up;
  later breaches page and open a durable incident.
- Service-level indicators cover availability, readiness, latency, error rate,
  queue age, cron failures and provider delivery outcomes. Alert thresholds map
  to an owner and runbook.
- An uptime monitor outside GitHub plus Sentry, queue-age, cron and provider
  delivery metrics must corroborate the GitHub-hosted availability signal; the
  repository SLO alone is not independent production-observability proof.
- Two consecutive production probes, a provider-channel replay and database
  readback are required to close a P0/P1 incident.

## Evidence review cadence

- Every release: required checks, staged deployment, revision, migration ledger,
  provider acceptance and rollback candidate.
- Weekly: dependency/security findings, backups, queue age and failed crons.
- Monthly: ruleset and Vercel Deployment Check readback, privileged identities,
  alert routing and rollback rehearsal.
- Quarterly: staging parity, restore drill, RPO/RTO evidence and this contract.

Official configuration references:

- <https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets>
- <https://vercel.com/docs/deployment-checks>

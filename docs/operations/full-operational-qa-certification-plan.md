# Full Operational QA Certification

## Summary

Certify one exact release SHA across local, CI, staging, production, providers, performance, security, and recovery.

Current `main` SHA `20b48b7a…` is not certifiable because `pnpm security:audit` detects vulnerable PostCSS, brace-expansion, and tar pins. First produce a reviewed repair SHA; do not bypass protection or regenerate the approved poster baselines.

## Execution

1. **Repair and freeze the candidate**
   - Update the vulnerable dependency overrides and lockfile.
   - Run audit, quality, coverage, and build checks.
   - Merge through an independently reviewed PR with every required check passing.
   - Freeze the resulting SHA as the sole QA candidate.

2. **Local deterministic suite**
   - Run frozen install and `pnpm env:check`.
   - Run `security:audit`, `quality:check`, `test:coverage`, `build`, `bundle:check`, JSON-LD, SEO, token, claim, documentation, flag, debt, duplication, and dead-code checks.
   - Export and verify production PDFs. Treat any poster/visual difference as a defect; do not automatically bless snapshots.
   - Against disposable local Supabase, run reset/seed, all DB tests, migration smoke, 10k-record stress seed, and `perf:stress`.
   - Run provider smoke in offline mode, then live mode using protected credentials.

3. **Hosted CI and non-production QA**
   - Require the complete CI release gate on the frozen SHA:
     - Contract, unit, coverage, build, security, CodeQL, and dependency checks.
     - E2E across Chromium, Firefox, desktop Safari, and mobile Safari.
     - Accessibility and visual suites across desktop and mobile projects.
     - Lighthouse on all configured routes.
     - ZAP baseline scan and DB behavioural tests.
   - Manually dispatch nightly QA for that SHA:
     - Full cross-browser Playwright suite.
     - Mutation testing.
     - k6 public-route load tests.
     - Authenticated stamp/redeem race tests.
     - ZAP full scan.
   - Missing race-test variables or credentials count as incomplete, not skipped.
   - Run the exact-revision ephemeral release proof, including fresh Supabase, migration ledger verification, signed webhook replays, readiness, and rolled-back loyalty journey.

4. **Governance and production release**
   - Pass `ops:github:check`, `ops:vercel:check`, and `ops:supabase:check` with authenticated readback.
   - Promote database migrations through the protected Production environment, verify the production ledger, then deploy the same SHA.
   - Verify SBOM, provenance attestations, readiness, liveness, and deployed revision.
   - An authorised operator performs the redacted live acceptance:
     - Merchant and customer authentication.
     - QR join, stamp, reward, and redemption lifecycle.
     - Email and OTP delivery.
     - Stripe live configuration, Customer Portal, signed webhook, single terminal event, and entitlement readback.
     - Anonymous routes work and `/dev/*` returns 404.
   - Require both the deployment-triggered smoke and the next scheduled production smoke to pass.

5. **Operational certification**
   - Run `ops:slo:check`; require 99.9% over 30 days, at least seven observed days, and 95% evidence coverage.
   - Test the controlled external paging receiver.
   - Restore a completed physical backup into an isolated Supabase recovery-drill project, run read-only verification, and retain evidence.
   - Delete the disposable restore project only after evidence review and separate operator approval.

## Failure and Evidence Policy

- Any failure creates a defect, a new candidate SHA, and reruns the affected suite plus the complete release gate.
- No required test may be waived, bypassed, or recorded as passed when skipped.
- Record command/workflow, exact SHA, environment, timestamp, result, artifact link, blocker, and approver in one certification matrix.
- Keep secrets, customer data, tokens, and message contents out of artifacts.
- Final status is **Certified** only when every automated, provider-backed, production, SLO, paging, and recovery item passes. Insufficient SLO history leaves certification pending.

## Interfaces and Assumptions

- No public API or product behaviour changes are expected beyond the dependency repair.
- Existing approved poster dimensions, fonts, radii, and visual baselines remain the source of truth.
- The operator owns production credentials and executes live actions while QA records redacted evidence.
- Independent GitHub and protected-environment reviewers are available.

# CI/CD, release & repository governance

What runs automatically, how releases and deploys flow, and the exact settings
applied on GitHub (with the few remaining manual steps).

## Workflows (`.github/workflows/`)

| Workflow                | Trigger                  | Gates / output                                                                                                                                                           |
| ----------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ci.yml`                | push `main`, PRs         | Parallel jobs: **Lint**, **Typecheck**, **Test + coverage**, **Code health**, **Security checks**, **Build** (+ env contract, bundle-size budget, dependency footprint). |
| `codeql.yml`            | push `main`, PRs, weekly | CodeQL `security-extended` code scanning (JS/TS).                                                                                                                        |
| `dependency-review.yml` | PRs                      | Fails on new high-severity vulns or copyleft licences.                                                                                                                   |
| `release-drafter.yml`   | push `main`, PRs         | Maintains a draft GitHub Release from merged PRs (labels → sections).                                                                                                    |
| `flaky-tests.yml`       | nightly, manual          | Repeat-runs the shuffled suite to surface flakiness.                                                                                                                     |
| `dast.yml`              | weekly, manual           | OWASP ZAP baseline scan against `DAST_TARGET_URL` (advisory).                                                                                                            |

Fast feedback: jobs are separated so a lint failure doesn't wait on the build,
and `concurrency` cancels superseded runs. Job and step durations are tracked
natively by GitHub Actions; per-test timing is in the JUnit artifact
(`test-results/`) and slow tests (>300ms) are flagged by Vitest.

## Releases

- **Release notes** are drafted automatically by `release-drafter` on every push
  to `main`; categories come from PR labels (see `.github/release-drafter.yml`).
  Publish the draft to cut a release — no hand-written changelog.
- **Deploys** use Vercel's native Git integration (the repo is linked via
  `.vercel/`): pushes to `main` deploy to production, PRs get preview
  deployments. Supabase migrations are applied with `pnpm db:migrate` against the
  target project (idempotent SQL). This is deliberately **not** re-implemented as
  a GitHub Action so deployment frequency reflects real Vercel deploys, not
  synthetic CI runs.

## GitHub settings already applied (via API, admin)

Verify any time with `gh api repos/lapeninns/nabaperks`:

- **Secret scanning**: enabled · **Push protection**: enabled
- **Dependabot**: vulnerability alerts + security updates enabled; version updates
  via `.github/dependabot.yml` (npm + actions, weekly, with a release-age
  cooldown).
- **Default workflow permissions**: read **and** write (so `release-drafter` can
  manage draft releases).
- **Branch protection on `main`**: require a PR with 1 approving review, require
  Code Owner review, dismiss stale reviews, require conversation resolution,
  linear history, no force-push, no deletion. `enforce_admins` is **false** so an
  admin retains a direct-push safety valve.
- **Labels**: `type:*`, `area:*`, `priority:*`, `needs triage`, `dependencies`,
  `skip-changelog`.

## Remaining manual steps

1. **Require CI status checks on `main`** — do this _after_ `ci.yml` has run once
   on `main` (so the exact check names exist). Then:

   ```bash
   gh api -X PATCH repos/lapeninns/nabaperks/branches/main/protection/required_status_checks \
     -F strict=true \
     -f 'checks[][context]=Lint' \
     -f 'checks[][context]=Typecheck' \
     -f 'checks[][context]=Test + coverage' \
     -f 'checks[][context]=Code health' \
     -f 'checks[][context]=Security checks' \
     -f 'checks[][context]=Build' \
     -f 'checks[][context]=Analyze (javascript-typescript)'
   ```

2. **Enable DAST** — set the target so the scheduled ZAP scan runs:

   ```bash
   gh variable set DAST_TARGET_URL --body "https://<your-production-or-preview-url>"
   ```

3. **Vercel** (dashboard — cannot be set from this repo):
   - Confirm the GitHub integration is connected for `lapeninns/nabaperks`.
   - Set production + preview environment variables to match
     `config/env-contract.json` (`pnpm env:keys` documents each).
   - Add a **Log Drain** (or PostHog/Sentry) and alert on `level":"error"` /
     `request.error` — see [`OBSERVABILITY.md`](OBSERVABILITY.md).

4. **Optional**: enable GitHub **secret scanning validity checks** and
   **non-provider patterns** in repo Settings → Code security, if desired.

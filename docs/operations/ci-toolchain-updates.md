# CI toolchain updates

Owner: lapeninns.

## Playwright and the browser image

The hosted browser jobs run in
`mcr.microsoft.com/playwright:v<version>-noble@sha256:<digest>`. The version
appears in exactly these places, and they must change in one pull request:

1. `package.json` and `pnpm-lock.yaml` (`@playwright/test`, `playwright`,
   `playwright-core`);
2. the three `container.image` lines in `.github/workflows/ci.yml`
   (`e2e`, `a11y`, `targeted-browser`);
3. `BROWSER_IMAGE_VERSION` in `scripts/ci/check-browser-image.mjs`;
4. the local plane (`ops/local-ci/image/Dockerfile`, `ops/local-ci/profiles/*`,
   `config/local-ci-contract.json`), which is advisory.

`tests/contracts/ci-toolchain-pins.test.mjs` fails in the fast lane when the
lockfile and `BROWSER_IMAGE_VERSION` disagree, and
`tests/unit/ci-browser-performance.test.mjs` fails when an image tag does. The
runtime `check-browser-image.mjs` check stays as the last line of defence.

Dependabot ignores `@playwright/test` and `playwright`, because a lockfile-only
bump cannot pass. To update, look up the new image digest (for example
`docker buildx imagetools inspect mcr.microsoft.com/playwright:v<version>-noble`),
update all of the above, and inspect visual results before touching baselines
(`docs/operations/visual-baseline-qualification-prerequisite.md`).

## GitHub Actions

Every third-party action is pinned to a full commit SHA with a version
comment. `tests/contracts/ci-toolchain-pins.test.mjs` requires one SHA and one
label per action across workflows and composite actions. Dependabot's
github-actions entry covers `/` and `/.github/actions/*`.

Resolve a comment against the real tag before editing it:
`gh api "repos/<owner>/<action>/tags?per_page=100" --jq '.[] | select(.commit.sha=="<sha>") | .name'`.
On 30 September 2026 this showed that the `actions/checkout` SHA is v7.0.1 (8
comments said v6.0.2), the `upload-artifact` SHA is v7.0.1 (2 said v4.6.2) and
the `setup-cli` SHA is v3.0.0 (1 said v1.6.0). Two `pnpm/action-setup` SHAs
(v6.0.9 and v6.1.0) were in use; all now use v6.0.9, the version the setup
action already tested.

## Scanner and CLI versions

- ZAP: see `docs/operations/zap-baseline-policy.md`.
- Supabase CLI: 2.106.0 in every workflow, including the recovery drill (it was
  2.75.0 there). Change all `supabase/setup-cli` `version:` inputs together.
- Vercel CLI: `production-deploy.yml` asserts the locked version; see the
  pinning note in `docs/operations/production-runbook.md`.

# Change-aware CI

Owner: Lapen Inns product operations.

Pull requests keep the stable `Release gate` and select checks from the complete
immutable merge candidate. The first policy installation must pass full hosted
CI and a targeted/full execution comparison before it can become reviewed base
policy. Local source and unit tests do not establish that hosted qualification.

## Initial scope

| Profile       | Eligible changes                                                                                                                                         | Required hosted checks                                                                                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Documentation | Regular Markdown files under `docs/operations/` or `docs/decisions/`, plus `README.md`                                                                   | Secrets, source contracts, generated documentation consistency, agent guidance, changed-file formatting and local links                                                        |
| Public pages  | Literal JSX text and reviewed presentation attributes in `/about`, `/faq` and `/how-it-works`, optionally with their matching canonical visual baselines | Existing fast, quality and production build checks; existing page accessibility tests across four browser projects; existing visual tests on hosted Chromium and mobile Safari |
| Full          | Everything else, forks, missing or uncertain impact evidence                                                                                             | All nine existing hosted roots                                                                                                                                                 |

The public-page classifier compares TypeScript syntax trees. Imports, links,
handlers, expressions, element structure and arbitrary component properties must
remain identical. It checks for other source consumers of the page modules.
Shared UI, global styles, dependencies, runtime behaviour, critical domain logic,
database work, CI and release tooling therefore retain full validation. Deleted,
renamed, executable, symlinked and unsupported files also retain the full suite.
These rules are narrower than a folder-based exemption.

Local-link checks parse Markdown and HTML anchors, images and poster URLs, with
the same repository bounds for each. HTML character references in local URLs
and `srcset` require explicit Markdown links instead of unvalidated destination
syntax. Code examples and HTML comments are ignored.

Consumer analysis includes root runtime entries such as `proxy.ts`,
`instrumentation.ts` and `next.config.ts`, as well as additional source folders.
Known tooling is excluded from that scan; an application import into excluded
tooling makes impact uncertain. Module aliases beyond the reviewed `@/*` mapping,
inherited resolution settings and computed imports also require full validation.

Literal class edits qualify only for the reviewed typography, colour, border
and spacing utilities in `scripts/ci/impact-classes.mjs`. Interaction utilities
such as `pointer-events-none`, visibility or positioning controls, custom classes,
arbitrary values and arbitrary selectors retain full functional validation.
All class variants, including focus, hover, disabled, dark and responsive
breakpoints, remain in the syntax comparison: the selected checks have no
explicit proof for every such state. Changing one therefore requires full CI.
Changing an existing interaction class is also a full change. A mixed eligible
page/documentation PR retains changed-document formatting and link checks; its
fast and quality jobs provide the shared baseline without repeating those checks
in the documentation job.

A qualified page may also update its existing Chromium and mobile Safari Linux
PNG baselines. Every changed baseline must belong to a page whose source change
independently qualifies in the same PR. Baseline-only changes, other pages,
other platforms, additions, deletions and file-mode changes retain full CI.
Expected image updates do not change test selection and therefore do not trigger
a duplicate targeted/full comparison by themselves. Tests, snapshot naming rules
and selection policy changes still require that comparison.

The affected visual job uploads its `results` directories inside the
`targeted-visual` artifact, including actual and difference images when a
comparison fails. Review that evidence before updating the matching canonical
baseline. An expected screenshot update must still pass the existing visual
comparison and ordinary PR review; it is never automatically accepted.

The selection job executes policy from the PR's already-reviewed base SHA and
reads candidate Git objects without executing candidate classifier code. Its
plan binds repository, base, head and merge SHA, file/blob inventory and policy
digests. The gate checks the same identity using reviewed policy and requires
every selected job to succeed. Unselected jobs must be explicitly skipped and
are reported as **not required, not executed**. They are never counted as passed.
Independent security checks retain their existing provider contexts.

## Qualification before selection authority

Policy installation and changes to selection, browser execution, test mapping
or browser policy run the whole suite plus the bounded targeted comparison.
`package.json` is included because it owns the full visual test command.
The reviewed dependency graph also covers transitive runner, verifier and test
helpers, including process-tree signalling, exit handling, browser image checks
and accessibility fixtures. Locks, workspace overrides, Node version and setup
actions require comparison too. An unavailable dependency graph fails closed.
This is the only time the same page checks intentionally run twice. Normal
qualified PRs run their selected tier; other normal PRs run the full tier.

The comparison requires successful full e2e, accessibility and visual jobs, all
128 e2e part reports, eight accessibility reports, eight visual reports and six
targeted project manifests. It matches existing test identities and successful
runtime outcomes on the same candidate. Missing, empty, duplicated, skipped,
retried, flaky or different results fail qualification. Worker, retry, browser
configuration and fresh-server policies must match. Visual qualification stays
on Linux x64 and uses the existing baselines. A test list or a local ARM visual
run is not a substitute.

The comparison verdict executes from the immutable reviewed PR base, including
that checkout's dependency lock. The candidate's reports are data, and changes
to its verifier cannot replace this verdict. The artifact records the verifier
revision separately from the tested merge revision. A base with installed policy
but a missing verifier fails instead of downgrading to bootstrap.

The first installation has no base verifier. Its fixed bootstrap source is
`1a50396145b2daf0aed9b8de2f4a0cd2db0542a2`, whose comparison implementation received
[code-owner review](https://github.com/lapeninns/nabaperks/pull/307#pullrequestreview-5171767005)
before later repairs. The comparison implementation is unchanged at that pin.
This historical review identifies the bootstrap code; it does not approve the
current PR or replace its fresh code-owner approval.

The installation PR cannot use its own new policy to reduce its checks. Its
reviewed base has no classifier, so bootstrap requires all nine roots and the
comparison. After independent review and merge, the policy can select future
eligible PRs. Expanding eligible files requires another reviewed qualification.

## Main and release behaviour

Every exact-main push continues to run the complete CI suite. Production
preflight still requires successful exact-main CI and CodeQL. Selective PR
success cannot stand in for this release evidence.

After preflight, the existing protected Production baseline reader authenticates
the live Vercel deployment, canonical project/team and full deployed SHA. The
release compares **that deployed revision to the whole candidate**, using only
the documentation allowlist. A docs-only last commit on top of pending runtime
work therefore still requires a complete application release.

When that complete difference contains only qualified documentation, the release
records a bound `production-unchanged` artifact. Ephemeral staging, runtime
qualification, database promotion and application deployment do not run. Smoke
verification independently checks the artifact's Git difference and probes the
existing production revision; it does not claim the new documentation commit
was deployed. Release-triggered smoke checks pin their scripts to the completed
release run's immutable revision and read the allowlist from the artifact's
actual candidate revision, so a newer main cannot change that decision. The
protected baseline approval remains necessary because the
current credential scope lives in Production. This change removes subsequent
deployment work, not that initial approval.

Runtime changes retain ephemeral staging, runtime qualification, database
compatibility and protected database/application promotion in order. Explicit
manual promotion keeps its requested redeployment behaviour. Uncertain release
identity or unavailable Git evidence must never produce a no-deployment result.

## Verification and rollback

Run the impact classifier, evidence, artifact-reader and workflow contract tests,
then `pnpm quality:check` and a fixture production build. Run the targeted browser
runner to check real selection and teardown. Require the full hosted run and
same-candidate comparison before merging selection policy. Record provider job
timings after rollout before claiming a measured time saving.

To disable selection, return the planner's profile to `full` for all PRs while
keeping the stable gate and all hosted workloads. Revert the documentation
no-deployment path independently if needed. Do not turn missing evidence into
success, change protected contexts, or promote advisory local evidence to merge
authority. Follow [production operations](production-runbook.md) for releases.

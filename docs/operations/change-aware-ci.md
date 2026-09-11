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

The documentation artifact binds the checked files and their Git blobs to the
merge candidate. Qualification always runs eight fixed positive and negative
Markdown cases, including formatting, inline/reference links, HTML links and a
code example, even when the change inventory contains no Markdown. The reviewed
verifier checks the complete case set and independently re-reads the candidate's
documentation file inventory. Qualification then runs the checker, formatter and
configuration from the reviewed checkout against candidate content and the reviewed
corpus. Candidate modules, formatter configs, package managers and hooks never
execute during this reference validation. See [the verifier contract](ci-selection-verifier.md)
for input bounds and exact source requirements.

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
digests. The gate recomputes the entire selection plan from the immutable Git difference
using the reviewed classifier, including changed files, digests, pages and required
checks. A candidate-provided selective profile cannot suppress real work. It requires
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
configuration and fresh-server policies must match. A companion reporter records
a canonical digest of every resolved project `use` option, including browser,
device, viewport, launch and context settings, without publishing credentials or
headers. Reviewed-base comparisons require that evidence in both full reports
and targeted manifests; missing or different settings fail. Visual qualification stays
on Linux x64 with `--update-snapshots=none` and uses the existing baselines.
Both full and targeted visual reports must confirm that snapshots cannot be
created or updated. Each targeted test identity must match the declared page. A test list or a local ARM visual
run is not a substitute.

The reviewed planner reads qualification pages from the candidate policy as
bounded JSON data. The verifier independently checks that same Git object, so
adding, removing or renaming a page qualifies the proposed page set instead of
comparing it with the base's older allowlist. This does not grant selection
authority until the policy change passes review and merges.

The verifier also parses the candidate workflow as data. Full e2e, accessibility
and targeted browser jobs must name the same literal Playwright image with an
immutable SHA-256 digest, runner and container options. All five qualification jobs must use literal `ubuntu-latest` runners. Both visual jobs must
name the same host runner. Missing, dynamic or different environments fail even
when Playwright settings and test outcomes match. The artifact records the
candidate workflow digest and those job environments, and every targeted
manifest must match that independently read identity.

Before accepting reports, the verifier also checks the complete candidate workflow
against the reviewed `config/ci-qualification-workflow.yml` proposal. Its steps,
conditions, environment, actions and artifact wiring must match exactly. Every
other tracked input is bound to reviewed Git objects, including workload scripts,
all test suites and fixtures, imported application code, configuration and binary
assets. Qualified internal Markdown receives its separate reviewed content check.
A file outside known tooling directories cannot silently weaken a required job.

Future inputs can be explicitly reviewed under `config/ci-qualification-inputs/`
in the prerequisite, retaining their repository paths with a `.source` suffix.
These inert copies define the exact accepted candidate
replacements while the foundation keeps its existing active workflow and tests.
The candidate must preserve the staged copies too. A qualification change needs
its complete input tree reviewed first; ordinary eligible PRs keep their selected
checks, and ordinary unsupported changes keep the full suite.

The comparison verdict executes from the immutable reviewed PR base, including
that checkout's dependency lock. The candidate's reports are data, and changes
to its verifier cannot replace this verdict. The artifact records the verifier
revision separately from the tested merge revision. A base with installed policy
but a missing verifier fails instead of downgrading to bootstrap.

The verifier foundation must be reviewed and merged before the integration.
It adds the read-only verifier and evidence contracts while leaving full CI and
release behaviour in place. The integration fails selection immediately if the
reviewed base lacks that verifier or the documentation evidence contract. It
cannot fall back to an older verifier that ignores newly required evidence.

After the foundation lands, its staged planner recognises that the integration
changes the active CI workflow and requires all nine hosted roots plus the complete
comparison. Only after that comparison, review and merge can the new policy
select future eligible PRs. Stage future incompatible verifier schemas before
changing their producers as well. Expanding eligible files requires another
reviewed qualification.

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
was deployed. A no-deployment artifact must name the completed release run's full
head revision; a different or missing revision fails even when its own older
Git difference contains only documentation. This extra restriction applies to
the no-deployment path. Release-triggered smoke checks pin their scripts to the completed
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

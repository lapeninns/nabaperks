# Delivery coordination and the owner decision loop

GitHub remains the merge/release authority. The factory adds an advisory state
machine and bounded operator actions around existing CI, Codex review and the
protected release workflow. It does not create a second CI scheduler. The Mac
remains the preferred future compute plane after qualification; hosted CI keeps
all nine required roots until isolated local evidence and fallback are proven.

## Commands and responsibilities

Run `pnpm ops:factory:status` for a decision table, or
`pnpm ops:factory:status -- --json` for structured evidence. Collection reads
GitHub metadata, paginates PRs, reviews, check runs and review threads, and checks
that the head, base and merge candidate did not move during collection.
GitHub Actions attaches checks to the PR head. The report binds each expected-App
check to its workflow path, check suite and a fixed workflow run title containing
the event head and base SHAs. The run's mutable PR association is not base-revision
proof. Older unstamped runs cannot establish readiness. This is workflow-event
evidence; per-step checkout attestation remains part of future local authority
qualification. The collector never reads PR instructions or downloads candidate artifacts. Missing, raced or
unavailable evidence yields `unknown`, not readiness. The hosted
`Delivery decision report` uses main's code and read-only permissions.

The report identifies the work, exact revision, state, next owner, action and
reason. It distinguishes implementation, tests, fixes, review freshness,
GitHub approval, merge blockers, superseded releases and live verification.
A successful release workflow still needs the relevant live journey checked.

The local coordinator should notify the owner only on meaningful state changes,
completion, failure or a decision they must make. Routine retries and unchanged
waiting states stay quiet. A decision packet includes the preview/result,
passed evidence, remaining uncertainty, recommendation and exact GitHub link.
Never represent an agent using a second account as independent human approval.

## Authorised actions

These commands act only when invoked explicitly by an operator or an agent
already authorised for that PR's scope. Observing a PR is not authorisation to
edit it. Keep a single operating owner for each worktree and active release.

```bash
pnpm ops:factory:action -- request-review <pr-number> <full-head-sha>
pnpm ops:factory:action -- reserve-repair <pr-number> <full-head-sha>
pnpm ops:factory:action -- finish-repair <pr-number> <new-full-head-sha>
```

`request-review` requires current successful expected-App checks for the current
head and base, no unresolved findings and missing current-head reviewer coverage.
It posts only the fixed `@codex review` request. Reviewer instructions can also
be scoped in `AGENTS.md`. A reviewer `COMMENTED` record is coverage evidence,
not a GitHub approval, proof that no defects exist or exhaustive security proof.
A reaction alone is insufficient. For clean reviews that only update the bot
summary, verify the immutable bot user ID and resolve the reported abbreviated
commit through GitHub to the full current SHA. Ambiguous commits, incomplete
summaries and unavailable evidence cannot establish coverage.

Each request intent is saved before submission. A crash or uncertain response
stays uncertain and must be reconciled against GitHub before another request.
No timeout bypasses review. After 20 minutes, surface review recovery as a
human decision rather than posting repeated requests.

`reserve-repair` atomically consumes one of two repair cycles per PR before
work begins. The agent investigates the failing check or finding, applies only
a justified fix in an isolated worktree, runs relevant checks and pushes the
new commit within its authorisation. `finish-repair` records the new current
head. Repeat checks and review on that revision. Changing the SHA does not reset
the budget. An active or exhausted repair requires reconciliation or an owner
decision; do not delete the journal to manufacture another attempt.

The journal is under `~/.local/state/nabaperks-factory/`, outside candidate
worktrees, with a exclusive directory lock and atomic file replacement. A
leftover lock is intentionally not removed automatically: verify no prior
process is acting before recovery. This coordinates a single operator host;
it is not a distributed transaction or a substitute for GitHub branch rules.
Back up the journal before approved manual recovery. No credential is stored.

## Release waits

Active runs are queried separately by status so a newer completed run cannot
hide an older environment approval wait. An old active revision is reported as
`superseded-release`. Inspect its migration ledger, stage outcomes and deployed
candidate before cancelling. Never approve an old run just to free the shared
`production-release` lock. No factory command merges, cancels, promotes, approves
an environment, weakens checks or performs database changes.

## Local-first rollout acceptance

1. Repair inaccurate governance evidence and record source vs live observations.
2. Qualify sequential browser packing against unchanged shard identities,
   outcomes, skips, flakes, teardown and resource limits on the same architecture.
3. Drain only the owned Nabaperks executor. Qualify a disposable DB guest three
   times including cold-cache and crash-cleanup cases; deny host/LAN access from
   outside candidate-controlled configuration.
4. Expand selected local shadow lanes and retain canonical x64 build/visual and
   independent security checks. Avoid permanent complete duplicate execution.
5. Prove trusted App-bound publication, exact merge candidates, partial workload
   union, replay rejection and bounded hosted fallback before routing cutover.
6. Qualify main and release compatibility separately. Complete isolated restore
   and paging proof; obtain a separate decision for paid PITR or other spending.
7. Remove redundant observers only after reference and provider readback checks.

Approval to implement the architecture does not make unproven isolation,
review independence, credentials, restore results or a week of pilot traffic
exist. Record these as qualification work with an owner and next action.

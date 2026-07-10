# Changelog

Notable changes to the AI Governance Starter Kit, newest first. The
`KIT_VERSION` in `templates/scripts/governance-version.mjs` and the version
in `.claude-plugin/plugin.json` must both match the newest heading here —
the host repo's `skill-bundle-sync` test enforces it.

## 0.5.0 — 2026-07-10

- Batched evidence proof: repeat `--spec <id>` in one
  `governance:run-gates --record` invocation to execute the exact-command
  union once while recording only each Micro-Spec's own declared gate results
  in its ledger.
- Delivery cadence: focused requirement tests are the implementation feedback
  loop; complete recorded gate runs are reserved for coherent proof and
  lifecycle boundaries, not every Git commit. A lifecycle advance is itself
  the recorded boundary and does not require an identical recorded pre-run.
- Strict gate-runner arguments: unknown options, missing spec ids, and unknown
  requested specs now fail with actionable errors instead of being ignored.

## 0.4.0 — 2026-07-07

- Scoped browser gates: an active spec's `test:e2e` gate must carry a
  spec-owned `--grep` filter (multiple `--project` flags stay supported);
  broad whole-suite gates need a dated `broad-browser-gate:` approved
  exception. Tag-scoped wrapper scripts are exempt via
  `SCOPED_BROWSER_GATE_SCRIPTS`.
- The intake scaffolder emits browser floor gates pre-scoped to a
  `@<spec-id>` grep tag placeholder.
- Active-spec soundness cross-checks: `RISK_RADIUS_HINTS` stop high-risk
  surfaces riding under a weaker risk class; `BROAD_RADIUS_ROOTS` /
  `BROAD_RADIUS_LIMIT` require a dated `broad-blast-radius:` exception for
  repo-wide blast radii; a scoped gate's `--grep` pattern must compile and
  match the spec's own related browser tests.
- Evidence staleness: implemented/verified specs whose implementation
  surfaces changed in commits after the latest recorded run fail the checker
  until re-proven. Committed history only; fail-open on unresolvable or
  non-ancestor shas (squash merges); spec doc and ledger excluded.
- Re-proving protocol: `GOVERNANCE_REPROVING_SPECS` (ids or `*`) exempts
  staleness and ledger run-freshness — and only those — for the specs a
  `run-governance-gates`/`advance-spec` invocation is re-proving, riding on
  every gate of that invocation so nested real-repo validations cannot block
  the cure.
- Kit release hygiene: this changelog, plugin-manifest version parity, and
  an installed-fixture suite run enforced by the host repo's tests.
- Installer fix: template stamping no longer leaks plan metadata
  (packageManager, projectName, stack, …) into the replacement map, which
  used to rewrite identifiers inside installed engine code
  (`packageJson.packageManager` became `packageJson.<manager>`); only
  `{{UPPER_SNAKE}}` tokens stamp, and installed engine files are
  byte-identical to their templates.

## 0.3.0 — 2026-07-05

- Station-skill suite (`write-micro-spec`, `implement-micro-spec`,
  `close-micro-spec`, `install-governance`) mirrored into agent skill homes.
- Closed-record contract: verified specs close by rewriting the body into a
  machine-validated rationale record (why/invariants/pointers/dead ends).
- Evidence ledgers: tracked per-spec gate-run history, lifecycle transition
  provenance, manual attestations, and `--upgrade`-safe engine ownership.
- Factory-v2 engine: strict frontmatter subset, real glob dialect, lockstep
  engine manifest, `governance:advance` lifecycle CLI.

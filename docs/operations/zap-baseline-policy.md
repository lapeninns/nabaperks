# ZAP baseline policy

Owner: lapeninns. Applies to the required `zap-baseline` root in
`.github/workflows/ci.yml`. Rules: `.zap/rules.tsv`.

## What blocks

- A rule marked `FAIL` in `.zap/rules.tsv` fails the root. The initial set is
  the security-header, cookie, disclosure and malicious-script rules that
  passed on main at `89406771` (CI run 36695945554), so the policy started
  green and blocks regressions.
- A scan that cannot run (ZAP exit 3, for example an unreachable target) fails
  the root.
- A scan that ran but produced no report for `http://127.0.0.1:3000` fails the
  root.
- Any `/dev` page or route that is reachable in the production build fails the
  root (`scripts/ci/check-production-dev-routes.mjs`).

`WARN` findings are reported in the job log and the `zap_scan` artifact but do
not block (`cmd_options: -I`). Without `-I`, any warning exits 2 and
`fail_action: true` would block on informational alerts.

## Exceptions

Every `WARN` or `IGNORE` line needs `owner=<account>` and
`expires=YYYY-MM-DD`. `tests/contracts/zap-baseline-policy.test.mjs` fails
once an exception expires, so an expired exception turns every pull request red
until someone re-reviews it: renew it with a reason, fix the finding, or
promote the rule to `FAIL`. The nine exceptions recorded on 30 September 2026
expire on 31 December 2026.

## Scanner identity

The action's default image is the mutable `ghcr.io/zaproxy/zaproxy:stable`
tag. The workflow pins it by digest so a new ZAP release cannot change rule
behaviour without a reviewed diff. To update: resolve the new `stable` digest,
change it in `ci.yml` and `nightly.yml` together, and compare the new scan's
PASS/WARN/FAIL lists with the previous run before merging.

## Evidence of behaviour

Local drill on 30 September 2026 with the pinned image and this rules file,
running the action's command line (`zap-baseline.py -t ... -J report_json.json
-w report_md.md -r report_html.html <cmd_options>`, with no action-added `-c`
because the file has no IGNORE lines):

| `cmd_options`                    | Header-less server                                                 |
| -------------------------------- | ------------------------------------------------------------------ |
| `-I` (the first draft)           | exit 0, FAIL 0: a false green, because the rules were never loaded |
| `-I -c .zap/rules.tsv` (shipped) | exit 1, FAIL 4                                                     |

With the shipped options:

| Target                               | ZAP exit                            | Action result with `fail_action: true` |
| ------------------------------------ | ----------------------------------- | -------------------------------------- |
| HTML server without security headers | 1 (FAIL 10020, 10021, 10038, 10063) | fails                                  |
| Same server with the headers         | 0 (three WARN only)                 | passes                                 |
| Unreachable port                     | 3                                   | fails                                  |

The hosted run on the activation PR is the first platform-level evidence; it is
not yet recorded.

## Nightly full scan

`zap-full` in `nightly.yml` uses the same pinned image but stays advisory: it
proves the active scan ran, not that it found nothing. Do not treat it as a
replacement for the baseline root until it has run reliably, with owned
triage, for an agreed period.

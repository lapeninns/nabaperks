# Audit Reports

Reports are dated, point-in-time evidence. They are not the current product or
architecture source of truth. Verify any open-looking finding against the
current code, tests, and production state before acting on it.

## Categories

| Directory       | Contents                                                                                                           |
| --------------- | ------------------------------------------------------------------------------------------------------------------ |
| `architecture/` | Architecture audit, route review, implementation record, and join-flow analysis.                                   |
| `data/`         | Database-schema and stress-test audits.                                                                            |
| `marketing/`    | Marketing, GEO, SEO, and copy inventories.                                                                         |
| `research/`     | Reward-model research (code logic map, aggregate production findings, gap analysis) and the delivery-system audit. |
| `ux/`           | Merchant hierarchy, journey, and Wet Ink design audits.                                                            |

## Report status

- `architecture/architecture-audit.md` and
  `architecture/architecture-findings.md` are a remediated historical tracker;
  their checked items describe repository state at the time of closure.
- `architecture/merchant-app-route-review-implementation.md` records the
  implementation of `architecture/merchant-app-route-review.md`.
- `marketing/marketing-audit-2026-07-05-v2.md` is the follow-up to the same-day
  baseline in `marketing/marketing-audit-2026-07-05.md`; both are retained as
  historical evidence.
- `marketing/GEO-AUDIT-REPORT-2026-07-05.md` is the later source audit relative
  to `marketing/GEO-AUDIT-REPORT.md`; neither should be treated as a live score.
- `research/reward-model/` was written on 2026-09-19 against `e73a2db2` and
  read-only production queries (`queries.sql`). The production figures are
  aggregates with cells under 5 members suppressed; they describe the first 15
  days of customer data only.
- `research/delivery-audit/` was written on 2026-09-21 against `17c3094b`. Its
  raw GitHub API evidence under `data/` (about 190 MB) is ignored and kept
  outside version control; citations to those files are to the local capture.
- Every other report is historical unless a newer document explicitly names it
  as an active source.

Generated Lighthouse and mutation output is ignored and must not be committed
under this directory.

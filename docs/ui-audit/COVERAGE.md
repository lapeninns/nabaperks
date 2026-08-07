# UI audit — coverage summary

Branch `feat/ui-redesign-audit-fixes`. Per-lane detail in the `STATUS-*.md` files
beside this one; design-system detail in `STATUS.md`.

Every row marked done was verified with `pnpm typecheck`, `pnpm lint`,
`pnpm quality:fast` and `pnpm build` before its commit, and the combined branch
is green after every merge.

## Coverage against the 347 findings

| Lane                       |      Done | Partial |  Stale |   Open |
| -------------------------- | --------: | ------: | -----: | -----: |
| 05 design system (root)    |        44 |       2 |      1 |     20 |
| 04 admin                   | in flight |         |        |        |
| 03 merchant (core)         |        25 |       7 |      4 |    35* |
| 03 merchant — offers/print |         9 |       1 |      0 |      0 |
| 03 merchant — launch       |         4 |       4 |      1 |      0 |
| 03 merchant — ops          |        12 |       7 |      2 |      2 |
| 02 customer                |        40 |      10 |      2 |     18 |
| 01 marketing               |        39 |      17 |      4 |     10 |
| **Total**                  |   **173** |  **48** | **14** | **85** |

\* 31 of merchant core's "open" rows were reassigned to the three merchant
sub-lanes and are closed there; only 03#7, 03#9, 03#13 and 03#16 are genuinely open.

## "Stale" is a real category

14 findings could not be reproduced against the current tree and were recorded
rather than "fixed". Examples: `border-[1.5px]` no longer exists anywhere
(03#25); both remaining `<select>`s already compose SelectField (03#29); the
`rounded-xl` sites named in 03#60 are already `rounded-lg`; `ProgressTrack` is
not dead code (02#35); `CustomerShell`/`CustomerAppShell` already share one
column (02#5); DESIGN.md defines no `marketing-hero` token (01#15).

## Where the contract tests beat the audit

No assertion was weakened or deleted. Findings refused on this basis:
01#9, 01#10, 01#38, 01#49 (landing band order, claims boundary, GuideSpine),
02#10, 02#36, 02#60, 02#62 (pass wiring, rewards history copy, scanner exits,
barista copy), 03#47 (RA-11 pins the fixed/static reward tray), 03#37 (poster
URL shape), 03#55 (announcement maxLength).

One test was relaxed for whitespace only (Prettier re-wrapped a ternary in
`merchant-sidebar-state.test.mjs`); one was extended additively
(`merchant-shell.test.mjs` now covers `isPosterPrintPath`).

## Bugs the audit missed, found while fixing it

- Dashboard QR image overflowed its own frame by 20px on every dashboard.
- `/app/scan` had no navigation entry anywhere — reachable only by URL.
- `/app/activity` "Load more" was dead at the ceiling: it navigated to a URL
  returning the rows already on screen.
- Poster action bar documented safe-area padding it did not have; on a notched
  phone the Print CTA sat under the home indicator.
- `HomeCardTile` hid the "card unavailable" state whenever a reward was revealed.
- `RewardCollectionQr` told members to "pull down to refresh" on a page with no
  pull-to-refresh, and exposed its refresh control only after an image error.
- `LandingPricing` published four plan inclusions while `/pricing` published five.
- Two bespoke-offer surfaces carried differently worded enquiry-only disclaimers.
- A4 tent scaled its sheet against a hardcoded chrome offset nothing measured.
- The CSP theme-hash test cannot detect provider drift (see NEEDS-SIGNOFF §6).

## Not verified by any of this

Nothing here has been seen in a browser. `pnpm test:e2e`, `test:a11y` and
`test:visual` have NOT been run, and several lanes changed above-the-fold layout
(the QR workspace, the launch rewards/card tabs, `/home`, the pricing sheet).
Visual baselines will need re-approval. Treat that as required work, not polish.

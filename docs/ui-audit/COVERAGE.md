# UI audit — coverage summary

Branch `feat/ui-redesign-audit-fixes`. Per-finding detail lives in `STATUS.md`
(design system) and the `STATUS-*.md` lane files.

Counted by UNIQUE finding ID across all five reports — the lane files overlap
(the three merchant sub-lanes each cover a slice of `03-merchant.md`), so a
naive sum over those files double-counts. Every one of the 347 findings is
tracked exactly once below.

Every `[x]` was verified with `pnpm typecheck`, `pnpm lint`, `pnpm quality:fast`
(607 contract + 960 unit tests) and `pnpm build` before its commit, and the
branch is green after every merge.

| Report           | Tracked |    Done | Partial |  Stale |   Open |
| ---------------- | ------: | ------: | ------: | -----: | -----: |
| 01 marketing     |      69 |      42 |      18 |      3 |      6 |
| 02 customer      |      70 |      49 |      13 |      2 |      6 |
| 03 merchant      |      67 |      44 |      15 |      5 |      3 |
| 04 admin         |      74 |      54 |       9 |      9 |      2 |
| 05 design system |      67 |      60 |       3 |      1 |      3 |
| **Total**        | **347** | **249** |  **58** | **20** | **20** |

## "Stale" is a real category (20 findings)

Not reproducible against the current tree, and recorded rather than invented
into a change. Examples: `border-[1.5px]` no longer exists (03#25); both
remaining `<select>`s already compose SelectField (03#29); the `rounded-xl`
sites named in 03#60 are already `rounded-lg`; `ProgressTrack` is not dead code
(02#35); `CustomerShell`/`CustomerAppShell` already share one column (02#5);
DESIGN.md defines no `marketing-hero` token (01#15); QR destructive styling,
referral masking and 2FA gating were already correct by the time the admin lane
reached them (04#19, 04#33, 04#41).

Two findings were also proved wrong on the merits rather than merely stale:

- **03#16** argues the members table should adopt `DataTable` to stop rendering
  every row twice. `DataTable`'s own `mobileCard` path renders both the card
  list and the table and hides one with CSS — exactly what the hand-rolled split
  does. The migration would not remove the double mount.
- **05#28** describes "two competing inline-notice systems". `StatusBanner` is
  already a thin wrapper over `Alert`. What the merge actually left behind was
  an unstated defect: `Alert` hardcodes `role="alert"`, so success confirmations
  interrupted screen readers. That is now tone-driven.
- **05#7** claims ~74 unused custom properties. Measured: 7. The rest are
  consumed through the utility names they generate.

## Where contract tests beat the audit

No assertion was weakened or deleted. Findings refused on this basis:
01#9, 01#10, 01#38, 01#49, 01#63, 01#65 (landing band order, claims boundary,
GuideSpine, legal TOC order, legal clause headings), 02#10, 02#36, 02#60, 02#62, 02#53
(pass wiring, rewards history copy, scanner exits, barista copy, input-otp
absence), 03#47 (RA-11 pins the fixed/static reward tray), 03#37 (poster URL
shape), 03#55 (announcement maxLength).

Two tests changed, both narrowly and both declared in their commit: one regex
relaxed for whitespace only after Prettier re-wrapped a ternary
(`merchant-sidebar-state`), and one extended additively to cover
`isPosterPrintPath` (`merchant-shell`). One test was added
(`motion-tokens-bounded`).

## Remaining 19 open, by reason

Exactly: 01#23, 01#49, 01#55, 01#63, 01#65, 01#67, 02#6, 02#27, 02#28, 02#29, 02#50, 02#64, 03#13, 03#16, 03#37, 04#54, 04#60, 05#13, 05#47.

- **Blocked by a contract test** (attempted, reverted, no assertion weakened) —
  01#49 (GuideSpine hydration), 01#63 (legal TOC order — legal-p3-polish
  requires the opposite), 01#65 (legal clause headings — legal-heading-structure
  pins `mono-meta`).
- **Copy / product decision** — 01#23 (cut 8 objections to 5), 01#55 (persona
  spokes), 02#50 and 02#64 (conversion copy on the acquisition funnel), 04#54
  (operator procedure copy).
- **Needs a browser** — 02#27/28/29 (stamp-grid columns, disc sizing, reward
  slot: each changes every card in the product), 05#47 (footer density),
  04#60's sticky-header half.
- **Needs a data-layer change** — 03#13 (`MerchantNextActions` has no
  merchant-scoped aggregate), 03#16 (DataTable needs an `lg` cardBreakpoint AND
  per-renderer row props), 02#6 (breakpoint sweep needs measurement).
- **Explicitly out of scope** — 01#67 (legal migration, NEEDS-SIGNOFF §4),
  05#13 (Button size-variant API removal).
- **Large API addition** — 04#60 sorting/aria-sort across 8 live panels.
- **Partially reassigned** — 03#37 (m-offers shipped the shared
  PrintPreviewNav; the single-route collapse is pinned by
  qr-a4-poster-templates).

## Not verified by any of this

Nothing here has been seen in a browser. `pnpm test:e2e`, `test:a11y` and
`test:visual` have NOT been run, and many lanes changed above-the-fold layout
(the QR workspace, launch tabs, `/home`, the pricing sheet, legal typography,
the marquee's DOM shape, the active nav treatment). Visual baselines will need
re-approval. Treat that as required work, not polish.

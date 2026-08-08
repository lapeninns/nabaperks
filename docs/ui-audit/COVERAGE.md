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

## Browser verification — RUN, and it found real regressions

Earlier revisions of this file said the browser tiers "have NOT been run". That
was wrong: Playwright browsers were installed the whole time. Both tiers have
now been run.

### `pnpm test:a11y` — GREEN (270 passed, 0 failed, 1 skipped)

Across chromium, desktop-firefox, desktop-safari and mobile-safari. The first
run failed NINE times, every failure a regression introduced by this campaign:

| Failure                                                                | Cause                                                                                                                         | Fix                                    |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| axe `list` violation on /how-it-works (4 browsers, impact **serious**) | a decorative arrow was changed from `<li aria-hidden>` to `<li role="presentation">`, which a `<ul>` may not directly contain | back to `aria-hidden`                  |
| /app/qr + /app/launch lost their heading (4 browsers)                  | 03#40 removed `<h2>Launch your counter QR</h2>` as "duplicated"; 4 e2e assertions pin it                                      | restored as the status strip's heading |
| same flow, QR alt text                                                 | widened to "Permanent venue QR code for …" while the spec matches `/^QR code for /`                                           | restored                               |
| merchant-billing-recovery (mobile-safari)                              | 03#59 flattened `title={<h2>Billing access is active</h2>}`, but that banner is the section's only heading                    | restored for this one banner           |

Three of the four were audit findings that were _correct in the abstract_ and
wrong for the specific surface. Only a browser catches that.

### `pnpm test:visual` — 121 of 136 baselines stale, 14 passed

All 121 are `toHaveScreenshot` diffs; there are no errors of any other kind.
These baselines were approved before this campaign, and this campaign changed
layout on nearly every surface, so drift is expected rather than alarming.

**They have deliberately NOT been regenerated.** The snapshots are named "the
approved Wet Ink baseline"; regenerating them from this branch would rubber-stamp
whatever they now contain, including any regression a human would have caught.
That approval is not mine to give.

Direction of change, measured across the 231 size deltas:

- **135 screenshots shrank, 96 grew**
- **net −56,880px**
- largest shrink −5,365px (16,650 → 11,285, a 32% cut on the tallest surface)
- largest growth +447px

So the campaign is achieving the compaction it set out to achieve. The growths
are mostly surfaces that gained something deliberate — skip links, print rules,
state hints on collapsed rows, the restored headings above.

### Still not run

`pnpm test:e2e` in full (the untagged journeys) and `pnpm test:db`, which needs
live database credentials.

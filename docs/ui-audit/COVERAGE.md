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

| Report           | Tracked |    Done | Partial |  Stale |  Open |
| ---------------- | ------: | ------: | ------: | -----: | ----: |
| 01 marketing     |      69 |      55 |       6 |      3 |     5 |
| 02 customer      |      70 |      63 |       5 |      0 |     2 |
| 03 merchant      |      67 |      55 |       8 |      4 |     0 |
| 04 admin         |      74 |      64 |       2 |      7 |     1 |
| 05 design system |      67 |      64 |       2 |      0 |     1 |
| **Total**        | **347** | **301** |  **23** | **14** | **9** |

## "Stale" is a real category (17 findings)

Not reproducible against the current tree, and recorded rather than invented
into a change. Examples: `border-[1.5px]` no longer exists in `app/**` or
`components/**` (03#25, now pinned by `tests/contracts/ink-border-weight.test.mjs`);
exactly one `<select>` exists product-wide and it is `SelectField`'s own
(03#29); the `rounded-xl` sites named in 03#60 are already `rounded-lg`; `ProgressTrack` is not dead code
(02#35); `CustomerShell`/`CustomerAppShell` already share one column (02#5);
DESIGN.md defines no `marketing-hero` token (01#15); referral masking and 2FA
gating were already correct by the time the admin lane reached them (04#33,
04#41) — though 04#19 has since come OFF this list, see below.

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

## Remaining 12 open, by reason

Exactly: 01#23, 01#49, 01#55, 01#63, 01#65, 01#67, 02#50, 02#64, 03#13, 03#16, 04#54, 04#60, 05#13.

"Needs a browser" is no longer a category — Playwright works here, and the
findings previously parked under it (02#27, 02#28, 05#47, 04#67) were measured
and either fixed or closed with evidence.

- **Blocked by a contract or e2e test** (each attempted, reverted, nothing
  weakened) — 01#49, 01#63, 01#65, 03#46 (recorded in STATUS-m-launch).
- **Copy / product decision** — 01#23, 01#55, 02#50, 02#64, 04#54.
- **Needs a data-layer change** — 03#16 only. 03#13 was here and is now done;
  the paragraph that kept it here is preserved below because the way it was
  wrong is the reusable part.
  03#13's blocker read: `deriveMerchantCustomerRewardBadge` runs per-member over
  `activeReward`, `lastVisitAt`, stamp count and redemption history, so a
  merchant-wide count means duplicating that logic in SQL or loading every
  member. The premise was that the count must mirror the BADGE. It does not
  have to. "Rewards ready to redeem" is `reward_events.status='unlocked'` with
  `redeemable_from` on or before today, and `ready` is FIRST in the badge's
  first-match-wins chain, so nothing can outrank it — the SQL predicate and the
  badge agree by construction, with no derivation duplicated. "Gone quiet" is a
  plain `last_visit_at` predicate, and making it plain FIXED a defect: the old
  badge-tone filter hid a member 40 days absent who also had a reward waiting.
  Both are `head: true` COUNTs in `lib/merchant/customers-view.ts`, and the
  dashboard row and the members filter read the same one, so neither can print
  a number the other contradicts.
  03#16 needs an `lg` cardBreakpoint AND per-renderer row props on DataTable;
  note the merchant lane proved the finding's premise wrong (DataTable's own
  mobileCard path also double-mounts), so the migration would not remove the
  double render it cites.
- **Explicitly out of scope** — 01#67 (legal migration), 05#13 (Button
  size-variant API removal).
- **Large API addition** — 04#60 sorting/aria-sort across 8 live panels; its
  sticky-header half is blocked by the `overflow-x-auto` scroll container.

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

### `pnpm test:e2e` — run, and it found five more regressions

The full journey suite had never been run either. It surfaced failures that both
the static contract tests and the 960 unit tests passed straight through:

| Failure                                                                        | Cause                                                                                                                                                                   | Fix                                               |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| every password field on /signup and /reset-password had **no accessible name** | 05#24's reveal toggle wrapped the Input in a `<span>`; FormField clones its single child to inject id/aria-describedby/aria-invalid, so all of it landed on the wrapper | FormField gained a `trailing` sibling slot        |
| verify screen hid its recovery links                                           | 05#53 put "Log in"/"reset your password" behind a disclosure; merchant-auth-recovery asserts they stay visible ("keeps recovery paths")                                 | reverted, 05#53 recorded as blocked by test       |
| three billing outcome banners lost heading role                                | 03#59 flattened `title={<h2>}` to plain strings, but that banner is the section's only heading on every Stripe return path                                              | `<h2>` restored for that banner                   |
| the press disc moved 21px sideways mid-hold                                    | 02#25's hint line unmounted during a press, changing page height and toggling the scrollbar                                                                             | hidden with `invisible`, space kept               |
| …same test, second cause                                                       | 02#19 made the status band growable (`min-h-20`); the original fixed height existed so growth could not move the grid                                                   | fixed `h-20` — 02#19's smaller size, pinned again |

Four of the five are audit findings that were right in principle and wrong for
the specific surface. The password one is the most serious defect this campaign
produced, and nothing but a browser would have caught it.

Traced by bisection against the campaign base, not by guesswork.

### Chromium journey suite — GREEN (204 passed, 0 failed, 49 skipped)

`pnpm exec playwright test --project=chromium --grep-invert @visual`

Two further campaign regressions were found and resolved after the five above:

- **03#46 (onboarding blur validation) — REVERTED.** After that change the first
  invalid field was no longer focused on a failed submit, leaving a merchant on
  the button with an error announced but never reached. Three candidate fixes
  each reproduced correct behaviour in a standalone probe yet still failed in the
  suite, so the file was reverted to its last passing state rather than shipping
  a guess into the activation-critical form. Recorded as blocked by test.
- **offer-campaign locator** — the test located the reward tile by a name that
  contradicted its own href assertion, which is exactly finding 02#11 (WCAG 2.5.3
  Label in Name). The locator was updated to the corrected name; every assertion
  in that test is byte-identical.

Test changes made in this entire campaign, in full: one whitespace relaxation in
`merchant-sidebar-state`, one additive extension in `merchant-shell`, one new
file `motion-tokens-bounded`, and this one locator. No assertion was ever
weakened or deleted.

### Full browser matrix — GREEN

Journeys only (`--grep-invert @visual`), all four projects:

| project         | passed | failed |
| --------------- | -----: | -----: |
| chromium        |    204 |      0 |
| desktop-firefox |    187 |      0 |
| desktop-safari  |    187 |      0 |
| mobile-safari   |    235 |      0 |

`pnpm test:a11y` also passes across all four (270).

mobile-safari found two further regressions that the other three projects
structurally could not, because the specs involved are not `*.desktop.spec.ts`:

- **the dashboard had no counter action inside `<main>` on a phone.** 03#8
  removed the header actions below `sm` because the bottom tab bar carries Scan
  — but the tab bar is a sibling of `main`, so the dashboard's own content
  offered no way to scan. Restored as one wrapping row of compact buttons, which
  keeps 03#8's height saving.
- **"Reward collected" stopped announcing as an alert** — a regression from
  05#28. Tone-driven roles are right for a save confirmation and wrong for a
  counter transaction closing. `StatusBanner` now takes an explicit `role`
  override, documented as the exception.

Eleven regressions in total have been found and fixed by the browser tiers in
this campaign. Every one was introduced by an audit finding that was correct in
principle and wrong for the specific surface.

### Still not run

`pnpm test:db` (needs live database credentials) and the 121 stale visual
baselines, which are a human approval rather than a run.

### A note on inherited assumptions

03#49 was closed this turn only because a lane's stated reason for skipping it
turned out to be half wrong. m-ops declined it on the grounds that neither
remaining form is "longer than one viewport". Measured at 390x844:
announcement compose is 883px and 948px; account/profile is 659px. The
assumption held for one form and not the other.

Where a finding was skipped on a factual claim, that claim is worth measuring
before trusting it — including claims made by the agents doing the work, and
including my own.

### Two open findings, re-measured

Applying the same discipline to the remainder rather than repeating their
recorded blockers.

**01#49 — CLS 0.1924 on the SEO hub. SUPERSEDED — see the correction below.**
This was measured against a dev server. The identical probe on a production
build gives 0.0000, Lighthouse on the built artefact gives 0.0000 across three
runs, and the collapsing list sits below the fold at top 1295px so it moves no
visible content. The paragraph is kept because the reasoning that followed from
it — that the assertion and the fix were incompatible — shaped several later
decisions, and it was wrong at the root. NEEDS-SIGNOFF §7 carries the
correction.

**05#13 — the audit's usage figures are stale.** It reports "xl, icon-xs and
icon-lg are never used" and "xs 1". Re-measured across 310 Button/SubmitButton
call sites: implicit default 134, lg 77, sm 74, xs 7, explicit default 6,
icon-sm 6, icon 4, icon-lg 2, xl 0, icon-xs 0. Only `xl` and `icon-xs` are
genuinely unreachable. A four-rung cut would touch roughly 90 live call sites,
not the handful the finding implies — which materially changes the cost of a
decision that was already out of scope.

### 01#12 completed — the last "needs a browser" deferral

The three marketing heroes were parked as needing visual judgement. Measured and
swept this turn. Hero grid height at 768px:

| hero          | stacked | two-column | saved |
| ------------- | ------: | ---------: | ----: |
| landing       | 1,044px |      708px | 336px |
| /how-it-works |   975px |      643px | 332px |
| pub guide     | 1,117px |      721px | 396px |

No horizontal overflow at 768, 900 or 1024. At 768px the prose track is 313px —
what a 390px phone already renders it at after gutters — and the card track is
375px, wider than the phone rendering it replaces.

Nothing in this campaign is now deferred for lack of a browser.

### A third stale blocker (02#33)

The customer lane recorded 02#33's counter-mode half as blocked because "there is
no web brightness API". True — and the finding itself asks for brightness "or at
minimum a presentation mode". The impossible half was allowed to block the
possible one, and the merchant console had shipped the equivalent
(`present-qr.tsx`) since launch while the member holding the code had nothing.

That is now three findings closed by re-testing a recorded blocker rather than
writing new analysis: 03#49 (a measurement that was half wrong), 01#12 (a
constraint that had dissolved), 02#33 (one impossible half blocking a possible
one). It is worth treating "blocked" notes as claims with a shelf life.

### A fourth and fifth stale blocker (02#30, 04#62)

- **02#30** said shrinking the ticket stub "needs a rendered measurement, not a
  guess". Measured: "REDEEMED" is 54px, so the floor is 70px and the audit's own
  `w-14` (56px) suggestion was never viable. Shipped at 72px.
- **04#62** said the edge fade "needs scroll detection". It does not — two
  background layers at `local` and two at `scroll` do it with no listener.

Five of the last six findings closed came from re-testing a recorded blocker
rather than writing new analysis. The blockers were written in good faith by
agents with the right instinct that stopped one question early. Treat every
"[~] blocked" note as a claim with a shelf life.

This applies to my own notes too: NEEDS-SIGNOFF §10 recorded the font fix as
"blocked by a contract" before I had checked _which files_ that contract pinned.
It pinned four, and the two causing the regression were not among them.

### The blocker sweep, totalled

Nine recorded blockers re-tested; seven did not survive:

| finding | recorded blocker                   | what it actually was                                 |
| ------- | ---------------------------------- | ---------------------------------------------------- |
| 03#49   | "neither form exceeds a viewport"  | one was 883-948px                                    |
| 01#12   | "needs a browser"                  | the browser existed                                  |
| 02#33   | "no web brightness API"            | true, but blocked the achievable half                |
| 02#30   | "needs a rendered measurement"     | floor is 70px; the audit's own target was impossible |
| 04#62   | "needs scroll detection"           | pure CSS does it                                     |
| 04#72   | (chip row only)                    | `?only=` was a wrapper, not 16 props                 |
| 02#20   | "rails are contract-pinned"        | **no test references any rail**                      |
| 02#68   | "a boundary has no venue data"     | true — and it was shielding a wrong-venue bug        |
| 04#47   | "needs ids through ~20 call sites" | `useId` + clone; 79 call sites untouched             |

The shape repeats: someone with the right instinct stopped one question early.
Two were mine (the font contract, and this list's own framing of 04#47).

### A counting bug in my own tally, and the lane-scope class of blocker

Two things surfaced together while closing 03#65/66.

**The tally was undercounting.** `STATUS-m-ops.md` puts the status marker in
column 1; every other lane file puts it in columns 2-4. My `mark_of()` scanned
columns 2-4 only, so seventeen m-ops rows parsed as "no marker" and fell back to
whatever `STATUS-merchant.md` said — which for several was a stale `[~]`. Fixed
by parsing both shapes. The total is still 347, so nothing was lost, but per-
report numbers before this point understated 03.

Reconciling the two files then surfaced exactly one genuine disagreement:
03#53, open in m-ops and done in merchant. Checked the code —
`components/data/console-filter-bar.tsx` exists and both
`customer-readback-table.tsx` and `activity-detail-feed.tsx` import it. The
m-ops row was stale and is now synced.

**"Outside this lane's file scope" is not a blocker for the root.** Three
findings (03#53, 03#65, 03#66) were recorded blocked purely because a sub-agent
could not touch another lane's files. That was true for them and never true for
the root agent. Worth checking for whenever a note blames ownership rather than
the code.

### The browser tiers are blind to motion

`playwright.config.ts` sets `reducedMotion: "reduce"` on every project. Anything
guarded by `prefers-reduced-motion` — which is every animation in this codebase,
by design — is therefore inert in all 813 journeys, the a11y sweep and the visual
baselines.

Found while trying to verify 01#17: the hero stamp loop never advances in an
automated run, on this branch or on the unmodified baseline. A probe that
appeared to show a resume regression was in fact counting unrelated page
timeouts.

FIXED: a `motion` Playwright project now overrides
`contextOptions.reducedMotion` for `**/*.motion.spec.ts`, and
`hero-motion.motion.spec.ts` watches the hero loop for real.

Two lessons from building it.

**The override has to be `contextOptions.reducedMotion`, not the `reducedMotion`
test option.** The root config sets the former and it wins, so a file-level
`test.use({ reducedMotion: "no-preference" })` silently does nothing — the page
still reports `reduce: true`.

**Two of my three tests passed with the fix reverted.** Pausing always froze the
picture; the defect was that the loop kept scheduling underneath and
`cycleIndex` drifted. Only the reward NAME exposes that. A test that cannot fail
proves nothing, and sabotage-checking every new assertion is cheap next to
shipping one. That check should be routine, not a flourish.

### Two tooling blind spots found while closing 05#27

**`deadcode:check` cannot see `components/ui/`.** `knip.json` lists
`components/ui/**/*.{ts,tsx}` as an ENTRY pattern, so every export there is
reachable by definition. Six dead exports in `field.tsx` and an entirely unused
`separator.tsx` sat behind a green dead-code gate. A passing `deadcode:check`
says nothing about a primitive.

**Editing `.design-sync/` was uncommittable.** It is eslint-ignored on purpose,
but lint-staged still passed staged files to eslint, which warned "File ignored
because of a matching ignore pattern" — and `--max-warnings=0` made that a
failed commit. `--no-warn-ignored` fixes it without weakening anything.

Also re-ran the sabotage check on the one test this campaign added,
`motion-tokens-bounded`: adding `repeat: Infinity` to a token fails it, removing
it passes. It is a real test.

### Auditing the [stale] markings

[stale] had been the one status I never questioned — it means "the audit is
describing code that no longer exists", which sounds self-verifying. Checked all 20. Two were wrong.

**03#25 was reopened by a merge.** Its note read "does not appear anywhere in the
tree. Verified by grep", which was true when written. Merging main brought back
six `border-[1.5px]` occurrences across four files. A [stale] note is only true
as of the commit that wrote it, and a merge can resurrect a closed finding —
worth re-running the greps that justified a closure after any significant merge.

**05#56 was marked [stale] with no reasoning**, and the copy it describes was
still in the tree. Resolved by scoping the DESIGN.md rule rather than changing an
honest merchant label.

Five of the remaining eighteen were spot-checked by grep (04#2, 04#46, 04#59,
04#29, 01#11) and all hold.

### Post-merge regression sweep

03#25 showed a merge can resurrect a closed finding, so I swept the 301 files
main touched against every pattern this campaign had removed: `rounded-xl`,
`rounded-2xl`, `list-disc`, `max-w-7xl`, `adminSelectClasses`, `sm:w-[88px]`,
`shadow-md`, `border-[1.5px]`.

Result: **two real regressions, both already fixed** — the six `border-[1.5px]`
main reintroduced, and one `rounded-xl` I left in the offers harness while
fixing its real twin during conflict resolution. Everything else was either a
false positive (the pattern appearing inside the comment that explains its
removal) or out of the relevant finding's scope.

Two observations recorded rather than acted on, because no finding covers them:
`offer-rules-summary.tsx` still uses `list-disc` on a merchant surface while the
customer sees ink markers for the same terms; and eight files use 1px
`border-b border-dashed` dividers, which DESIGN.md's 2px `.w-rule` rule does not
actually govern.

Worth building into any future merge: re-run the greps that justified each
closure. A closed finding is a claim about a tree, and the tree moves.

### Blockers that are really lane boundaries

Four findings so far were recorded blocked for reasons that were true of the
sub-agent that wrote them and never true of the root: 03#53, 03#65 and 03#66
("outside this lane's file scope"), then 01#32 and 02#35 ("needs app/globals.css",
"needs a merchant-lane import change"). All five are now closed.

The tell is a note that names a FILE or an OWNER rather than a behaviour. Worth
grepping for after any parallel campaign:

    outside (this|the) lane · file scope · owned by another lane · out of scope

A second tell, seen in 04#56 and 02#33: a blocker that is true of one half of a
finding and quietly applied to the whole. "'Go to page' and rows-per-page need a
`size` param" was true only of rows-per-page; the page jump needed no new param
at all.

### Full re-verification after the second wave of changes

The merge and everything since (data-on-ink, the page-title sweep, the header
custom property, the ProgressTrack barrel change, six deleted field.tsx exports,
`?only=`, the harness nav, the admin page jump) is a lot of surface. Re-ran the
two highest-value browser tiers rather than trusting the unit gates:

| tier                   | result                               |
| ---------------------- | ------------------------------------ |
| chromium journeys      | **202 passed**, 49 skipped, 2 failed |
| mobile-safari journeys | **232 passed**, 66 skipped, 3 failed |

All five failures re-ran clean in isolation (`analytics-funnel-privacy`,
`merchant-qr-image-route`, `cron-route-auth` x2 — 25 passed on the retry). They
are parallel-load flakes on session/cron routes, and none of them touches
anything changed here.

Also verified while sweeping for undercounted call sites that the `rounded-2xl`
still present in six shadcn primitives is dead source, not a live defect: the
unlayered theme wins, and the computed radii are 10px on input/textarea/alert,
999px on badge, 4px on progress. 02#34's [stale] marking was right.

### I duplicated an existing analysis

NEEDS-SIGNOFF 6 already documented the CSP theme-hash drift hole — measured, with
the `enableSystem: false` hash recorded — before I investigated 05#61 and wrote
it up again as 14. Two sections describing one problem, the later one thinner.

Folded 14 into 6 and implemented 6's own prerequisite 1: `NEXT_THEMES_OPTIONS`
is now one shared module, so flipping `enableSystem` fails the hash assertion
instead of silently breaking CSP in production.

The lesson is about method, not tidiness: I searched the CODE for prior art and
not the campaign's own documents. NEEDS-SIGNOFF is 500 lines across sixteen
sections written over many turns, and it is now the second most likely place for
a prior answer to already exist. Read it before investigating anything it might
cover.

### A fourth blocker tell: "needs X" where X already exists

02#43's remaining half was recorded as needing "client state and a decision on
the 40-item default". `ShowMoreList` already existed, already used by DataTable
and admin/pilot, with a docblock saying server components can hand it
pre-rendered nodes. No state to write, no default to decide.

04#6 was the same shape one level down: the fraud loader already requested
`{ count: "exact" }` and already returned `flagTotal`, and no surface read it.
The data an operator needed was being fetched and discarded.

So the tells now number four. A blocker is worth re-testing when it:

1. names a FILE or an OWNER rather than a behaviour ("outside this lane");
2. is true of one HALF of the finding and applied to the whole;
3. asserts a fact about the tree that a merge or later work has changed;
4. says something must be BUILT — check whether it already exists first.

### Where the unsignposted-cap defect does NOT apply

Having fixed five of them in `lib/admin/*`, I checked whether the same class
exists in the merchant and customer loaders. It largely does not, and the
exceptions are instructive:

- `lib/customer/offer-pass.ts` caps at 20 passes, ordered soonest-to-close, with
  a docblock explaining it as a pathological-account guard. A member holding
  more than twenty live passes is not a real case, and the ordering means
  anything dropped is the least urgent. A "showing 20 of N" line on a member
  screen would be chrome for a case that does not occur. **Left alone.**
- `lib/merchant/activity.ts` uses `.limit(limit + 1)` — the standard
  "is there another page" probe — and 03#52 already made the footer name the
  ceiling.
- Everything else is `.limit(1)`, a single-row lookup.

The admin caps were different in kind: 100 merchants is an ordinary platform
size, and the evidence picker was ALPHABETICAL, so what got dropped was
arbitrary rather than least-important. That is what made silence there a wrong
answer rather than a small omission.

Applying a pattern is not the same as applying it everywhere.

### Auditing the source, not just the call sites

03#25 was closed twice on call-site greps while the utility those call sites
imitated — `.w-tag`, at 1.5px — went unchecked. That prompted a sweep of every
border width declared in `app/globals.css` against DESIGN.md's "borders are 2px
solid ink everywhere".

Five non-2px declarations, and one of them was mine: the `data-just-updated`
stamp I added for 04#50 shipped at 1.5px, days after sweeping 1.5px out of the
tree. Fixed. A rule is only as good as the next thing written under it, and I
was the next thing.

Two are legitimate and should be left: `.ink-check::after` at 2.5px and the
earned-stamp inner ring at 1px are **glyph strokes**, not container borders — a
tick drawn from two borders, and a decorative ring inside a stamp. DESIGN.md
governs the edge of an element, not the weight of a mark that happens to use
border syntax. Recorded so a future sweep does not turn a checkmark into a box.

Generalising: when a finding is "pattern X appears at N call sites", check
whether the design system's own source declares X too. The call sites are
usually imitating something.

### The tally table was wrong for most of the campaign

`COVERAGE.md`'s summary read 253/60/20/14 — many turns out of date — while every
turn's reported figure came from a fresh parse. Prettier aligns these tables
into padded columns and the update regex assumed single spaces, so it matched
nothing, silently, every time. HANDOFF's unpadded `| Done | N |` rows DID match,
so the two files disagreed and neither looked broken.

Two habits would have caught it, and both are ones this campaign already relies
on elsewhere: read back what an automated edit produced, and cross-check two
documents that should agree. A regex that matches nothing and a regex that
matches correctly exit the same way.

### Blocked-on-each-other, and premises worth measuring

Two corrections this turn, neither of which changed a count but both of which
change what a reader should do next.

**01#60 is gated on 01#49, not on refactor size.** Its note said reusing
`GuideSpine` meant "a larger refactor of a contract-pinned client component".
`marketing-offer-source` pins exactly one line in that file, not the component's
shape — and that line was believed to be 01#49's measured CLS 0.1924, a dev-server number since disproved (production: 0.0000). Reusing the spine would
take a layout-shift defect that currently affects one page and put it on every
guide. Doing 01#60 "properly" first would make the site more consistent and
measurably worse.

**01#9's premise is overstated.** The finding says the Marquee and ProofLine
"say the same four things". They do not: the marquee says "One venue QR /
28-day platform pilot / No POS setup / Fast at the counter", the ProofLine says
"Built around how independent pubs actually work / A [term] — no app to
download / Return visits shown in your dashboard / [capLine]". Four different
strings in the same register. The contract pin on their presence is real; the
duplication it is protecting is thematic, and rewording is a marketing copy cut,
which is excluded by standing instruction anyway.

Both were recorded as blocked and both were blocked — for different reasons than
the ones written down. A wrong reason is a bad instruction to whoever picks it
up: one of these would have been "fixed" into a regression.

### The contract-blocked notes are trustworthy

After correcting two blockers that gave the wrong reason (01#60, 01#9), I checked
the rest of the same class: every status note that names a contract test.
Nineteen claims across the five reports, seven of them checked assertion by
assertion.

**All nineteen are accurate.** The named file exists in every case, and where I
read the assertions they say what the note says they say:

| finding | claim                                                                  | verified            |
| ------- | ---------------------------------------------------------------------- | ------------------- |
| 03#47   | `reward-preset-atomic-add` pins `fixed … sm:static` and `pb-[8.75rem]` | lines 109-111       |
| 03#55   | `merchant-venue-announcements-ui` pins `maxLength={80}` / `{180}`      | lines 87-88         |
| 02#50   | `customer-join-frictionless-ux` pins `TermsFirstStampPreview`          | present             |
| 02#60   | `customer-error-boundaries` pins both exits                            | present             |
| 02#64   | `offer-campaign-ui` pins where `StampGrid` renders                     | present             |
| 01#63   | `legal-p3-polish` implements MKT-P3-14/15                              | header + assertions |
| 01#65   | `legal-heading-structure` pins the `mono-meta` h2                      | present             |

So a reader can act on "blocked by contract X" without re-deriving it. The two
wrong reasons were both about the SHAPE of the block — 01#60 named refactor size
when the real gate was a CLS defect, 01#9 named a duplication that measurement
does not support — not about whether a contract existed.

Worth noting how the check went: my first pass reported 03#55 as unfounded, and
my second reported 03#47's spacer as unpinned. Both were my own escaping —
`maxLength=\{80\}` and `pb-\[8\.75rem\]` appear escaped inside the test's
regexes. A verification tool that returns "not found" is making a claim too, and
it needs the same scepticism as the thing it is checking.

### The capped-column breakpoint defect, swept

02#6's real defect was one line: `sm:grid-cols-2` on the scanner exits, which
produced two 173px buttons in a 358px row at an 800px viewport. Swept for the
same shape elsewhere, since anything rendered INTO the 410px customer column can
make the same mistake.

- `components/loyalty`, `components/forms`: no horizontal `sm:` splits at all.
- `components/brand/typography.tsx`: `SectionHeader` uses
  `sm:flex-row sm:items-end sm:justify-between`, which WOULD squeeze inside the
  column — but only when it has `actions`. Checked every customer-surface
  call site: **zero** pass `actions`, so the row has a single child and the
  variant is inert. Left alone.

One real instance, one checked negative. The remaining `sm:` variants in the
customer files are outer gutters growing past a column that is already capped,
which is harmless — so the `@container` conversion 02#6 recommends is a
tidiness pass, not a defect, and should be budgeted as one.

### Full re-verification, third pass — and a named flake set

Re-ran both journey tiers after the SectionHeader band prop, the SnapRail client
conversion, the scanner exits, four admin truncation notices, the theme-provider
refactor, six deleted `field.tsx` exports and the globals.css border audit.

| tier                   | result                               |
| ---------------------- | ------------------------------------ |
| chromium journeys      | **202 passed**, 49 skipped, 2 failed |
| mobile-safari journeys | **232 passed**, 66 skipped, 3 failed |

All five re-ran clean in isolation. More usefully, the failures are the SAME
FILES every run, across three separate full-matrix passes:

- `analytics-funnel-privacy` (both tiers)
- `cron-route-auth` (mobile-safari)
- `merchant-auth-recovery-flow` (chromium)

Session-identity and cron-secret routes, all timing-sensitive, all passing
alone and failing only under a saturated worker pool. None of them touches
anything this branch changed — worth knowing before someone reads a red matrix
as a regression, and worth quarantining or serialising if it keeps costing CI
runs.

### One unverified unit-test failure, recorded rather than buried

A single `quality:check` run in the final verification of this turn reported
954/955 with one failure, and the failing test name did not survive the grep I
had piped it through. Eight subsequent runs — six of `test:unit`, three of the
full `quality:check` — are clean at 955/955.

I could not reproduce it and I could not name it. Since then: **10 further full
`test:unit` runs** (all 955/955) and **21 targeted runs** across the seven
time-sensitive files (`activity-display`, `birthday-window`, `marketing-promo`,
`profile-fields`, `resilience`, `seed-stress`, `standard-webhook`) — every one
clean. So this is not a diagnosis; it is a note that it happened once, on a
branch whose whole claim is that its gates are green. If a unit test starts failing intermittently in CI, this is the first
evidence of it and the likely candidates are the time-sensitive suites
(`tests/unit` files touching `Date.now`, `setTimeout` or `new Date()`).

Saying "it passed on re-run" and moving on is exactly the habit this campaign
has spent thirty turns arguing against.

### A blocker that was wrong AND right

03#3's note said the readiness chip and Members count "need server state the
shell deliberately does not take". Half of that is false: `app/app/layout.tsx`
already renders `MerchantSetupReminder` inside `<Suspense>`, an async server
component that calls `getMerchantLaunchReadiness()`. The data is in the shell's
subtree today; a chip would need a slot prop, not an architecture change.

But the conclusion still holds, for a better reason. That reminder panel already
shows readiness on every console route while launch is incomplete. Adding a
sidebar chip would make three representations of one fact — panel, chip, and the
Setup nav group — which is precisely what 03#43 spent its effort removing from
the readiness panel.

So the right note is not "we cannot" but "we should not, and here is what would
happen if we did". The Members count remains genuinely blocked: it needs a
per-render count query the console does not run.

Worth remembering that a wrong reason can still guard a right decision, and that
checking it is what tells you which one you have.

### The "copy the existing pattern" claims, swept

03#18 pointed at a server-side search pattern in `activity-detail-feed` that
only half exists, so I checked every finding making that kind of claim. There
are three:

| finding | claim                                                                       | verdict                                                                                                               |
| ------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 01#17   | "the pattern already exists" (`guide-spine`'s IntersectionObserver)         | **true** — and closed with a simpler `scrollLeft` read                                                                |
| 03#39   | "the `workspaceHref(base, channel, template)` query pattern already in use" | **true** — `workspaceHref` exists, used in five places, and the tabs shipped on it                                    |
| 03#18   | "matching the pattern activity-detail-feed already uses"                    | **half false** — `filter` is a column predicate there and derived state here; `q` is deliberately client-side in both |

One of three, not an epidemic. Worth checking each time anyway: a pointer to an
existing pattern is the most persuasive line in a finding, and the one least
likely to be re-derived by whoever implements it.

### A grep that searched for the wrong noun (02#20)

NEEDS-SIGNOFF 11 corrected the customer lane by proving that **no test in
`tests/` references any of the five card rails** — it grepped the component
names. `ReferralSharePanel` is indeed absent from `tests/`. The panel is not:

    tests/e2e/customer-referral-bonus-stamp.spec.ts:102
      const share = page.getByTestId("referral-share-panel")
      await expect(share).toBeVisible()

A React component and its rendered `data-testid` are two different strings, and
a browser test only ever knows the second one. Measured on the referral-bank
harness at 390px, wrapping that panel in a closed `<details>` takes the card
page from 1646px to 1365px (−281px) and makes `isVisible()` false — so the
audit's "closed by default" fails a live assertion nobody had found.

When checking whether a component is under test, grep for **all three** of its
names: the export, its `data-testid`, and the copy it renders.

### The same correction, applied to itself (02#6)

The lane recorded "only 12 `sm:` variants remain across the four named files and
ZERO elsewhere in `components/customer`". Both halves were produced by reading
the files the AUDIT named. A comment-stripped scan of the whole customer column
found three more, in three files the audit never listed — including a
`sm:grid-cols-2` in `customer-qr-scanner-loader.tsx` that the loaded scanner had
already dropped, under a comment claiming the two surfaces match.

Two lessons, both cheap: scan the surface, not the file list a finding happens
to cite; and strip comments before asserting a class is absent, because the
comment explaining why a class was removed contains the class.

### The merchant lane's blocker sweep (03#1, 12, 37, 47, 55, 64)

Six recorded blockers re-tested against a running browser. Two did not survive,
two survived with the wrong reason attached, two were exactly right.

| finding | recorded blocker                                | verdict                                                                                          |
| ------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 03#55   | "`maxLength` is pinned, so the half stays open" | **wrong scope** — the pin covers the limit, not the silence. Closed.                             |
| 03#12   | "side-by-side at md+ is a page restructure"     | **wrong breakpoint** — at md it is impossible, not merely large. Shipped at xl.                  |
| 03#64   | "no device to enumerate against here"           | **wrong reason** — the repo already stubs `enumerateDevices`. Decision stands for other reasons. |
| 03#1    | "still an unconditional stacked card"           | **wrong word** — it is conditional on route and on `!launchReady`. Open on the merits.           |
| 03#47   | "RA-11 pins `fixed … sm:static` and the spacer" | **correct**, lines 109-111.                                                                      |
| 03#37   | "poster URL shape is contract-pinned"           | **correct**, line 31 — and a second pin the note missed.                                         |

Three numbers worth keeping.

**03#12 — `md` was never available.** The console sidebar is 272px, so the
audit's `md:grid-cols-[18rem_minmax(0,1fr)]` at a 768px viewport divides a
448px column into an 18rem sidecar and 136px for four KPI tiles: 34px each. At
lg it is 94px. Only at xl (944px of column, 148px tiles) does the finding's own
layout fit. Shipped there: 1,676px → 1,448px at 1280, unchanged below xl.

A finding that names a breakpoint has usually been written against the viewport,
not against the column the component actually gets. In a console with a fixed
sidebar those are 320px apart.

**03#47 — a spacer stopped being a guess.** The finding calls `pb-[8.75rem]`
"guesswork ... two lines of copy + a two-button row wraps differently at 320px".
Measured across selection counts 1–7 at 320, 360 and 390: the tray is 140px
every single time, which is `8.75rem` exactly. Earlier work in this campaign had
already made the claim stale by shortening the copy and fixing the button row's
grid. Its sibling recommendation — one line with both buttons inline — is
arithmetically impossible on a phone: 272px of inner width at 320px against a
202px count line and 76px + 184px buttons.

**03#64 — the impossible half and the possible half are different questions.**
Manual code entry really is blocked: the payload is a uuid minted server-side
with a 10-minute TTL and rendered only as a PNG, so there is no code to type.
The camera picker is not blocked by anything the note named — the repo's own
scanner spec already stubs `navigator.mediaDevices.enumerateDevices`. It is
still declined, because a stub proves the control renders and not that a real
second camera decodes, and because it would give the merchant scanner a control
its customer twin does not have. A wrong reason that guards a right decision is
worth correcting anyway: the next agent reads the reason, not the decision.

**A grep that returns nothing is making a claim.** Checking 03#37 I first
concluded neither contract mentioned the poster path, because
`grep 'app/qr/poster'` finds nothing in `qr-a4-poster-templates.test.mjs`. The
assertion is there; it is regex-escaped as `app\/qr\/poster`. That is the third
time in this campaign an escaped literal has produced a false negative, and the
second time it nearly reversed a verdict.

### Contract allowlists are a list of known defects

The claims gap (NEEDS-SIGNOFF 24) came out of an allowlist inside a contract, so
I grepped every contract for the same shape — "KNOWN", "pre-existing", "tracked
separately", "allowlist". Twelve comments, eight files, and two were real
defects the audit never saw:

1. **`marketing-offer-source`** allowlists two guides files from the "name a
   guarantee, render its boundary" rule. Escalated, not fixed: it is copy on
   three indexed pages and a claims question (section 24).
2. **`public-indexing-policy`** allowlisted `Disallow: /merchant` blocking the
   public `/merchant-terms`. Fixed here, and the allowlist is now empty.

The second one had drifted worse than its own comment: the note justified the
low severity by saying the page was absent from the sitemap, and
`/merchant-terms` is in `PUBLIC_SITE_ROUTES`. The site published it in
sitemap.xml and disallowed it in robots.txt simultaneously.

A contract allowlist is a defect someone chose to defer, written down in the one
place that will never be read by a design audit. Worth grepping at the start of
work like this, not turn 34.

### The contract sweep, run harder

The first sweep grepped for "KNOWN", "pre-existing", "tracked separately" and
"allowlist" and found two live defects. This one went after the quieter shapes —
`.filter(`, `.slice(`, hard-coded expected arrays, conditional skips, and gate
scripts with exception lists. Nine checks came back clean **with numbers**, and
three things came back that nobody had recorded.

#### Clean, and here is the measurement

| checked                                             | result                                                                                                                                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| skipped / `todo` contract tests                     | **0**. The one conditional skip gates on two files that both exist; both suites report `# skipped 0 # todo 0`                                                                  |
| `.filter(` in contracts                             | 16 sites, 15 are parsing. The 16th narrows the "no Supabase server client" rule to `components/` — redundant, `eslint.config.mjs` bans that import for **all** `components/**` |
| file-scoped `focus-visible:ring` bans (6 contracts) | **1** occurrence tree-wide, and it is a comment in `globals.css`                                                                                                               |
| hard-coded `deepEqual` arrays                       | 19. Eighteen are positive specifications that fail when reality moves; the one exclusion list is the known claims gap                                                          |
| `existsSync(…) ? read : ""` readers (4 contracts)   | all **28** paths exist, so no `doesNotMatch` is running against an empty string                                                                                                |
| loops over walked directories                       | every one carries an explicit `length >= N` guard except `tent-source-quality:44`, which overlaps a guarded set in the same file                                               |
| `check-design-tokens.mjs` escape hatches            | `SUBFLOOR_EXCEPTIONS` is empty; all **22** DESIGN.md colour keys are mapped and compared, so "keys absent from this map are skipped" is skipping nothing                       |
| "only the pub spoke is indexable"                   | verified over HTTP against a production build: cafes/bars/takeaways each serve `<meta name="robots" content="noindex, follow">`                                                |
| robots.txt vs sitemap.xml                           | fetched both from a production build; **zero** of the 14 sitemap paths are prefix-matched by any Disallow rule. The `/merchant-terms` fix holds                                |

The eight patterns the campaign removed were re-grepped too: `border-[1.5px]` 0,
`max-w-7xl` 0, `adminSelectClasses` 0, `rounded-xl` 1 (a comment), `sm:w-[88px]`
1 (a comment), `rounded-2xl` 7 (the six known-dead primitives plus a comment),
`list-disc` 3 (the two already recorded plus `field.tsx`). `shadow-md` shows 19
and is **not** a regression: `--shadow-md` is a declared Wet Ink token
(`4px 4px 0 var(--w-shadow-color)`), not stock Tailwind elevation.

#### 1. `deadcode:check` cannot report an unused export at all

`pnpm deadcode:check` is `knip --include files,dependencies,unresolved`. The
`exports`, `types`, `nsExports` and `duplicates` rules never reach the output —
and `knip.json` sets them to `"warn"`, which would not fail anyway. Measured
today: **236 unused exports**.

This is the larger sibling of the `components/ui/**` entry-pattern blind spot
already recorded. The six dead `field.tsx` exports had two independent reasons to
survive, not one. Removing the `components/ui` entry pattern surfaces 8 more:
`AlertAction`, `badgeVariants`, `CardFooter`, `CardAction`, `EmptyMedia`,
`SheetClose`, `SheetFooter`, `TableFooter`.

Not changed here. Turning the rule on is a 236-item decision.

#### 2. A dead component kept alive by two separate mechanisms

`components/merchant/launch/launch-billing-cta.tsx` has **zero** references in
the entire repository outside its own file and one contract.

- `knip.json` lists that exact file as an `entry`. Remove the line and knip
  reports exactly one unused file — that one. The exemption exists only to hide
  it.
- `tests/contracts/launch-billing-local-stripe.test.mjs` asserts
  `export function LaunchBillingActivationBanner` **exists**, so the dead
  component is contract-pinned.

Read the test's own intent: its point is
`assert.doesNotMatch(qrPanel, /LaunchBillingActivationBanner/)`. The existence
assertion was there to prove the symbol was defined somewhere, and it now pins a
component nothing renders.

**Not fixed, deliberately** — deleting it means deleting a contract assertion.
Worth knowing before someone deletes it: its three strings ("Your account is
created.", "Proceed to billing to activate your venue and start accepting
stamps.", "Proceed to billing") are duplicated inline across `launch/page.tsx`,
`billing-panel.tsx`, `qr-panel.tsx` and `rewards-panel.tsx`
(`reports/marketing/copy-slices/inv-B-merchant.md`), so this looks like an
extraction that was never adopted rather than a component that lost its caller.

#### 3. FIXED — the list that produced the `/merchant-terms` defect is still a hand-mirror

`public-indexing-policy`'s collision test carries a literal list of 14 public
routes. What the site actually publishes is `PUBLIC_SITE_ROUTES` in
`lib/marketing/facts.ts`. Nothing forced them to agree, and they already differ:
the test carries the three noindexed persona spokes and omits `/` and the three
guide paths.

There is **no live collision** — I checked the served robots.txt against the
served sitemap.xml. But the mechanism that produced the `/merchant-terms` defect
was intact: publish a new indexed route and this test would not know about it.

Fixed additively: the test now resolves `PUBLIC_SITE_ROUTES` from facts.ts
(following `ROUTES.*` indirection) and requires its own list to cover every
published path, exactly or by an ancestor segment. The list may stay broader,
never narrower. Sabotage-checked three ways — a new literal path, a new
`ROUTES.*` path, and a renamed `ROUTES` block (which makes the resolver return
nulls) each fail it, and all three restore clean.

#### One loose assertion, currently true

`ux-production-polish:172` builds `darkBlock` as `globalsCss.slice(indexOf(".dark {"))`
— everything to end of file, not the `.dark` block — then asserts
`--w-line-strong:` appears in it. Parsed the braces: the token really is inside
`.dark` (line 239), so the assertion is honest today. Left alone; recorded so a
future reader does not mistake it for proof of scoping.

### A blocker that named a file, and an RPC that a `.limit(` grep cannot see

Two 04#6 sweeps recorded that "every hard `.limit()` in `lib/admin/*` now
paginates or admits it". Both were run with a grep for `.limit(`. The referrals
list reads a Postgres RPC, and its cap is an ARGUMENT — `p_limit: 100` — so it
matched nothing and was reported clean by two consecutive sweeps. It was the
only hard cap in the console with neither pagination nor a truncation notice.

The corollary is worth stating as a rule: an inventory grep proves an absence
only for the syntax it greps. Caps arrive as `.limit(n)`, `.range(a, b)`, an
RPC argument, a `LIMIT` inside a migration's function body, or a slice in the
component. The four in this codebase.

The second half of that finding said referrals "follows the merchants/audit
pattern exactly". It does not. Merchants and audit are PostgREST table reads
with `count: "exact"` and an `ilike` on a joined column. `admin_referral_ops`
returns no total (the count is now a separate head-only read) and filters by a
single venue **id**, so a name fragment has to be resolved first and can be
ambiguous. Same finding, same sentence, one half right.

### A control with no reachable surface stays unbuilt

04#56's rows-per-page control was open for the whole campaign behind "a size
param must thread through every admin route" — a genuine but small piece of
work (10 readers, 6 pages). What kept it un-attempted is more interesting: all
eleven admin routes are auth-gated, so there was nowhere to LOOK at the
paginator. The catalogue documented the panel, the tabs, the skeleton and the
id chip, and had a placeholder that read "Paginator sits here."

A live `AdminLookupPagination` now sits in the admin catalogue section, which
is what made a browser test of the control possible at all
(`admin-pagination-controls`, chromium + mobile-safari). Where a component is
only mounted behind auth, the catalogue is not documentation — it is the only
test surface.

### Playwright's dev server port is shared between worktrees

Every lane's `playwright.config.ts` defaults to `127.0.0.1:3146`. Two lanes
running browsers at once fight over that port: the second run either refuses to
start or, worse, attaches to the FIRST lane's dev server and tests the wrong
worktree. One run in this lane reported 8 failures that way and passed
immediately on a private port. Set `PLAYWRIGHT_BASE_URL=http://127.0.0.1:<port>`
per worktree before reading anything into a browser failure.

### Two claims of mine the lanes disproved, and one gate gap they found

The parallel lanes were briefed to re-test recorded blockers. Three of the things
they disproved were mine, published in this document or NEEDS-SIGNOFF.

1. **"An OS-dark user gets `.dark` applied" (05#61) was wrong.** I escalated it as
   a live High defect. Measured in Chromium at `colorScheme=dark` against a
   production build with `enableSystem: true`, `html` stays `light`: next-themes
   only consults `prefers-color-scheme` when the stored or default theme is the
   literal string `"system"`, and `defaultTheme` is `"light"`. Verified here too —
   nothing in the tree calls `setTheme("system")` (`sonner.tsx` only defaults a
   destructure). The finding's own wording, "one config flag away", was accurate;
   my paraphrase of it was not. 05#61 shipped as defence-in-depth.

2. **"SERVER_RENDER and APP_RENDER need live credentials" was wrong.** They are
   bundler outputs — webpack-minified, `react-dom/server`, and dev/SWC — all
   reachable on `/login` with no auth. That mistake is why I refused 05#61 twice.

3. **`pnpm deadcode:check` cannot report an unused export.** It runs
   `knip --include files,dependencies,unresolved`, so the exports rule never
   reaches the output; `knip.json` also sets it to `warn`. Enabling it surfaces
   78 unused exports by a conservative count. This is the larger sibling of the
   `components/ui/**` entry-pattern blind spot already recorded above: 05#27's six
   dead exports had TWO independent reasons to survive a green gate.

And a gap in my own tally gate: it validated the COVERAGE and HANDOFF tables but
not STATUS.md's per-report heading, which had drifted to "61 done / 3 partial /
1 stale / 1 deferred / 1 open" when no 05 row has ever carried `[stale]` or
`[defer]`. The gate now checks that heading too, sabotage-verified against the
exact historical wording.

The pattern is the one this campaign keeps rediscovering: a number a reader sees
is a number worth checking, and the checker needs checking as much as the thing.

### A "regression" that was the machine, caught by running the control

After the `enableSystem` change, `pnpm test:a11y` failed 187 of 270, and a
chromium-only re-run failed 18 of 67. Every single failure was
`net::ERR_CONNECTION_REFUSED` / `ERR_EMPTY_RESPONSE` — the dev server dying
mid-run — and **zero** were axe violations. The tempting call was "flake, other
lanes are running, load average is 10".

Checked instead of assumed: `git checkout 62f95803` (the branch base), same
slice, same machine — **57 passed, 0 net errors**. That reads as a regression,
and I nearly wrote it up as one.

Then ran the branch again, immediately after, on a quieter machine — **57
passed, 0 net errors, 6.7m**, matching the base's 6.8m exactly. So it was load
after all, and a single control run is not a control.

Two lessons, in tension and both real: a red matrix is worth a control run
before it is called a flake, and a control run is worth repeating before it is
called a regression. The cheap tiebreaker was the timing — 2.0m to death versus
6.7-6.8m to completion on both branches.

The direct check on what actually changed is stronger than either:
`/`, `/login`, `/signup`, `/reset-password`, `/pricing`, `/start`, `/scan` and
`/faq` were loaded in Chromium against `next start` AND `next dev`, listening for
console CSP reports. **Zero CSP violations on both servers, and every page
carries `class="light"`** — so the re-pinned hashes really do admit the script
each bundler emits, which is the only thing this change could have broken.

### The blocker I dismissed by reading the wrong file

03#46's blocker read: "merchant-onboarding-continuity requires the first invalid
field to be focused after a failed submit; the blur-validation restructure breaks
it." I opened `tests/contracts/merchant-onboarding-continuity.test.mjs`, found no
focus assertion, called the blocker a misread, and shipped blur validation.

The focus assertion lives in
`tests/e2e/merchant-onboarding-continuity-flow.ts` — **same name, different
file**. The blocker was right.

What it cost: `blur` fires on mousedown, so writing state there re-renders
between mousedown and mouseup and the click never becomes a submit. Instrumented
with a capture-phase listener: zero submit events across two clicks. A merchant
with an empty required field focused pressed "Finish setup" and nothing happened.
That shipped for roughly thirty turns behind a green `quality:check`, because
contract tests are static-source reads and this is a runtime interaction.

Three things generalise:

1. **A test name is not a file.** This repo pairs `tests/contracts/<name>` with
   `tests/e2e/<name>-flow.ts` in several places. Checking one and concluding
   about "the contract" is a category error.
2. **A green gate bounded by what it can see.** `quality:check` never runs a
   browser. Everything this campaign learned about targeted browser probes
   applies most to changes in EVENT ORDERING, which no static assertion reaches.
3. **The lane reported it as "pre-existing, not a regression" and was right about
   its base and wrong about the cause.** Pre-existing relative to a branch point
   only means someone earlier introduced it. Here that was me, four days of
   commits back.

### Full journey matrix, re-run for the merged branch state (admin lane)

Run on a private port (`PLAYWRIGHT_BASE_URL=http://127.0.0.1:3246`) after two
runs were destroyed by cross-worktree contention — see the port note above.

| project       | passed | failed | skipped | wall  |
| ------------- | -----: | -----: | ------: | ----- |
| chromium      |    203 |      3 |      49 | 39.6m |
| mobile-safari |    231 |      6 |      66 | 51.1m |

Every one of the nine failures was re-run in isolation, and every one of them
passed. Classification:

| spec                           | project | in isolation | class                                    |
| ------------------------------ | ------- | ------------ | ---------------------------------------- |
| analytics-funnel-privacy       | both    | passes       | known saturated-pool flake               |
| merchant-auth-recovery-flow    | chr     | passes       | known saturated-pool flake               |
| merchant-onboarding-continuity | chr     | **fails**    | pre-existing — fails on 62f95803 too     |
| auth-confirm-safety            | mob     | passes       | saturation                               |
| merchant-birthday-config       | mob     | passes       | saturation (base fails a DIFFERENT test) |
| merchant-signup-verify         | mob     | passes 3/3   | saturation (base passes)                 |
| offer-campaign step 1a + 1b    | mob     | passes       | saturation                               |

Two of these deserve their own line rather than a category:

- **merchant-onboarding-continuity** ("required-field failures … refocus on
  every attempt") is NOT on the known-flake list and does NOT pass alone. It
  fails identically on the base commit `62f95803` with `toBeFocused()` →
  `inactive` on `input[name="businessName"]`. Pre-existing on this machine, not
  a regression from any lane's work — but it is a real red test that the
  three-name flake list does not cover.
- **merchant-birthday-config** and **analytics-funnel-privacy** each failed a
  _different_ test on the base commit than on the branch. A spec that fails a
  different assertion each run under load is a flaky spec, not a flaky
  assertion, which is why re-running the exact failed test is not sufficient
  evidence on its own.

The two new `admin-pagination-controls` tests ran inside both matrices
(chromium 63-64/255, mobile-safari 66-67/303) and passed in both.

### The wrong-file risk, swept

After 03#46 shipped a broken submit because I read `tests/contracts/<name>` when
the assertion lived in `tests/e2e/<name>-flow.ts`, I enumerated every name that
exists as BOTH:

    analytics-funnel-privacy            merchant-account-compat-routes
    customer-abandoned-identity-retention  merchant-activation-ledger
    customer-join-observability         merchant-launch-follow-through
    customer-stamp-choreography         merchant-onboarding-continuity

Eight names, and only two findings cite one in their notes: 03#46 (the defect)
and 03#61.

03#61 checked out. Its claim is about `Button`'s tap-floor variants; the e2e
`merchant-launch-follow-through-flow.ts` contains no `min-h-11` or
`pointer:coarse` assertion at all, and the spec passes 15/15 on chromium. So the
contract really was the only relevant file there.

One defect, not a pattern — but the sweep was worth the ten minutes, because the
cost of the one was a form button that silently did nothing.

### Sticky is bound by its containing block, not the scrollport

I nearly shipped a sticky filter bar that did nothing.

Probe one: add `position:sticky` to a direct child of `section.surface-card`,
scroll, watch `top` go 179 -> 0. Stuck. Ship it.

Except production nests the lookup controls inside `AdminPanelHeader`, and a
sticky element is bound by its **containing block**. That header is 174px tall.
Re-running the same probe against the real shape — short header, long list as a
sibling — the bar scrolled to **-1225px**.

The probe was right about the mechanism and wrong about the page, because I had
tested a DOM I invented rather than the DOM that ships. It would have passed
review: a `sticky top-0 z-20` in the diff reads as working.

The fix was to hoist the controls out of the header to be a direct child of the
panel — the element that is actually tall — then re-probe in that exact shape
(297 -> 0 at scrollY 1500, still 0 at 2800).

Adds a fifth entry to the sabotage list: **a probe that models the wrong DOM
position is as useless as a test that cannot fail.** Model the shipped tree, or
measure on the shipped page.

### One defect the audit never found, and where it came from

`/dev/design-system` listed `rounded-lg` twice and omitted `rounded-sm`, so the
page whose job is to document the radius scale was hiding a step of it, and
React logged a duplicate-key warning on every render (the class name is the key).

No finding in any of the five sub-audits mentions it. I did not find it by
looking either — it was in the dev server output of an admin e2e run I was doing
for an unrelated reason.

Worth noting as a method point: **the server log during a test run is free
evidence, and I had been discarding it for 290 commits.** Every `tail -3` on a
Playwright run threw away the lines above it. The one time I read them, there was
a real defect sitting in plain sight.

### The whole-surface console sweep, and its yield

Swept every reachable route (55: all public marketing, auth, legal, guides, and
every `/dev` harness), capturing console errors, page errors and HTTP status.

Yield: **one real defect** — the duplicate radius key — plus a useful negative.
Forty-three routes reported "noise" that was entirely dev-mode font-preload
warnings, and seven reported navigation timeouts that were entirely first-visit
compilation. Re-tested with `domcontentloaded`, all seven returned HTTP 200 with
the right `h1` and a clean console.

That ratio is the point. Raw console output is 98% noise, which is presumably
why it was ignored for 290 commits — but the 2% contained a defect no audit
finding, lint rule or contract test had caught. The fix is not "read every
warning", it is `tests/e2e/console-hygiene.desktop.spec.ts`: filter the known
noise once, then fail on anything else.

### The link graph sees what per-page review cannot

Crawled every internal `<a href>` on every public route, then requested each
target. Result: 25 distinct links, zero broken, one correct 307. By status code,
a clean bill of health.

The graph said otherwise. `/loyalty-for-cafes`, `/loyalty-for-bars` and
`/loyalty-for-takeaways` had **zero inbound links** from anywhere on the site.
Three complete, indexed, well-written pages that nothing pointed at. Each carried
a `navLabel` no component rendered — a nav specified and never built.

No finding in 347 mentions it, and none could: every one of those pages reviews
fine in isolation. The defect exists only in the edges between pages, and nobody
audits edges.

The second lesson came from fixing it wrong. I first linked the three spokes to
each other, re-crawled, and found a **closed loop** — all three now had inbound
links, all three were still unreachable from the site. "Has an inbound link" is
not "is reachable". The fix needed an edge from `/loyalty-for-pubs`, the page
that is itself linked from `/`.

Both facts came from re-running the same crawl. Cheap sweep, kept, run twice.

**Then I reverted the whole fix.** The pages carry `robots: { index: false }`,
set deliberately, with the reason in a comment: they are unsupported spokes
awaiting a 301/consolidate/retain decision. Absent from the sitemap is CORRECT
for a noindex page, and linking them from the hub promoted pages someone had
chosen to de-emphasise. The finding was real; the diagnosis was wrong.

What exposed it: sabotage-testing the reachability guard I was building. The
sabotage **failed to fail**, and chasing why led to the sitemap having 14 entries
that never included these three, which led to the `index: false`. A guard that
cannot fail is not just useless — here, the reason it could not fail WAS the
answer.

Recorded as NEEDS-SIGNOFF 31. A link crawl can prove a page is unreachable. It
cannot tell you whether that was on purpose.

### Re-verifying the 18 "stale" findings after the merges

"Stale" means the audit describes code that no longer exists. That is a claim
with a shelf life, and this branch has since merged `origin/main` plus five
lanes — so I re-ran every mechanical check rather than trusting the notes.

All four swept patterns still hold: `border-[1.5px]`, `max-w-7xl` and
`adminSelectClasses` have zero matches, and the only `rounded-xl` in the tree is
inside the globals.css comment explaining why the token was removed.

Behavioural claims re-checked in source: `StatusPill` tones, `maskAdminContact`
on both referral parties, `data-[nowrap=true]` on `TableCell`, `!tabMode` gating,
`ProductMoment`'s `sm:grid-cols-2 md:grid-cols-3`, and both destructive-action
gates (Regenerate QR and Turn-off-two-factor each have `variant="destructive"`
plus an `AdminConfirmCheck`).

Two of my own greps returned false negatives on the way, both from over-narrow
patterns — requiring "two-factor" and "destructive" on the SAME line, and
`awk`-slicing a function body that ran past my line window. Neither was a code
defect. That is now three turns running where the measurement was wrong and the
code was fine, which is its own signal: **when a check disagrees with a recorded
note, suspect the check first.**

One near-miss worth keeping: `TableHead` still hard-codes `whitespace-nowrap`
while `TableCell` is opt-in. That looks like the "true of one half" pattern, but
04#59 names `TableCell` and DataTable's cell override specifically, and short
column labels are meant to stay on one line. Correctly closed.

### Dev-server metrics are not evidence

Section 7 of NEEDS-SIGNOFF asked the owner to renegotiate a contract assertion,
on the strength of a measured CLS 0.1924. I had measured it with Playwright
against `pnpm dev`.

The identical probe against a production build: **0.0000**. Lighthouse on the
built artefact: 0.0517 / 0.0517 / 0.0000, then 0.0000 x3 after the font
subsetting. Threshold is 0.100.

In dev, CSS and fonts inject asynchronously and hydration is much slower, so the
collapse lands after paint. In the shipped artefact it does not. Every
performance number in this campaign that came from a dev server should be read
with that in mind — LCP numbers were taken from production builds throughout,
but this CLS was not, and it was the one that nearly cost a contract.

The confirming detail is the better story. The contract pins the _expression_
`hydrated && !open ? "hidden lg:block" : "grid"`, not the initial value of
`open`. Setting `useState(true)` makes that expression evaluate to "grid" both
before and after hydration — pinned literal untouched, stated intent better
served. A clean way through a blocker that had stood for the whole campaign.

It changed CLS by **zero, to sixteen decimal places**. Same number, twice.

Because the collapsing list sits at top 1295px on a 390x844 viewport, below the
fold, moving no visible content. The clever fix fixed nothing, and the only
reason I know that is that I measured after shipping it instead of reasoning
that it must have worked. Reverted.

**Two rules.** Measure the artefact you ship, not the one you develop against.
And when a fix is elegant, that is exactly when to check it changed the number.

### A tap-target sweep that measures the wrong pointer finds nothing

Playwright's default chromium context reports `pointer: fine` even when you set
a 390x844 viewport. This codebase puts its touch floors behind
`[@media(pointer:coarse)]:min-h-11`, so a naive mobile-width sweep reports every
`Button size="sm"` in the product as 36px and every one of those reports is
false. My first sweep "found" the header CTA at 36px; under
`devices["Pixel 5"]` it measures 44px.

**Viewport width is not touch.** Use a device profile, and assert
`matchMedia("(pointer: coarse)").matches` inside the probe so the sweep fails
loudly rather than quietly measuring the wrong thing.

With that fixed, 55 routes yielded three candidates and only two defects: the pub
spine's phone-only toggle (39px) and the password reveal (`size-10`). The third
— 36px footer links — is a documented decision with the reasoning in the file
(05#47: WCAG 2.5.8's floor is 24px; 13 links at 44px costs ~572px of footer on
every page).

That is now the second time this session a "defect" turned out to be a decision
recorded in a comment near the code (the other: `robots: index:false` on the
venue spokes). Both times the comment was one scroll away from where I was
already reading. **Read the file, not just the line.**

### What the corrected sweep actually found

Public routes: two defects (pub spine toggle 39px, password reveal 40x40), one
documented decision left alone (36px footer links).

`/dev` harnesses — the only view of the auth-gated app, merchant and customer
surfaces — four more, all in shared components: two standalone navigation links
at **20px** (merchant "Edit venue details", the customer's back-to-cards link),
`NextActionRow` on the console home at 40px, and the merchant `Disclosure`
summary at 40px.

Six real defects across 85 routes, none of them in the 347 findings, all found by
one probe that took an afternoon and two attempts to write correctly.

The three survivors were each checked rather than counted: a 20x20 checkbox whose
`<label>` is a clickable 66x333, the brand logo mark, and the design-system
catalogue's own specimens of small controls. **A sweep is only as good as its
false-positive triage** — the first version of this one reported 23 routes of
defects and every single one was wrong.

### A control that cannot fail is not a control

The 320px overflow on the pub hub is the sharpest example in this campaign of a
measurement lying in both directions.

1. Dev server said the page clipped content at 320px. I had a screenshot of text
   cut mid-word.
2. I fixed it, then ran a production "control" with the fix stashed. It reported
   **zero** elements past the viewport. So I reverted the fix as unnecessary.
3. Then I looked at the control screenshot. **The page had rendered with no CSS
   at all** — default serif, blue links, no layout. An unstyled page cannot
   overflow. The control was measuring nothing.
4. Re-run with `document.styleSheets.length > 0` asserted before counting: 65
   elements past the viewport, in production, with the fix reverted. The defect
   was real the whole time.

I nearly discarded a real fix because a broken control agreed with the
conclusion I had just reached for a different reason (the CLS finding, where dev
genuinely did overstate the problem). **Two measurements disagreeing is a reason
to distrust both, not to pick the one that matches the last lesson learned.**

Every probe in this campaign now asserts its own preconditions — stylesheets
loaded for layout, `pointer: coarse` for tap targets, a production build for
Core Web Vitals. The precondition is the part that fails silently.

Also worth recording: I guessed the cause twice (min-w-0 on the list, then on
the flex title) and rebuilt each time, ~2 minutes a go. Walking the ancestor
chain took one probe and showed the answer on one line — parent 272px, list
305px. **Measure the chain before editing the leaf.**

### Sabotage found that half my fix was decoration

After shipping `min-w-0` in two components for the 320px overflow, I sabotaged
each half separately against production builds.

Removing it from `GuideSection` changed nothing — still passing. All the guide
bands share **one grid column track**, so the single overflowing item (the
HubHandoff guide list) was widening that track and dragging all eight sibling
sections to 305px. Fix the one item, and all 65 elements come back inside the
viewport.

I had "fixed" the symptom on eight bands when the cause was in one, and only
found out because I tried to break each half on purpose. Reverted.

The same pass killed the guard I wrote for it. Sabotage the fix, run the e2e
spec against a freshly started dev server: **passes**. Twice. `next dev
--webpack` — what the Playwright harness runs — does not reproduce this defect,
so an e2e guard here can never fail. It moved to
`scripts/check-small-screen.mjs`, which runs against a built artefact and is
verified in both directions (exit 0 with the fix, exit 1 naming 65 elements
without it).

**Three lessons converge here.** Sabotage each half of a fix separately, not the
fix as a whole. A guard has to run in the environment where the defect exists.
And when a defect is invisible in dev, every dev-based check you own is already
lying to you about it.

### Testing whether "dev hides defects" generalises — it does not

The 320px overflow was invisible in dev, which raised a worrying question: the
console-hygiene and touch-target guards both run against `next dev`, so what
else were they missing?

Re-ran both against a production build. **Console: clean. Touch targets: clean.**
The gap is specific to that one layout defect, not a systematic blindness.

The production tap run did flag two links at 43.12px, and the chase was
instructive. `MARKETING_TEXT_LINK` already has `min-h-11`; root font-size was
16px; `visualViewport.scale` was 1. The cause was an ancestor resting at
`transform: matrix(0.98, 0, 0, 0.98, 0, 12)` — a scroll-reveal that had not
fired because the element sat below the fold. Scrolled into view: exactly 44px.

**A geometry probe that ignores reveal animations under-measures every target in
an unrevealed section by 2%** — enough to turn 44 into 43 and manufacture a
defect. The shipped guard was already safe because the config forces
`reducedMotion: reduce`; the ad-hoc script I wrote to double-check it was not.
That is the third distinct precondition this campaign has had to pin: stylesheets
for layout, coarse pointer for tap targets, reduced motion for geometry.

One more thing surfaced: sabotaging `profile-panel.tsx` alone left the guard
passing, which briefly looked like the guard was broken. It was not —
`app/dev/app-harness/account/page.tsx` **duplicates** that markup rather than
importing the component, so the harness renders its own copy. A harness-based
guard proves things about the harness, and harnesses drift.

### Two ways I was checking gates wrong

Both surfaced in one turn, and both had already let a defect through.

**`rc` from a piped shell command is the last command's exit code.** I had been
reading `rc` from things like `pnpm quality:check 2>&1 | tail -25` and seeing
`rc: 0` — that is `tail` succeeding. The gate underneath had failed. Now every
gate check ends with an explicit `echo EXIT=$?` on the command itself.

**Grepping a gate's output for the failures you expect cannot see the ones you
do not.** I filtered `quality:check` for `^# fail` and `tally in sync`, which
matches the test summary and the tally script — and is structurally blind to a
lint or typecheck failure, because those print neither. That is how I shipped a
TypeScript error in `tests/e2e/touch-targets.desktop.spec.ts` and did not notice
for two commits.

The error itself is worth keeping too: I added
`test.use({ reducedMotion: "reduce" })` and wrote a commit message about pinning
the precondition. `playwright.config.ts` documents in a comment that
`contextOptions.reducedMotion` wins over the test option, so it was a **silent
no-op** as well as a type error. The repo had already written down the trap I
walked into.

### Harnesses that copy instead of import

Six `/dev` harnesses duplicate markup from production components, because those
components are async server components the harness cannot render. The account
one had already cost two wrong conclusions.

Fixed the way the repo already fixes it elsewhere (`billing-panel-view.tsx`):
extract a pure `ProfilePanelView` that both the route and the harness render.
Sabotaging the single source now fails the guard, where the same edit used to
pass because the harness kept its own copy.

The other five remain, and they bound what harness-based verification proves:

    app-harness/dashboard   <- app/app/page.tsx
    app-harness/launch      <- components/marketing/landing/final-cta.tsx
    app-harness/offers      <- components/marketing/pubs/guide-section.tsx
    app-harness/onboarding  <- app/app/onboarding/page.tsx
    app-harness/reward-scan <- app/app/rewards/scan/[scanToken]/page.tsx

### Auditing the gates themselves

Having found that I was CHECKING gates wrong, I ran every gate the repo owns
that `quality:check` does not — `tokens:check`, `claims:check`, `jsonld:check`,
`bundle:check`, `env:check` — with explicit exit codes.

All five passed. One was lying.

`bundle:check` printed "Bundle budget passed: root first-load JS 540731 bytes,
**0 app entries checked**". Zero. It looked for an `"entryJSFiles"` object that
Next no longer emits, found null in all 150 route manifests, and iterated the
per-route budget over an empty map. `maxRouteFirstLoadJsBytes` had never been
enforced on this Next version — in CI, and recorded as PASS in the QA
certification matrix.

The per-route data was one level down, in `clientModules[].chunks`. 113 routes
now check, largest ~532KB against a 900KB budget.

The more useful fix is `assertRoutesParsed`: manifests present but nothing
parsed is now a hard failure. **The defect was never the stale key — it was that
a budget could measure nothing and still print PASS.** Every guard this campaign
has added now has that property; this one was missing it.

One trap avoided on the way out. My first fix folded the "/" route's chunks into
"root first-load JS", which moved a tracked metric from 540,731 to 900,075
bytes against a 950,000 budget. That would have looked like a near-breach caused
by this branch, when nothing about the bundle changed — only the ruler. **When
you repair a broken measurement, keep the working part of it defined exactly as
it was.**

### The vacuity audit, in full

After `bundle:check`, I instrumented every gate that could plausibly be
measuring nothing:

| gate                    | what it actually covers                       |
| ----------------------- | --------------------------------------------- |
| `tokens:check` contrast | 18 pairs evaluated, 0 skipped (9 x 2 themes)  |
| `claims:check`          | 91 marketing files, 931 rendered-source files |
| `duplicates:check`      | 803 files, 46 clones at 0.81%                 |
| `debt:check`            | 1,757 source files                            |
| `deadexports:check`     | 233 baselined, sabotage-verified              |
| `ui-audit:check`        | 347 findings, sabotage-verified               |
| `bundle:check`          | **0 of 150 routes** — the one liar, now fixed |

One near-miss worth the effort: the contrast check `continue`s past any token
that does not resolve to a hex. Correct today. But if the palette ever moved to
`oklch()`, every pair would skip and it would still print "✓ contrast floors
held" — the exact shape of the bundle bug. It now counts evaluations and fails
at zero, naming the cause.

**The generalisable form: any check that filters its input needs to assert the
filter did not eat everything.** `bundle:check` filtered on a manifest key that
no longer existed. The contrast check filters on hex-resolvability. A tap-target
sweep filters on `pointer: coarse`. A layout probe filters on stylesheets being
loaded. Each one passes loudly and vacuously when its filter matches nothing,
and only the assertion tells you.

### Turning the vacuity lens on the contracts themselves

The contract suite is the authority this campaign defers to — `tests/contracts/*`
outrank audit opinion, and I have declined or blocked findings citing them
(01#9, 03#47, 02#53). So it matters whether those assertions can fail.

Scanned all 116 contract files for the `bundle:check` shape: a loop asserting
over a collection that could be empty. Five candidates. **The repo had already
guarded four of them:**

    admin-member-lookup    assert.ok(windows.length >= 8), metas >= 8
    print-brand-lockup     assert.equal(catalogues.length, 4)
    offer-pass-redemption  asserts banner content before splitting it

The fifth, `offer-campaign-ui`, filtered `OFFER_SURFACE_FILES` down to
`components/` paths and looped with no length check. If that surface ever moved,
five `@/lib/supabase/server` assertions would stop running silently. Guarded, and
sabotage-verified — `startsWith("zzz/")` now yields "found 0" and a failure.

Two things worth keeping from this:

**Adding a non-emptiness assertion is not weakening a contract.** The standing
rule is never to weaken or delete an assertion; this only ever makes the test
harder to pass, so it is safe under that rule.

**Four of five already guarded means this trap is known here.** The contracts
were largely written by someone who had met it. My contribution was one missing
case, not a systemic finding — which is the honest size of it.

### Re-checking the declines, and finding the verification boundary

Several findings were declined on measurements (01#22, 01#30, 02#10, 02#30,
05#65). After proving three separate measurement methods wrong this session, the
declines deserved re-checking against a production build.

**01#22 reproduces exactly.** `/how-it-works` measures 6,211px in production
against the 6,211px recorded, and the `#launch` list within 2% (1,079 vs 1,101).
The decline's arithmetic — collapsing steps 2-5 saves 11.7% of the page — holds.

That is a useful negative: dev and production agree on **static layout heights**.
Where they disagreed was hydration timing (01#49's CLS: 0.207 dev, 0.000 prod)
and CSS containment (the 320px overflow: 65 elements prod, invisible in dev).
The lesson is narrower than "dev lies" — it is that dev lies about _timing_ and
_cascade_, not about how tall a box is.

**02#10 could not be re-checked at all**, and that is the more important finding.
`/dev/home-harness/home` returns **HTTP 404** in a production build:
`app/dev/layout.tsx` calls `notFound()` when `NODE_ENV === "production"`, and 35
harness files repeat the guard. Correct behaviour — harnesses must not be public
— but it means the customer, merchant and admin surfaces are _unmeasurable_ in a
built artefact without live credentials.

So the campaign's numbers split cleanly:

    marketing / auth / legal / guides   production-verified
    customer / merchant / admin         dev-server only, forever, without a
                                        seeded staging deploy

Recorded as NEEDS-SIGNOFF 32 so nobody later cites a dev measurement as if it
were production-grade. I have done that once already this session and it cost
two reverts.

### Re-testing my own deferrals, after one of them turned out to be wrong

The Cmd-K palette (04#6) was deferred as "higher risk than value — no command
primitive exists and it can only be verified in a dev harness". Both halves were
true and the conclusion was still wrong: the routes already existed as data
(`adminNavItems`), radix Dialog was already a dependency, and a harness is
exactly how the rest of that surface was verified. It took one session to build
and is sabotage-checked.

So I re-tested the other deferrals in the same shape — "the thing needed does
not exist".

**03#64 manual code entry — blocker HOLDS.** The reward scan payload is a uuid
minted with a 10-minute TTL and rendered only as `/reward/{id}/qr.png`. There is
no human-typeable code, and minting a short one is a data-model and security
change, not a UI one. Different in kind from "no primitive exists".

**03#64 camera picker — reason REPLACED, still declined.** The recorded reason
was that a mocked enumeration proves the control renders, not that switching
works. That is a verification-quality objection, which after the palette I no
longer accept as sufficient. The real reason is better: both scanners already
start with `{ facingMode: "environment" }`, so a phone — the only device that
scans in a venue — gets the rear camera without a picker. A picker would serve
multi-lens phones and multi-webcam desktops, neither of which is the scanning
device.

**The distinction worth keeping.** "I cannot fully verify it" is not a reason to
decline; the palette proved that. "The device this ships to already does the
right thing" is. One is about my tooling, the other is about the user.

### Costing the decisions instead of just naming them

The remaining findings are mostly decisions, and a decision without a number is
just a question. Three were left that way, and each is now costed:

    02#64  claim CTA sits at 1,077px — 1.62 screens — on an iPhone SE.
           The audit said ~760px. It understated the problem by 42%.
    01#20  adopting the canonical pricing sheet on `/` costs +262px at 375px
           and +48px at 1280px, takeover isolated so it is like-for-like.
    02#50  needs no contract change at all — the assertion stops at the
           component name and constrains nothing inside it.

Two of those needed a harness that did not exist, because the surface is
auth-gated or token-gated. Building one is not a workaround; it is the only way
the number can ever be checked again after the decision is made.

**The measurement failures are the part worth keeping.** Costing 01#20 took four
attempts, and the first three were all the same error: a text heuristic that
matched an ancestor. "Innermost element containing 'Growth Plan'" reported 332px
for a sheet that is 1,653px. "Section containing 'takeover'" reported 2,206px for
a 257px aside. Both looked plausible standing alone, and both would have gone
into a decision document as fact.

What fixed it was anchoring on `data-takeover-enquiry` — a marker the component
ships deliberately — rather than on words the copy happens to contain. Same
lesson as `#pricing` for the landing band, and the same lesson as every other
measurement failure recorded above: **anchor on what the code guarantees, not on
what the page says.**

## Marketing-lane re-test pass (report 01, 14 findings)

Fourteen findings recorded as partial, stale or open were re-tested against a
production build rather than against their notes: `pnpm build && PORT=3201 pnpm
start`, `PLAYWRIGHT_BASE_URL=http://127.0.0.1:3201` so no sibling lane's server
could answer, every probe asserting `document.styleSheets.length > 0` before
measuring and anchoring on ids and `data-` hooks (`#how`, `#proof`, `#start`,
`#pricing`, `#launch`, `#problem`, `#capacity`, `[data-growth-plan-pricing]`,
`[data-takeover-enquiry]`, `[data-legal-document] aside`) rather than on text.

### Three recorded blockers were wrong, in three different ways

**01#11 — "already `sm:grid-cols-2 md:grid-cols-3`, the audit describes an older
revision."** True of one half, applied to the whole. The audit's complaint
("single column until 1024px") really was stale, so the note stopped there and
never looked at 640-767px, where the band was still two columns. `sm:grid-cols-3`
takes it from 764px to 655/569/545px at 640/700/767. The rest of the
recommendation — three across at the BASE breakpoint — is genuinely wrong, and
now for a checkable reason: it shrinks the venue QR from 148px to **60px** at 375. A finding can be simultaneously stale, correct and under-actioned.

**01#38 — "the claims-boundary contract requires guarantee-stack.tsx to render
CLAIMS_BOUNDARY, and the catch box is how it does."** Names a file. The behaviour
is a better answer and it disproves the finding outright: the finding claims the
catch box and the `ScarcityBand` H2 are "the same sentence twice in one scroll".
They are different sentences from different constants — `CLAIMS_BOUNDARY.never`
and `SCARCITY.capLine` — and `guarantee-stack.tsx` does not import `SCARCITY` at
all. Counted in rendered text at 390x844: each string appears **exactly once**
on `/`, `/pricing`, `/how-it-works` and `/about`, and the cap line zero times on
`/loyalty-for-pubs`. Then the contract holds too, and for a stronger reason than
the note gave: `marketing-offer-source` enforces a RULE with an exact-equality
offender list, so deleting the box adds a third offender and fails a `deepEqual`,
not just a `match`.

**01#10 — "the same contract test requires `<FinalCta` on the landing."** True,
and still true. But the finding's own evidence had rotted underneath it:
`final-cta.tsx` renders neither `PLAN_LINE` nor `OFFER.riskFraming` any more, and
`GuaranteeStack` — the component the audit says `riskFraming` duplicated — is on
the landing's deny list in that same contract. A blocker can be correct and still
be the wrong reason to stop reading.

### A comment that measured false

`legal-document-page.tsx` explained 01#63's non-fix by saying the collapsible TOC
summary "costs a row instead of a block wherever it sits". It ships `open`. The
three routes that use that component measure 568/580/664px of aside at 390px —
the same block as `/terms` (539px) and `/privacy` (647px), which have no
disclosure at all. The mitigation described in the source did not exist in the
artefact. Contracts read source text; so do humans, and a comment is not a
measurement either.

### Where the audit was right, and where measuring said no

`grid` proposals in this report were priced in pixels and never in measure. Both
of 01#9's grids save height by destroying line length: two columns at 375px takes
the ProofLine fact from a 327px column at 24-37 characters per line to a 156px
column at **12-19**; four columns at 640px gives **11-16**. Zero elements went
past the viewport in any variant, so an overflow check would have passed all of
them. **A layout probe that only asks "does it fit" cannot see the cost of
making it fit.**

### Reproduced rather than re-derived

01#22's numbers came back identical on a fresh build — `/how-it-works` 6,211px,
`#launch` 1,372px, the `<ol>` 1,101px — which is what makes them trustworthy to
decide against. 01#20's reproduced in direction and magnitude but not to the
pixel (+234px at 375 this pass against +262px last, +30px at 1280 against +48px),
because the band wraps a date-bound campaign. Worth saying out loud: a number
from a `revalidate = 300` surface is a measurement with a shelf life.

## The customer lane's re-test of its own blockers (`lane/customer`)

Ten customer findings were handed back as partial, stale or open with a recorded
reason. Three of those reasons were wrong, all three in the same way: a real
assertion cited for a change it does not reach.

- **02#5** was `[stale]` because "both shells already use `max-w-customer`".
  True — of the width. `CUS-P2-12/16` asserts exactly two things per file: that
  `max-w-customer` appears, and that `max-w-[410px]` does not. The finding is
  about the vertical rhythm and the height unit, neither of which it touches. At
  HEAD the three cited lines carried three different top paddings and two
  different height units.
- **02#62** was `[stale]` because `CUS-P2-11` "pins the copy" to
  `components/customer/customer-qr-scanner.tsx`. It does — the copy. It says
  nothing about the exit pair, which is the half the finding is about and the
  half that had already drifted twice.
- **02#43**'s last clause was declined as an open product question ("what to
  filter by"). `lib/customer/activity-core.ts` has classified every event into
  `join | stamp | reward` since it was written.

The five that held — 02#10 02#20 02#30 02#53 02#60 — held for reasons worth
recording, because two of them nearly did not:

- **02#20**'s blocker had only ever been checked against the ONE panel a test
  names. Re-grepping `tests/e2e` for the other four rails found none of them
  asserted anywhere, so what keeps them expanded is a product classification,
  not a test. That is a weaker blocker than the note implied, and it is now
  written down as one.
- **02#30**'s recorded stub floor cited `"REDEEMED"` as the longest stub word.
  `STUB_WORD.redeemed` is `"Done"`. The number was re-taken against the words
  that actually render: `"Unlocked"` measures 53.77px inside a 56px content box,
  so the conclusion survived a citation that did not.
- **02#53**'s six-cell half is genuinely contract-banned, but the finding's
  sharper complaint — auto-submit on the final digit — is not, and had never
  been tested. It fails for a different reason: the server accepts
  `/^\d{4,8}$/`, no call site passes a configured length, and there is a
  four-digit local bypass beside Twilio's six, so there is no length to submit
  on. A decline that names the right obstacle is worth more than one that
  inherits the wrong one.

Two measurement notes from this lane:

- **`document.styleSheets.length > 0` is not enough.** A production build served
  `/home/login` as `app/error.tsx` — a fully styled error page with three
  stylesheets — after a transient Supabase failure. What caught it was anchoring
  on `main#main`, which that page does not render. The anchor has to be
  something the surface under test guarantees; a "the page loaded" check will
  agree with a page that did not.
- **`/dev` harnesses cannot be measured in a production build** (the layout
  returns `notFound`), so harness numbers here are dev-server numbers, taken
  with `next dev --webpack` — Turbopack refuses this worktree because
  `node_modules` is a symlink out of the project root. Shell padding and the
  `/scan` numbers, which are geometry claims, were taken against
  `pnpm build && PORT=3202 pnpm start`.

### The admin lane, re-tested against its own notes

Thirteen findings were handed to this lane with the same instruction the branch
has learned the hard way: **test the note, do not trust it.** Nine were recorded
`[stale]`, two `[~]`, two open. Four of the thirteen notes were wrong, and each
was wrong in one of the four ways already catalogued above.

**04#39 asserted a fact about the tree.** "QrFrame takes a matrix, not an
`<img>`, so it does not apply." `components/loyalty/qr-frame.tsx:5-13` takes
`children: ReactNode`; `components/marketing/landing/venue-qr.tsx:45` composes
an `<svg>` in it. The radius half of the finding HAD been fixed — by restating
the frame's class string on the image, which is a hand-rolled copy of the
system's one QR treatment and therefore the exact drift the finding is about.

**04#19 was true of one half and applied to the whole.** Regenerate really was
destructive-with-a-gate. Disable was a third silhouette with no gate at all,
while stopping every scan in a venue is the action a customer at the counter
feels immediately.

**04#60 carried another finding's blocker.** "Sorting and the sticky header" was
declined as one job because the sticky header is blocked (NEEDS-SIGNOFF 12).
Sorting is not blocked by anything; it shipped as an opt-in column flag, so the
five panels that do not use it are byte-identical and the "large API addition
consumed by 8 live panels" never happened.

**04#26 stopped at its blocker and left the rest.** The finding names four
missing filters; the note recorded the sticky blocker and the merchant filter,
and the date range — the half that makes an audit log answer anything other
than "what happened most recently" — was simply not built.

The five notes that held were re-verified at the MECHANISM rather than the
symptom, and then pinned, because none of them was pinned by anything: 04#29,
04#33, 04#41 and 04#39 are now asserted in
`tests/contracts/admin-consequence-affordances.test.mjs`, each sabotage-checked
individually. A fix nothing asserts is a fix waiting to be undone.

### The fraud queue: fix the ORDER before adding the page

The last capped admin list, and the one that could not copy the pattern the
other ten use. `getAdminFraudSignals` fetched a fixed newest-100 window and
ranked it in memory, because `fraud_flags.severity` is text whose alphabetical
order — high, low, medium — is not its severity order. Paging that as-is would
have ranked each page independently: a high-severity flag on page 3 below a low
one on page 1.

The order was fixed first, in the database, and then the paging was added. It
is a STORED GENERATED column, not a written one:

    alter table public.fraud_flags
      add column if not exists severity_rank smallint not null
        generated always as (case lower(severity) when 'high' then 1 … end) stored;

A rank column a trigger or a forgetful INSERT keeps in sync can drift from the
text it ranks; a generated one cannot, and PostgreSQL refuses to write it.

**The proof was run against real PostgreSQL 17, in a rolled-back session, not
asserted.** Six flags whose severity and recency deliberately disagree:

    order by severity_rank asc, created_at desc   page 1: high, high
                                                  page 2: medium, medium
                                                  page 3: low, low
    order by severity asc, created_at desc        page 1: high, high, LOW, LOW
                                                  (every medium pushed off it)
    update … set severity='high'                  severity_rank 3 -> 1
    update … set severity_rank = 1                ERROR: cannot insert a
                                                  non-DEFAULT value into column
                                                  "severity_rank"

`tests/db/admin-fraud-queue-order.test.mjs` is that proof in the live-DB tier,
including the counterfactual, so the rank column cannot be deleted as
"redundant" without a test failing. It skips cleanly without `SUPABASE_DB_URL`,
which is how it behaves in this worktree.

### Sorting, and the trap one level up

Adding sort to a paged list is the same trap as the fraud queue wearing a
different hat: sorting the loaded page is correct only while the page is the
whole list. So `DataTable`'s sort is URL-driven and the ORDER BY happens in
PostgreSQL, and `parseAdminSortParams` takes a CLOSED allowlist for exactly the
reason `parseSizeParam` does — the token reaches PostgREST as an `.order()`
column on a service-role read, so an arbitrary string is an operator-controlled
ORDER BY.

The detail that would have shipped a silently wrong answer: `severity_rank` 1
is `high`, so "most severe first" is ASCENDING rank. `resolveAdminSort` inverts
it, and the unit test asserts the inversion rather than the mapping, because
the mapping is the part that looks right.

The header control is browser-proved rather than source-proved, through a
harness that mounts the REAL `DataTable` with the REAL allowlist. It
deliberately does NOT re-sort its own rows: a harness that re-implements the
thing it tests is the drift that already cost this campaign two wrong
conclusions.

### Two more measurements, and one gate that cannot run here

04#54 was "a copy decision" with no number attached. Measured in chromium at
1440x900 against the real `SectionHeader` at the real admin container width,
with `document.styleSheets.length > 0` asserted first: nine panel descriptions
cost **408px**, the privacy workflow header (220 chars) being the only
three-line one at 72px. Every description at or under the audit's 90-character
budget measured exactly one line, so the whole change is worth 408px -> 216px.
That is 192px across nine panels — real, and small enough that it is worth
saying out loud before anyone rewrites legal-adjacent operator instructions.

`pnpm test:db` cannot run in this worktree: there is no `.env.local`, so
`SUPABASE_DB_URL` is unset. 421 of its tests skip cleanly and 16 in five files
FAIL with "SUPABASE_DB_URL is not set" rather than skipping — a gate-shaped gap
of the same family as the ones audited above, since a suite that fails when it
cannot run teaches everyone to ignore its result. Not this lane's file to fix;
recorded so the next reader does not mistake those 16 for a regression.

## The blockers lane: re-testing 37 recorded refusals

Every `[~]` and `[stale]` row carries a NOTE saying why it stopped, and roughly
ten of those have been disproved by re-testing across this campaign. This lane
took all 23 partials and all 14 stale rows and required each verdict to come
from a command, not from the note.

**Method.** Three sweeps, all of them run:

1. Every `path:NN` citation in the working documents was resolved
   programmatically — 76 of them, and all 76 are in range. The trap that made
   this worth doing is real but different from the one advertised: the
   line-number citations have held, while the *path* citations rot. Two notes
   send a reader to components/merchant/**account**/profile-form.tsx and to
   components/marketing/final-cta.tsx (quoted unbacked deliberately: neither
   exists, and backticking them here would fail the very checker described
   below). The files are `components/merchant/profile-form.tsx` and
   `components/marketing/landing/final-cta.tsx`. `check-ui-audit-tally.mjs`
   cannot catch these because its `FILE_REF` regex only matches a path that
   starts at a top-level directory, and a note that writes a bare
   `profile-form.tsx` is invisible to it.
2. Every claim of the form "X does not appear in the tree" was re-grepped with
   a count rather than trusted. One had drifted (03#60's `rounded-xl`) and the
   drift made the claim *stronger*, not weaker.
3. Every contract citation was scope-tested by making the change and running
   the suite, rather than by reading the assertion.

**What that produced.**

- **03#37**: the residual was recorded as duplication "in the four route
  files". It was in one. Three of the four already route through
  `lib/merchant/print-asset-route.ts`, whose docblock takes `paramKey` as
  "`design`, or `template` on posters" — a helper written for a caller that
  never arrived. Migrating the poster onto it fully fails
  `qr-a4-poster-templates` (`not ok 506`, `/getOwnedQrImageContext/`), so the
  route collapse stays blocked with its scope now known exactly: **two
  identifiers in one file**. Everything outside those two shipped — including a
  seventh copy of the print-asset error surface that 03#41 was recorded as
  having collapsed to one.
- **01#60**: NEEDS-SIGNOFF 18 states both "a generic spine could keep it" and
  "extraction fails the assertion" in the same section. Both are true, of two
  different refactors, and the STATUS row propagated the pessimistic one all the
  way into HANDOFF-NEXT-AGENT's remaining-engineering list. The finding asks for
  the other one. Parameterising `GuideSpine` in place passes
  `marketing-offer-source` 18/18, sabotage-checked. The blocker is void; the
  real obstacle is a two-column layout on three indexed pages, which is a
  different kind of question and belongs to the owner.
- **02#20**: the e2e blocker is a fact about one *arrangement*. Probed in
  chromium: panel inside a closed `<details>` is not visible (so the audit's own
  accordion does fail), `<details>` inside the panel is visible (so a per-panel
  collapse passes untouched), and `getAttribute` reads the share URL from both —
  meaning the privacy assertion that spec is named for never depended on the
  disclosure at all.

**The tell that earned its keep.** Not "it names a file", and not "a merge moved
it". It was **"true of one half, applied to the whole"** — three for three. Each
time the recorded sentence was an accurate statement about a narrower thing than
the sentence it was written into: one file mistaken for four, one refactor
mistaken for the refactor, one DOM arrangement mistaken for the mechanism.

**The tell that did not.** "Says something must be BUILT — check it does not
already exist" fired only once (03#37's helper), and no re-test overturned a
measurement. Every finding that had been declined *with a number* — 01#9,
01#22, 01#30, 02#30, 02#60, 04#26 — survived re-testing unchanged. A refusal
backed by a measurement has held every time on this branch; a refusal backed by
a citation has not.

**What was strengthened rather than overturned.** 03#64's first recorded reason
was "the mock would prove the control renders, not that a real second camera
decodes" — a can't-fully-verify, which is not grounds to decline. It was struck
and replaced with the mechanism that actually decides it: both scanners start
the decoder on `{ facingMode: "environment" }`, so the device already does the
right thing. Same verdict, different standard of proof.

### The half of the reference check that was open

`check-ui-audit-tally.mjs` has verified cited source paths since the campaign
found two rotted ones by hand. Its `FILE_REF` only matches a citation that
starts at a top-level directory, so a note writing a bare `profile-form.tsx`
was invisible to it — and two notes were doing exactly that, one of them
addressing a `components/merchant/account/` directory that has never held that
file. A citation nobody can follow is not evidence, which is the reason the
path check exists at all.

Closed here with an ADDED check (nothing existing was touched): every bare
filename in the evidence documents must resolve to exactly one real file. 81
did. Two resolve to nothing on purpose — `separator.tsx` and
`marketing-type-scale.test.mjs` are both named in order to record that they are
gone or never existed — so they are allowed by name with the reason attached,
rather than by deleting the correction to satisfy a checker. Two resolved to
many and were rewritten as paths; a bare page.tsx (unbackticked here, or this
paragraph would fail its own check) matches **116** files in an App Router repo,
so citing it that way told a reader nothing.

Sabotage-verified in all three directions, because a checker that filters its
input is the exact shape of bug this file already carries three notes about:
a bare name that matches nothing EXIT=1, an ambiguous one EXIT=1,
and — the one that matters — narrowing the regex so it matches nothing at all
trips the vacuity guard, `only 0 bare filenames resolved`, EXIT=1 rather than a
green run on an empty set.

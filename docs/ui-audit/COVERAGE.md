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
| 01 marketing     |      69 |      54 |       6 |      3 |      6 |
| 02 customer      |      70 |      59 |       7 |      2 |      2 |
| 03 merchant      |      67 |      53 |       8 |      4 |      2 |
| 04 admin         |      74 |      61 |       2 |      9 |      2 |
| 05 design system |      67 |      64 |       2 |      0 |      1 |
| **Total**        | **347** | **291** |  **25** | **18** | **13** |

> > > > > > > lane/merchant

## "Stale" is a real category (18 findings)

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

## Remaining 13 open, by reason

Exactly: 01#23, 01#49, 01#55, 01#63, 01#65, 01#67, 02#50, 02#64, 03#13, 03#16, 04#54, 04#60, 05#13.

"Needs a browser" is no longer a category — Playwright works here, and the
findings previously parked under it (02#27, 02#28, 05#47, 04#67) were measured
and either fixed or closed with evidence.

- **Blocked by a contract or e2e test** (each attempted, reverted, nothing
  weakened) — 01#49, 01#63, 01#65, 03#46 (recorded in STATUS-m-launch).
- **Copy / product decision** — 01#23, 01#55, 02#50, 02#64, 04#54.
- **Needs a data-layer change** — 03#13 and 03#16.
  03#13's blocker is specific: `deriveMerchantCustomerRewardBadge` runs
  per-member over `activeReward`, `lastVisitAt`, stamp count and redemption
  history, so a merchant-wide "rewards ready / gone quiet" count means either
  duplicating that logic in SQL (drift risk on audited data) or loading every
  member. Counting the loaded page instead would print "3 rewards ready" when
  there are 12 — a false readback on a console whose whole premise is truthful
  readbacks, and worse than having no task layer.
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

**01#49 — CLS 0.1924 on the SEO hub.** Measured on /loyalty-for-pubs at
390x844: the section list is 302px at first paint and 0px after hydration; the
document goes 11,747px -> 11,472px. Google's "good" threshold is 0.1. The
finding is held open by one pinned literal in `marketing-offer-source`, and the
expression it pins is precisely the one that causes the shift — so the assertion
and the fix are genuinely incompatible, not a formatting technicality. Full
numbers and two options in NEEDS-SIGNOFF §7.

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
shape — and that line is 01#49's measured CLS 0.1924. Reusing the spine would
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

> > > > > > > lane/merchant

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

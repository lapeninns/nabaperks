# Handoff — the blockers lane, and what it left behind

Written by the lane that re-tested every `[~]` and `[stale]` row. Its five
commits are merged into `feat/ui-redesign-audit-fixes` (verified with
`git merge-base --is-ancestor` against each SHA); the `lane/blockers` branch and
its worktree have been cleaned up. Nothing below is in flight.

    f087c925a  fix(qr): the poster print route was the last one carrying its own error surface
    eef09c7ac  docs(ui-audit): 01#60 was never contract-blocked — the run says so
    5758c3d24  docs(ui-audit): re-test three recorded blockers by running them (02#20, 03#64, 03#60)
    91eb7946f  docs(ui-audit): record the blockers-lane method, and correct three documents it disproved
    24a451657  test(ui-audit): a bare filename citation must resolve to exactly one file

State is unchanged at **301 done / 23 partial / 14 stale / 9 open of 347**,
deliberately: this lane moved no status mark, so the tally tables stayed
byte-stable while other lanes were appending to the same documents.

## The headline, so nobody re-derives it

**There is no unblocked engineering left in the 23 partials and 14 stale rows.**
Every one of the 37 was re-tested by running something, and what remains is
twelve owner decisions plus one mechanical reclassification. That is a finding,
not an apology: three recorded blockers were disproved this round, and after
those three fell, the residue is decisions.

Do not open this list looking for code to write. Open it to get answers.

## A. Owner decisions — the whole remaining surface

Each one states the question, what it costs, and what it unblocks. None needs
more investigation before it can be answered; every one already carries a
measurement or a run.

### A1. 03#37 — reword two identifiers, get the single print route (Critical)

**Question:** may `tests/contracts/qr-a4-poster-templates.test.mjs:67-68` be
reworded?

They assert the literals `getOwnedQrImageContext` and `renderPosterQrCodePng`
inside `app/app/qr/poster/[template]/page.tsx`. `lib/merchant/print-asset-route.ts`
already performs both calls, and the tent and both NFC routes already use it —
its docblock even takes `paramKey` as "`design`, or `template` on posters",
because it was written for this caller. Migrating the poster onto it preserves
the behaviour exactly and deletes the two literals, which is why the run says:

    not ok 506 - poster route uses protected QR context and the unified render hosts
    The input did not match the regular expression /getOwnedQrImageContext/

A second pin exists and is easy to miss: `tests/unit/merchant-shell.test.mjs`
asserts `isPosterPrintPath` for all four `/app/qr/{poster,tent,nfc,nfc-square}/`
prefixes, and both files escape the slashes, so `grep 'app/qr/poster'` finds
neither. A grep returning nothing is making a claim, and that one is false.

**On yes:** the route collapse to `/app/qr/print/[kind]/[design]` becomes
available, plus four e2e specs to re-point. **On no:** close 03#37's remaining
half as declined — everything outside those two identifiers has now shipped.

### A2. 01#60 — a two-column layout on three indexed guide pages

**Question:** may `/guides/*` become a two-column reading layout on desktop?

The contract objection is void and was proved void by running it: parameterising
`GuideSpine` over its section list — which is what the finding asks for, in its
own words — keeps the pinned `<ol>` className in
`components/marketing/pubs/guide-spine.tsx` and passes
`tests/contracts/marketing-offer-source.test.mjs` 18/18. Sabotage-checked:
mutate the pinned expression and it fails.

What actually blocks it is layout. The spine is `lg:sticky lg:self-start` for
the grid `components/marketing/pubs/pubs-page.tsx:88-94` gives it, and
`components/marketing/guides/guide-page.tsx` is a single narrow column.

**On yes:** one prop, one layout change, no assertion moves. **On no:** close it
— the finding's own "at minimum" alternative is shipped and verified on all
three guides. Detail in NEEDS-SIGNOFF 55.

### A3. 02#20 — collapse the card page's promotional rails by default

**Question:** may `ReferralSharePanel` and `GoogleReviewButton` ship collapsed?

This is conversion, which is why it is here. The engineering is free, and that
is new: `tests/e2e/customer-referral-bonus-stamp.spec.ts` constrains the panel
ROOT's visibility, not its interior. Probed in chromium — panel inside a closed
`<details>` is invisible (so the audit's own "More from {venue}" accordion does
fail), a `<details>` inside the panel is visible, and `getAttribute` reads the
share URL through a closed disclosure either way, so the privacy assertion that
spec is named for never depended on this at all.

`components/customer/referral-share-panel.tsx` is unconditional promotion
(`components/customer/customer-card-experience.tsx` renders it whenever
`exp.referralShareUrl` exists, which is every membership) and is the largest
single rail below the card. NEEDS-SIGNOFF 56.

### A4. 02#53 — reword one bare identifier, converge the third OTP field

`tests/contracts/customer-join-frictionless-ux.test.mjs:68` is
`assert.match(otp, /normalizeOtpInput/)`. Routing
`components/customer/join-otp-form.tsx` through
`components/customer/customer-otp-input.tsx` **preserves the behaviour** and
deletes the literal, so closing this means rewording an assertion.

Note the shape: the assertion pins an implementation detail as a proxy for a
behaviour, and the behaviour survives the change. That is the same shape as A1.
Two of the branch's remaining blockers are the same species of assertion.

The other two thirds of 02#53 are genuinely closed: the six-cell primitive is
contract-banned on DESIGN.md's own "single native input" rule, and auto-submit
needs a code length the client provably does not have (NEEDS-SIGNOFF 38).

### A5. 03#25 — the `.w-tag` stroke is three assertions wide, not one

`tests/contracts/ink-border-weight.test.mjs` pins
`border: 1.5px solid var(--w-line);` at `:58`, `:120` and `:134` — the earlier
note cited `:57`, which is the comment above the assertion. The lane already
decided against the token on three DESIGN.md grounds (NEEDS-SIGNOFF 50) and
added a third assertion pinning the previously-unrecorded colour half. What is
left is: change the contract first, then the token, across 52 files.

### A6. 04#26 / 04#60 — sticky table headers

Measured three times, mechanism unchanged, and the note asks that it not be
re-measured again: the container computes `overflow: auto/auto` with no height
constraint, `overflow-y: clip` is coerced to `hidden` beside `overflow-x: auto`,
and there are two blocking ancestors, of which removing one changes nothing.
The only fix bounds the height and makes every admin table a nested scroll
region.

Three options are costed in NEEDS-SIGNOFF 12; **option 3 is the cheap one** —
bound the height only when the operator has chosen a page size above the
default, so nobody else's page rhythm changes. That is the one to put in front
of a human.

### A7. 04#26 — the audit action taxonomy

62 distinct actions over 21 target tables, parsed from all 110 migration insert
sites plus the two TS-side ones. Only 13 map to DESIGN.md's five merchant
activity categories without judgement. Two costed options in NEEDS-SIGNOFF 45;
forcing the taxonomy would badge `customer_pii_erased` as "Customer" on a
compliance surface, which is worse than no filter.

### A8. 05#65 and A9. 03#16 — two DESIGN.md-versus-code conflicts

Neither is a lane's to resolve, and both are written up with the arithmetic.

- **05#65** (NEEDS-SIGNOFF 46): `DESIGN.md:231` says "14px gaps between cards,
  22px between sections". The console ships `gap-6` = 24px at all 42
  occurrences, `gap-3.5` (14px) is used **zero** times in `app/app` + `app/admin`,
  and **22px is not a Tailwind step at all**. Neither number is a multiple of
  the stated 4px base. The doc is the likelier thing to be wrong.
- **03#16** (NEEDS-SIGNOFF 46/51): DESIGN.md sanctions `cardBreakpoint` at `sm`
  and `xl` only, and `components/merchant/customer-readback-table.tsx` uses a
  bespoke `lg`. Measured: `md` leaves ~510px beside the sidebar, `sm` reinstates
  overflow, and the sanctioned `xl` would stack cards on every 1024–1280px
  laptop. The doc's breakpoint menu is one case short.

### A10–A12. The product and copy calls

- **02#30** — clamping merchant reward terms behind a "Full terms" disclosure
  (product/legal), plus the untested second alternative that redesigns a
  signature Wet Ink element. NEEDS-SIGNOFF 9 and 37.
- **03#1** — a shared pre-title composition slot on every console page.
  DESIGN.md is silent on page-composition slots, so the project's own arbiter
  does not reach it. NEEDS-SIGNOFF 25/27.
- **03#52 / 03#64** — cursor paging on the activity feed changes the read model
  in two specific ways (`lib/merchant/activity.ts` documents both in situ), and
  a manual reward-code entry needs a customer-visible short code minted
  server-side, because the payload is a uuid. Both are product plus server, not
  UI.

## B. The one mechanical item

**03#60's mark.** Both clauses of its Recommended Redesign are true in the tree
— every cited site uses `rounded-lg` (the `--radius-xl` rung is deleted, so the
utility cannot compile), and `components/merchant/profile-form.tsx` uses
`StatusBanner` at `:135` and `:138`. So `[x]` fits better than `[stale]`, which
reads as "not reproducible" and is true of only the first clause.

It was left alone on purpose: moving one mark changes the four tally tables that
`scripts/check-ui-audit-tally.mjs` enforces across three documents every lane is
appending to. **Do it during a fan-in**, when the tables are being recomputed
anyway, not from a lane.

## C. Do not re-litigate these

Re-tested this round and unchanged, each by running a command rather than
reading the note: 03#4, 03#29, 03#44, 04#2, 04#29, 04#33, 04#41, 04#46, 04#59,
04#67 (stale); 01#9, 01#10, 01#22, 01#30, 01#38, 01#49, 01#54, 02#10, 02#60,
03#3, 03#47, 04#60's sorting half, 05#24 (partial).

The pattern is worth more than the list: **no refusal backed by a measurement
has ever been overturned on this branch.** 01#9, 01#22, 01#30, 02#30, 02#60 and
04#26 all survived. A refusal backed by a _citation_ has fallen three times.
When you are triaging what to re-test, sort by that.

## How to work it

    git -C "<nb-work>" worktree add -b lane/<name> ../nb-lane-<name> feat/ui-redesign-audit-fixes
    ln -s "<main repo>/node_modules" node_modules && cp "<main repo>/.env.local" .
    export PLAYWRIGHT_BASE_URL=http://127.0.0.1:<your own port>   # never 3146

Never touch `LapenInns Project/Nabaperks` — the owner works on `main` there,
live. Start every shell cell with `cd "<your worktree>"`, and **check the exit
code of that `cd`**: this lane's worktree was removed underneath it mid-session,
the `cd` failed, and the rest of the cell ran in the owner's repo. Only reads
happened, but a `%%bash` cell without `set -e` will happily carry on into
somebody else's checkout. Use `set -e`, or `git -C`.

Gates, always with an explicit exit code and never off a pipe:

    pnpm lint  pnpm typecheck  pnpm test  pnpm quality:check  pnpm build
    pnpm <gate> >/tmp/g.log 2>&1; echo EXIT=$?

Commit as
`git -c user.name="Claude Code" -c user.email="noreply@anthropic.com" commit`,
in small batches, and let the integrator merge the lane.

## Traps this lane paid for

1. **Scope-test a contract by making the change and running the suite.** Reading
   the assertion is how three of these sat blocked for weeks. Both blockers that
   survived A1 and A4 pin an _implementation detail as a proxy for a behaviour_,
   and the behaviour survives the change — you cannot see that by reading.
2. **The tell that fires is "true of one half, applied to the whole."** Three for
   three this round: one file mistaken for four, one refactor mistaken for the
   refactor, one DOM arrangement mistaken for the mechanism. "Names a file" and
   "a merge moved it" did not fire once.
3. **Line numbers are fine; paths rot.** All 76 `path:NN` citations in the
   working documents resolved in range. What had rotted were _paths_ — two notes
   addressed files that do not exist. `pnpm ui-audit:check` now catches both
   halves: as of 24a451657 every bare filename cited in the evidence documents
   must resolve to exactly one real file, with a two-entry allowlist for names
   written down precisely because they are absent. If you add a note, that check
   will hold you to it — including inside prose, so an example of a _bad_ path
   has to be written unbackticked.
4. **A checker that filters its input must prove the filter kept something.**
   The new check carries a vacuity guard and all three directions are
   sabotage-verified. Every check added here should do the same; this repo has
   shipped that bug at least four times.
5. **`git worktree list` is how you find out what happened to you.** If your
   branch has vanished, check `git merge-base --is-ancestor <sha>
feat/ui-redesign-audit-fixes` before assuming work was lost — a tidy fan-in
   looks identical to a disaster from inside a deleted worktree.

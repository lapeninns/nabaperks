# Nabaperks — Customer (Member) Journey UX/UI Redesign Audit

**Scope:** `app/home/**`, `app/card/[membershipId]/**`, `app/offer/[token]/**`,
`app/pass/[entitlementId]/**`, `app/scan`, `components/customer/**`,
`components/loyalty/**`, `components/layout/customer-*`, `components/pwa/app-pwa.tsx`.

**Method:** read-only source read of every file in scope plus the primitives they
compose (`components/ui/button|card|alert|empty`, `components/brand/*`) and the
`app/globals.css` Wet Ink layer. Heights below are computed from the actual
Tailwind scale in the markup (`--card-spacing: --spacing(6)` = 24px on
`ReceiptCard padding="md"`, `gap-6` = 24px, `pb-32` = 128px, etc.) against two
reference viewports: **iPhone SE 375×667** and **iPhone 14 Pro Max 430×932**.
The customer column is capped at `--container-customer: 25.625rem` = **410px**.

**Reference measure used throughout.** At 375px the shell is `px-4` → 343px of
content; a `ReceiptCard` at `padding="md"` removes 48px → **295px of usable
inner width**. At 430px the column caps at 410px → **362px inner**. Every
"does it fit" judgement below uses those two numbers.

---

## A. Customer shell, chrome and navigation

### 1. Authed shell reserves 128px of bottom padding for a 58px tab bar
- **File(s):** `components/layout/customer-app-shell.tsx:30`; `components/layout/customer-tab-bar.tsx:52-55`
- **Current UX/UI Problem:** `<main className="… px-4 pt-6 pb-32 sm:px-6">` reserves
  `pb-32` = 128px. The bar it clears is `min-h-14` (56px) + `border-t-2` (2px) +
  `pb-[env(safe-area-inset-bottom)]`, i.e. 58px on an SE and ~92px on a notched
  device. That is **70px of dead paper on an SE** and ~36px on a Pro Max, at the
  bottom of every home tab.
- **Why It Is a Problem:** On the surface where vertical budget is scarcest, a
  fixed magic number wastes most of a card-tile row and makes every page feel
  like it has an unexplained tail. It also means the last real element never
  sits near the thumb rest.
- **Recommended Redesign:** Replace the magic number with a token derived from
  the bar itself: define `--customer-tabbar-h: calc(3.5rem + 2px)` in
  `globals.css`, then `pb-[calc(var(--customer-tabbar-h)+env(safe-area-inset-bottom)+0.75rem)]`.
  Apply the identical token in `CustomerCardExperience`'s `className="pb-28"`
  (`components/customer/customer-card-experience.tsx:87`) and
  `app/pass/[entitlementId]/page.tsx:62`, which currently use a *different*
  magic number (112px) for the same bar.
- **Priority:** Medium

### 2. Sticky header spends ~70px on a logo and a "Log out" button
- **File(s):** `components/layout/customer-app-shell.tsx:16-28`
- **Current UX/UI Problem:** The sticky header is `py-3` around a `Logo`
  (`min-h-11`) and a default-size `Button` (`h-11`) → ~70px permanently
  occupied. "Log out" is the single most destructive and least frequent action
  in the member journey, and it is the only header action, rendered at full
  `variant="secondary"` weight with a 3px hard shadow.
- **Why It Is a Problem:** On an SE the header + tab bar consume 128px of 667px
  (19% of the viewport) before any content. Giving the sign-out the loudest slot
  in the chrome inverts the hierarchy — a member's most common intent is "show my
  card", not "log out".
- **Recommended Redesign:** Drop the header to `py-2` and `Logo compact` on
  `<640px`, and move "Log out" into the Profile tab (which already has a
  "Your details" surface and a `Member since …` footer line at
  `app/home/(authed)/profile/page.tsx:58`). If a header action must stay, make it
  `size="icon-sm" variant="ghost"`. Net saving ≈ 24px on every authed page, plus
  a calmer hierarchy.
- **Priority:** Medium

### 3. Tab-bar labels use an unsanctioned micro-type size
- **File(s):** `components/layout/customer-tab-bar.tsx:66`
- **Current UX/UI Problem:** `text-[0.6875rem]` = 11px Bricolage. `DESIGN.md`
  states that below `text-xs` (12px) there are **exactly two** sanctioned sizes,
  both Space Mono: `.mono-meta` (11.5px) and `.mono-id` (10px). This is a third,
  hand-rolled size in the *spoken* face, in the most-seen component in the app.
- **Why It Is a Problem:** Contract drift in the navigation sets the precedent
  every other surface copies; and 11px Bricolage 700 at 5-across is genuinely
  tight on a 320px device (82px → 64px per tab).
- **Recommended Redesign:** Either promote the labels to `text-xs` (12px) and
  reduce the icon chip from `size-9` to `size-8` to keep the 56px bar height, or
  adopt `.mono-meta` for the labels so the receipt voice carries the nav
  (consistent with `Eyebrow` usage everywhere else). Do not keep an arbitrary
  value.
- **Priority:** Medium

### 4. Tab-bar tap target is 56px tall but the visual affordance is only 36px
- **File(s):** `components/layout/customer-tab-bar.tsx:65-82`
- **Current UX/UI Problem:** The `<Link>` is `min-h-14` and full column width so
  the hit area is fine, but the *only* visual state change is the `size-9` (36px)
  roundel filling with ink. An inactive tab has `border-transparent` and a
  hover-only `group-hover:border-ink/30` — there is no `active:` press feedback
  and no `data-active` underline/rule. On touch there is no hover, so the tab bar
  gives **zero** feedback between tap and route change.
- **Why It Is a Problem:** On a slow dynamic route (`/home` and `/scan` are both
  server-rendered with real I/O) the member taps and nothing happens for
  hundreds of milliseconds — the classic "did it register?" moment, which
  produces double taps.
- **Recommended Redesign:** Add `active:translate-y-px` and an instant pressed
  fill (`active:bg-secondary`) on the roundel, plus a 2px ink rule above the
  active tab (`data-[active=true]:before:…` or a `-mt-0.5 h-0.5 bg-ink` marker).
  Use `useLinkStatus`/`usePathname` optimistic state so the tapped tab flips to
  active immediately rather than after navigation commits.
- **Priority:** High

### 5. `CustomerShell` and `CustomerAppShell` are two different columns for one journey
- **File(s):** `components/layout/customer-shell.tsx:13`; `components/layout/customer-app-shell.tsx:30`; `components/customer/customer-flow-system.tsx:48-56`
- **Current UX/UI Problem:** Three shells wrap the same 410px measure with three
  different rhythms: `CustomerShell` = `px-4 pt-6 pb-[max(1.5rem,safe)] sm:px-6 sm:pt-10 sm:pb-10`;
  `CustomerAppShell` = `px-4 pt-6 pb-32 sm:px-6`; `CustomerFlowShell` = `px-4 pt-5 pb-[max(1.25rem,safe)] sm:px-6 sm:pt-8`
  (or `pt-4` when `dense`). A member moving `/home` → `/card/x` → `/pass/y` gets
  24px, then 20px, then 20px of top padding, and a `max-w-customer` column that
  is `min-h-svh` in one shell and `min-h-[100dvh]` in another.
- **Why It Is a Problem:** Sibling screens in one journey should share a rhythm;
  the drift is small enough to read as sloppiness rather than intent, and the
  `svh`/`dvh` mismatch produces different scroll behaviour when the iOS URL bar
  collapses.
- **Recommended Redesign:** Extract one `CustomerColumn` primitive owning
  `px-4`, `pt-5`, the safe-area bottom, `min-h-[100dvh]` and `max-w-customer`;
  let the three shells differ only in whether they render the app header/tab bar.
  Delete the `sm:` overrides (see finding 6).
- **Priority:** Medium

### 6. `sm:` / `md:` breakpoints inside a 410px-capped column are inert or misleading
- **File(s):** `components/layout/customer-shell.tsx:13`; `components/customer/customer-flow-system.tsx:49,55`; `components/loyalty/reward-ticket.tsx:80,83,130`; `components/customer/customer-qr-scanner.tsx:232`; `components/brand/typography.tsx:61,87`
- **Current UX/UI Problem:** The customer column never exceeds 410px, yet the
  markup is full of viewport queries: `sm:px-6` (fires at 640px viewport where
  the column is already capped — so it only shrinks content inside an already
  centred column), `RewardTicket`'s `sm:p-4` / `sm:w-[88px]` stub, the scanner's
  `sm:grid-cols-2` exits, `PageTitle`'s `md:grid-cols-[minmax(0,1fr)_auto] md:pt-8`
  action rail. None of these respond to the thing that actually varies — the
  **column width**, which is 343px at SE and 362px at Pro Max.
- **Why It Is a Problem:** The reward ticket is physically *smaller* on a 430px
  phone (`w-20` stub, `p-3`) than on a desktop browser showing the same 410px
  column (`w-[88px]`, `p-4`). Responsiveness is being applied to the wrong axis,
  so the design cannot be tuned for the phones it actually ships to.
- **Recommended Redesign:** Put `@container` on the `max-w-customer` div and
  convert every customer-surface `sm:`/`md:` to `@sm:`/`@md:` container variants,
  or delete them and pick a single mobile value. Introduce one real phone
  breakpoint that matters — `min-[400px]:` — for the handful of places where a
  430px phone can genuinely afford more (stamp disc size, reward-ticket stub).
- **Priority:** High

---

## B. Home dashboard (`/home`)

### 7. No loyalty card is visible on first paint on a 375px phone
- **File(s):** `app/home/(authed)/page.tsx:33-61`
- **Current UX/UI Problem:** Measured stack above the first `HomeCardTile`, at
  375×667 with one redeemable reward:
  header 70 + `pt-6` 24 + `PageTitle` ~107 (eyebrow 15 + `gap-3` 12 + `text-3xl`
  ~36 + `gap-3` 12 + 2-line description ~44) + `gap-6` 24 + `HomeSummaryStrip`
  ~40 + `gap-6` 24 + `HomeRedeemBanner` ~190 + `gap-6` 24 = **~503px**. The
  viewport above the tab bar is ~609px. The first card tile is ~330px tall, so
  roughly **the top 100px of one card** is visible, with nothing readable.
- **Why It Is a Problem:** The product's entire proposition — "here are your
  stamps" — is below the fold on the most common UK phone size. Three pieces of
  chrome (title, summary, banner) outrank the object the member opened the app
  to see.
- **Recommended Redesign:** (a) delete `PageTitle` here — the tab bar already
  says *Home* and the venue names are the real headings; replace with a single
  `Eyebrow`-sized line or nothing. (b) Fold `HomeSummaryStrip` into that line.
  (c) Demote `HomeRedeemBanner` to a 56px-tall pinned summary row that expands,
  or delete it because the redeemable card is already sorted first
  (`sortHomeCards` in `lib/customer/home-dashboard.ts:8-25` puts it at index 0
  and its tile already carries a green "Reward ready" `MonoTag` and a
  "Open reward QR" tag). Saving: **≈300px**, putting a whole card above the fold.
- **Priority:** Critical

### 8. `HomeRedeemBanner` duplicates the first card tile verbatim
- **File(s):** `components/customer/home-redeem-banner.tsx:13-39`; `components/customer/home-card-tile.tsx:44-89`
- **Current UX/UI Problem:** The banner prints `MonoTag "Ready for scan"`,
  `MonoTag {businessName}`, the reward name at `text-lg`, a support sentence, and
  a `mono-id` "Open reward QR" affordance — ~190px. The tile immediately below it
  prints the same business name (`text-lg` h2), the same "Reward ready" leaf tag,
  the same "Open reward QR" tag, and links to the same `/reward/{id}`.
- **Why It Is a Problem:** Two identical calls to action stacked adjacently
  halve the perceived credibility of both and cost a third of a screen. It also
  creates two competing `Link`s to one destination for screen-reader users.
- **Recommended Redesign:** Delete `HomeRedeemBanner`. Instead give the
  already-first tile a redeemable treatment: `bg-accent`, a leaf top rule, and
  promote its inline `MonoTag` to a real `Button variant="reward" size="sm"`
  inside the tile (outside the wrapping `Link`, as the pass chips already do at
  `home-card-tile.tsx:141-143`).
- **Priority:** High

### 9. `HomeSummaryStrip` is a low-value 40px band with off-contract styling
- **File(s):** `components/customer/home-summary-strip.tsx:15`
- **Current UX/UI Problem:** `rounded-[var(--radius)] border-2 border-dashed
  border-ink/25 bg-card px-4 py-3 mono-meta tracking-[0.08em]` renders
  "2 cards / 1 reward ready / 2 stamps today" — every fact is derivable by
  looking at the tiles below. Three contract breaks in one line: `border-ink/25`
  is a **third dashed tone** (DESIGN.md sanctions exactly `--w-line` 18% and
  `--w-line-strong` 50%), `rounded-[var(--radius)]` is an arbitrary value where
  `rounded-lg` is the token, and `tracking-[0.08em]` re-declares tracking that
  `.mono-meta` already sets to `0.06em` (so the utility silently overrides the
  contract metric).
- **Why It Is a Problem:** Redundant information at the top of the scarcest
  screen, styled with three off-token values, in a system whose whole premise is
  a tight token contract.
- **Recommended Redesign:** Delete the strip, or reduce it to one `Eyebrow` line
  under the (removed) page title: `<Eyebrow>2 cards · 1 reward ready</Eyebrow>`.
  If a bordered container is kept, use `.w-rule`-toned `border-line` and
  `rounded-lg`, and drop the `tracking-` override.
- **Priority:** Medium

### 10. `HomeCardTile` is ~330px tall and stacks up to six sub-blocks per venue
- **File(s):** `components/customer/home-card-tile.tsx:59-158`
- **Current UX/UI Problem:** One tile can render, vertically:
  ReceiptCard 24px padding → venue header (eyebrow + `text-lg` h2 + locality +
  48px `VenueMark`) ≈ 61 → `gap-4` → tag row ≈ 26 → `gap-4` → stamp grid box
  (`rounded-lg bg-accent p-3`, 2 rows of ~40px compact discs + reward-chip label)
  ≈ 124 → `gap-4` → reward chip *or* status line ≈ 24-100 → `gap-4` →
  `ReferralBonusBankMini` ≈ 90 → `gap-4` → `TileGiftChip` ≈ 100 → close 24; then
  **outside** the card: `TilePassChip` (~130 each), `ReferralShareButton` (44),
  `GoogleReviewButton` (44). A fully-loaded tile exceeds **600px**. Three venues
  → ~1,500-1,800px of scrolling.
- **Why It Is a Problem:** A dashboard tile should be a scannable summary, not a
  full card page. At this height only one venue is ever on screen, which defeats
  the purpose of a multi-venue wallet.
- **Recommended Redesign:** Make the tile a fixed-height **summary row** (~120px):
  `grid grid-cols-[auto_minmax(0,1fr)_auto]` with the 40px `VenueMark`, a
  two-line lockup (venue + `n/m stamps`), a right-aligned state chip, and a
  single-row `StampGrid layout="row" flow="horizontal" compact` under it. Move
  gift/pass/referral/review to the card page only — they are all already
  rendered there (`customer-card-experience.tsx:327-352`). Keep at most one
  contextual chip per tile. Saving: **≈200px per venue**.
- **Priority:** Critical

### 11. Tile accessible name contradicts its destination when a reward is ready
- **File(s):** `components/customer/home-card-tile.tsx:41-43,61-64`
- **Current UX/UI Problem:** `href` becomes `/reward/{stampRewardId}` when a
  reward is redeemable, but `aria-label` is hard-coded
  `` `Open your ${card.businessName} card` ``. The visible `MonoTag` in the same
  link says "Open reward QR".
- **Why It Is a Problem:** WCAG 2.5.3 (Label in Name) — the accessible name does
  not contain the visible label, and it describes the wrong destination. Voice
  control users saying "open reward QR" will not match the link.
- **Recommended Redesign:** Derive the label from the same branch:
  `aria-label={card.stampRewardId ? `Open your ${card.businessName} reward QR` : `Open your ${card.businessName} card`}`.
- **Priority:** High

### 12. The unavailable-card branch renders an empty 26px dashed box
- **File(s):** `components/customer/home-card-tile.tsx:102-104`
- **Current UX/UI Problem:** When `stampsRequired === null || !card.available`
  the tile renders `<div className="rounded-lg border-2 border-dashed border-ink/20 bg-card p-3" />`
  — a bordered box with **no children**: 2px border + 12px padding top and
  bottom = ~26px of empty dashed rectangle. `border-ink/20` is another
  off-contract dashed tone.
- **Why It Is a Problem:** It reads as a rendering failure, not a state. The
  member gets an empty box plus a separate paragraph (`homeCardStatusCopy`) that
  says "This card is unavailable right now" — the box adds nothing but noise.
- **Recommended Redesign:** Render nothing in that branch and let the status
  paragraph carry the state; or if a placeholder is wanted, use a `.w-rule`
  hairline with a `mono-id` caption ("No stamp row while this card is paused").
  Replace `border-ink/20` with `border-line`.
- **Priority:** Medium

### 13. Gift, pass and bonus-bank chips are three visually identical blocks
- **File(s):** `components/customer/home-card-tile.tsx:106-119,168-191,231-247`; `components/customer/referral-bonus-bank-panels.tsx:51-69`; `components/customer/customer-card-experience.tsx:364-397,464-490`
- **Current UX/UI Problem:** Five separate components all render
  `grid gap-1.5 rounded-lg border-2 border-ink bg-seal/15 p-3` with a 14-16px
  icon + `Eyebrow` + `text-sm font-extrabold` + a `mono-id` chip
  (`bg-seal/25 border-2 border-ink px-2 py-0.5`). Revealed reward, discount pass,
  gift, referral bonus bank mini and the card-page equivalents are
  indistinguishable at a glance — same sun wash, same border, same rhythm.
- **Why It Is a Problem:** Three different promises with three different rules
  (single-use reward vs unlimited-use pass vs bonus-stamp bank) are given one
  visual identity, which is exactly the confusion the code comments say they are
  trying to prevent.
- **Recommended Redesign:** Extract one `PromiseChip` primitive with a `kind`
  prop (`reward | pass | gift | bonus`) and differentiate by spot ink per
  `DESIGN.md`: reward → `bg-reward/12` leaf, pass → `bg-cobalt/10`, gift →
  `bg-seal/15` sun, bonus bank → plain `bg-secondary`. One implementation, four
  tones, and the duplicated markup in `home-card-tile` / `customer-card-experience`
  collapses into one file.
- **Priority:** High

### 14. `HomeEmptyState` is ~500px of nested cards with conflicting max-widths
- **File(s):** `components/customer/home-empty-state.tsx:22-55`; `components/brand/typography.tsx:196-213`; `components/ui/empty.tsx:5-15,84-94`
- **Current UX/UI Problem:** `EmptyState` renders `Empty` with `p-12` (48px each
  side). Inside `EmptyContent` (which is `max-w-sm`, 384px) sits a
  `ReceiptCard className="w-full max-w-xl"` (576px) — the inner `max-w-xl` can
  never take effect. Net content width at 375px: 343 − 96 (`p-12`) − 32
  (`padding="sm"`) = **215px** for a numbered how-it-works list plus a full-width
  `size="lg"` button. Total height: icon roundel 44 + title + description + card
  (~230) + 96 padding ≈ **500px**.
- **Why It Is a Problem:** The first-run screen — the one moment where clarity
  matters most — is the most cramped surface in the app, with a 215px measure for
  3 lines of instructions and a CTA.
- **Recommended Redesign:** Drop `p-12` to `p-5` for the customer column
  (`EmptyState` should take a `padding` prop or the customer surface should pass
  `className="p-5"`), remove the nested `ReceiptCard` entirely (an empty state
  inside a card inside an empty state), and render the three steps as a flat
  `ol` on the paper. Remove the dead `max-w-xl`. Recovered width: **+64px**;
  recovered height: **≈150px**.
- **Priority:** High

### 15. `HomeActivitySnippet` repeats the Activity tab at full row weight
- **File(s):** `components/customer/home-activity-snippet.tsx:27-56`; `app/home/(authed)/activity/page.tsx:52-72`
- **Current UX/UI Problem:** The snippet renders the *identical* row markup as
  the Activity page (`surface-card grid gap-2 p-4` + tag row + title + 2-line
  description) — ~110px per row, plus a `SectionHeader` (eyebrow + `text-lg` h2)
  ≈ 50 and a "See all activity" link. Three items ≈ **420px** appended to the
  bottom of a dashboard that already scrolls ~1,800px, duplicating a tab that is
  one thumb-tap away in the bar.
- **Why It Is a Problem:** Pure duplication of a first-class destination,
  charged at maximum height, at the point where members have already stopped
  scrolling.
- **Recommended Redesign:** Either delete it (the Activity tab exists) or render
  it as three single-line `mono-meta` rows: `<time>` + one clause, `py-2` each
  (~34px per row) under a plain `Eyebrow`. Saving: **≈300px**.
- **Priority:** High

### 16. Home page rhythm does not match its own loading skeleton
- **File(s):** `app/home/(authed)/page.tsx:34,48`; `components/customer/loading-skeletons.tsx:260-280`
- **Current UX/UI Problem:** The page is `grid gap-6` with an inner `grid gap-4`;
  `CustomerHomeSkeleton` is `grid gap-5` with an inner `grid gap-3.5`. The
  skeleton also renders `ReceiptCard edge` (adds the 12px `.receipt-edge`) and an
  `<hr className="w-rule" />` (28px of margin) that the real `HomeCardTile` does
  **not** render, and omits the tag row, the `bg-accent p-3` stamp well, the
  status line and every chip.
- **Why It Is a Problem:** The file's own docblock promises "the swap to real
  content never shifts the layout". In practice each tile jumps by ~40px on
  arrival and the whole stack shifts by 4px per gap — visible content shift at
  exactly the moment of first paint (CLS).
- **Recommended Redesign:** Derive the skeleton from the real components: use
  `gap-6`/`gap-4`, drop `edge` and the `hr`, add a `h-[26px]` tag-row skeleton and
  an `h-[124px] rounded-lg bg-accent` stamp-well block. Better: add a
  `loading` prop to `HomeCardTile` so there is one layout, not two.
- **Priority:** Medium

### 17. `HomeBirthdayPrompt` is a full card for an optional, dismissible nudge
- **File(s):** `components/customer/home-birthday-prompt.tsx:62-81`
- **Current UX/UI Problem:** A `ReceiptCard` (24px padding, hard shadow, ink
  border) with a `MonoTag`, an `h2`, a 2-line paragraph and two `size="sm"`
  buttons ≈ **185px**, injected between the redeem banner and the cards. It uses
  the same surface weight as an actual loyalty card.
- **Why It Is a Problem:** An optional data-collection ask is given the same
  visual authority as the member's stamps, and it pushes the cards further below
  the fold (compounding finding 7).
- **Recommended Redesign:** Move it below the card list, and render it as a
  single dismissible row: `flex items-center gap-3 rounded-lg border-2 border-dashed border-line p-3`
  with one line of copy, a `size="sm"` link and an `icon-sm` ghost dismiss.
  Height ≈ 60px. Alternatively surface it only on the Profile tab, where the
  member is already in a details mindset.
- **Priority:** Medium

---

## C. Card and stamp experience (`/card/[membershipId]`, `/card/[membershipId]/stamp`)

### 18. The stamp button — the product's primary verb — is the last element on the screen
- **File(s):** `components/customer/stamp-collector.tsx:235-282`; `components/customer/customer-flow-system.tsx:298-333`
- **Current UX/UI Problem:** `CustomerStampCard` renders in strict DOM order:
  `StampGrid` → `afterGrid` (the 112px `StampStatusBand`) → `RewardTicket` →
  `children` (the `StampPressButton`). Measured at 375×667:
  `pt-5` 20 + flow header 36 + `gap-5` 20 + headline block ~130 + `gap-5` 20 +
  receipt [24 padding + `VenueMark` 58 + `.w-rule` 30 + grid ~110 + `gap-4` 16 +
  status band 112 + 16 + reward ticket ~120 + 16 + `pt-2` 8 + button 112 + 24]
  ≈ 646 + edge 12 → **the 112px stamp disc starts at ≈ y 900px**. The viewport is
  667px. The member must scroll ~350px to reach the only control on the screen.
- **Why It Is a Problem:** This is the counter moment: one hand, a queue behind
  them, a phone half-out of a pocket. Requiring a scroll to find the stamp
  button is the single largest usability defect in the member journey.
- **Recommended Redesign:** Reorder to **grid → status band → stamp button →
  reward ticket**, and make the reward ticket collapsible on this screen (it is
  purely motivational during the stamp act). Additionally, on `/card/[id]/stamp`
  drop the flow-shell headline block (`vm.headline` "Stamp it here" +
  `supportLine` = merchant name duplicates the `VenueMark` and eyebrow already in
  the receipt) — `hideHeaderText` is already used, so the outer headline is the
  duplicate. Combined saving above the button: **≈300px**, which puts the disc
  in the lower third of an SE viewport where the thumb is.
- **Priority:** Critical

### 19. The stamp status band reserves a fixed 112px scroll container
- **File(s):** `components/customer/stamp-collector.tsx:63-91`
- **Current UX/UI Problem:** `grid h-28 grid-rows-[1.5rem_1fr] content-start
  gap-1 overflow-y-auto rounded-lg border-2 px-4 py-3` — a hard 112px box with
  its own scrollbar, present in every phase including idle, where it contains
  only "Ready for today's stamp." / "Tap the stamp, or press and hold, to print
  today's mark." (about 60px of real content). The 52px of slack exists so the
  longest state string does not reflow the card.
- **Why It Is a Problem:** The reserved-band decision is correct (DESIGN.md's
  readback rule) but 112px is the wrong size for it: it is measured against the
  worst case rather than the common case, and `overflow-y-auto` means a long
  blocked-state message becomes an unnoticed inner scroll region on a phone.
- **Recommended Redesign:** Use `min-h-20` (80px) with `grid-rows-[auto_1fr]` and
  drop `overflow-y-auto` — let it grow. Growth below the grid does not move the
  grid (the rule that matters), and the two-line worst case fits 80px at
  `text-sm/leading-5`. Recovers 32px and removes a hidden scroll trap.
  Also replace `border-line` (an 18% hairline colour used at 2px width, line 82)
  with `border-ink` for the resting state, matching every other 2px border in the
  system.
- **Priority:** High

### 20. Card screen appends five optional rails below the card, unbounded
- **File(s):** `components/customer/customer-card-experience.tsx:327-354`
- **Current UX/UI Problem:** After the receipt the panel stacks, each in
  `grid gap-4`: `CardGiftChip` (~110), one `CardOfferPassChip` per pass (~130
  each), `ReferralBonusBankNotice` (~230: header + headline + a 3-column `dl` of
  bordered stat tiles + detail paragraph + a bordered "Stamp rule" block),
  `ReferralSharePanel` (~290: icon + heading + paragraph + two `size="lg"`
  full-width buttons + a manage row), `GoogleReviewButton` (44), and
  `CardDetailsDisclosure`. Worst case adds **≈850px** below a ~650px card.
- **Why It Is a Problem:** The card page becomes a 1,500px marketing scroll. The
  referral panel alone is taller than the stamp grid it is meant to support, and
  two full-width `size="lg"` buttons ("Share your link", "Copy link") for one
  intent is a duplicated primary action.
- **Recommended Redesign:** Collapse the rails into a single "More from
  {venue}" section using `Accordion`/`details` with three rows (Passes & gifts ·
  Bring a regular · Leave a review), closed by default. In `ReferralSharePanel`
  keep one `Button size="lg"` ("Share your link") and demote copy to a
  `variant="link" size="sm"` under it — `navigator.share` already falls back to
  clipboard (`referral-share-panel.tsx:83`), so the second button is redundant on
  every device that has a share sheet. Saving: **≈500px**.
- **Priority:** Critical

### 21. The card screen prints one headline three times
- **File(s):** `components/customer/customer-card-experience.tsx:83-89`; `lib/customer/experience/copy.ts:213-224`; `components/customer/customer-flow-system.tsx:299-306`
- **Current UX/UI Problem:** For `card_collecting`, `vm.eyebrow = merchantName`
  and `vm.headline = cardName`, so the flow shell prints a `MonoTag` with the
  merchant name and an `h1` at `text-[2.1rem]` with the card name — then
  `CustomerStampCard` is passed `hideHeaderText`, which removes them from the
  receipt but keeps the `VenueMark` (a 58px disc with the venue's initials). On
  `justJoined` the headline becomes `Welcome to {merchantName}` **and** a
  `StatusBanner` inside the receipt says `Welcome to {merchantName}.` again
  (line 258).
- **Why It Is a Problem:** At 2.1rem the headline consumes ~70-105px (it wraps to
  2-3 lines for names like "The Old Crown Girton Loyalty Card") before any
  content, and the celebration banner then restates it. Three utterances of one
  fact.
- **Recommended Redesign:** On the card route drop `vm.headline` to
  `text-[1.35rem]` (or reuse `dense`), and make the welcome `StatusBanner` say
  the *new* thing only ("Your first stamp is on the card") without repeating the
  venue. Saving ≈ 60px and one duplicated sentence.
- **Priority:** High

### 22. `CustomerFlowShell` headline uses arbitrary type sizes outside the scale
- **File(s):** `components/customer/customer-flow-system.tsx:97,104`
- **Current UX/UI Problem:** `dense ? "text-[1.65rem]" : "text-[2.1rem]"` (26.4px
  / 33.6px) and the description at `text-[0.96rem]` (15.36px). `DESIGN.md`
  specifies page-title at 30px mobile / 36px `sm+` and body at 15px — none of
  these three values exist in the Tailwind scale or the design contract, and
  `PageTitle` (used by the home tabs) uses `text-3xl sm:text-4xl` for the same
  role.
- **Why It Is a Problem:** Two headline scales in one journey: `/home` titles are
  30px, `/card` titles are 33.6px, `/card` in dense mode is 26.4px. No systematic
  relationship, so vertical rhythm drifts page to page.
- **Recommended Redesign:** Delete the arbitraries. Use `text-2xl` (24px) for
  dense and `text-3xl` (30px) otherwise — matching `PageTitle` — and `text-[15px]`
  → `text-sm leading-6` for the description (the contract body size).
- **Priority:** Medium

### 23. `CardDetailsDisclosure` hides a summary row that could carry real state
- **File(s):** `components/customer/customer-card-experience.tsx:512-531`
- **Current UX/UI Problem:** A `<details>` whose entire payload is one `dl` row:
  `CARD Nº XXXXXXXX` and `One stamp per UK business day` at `mono-id` (10px). The
  summary trigger itself is `text-xs font-bold` — an unlabelled 12px link at the
  very bottom of a 1,500px page.
- **Why It Is a Problem:** A disclosure that hides 20px of content is pure
  interaction cost; and the one genuinely useful fact ("one stamp per UK business
  day") is the rule members most often ask about, buried behind a tap at the
  bottom of the longest page.
- **Recommended Redesign:** Delete the disclosure and print the stamp rule as the
  receipt's `footerRight` (the `CustomerReceipt` already supports
  `footerLeft`/`footerRight` and defaults to exactly this string — see
  `customer-flow-system.tsx:153`), with `footerLeft` as the card number. That is
  what `hideFooter` is currently switching off in order to re-implement it worse.
- **Priority:** Medium

### 24. Stamp press disc has no disabled/secured visual and no error affordance in place
- **File(s):** `components/customer/stamp-press-button.tsx:258-314,27-70`
- **Current UX/UI Problem:** When `inactive` (`disabled || secured`) the button
  keeps `aria-disabled` and swaps `cursor-pointer` → `cursor-default`, but
  `StampDiscFace` renders identically to the active state unless `confirmed` or
  `pending` is set. `DESIGN.md` specifies **disabled = 45-50% opacity**; the disc
  never applies it. There is also no `focus-visible` ring difference between
  active and inactive, and the blocked state (`phase === "blocked"`) is
  communicated only by the separate status band above.
- **Why It Is a Problem:** A member who has already stamped today taps a disc
  that looks fully live and nothing happens — the reason is 112px above, in a
  scrollable band they may not have scrolled to. That reads as a broken button.
- **Recommended Redesign:** Add `inactive && "opacity-50"` to the disc face (and
  a dashed ink border for the closed state), and render the one-line reason
  directly under the disc at `text-xs` when `inactive` — the same string already
  in `view.statusBody`. Keep the band for the readback, but never let the control
  be silent about its own state.
- **Priority:** High

### 25. Hold-to-stamp gesture is discoverable only to screen readers
- **File(s):** `components/customer/stamp-press-button.tsx:309-313`
- **Current UX/UI Problem:** "Tap, or press and hold, to add today's stamp" lives
  in an `sr-only` span. The 600ms hold with a charging ring is a signature
  interaction, and sighted members have no visual hint that it exists; the ring
  only appears **after** 130ms of holding.
- **Why It Is a Problem:** An invisible affordance is not an affordance. Members
  will always tap, so the hold path (and its haptics) is dead weight for
  virtually everyone.
- **Recommended Redesign:** Print the hint visibly under the disc at
  `.mono-meta text-muted-foreground` ("TAP OR HOLD TO STAMP") — it costs ~16px
  and replaces nothing. Or show a faint idle ring at ~8% opacity so the ring's
  existence is legible before the gesture starts.
- **Priority:** Medium

### 26. Location notice is a permanent grey block below the primary control
- **File(s):** `components/customer/stamp-collector.tsx:274-280`
- **Current UX/UI Problem:** `rounded-lg bg-secondary px-3 py-2 text-center
  text-xs leading-5 text-muted-foreground` renders two lines of geofence
  explanation (~56px) directly under the stamp disc, on every qualifying visit,
  before the member has done anything. It uses `rounded-lg` + `bg-secondary` with
  no border — a fourth surface treatment that matches nothing else in the system
  (every other note is either `StatusBanner`, `CustomerActionNote` or a
  `surface-card`).
- **Why It Is a Problem:** Pre-emptive apology for a check that usually
  succeeds, occupying the space directly below the primary control (where a
  result should land), in an unowned visual style.
- **Recommended Redesign:** Move it into the status band's idle `statusBody`
  (one clause: "This venue may check your location"), or render it as a
  `mono-id` line. Remove the bespoke surface.
- **Priority:** Medium

---

## D. Loyalty primitives

### 27. Stamp grid produces ragged, unbalanced rows at 6/8/10 stamps
- **File(s):** `components/loyalty/stamp-grid.tsx:200-228`
- **Current UX/UI Problem:** The default row layout is
  `repeat(auto-fit, minmax(min(2.75rem,100%), 1fr))` with `gap-2`. Computed
  against the real 295px receipt inner width at 375px:
  `n ≤ (295+8)/52 → 5 columns`, disc = 52.6px.
  - 6 stamps + reward chip = 7 slots → **5 + 2** (row 2 is 60% empty).
  - 8 + reward = 9 slots → **5 + 4**.
  - 10 + reward = 11 slots → **5 + 5 + 1** — a single lonely reward chip
    occupying a whole third row (~68px including its `mono-id` label).
  At 430px (362px inner) it becomes 6 columns → 6+1 / 6+3 / 6+5, i.e. the
  layout reflows completely between two common phones.
- **Why It Is a Problem:** A loyalty card is a *designed object*; a 5+1 or 5+2
  ragged row reads as a bug, not a card. The reward chip stranded alone on row 3
  disconnects it from the row it terminates. And because the column count is
  viewport-derived, the same card looks materially different on an SE and a Pro
  Max.
- **Recommended Redesign:** Choose the column count from the stamp total, not
  from available width — `wrapColumns` already exists for this. Map
  `total → columns`: ≤5 → `total+1` (one row); 6 → 4 (rows of 4+3, balanced);
  8 → 3 (3+3+3, the reward closing the last row); 10 → 4 (4+4+3). Pass
  `layout="wrap"` with that value on the customer card, so every card length has
  an intentional shape. `CustomerStampCard` already computes a `wrapColumnCount`
  (`customer-flow-system.tsx:295-296`) but only for `total ≤ 4` — extend that
  table rather than falling back to `auto-fit`.
- **Priority:** High

### 28. Stamp discs scale by count, so a 3-stamp card has 68px discs and a 10-stamp card 52px
- **File(s):** `components/loyalty/stamp-grid.tsx:211`; `components/loyalty/stamp-dot.tsx:59-66`
- **Current UX/UI Problem:** Because the tracks are `1fr`, the disc size is a
  function of how many fit per row: 4 slots → (295−24)/4 = **67.8px**; 5 slots →
  **52.6px**; compact tile at 6 per row → **40.2px**. The `min-h-11` floor never
  binds. Inside the disc, earned stamps print venue initials at `text-[0.81rem]`
  (13px) over a date at `.mono-id` (10px) with `tracking-[0.09em]`; at 40px the
  date is truncated to `date.split(" ")[0]` (`stamp-dot.tsx:184-189`), so the
  compact tile shows a bare day number with no month.
- **Why It Is a Problem:** The card's most important object has no consistent
  size across venues, and its printed date is legible at 68px, tight at 52px and
  meaningless at 40px. A bare "12" reads as a stamp *number*, not a date, next to
  empty slots that literally show numbers (`showEmptySlotNumbers`).
- **Recommended Redesign:** Pin the disc to two sizes only — 56px on the card
  page and 40px in tiles — via a fixed track (`repeat(var(--cols), 3.5rem)`)
  with `justify-content: space-between`, so a short card gets whitespace rather
  than balloon discs. At 40px drop the date entirely (the `aria-label` already
  carries it) and keep only the initials, so a day number never masquerades as a
  slot number.
- **Priority:** High

### 29. `RewardChip` is a square in a row of circles, breaking the stamp family rule
- **File(s):** `components/loyalty/stamp-grid.tsx:56-82`
- **Current UX/UI Problem:** The reward slot renders
  `aspect-square … rounded-md border-2 -rotate-6` with a `RewardSeal size="sm"`
  (a 20px circle, `size-5`) centred inside it — a rounded *square* containing a
  tiny circle, sitting in a row of 52px circles, plus a `mono-id` caption below
  it that the stamp dots do not have. The `size-5` seal inside a ~52px square
  means the meaningful mark occupies 15% of the slot's area.
- **Why It Is a Problem:** The row's terminal object is visually weaker than
  every stamp preceding it, so the goal reads as less important than the steps.
  The caption also makes the reward column taller than the stamp columns,
  pushing the row's baseline out of alignment.
- **Recommended Redesign:** Make the reward slot a full-bleed `RewardSeal`
  at the disc's own size (circle, `-rotate-6`, sun while sealed, leaf when
  ready) with a 2px dashed `border-line-strong` ring when locked — one shape
  family, one size, no caption (the `aria-label` already says "Mystery reward,
  sealed"). If a caption is required, reserve the same caption height on the
  stamp dots so baselines align.
- **Priority:** Medium

### 30. Reward ticket stub steals 27% of the measure and its terms get 213px
- **File(s):** `components/loyalty/reward-ticket.tsx:128-144,78-101`
- **Current UX/UI Problem:** The stub is `w-20` (80px, `sm:w-[88px]`) plus a 2px
  perforation, leaving the face **213px** at 375px (295 − 82) for
  eyebrow + `text-lg` reward name + a `text-sm leading-6` description carrying
  merchant reward terms. Terms of ~120 characters wrap to 5-6 lines at that
  measure → the ticket alone is 150-180px. The stub itself contains only a 48px
  seal and a `mono-id` word ("Sealed"/"Ready").
- **Why It Is a Problem:** 27% of the scarcest measure in the app is spent on a
  decorative stub that repeats state already carried by the ticket's border style
  and eyebrow (`KICKER[state]`), while the actual reward terms are squeezed into
  a newspaper column.
- **Recommended Redesign:** Reduce the stub to `w-14` (56px) with a 32px seal, or
  move the seal to a `-top-2 -right-2 absolute` corner mark and give the face the
  full width. Clamp the terms to `line-clamp-2` with a "Full terms" disclosure —
  the legal sheet infrastructure already exists (`components/customer/legal-sheet.tsx`).
  Recovered: **+56px of measure and ~60px of height**.
- **Priority:** High

### 31. `RewardTicket` and `StampGrid`'s reward chip show the same seal twice on one screen
- **File(s):** `components/customer/customer-flow-system.tsx:307-330`; `components/loyalty/stamp-grid.tsx:56-82`
- **Current UX/UI Problem:** `CustomerStampCard` passes `rewardSlot` to
  `StampGrid` (rendering a sealed `RewardSeal size="sm"` at the end of the row)
  **and** renders a `RewardTicket` immediately below (rendering a sealed
  `RewardSeal size="md"` in its stub) with the same `MYSTERY_REWARD_SEALED_LABEL`.
  On a full card the `RewardCelebration` adds a third (`size="lg"`,
  `reward-celebration.tsx:50`). The comment at lines 291-296 says "never two
  seals competing in one view", but the code passes both.
- **Why It Is a Problem:** Three sizes of the same "?" disc in one viewport
  dilutes the mystery-seal signal that the whole reward mechanic depends on, and
  costs ~60px.
- **Recommended Redesign:** On the card page pass `rewardSlot={undefined}` when a
  `RewardTicket` is rendered below (and vice versa on dense previews). Enforce it
  in `CustomerStampCard` — it already knows both — by deriving `rewardSlot` as
  `ticketVisible ? undefined : …` instead of accepting it as a free prop.
- **Priority:** Medium

### 32. `StatusBanner` is used for instructions, confirmations, warnings and errors alike
- **File(s):** `components/loyalty/status-banner.tsx:7-14`; `customer-card-experience.tsx:308-319,430-453`; `reward-panels.tsx:43-45,73,113-115`; `profile-gate-forms.tsx:50-58,78-80,146-149`
- **Current UX/UI Problem:** One component in five tones carries: an instruction
  ("Scan the venue code to add your stamp", neutral), a confirmation ("Stamp
  secured.", success), a wait notice ("Give it a day to breathe", **warning** —
  vermillion wash for good news), a form heading ("A few details before this
  one's yours", neutral), a legal statement ("Verified email", neutral) and real
  errors. On `/reward/[id]` a member sees up to three stacked banners.
- **Why It Is a Problem:** When everything is a banner, nothing is. The
  vermillion `warning` wash on "Give it a day to breathe" and on
  `JoinFirstStampRecoveryPanel`'s "Your first stamp is still waiting" signals
  failure for states that are not failures. Each banner also costs 60-90px
  (`px-4 py-3` + icon column + title + description).
- **Recommended Redesign:** Reserve `StatusBanner` for **outcomes** (success /
  error / blocked). Route instructions to `CustomerActionNote` (which already
  exists, `customer-flow-system.tsx:355-393`, and is quieter), route section
  headings to `SectionHeader`, and route the waiting state to the reward
  ticket's own `readyDate` chip (`reward-ticket.tsx:102-108`) rather than a
  second block. Re-tone the wait states from `warning` to `info` (cobalt) or
  `neutral`.
- **Priority:** High

### 33. `QrFrame` double-pads the QR and offers no counter-mode presentation
- **File(s):** `components/loyalty/qr-frame.tsx:15-24`; `components/customer/reward-collection-qr.tsx:89-112`; `components/customer/offer-pass-qr.tsx:78-101`
- **Current UX/UI Problem:** `QrFrame` is `border-2 p-4` wrapping an inner
  `rounded-md bg-white p-2` — 12px of doubled white padding on top of the QR
  image's own quiet zone. Inside a `CustomerReceipt` at 375px the chain is
  343 (column) − 48 (receipt) − 32 (`p-4`) − 16 (`p-2`) = **247px of actual QR**.
  There is no brightness boost, no full-screen/"show at counter" mode, and the QR
  sits *below* the reward ticket and a `StatusBanner` (`reward-panels.tsx:64-78`),
  so it is typically ~500px down the page.
- **Why It Is a Problem:** This is the transaction. A 247px code, at whatever
  screen brightness the member happens to have, requiring a scroll, in a pub with
  the phone at arm's length over a bar, is the highest-friction moment in the
  product. The doubled padding costs 48px of code size for no visual benefit.
- **Recommended Redesign:** Collapse to a single `p-3` white frame (+24px of
  code). Hoist the QR **above** the reward ticket on `/reward/[id]` and
  `/pass/[id]` — the ticket is context, the code is the job. Add a "Show at the
  counter" affordance that renders the QR full-bleed on paper with
  `screen.brightness` maximised where available (or at minimum a
  `max-w-none w-[85vw]` presentation mode), and keep the refresh control
  underneath.
- **Priority:** Critical

### 34. `RewardCelebration` uses the sheet radius and an unbounded confetti layer
- **File(s):** `components/loyalty/reward-celebration.tsx:38,10-16`
- **Current UX/UI Problem:** `rounded-2xl` = `calc(var(--radius) + 8px)` = 18px,
  which is `--radius-sheet` — the radius `DESIGN.md` reserves for bottom sheets
  and large panels. Every sibling surface on the card uses `rounded-lg` (10px).
  The confetti dots are absolutely positioned with fixed offsets (`left-7`,
  `right-10`, `top-8`) inside `px-5 py-6` — at 295px width, `right-1/3` and
  `left-1/3` dots land within 20px of the 96px `RewardSeal size="lg"`.
- **Why It Is a Problem:** The peak emotional beat of the product uses the wrong
  shape token, and the confetti visually collides with the seal it is supposed to
  frame on narrow phones.
- **Recommended Redesign:** `rounded-lg`. Move confetti offsets to percentages
  with a minimum radial distance from centre (e.g. `top-2 left-[12%]`,
  `top-3 right-[14%]`), and reduce `py-6` → `py-5`.
- **Priority:** Low

### 35. `ProgressTrack` and `RewardTeaser` are dead/duplicate progress vocabulary
- **File(s):** `components/loyalty/progress-track.tsx:5-31`; `components/loyalty/reward-teaser.tsx:13-34`
- **Current UX/UI Problem:** `ProgressTrack` renders an `eyebrow` + a leaf
  `MonoTag` "3 / 8" + a `Progress` bar — a *second* progress readout for a system
  whose entire design is that the stamp grid is the progress readout (the comment
  at `customer-flow-system.tsx:290-292` says exactly this). `RewardTeaser` is a
  documented `@deprecated` shim around `RewardTicket`. Neither is referenced from
  the customer surfaces read here, yet both are exported from
  `components/loyalty/index.ts`.
- **Why It Is a Problem:** Two exported components represent superseded ideas. A
  future contributor reaching for "show progress" will find the bar and
  reintroduce the duplicate readout the system deliberately removed.
- **Recommended Redesign:** Delete `RewardTeaser` and migrate any remaining call
  sites to `RewardTicket` with an explicit state. Either delete `ProgressTrack`
  or restrict it to merchant analytics surfaces and remove it from the loyalty
  barrel so it cannot reach a customer screen.
- **Priority:** Low

---

## E. Rewards, passes and the collection moment

### 36. `/home/rewards` stacks four permanently-expanded sections with full headers
- **File(s):** `app/home/(authed)/rewards/page.tsx:20-110`
- **Current UX/UI Problem:** Up to four `<section>`s (`Ready for scan`,
  `Coming soon`, `History · Redeemed`, `History · Expired`) at `grid gap-8`
  (32px), each opening with a `SectionHeader` (eyebrow 15 + `gap-2` 8 + `text-lg`
  h2 22 + optional description 24 ≈ **50-70px**) and then one `ReceiptCard` per
  reward. `RedeemableReward` ≈ 230px (tag row + `text-lg` name + description +
  expiry note + a full-width `size="lg"` button); `QuietReward` ≈ 120px. A
  realistic member (2 ready, 1 upcoming, 5 redeemed, 1 expired) gets
  2×230 + 70 + 120 + 70 + 5×120 + 70 + 120 + 70 + `PageTitle` 107 + 3×32 gaps ≈
  **1,850px**, of which ~720px is closed history that nobody scrolls to read.
  Two of the four headers say "History".
- **Why It Is a Problem:** Live rewards (the only actionable content) are
  outnumbered 3:1 by archive, and every archive item is charged at full card
  weight with a hard offset shadow.
- **Recommended Redesign:** Two zones. Zone 1 "Ready & coming" — keep the cards.
  Zone 2 "History" — one `<details>`/`Accordion` labelled "Past rewards (6)",
  closed by default, containing 44px single-line rows (`flex justify-between`,
  venue `MonoTag` + reward name truncated + `mono-id` date) instead of cards.
  Collapse the two "History" headers into one. Saving with the numbers above:
  **≈900px**, and the ready rewards land above the fold.
- **Priority:** High

### 37. `RedeemableReward` repeats the venue name three times in one card
- **File(s):** `components/customer/reward-list-cards.tsx:28-56`; `lib/customer/issued-reward-display.ts`
- **Current UX/UI Problem:** The header row renders `MonoTag {businessName}`,
  then `MonoTag {rewardSourceBadge(source, businessName)}` (which itself embeds
  the business name for merchant-sent rewards), then `MonoTag "Ready"` — three
  pills on `flex-wrap` at 295px, which wraps to two rows for any venue name over
  ~14 characters. The `MonoTag` content span truncates
  (`mono-tag.tsx:47`), so a long name becomes `THE OLD CROWN GI…` twice.
- **Why It Is a Problem:** A wrapped, truncated, thrice-repeated venue name is
  the first thing read on the member's most valuable object.
- **Recommended Redesign:** One venue `MonoTag` on the left, one state `MonoTag`
  on the right, and put the source ("Birthday treat") in the description line as
  plain sentence text. Give the row `flex-nowrap min-w-0` with the venue tag
  `flex-1 truncate` so it degrades predictably.
- **Priority:** Medium

### 38. Reward-ready screen shows the QR behind a scroll, under two other blocks
- **File(s):** `components/customer/reward-panels.tsx:53-87`
- **Current UX/UI Problem:** `RewardReadyPanel` renders inside a
  `CustomerReceipt`: `RewardTicket` (~150) → `StatusBanner "Ready for merchant
  scan."` (a title-only banner, ~54px, saying what the ticket's `KICKER` already
  says — `reward-ticket.tsx:15` prints "Your reward · ready") →
  `RewardCollectionLive` → `RewardCollectionQr` (247px QR + `p-4` frame + a
  `rounded-xl bg-secondary` caption ~40). Plus the flow shell's headline
  (reward name at 2.1rem) and support line above. QR top edge ≈ **y 520px** on an
  SE; QR bottom ≈ y 830px — the code cannot be fully framed by a scanner without
  scrolling.
- **Why It Is a Problem:** Same as finding 33 but specific: the redundant
  success banner and the duplicated reward name (shell headline + ticket
  heading) are what push the code off-screen.
- **Recommended Redesign:** Delete the title-only `StatusBanner` (zero new
  information). Order the receipt: **QR → ticket → terms**. Drop the shell
  headline on this route (`vm.headline` is the reward name, which the ticket
  prints at `text-lg` anyway) and use the eyebrow only.
- **Priority:** Critical

### 39. Two near-identical QR components drifted apart
- **File(s):** `components/customer/reward-collection-qr.tsx:57-118`; `components/customer/offer-pass-qr.tsx:66-121`
- **Current UX/UI Problem:** The pass QR (docblock: "Mirrors
  `reward-collection-qr.tsx`") returns the error state **early**, replacing the
  whole component; the reward QR renders the error state *inline* and keeps its
  caption. The pass QR has a persistent `Button size="lg" variant="secondary"`
  "Show a fresh code"; the reward QR has that button **only in the error state** —
  so a member whose reward code was just scanned/expired mid-queue has no way to
  force a refresh and must wait for the interval. Error copy differs
  ("Pull down to refresh" vs "Try again, or ask a team member"), and the reward
  version tells members to pull-to-refresh inside a non-refreshable page.
- **Why It Is a Problem:** The two most important screens in the product behave
  differently in the same failure, and one of them gives an instruction that does
  nothing.
- **Recommended Redesign:** Extract one `ScanCodePanel` taking
  `{ src, alt, label, signInHref, caption }`. Always render the "Show a fresh
  code" control (both codes are single-use with a TTL), use one error copy, and
  drop "Pull down to refresh".
- **Priority:** High

### 40. QR caption blocks use `rounded-xl` — a radius that exists nowhere in the contract
- **File(s):** `components/customer/reward-collection-qr.tsx:114`; `components/customer/offer-pass-qr.tsx:102`; `components/customer/customer-login-form.tsx:96`; `components/customer/push-notification-settings.tsx:238`; `components/customer/push-notification-settings-disclosure.tsx:49`
- **Current UX/UI Problem:** Five customer surfaces use `rounded-xl`
  (`calc(--radius + 4px)` = 14px). `DESIGN.md` sanctions exactly two radii —
  10px (`--radius`) and 18px (`--radius-sheet`) — plus `rounded-full` for the
  stamp family. The login success box compounds it with `border border-reward/30`:
  a **1px** border in a system where "borders are 2px solid ink everywhere", in a
  colour (reward at 30%) that appears nowhere else.
- **Why It Is a Problem:** A 14px radius next to 10px siblings is visible at
  arm's length and reads as a different component library; the 1px reward-tinted
  border reads as a disabled or ghosted element rather than a confirmation.
- **Recommended Redesign:** Global replace `rounded-xl` → `rounded-lg` in the
  customer surfaces. Convert the login success box to
  `StatusBanner tone="success"` — the shared face already exists and is used two
  lines above for the error case (`customer-login-form.tsx:90`).
- **Priority:** Medium

### 41. `/pass/[entitlementId]` prints the discount and venue three times before the code
- **File(s):** `app/pass/[entitlementId]/page.tsx:56-82`; `components/loyalty/offer-pass.tsx:143-165`
- **Current UX/UI Problem:** The flow shell's `title` is
  `` `${pass.discountPercent}% off at ${pass.venueName}` `` at `text-[2.1rem]`
  (2 lines ≈ 70px), plus a `description`; then `OfferPass` prints the same fact
  as a `text-5xl` (48px) numeral with "off the whole bill at {venueName}" beside
  it, plus a date chip, plus a `passLead` sentence repeating the window, plus a
  bulleted terms list. Only after all of that (~430px) does `PassBody` render the
  QR.
- **Why It Is a Problem:** Three renderings of one number push the scannable
  code — the only reason the page exists — well below the fold, on a screen used
  while standing at a till.
- **Recommended Redesign:** Remove the flow-shell `title` on this route (pass
  `eyebrow` only, since `OfferPass` owns the h2 lockup), move `<PassBody>` to sit
  **directly under** the `text-5xl` lockup and date chip, and collapse
  `passLead` + the `<ul>` terms into a `<details>` "Terms" row. Saving:
  **≈250px**, putting the code in the top half of the screen.
- **Priority:** High

### 42. `OfferPass` terms list is the only bulleted list in the customer journey
- **File(s):** `components/loyalty/offer-pass.tsx:171-182`
- **Current UX/UI Problem:** `<ul className="grid list-disc gap-1.5 pl-4 text-xs leading-5 text-muted-foreground">`
  — browser disc bullets at 12px. Nothing else in the member journey uses
  `list-disc`; every other enumeration uses numbered `IconRoundel` discs
  (`home-empty-state.tsx:34-41`, `join-welcome-step.tsx:117-129`) or plain rows.
- **Why It Is a Problem:** Default browser bullets are the one un-designed
  element on an otherwise fully-inked surface, and 12px grey terms on a card the
  member is asked to show to staff is below the practical reading size across a
  counter.
- **Recommended Redesign:** Replace with `.w-rule`-separated rows at
  `text-xs leading-5` with a 4px ink square marker, or a `grid gap-1` of
  `mono-id` label + sentence. Raise to `text-sm` for the no-stacking rule, which
  is the one staff enforce.
- **Priority:** Low

---

## F. Activity and Profile

### 43. `/home/activity` renders 40 unbounded ~110px rows with no grouping or paging
- **File(s):** `app/home/(authed)/activity/page.tsx:42-72`; `lib/customer/activity.ts:26`
- **Current UX/UI Problem:** `getCustomerActivity()` defaults to
  `DEFAULT_LIMIT = 40`. Each `ActivityRow` is
  `surface-card grid gap-2 p-4` → 32 padding + tag row 26 + `gap-2` 8 + title 20
  + 8 + 2-line description 48 ≈ **142px**, plus `gap-3` between. 40 rows ≈
  **5,800px** of scrolling with no date separators, no filters, no venue grouping
  and no pagination. Timestamps are `.mono-id` (10px).
- **Why It Is a Problem:** A five-screen wall of visually identical cards with no
  landmarks. Finding "when did I last visit the Old Crown" requires reading every
  row. 10px relative timestamps are the smallest type in the app on the one
  screen that is entirely about time.
- **Recommended Redesign:** (a) Group by day with sticky `.eyebrow` date
  headers. (b) Compress the row: two lines (`title` + `mono-meta` venue · time)
  in a `flex` with a 24px category icon roundel on the left, `py-3`, separated by
  `.w-rule` hairlines instead of individual shadowed cards → **≈56px per row**,
  a 60% height cut. (c) Raise timestamps to `.mono-meta` (11.5px). (d) Add
  `FilterPills` (the primitive exists at `components/brand/filter-pills.tsx`) for
  Stamps / Rewards / Joins, and cap the initial render at 15 with a "Show more"
  button.
- **Priority:** High

### 44. Activity rows are duplicated between the snippet and the page
- **File(s):** `components/customer/home-activity-snippet.tsx:30-48`; `app/home/(authed)/activity/page.tsx:52-72`
- **Current UX/UI Problem:** The `<li>` markup, the `toneByCategory` map (both
  files declare it independently, lines 10-17 in each) and the `formatRelativeTime`
  usage are copy-pasted.
- **Why It Is a Problem:** Guaranteed drift: any density fix (finding 43) will be
  applied to one and not the other, and the two surfaces will diverge visibly.
- **Recommended Redesign:** Extract `<ActivityRow item density="compact|full" />`
  into `components/customer/activity-row.tsx` with the tone map beside it, and
  import it in both places.
- **Priority:** Medium

### 45. Profile is three near-identical `surface-card p-5` sections, ~150px of which is heading chrome
- **File(s):** `app/home/(authed)/profile/page.tsx:28-61`; `profile-about-you.tsx:83-84`; `profile-marketing-consent.tsx:64-65`; `push-notification-settings-disclosure.tsx:21-33`
- **Current UX/UI Problem:** Three consecutive `section.surface-card.p-5` blocks,
  each opening with a `SectionHeader` (eyebrow + `text-lg` h2 ≈ 50px) —
  "About you / Your contact details", "Marketing / Updates from your venues",
  "Push / Browser notifications". Total page ≈ 107 (`PageTitle`) + 334 + 340 + 90
  + gaps 96 + `pt-6` 24 + `pb-32` 128 ≈ **1,120px** for what is functionally a
  settings list with 4 read-only values and 6 toggles. Only the push section is a
  disclosure; the other two are always expanded.
- **Why It Is a Problem:** Repetitive section cards with duplicated heading
  patterns, ~150px of pure chrome, and inconsistent progressive disclosure (one
  of three collapses, for no user-visible reason).
- **Recommended Redesign:** Convert all three to one `Accordion` on a single
  `surface-card`, with "Your contact details" open by default and Marketing /
  Push closed. Replace the three `SectionHeader`s (eyebrow + h2) with single
  `text-base font-extrabold` summary rows carrying a state hint on the right
  ("3 verified" / "Email on" / "Push off"). Estimated height: **~420px** — a
  60% cut — with every setting still one tap away.
- **Priority:** High

### 46. Consent and push toggles are bare native checkboxes at `size-5`
- **File(s):** `components/customer/profile-marketing-consent.tsx:143-155`; `components/customer/push-notification-settings.tsx:292-302`; `components/customer/join-forms.tsx:170-214`
- **Current UX/UI Problem:** `<input type="checkbox" className="size-5 shrink-0
  accent-primary">` inside a `-m-3 … min-h-11 min-w-11 p-3` label. The hit area
  is correct, but the control is the **browser default** checkbox tinted with
  `accent-primary` — no 2px ink border, no hard offset shadow, no press collapse,
  no dashed empty state. Every other control in the system is fully inked. The
  `shadcn` `Switch`/`Checkbox` primitives (which the globals.css Wet Ink layer is
  built to theme) are not used.
- **Why It Is a Problem:** The only un-branded interactive controls in the
  journey sit on the consent screen — the exact place where trust and
  deliberateness matter most (GDPR consent must be an unambiguous affirmative
  act, and a system-default control undercuts the perceived care). It also means
  the toggle looks different on iOS, Android and desktop.
- **Recommended Redesign:** Use `components/ui/switch` for the two preference
  lists (a switch is the right affordance for auto-saving settings) and
  `components/ui/checkbox` for the join consent gate, and add the corresponding
  `[data-slot="switch"]` / `[data-slot="checkbox"]` rules to the Wet Ink layer
  (2px ink border, `--radius-sm`, hard 2px offset, vermillion fill).
- **Priority:** High

### 47. Marketing toggles auto-submit with no visible pending state on the control
- **File(s):** `components/customer/profile-marketing-consent.tsx:121-155`
- **Current UX/UI Problem:** `onChange` calls `form.requestSubmit()` and the
  checkbox is `disabled={pending}` with `disabled:opacity-60`. The confirmation
  arrives in a `role="status"` paragraph **above** the control, inside the text
  column. On a slow connection the member sees a checkbox fade to 60% with no
  spinner and a message rendering in a different visual block.
- **Why It Is a Problem:** Save-on-change without inline feedback at the point of
  interaction is the classic "did that save?" pattern; the message appearing in
  the description column reads as body copy rather than a response.
- **Recommended Redesign:** Put the state beside the control: a
  `mono-id` "SAVING…" → "SAVED" chip at the switch's trailing edge, or use the
  `Switch` with a `data-pending` treatment. Keep the `aria-live` region for
  screen readers but make the visual confirmation local.
- **Priority:** Medium

### 48. Push settings' skeleton bears no relation to its content
- **File(s):** `components/customer/push-notification-settings-disclosure.tsx:46-58`
- **Current UX/UI Problem:** `PushSettingsFallback` renders `h-16` status box,
  `h-9 w-32` button and three `h-10 rounded-lg bg-muted` bars. The real content
  (`push-notification-settings.tsx:238-305`) is an `h-[76px]` status box, a
  `size="sm"` button (36/44px) and three two-line rows (~55px each) with
  right-aligned toggles. The skeleton's rows are `bg-muted` with **no border**,
  unlike every other skeleton in the app which uses the themed
  `[data-slot="skeleton"]` fill.
- **Why It Is a Problem:** The disclosure visibly jumps ~50px when the chunk
  lands, and the fallback uses a different grey than every other loading state.
- **Recommended Redesign:** Use `<Skeleton>` (the themed primitive) with the real
  dimensions: `h-[76px] rounded-lg`, `h-11 w-32 rounded-lg`, three `h-14`.
- **Priority:** Low

### 49. Profile disclosure trigger uses `IconRoundel` as a +/− toggle with no state semantics
- **File(s):** `components/customer/push-notification-settings-disclosure.tsx:25-33`
- **Current UX/UI Problem:** The `<summary>` has `list-none` and a hand-rolled
  `IconRoundel size="sm" className="bg-transparent font-mono text-sm font-black"`
  printing a literal `"-"` / `"+"` character. There is no `.focus-ring` on the
  summary (unlike `CardDetailsDisclosure`, which does add it —
  `customer-card-experience.tsx:515`), no `aria-expanded` beyond the native
  `details` semantics, and the +/− glyphs are text characters rather than the
  `Icon` wrapper the design system mandates for all functional glyphs.
- **Why It Is a Problem:** Keyboard users get no visible focus on a primary
  disclosure; and a hyphen rendered as a "minus" is optically off-centre and
  visually inconsistent with the `ArrowDown01Icon` chevron used for the other
  disclosure in the same journey.
- **Recommended Redesign:** Add `focus-ring rounded-lg` to the summary, and swap
  the +/− for the same `Icon icon={ArrowDown01Icon}` with
  `group-open:rotate-180` used by `CardDetailsDisclosure` — one disclosure
  vocabulary for the journey.
- **Priority:** Medium

---

## G. Join wizard and login

### 50. The join wizard's step 3 is the tallest form in the app and buries its CTA
- **File(s):** `components/customer/join-wizard.tsx:143-173,219-264`; `components/customer/join-forms.tsx:160-244`
- **Current UX/UI Problem:** `TermsStep` (dense shell) stacks: header 36 +
  `gap-4` + headline `text-[1.65rem]` ~35 + description 2 lines 48 + `gap-4` +
  `TermsFirstStampPreview` [`surface-card p-3` 24 + venue row 40 + `gap-3` +
  compact `StampGrid` (8 stamps + reward at 271px inner, 6 cols → 2 rows ≈ 92) +
  `gap-3` + `RewardTicket` ~120 ≈ **300px**] + `gap-4` + the consent `fieldset`
  [`p-4` 32 + loyalty row ~90 + `.w-rule` 30 + marketing row ~66 ≈ **218px**] +
  `gap-4` + completion hint 2 lines 40 + `gap-4` + `Button size="lg"` 48.
  Total ≈ **830px**; the "Get my first stamp" button sits at ≈ y 780px. With the
  keyboard closed on an SE (667px) it is two-thirds of a screen below the fold.
- **Why It Is a Problem:** The final conversion step — the one the whole funnel
  exists for — requires a scroll past a decorative preview to reach its button.
  The preview also duplicates the welcome step's `StampJoinPreview` content the
  member saw two screens earlier.
- **Recommended Redesign:** Remove `TermsFirstStampPreview`'s `RewardTicket`
  (keep the stamp row only, ~120px saved) or replace the whole preview with a
  single-line `mono-meta` reminder ("STAMP 1 OF 8 · MYSTERY REWARD"). Merge the
  completion hint into the button's own supporting line. Target: CTA at
  **y < 560px**, in-viewport with the keyboard down.
- **Priority:** Critical

### 51. The 3-step progress bar lies on the no-QR path
- **File(s):** `components/customer/join-wizard.tsx:396-415`; `components/customer/customer-flow-system.tsx:117-143`
- **Current UX/UI Problem:** `joinProgress` maps `join_phone` to step
  `hasQr ? 2 : 1`, `join_otp` to **2**, `join_terms` to **3**, always out of
  `ONBOARDING_STEPS = 3`. On the no-QR path the member sees: phone = "Step 1 of
  3", code = "Step 2 of 3", terms = "Step 3 of 3" — fine. On the QR path they see
  welcome = 1, phone = 2, **code = 2** (the bar does not advance), terms = 3.
  Submitting the phone form and landing on the code screen leaves the progress
  bar visually unchanged.
- **Why It Is a Problem:** A progress indicator that does not move after a
  successful submit is read as "my submission failed", at the exact step (SMS
  code entry) with the highest abandonment risk.
- **Recommended Redesign:** Either use 4 steps on the QR path (welcome · phone ·
  code · terms) and 3 on the direct path, or keep 3 steps and show sub-progress
  in the label the component already supports (`"Verify number · Code"` is
  already passed — surface it as a filled half-segment). At minimum make the
  bar's second segment 50%-filled on `join_phone` and 100% on `join_otp`.
- **Priority:** High

### 52. The consent fieldset's checkbox rows have unequal hit areas and no error affordance on the row
- **File(s):** `components/customer/join-forms.tsx:168-222`
- **Current UX/UI Problem:** `<label className="flex items-start gap-3">` with a
  `size-5 mt-0.5` checkbox. The label is the hit target, but it wraps
  `CustomerLegalConsentLinks`, which contains three `<button>` sheet triggers
  ("venue terms", "Nabaperks customer terms", "privacy notice") that call
  `stopPropagation` (`legal-sheet.tsx:107-109`). So roughly 40% of the loyalty
  consent row's surface is *not* a toggle. On error, `loyaltyTermsError` renders
  a `<p>` **outside** the fieldset (line 216-222) and the checkbox gets
  `aria-invalid` but **no visual change** — `accent-primary` on a native checkbox
  cannot express invalid.
- **Why It Is a Problem:** The member taps the row to accept, hits a legal link,
  a sheet opens, and the checkbox stays unchecked — a well-known consent-flow
  failure. And when they submit, the error is visually disconnected from the
  control.
- **Recommended Redesign:** Separate the two: put the checkbox + a short label
  ("I accept the loyalty terms") in the tappable row, and move the three legal
  links to a line **below** it at `text-xs`. Use `components/ui/checkbox` so
  `aria-invalid` can drive a `border-destructive` ring, and render the error
  inside the fieldset immediately under the row.
- **Priority:** Critical

### 53. The OTP field is a single free-text input, not a code field
- **File(s):** `components/customer/join-otp-form.tsx:84-101`; `components/customer/customer-login-form.tsx:117-127`; `components/customer/profile-gate-forms.tsx:157-171`
- **Current UX/UI Problem:** Three separate places render
  `<input inputMode="numeric" autoComplete="one-time-code" className={`${customerInputClass} font-mono`}>`
  — a plain 48px full-width text box. The join version strips non-digits on
  `onInput`; the login version does not (it only sets `maxLength`); the profile
  version does neither beyond `maxLength`. None uses `components/ui/input-otp`
  (the shadcn OTP primitive) and none shows the expected code length visually.
- **Why It Is a Problem:** A wide empty box gives no affordance for "6 digits",
  no per-character feedback, and no auto-submit on completion — the member must
  find and press a separate 48px "Check code" button while holding a phone that
  just buzzed. Three divergent implementations of one field guarantee three
  different behaviours.
- **Recommended Redesign:** One `<OtpField>` component wrapping `InputOTP` with
  `maxLength={otpFieldMaxLength()}`, 6 slotted 44×52px ink-bordered cells, and
  auto-submit on the final digit. Theme the slots in the Wet Ink layer
  (`[data-slot="input-otp-slot"]`). Use it in all three call sites.
- **Priority:** High

### 54. Login page's two forms stack into one long column with two competing submits
- **File(s):** `components/customer/customer-login-form.tsx:44-144`
- **Current UX/UI Problem:** After a code is requested, the page shows: phone
  field + hint + a `role="status"` message box + a `Button` reading
  **"Resend code"**, then the OTP field + a second `Button` "Open my cards".
  Both are `variant="default"` (vermillion, `h-11`), stacked 100px apart. The
  member's next action ("enter the code") is below a button that would restart
  the flow.
- **Why It Is a Problem:** Two primary vermillion buttons on one screen, with the
  *destructive-to-progress* one first in reading order. On a phone with the
  keyboard up (~300px of viewport), "Resend code" is often the only visible
  button.
- **Recommended Redesign:** Once `otpSent`, collapse the phone form to a
  read-only summary row (`Phone ending 3456` + a `variant="link" size="sm"`
  "Change") — exactly the pattern `join-otp-form.tsx:137-171` already uses — and
  demote "Resend code" to `variant="link" size="sm"`. Only "Open my cards" keeps
  the vermillion slot.
- **Priority:** High

### 55. Login and join phone steps set different expectations for the same SMS
- **File(s):** `components/customer/customer-login-form.tsx:83`; `components/customer/join-forms.tsx:84`; `lib/customer/experience/copy.ts:54-63`
- **Current UX/UI Problem:** Login shows `JOIN_PHONE_CODE_HINT` = "We'll send a
  one-time code by text." Join shows `JOIN_PHONE_RETENTION_HINT` = "Use a UK
  number that can receive texts. Your card and progress stay linked to this
  number." (2 lines vs 1). Login's field has no `autoFocus`; join's does. Login's
  contact error uses `role="alert"`; join's does not (`join-forms.tsx:76`).
- **Why It Is a Problem:** Same field, same job, three behavioural differences —
  including an accessibility one, where the join flow's inline error is silent
  for screen readers while login's announces.
- **Recommended Redesign:** One `<PhoneField>` component with `autoFocus`,
  `role="alert"` inline errors and a single hint string, consumed by both.
- **Priority:** Medium

### 56. Welcome step's numbered step markers are a fourth circle dialect
- **File(s):** `components/customer/join-welcome-step.tsx:119-128`
- **Current UX/UI Problem:** `<span className="mt-0.5 grid size-5 shrink-0
  -rotate-6 place-items-center rounded-full border-2 border-ink bg-primary
  text-[0.7rem] leading-none font-extrabold text-primary-foreground">` — a 20px
  rotated vermillion disc with 11.2px text. `DESIGN.md` explicitly names
  `IconRoundel` as the sanctioned framing circle ("new framing circles reach for
  `IconRoundel` rather than hand-rolling `rounded-full`"), and `IconRoundel
  size="sm"` is 32px, **unrotated**. `HomeEmptyState` uses `IconRoundel` for the
  identical pattern (`home-empty-state.tsx:35-41`).
- **Why It Is a Problem:** Two how-it-works lists in one journey render their
  step numbers at 20px-rotated and 32px-static respectively; `text-[0.7rem]` is a
  fifth unsanctioned micro size; and rotation is reserved for the *reward/stamp*
  family, so a step number wearing a stamp tilt implies it is earnable.
- **Recommended Redesign:** Use `IconRoundel size="sm" tone="primary"` with
  `font-mono text-xs font-extrabold`, exactly as `HomeEmptyState` does.
- **Priority:** Medium

### 57. `UnlockingReminder` truncates the venue · card compound to two clamped lines
- **File(s):** `components/customer/join-wizard.tsx:198-217`
- **Current UX/UI Problem:** `<span className="line-clamp-2 text-sm leading-tight
  font-extrabold break-words">{merchant.name} · {card.name}</span>` inside a
  `flex` row whose fixed siblings are a 40px `VenueMark` and a 20px `RewardSeal`,
  plus `gap-3` ×2 → the text column is 271 − 40 − 20 − 24 = **187px**. At
  `text-sm` that is ~26 characters per line; "The Old Crown Girton · Coffee
  Loyalty Card" clamps mid-phrase.
- **Why It Is a Problem:** The member's motivation strip — the *why* at the
  highest-friction step — becomes "The Old Crown Girton · Coffee Loyalt…".
- **Recommended Redesign:** Split onto two rows: venue name as `Eyebrow`
  (truncating), card name as the `text-sm font-extrabold` line. Or drop the
  `RewardSeal` (the seal appears on the previous and next screens) to recover
  32px of measure.
- **Priority:** Medium

---

## H. Scan (`/scan`)

### 58. No torch, no manual entry, no aiming reticle — the pub-lighting case is unhandled
- **File(s):** `components/customer/customer-qr-scanner.tsx:28-33,201-230`
- **Current UX/UI Problem:** `SCAN_CONFIG` is `{ fps: 10, qrbox: {width:250,
  height:250}, aspectRatio: 1, disableFlip: false }`. There is no torch toggle
  (html5-qrcode exposes `getRunningTrackCapabilities().torch`), no zoom, no
  "enter the code manually" fallback, and the viewfinder is a plain
  `aspect-square … border-2 border-dashed border-border` box with **no corner
  reticle** — nothing tells the member where to aim. The only failure branch is
  `camera-error` (permission/hardware); a QR that simply will not decode in low
  light produces the unchanging line "Scanning for a Nabaperks QR…" forever.
- **Why It Is a Problem:** This is the entry point to the entire product, used in
  dim pubs, at arm's length, one-handed. No torch is the single most requested
  scanner affordance; no timeout means the member has no idea whether to keep
  trying.
- **Recommended Redesign:** Add (a) a torch `Button size="icon-lg"` overlaid
  bottom-right of the viewfinder when the capability exists; (b) four 24px ink
  corner marks inset 12px in the viewfinder so aiming is obvious; (c) a 12-second
  no-decode timeout that swaps the status line for "Struggling? Try more light,
  or ask the team for the code" plus a manual-code path; (d) haptic
  (`navigator.vibrate(24)`) on successful decode — `StampPressButton` already
  establishes the pattern.
- **Priority:** Critical

### 59. `qrbox` is a fixed 250px inside a viewfinder that is 247-314px wide
- **File(s):** `components/customer/customer-qr-scanner.tsx:31`
- **Current UX/UI Problem:** The viewfinder's width is the receipt inner
  measure: **247px at 320px viewport**, 295px at 375, 314px at 430. The scan box
  is hard-coded to 250×250 — larger than the viewfinder on a 320px phone, and 20%
  smaller than it on a Pro Max.
- **Why It Is a Problem:** On small phones the scan region exceeds the visible
  video, so the member aims at a region they cannot see; on large phones a fifth
  of the visible frame is dead. Either way the visible box and the decode box do
  not agree.
- **Recommended Redesign:** Pass a function
  `qrbox: (w, h) => { const s = Math.floor(Math.min(w, h) * 0.75); return { width: s, height: s } }`
  and draw the reticle at the same 75% so the visible frame *is* the decode
  region.
- **Priority:** High

### 60. The scanner's primary exit sends authed members out of the app
- **File(s):** `components/customer/customer-qr-scanner.tsx:232-239`; `app/scan/page.tsx:20-26`
- **Current UX/UI Problem:** The exits are `grid gap-3 sm:grid-cols-2` with
  `<Link href="/start">Back to start</Link>` and `<Link href="/home">Open my
  cards</Link>`. When a session exists, `ScanPage` wraps the scanner in
  `CustomerAppShell` (with the tab bar), so a signed-in member gets **two**
  navigation systems plus a link to the marketing switchboard `/start` they have
  no reason to visit. The `sm:grid-cols-2` never fires on a phone, so both are
  full-width 44px buttons stacked below an aspect-square viewfinder, adding ~100px.
- **Why It Is a Problem:** Redundant navigation duplicating the tab bar, one exit
  pointing outside the member journey, and ~100px of chrome under a viewfinder
  that already sits low.
- **Recommended Redesign:** When `session` is truthy, render **no** exit buttons
  (the tab bar is the navigation) and keep only the retry button in the
  camera-error state. When unauthenticated, keep a single "Open my cards" and
  drop "Back to start".
- **Priority:** High

### 61. The invalid-QR state is a silent text swap that keeps scanning
- **File(s):** `components/customer/customer-qr-scanner.tsx:107-113,159-168`
- **Current UX/UI Problem:** A non-Nabaperks QR sets `status: "invalid"` and
  changes the `aria-live` line to a 3-line sentence; `hasDecodedRef` stays false
  so the camera keeps decoding and can flip the status back and forth. There is
  no colour change, no border flash on the viewfinder, no haptic.
- **Why It Is a Problem:** In a busy venue the member will not notice a small
  text change under the video; they will keep holding the phone at a code that
  will never work.
- **Recommended Redesign:** On `invalid`, flash the viewfinder border to
  `border-destructive` for 600ms, fire `navigator.vibrate([12, 60, 12])`, and
  render the guidance as a `StatusBanner tone="warning"` under the frame (the
  banner is already imported across the customer surfaces). Debounce so repeated
  decodes of the same wrong code do not re-flash.
- **Priority:** Medium

### 62. Loader and loaded scanner duplicate ~40 lines of chrome that can drift
- **File(s):** `components/customer/customer-qr-scanner-loader.tsx:20-65`; `components/customer/customer-qr-scanner.tsx:180-241`
- **Current UX/UI Problem:** The two files repeat the `IconRoundel` + `Eyebrow` +
  `h1` + description block and the two exit buttons verbatim — and have **already
  drifted**: the loader's "Open my cards" is `variant="default"` (vermillion)
  while the loaded scanner's is `variant={undefined}`→default with "Back to
  start" as `secondary`, and in the loaded retry state the variants swap again.
  So the vermillion slot moves between three different buttons across the
  loading→loaded→error sequence.
- **Why It Is a Problem:** The primary-action colour visibly jumps between
  buttons as the chunk loads — a flicker of hierarchy at first paint.
- **Recommended Redesign:** Extract `<ScannerChrome>{children}</ScannerChrome>`
  holding the header and the exits, and have both the loader and the scanner
  render it, so the vermillion slot is decided in one place.
- **Priority:** Medium

---

## I. Offer claim (`/offer/[token]`)

### 63. `OfferShell` is a fourth customer column with its own padding and no tab bar
- **File(s):** `app/offer/[token]/page.tsx:227-253`
- **Current UX/UI Problem:** `<main className="min-h-svh bg-background px-4 py-10">`
  with `mx-auto grid w-full max-w-customer gap-6` — `py-10` (40px) where every
  other customer surface uses `pt-5`/`pt-6`, `gap-6` where the flow shell uses
  `gap-5`, `min-h-svh` where the flow shell uses `min-h-[100dvh]`, a bare `Logo`
  instead of the ✱ + wordmark header lockup used by `CustomerFlowShell`, and no
  safe-area bottom padding at all.
- **Why It Is a Problem:** The poster-scan landing is many members' *first ever*
  Nabaperks screen and it does not look like the rest of the product; the missing
  `env(safe-area-inset-bottom)` means the claim button can sit under the iOS home
  indicator.
- **Recommended Redesign:** Render it through `CustomerFlowShell` (passing
  `eyebrow`/`title` for the recovery states) so the header lockup, column,
  rhythm and safe area are inherited. Delete `OfferShell`.
- **Priority:** High

### 64. Offer landing states the same benefit up to four times before the CTA
- **File(s):** `components/customer/offer-claim-landing.tsx:89-149,223-251`
- **Current UX/UI Problem:** For a "2 stamps + 20% off" campaign the member
  reads, in order: venue `MonoTag`; `Eyebrow` campaign name; `h1`
  "2 bonus stamps and 20% off to start with"; merchant description; a `<ul>` of
  `benefitLines` restating "2 bonus stamps added to your card the moment you
  join" and "A 20% discount pass you can use as often as you like"; a
  `CardProgress` block with a `MonoTag` "2 welcome stamps" + stamp grid + "6 more
  visits and you reach X"; then a full `OfferPass` face restating "20% off the
  whole bill at {venue}" at `text-5xl` with its own terms list. Measured ≈
  **760px** before `claimAction`.
- **Why It Is a Problem:** The claim button — the entire purpose of the poster —
  is ~2 screens down on an SE, after four restatements of one promise. Poster
  scans are impulsive; every 100px of scroll costs conversions.
- **Recommended Redesign:** Promise once (h1) → prove once (the stamp row **or**
  the pass face, whichever is the headline benefit) → claim. Move
  `benefitLines`, the second benefit's face and the terms into a "What you get"
  disclosure below the button. Hoist `claimAction` to sit directly under the
  headline block with a sticky variant (`sticky bottom-4`) so it is always
  reachable. Target: CTA at **y < 400px**.
- **Priority:** Critical

### 65. Offer recovery states are a bare paragraph and an underlined text link
- **File(s):** `app/offer/[token]/page.tsx:124-132,146-160`
- **Current UX/UI Problem:** The rate-limited state renders only a `text-sm`
  paragraph inside `OfferShell` — no icon, no `StatusBanner`, and **no action at
  all**. The expired/paused/not-started states add `<p className="text-sm"><Link
  className="underline">Go to Nabaperks</Link></p>` — a plain inline link where
  every comparable dead-end in the journey uses `UnavailableRecoveryActions`
  (two `size="lg"` buttons, `components/customer/unavailable-recovery.tsx`).
- **Why It Is a Problem:** A member who scanned a poster and hit an expired
  campaign is given a 14px underlined link as their only exit, in a product whose
  stated rule is "never a dead end" (the comment at `join-wizard.tsx:430`).
- **Recommended Redesign:** Wrap the message in `StatusBanner` with the right
  tone (`info` for not-started, `neutral` for expired, `warning` for rate-limit)
  and render `<UnavailableRecoveryActions />` beneath it in every non-claimable
  branch, including the rate-limit branch.
- **Priority:** High

### 66. `CardProgress` on the offer landing hard-codes a 5-column stamp grid
- **File(s):** `components/customer/offer-claim-landing.tsx:179-187`
- **Current UX/UI Problem:** `<StampGrid layout="wrap" wrapColumns={5} compact
  rewardSlot="locked" …>` regardless of `stampsRequired`. For a 6-stamp card
  (6 + reward = 7 slots) that is 5 + 2 — a row with three empty columns; for a
  10-stamp card, 5 + 5 + 1 — a stranded reward chip. The offer landing renders
  inside `ReceiptCard` at `padding="md"` with no additional padding, so at 375px
  the tracks are (295 − 24)/5 = 54px — larger than the "compact" 36px intent.
- **Why It Is a Problem:** The first impression of the card mechanic is a ragged
  grid, and "compact" discs render larger here than on the member's real card
  tile (40px), so the preview does not match what they will get.
- **Recommended Redesign:** Apply the same `total → columns` table proposed in
  finding 27, and drop `compact` (or fix the track to `2.25rem` rather than
  `1fr`) so the preview matches the real card.
- **Priority:** Medium

---

## J. Loading, error and PWA states

### 67. One home skeleton stands in for four structurally different tabs
- **File(s):** `app/home/(authed)/loading.tsx:1-8`; `components/customer/loading-skeletons.tsx:260-280`
- **Current UX/UI Problem:** The file's own comment says it "covers the
  dashboard, activity, rewards, and profile tabs". `CustomerHomeSkeleton` renders
  a page title plus **two card-tile receipts with stamp rows**. Navigating to
  Profile shows two fake loyalty cards, then swaps to three settings sections;
  Activity shows two fake cards, then a 40-row feed.
- **Why It Is a Problem:** The skeleton actively lies about what is arriving,
  which is worse than a neutral shimmer — it produces a large, jarring
  re-layout on every tab switch and undermines the perceived speed the skeleton
  is meant to create.
- **Recommended Redesign:** Add `loading.tsx` to each tab segment with a matching
  skeleton (`CustomerActivitySkeleton`: title + 6 compact rows;
  `CustomerRewardsSkeleton`: title + 2 reward cards + a history summary row;
  `CustomerProfileSkeleton`: title + 3 collapsed section rows). All three are
  ~15 lines each in the existing file.
- **Priority:** High

### 68. Error boundaries centre content in a 60dvh box and lose the page's identity
- **File(s):** `app/home/(authed)/error.tsx:13-21`; `app/card/[membershipId]/error.tsx:14-21`; `app/scan/error.tsx`; `app/home/login/error.tsx`
- **Current UX/UI Problem:** `grid min-h-[60dvh] content-center py-8` (home) and
  `CustomerShell className="grid content-center"` (card/scan/login) both centre a
  `CustomerErrorState`, which renders a 56px `VenueMark` captioned **"Nabaperks"**
  — not the venue whose card failed — plus a `StatusBanner tone="error"` and up
  to two `size="lg"` buttons. Four boundaries, three different container
  strategies, and a generic brand mark where the member expects their venue.
- **Why It Is a Problem:** A card failure shows a Nabaperks-branded roundel and
  "Card unavailable", giving no clue which of their venues broke. Vertical
  centring in a 60dvh box also means the retry button lands at a different height
  on every route.
- **Recommended Redesign:** One `CustomerErrorShell` with consistent top-aligned
  layout (`pt-10`, not centred — errors should be readable without hunting), and
  pass the venue name/initials through to `VenueMark` where the route knows it
  (the card route has `membershipId` and could render initials from a cached
  name, or omit the mark entirely rather than showing the wrong one).
- **Priority:** Medium

### 69. PWA install prompt overlaps the primary action area on customer routes
- **File(s):** `components/pwa/app-pwa.tsx:277-323,79-89`
- **Current UX/UI Problem:** The prompt is `fixed right-3 left-3 z-50` at
  `bottom-[calc(env(safe-area-inset-bottom)+4.5rem)]` on tab-bar routes — a
  ~130px card (icon + title + 2-line description + two `size="sm"` buttons; ~190px
  with the iOS two-step strip) floating over the bottom third of the viewport.
  `hasCustomerTabBar` deliberately excludes `/scan`, so on the scanner it drops to
  `bottom-[max(0.75rem, safe)]` — directly over the retry / exit buttons. It also
  fires on `/card/*` and `/reward/*`, i.e. over the stamp button and the reward QR.
- **Why It Is a Problem:** An optional install nudge can cover the stamp disc at
  the counter or the QR being scanned. The `isEditingText` guard handles keyboards
  but not the two transactional moments that matter most.
- **Recommended Redesign:** Suppress the prompt on `/card/*/stamp`, `/reward/*`,
  `/pass/*` and `/scan` entirely (add them to the early-return list beside
  `/app/launch`, which is already excluded for exactly this reason). Prefer
  showing it once on `/home` after a successful stamp, where it is contextually
  earned.
- **Priority:** High

### 70. Install prompt's iOS step chips use 1px borders and a non-token radius
- **File(s):** `components/pwa/app-pwa.tsx:304-311`
- **Current UX/UI Problem:** `rounded-md border border-ink/20 bg-secondary px-3
  py-2` — a **1px** border at a third dashed/solid ink alpha (`/20`), on
  `rounded-md` (6px) where the system uses 10px. The card itself uses
  `shadow-xs` (2px) where every other floating surface uses `shadow-md` (4px).
- **Why It Is a Problem:** The most "OS-like" surface in the product is the one
  that least matches the design system, which reads as a third-party banner and
  reduces install intent.
- **Recommended Redesign:** `rounded-lg border-2 border-line bg-secondary` for
  the chips, `shadow-md` on the aside, and give the two chips explicit
  `IconRoundel` step numbers to match the how-it-works vocabulary.
- **Priority:** Low

---

## Cross-cutting patterns (repeated offenders)

1. **Duplicated information is the dominant height cost.** The redeem banner
   duplicates the first tile (8); the summary strip duplicates the tiles (9); the
   activity snippet duplicates the Activity tab (15); the flow-shell headline
   duplicates the receipt heading on `/card`, `/pass` and `/reward` (21, 38, 41);
   the offer landing states one promise four times (64); the reward seal renders
   at three sizes on one screen (31); "Give it a day to breathe" appears as both a
   ticket chip and a banner (32). **Removing duplication alone recovers an
   estimated 1,200-1,500px across the journey**, before any density work.

2. **The primary action is consistently the last thing on the page.** Stamp
   button after the reward ticket (18); reward QR after ticket + banner (38);
   pass QR after three restatements (41); join CTA after a 300px preview (50);
   offer claim after 760px (64). The journey's pattern should be inverted:
   **act → context → terms**, not context → terms → act.

3. **Six unsanctioned micro type sizes** — `text-[0.6875rem]` (tab bar, 3),
   `text-[0.7rem]` (join steps, 56), `text-[0.69rem]`/`text-[0.81rem]` (stamp
   dot), `text-[0.96rem]`/`text-[1.65rem]`/`text-[2.1rem]` (flow shell, 22) — in
   a system whose contract names exactly two sizes below `text-xs` and two
   headline sizes. Every one of these should resolve to `.mono-meta`, `.mono-id`,
   or a Tailwind scale step.

4. **Four dashed/solid ink alpha tones outside the two-tone contract:**
   `border-ink/25` (summary strip), `border-ink/20` (tile placeholder, PWA chips),
   `border-ink/15` (login rule), `border-ink/30` (tab-bar hover),
   `border-ink/10` (legal sheet header), `border-reward/30` (login success).
   `DESIGN.md` sanctions `--w-line` (18%) and `--w-line-strong` (50%) only.

5. **Three radii outside the contract:** `rounded-xl` (14px) in five customer
   files (40), `rounded-2xl` (18px, the sheet radius) on `RewardCelebration` (34),
   `rounded-md` (6px) on PWA chips (70). The contract is 10px and 18px-for-sheets.

6. **`sm:`/`md:` viewport variants inside a 410px column** (6) — the customer
   surface has no container queries, so it cannot respond to the only dimension
   that varies between an iPhone SE and a Pro Max. This is the root cause of the
   stamp-grid reflow (27) and the reward-ticket size inversion (30).

7. **Copy-pasted components that have already drifted:** activity rows (44),
   the two QR panels (39), the scanner chrome (62), the five sun-washed chips
   (13), three OTP fields (53), two phone fields (55), two how-it-works lists
   (56). Each pair is a future inconsistency waiting to ship.

8. **Native browser controls on the highest-trust screens** — checkboxes on
   consent and push (46) — are the only un-inked interactive elements in the
   product.

9. **Loading skeletons do not match their content** (16, 48, 67), so first paint
   shifts on the home dashboard, the push disclosure and every non-dashboard tab.

10. **Feedback is text-only at the counter.** No haptics on scan decode (58), no
    torch (58), no visual invalid-QR signal (61), no local pending state on
    toggles (47), no disabled treatment on the stamp disc (24) — the product asks
    members to operate it one-handed in a pub but communicates almost entirely
    through small grey paragraphs.

---

## Top 5 highest-impact changes

1. **Invert the card/stamp screen order so the stamp button is reachable
   without scrolling** (findings 18, 19, 20, 21). Move the press disc directly
   under the status band, collapse the five optional rails into one accordion,
   and drop the duplicated flow-shell headline. Currently the app's core verb sits
   at ≈y 900px on a 667px viewport. **Estimated saving above the button: ~300px;
   total page: ~800px.**

2. **Rebuild the home dashboard around the cards** (7, 8, 9, 10, 15). Delete the
   page title, summary strip, redeem banner and activity snippet; convert
   `HomeCardTile` to a ~120px summary row. Today no card is legible on first
   paint on a 375px phone; after this, two to three venues are. **Estimated
   saving: ~300px of chrome + ~200px per venue.**

3. **Make the QR the first thing on every collection screen, and make it big**
   (33, 38, 41). Single-padded frame (+24px of code), QR hoisted above the ticket
   and terms, a "show at the counter" full-bleed/brightness mode, and one shared
   `ScanCodePanel` for reward and pass. This is the transaction; it currently
   sits ~500px down at 247px wide.

4. **Fix the join and offer conversion steps** (50, 52, 64, 51). Terms step CTA
   above y 560px, consent checkbox separated from its legal links (currently ~40%
   of the consent row opens a sheet instead of toggling), offer claim button above
   y 400px, and a progress bar that actually advances between phone and code.
   These four are directly on the acquisition funnel.

5. **Give the scanner a torch, a reticle, a sized scan box and failure feedback**
   (58, 59, 61). The single entry point to the product currently offers no help
   whatsoever in the low-light, arm's-length, one-handed conditions it was
   designed for, and cannot tell the member that the code they are pointing at
   will never work.

---

## Appendix — measured heights (375×667 unless stated)

| Surface | Approx. height | Fits one viewport? |
|---|---|---|
| `/home` chrome above first card | ~503px | first card ~100px visible |
| `/home` with 3 venues (loaded tiles) | ~1,800-2,200px | no (~3.5 screens) |
| `/card/[id]` collecting, all rails | ~1,500px | no |
| `/card/[id]/stamp` (button at ~y 900) | ~1,100px | **no — primary control off-screen** |
| `/reward/[id]` ready (QR at ~y 520) | ~900px | no |
| `/pass/[id]` (QR at ~y 430) | ~850px | no |
| `/home/rewards` (2 ready, 6 history) | ~1,850px | no |
| `/home/activity` (40 rows) | ~5,800px | no |
| `/home/profile` | ~1,120px | no |
| `/m/…/join` terms step (CTA at ~y 780) | ~830px | **no — CTA off-screen** |
| `/offer/[token]` (claim at ~y 760) | ~900px | **no — CTA off-screen** |
| `/scan` (viewfinder + exits) | ~700px | marginal |
| `/home/login` (code requested) | ~640px | marginal, fails with keyboard up |

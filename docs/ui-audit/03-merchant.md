# Nabaperks — Merchant Console UX/UI Redesign Audit

**Scope:** `app/app/**`, `components/merchant/**`, `components/layout/merchant-app-shell.tsx`,
`console-sidebar-nav.tsx`, `console-nav.ts`, `components/brand/kpi-tile.tsx`.
**Method:** read-only source review of JSX + className strings against `DESIGN.md` (Wet Ink) and
`app/globals.css`. No files modified, no builds run.

**Design contract used as the yardstick (DESIGN.md):** one radius family (`--radius` 10px,
`--radius-sheet` 18px, full circles reserved for the stamp family); borders are **2px solid ink**
everywhere, **2px dashed** (`.w-rule`) for empty/receipt rules; hard non-blurred offset shadows
(`shadow-md` 4px, `shadow-sm` 3px); micro-type floor of exactly two sanctioned sub-`text-xs`
utilities (`.mono-meta`, `.mono-id`) with a hard 10px floor and an explicit ban on hand-rolled
`font-mono text-[0.x rem] tracking-[…]`; one input story (`FormField` / `SelectField` /
`SubmitButton`); one console table story (`DataTable` + `AdminRecordCard`, breakpoints `sm` or `xl`
only); merchant column max 1152px (`max-w-merchant`); 44px tap-target floor.

---

## 1. App shell, sidebar and console navigation

### 1. Merchant shell content padding is one fixed rhythm from 320px to 1920px
- **File(s):** `components/layout/merchant-app-shell.tsx:172-188`
- **Current UX/UI Problem:** the content wrapper is
  `"w-full px-4 py-8 pb-16 sm:px-6 md:pb-10"` and the inner column is
  `"mx-auto w-full max-w-merchant"`. There is no `lg:`/`xl:` step in either axis, and `py-8 pb-16`
  (32px top / 64px bottom) is applied on a phone where vertical space is scarcest. Meanwhile
  `MerchantSetupReminder` (`app/app/layout.tsx:42-44` → `merchant-setup-reminder.tsx:27`) injects a
  `className="mb-6"` ReceiptCard *above* every page's `PageTitle`, so on a phone the first pixel of
  real page content sits ~32px + full readiness card + 24px down the page.
- **Why It Is a Problem:** 96px of pure padding per screen on the smallest viewport is the single
  biggest contributor to console scroll length; and because the shell never widens its gutters at
  `lg+`, a 1440px screen renders a 1152px column with 24px gutters — the console reads cramped on
  desktop and airy on mobile, the opposite of what each needs.
- **Recommended Redesign:** move to `px-4 py-5 pb-10 sm:px-6 sm:py-6 lg:px-8 lg:py-8 md:pb-8`.
  Make the setup reminder a *slot* the page opts into next to its title (or a one-line strip inside
  `PageTitle`'s `actions`) rather than an unconditional stacked card with its own bottom margin.
- **Priority:** High

### 2. Mobile chrome is a bare hamburger + logo; the documented bottom tab bar does not exist
- **File(s):** `components/layout/merchant-app-shell.tsx:43-46` (prop doc), `:158-166` (render)
- **Current UX/UI Problem:** the `hideMobileChrome` prop is documented as dropping "the mobile sticky
  header **+ bottom tab bar**", but only a header is rendered:
  `<header className="sticky top-0 z-30 flex min-h-14 items-center gap-3 …">` containing a
  `SidebarTrigger` and `Logo`. There is no bottom tab bar anywhere in the merchant shell. Every
  navigation on a phone therefore costs: tap hamburger → drawer animates → tap item → drawer closes.
- **Why It Is a Problem:** the merchant's two highest-frequency counter actions (Scan, Poster/QR)
  are two taps and a full-screen overlay away, on a device held one-handed behind a bar. The
  customer side already ships `components/layout/customer-tab-bar.tsx`, so the pattern exists and is
  simply not applied to the console.
- **Recommended Redesign:** add a 4-item bottom tab bar for `md:hidden` — Dashboard, Scan, Poster,
  Members — reusing the customer tab-bar chip vocabulary, with `pb-[env(safe-area-inset-bottom)]`,
  `min-h-14` and 44px targets; keep the drawer for the long tail (Setup, Activity, Announce, Offers,
  Account). Then the shell's `pb-16` mobile padding becomes a real tab-bar offset rather than dead
  space. Fix the prop doc either way.
- **Priority:** Critical

### 3. Sidebar is a flat 7-item list with no grouping and no counts
- **File(s):** `components/layout/console-nav.ts:87-110`, `components/layout/console-sidebar-nav.tsx:44-62`
- **Current UX/UI Problem:** `merchantNavItems` renders Dashboard, Setup, Poster, Members, Activity,
  Announce, Offers as one ungrouped `SidebarMenu`; only the two account items get a
  `SidebarGroupLabel` ("Account"). The seven items mix *setup-time* surfaces (Setup, Poster) with
  *daily-operations* surfaces (Members, Activity, Scan-adjacent) and *growth* surfaces (Announce,
  Offers) at identical visual weight.
- **Why It Is a Problem:** no scent of task frequency; a launched venue keeps staring at "Setup"
  forever, and a pre-launch venue gets Offers/Announce it cannot use. Nothing indicates state
  (rewards ready to redeem, unread activity, setup steps remaining).
- **Recommended Redesign:** three labelled groups — **Counter** (Dashboard, Scan, Poster),
  **Members** (Members, Activity), **Grow** (Offers, Announce) — plus the existing Account group;
  demote Setup into a readiness chip in the sidebar header while incomplete and drop it from the
  main list once `readiness.launchReady`. Add a right-aligned `MonoTag` count on Members ("3 ready")
  reusing the readback already computed in `customer-readback-table.tsx:410-422`.
- **Priority:** High

### 4. Nav labels do not match the page titles they lead to
- **File(s):** `components/layout/console-nav.ts:88-109` vs `app/app/qr/page.tsx:37`,
  `app/app/launch/page.tsx:85`, `app/app/customers/page.tsx:70`, `app/app/announcements/page.tsx:31`
- **Current UX/UI Problem:** "Poster" → page titled **Venue QR**; "Setup" → page eyebrow **Merchant
  setup** with a dynamic heading; "Members" → **Loyalty members**; "Announce" → **Message your
  regulars**. Four of seven nav items rename their destination.
- **Why It Is a Problem:** breaks the "did I land where I tapped" confirmation loop, and makes the
  active-item highlight the only continuity cue. It also makes support copy ambiguous ("go to
  Poster" vs "the Venue QR page").
- **Recommended Redesign:** pick one noun per surface and use it in the nav item, the `PageTitle`
  and the eyebrow: `Poster kit` / `Venue QR` (choose one), `Setup`, `Members`, `Announcements`.
- **Priority:** Medium

### 5. Navigation pending feedback is a 6px dot at 60% opacity
- **File(s):** `components/layout/console-sidebar-nav.tsx:132-142`
- **Current UX/UI Problem:** `NavPendingIndicator` renders
  `className="ml-auto size-1.5 shrink-0 rounded-full bg-current opacity-0 … data-[pending=true]:opacity-60"`.
  6px at 60% opacity, appearing after a 100ms delay, is the only signal that a
  `force-dynamic` merchant route (every one of them) is loading.
- **Why It Is a Problem:** on a slow venue Wi-Fi connection the merchant taps, sees nothing move,
  and taps again. It is also invisible in the collapsed icon rail (`data-collapse-hide`).
- **Recommended Redesign:** swap for the shared `Spinner` at `size-4` in the same `ml-auto` slot, or
  animate the item's left border to vermillion while pending; in the collapsed rail, render the
  spinner in place of the glyph rather than hiding the indicator.
- **Priority:** Medium

### 6. Log out and Account are unreachable from the mobile header
- **File(s):** `components/layout/merchant-app-shell.tsx:143-155` (footer, inside the drawer) vs
  `:60-102` (the setup variant, which *does* expose Dashboard / Account / Log out inline)
- **Current UX/UI Problem:** in the full console the sign-out form and the account items live only
  inside the sidebar drawer footer; the mobile header has trigger + logo and nothing else. The setup
  variant header, by contrast, carries three controls at `size-sm`/`size="icon-sm"`.
- **Why It Is a Problem:** two different chrome grammars for the same product, and shared-device
  venues (a tablet behind the bar) cannot sign out without discovering the drawer.
- **Recommended Redesign:** unify: give the full-console mobile header the same right-hand cluster
  (Account `icon-sm`, Log out `sm`), or move sign-out into an avatar menu present in both variants.
- **Priority:** Medium

### 7. Active sidebar item and primary CTAs share the same filled vermillion
- **File(s):** `app/globals.css:756-763` (`[data-slot="sidebar-menu-button"][data-active="true"]` →
  `background: var(--sidebar-primary)`), vs `Button` default variant
- **Current UX/UI Problem:** the "you are here" state is a solid `--w-accent` fill with a 2px ink
  shadow — visually identical to the page's primary action button.
- **Why It Is a Problem:** DESIGN.md reserves the filled vermillion as "THE action/stamp ink";
  spending it on a passive location marker weakens every real CTA on the page and produces two
  competing "hottest thing on screen" elements.
- **Recommended Redesign:** active nav item = card ground + 2px ink border + a 3px vermillion left
  bar (`border-l-4 border-primary`) and weight 800 label. Keep the fill for the stamp/action family.
- **Priority:** Medium

---

## 2. Dashboard (`/app`)

Rough height audit at 390px wide: setup reminder card (~180px) + `PageTitle` with three stacked
full-width buttons (~230px) + `DashboardQrCard` (~380px) + billing notice + section header (~110px)
+ 2×2 KPI grid (~230px) + trend card (~230px) + recent-activity card with 4 rows (~420px)
≈ **1,800px, ~4.6 phone screens**, before any activity row is read.

### 8. Three full-width stacked buttons sit between the title and the first data
- **File(s):** `components/merchant/dashboard-header-actions.tsx:41-62`, rendered via
  `app/app/page.tsx:57`
- **Current UX/UI Problem:** `flex w-full flex-col-reverse gap-2 sm:w-auto sm:flex-row` with three
  `className="w-full sm:w-auto"` buttons — Offers (ghost), Announce (secondary), Scan code
  (primary). On a phone that is 3×44px + 2×8px = **148px** of chrome, and the ghost variant renders
  as an unbordered full-width block that reads as a broken button.
- **Why It Is a Problem:** two of the three (Offers, Announce) are low-frequency and already in the
  nav; only Scan is a counter action. The stack pushes the KPI grid and the QR below the fold.
- **Recommended Redesign:** keep one primary — **Scan code** — as `w-full sm:w-auto`, and move
  Offers/Announce into the nav (they are already there) or into an overflow `…` menu at `sm+`. If
  the bottom tab bar in finding #2 lands, Scan moves there and the header keeps zero buttons on
  mobile.
- **Priority:** High

### 9. `PageTitle` fakes baseline alignment with a magic `md:pt-8`
- **File(s):** `components/brand/typography.tsx:86-90`
- **Current UX/UI Problem:** the actions slot is
  `"flex flex-wrap gap-2 md:justify-self-end md:pt-8"`. The 2rem top padding is hand-tuned to sit
  the button row roughly on the h1 baseline, but the h1 is `text-3xl sm:text-4xl` **with an optional
  eyebrow above it**, so the offset is only correct for one of the four eyebrow/description
  permutations. Compare `/app` (eyebrow + description) against `/app/account` (no eyebrow,
  `app/app/account/page.tsx:43`) — the same class yields visibly different alignment.
- **Why It Is a Problem:** every console page inherits the drift; the actions row floats high or low
  depending on which optional slots the page passed.
- **Recommended Redesign:** drop `md:pt-8` and align the two grid tracks with
  `md:items-end` on the wrapper (already `md:items-start`) plus `self-end` on the actions div, so
  actions bottom-align to the title block regardless of eyebrow/description presence.
- **Priority:** Medium

### 10. KPI tiles use an arbitrary off-scale value size and produce ragged heights
- **File(s):** `components/brand/kpi-tile.tsx:56-84`, consumed at
  `components/merchant/dashboard-home-streams.tsx:93-111`
- **Current UX/UI Problem:** the value is
  `"numeric-tabular min-w-0 text-2xl leading-none font-extrabold sm:text-[1.75rem]"` — an arbitrary
  28px that is on no type scale. The trend caption (`:79-83`) renders only when `trend` is truthy,
  and the **Members** tile is deliberately `trend: null`
  (`dashboard-home-streams.tsx:52`), so tile 1 has two rows of content while tiles 2–4 have three.
  `h-full` stretches the card but not the internal rows, so the four values do not share a baseline
  and tile 1 has a hanging gap.
- **Why It Is a Problem:** a KPI strip's whole job is fast horizontal comparison; ragged internals
  and a bespoke size break the scan and the type system at once.
- **Recommended Redesign:** use `text-2xl sm:text-3xl`; give `KpiTile` a reserved trend row
  (`<p className="mono-id min-h-4">` rendering a `—` or "no change" when `trend` is null) so all four
  tiles share an internal grid; consider `grid-rows-[auto_1fr_auto]` on the CardHeader.
- **Priority:** Medium

### 11. KPI grid stays 2-up from 640px all the way to 1024px
- **File(s):** `components/merchant/dashboard-home-streams.tsx:93`
- **Current UX/UI Problem:** `"grid grid-cols-2 gap-3 lg:grid-cols-4"`. Between `sm` and `lg` the
  tiles are 2-up and extremely wide relative to their content (a 3-character number + a 64px
  sparkline in a ~350px cell), and the grid is two rows tall.
- **Why It Is a Problem:** wasted horizontal space on tablet, an unnecessary extra row of height,
  and the sparkline never scales into the extra width (`sm:w-20` caps at 80px).
- **Recommended Redesign:** `grid-cols-2 sm:grid-cols-4` and let the sparkline grow
  (`w-16 sm:w-full sm:max-w-28`). If four across is too tight at `sm`, use
  `grid-cols-2 md:grid-cols-4`.
- **Priority:** Medium

### 12. The dashboard QR ticket is the tallest block on the page and repeats the Poster page
- **File(s):** `components/merchant/dashboard-qr-card.tsx:124-219`
- **Current UX/UI Problem:** the card renders a 9.25rem (148px) `QrFrame` with a 7.25rem image, a
  "Tap to show full screen" caption, an eyebrow + status tag, a `text-xl sm:text-2xl` venue heading,
  a body line, and then **three** actions (`Show full screen`, `CopyUrlButton`, `Poster & print`) —
  and on mobile they stack because the primary is `w-full sm:w-auto` while the other two are not,
  producing a mixed-width button row. Total ≈380px, first thing under the title.
- **Why It Is a Problem:** the QR is genuinely the counter moment, but it is competing with the KPIs
  for the top of the page, and its three actions duplicate what the whole `/app/qr` page does.
- **Recommended Redesign:** collapse to a **single-tap ticket**: 96px QR + venue name + status tag
  in a `grid-cols-[auto_1fr_auto]` row, with the whole row as the full-screen trigger and one
  overflow control for Copy/Poster. Reclaims ~200px and keeps the one action that matters. On `md+`
  put it side-by-side with the KPI grid (`md:grid-cols-[18rem_minmax(0,1fr)]`) instead of stacked.
- **Priority:** High

### 13. Dashboard "Do next" exists as a component but is only wired into the dev harness
- **File(s):** `components/merchant/dashboard-next-actions.tsx` (whole file) — the only importers are
  `app/dev/app-harness/dashboard/page.tsx:23,201`; `app/app/page.tsx` never renders it
- **Current UX/UI Problem:** the production dashboard has KPIs, a chart and a raw activity list, but
  no answer to "what should I do now". The written component (rewards ready to redeem, members gone
  quiet, repeat-member progress) is shipped and unused.
- **Why It Is a Problem:** the dashboard is currently a *reporting* surface for an operator who
  needs a *task* surface; the highest-value merchant action (someone has a reward waiting) is buried
  in the Members table's `readyCount` badge.
- **Recommended Redesign:** render `MerchantNextActions` on `/app` directly under the QR ticket,
  above the KPI grid, and make its two rows deep-link into `/app/customers?filter=ready`. Then the
  KPI grid can safely fold behind a "See the numbers" disclosure on mobile.
- **Priority:** High

### 14. Billing notice is inside the metrics stream, so it pops in late and shifts the page
- **File(s):** `components/merchant/dashboard-home-streams.tsx:79` inside `MerchantDashboardStream`,
  which is Suspended at `app/app/page.tsx:73-77`
- **Current UX/UI Problem:** `<MerchantBillingNotice status={dashboard.billingStatus} />` is the
  first child of the streamed metrics component, but `MerchantDashboardMetricsSkeleton` reserves no
  space for it (`loading-skeletons.tsx:71-112` starts straight at the section header).
- **Why It Is a Problem:** a past-due banner injects itself above already-read content after the
  stream resolves — layout shift on the most consequential message on the page.
- **Recommended Redesign:** hoist the billing status read into the page shell (it is already
  request-cached alongside `getMerchantLaunchReadiness`) and render the notice above the Suspense
  boundaries, or reserve its height in the skeleton.
- **Priority:** Medium

### 15. Empty-state and populated dashboards have different vertical rhythms
- **File(s):** `app/app/page.tsx:52` (`grid gap-6`), `dashboard-home-streams.tsx:86` (`grid gap-3`),
  `:113` (ReceiptCard `padding="md"`), `:172` (`grid gap-4`)
- **Current UX/UI Problem:** four different gap values stack inside one page: page `gap-6`, metrics
  section `gap-3`, trend card internal `gap-3`, activity card `gap-4`. DESIGN.md specifies 14px
  between cards and 22px between sections.
- **Why It Is a Problem:** the eye cannot tell which blocks are siblings and which are nested,
  because the nesting gap (12px) and the sibling gap (24px) are not consistently applied.
- **Recommended Redesign:** two tokens only — `gap-[22px]` (or `gap-6`) between page sections,
  `gap-3.5` (14px) between cards inside a section, and `gap-2`/`gap-3` inside a card. Apply
  mechanically across `/app/**`.
- **Priority:** Low

---

## 3. Members (`/app/customers`)

### 16. The members table hand-rolls a second responsive renderer instead of using `DataTable`'s
- **File(s):** `components/merchant/customer-readback-table.tsx:51-198` (mobile card + list),
  `:586-641` (`lg:hidden` / `hidden … lg:block` split)
- **Current UX/UI Problem:** the component renders the **whole filtered list twice** — once as
  `CustomerMobileList` inside `<div className="lg:hidden">` and once as `DataTable` inside
  `<div className="hidden min-w-0 lg:block">`. DESIGN.md's "Console data tables & record cards"
  section explicitly sanctions only `cardBreakpoint` `sm` or `xl` via `DataTable`'s `mobileCard`
  slot, with `AdminRecordCard` as the shared renderer; the inline comment at `:586-591` acknowledges
  it is "a bespoke lg split".
- **Why It Is a Problem:** (a) both DOM trees mount for every row — on a 50-row page that is 100
  rendered records, 100 `StampGrid`s, and two copies of every `data-customer-highlight` marker (the
  effect at `:443-454` has to filter by `offsetParent !== null` to work around it); (b) the two
  renderers have already drifted — the mobile card exposes "Open scanner" + "Send reward" only when
  *selected*, the desktop row always shows Scan/Send; (c) the design system now has two member-row
  vocabularies to maintain.
- **Recommended Redesign:** move the split into `DataTable` — either extend the shared contract with
  an `lg` breakpoint (one line in the shared component, then delete ~150 lines here) or accept `xl`
  and use column priority to fit the table at `lg`. Render the card via `AdminRecordCard` with the
  per-row action in its `action` slot, as the admin customers table already does.
- **Priority:** Critical

### 17. The Reward column stacks up to three controls, inflating every row
- **File(s):** `components/merchant/customer-readback-table.tsx:285-329`
- **Current UX/UI Problem:** the cell is
  `<span className="flex flex-col items-start gap-1.5">` containing a `MonoTag`, a conditional
  `Scan` button and an always-present `Send` button, each `size="sm"` with
  `[@media(pointer:coarse)]:min-h-11`. A redeemable row is therefore ~44+36+36+2×6 = **128px tall**
  before the `StampGrid` column is considered.
- **Why It Is a Problem:** ten members fill more than a laptop screen; the table stops being a
  table. Two persistent buttons per row also means 100 competing CTAs on a 50-row page, none of
  which is the row's actual primary action.
- **Recommended Redesign:** collapse the column to the `MonoTag` alone, and put the actions in a
  single right-hand `…` overflow (or reveal Scan/Send only on row selection, as the mobile card
  already does at `:142-164`). Add a bulk "Scan next ready reward" affordance to the header row
  instead of one per line.
- **Priority:** High

### 18. Search and filter only cover the loaded page, and the UI apologises in prose
- **File(s):** `components/merchant/customer-readback-table.tsx:512-554`,
  `app/app/customers/page.tsx:117-123`
- **Current UX/UI Problem:** filtering runs client-side over one `CUSTOMERS_PAGE_SIZE` window
  (`filterCustomers`, `:358-372`), and the honesty note at `:548-554` reads *"search and filters
  cover this page only. Older members are on the later pages."* Pagination is prev/next only
  (`:657-704`).
- **Why It Is a Problem:** for any venue past one page, search is functionally broken — the merchant
  types a member's initials, gets "No members match your filter", and has no way to know which page
  the member is on. The apology paragraph is UI debt made visible.
- **Recommended Redesign:** move `q` and `filter` into the URL and the server loader (they already
  round-trip `?page=`), matching the pattern `activity-detail-feed.tsx:235-267` already uses. Then
  delete the disclaimer paragraph, and add first/last + numbered page controls to the
  `CustomersPaginationRow`.
- **Priority:** Critical

### 19. Hand-rolled sub-`text-xs` mono breaks the documented micro-type contract
- **File(s):** `components/merchant/customer-readback-table.tsx:95` and `:231`
- **Current UX/UI Problem:** both renderers print the phone line as
  `"font-mono text-[0.66rem] font-bold tracking-[0.04em] text-muted-foreground"` — 10.56px with a
  bespoke 0.04em tracking. DESIGN.md: *"Do not hand-roll `font-mono text-[0.x rem] tracking-[…]`
  strings — reach for one of these utilities."*
- **Why It Is a Problem:** a third mono size alongside `.mono-meta` (11.5px) and `.mono-id` (10px),
  duplicated in two places, one token check away from failing.
- **Recommended Redesign:** replace both with `className="mono-id text-muted-foreground"`.
- **Priority:** Medium

### 20. Row selection is a 1px translucent ring on a 2px-ink system
- **File(s):** `components/merchant/customer-readback-table.tsx:68` (card) and `:630-639` (row)
- **Current UX/UI Problem:** selected state is
  `"bg-primary/10 ring-1 ring-primary/30 ring-inset"` in both renderers. A 1px ring at 30% alpha over
  a 10% vermillion wash is a low-contrast, non-Wet-Ink treatment.
- **Why It Is a Problem:** it will not meet 3:1 non-text contrast, and it is the *only* signal that
  the row's expanded actions belong to that member. It also reintroduces per-component ring alphas,
  which DESIGN.md bans ("Never reintroduce per-component `focus-visible:ring-*` alphas").
- **Recommended Redesign:** selected row = `bg-secondary` + a 3px solid vermillion left cell border
  (`[&>td:first-child]:border-l-4 [&>td:first-child]:border-primary`); selected card = the
  `.surface-card` border switched to `border-primary` with the standard hard shadow.
- **Priority:** Medium

### 21. Disabled pagination buttons render a non-focusable `<span>`
- **File(s):** `components/merchant/customer-readback-table.tsx:671-701`
- **Current UX/UI Problem:** `<Button asChild={pagination.hasPrev} … disabled={!pagination.hasPrev}>`
  swaps between a `Link` and a bare `<span>Previous page</span>`. With `asChild=false` the `disabled`
  prop lands on a real `<button>` — but the child is a `<span>`, so the accessible name is fine while
  the element is removed from the tab order with no `aria-disabled` explanation of *why*.
- **Why It Is a Problem:** keyboard users tabbing through the pager skip an element whose presence
  they can see, with no state announced.
- **Recommended Redesign:** always render a `<Button disabled aria-disabled="true">` with plain text
  children (no `asChild`) for the inert case, and add
  `<span className="sr-only">, first page</span>`; or hide the control entirely at the boundaries and
  keep only "Page X of Y".
- **Priority:** Low

### 22. Five stacked control blocks precede the first member row
- **File(s):** `components/merchant/customer-readback-table.tsx:495-575`
- **Current UX/UI Problem:** in order: `StatStrip` (3 stats), search + `FilterPills` row (4 pills,
  `flex-wrap` so 2 lines on a phone), the multi-page honesty paragraph, the conditional scan banner
  (`surface-card … px-4 py-3`), then the list — inside a `grid min-w-0 gap-4`. On a 390px phone that
  is roughly 90 + 130 + 40 + 70 = **330px** of chrome, plus the page title above it.
- **Why It Is a Problem:** the merchant is on this page to find one person; a third of the first
  screen is meta.
- **Recommended Redesign:** merge `StatStrip` into the `FilterPills` counts (the pills already show
  `count` — `:536-541`), so the strip is redundant; put search and pills on one row at `sm+`
  (`sm:grid-cols-[minmax(0,20rem)_1fr]`, already half-done at `:512`); demote the scan banner to a
  `MonoTag` on the selected row.
- **Priority:** High

### 23. Three separate empty/edge states with three different treatments
- **File(s):** `components/merchant/customer-readback-table.tsx:462-489` ("Nothing on this page" /
  passthrough `emptyState`), `:577-583` ("No members match your filter"),
  `app/app/customers/page.tsx:131-145` (`EmptyState` with a CTA)
- **Current UX/UI Problem:** two of the three are bespoke
  `<div className="surface-card px-4 py-10 text-center">` blocks with an `<p className="text-sm
  font-semibold">` title, while the third uses the brand `EmptyState` (icon roundel, `p-6`,
  `EmptyTitle`). Different padding (`py-10` vs `p-6`), different type, no icon, and only one offers
  a recovery action.
- **Why It Is a Problem:** inconsistent voice at exactly the moments the merchant needs guidance;
  "No members match your filter" offers no "Clear filters" button despite naming the fix in prose.
- **Recommended Redesign:** use `EmptyState` for all three with `headingLevel={3}`, and give the
  filter case a real `actions={<Button onClick={clearFilters}>Clear filters</Button>}`.
- **Priority:** Medium

---

## 4. Invite customers (`/app/customers/invite`)

### 24. An 8-row textarea plus a 340px rail makes a ~1,900px first screen on mobile
- **File(s):** `components/merchant/invite-customers-form.tsx:76-149`, `:152-165` (`DeskLayout`),
  `:179-191` (`rows={8}`)
- **Current UX/UI Problem:** `DeskLayout` is
  `"grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-8"` — below `lg` the
  rail (`InvitationPreview` receipt card + the four-step `WhatHappensNext` list) stacks **below** the
  form. The form itself is a `rounded-lg border border-border bg-card p-4 sm:p-6` holding a
  `SectionHeader`, an 8-row textarea with a 3-line hint, a live count line, and a submit.
- **Why It Is a Problem:** on a phone the merchant scrolls past the entire compose form to reach the
  reassurance content that should have preceded the paste, then scrolls back. The 8-row textarea is
  ~200px of empty box before anything is typed.
- **Recommended Redesign:** `rows={5}` with `field-sizing-content` growth; hoist the invitation
  preview *above* the form on mobile (`order-first lg:order-none`) so the payoff is seen before the
  work; fold `WhatHappensNext` into a `<Disclosure label="How it works">` below `lg`.
- **Priority:** High

### 25. `border-[1.5px]` is used as a de-facto fourth border width
- **File(s):** `invite-customers-form.tsx:335`, `:358`, `:477`; also
  `offer-campaign-form.tsx:242`, `:382`, `:581`; `offers/page.tsx:152`, `:202`;
  `offer-rules-summary.tsx:152`; `reward-pool-form.tsx:594`; `loyalty-card-form.tsx:150`, `:317`
- **Current UX/UI Problem:** eleven call sites render selection tiles, radio cards, stat tiles and
  reward rows with `border-[1.5px]`. DESIGN.md states borders are **2px solid ink** everywhere, with
  2px dashed for empty/receipt rules; there is no 1.5px in the system.
- **Why It Is a Problem:** at 1.5px the ink hairline renders differently on 1x vs 2x displays and
  reads as a "cheap" third weight between the 1px `border-border` and the 2px ink; interactive
  choice tiles end up looking *less* substantial than the static cards around them.
- **Recommended Redesign:** global find-and-replace `border-[1.5px]` → `border-2`, and let the
  unselected state carry a low-alpha ink colour (`border-ink/25`) rather than a thinner stroke — the
  pattern `reward-pool-form.tsx:311-317` already uses correctly.
- **Priority:** Medium

### 26. The sent confirmation is a dead end
- **File(s):** `components/merchant/invite-customers-form.tsx:72-74`, `:491-505`
- **Current UX/UI Problem:** `if (state.message) return <SentConfirmation … />` replaces the whole
  form with a centred card — icon roundel, "Invitations queued", "Done.", and the message. There is
  no link, no button, no way back to Members, and no way to send another batch without a browser
  back or a nav tap.
- **Why It Is a Problem:** terminal state with no exit; the merchant's next natural action ("watch
  them arrive") is undiscoverable.
- **Recommended Redesign:** add an `actions` row — primary `Back to members`, secondary
  `Send another batch` (resets the action state) — and show the live campaign progress card
  (`CampaignStatusCard`, `:392-465`) instead of a static message, since the campaign is now
  "sending".
- **Priority:** High

### 27. Compliance radio tiles carry the legal weight but read as ordinary form rows
- **File(s):** `components/merchant/invite-customers-form.tsx:328-372`
- **Current UX/UI Problem:** the lawful-basis radios and the attestation checkbox are
  `border-[1.5px] border-border bg-card p-3` tiles with a native
  `className="mt-0.5 size-4 shrink-0 accent-[var(--w-ink)]"` control. A 16px native radio is below
  the 44px tap floor, and the checked state is only `has-checked:border-ink` — a border-colour
  change from 18%-alpha to full ink.
- **Why It Is a Problem:** these attestations are the GDPR gate for the whole feature; they need to
  be unmistakably answered. A 16px target and a subtle border swap fail both the tap-target floor and
  the "did I definitely select that" test.
- **Recommended Redesign:** keep the native input for semantics but scale it (`size-5`), give the
  label `min-h-11 p-3.5`, and make the checked state carry the full Wet Ink treatment:
  `has-checked:border-ink has-checked:bg-secondary has-checked:shadow-[var(--shadow-hard-sm)]`.
  Same fix applies to the identical markup in `offer-campaign-form.tsx:239-267`, `:382-398`, `:507`.
- **Priority:** High

---

## 5. Send a reward (`/app/customers/send-reward`)

### 28. 1px `border-border` cards on a 2px-ink system
- **File(s):** `app/app/customers/send-reward/page.tsx:54`, `:63`; also
  `reward-pool-form.tsx:238`, `offer-campaign-form.tsx:159`, `:179`, `:467`,
  `invite-customers-form.tsx:116`, `loyalty-card-form.tsx:98`, `launch/birthday-panel.tsx:30`
- **Current UX/UI Problem:** nine surfaces render `rounded-lg border border-border bg-card p-4 sm:p-6`
  — a 1px, 18%-alpha border with **no shadow** — while their siblings on the same screens use
  `.surface-card` / `ReceiptCard` (2px ink + 4px hard offset). On `/app/customers/send-reward` the
  page has two of these flat panels and nothing else, so the page reads as un-styled next to every
  other console page.
- **Why It Is a Problem:** two card grammars coexist across the console; the merchant sees "real"
  cards on the dashboard and ghost cards in the forms, which reads as unfinished rather than as
  hierarchy.
- **Recommended Redesign:** replace all nine with `ReceiptCard` (or `.surface-card` for plain
  elements) at `padding="md"`. Where a genuinely quieter surface is wanted, use
  `bg-secondary/40` inside a 2px-ink parent instead of thinning the border.
- **Priority:** High

### 29. Three different `<select>` treatments in one console
- **File(s):** `components/merchant/send-reward-form.tsx:122-136`
  (`h-12 rounded-lg border-2 border-ink bg-card px-3`), `components/merchant/loyalty-card-form.tsx:195-209`
  (`h-11 w-full rounded-lg border border-input bg-background px-3 text-sm`), vs the sanctioned
  `SelectField` used at `onboarding-form-fields.tsx:78-96` and `profile-form.tsx:93-105`
- **Current UX/UI Problem:** two hand-rolled native selects with different heights (48px vs 44px),
  different border weights (2px ink vs 1px input), different grounds (card vs background) and
  **no house chevron**, sitting next to `Field`/`TextareaField` inputs that all come from the themed
  `[data-slot=input]` well.
- **Why It Is a Problem:** DESIGN.md is explicit: *"Native selects compose through `SelectField`,
  which keeps the same input well and adds the house chevron."* The bare selects also inherit the OS
  arrow, breaking the print aesthetic, and the `border-input` one is nearly invisible on paper.
- **Recommended Redesign:** convert both to `SelectField` inside a `FormField` so label, hint,
  `aria-describedby` and error wiring come for free — and the hand-rolled `<label>` +
  `<p className="text-sm text-destructive">` error blocks at `send-reward-form.tsx:118-142` and
  `loyalty-card-form.tsx:188-219` disappear with them.
- **Priority:** High

### 30. "Recently sent" is an unbounded list with no empty state and no status legend
- **File(s):** `app/app/customers/send-reward/page.tsx:62-73`, `:78-93`
- **Current UX/UI Problem:** `getMerchantSentRewards` results render as an unpaginated `<ul>` of
  `bg-secondary px-3 py-2.5` rows; the section is simply omitted when empty (`sent.length > 0 ?`),
  and the `MonoTag tone={reward.statusTone}` labels have no key explaining what "Pending"/"Claimed"
  mean.
- **Why It Is a Problem:** a venue that sends weekly rewards gets an ever-growing page; a new venue
  gets no indication the history feature exists at all.
- **Recommended Redesign:** cap at 5 with a `Disclosure label="Older sent rewards"`, add an
  `EmptyState` ("Nothing sent yet") so the section is stable, and move the whole block into a
  right-hand rail at `lg+` (`lg:grid-cols-[minmax(0,1fr)_22rem]`) so the form and its history read
  side by side instead of stacked.
- **Priority:** Medium

---

## 6. Offers (`/app/offers`, `/new`, `/[id]/qr`)

### 31. Step pills are full circles, banned outside the stamp family
- **File(s):** `components/merchant/offer-campaign-form.tsx:571-600`
- **Current UX/UI Problem:** `StepTrack` renders each step as
  `"mono-meta rounded-full border-[1.5px] px-2.5 py-1"` with a `›` separator. DESIGN.md: *"Full
  circles are reserved for the stamp family… The mono pill `.w-tag` is the only generic pill shape
  outside the stamp family."*
- **Why It Is a Problem:** a stadium-shaped step chip competes visually with `MonoTag`/`w-tag`
  status pills that mean something entirely different, and the 1.5px border compounds finding #25.
  It also wraps to three lines on a phone (`flex flex-wrap`) with the `›` separators orphaned.
- **Recommended Redesign:** use `.w-tag` metrics with the 10px radius, and on mobile collapse to a
  single `Step 2 of 3 · Set the rules` line plus a 3-segment `Progress` bar — the wrapped pill
  cluster is ~70px of chrome above every step.
- **Priority:** Medium

### 32. The review step stacks two full StatusBanners plus a locked-terms card before the publish button
- **File(s):** `components/merchant/offer-campaign-form.tsx:458-543`
- **Current UX/UI Problem:** in order: optional "Offer saved" success banner, `SectionHeader`,
  `OfferRulesSummary` (7 dashed rows + a terms card), an **info** banner ("The link is the
  eligibility", 4 lines), a **neutral** banner ("New members only", 3 lines), an acknowledgement
  checkbox card, two buttons and a trailing paragraph — inside a `grid gap-5` on a
  `lg:grid-cols-[minmax(0,1fr)_360px]` with a full customer-landing preview in the second column.
- **Why It Is a Problem:** three consecutive banner tones (`success`, `info`, `neutral`) desensitise
  the merchant to banners right before the only irreversible action in the product. On a phone the
  publish button is roughly 1,400px down.
- **Recommended Redesign:** merge the two policy banners into two bullet lines inside the
  acknowledgement card (they *are* what is being acknowledged); keep exactly one banner slot for
  action outcomes. Make the publish row a sticky footer bar
  (`sticky bottom-0 -mx-4 border-t-2 border-ink bg-card/95 px-4 py-3`) so the commit control is
  always reachable while the merchant reads the readback.
- **Priority:** High

### 33. Lifecycle confirmations appear *above* the button that was pressed
- **File(s):** `components/merchant/offer-campaign-panel.tsx:268-416`
- **Current UX/UI Problem:** `LifecycleControls` renders the confirm `<form>` block first
  (`:272-354`), then the trigger row (`:356-390`), then the warning banner (`:392-415`). Pressing
  "End this offer" injects a "Yes, end this offer" submit button **above** the trigger and a warning
  banner **below** it, pushing the trigger row down mid-interaction.
- **Why It Is a Problem:** the confirm target moves away from the finger/pointer at the exact moment
  precision matters, on a destructive, irreversible action. It also means the warning explaining the
  consequence renders *after* the button that performs it, in DOM order.
- **Recommended Redesign:** render as one stable stack: trigger row → warning banner → confirm row,
  with the confirm control appended in place (never above the trigger). Better: use the shared
  `AlertDialog`/`Sheet` so the destructive confirmation is modal, focus-trapped and cannot be
  mis-clicked. Also reconsider `variant="destructive"` on **Rotate the link** (`:334`) — rotation is
  reversible-by-reprint, not destruction.
- **Priority:** High

### 34. Five metric tiles in a `grid-cols-2 lg:grid-cols-5` leave an orphan on every mid-size screen
- **File(s):** `components/merchant/offer-campaign-panel.tsx:428-454`
- **Current UX/UI Problem:** five `MetricTile`s at `grid-cols-2 lg:grid-cols-5`: from 320px to
  1023px that is 3 rows with a lone tile on row 3. Each tile also carries a `helper` sentence
  (`MetricTile` renders it in `CardContent`, `typography.tsx:171-175`), so the block is ~420px tall
  on a phone.
- **Why It Is a Problem:** ragged trailing row plus five explanatory sentences that repeat the
  caveat already stated in the paragraph at `:457-460` and elaborated in the `Disclosure` at `:461`.
- **Recommended Redesign:** `grid-cols-2 sm:grid-cols-3 xl:grid-cols-5` and drop the per-tile
  `helper` (keep it in the existing "How these are counted" disclosure) — that alone reclaims
  ~140px and makes the tiles scannable.
- **Priority:** Medium

### 35. The campaign QR page renders a full-bleed ink hero *and* the entire management panel again
- **File(s):** `app/app/offers/[campaignId]/qr/page.tsx:61-142`
- **Current UX/UI Problem:** the hero is
  `"grid justify-items-center gap-5 rounded-lg border-2 border-ink bg-ink p-6 text-paper sm:p-10"`
  wrapping a QR at `w-[min(80vmin,30rem)]` in a `rounded-2xl` frame (`:96`) — up to 480px of QR plus
  120–160px of section padding — and then re-renders `<OfferCampaignPanel>` in full below it
  (`:132-141`), including the rules summary, lifecycle controls and all five metric tiles.
- **Why It Is a Problem:** ~3 screens on a phone for a page whose stated job is *"the one screen a
  merchant holds up"*; the duplicated management panel means two identical "End this offer" controls
  exist on the same journey. `rounded-2xl` (18px) is also off-scale for a frame — 18px is reserved
  for sheets and large panels.
- **Recommended Redesign:** make this a genuine present-mode surface — the ink hero, the claim URL,
  the download button, and a single "Back to offers" link. Delete the second `OfferCampaignPanel`
  (or reduce it to a `Disclosure label="Manage this offer"`). Change `rounded-2xl` → `rounded-lg`.
- **Priority:** High

### 36. Offers hub explains the three benefit presets on every visit, forever
- **File(s):** `app/app/offers/page.tsx:132-170`
- **Current UX/UI Problem:** `OffersEmptyState` renders an `EmptyState` **and** a three-card "What an
  offer can give" grid **and** a trailing eligibility paragraph — shown to every venue with no live
  campaign, including one that has run six offers already (ended campaigns go to `OfferHistory`, so
  the empty state returns).
- **Why It Is a Problem:** first-run education becomes permanent noise; the "Create an offer" CTA is
  above ~300px of explanatory cards a returning merchant has read many times.
- **Recommended Redesign:** show the preset grid only when `history.length === 0`; otherwise render
  the `EmptyState` with the CTA plus the collapsed history. Alternatively wrap the grid in
  `<Disclosure label="What an offer can give" defaultOpen={history.length === 0}>`.
- **Priority:** Medium

---

## 7. Poster / QR asset kit (`/app/qr` + four print routes)

### 37. Four near-duplicate print routes with four different chromes
- **File(s):** `app/app/qr/poster/[template]/page.tsx` (114 lines),
  `app/app/qr/tent/[design]/page.tsx` (100), `app/app/qr/nfc/[design]/page.tsx` (139),
  `app/app/qr/nfc-square/[design]/page.tsx` (143); renderers
  `components/merchant/qr-poster/a4-poster.tsx`, `table-tent/a4-tent.tsx`,
  `nfc-card/a4-nfc-card.tsx`, `nfc-square/a4-nfc-square.tsx`
- **Current UX/UI Problem:** a diff of `tent` against `nfc` shows they differ only in the design
  lookup, the destination URL and the error copy — the load / notFound / render-PNG / error-fallback
  skeleton is byte-identical. But the *chrome* has diverged badly: `A4Poster` gets
  `PosterPreviewChrome` (sticky header with back, title, sidebar trigger, print CTA, a guidance
  toggle, and a horizontally scrolling **template switcher**), a `PosterDesktopSidecar` and a sticky
  `PosterActionBar`; `A4Tent` gets a bespoke `styles.chrome` header with a Back button and a
  `variant="reward"` print button, **no design switcher, no guidance, no sidecar, no action bar**.
- **Why It Is a Problem:** switching between poster designs is one tap; switching between tent
  designs requires navigating back to `/app/qr`, scrolling to the tent lane, and opening another
  tab (all four lanes use `target="_blank"`). Four maintenance surfaces for one job, and the print
  CTA changes variant, size and position depending on which asset you opened.
- **Recommended Redesign:** one route — `/app/qr/print/[kind]/[design]` — with `kind ∈ {poster, tent,
  nfc, nfc-square}` driving a shared registry (the `poster-renderer-registry.tsx` pattern already
  exists). One `PrintPreviewChrome` with a **kind tab row** (Poster · Tent · NFC card · NFC plate)
  above the existing design strip, one sidecar, one action bar, one error component.
- **Priority:** Critical

### 38. Tent / NFC / NFC-square print previews double-stack headers on mobile
- **File(s):** `lib/navigation/merchant-shell.ts:19-21`, `components/layout/merchant-app-shell.tsx:58`,
  `components/merchant/qr-poster/table-tent/a4-tent.tsx:52-79`
- **Current UX/UI Problem:** `isPosterPrintPath` matches only `"/app/qr/poster/"`. The tent, NFC and
  NFC-square routes therefore keep the shell's `md:hidden` sticky header (trigger + logo, `min-h-14`)
  **and** render their own `styles.chrome` header with Back + Print — two stacked sticky bars above a
  scaled A4 sheet on a phone, and the tent's own scaler measures only its stage width, not the
  shell chrome height.
- **Why It Is a Problem:** ~110px of the phone viewport is header before the artwork begins; the
  sheet under-scales or scrolls under the shell bar. The poster route, which does suppress the shell
  chrome, looks and behaves differently from its three siblings.
- **Recommended Redesign:** widen the predicate to
  `path.startsWith("/app/qr/poster/") || path.startsWith("/app/qr/tent/") || path.startsWith("/app/qr/nfc/") || path.startsWith("/app/qr/nfc-square/")` —
  or better, derive it from a single `/app/qr/print/` prefix once finding #37 lands.
- **Priority:** High

### 39. The print channel dumps four asset lanes into one endless column
- **File(s):** `components/merchant/launch/qr-redesign-concept.tsx:179-237`,
  `qr-redesign-concept-parts.tsx:178-314`
- **Current UX/UI Problem:** selecting "Print for the till" renders, in one
  `lg:grid-cols-[minmax(0,1.1fr)_minmax(16rem,0.9fr)]` column: the poster picker (8 templates in a
  horizontally scrolling strip, then a `lg:grid` stack), the `PosterProof` preview aside,
  `TableTentLinks` (`lg:col-span-2`, `border-t-2 pt-5`), `NfcCardLinks` (same), `NfcSquareLinks`
  (same), the promo notice and the email button. Each lane is a heading + description + a
  `sm:grid-cols-2 lg:grid-cols-3` grid of `min-h-14` links.
- **Why It Is a Problem:** at 390px that section alone is roughly **2,400px**; the merchant scrolls
  past three lanes they did not ask for to reach the one they did. Every lane also opens in a new
  tab (`target="_blank" rel="noreferrer"`), so the back path is a tab close.
- **Recommended Redesign:** replace the three stacked `border-t-2` lanes with a single asset-type
  tab row (`Posters · Table tents · NFC cards · Wall plates`) driven by the same
  `workspaceHref(base, channel, template)` query pattern already in use — one lane visible at a
  time, ~600px instead of 2,400px. Keep `target="_blank"` only for the final print sheet.
- **Priority:** Critical

### 40. The QR workspace hero repeats the venue QR the dashboard already showed
- **File(s):** `components/merchant/launch/qr-redesign-concept.tsx:81-144`
- **Current UX/UI Problem:** a `surface-card` with its own `border-b-2 bg-paper-deep/55 p-4 sm:p-6`
  header (eyebrow, `text-2xl sm:text-3xl` h2, description, status tag, status action), then a
  `lg:grid-cols-[minmax(15rem,0.7fr)_minmax(0,1.3fr)]` body with a `max-w-[18rem]` QR in a 6px-offset
  frame, a caption, an eyebrow, an h3, a paragraph, a dashed link well and two buttons — before the
  distribution section even starts.
- **Why It Is a Problem:** it is a second, larger copy of `DashboardQrCard` (finding #12), on a page
  the merchant reached *specifically* to print something. The h2 "Launch your counter QR" also
  contradicts the `PageTitle` h1 "Venue QR" directly above it (`app/app/qr/page.tsx:35-39`).
- **Recommended Redesign:** collapse the hero to a single `grid-cols-[auto_minmax(0,1fr)_auto]`
  status strip — 96px QR, venue name + status tag, Copy + Pause controls — and let the distribution
  picker be the page. Remove the duplicated h2.
- **Priority:** High

### 41. Four copies of one render-error surface
- **File(s):** `app/app/qr/poster/[template]/page.tsx:83-106`,
  `tent/[design]/page.tsx:69-…`, `nfc/[design]/page.tsx:86-…`, `nfc-square/[design]/page.tsx`
- **Current UX/UI Problem:** each route defines its own `…RenderError` returning the identical
  `<main className="grid min-h-dvh place-items-center bg-[var(--w-paper)] p-6">` +
  `ReceiptCard max-w-md` + `PageTitle titleClassName="sm:text-2xl"` + `StatusBanner tone="error"` +
  outline Back button, differing only in the noun ("Poster"/"Tent"/"Card").
- **Why It Is a Problem:** four places to fix a copy or a11y change; already drifting (the NFC route
  adds a second `NfcCardReviewSetupError` variant, `nfc/[design]/page.tsx:86-113`).
- **Recommended Redesign:** one `<PrintAssetError kind={…} reason={…} backHref={…} />` component in
  `components/merchant/qr-poster/`.
- **Priority:** Low

---

## 8. Setup / launch hub (`/app/launch`) and readiness

### 42. The launch page renders its heading block twice
- **File(s):** `app/app/launch/page.tsx:84-99`
- **Current UX/UI Problem:** a mobile-only block
  (`<div className="grid gap-1 sm:hidden">` with an eyebrow, an `h1` and a context paragraph) and a
  `<div className="hidden sm:grid">` wrapping the full `PageTitle` — both always in the DOM, both
  carrying the page heading, differing only in copy (`header.mobileContext` vs
  `header.description`).
- **Why It Is a Problem:** two heading sources to keep in sync, duplicated text for crawlers and
  screen-reader "list all headings" (only one renders visually, but the pattern is fragile), and a
  bespoke `text-2xl` h1 that does not match `PageTitle`'s `text-3xl sm:text-4xl` — so the heading
  size *jumps* at the `sm` boundary by two steps.
- **Recommended Redesign:** one `PageTitle` with `descriptionClassName="hidden sm:block"` plus a
  mobile-only short line, or pass a responsive description. Let `PageTitle` own the h1 at every
  breakpoint.
- **Priority:** Medium

### 43. The readiness panel states the same progress three ways at once
- **File(s):** `components/merchant/launch-readiness-panel.tsx:140-293`
- **Current UX/UI Problem:** inside one `ReceiptCard` the panel can render: a `MonoTag`
  "N of M complete" in the header (`:155-157`), a mobile `Progress` bar + a second `MonoTag` "N / M"
  (`:182-195`), the `LaunchStepRail` (5 stamps with state captions), the desktop `<ol>` of 5 step
  links each with a stamp + label + "Ready/Next up/To do" caption (`:212-268`), a `ProgressTrack`
  with its own "Setup progress" label (`:271-276`), **and** an ink CTA strip repeating
  "Next up: …" (`:278-292`). That is up to six representations of a five-item checklist.
- **Why It Is a Problem:** the file is 545 lines for one checklist; on a phone the launch hub spends
  ~300px on progress chrome before the active panel starts, and the merchant sees "3 of 5" three
  times in three type registers.
- **Recommended Redesign:** one representation per breakpoint. Mobile: the sticky step rail +
  a single 4px `Progress` bar. Desktop: the 5-step `<ol>` (the stamps already encode state) + the
  next-step CTA. Delete the `ProgressTrack` and the duplicate `MonoTag`. Target ≤250 lines.
- **Priority:** High

### 44. The launch flow has two competing "next step" CTAs on the same screen
- **File(s):** `components/merchant/launch-readiness-panel.tsx:278-292` (ink CTA strip) and
  `components/merchant/launch/launch-flow-footer.tsx:8-33` (rendered at
  `app/app/launch/page.tsx:210`)
- **Current UX/UI Problem:** the readiness card ends with a full-width ink strip "Next up: X" +
  button, and the page ends with a `surface-card bg-muted` footer reading "Next step / Keep your
  setup moving" + a button. Both link to the resolved next tab.
- **Why It Is a Problem:** the merchant cannot tell whether these are the same action; the footer's
  copy ("Keep your setup moving") carries no information the strip has not already given.
- **Recommended Redesign:** keep exactly one. The footer is better placed (bottom of the panel the
  merchant just completed) — so suppress the readiness strip whenever `tabMode` is on (the panel
  already has that flag at `:92`) and let `LaunchFlowFooter` be the single forward action, labelled
  with the concrete next step.
- **Priority:** Medium

### 45. Onboarding puts a 6-field address form and a roadmap aside in an awkward 3-child grid
- **File(s):** `app/app/onboarding/page.tsx:25-46`,
  `components/merchant/onboarding-journey-orientation.tsx:27`
- **Current UX/UI Problem:** the page is
  `"mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(0,1fr)_320px]"` with **three** children.
  The roadmap `<aside>` pins itself with `lg:col-start-2 lg:row-span-2 lg:row-start-1`, so the layout
  only works by explicit placement — remove that class and the form jumps into the 320px column. The
  first child is a `ReceiptCard` whose only always-visible content is the `PageTitle`, because the
  summary line inside it is `lg:hidden` (`onboarding-journey-orientation.tsx:16`). On desktop it is a
  receipt card containing a heading and nothing else.
- **Why It Is a Problem:** fragile implicit placement, and a card whose payload disappears at the
  breakpoint where it has the most room.
- **Recommended Redesign:** make the placement explicit and robust — a two-column grid with a single
  left `<div className="grid gap-4">` holding title + form, and the aside as the second child. Drop
  the ReceiptCard around the title (a `PageTitle` does not need a card) and let the roadmap show at
  every breakpoint, collapsing into a `Disclosure` below `lg`.
- **Priority:** Medium

### 46. The onboarding form validates only on submit and commits with one full-width button
- **File(s):** `components/merchant/onboarding-form.tsx:216-345`
- **Current UX/UI Problem:** validation is an `onSubmit` sweep of five required fields
  (`:221-252`) that `preventDefault`s, sets `clientErrors`, and focuses the first invalid input. There
  is no blur-time validation, no per-field success state, and the postcode/city fields never format.
  The submit is `<Button type="submit" disabled={pending} aria-busy={pending} className="w-full">`
  with a manual `{pending ? "Saving…" : "Finish setup"}` — not the documented `SubmitButton`.
- **Why It Is a Problem:** the merchant fills six fields, presses the one button, and is thrown back
  up the form; on a phone the focused field may be off-screen behind the keyboard. `SubmitButton`
  would give `aria-busy`, the `Spinner` and the disabled state for free and consistently.
- **Recommended Redesign:** validate required fields on `blur` (keeping the submit sweep as the
  backstop), render a summary `Alert` listing the invalid fields with anchor links above the
  submit, and swap the button for `<SubmitButton pendingLabel="Saving…">Finish setup</SubmitButton>`.
- **Priority:** Medium

### 47. The reward-pool form is an endless scroll with a fixed bottom bar and a padding hack
- **File(s):** `components/merchant/reward-pool-form.tsx:235-532`
- **Current UX/UI Problem:** one `<section>` renders: header + counter tag, an sr-only status, a
  helper paragraph, a preset well containing up to 9 dashed tiles in `sm:grid-cols-2
  lg:grid-cols-3`, a selection bar, a feedback paragraph, an empty state, the reward list, and an
  "Add a reward" dashed button. The selection bar is
  `"fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 … sm:static"` — a fixed
  overlay on mobile that becomes a static row at `sm` — and the section compensates with
  `selectedPresetIds.length > 0 && editingId === null && "pb-[8.75rem] sm:pb-6"`, a hard-coded
  140px spacer whose value is coupled to the bar's rendered height.
- **Why It Is a Problem:** the spacer is guesswork (two lines of copy + a two-button row wraps
  differently at 320px), so the last reward row can sit under the bar; the whole surface is
  ~1,700px on a phone; and this is the launch-blocking step, so height directly costs activation.
- **Recommended Redesign:** wrap the presets in `<Disclosure label="Reward ideas" defaultOpen={items.length === 0}>`
  so returning merchants see their pool first; make the selection bar a real sticky footer
  (`sticky bottom-0 -mx-3 border-t-2 border-ink bg-card/95 px-3 py-2.5`) so it participates in flow
  and the `pb-[8.75rem]` hack disappears; shorten the bar to one line
  ("+3 selected → 5 active") with the two buttons inline.
- **Priority:** High

### 48. The reward pool mixes four radii, three border weights and a bespoke pending label
- **File(s):** `reward-pool-form.tsx:238` (`rounded-lg border border-border`), `:594`
  (`rounded-lg border-[1.5px]`), `:713` (`rounded-2xl` on the active toggle), `:784`
  (`rounded-lg border-2 border-ink … shadow-sm`), `:846-848`
- **Current UX/UI Problem:** the section uses a 1px border, reward rows use 1.5px, the active/off
  switch is `rounded-2xl` (18px — the *sheet* radius) at `h-5`, and the open editor uses 2px ink with
  `shadow-sm`. The editor's submit is `<Button type="submit" disabled={pending}>{pending ? "Saving…"
  : …}</Button>` instead of `SubmitButton`, so it announces no `aria-busy` and shows no `Spinner`.
- **Why It Is a Problem:** an 18px radius on a 20px-tall pill makes it a full stadium — the shape
  DESIGN.md reserves for stamps/tags — and it sits directly beside a 6px-radius icon button
  (`:636`, `rounded-md`). Four radii in one card is visual noise on the launch-critical step.
- **Recommended Redesign:** section → `ReceiptCard`; rows → `border-2 border-ink/25`; the toggle →
  `.w-tag` metrics (already referenced in the comment at `:707`) at the 10px radius; the editor's
  submit → `<SubmitButton pendingLabel="Saving…">`.
- **Priority:** Medium

### 49. Only one long console form has a sticky save bar
- **File(s):** `components/merchant/loyalty-card-form.tsx:235-239` (has one) vs
  `venue-location-form.tsx:188-190`, `profile-form.tsx:141`, `onboarding-form.tsx:336-343`,
  `announcement-compose.tsx:260-268` (none)
- **Current UX/UI Problem:** the card form wraps its submit in
  `"sticky bottom-3 z-10 border-t border-border/80 bg-card/95 pt-3 backdrop-blur-sm sm:static …"`.
  The venue form (address + Google autocomplete + GPS disclosure, ~1,400px), the profile form, the
  onboarding form and the announcement composer all end with a plain button at the bottom of the
  scroll.
- **Why It Is a Problem:** inconsistent commit affordance across sibling forms in the same console;
  on the venue form the merchant edits a field near the top and has no idea a save exists without
  scrolling. The one sticky bar also uses a 1px `border-border/80` top rule, off-system.
- **Recommended Redesign:** extract a `<FormActionBar>` (sticky at `<sm`, static at `sm+`, 2px ink
  top rule, `bg-card/95`, safe-area padding) and use it on every merchant form longer than one
  viewport. Add a dirty-state indicator ("Unsaved changes") in its left slot.
- **Priority:** Medium

### 50. The card builder's stepper and preset row are three different selection grammars
- **File(s):** `components/merchant/loyalty-card-form.tsx:123-175`, `:280-332`
- **Current UX/UI Problem:** "Visits to reveal" offers (a) a `Stepper` — an
  `inline-flex … rounded-lg bg-secondary` group with `min-h-9 w-11` −/+ buttons and a
  `border-x-[1.5px]` readout — and (b) three cadence preset cards
  (`min-h-16 rounded-lg border-[1.5px]`, selected = `border-ink bg-ink text-paper shadow-sm`), and
  (c) a hint paragraph that changes with the preset. The stepper buttons are `min-h-9` (36px) on fine
  pointers, growing only via `[@media(pointer:coarse)]:min-h-11`.
- **Why It Is a Problem:** two controls for one value with no visual link between them (changing the
  stepper does not visibly deselect a preset card unless the number happens to differ); the inverted
  ink-fill selected preset is a heavier treatment than the primary submit button below it.
- **Recommended Redesign:** make the presets the primary control (three `min-h-14` tiles with the
  count as the large numeral) and demote the stepper to a small "or choose a custom number" row
  beneath, with an `aria-describedby` linking them. Selected preset = 2px ink border + `bg-secondary`
  + a check glyph, not a full ink fill.
- **Priority:** Medium

---

## 9. Activity (`/app/activity`)

### 51. Activity cards lift on hover but are not clickable
- **File(s):** `components/merchant/activity-detail-card.tsx:28`
- **Current UX/UI Problem:** the `<article>` carries
  `"group/activity surface-card border-ink px-4 py-3 transition-[border-color,box-shadow,transform] … hover:-translate-y-0.5"`.
  The card itself has no click handler or link — only the optional `primaryAction` button inside it
  does (`:54-65`).
- **Why It Is a Problem:** a hover lift is the system's strongest "this is pressable" signal (it is
  used on real links in `qr-redesign-concept-parts.tsx:202`, `:249`, `:296`). Applying it to an inert
  card trains the merchant to click things that do nothing.
- **Recommended Redesign:** remove the transform, or make the whole card a link to the row's
  detail target where one exists (the row model already carries `primaryAction.href`), using a
  stretched-link overlay so the inner button stays independently focusable.
- **Priority:** Medium

### 52. "Load more" grows the list by 50 with no ceiling feedback and no virtualisation
- **File(s):** `components/merchant/activity-detail-feed.tsx:307-329`,
  `app/app/activity/page.tsx:121-127`
- **Current UX/UI Problem:** `loadMoreHref` sets `limit = limit + 50`, and the page clamps at 250.
  Each press re-renders the whole grouped timeline; the footer only says "N events loaded, more
  available." There is no indication that 250 is the wall, and no jump-to-top after a load.
- **Why It Is a Problem:** at 250 rows the page is roughly 25,000px of DOM with a `WetInkRise`
  wrapper per date group; the merchant loses their scroll anchor on each load, and hitting the
  invisible 250 ceiling reads as a bug.
- **Recommended Redesign:** switch to date-window paging ("Older activity →" by week) or add
  `?before=<cursor>` paging; keep the loaded window to ~50 rows. Announce the ceiling explicitly
  when reached, and add a "Back to top" control in the footer.
- **Priority:** Medium

### 53. The search + filter block is duplicated between Activity and Members
- **File(s):** `activity-detail-feed.tsx:127-180` vs `customer-readback-table.tsx:512-543`
- **Current UX/UI Problem:** both render the same composition by hand — an absolutely positioned
  `Icon icon={Search01Icon} size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 …"`
  over an `<Input type="search" className="pl-9">`, followed by `FilterPills className="flex-wrap"`
  and a `role="status"` count line. The two differ in wrapper (`surface-card p-3 sm:p-4` vs a bare
  grid), in whether search writes to the URL (Activity debounces to the router; Members does not),
  and in the count wording ("N shown from M" vs "Showing members A–B of C").
- **Why It Is a Problem:** two near-identical toolbars that behave differently; a merchant learns
  that search "sticks" on one page and not the other.
- **Recommended Redesign:** extract `<ConsoleFilterBar search={…} pills={…} resultLabel={…} />` into
  `components/data/`, URL-backed by default, and use it on both pages (and any future console list).
- **Priority:** Medium

---

## 10. Announcements (`/app/announcements`)

### 54. The composer fights its own surface class
- **File(s):** `components/merchant/announcements/announcement-compose.tsx:146-149`
- **Current UX/UI Problem:** the form className is
  `"surface-card grid min-w-0 gap-5 rounded-lg border-2 border-ink bg-card p-4 shadow-xs sm:p-5"`.
  `.surface-card` (globals.css:313-319) already sets the 2px ink border, the 10px radius, the card
  ground **and** `box-shadow: var(--shadow-md)` (4px hard offset). The utility then restates three of
  those and overrides the elevation down to `shadow-xs`.
- **Why It Is a Problem:** the composer sits at a different elevation from every other console card
  for no stated reason, and the redundant classes hide that fact from anyone reading the file.
- **Recommended Redesign:** `className="surface-card grid min-w-0 gap-5 p-4 sm:p-5"`. If a flatter
  tile is genuinely wanted, use the sanctioned `data-elevation="flat"` recipe on a `Card`.
- **Priority:** Low

### 55. Character counters are decorative, and the limit is enforced silently
- **File(s):** `announcement-compose.tsx:209-251`
- **Current UX/UI Problem:** each field pairs a `<Label>` with
  `<span className="numeric-tabular text-xs font-semibold text-muted-foreground">{title.length}/{TITLE_LIMIT}</span>`,
  wired via `aria-describedby`. The counter never changes colour approaching the limit, and both
  controls use `maxLength` so typing simply stops at 80/180 characters with no message.
- **Why It Is a Problem:** a merchant pasting a longer message loses the tail without being told; the
  counter is announced only when the field receives focus, not as it changes.
- **Recommended Redesign:** make the counter a live region (`aria-live="polite"`) that turns
  `text-destructive` in the last 10%, and replace the hard `maxLength` with soft validation + a
  `FormMessage` ("Trim 12 characters") so the paste survives and the merchant edits it.
- **Priority:** Medium

### 56. The disabled Send button never says why
- **File(s):** `announcement-compose.tsx:105-110`, `:260-268`
- **Current UX/UI Problem:** `canSubmit` is a conjunction of five conditions (eligible audience,
  under the daily limit, non-empty title, non-empty body, not pending). When false the button
  renders `variant="secondary" disabled` with no `aria-describedby` pointing at a reason. Two of the
  five reasons *do* get banners (no audience, daily limit) but the other three are silent.
- **Why It Is a Problem:** a disabled primary action with no stated cause is the classic dead-end;
  screen-reader users get "Send announcement, dimmed" and nothing more.
- **Recommended Redesign:** keep the button enabled and validate on submit (surfacing a
  `FormMessage` under the offending field), or keep it disabled with
  `aria-describedby="send-blocked-reason"` and a visible one-line reason next to it.
- **Priority:** Medium

---

## 11. Account, profile and billing

### 57. The account tab bar is styled as a primary CTA
- **File(s):** `components/merchant/account/account-tab-bar.tsx:17-38`
- **Current UX/UI Problem:** the active tab is
  `"bg-primary text-primary-foreground"` inside a `rounded-lg border-2 border-ink bg-card p-1
  shadow-sm` island, with inactive tabs as plain muted text. There are only two tabs (Profile,
  Billing) and they use `auto-cols-fr grid-flow-col` full width on mobile.
- **Why It Is a Problem:** same issue as finding #7 — the filled vermillion is the action ink, and a
  full-width filled block at the top of the page reads as "press me" rather than "you are here".
  With two tabs, a full-width segmented control is also more chrome than the choice warrants.
- **Recommended Redesign:** underline-style tabs (2px ink bottom rule on the active item, ink-soft
  labels otherwise), `sm:inline-flex` at every breakpoint, and consider merging the two panels into
  one scrollable Account page with anchor links given how short the Profile panel is.
- **Priority:** Medium

### 58. Billing receipt rows use 1px borders and a `py-1` container
- **File(s):** `components/merchant/account/billing-panel-view.tsx:284-288`, `:326-359`
- **Current UX/UI Problem:** both `<dl>`s are
  `"grid gap-0 rounded-lg border border-border bg-secondary/40 px-3 py-1 text-sm"` — a 1px border and
  4px of vertical padding around a stack of `PlanRow`s, sitting inside a `ReceiptCard edge`.
- **Why It Is a Problem:** this is the money surface; the thinnest border in the system and almost
  no internal padding makes it read as an afterthought. `py-1` also means the first and last rows'
  dashed separators sit flush against the container edge.
- **Recommended Redesign:** `.w-rule` dashed separators on a transparent ground with `py-2` rows —
  i.e. an actual receipt block inside the receipt card — or `border-2 border-ink/20 px-4 py-2`.
- **Priority:** Medium

### 59. `StatusBanner` titles smuggle `<h2>` elements into banners
- **File(s):** `billing-panel-view.tsx:124`, `:262`, `:290`, `:371`
- **Current UX/UI Problem:** four call sites pass `title={<h2>Billing details could not be loaded</h2>}`
  into the banner's title slot, while every other console banner passes a string
  (e.g. `qr-panel.tsx:79`, `offer-campaign-panel.tsx:107`).
- **Why It Is a Problem:** a transient error notice becomes a document-outline heading, and the
  billing tab's heading structure changes depending on whether Stripe returned an error. The
  `StatusBanner` presumably styles its title slot, so the injected `h2` also inherits an unintended
  size.
- **Recommended Redesign:** pass plain strings; if the banner genuinely needs a heading role, add a
  `headingLevel` prop to `StatusBanner` and set it once.
- **Priority:** Medium

### 60. Off-scale `rounded-xl` on profile feedback and scan detail lists
- **File(s):** `components/merchant/profile-form.tsx:127`, `:136`;
  `app/app/rewards/scan/[scanToken]/page.tsx:110`;
  `app/app/offers/scan/[passToken]/page.tsx:114`
- **Current UX/UI Problem:** the profile form's error and success paragraphs use
  `rounded-xl border border-destructive/30` / `rounded-xl border border-reward/30`, and both scan
  pages render their member/card `<dl>` as `rounded-xl border-2 border-ink bg-card p-4`. `--radius-xl`
  is 14px — between the 10px card radius and the 18px sheet radius, and used nowhere else in the
  console.
- **Why It Is a Problem:** a fourth radius introduced in four places; on the scan pages the 14px
  detail box sits directly beneath a `RewardTicket`/`ReceiptCard` at 10px, so the mismatch is
  visible in a single glance.
- **Recommended Redesign:** `rounded-lg` everywhere; replace the profile form's hand-rolled feedback
  paragraphs with `Alert`/`StatusBanner`, which already carry the 2px ink contract.
- **Priority:** Low

### 61. `min-h-11 w-full sm:w-fit` is pasted onto buttons that are already 44px tall
- **File(s):** `billing-panel-view.tsx:194`, `:202`, `:216`, `:306`, `:379`;
  `activity-detail-feed.tsx:221`; `activity-detail-card.tsx:59`;
  `activity-compact-feed.tsx:52`; `customer-readback-table.tsx:300`, `:316`;
  `poster-preview-chrome.tsx:77`; `table-tent/a4-tent.tsx:57`, `:74`
- **Current UX/UI Problem:** twelve-plus call sites re-assert the tap floor by hand, in three
  different dialects: `min-h-11`, `min-h-11 sm:min-h-9`, and
  `[@media(pointer:coarse)]:min-h-11`. DESIGN.md states compact button sizes are already
  *"honest — they render at their declared height on fine pointers and grow to the 44px floor on
  coarse (touch) pointers"*, so `Button size="sm"` should need none of this.
- **Why It Is a Problem:** if the Button variant's coarse-pointer growth is working, these are
  no-ops that also break the honest compact height on desktop (a `min-h-11` `size="sm"` button is a
  44px button pretending to be small). If it is not working, the fix belongs in one place.
- **Recommended Redesign:** verify the `size` variants' coarse-pointer floor once, then delete every
  hand-written `min-h-11` from call sites. Where a button truly must be full-height, use
  `size="default"`.
- **Priority:** Medium

### 62. The cancellation page is a single card with a full-width secondary escape
- **File(s):** `app/app/account/cancel/page.tsx:22-42`
- **Current UX/UI Problem:** `PageTitle` + one `ReceiptCard edge padding="md" className="gap-5"`
  containing the interview form and, at the bottom, `Button asChild variant="secondary"
  className="w-full sm:w-fit"` → "Back to billing". When `cancellable` is false the card shows one
  muted sentence and the same full-width button.
- **Why It Is a Problem:** the "stay" path (Back to billing) is the outcome the product wants, yet it
  is a secondary control below the fold of a form; and the non-cancellable state renders a nearly
  empty card rather than an `EmptyState` with a clear next step.
- **Recommended Redesign:** put "Back to billing" in the `PageTitle` actions slot (visible on
  arrival), use `EmptyState` for the non-cancellable branch, and keep the destructive continue
  action at the form's foot with the outline-danger silhouette.
- **Priority:** Low

---

## 12. Counter scanning (`/app/scan`, `/app/rewards/scan/*`, `/app/offers/scan/*`)

### 63. The scan page breaks the console's column width and puts an `h1` inside a card
- **File(s):** `app/app/scan/page.tsx:12-16`, `components/merchant/merchant-reward-scanner.tsx:21-34`,
  `:270-306`
- **Current UX/UI Problem:** the page is `<div className="mx-auto w-full max-w-xl">` (576px) inside
  a shell that already constrains to `max-w-merchant` (1152px), and the page's only heading is
  `ScanCardHeader`'s `<h1 className="text-3xl leading-tight font-extrabold tracking-[-0.01em]
  sm:text-4xl">` rendered **inside** the `ReceiptCard`. Every other console route puts the `PageTitle`
  above the card.
- **Why It Is a Problem:** navigating from `/app` (1152px, title outside) to `/app/scan` (576px,
  title inside a card) is a jarring layout jump on desktop, and it means the scan page has no page
  chrome the merchant can orient by.
- **Recommended Redesign:** render a normal `PageTitle` above a `max-w-xl` centred scanner card, and
  reduce the in-card header to an `Eyebrow` + status line. Keep the `h1` at page level.
- **Priority:** Medium

### 64. Camera failure offers only "Try again" — no manual code entry
- **File(s):** `components/merchant/merchant-reward-scanner.tsx:90-105`, `:284-301`
- **Current UX/UI Problem:** the four camera error reasons are well written, but the only recovery
  control is a `Try again` button plus a `Back to dashboard` link. There is no way to type or paste
  the customer's reward code, no torch toggle, and no camera-picker for devices with several
  cameras. The viewfinder itself is a `min-h-64` dashed box with no framing guide beyond the library's
  `qrbox`.
- **Why It Is a Problem:** in a dim bar with a denied permission (a very common state on a shared
  tablet), the merchant is completely blocked from honouring a reward the customer is standing there
  holding.
- **Recommended Redesign:** add a persistent secondary path — "Enter the code instead" opening a
  short numeric/`inputMode="text"` field that resolves the same
  `normalizeScannedRewardDestination` route — plus a torch toggle where
  `MediaStreamTrack.applyConstraints({advanced:[{torch:true}]})` is supported.
- **Priority:** High

### 65. Both scan detail pages stack full-width buttons in a grid
- **File(s):** `app/app/rewards/scan/[scanToken]/page.tsx:145-152`, `:157-167`;
  `app/app/offers/scan/[passToken]/page.tsx:145-152`, `:201-212`
- **Current UX/UI Problem:** `ScanShell` renders `<section className="grid gap-4">` and the buttons
  are direct grid children, so they stretch full width and stack — "Scan another reward" (primary)
  above "Back to dashboard" (secondary), each ~44px + 16px gap. The two files are otherwise
  near-identical shells (`PageTitle` + `max-w-xl` + a `grid gap-4` section), duplicated rather than
  shared.
- **Why It Is a Problem:** two full-width buttons of equal size at the end of a counter flow read as
  equal-weight choices; and any change to the shell has to be made twice.
- **Recommended Redesign:** wrap the actions in `<div className="flex flex-wrap gap-2">` so the
  primary sizes to its content and the secondary reads as an escape; extract the shared
  `<CounterScanShell>` used by both routes.
- **Priority:** Low

---

## 13. Skeletons, loading and error surfaces

### 66. The generic route skeleton is a page title only, so every route "pops in"
- **File(s):** `app/app/loading.tsx:7-16`, vs the structural skeletons in
  `components/merchant/loading-skeletons.tsx`
- **Current UX/UI Problem:** `/app/*` route transitions render `MerchantPageTitleSkeleton` alone — one
  eyebrow bar, one title bar, one description bar, one action block. Every page then streams its own
  structural skeleton *inside* Suspense. So a navigation shows: title skeleton → real title +
  section skeleton → content. Three layout states per navigation.
- **Why It Is a Problem:** the comment at `:3-6` calls this "a single predictable step", but in
  practice the merchant sees the page height jump twice. On `/app/customers` the difference between
  a lone title skeleton and the real page (StatStrip + toolbar + 50 rows) is thousands of pixels.
- **Recommended Redesign:** give the high-traffic routes their own `loading.tsx` composed from the
  existing structural skeletons (`MerchantCustomersTableSkeleton`, `ActivityFeedSkeleton`,
  `OfferCampaignPanelSkeleton`) so the route fallback and the stream fallback are the same shape —
  `app/app/scan/loading.tsx:11-29` already does exactly this and is the model to copy.
- **Priority:** Medium

### 67. The console error boundary offers one action and no support path
- **File(s):** `app/app/error.tsx:16-30`
- **Current UX/UI Problem:** `min-h-[50vh] … max-w-2xl` `EmptyState` with a single `Try again`
  button. No "Back to dashboard", no error digest surfaced, no contact route — despite the
  boundary rendering inside the shell where nav is available.
- **Why It Is a Problem:** if `reset()` fails twice the merchant has nowhere to go but the browser
  back button, and support has no reference to ask for.
- **Recommended Redesign:** add a secondary `Back to dashboard` link and print the `error.digest` as
  `mono-id` text ("Reference: abc123") so a merchant can quote it. `min-h-[50vh]` is also an
  arbitrary viewport unit inside a padded shell — `py-16` is enough.
- **Priority:** Low

---

## Cross-cutting patterns (repeated offenders)

1. **Two card grammars.** `.surface-card` / `ReceiptCard` (2px ink + hard shadow) vs
   `rounded-lg border border-border bg-card p-4 sm:p-6` (1px, no shadow) — the latter in 9 places
   (`send-reward/page.tsx:54,63`, `reward-pool-form.tsx:238`, `offer-campaign-form.tsx:159,179,467`,
   `invite-customers-form.tsx:116`, `loyalty-card-form.tsx:98`, `birthday-panel.tsx:30`). Every one
   of them is a *form* surface, so the console's most important screens are its least-styled.
2. **`border-[1.5px]` as a phantom third border weight** — 11 call sites (finding #25). Always on
   selectable tiles, i.e. exactly where the ink contract should be loudest.
3. **Off-scale radii.** `rounded-2xl` (`reward-pool-form.tsx:713`, `offers/[id]/qr/page.tsx:96`),
   `rounded-xl` (`profile-form.tsx:127,136`, both scan pages), `rounded-full` on non-stamp pills
   (`offer-campaign-form.tsx:581`). Four radii in a two-radius system.
4. **Hand-rolled form primitives beside the sanctioned ones.** Two bare `<select>`s
   (`send-reward-form.tsx:122`, `loyalty-card-form.tsx:195`) next to `SelectField`; three
   hand-rolled error paragraphs (`reward-pool-form.tsx:448,840`, `onboarding-form-fields.tsx:112`,
   `venue-location-form.tsx:183`, `profile-form.tsx:127`) instead of `Alert`/`FormMessage`; two
   manual `{pending ? "Saving…" : …}` buttons (`onboarding-form.tsx:342`,
   `reward-pool-form.tsx:847`, `loyalty-card-form.tsx:237`) instead of `SubmitButton`.
5. **Tap-target floors re-asserted at 12+ call sites** in three dialects (finding #61) — either the
   Button variants are not doing their documented job, or these are all dead weight.
6. **Progress and status stated 2–3 times per surface.** Launch readiness (finding #43), the members
   toolbar (`StatStrip` + pill counts, finding #22), the offer QR page (hero + full panel, finding
   #35), the dashboard (QR card + poster page, findings #12/#40).
7. **Duplicated markup instead of shared components** — the members table's two renderers (#16), the
   four print routes (#37/#41), the two scan shells (#65), the two search toolbars (#53), the two
   dashboard/poster QR heroes (#40).
8. **Vertical height is nobody's budget.** No console page uses a two-column layout below `lg`
   except `invite` and `loyalty-card-form`; almost nothing uses tabs or accordions to fold optional
   content, even though `Disclosure` (`launch/disclosure.tsx`) is already built, accessible and used
   in exactly four places.

---

## Top 5 highest-impact changes

1. **Cut the four print routes and the four stacked asset lanes down to one tabbed print workspace**
   (findings #37, #38, #39, #41). This removes ~1,800px of scroll from `/app/qr`, fixes the
   double-header on tent/NFC previews, gives tent/NFC users the design switcher posters already
   have, and collapses four route files + four error components into one.
2. **Make the members table one responsive component with server-side search and paging**
   (#16, #17, #18, #22). Today the page renders every row twice, apologises in prose that search
   does not work past page one, and spends 330px on chrome before the first member. Fixing it
   restores the console's most-used screen and deletes ~150 lines of bespoke markup.
3. **Give the dashboard a task layer and halve its height** (#8, #12, #13). Ship the already-written
   `MerchantNextActions`, shrink the QR ticket to a one-row counter strip, drop two of the three
   header buttons, and put the QR beside the KPIs at `md+`. Roughly 1,800px → ~900px, with the
   highest-value action ("someone has a reward waiting") finally visible.
4. **Add the mobile bottom tab bar the shell already claims to have** (#2), and regroup the sidebar
   by task frequency (#3). Every counter action is currently two taps and a drawer animation away on
   the device the merchant actually holds.
5. **Unify the form surface and its primitives** (#25, #28, #29, #48, #49): one card grammar
   (2px ink), one border weight, `SelectField`/`SubmitButton`/`Alert` everywhere, and one shared
   sticky `FormActionBar` for the four forms longer than a viewport. This is a mechanical pass that
   touches ~15 files and makes the console's setup path — the activation-critical path — look like
   the same product as its dashboard.

# Handoff — Counter-first venue console

**Paste everything below the line into a fresh agent session opened at
`/Users/amankumarshrestha/LapenInns Project/platform/naba-perks`.**
It is written to be executed, not read: every path, type and script named in it
exists in the repo today.

---

## 0.0 — Reference material, and where it lives

The design work was done in an OpenDesign project **outside this repository**.
Three files matter, all in:

```
/Users/amankumarshrestha/Library/Application Support/Open Design/namespaces/release-stable/data/projects/7db8da92-9db4-48ab-a851-a6e10b122ee5/
```

| File                                        | What it is                                                                                                                                                                        | How to use it                                                                                                           |
| ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `nabaperks-counter-mobile-redesign.html`    | The approved prototype **and** the teardown document. Self-contained; the breakpoint frames are live `srcdoc` iframes running one shared source, so the media queries really fire | Open it in a browser. Drag the width scrubber in the _Live prototype_ section to inspect any width between 280 and 1280 |
| `nabaperks.com-app_iPhone-SE_.png`          | The **before** state: the current `/app` dashboard at 375 × 667, captured as one 750 × 5590 strip                                                                                 | The twelve numbered failures in §1 are written against this image. Read them side by side                               |
| `handoff-counter-console-implementation.md` | This document                                                                                                                                                                     | —                                                                                                                       |

**First action of the session: copy all three into the repo**, so the work is
versioned next to the code and nobody has to reach into an application-support
directory six months from now:

```bash
SRC="/Users/amankumarshrestha/Library/Application Support/Open Design/namespaces/release-stable/data/projects/7db8da92-9db4-48ab-a851-a6e10b122ee5"
DEST="docs/ui-audit/counter-console-rebuild"
mkdir -p "$DEST"
cp "$SRC/nabaperks-counter-mobile-redesign.html" \
   "$SRC/nabaperks.com-app_iPhone-SE_.png" \
   "$SRC/handoff-counter-console-implementation.md" "$DEST/"
```

From then on cite the repo-relative paths, not the absolute ones.

`docs/ui-audit/` is the right home because it already holds the merchant
console audit trail. Before you start, read — and when you finish, update:

- `docs/ui-audit/03-merchant.md` — the standing merchant-surface audit. The
  twelve failures in §1 belong in it, marked resolved as each lane lands.
- `docs/ui-audit/HANDOFF.md` and `HANDOFF-NEXT-AGENT.md` — the existing
  cross-agent handoff chain. Add a pointer to this rebuild so the next agent
  finds it from the place they already look.
- `docs/ui-audit/STATUS-*.md` — add a `STATUS-m-console.md` tracking the eight
  lanes in §14.
- `docs/design-system/honey-ink/` — the shipped system reference. Nothing here
  changes it; if you find yourself wanting to, stop and raise it instead.

---

## 0 — Your job

Rebuild the merchant venue console (`/app/*`) as a counter-first mobile
application shell, following the approved prototype. This is a **structural
rebuild of the shell and the dashboard**, not a restyle: the design system does
not change, the data layer barely changes, and almost every view-model in
`lib/merchant/*` is reused as-is.

Work in lanes (§14). Do not open a single 4,000-line PR.

**Read before you write anything:**

1. `AGENTS.md` — §"Verify the affected boundary", §"Repository boundaries and
   conventions", §"Code Review Rules". These override anything here.
2. `DESIGN.md` — Wet Ink (Honey & Ink v2). The visual contract. You are not
   permitted to introduce a token, a colour literal, a radius or a shadow that
   is not already in `app/globals.css`.
3. `components/layout/customer-tab-bar.tsx` — the repo already ships a
   Wet Ink bottom tab bar for the customer journey. The merchant tab bar is a
   sibling of it, not a new invention. Match its structure, its
   `pb-[env(safe-area-inset-bottom)]`, its `data-active` / `aria-current`
   handling and its `focus-ring` usage.
4. The prototype — `docs/ui-audit/counter-console-rebuild/nabaperks-counter-mobile-redesign.html`
   after the §0.0 copy. Where this document and the prototype disagree, **this
   document wins**: the prototype is a static approximation with no real data,
   no error states and a decorative QR. It shows the _shape_; §6 and §7 are the
   specification.

---

## 1 — Why

The current `/app` at 375px — see
`docs/ui-audit/counter-console-rebuild/nabaperks.com-app_iPhone-SE_.png` — is a
single ~5,590px column of equal-weight cards behind a hamburger. Twelve specific failures were logged against it; the ones
that drive this rebuild:

| #   | Failure                                                                | Fix in this handoff                         |
| --- | ---------------------------------------------------------------------- | ------------------------------------------- |
| 1   | 7 destinations + 2 account items behind one hamburger; no "where am I" | §5 tab bar / rail                           |
| 2   | Three stacked full-width CTAs open the page                            | §6.1 — one pinned primary, the rest demoted |
| 3   | QR is the smallest thing on its own card; four affordances for one job | §6.1 — the QR _is_ the button               |
| 4   | Two solid vermillion primaries in one viewport                         | §10 accent budget                           |
| 5   | Destructive reset gated by a 16px checkbox                             | §6.6 `ResetCodeSheet`                       |
| 6   | Four ~160px KPI tiles with ~60px sparklines                            | §6.3 delta receipt + real charts            |
| 7   | Trend direction carried by colour alone (`metricTrendClassName`)       | §6.3, §9                                    |
| 8   | 14-day chart with no values, no axis, no touch readout                 | §6.3 `ColumnChart` + stepper                |
| 9   | Four identical activity rows, each with its own "Open QR" button       | §6.2 grouping                               |
| 11  | Nothing pinned — the only action is wherever you stopped scrolling     | §5 four-row grid                            |
| 12  | One breakpoint (md); 320 and 768–1024 are unconsidered                 | §8                                          |

---

## 2 — Non-negotiables

- **Tokens only.** No hex literals in `app/`, `components/`, `lib/`. Colour comes
  from the `@theme inline` block in `app/globals.css`
  (`bg-paper`, `text-ink`, `text-ink-soft`, `border-ink`, `bg-primary`,
  `text-cobalt`, `shadow-xs/sm/md`, `rounded-*`, `max-w-merchant`,
  `max-w-customer`). `pnpm tokens:check` must pass — it fails on undefined
  `var(--x)` references and on any arbitrary text size below the 10px floor.
- **Reuse before you create.** Appendix A is the inventory. If you are about to
  write a card, a sheet, a skeleton, a badge, a sparkline or an empty state,
  it already exists.
- **No new dependencies.** The charts are SVG + CSS. Do not add a charting
  library; `components/data/trend-chart.tsx` and `sparkline.tsx` are the
  starting points.
- **Server components stay server components.** The per-stream
  `<Suspense>` + `StreamErrorBoundary` structure in `app/app/page.tsx` is load-
  bearing (a failing QR read must not take down the metrics). Preserve it — the
  tab shell is a client component, the screen bodies are not.
- **Every state in §7 ships with the screen that owns it.** A screen whose empty,
  loading, error and offline states are "to follow" is not done.
- **Quality gate per lane:** `pnpm quality:fast` (secrets → lint → typecheck →
  contracts + unit) before every push; `pnpm quality:check` before the final
  lane. Plus `pnpm tokens:check`, `pnpm test:a11y`, `pnpm test:visual`,
  `pnpm bundle:check`.

---

## 3 — The change in one paragraph

One console is doing two jobs at two times of day. During service the team needs
a code to present and a code to read out; after service the owner needs to know
whether the week moved. Split them. `/app` becomes **Counter** — the QR, the team
code, and a pinned scanner, and nothing else. **Activity** and **Numbers** become
the owner's read. **More** holds everything that is configured once. The shell
becomes a four-row CSS grid where only the middle row scrolls, so the primary
action is never scrolled off screen; below 900px that grid ends in a bottom tab
bar, at 900px and above the same nav becomes a 200px labelled left rail.

---

## 4 — Route & IA map

Routes do **not** move. This is a navigation and composition change; every
existing URL keeps working, because deep links, QR posters, emails and the
`app/dev/app-harness` lane all point at them.

| Tab      | Route           | Today                                                                | Action                                                   |
| -------- | --------------- | -------------------------------------------------------------------- | -------------------------------------------------------- |
| Counter  | `/app`          | Dashboard: header actions + QR card + code card + metrics + activity | Strip to QR + team code + pinned scanner                 |
| Activity | `/app/activity` | Full detail feed                                                     | Add grouping + today/7d scope                            |
| Numbers  | `/app/numbers`  | — **new route**                                                      | Metrics + charts moved off `/app`                        |
| More     | `/app/more`     | — **new route**                                                      | Destination list; replaces the sidebar sheet below 900px |

Everything else stays where it is and is reached from **More**:
`/app/qr`, `/app/customers`, `/app/offers`, `/app/announcements`, `/app/launch`,
`/app/account?tab=profile`, `/app/account?tab=billing`, `/app/scan`,
`/app/customers/invite`, `/app/customers/send-reward`.

### 4.1 `components/layout/console-nav.ts`

Keep `merchantNavItems` as the **rail/More** source of truth — it is already
consumed by `ConsoleSidebarNav` and by `isActiveNavItem`. Add beside it:

```ts
/** The four bottom-tab destinations below the 900px rail breakpoint. */
export const merchantTabItems = [
  { href: "/app",          label: "Counter",  icon: QrCode01Icon,    prefetch: "auto" },
  { href: "/app/activity", label: "Activity", icon: Activity03Icon,  prefetch: "auto" },
  { href: "/app/numbers",  label: "Numbers",  icon: AnalyticsUpIcon, prefetch: "auto" },
  { href: "/app/more",     label: "More",     icon: /* see note */ },
] satisfies readonly ShellNavItem[]
```

`QrCode01Icon`, `Activity03Icon` and `AnalyticsUpIcon` are already imported by
this file. For **More**, pick a menu glyph from `@hugeicons/core-free-icons` and
register it in `components/brand/icons.ts` alongside the existing sets — do not
guess an export name, autocomplete it.

Extend `isActiveNavItem` so the tab highlight survives the child routes:

- `/app/scan`, `/app/rewards/*` → **Activity** (the existing
  `ACTIVITY_ALIAS_PREFIXES` rule already does this; keep it).
- `/app/qr/*`, `/app/customers/*`, `/app/offers/*`, `/app/announcements/*`,
  `/app/launch/*`, `/app/account*` → **More**.
- Bare `/app` → **Counter**, and only when there is no `?tab`.

This routing table belongs in a **pure function with unit tests**
(`tests/unit/console-nav.test.mjs`), not in the component. That file already has
a `parseNavHref` / `isActivePath` pair to extend.

---

## 5 — Shell rebuild

**File:** `components/layout/merchant-app-shell.tsx`
**New file:** `components/layout/merchant-tab-bar.tsx`

Today the `full` variant is a `SidebarProvider` with a sticky `md:hidden` header
whose only content is a `SidebarTrigger` and the `Logo`. Replace the mobile
branch; leave the `setup` variant, the `isOfferPassScanPath` bypass and the
`hideMobileChrome` poster contract exactly as they are.

### 5.1 The grid

```
grid-template-areas: "top" "body" "pin" "nav"   /* < 900px */
grid-template-rows:  auto  minmax(0,1fr) auto auto
height: 100dvh
```

- Only the `body` row gets `overflow-y-auto`. Nothing else scrolls.
- `top` pads with `env(safe-area-inset-top)`; `nav` and any sheet footer pad with
  `env(safe-area-inset-bottom)`.
- `pin` is rendered by the **screen**, not the shell — the shell exposes it as a
  named slot so only Counter fills it. When empty it collapses to `0`.
- At `min-width: 900px` the same grid becomes
  `grid-template-areas: "nav top" "nav body" "nav pin"` with a `200px` first
  column, and `MerchantTabBar` renders its rail form with the **full seven**
  `merchantNavItems` plus the account items. The existing `Sidebar` /
  `SidebarProvider` / `sidebar_state` cookie is then **removed from `/app`** —
  the rail replaces it. Check `components/ui/sidebar.tsx` for other consumers
  (`app/admin/*` via `AdminShell`) before deleting anything; admin keeps it.

### 5.2 `MerchantTabBar`

Model it on `customer-tab-bar.tsx`. Differences: four items not five, `min-h-14`
(56px) targets, `role="tablist"` is **wrong here** — these are links, so use
`<nav aria-label="Console">` with `aria-current="page"`, exactly as the customer
bar does. Active state is `bg-paper-deep text-foreground` with a 3px
`border-t-ink`; inactive is `text-ink-soft`, hover raises to `text-foreground`.
**No vermillion in the tab bar** — the accent budget belongs to the screen.

### 5.3 Top bar

52px min-height. Left: `VenueMark` (`components/brand/venue-mark.tsx`) +
truncated `business_name`. Right: today's date in `font-mono` uppercase. The
`Logo` moves to More and to the rail header. Replacing the logo with the venue
identity is deliberate: at a till the operator needs to know _which venue this
phone is signed into_, not which SaaS they are using.

---

## 6 — Screen specs

### 6.1 Counter — `app/app/page.tsx`

Renders, in order: `PresentableQrCard`, one note + two text links, `TeamCodePanel`.
Pinned slot: one `<Button size="lg" className="w-full">` → `/app/scan`.

**Remove from this route:** `MerchantDashboardHeaderActions`,
`MerchantDashboardStream`, `MerchantCompactActivityStream`, and the `PageTitle`
block. The metrics stream moves verbatim to `/app/numbers`; the activity stream
moves to `/app/activity`. Keep `getMerchantOnboardingStatus` and the
`status !== "complete"` redirect to `/app/onboarding` — that gate is untouched.

**`PresentableQrCard`** (rewrite of `components/merchant/dashboard-qr-card.tsx`):
the whole card is one `<button>` that opens present mode. `min(62vw, 236px)` QR,
rising to `min(58vw, 264px)` at 430px. `border-2 border-primary shadow-md`,
pressing translates into `shadow-2xs`. Mono hint "TAP TO PRESENT". Below it, as
plain underlined text links, not buttons: **Copy link** (reuse
`components/merchant/copy-url-button.tsx`, restyled to `variant="link"`) and
**Poster & print** → `/app/qr`. There is exactly **one** way to open the QR full
screen: the card. Delete the separate "Show full screen" button.

**`TeamCodePanel`** (rewrite of `dashboard-venue-code-card.tsx`): one
`aria-expanded` disclosure button containing the masked/revealed code (30px
`font-mono`, `tracking-[0.26em]` with matching `pl`), the "changes 5am" countdown
from `VenueCodeToday`, one sentence of explanation, and **Reset the code** as a
text link that opens `ResetCodeSheet` (§6.6). The checkbox gate and the disabled
button are deleted. Reuse `components/merchant/venue-code-reveal.tsx` for the
reveal mechanics if its internals survive the restyle.

**Present mode** (`components/merchant/present-qr.tsx`): full-screen
`role="dialog" aria-modal="true"`. QR at `min(74vw, 66vh, 420px)`. Copy:
_"Scan to join · Old Crown"_ / _"Your first stamp is waiting."_ / mono
_"ONE STAMP PER BUSINESS DAY"_. One ghost **Done** button pinned at the bottom.
Escape closes; focus returns to the card; request `screen.wakeLock` and restore
brightness assumptions on close (progressive — guard the API, it is absent on
several browsers). In short landscape (`max-height: 460px`) lay the code beside
the heading rather than above it.

### 6.2 Activity — `app/app/activity/page.tsx`

Today `ActivityCompactFeed` renders every `qr_scanned` as its own row with its
own full-width action. Introduce **grouping** as a pure function so it is unit
testable:

```ts
// lib/merchant/activity-grouping.ts
export type ActivityGroup = {
  key: string // `${eventName}:${dateGroup}`
  category: ActivityCategory
  badgeLabel: string
  headline: string // "4 QR scans"
  summary: string // "8 to 12 minutes ago"
  count: number
  rows: ActivityDisplayRow[] // preserved for the expanded list
  earliest: string
  latest: string
}

export function groupActivityRows(
  rows: readonly ActivityDisplayRow[],
  opts?: { collapseFrom?: number } // default 3
): readonly (ActivityDisplayRow | ActivityGroup)[]
```

Rules: group only **same `eventName` within the same `dateGroup`**, only when
`count >= collapseFrom`, and only for low-information categories — `qr` and
`customer`. A `reward_redeemed` or `reward_sent` **never** collapses: those name a
person and an action the owner must be able to see individually. Preserve
`dateGroupLabel` ordering. Groups render as `<details>` so expansion needs no
JS and no `aria-expanded` bookkeeping; the expanded body is the per-row
timestamp list, with `primaryAction` shown on **individual** rows only.

Filters: keep `FilterPills` (`components/brand/filter-pills.tsx`) bound to
`ActivityCategory` — `All · Members · Stamps · Rewards · QR · Account` — and keep
the existing server-side `filter` push in `ActivityQueryOptions` so "Load more"
grows the _filtered_ set. Scope selector above it: **Today / 7 days / 28 days**.

### 6.3 Numbers — all stats surfaces

This is the part the previous console never had. Four surfaces, one new route
group.

```
app/app/numbers/page.tsx                 overview
app/app/numbers/[metric]/page.tsx        detail: members | stamps | rewards | qr
```

`[metric]` is a static union — validate against a literal list in
`lib/merchant/numbers-nav.ts` and `notFound()` on anything else. Do not accept
an arbitrary string.

#### 6.3.1 Overview

| Block          | Content                                                     | Source                       |
| -------------- | ----------------------------------------------------------- | ---------------------------- |
| Headline       | Members total + "N joined in the last 7 days"               | `getMerchantDashboardData`   |
| Range selector | 7 / 14 / 28 days, default 14                                | URL `?range=`, server-read   |
| Stamps chart   | Column chart, one column per day                            | `getMerchantDashboardSeries` |
| Joins chart    | Column chart, **own y-scale**, cobalt                       | same                         |
| Day readout    | Selected day + both values + `‹ ›` steppers                 | client                       |
| Delta receipt  | One row per metric: label / tabular value / change in words | `MerchantDashboardTrends`    |
| Footnote       | Range, timezone (Europe/London), last-refreshed             | server                       |

**Two charts, two scales, never one.** Stamps and joins differ by roughly 2.5×;
a shared axis flattens joins into the baseline and a dual axis lies about both.
Two small multiples sharing one x-axis and one selection is the honest form, and
it is the only form that survives 320px.

**`components/data/column-chart.tsx`** (new, sibling of `trend-chart.tsx`):

- Filled columns. No outline-only encoding, ever.
- `role="img"` with an `aria-label` naming the metric, the range and the max;
  plus a visually hidden `<table>` of the same numbers for screen readers.
- Each column is a `<button>` with
  `aria-label="Wed 16 September, 9 stamps"` and `aria-current`.
- Columns are ~20px wide at 320px, below the 44px floor **by geometry**. The
  accessible path is therefore the 44px `‹ ›` stepper pair in the readout; the
  columns are the shortcut. Document this in the component's JSDoc — a reviewer
  will otherwise flag it as a tap-target regression.
- Selected column fills `bg-primary`. That is the screen's **single** accent use.
- `prefers-reduced-motion`: no entry animation.

**Delta rows.** Direction is `▲ / ▼ / =` **plus words**, and colour is redundant
only. `formatMetricTrendLabel` in `lib/merchant/dashboard-trends.ts` currently
returns `"+25 vs last week"` / `"Same as last week"`. Change it to
`"25 more than last week"` / `"8 fewer than last week"` / `"same as last week"`
and update `tests/unit/` accordingly. `metricTrendClassName` keeps returning
`text-reward` / `text-destructive` / `text-ink-soft`, but the row must read
correctly in greyscale — verify with a `filter: grayscale(1)` visual test.

`KpiTile` (`components/brand/kpi-tile.tsx`) is **retired from the console
overview** — its 14-day sparkline is the thing that fails at 160px. Check for
other consumers (`/admin`, `/dev/design-system`) before deleting; if any remain,
leave the component and simply stop using it here.

#### 6.3.2 Metric detail — `/app/numbers/[metric]`

One screen per metric, same skeleton:

1. Big tabular value + the range it covers.
2. Full-width column chart for that metric alone, range selector shared.
3. This period vs previous period, stated in words.
4. Best day / quietest day in the range.
5. Contributing breakdown where one exists:
   - **Members** — joined via QR vs via team code vs invited.
   - **Stamps** — by hour of day (0–23 columns; this is where a venue learns its
     actual service peak), and claimed-by-QR vs claimed-by-code.
   - **Rewards** — unlocked vs redeemed vs expired vs sent-by-you, and median
     days from unlock to redemption.
   - **QR** — scans, downloads, poster prints, and paused-period markers.
6. "Recent {metric} activity" — the 5 most recent matching rows, linking to
   `/app/activity?filter={category}`.

Every number on these screens must trace to an existing counter in
`lib/merchant/dashboard-counts.ts` / `dashboard-period-counts.ts` /
`dashboard-buckets.ts`. **If a breakdown has no query behind it, ship the screen
without that block and open a ticket.** Do not invent a metric to fill a layout,
and do not compute a rate client-side from two unrelated totals.

#### 6.3.3 Low-data honesty

A venue in its first fortnight has almost no series. Three bands, chosen by
**days since the venue's first stamp**, not by row count:

- `< 3 days` — no chart at all. A receipt card: "Too early to show a trend. Come
  back on {date}." plus the raw running totals.
- `3–13 days` — chart renders with only the elapsed days; the missing tail is
  `border-dashed` placeholder columns at zero height, labelled
  "NOT YET RECORDED". No trailing-zero cliff, which is what a naive
  zero-filled series draws.
- `>= 14 days` — full behaviour, deltas enabled.

Deltas are **suppressed, not zeroed**, whenever the previous period is
incomplete. `MetricWeekTrend.direction === "flat"` with `previous === 0` and
`current === 0` must render "no activity either week", not "same as last week".

### 6.4 More — `app/app/more/page.tsx`

Two `mlist` cards separated by a dashed receipt rule. Rows are 58px, left-aligned,
title + one-line state, mono chevron. Each row's subtitle is **live**, not static:

| Row            | Subtitle source                                                               |
| -------------- | ----------------------------------------------------------------------------- |
| Poster & print | printed / not yet printed — `lib/merchant/print-asset-route.ts`               |
| Members        | `N on the card` — dashboard counts                                            |
| Offers         | active campaign name, or "None running" — `offer-campaigns.ts`                |
| Announce       | "Last sent {date}" or "Never sent"                                            |
| Setup          | "{n} of 5 steps left" from `getMerchantLaunchReadiness`, hidden when complete |
| Account        | plan + billing state from `billing-status-copy.ts`                            |
| Log out        | — (second card, below the dashed rule)                                        |

Log out keeps the existing `signOutAction` form. Do **not** style it destructive;
it is reversible.

### 6.5 Skeletons

`components/merchant/loading-skeletons.tsx` already exports
`DashboardQrCardSkeleton`, `DashboardVenueCodeCardSkeleton`,
`MerchantDashboardMetricsSkeleton`, `MerchantCompactActivitySkeleton`. Rework the
first two to the new card geometry and add `NumbersOverviewSkeleton`,
`ColumnChartSkeleton` and `MoreListSkeleton`. **Every skeleton must reserve the
exact final height** — a shifting QR card at a till is worse than a slow one. Add
these to `/dev/app-harness/skeletons` and assert CLS in the Lighthouse budget.

### 6.6 Sheets & dialogs

Use `components/ui/sheet.tsx`. Every sheet is a three-row grid —
head / scrolling body / **pinned footer** — with `max-h-[86dvh]` and
`pb-[env(safe-area-inset-bottom)]` on the footer. The body scrolls; the footer
never does. This is a hard structural rule: a long warning must not push the
confirm button out of reach.

| Sheet            | Trigger                  | Primary                                        | Secondary               |
| ---------------- | ------------------------ | ---------------------------------------------- | ----------------------- |
| `ResetCodeSheet` | Counter → Reset the code | "Reset the code now" (`variant="destructive"`) | "Keep the current code" |
| `PresentQrSheet` | —                        | full-screen dialog, not a sheet                |                         |
| `ScopeSheet`     | Numbers → range          | 7 / 14 / 28 radio list                         | Cancel                  |
| `PauseQrSheet`   | More → Poster → Pause    | existing `/app/qr/pause-actions.ts` flow       |                         |

`ResetCodeSheet` copy: _"The old code stops working straight away. Anyone
mid-way through typing it will have to start again — tell the team before you do
this."_ On success: reveal the new code immediately, stamp the panel with
`RESET {HH:MM}` in mono, and fire a `sonner` toast. Never a silent success.

---

## 7 — State matrices

Ship every row. Each one gets a `/dev/app-harness` fixture (§12) and a
Playwright assertion (§13).

### 7.1 Shell

| State                            | Trigger                                        | Behaviour                                                                                                                                                                  |
| -------------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authenticated, setup complete    | default                                        | Full shell                                                                                                                                                                 |
| Not authenticated                | no session                                     | Existing redirect to `merchantLoginHref` — unchanged                                                                                                                       |
| Setup incomplete                 | `getMerchantOnboardingStatus() !== "complete"` | Existing redirect to `/app/onboarding` — unchanged                                                                                                                         |
| Setup complete, launch not ready | `getMerchantLaunchReadiness()` incomplete      | `MerchantSetupReminder` above the body; **More → Setup** shows "n of 5 steps left"; tab bar unchanged                                                                      |
| Poster print path                | `isPosterPrintPath`                            | Chromeless — no top bar, no tab bar. Preserve exactly                                                                                                                      |
| Offer pass scan path             | `isOfferPassScanPath`                          | Shell bypassed. Preserve exactly                                                                                                                                           |
| Billing past due / cancelled     | `billing-status-copy.ts`                       | Persistent `Alert` under the top bar on every tab; More → Account carries the CTA. **Never block the Counter QR** — a venue that owes money still has customers at the bar |
| Offline                          | `navigator.onLine === false`                   | Mono strip under the top bar: "OFFLINE — SHOWING THE LAST LOADED VIEW". QR and team code stay readable from cache; the scanner and all mutations disable with a reason     |
| Trial                            | trial state                                    | Days-remaining chip in More → Account only                                                                                                                                 |

### 7.2 Counter

| Element        | State                                                                       | Behaviour                                                                                                                                                                    |
| -------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QR card        | loading                                                                     | `DashboardQrCardSkeleton`, exact final height                                                                                                                                |
|                | ready                                                                       | Card is the button; mono "TAP TO PRESENT"                                                                                                                                    |
|                | **paused**                                                                  | QR renders at 40% opacity with a solid `PAUSED` overlay chip; card is **not** tappable; body copy names why and links to `/app/qr` to resume. Drive from `qr-pause-state.ts` |
|                | missing / not yet generated                                                 | Receipt card: "Your venue QR is not ready yet" → `/app/launch?tab=qr`. `ensure-join-qr.ts` should have prevented this; treat its appearance as a bug and log it              |
|                | failed to load                                                              | `StreamErrorBoundary` fallback, scoped to the card. "Couldn't load your QR" + Retry. The team code below **must still render**                                               |
| Copy link      | idle / copied / unsupported                                                 | `copy-url-button.tsx` already handles all three. Keep the 2s confirmation                                                                                                    |
| Team code      | loading                                                                     | Skeleton at final height                                                                                                                                                     |
|                | hidden (default)                                                            | `••••••`, `aria-expanded="false"`                                                                                                                                            |
|                | revealed                                                                    | Code, `aria-expanded="true"`, countdown to 5am                                                                                                                               |
|                | reset in flight                                                             | Button `disabled` + `Spinner`, sheet stays open                                                                                                                              |
|                | reset succeeded                                                             | Sheet closes, code revealed, `RESET HH:MM` stamp, toast                                                                                                                      |
|                | reset failed                                                                | Sheet stays open, inline `Alert` with the server reason, primary re-enabled                                                                                                  |
|                | rotation unavailable                                                        | Reset link hidden entirely, not shown-and-disabled                                                                                                                           |
| Pinned scanner | ready / no camera permission / camera unsupported / in flight / scan failed | `merchant-reward-scanner.tsx` owns these; the pinned button only routes                                                                                                      |
| Present mode   | open / closing / wake-lock denied                                           | Wake-lock failure is silent — never a toast the customer at the bar can see                                                                                                  |

### 7.3 Activity

| State                   | Behaviour                                                                  |
| ----------------------- | -------------------------------------------------------------------------- |
| Loading                 | `MerchantCompactActivitySkeleton`, 4 rows                                  |
| Populated               | Grouped per §6.2                                                           |
| Populated, one row only | No grouping, no filter pills                                               |
| Empty — brand new venue | "Nothing here yet. The first scan of your QR lands here." + link to Poster |
| Empty — filtered        | "No {category} activity in the last {range}." + Clear filter               |
| Empty — today only      | "Nothing yet today." with last-7-days as a secondary link                  |
| Partially loaded        | `hasMore === true` → "Load more" respecting the active filter              |
| Error                   | `StreamErrorBoundary` + Retry; filters remain usable                       |
| Group expanded          | `<details open>`; state does **not** persist across navigations            |
| Row with an action      | `primaryAction` only on individual rows, never on a group header           |

### 7.4 Numbers

| State                                | Behaviour                                                                                                                                  |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Loading                              | `NumbersOverviewSkeleton` — headline, two chart blocks, three delta rows, all at final height                                              |
| Full data (>= 14d)                   | §6.3.1                                                                                                                                     |
| 3–13 days                            | Dashed "NOT YET RECORDED" tail columns, deltas suppressed                                                                                  |
| < 3 days                             | No chart; totals + "come back on {date}"                                                                                                   |
| Zero activity in range               | Chart renders a flat labelled baseline with a caption, **not** an empty box                                                                |
| Previous period incomplete           | Deltas replaced by "not enough history to compare yet"                                                                                     |
| Series query failed, totals fine     | Charts show an inline error; the delta receipt still renders                                                                               |
| Both failed                          | `StreamErrorBoundary` + Retry                                                                                                              |
| Range changed                        | Server round-trip via `?range=`; selection resets to the most recent day; chart shows a skeleton, not a flash of old data at the new scale |
| Day selected                         | Readout updates via `aria-live="polite"`; both charts highlight the same index                                                             |
| Metric detail, unknown `[metric]`    | `notFound()`                                                                                                                               |
| Metric detail, breakdown unavailable | Block omitted entirely — never a "Coming soon" card                                                                                        |

### 7.5 More

| State                 | Behaviour                                                                                                                                                        |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Default               | Seven rows with live subtitles                                                                                                                                   |
| Subtitle query failed | Row renders with no subtitle; the row itself still navigates                                                                                                     |
| Setup complete        | Setup row hidden                                                                                                                                                 |
| Log out in flight     | Button disabled + spinner                                                                                                                                        |
| Rail (>= 900px)       | `/app/more` redirects to `/app` — the rail already exposes every destination, so More is dead weight above the breakpoint. Handle in the page, not in middleware |

---

## 8 — Breakpoint contract

| Range              | Name               | Rules                                                                                                                                           |
| ------------------ | ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| ≤ 359              | Compact            | 16px gutters. QR ≤ 62vw. Day labels every 3rd column. Delta note wraps to its own line. **No structural change**                                |
| 360–429            | Base               | 20px gutters. QR `min(62vw, 236px)`. Day labels every 2nd column. _This is the design target_                                                   |
| 430–599            | Large phone        | 24px gutters. QR `min(58vw, 264px)`. Delta rows go label / value / note on one line. Still one column                                           |
| 600–899            | Landscape & tablet | Counter two-up (QR left, note + code right). Body caps at 560px, centred. Numbers puts the two charts side by side. Tab bar stays at the bottom |
| ≥ 900              | Rail               | Tab bar becomes a 200px labelled left rail carrying all seven `merchantNavItems` + account. Body caps at 820px. `/app/more` redirects to `/app` |
| landscape, h ≤ 460 | Short              | Top bar 42px, QR panel horizontal, present mode side-by-side. **Tap targets stay at 48px**                                                      |

Verify: **320, 360, 375, 390, 414, 430, 600, 768, 900, 1024, 1280**, plus
375×667 landscape and 844×390 landscape.

Hard rules at every width: no horizontal page scroll; no fixed width below
600px; 200% browser text zoom must grow rows rather than clip them (use
`min-h-*`, never `h-*`, on anything containing text); safe-area insets reserved
top and bottom.

---

## 9 — Accessibility contract

- One focus recipe — the shared `.pressable` / `focus-ring` outline in
  `globals.css`. No component-local ring dialects (the `Button` JSDoc already
  says this; honour it).
- Tab bar is `<nav aria-label="Console">` with `aria-current="page"`. Not tabs,
  not a tablist — they are links to real routes.
- Present mode and every sheet: `role="dialog" aria-modal="true"`, focus trapped,
  Escape closes, focus returns to the invoking control.
- Charts: `role="img"` + descriptive label, a visually hidden data table, and
  the readout as `aria-live="polite"`.
- Never colour alone. Trend direction is glyph + words. Paused QR is an overlay
  chip with text, not a tint. Validate in greyscale.
- Text contrast ≥ 4.5:1 (≥ 3:1 for large text, icons and non-text boundaries) in
  **every** state, including hover and pressed. When a solid button inverts on
  hover, swap foreground and background in the same rule.
- `prefers-reduced-motion`: all transitions collapse; no chart entry animation.
  The repo's `motion-reduce:transition-none` convention is already in `Button`.
- Skip link to the body row; the shell currently has none.
- `pnpm test:a11y` must pass on `/app`, `/app/activity`, `/app/numbers`,
  `/app/numbers/stamps`, `/app/more` in both the mobile and `.desktop` projects.

---

## 10 — Copy & accent rules

Wet Ink voice — plain, warm, British. No exclamation marks, no emoji, no
"register" / "sign up" / "create an account". Receipt voice (Space Mono,
uppercase) for codes, dates, IDs and rules; Bricolage for anything human. Never
mix the two registers in one line.

**Accent budget — vermillion at most twice per screen:**

| Screen         | Use 1                    | Use 2                      |
| -------------- | ------------------------ | -------------------------- |
| Counter        | QR card border           | Pinned scanner button fill |
| Activity       | —                        | —                          |
| Numbers        | Selected chart column    | —                          |
| More           | —                        | —                          |
| Present mode   | —                        | —                          |
| ResetCodeSheet | Destructive confirm fill | —                          |

Focus rings are exempt (keyboard-only, single system recipe).

---

## 11 — Analytics

Keep `dashboard_viewed` firing from `/app` via the existing `after()` +
`capturePostHogEvent` pattern in `app/app/page.tsx` — including the
`isAfterOutsideRequestScopeError` fallback.

Add, through `lib/analytics/events.ts` (never a raw PostHog call):

```
console_tab_selected        { tab, from_tab }
counter_qr_presented        { source: "card" }
counter_qr_present_closed   { duration_ms }
team_code_revealed          {}
team_code_reset_confirmed   {}
team_code_reset_cancelled   {}
numbers_range_changed       { range, from_range }
numbers_day_selected        { metric, method: "column" | "stepper" }
numbers_metric_opened       { metric }
activity_group_expanded     { category, count }
activity_filter_changed     { filter, range }
```

Every new event needs a contract entry and a `tests/contracts/` assertion — the
repo gates this with `pnpm test:contracts`. Check `funnel-contract.ts` and
`merchant-activation-contract.ts` for whether any of these belong to an existing
funnel before inventing a new one.

---

## 12 — Harness work

`app/dev/app-harness/*` is a DB-free, deterministic, unauthenticated lane whose
`fixtures.ts` mounts the **real** components. It is the cheapest place to build
and review every state in §7, and `tests/e2e` already drives it.

Rules from the existing `fixtures.ts` header, which you must keep: every value is
a literal — no `Math.random`, no `Date.now`, no `new Date()` — so a headless
screenshot at a given width is byte-stable.

Add:

- `/dev/app-harness/counter` — ready · paused · missing QR · QR error ·
  code hidden · code revealed · reset in flight · reset failed · offline
- `/dev/app-harness/numbers` — full · 3–13 days · < 3 days · zero activity ·
  series error · totals error · each range
- `/dev/app-harness/numbers/[metric]` — all four metrics, with and without
  their breakdown blocks
- `/dev/app-harness/activity` — extend with grouped, filtered-empty,
  today-empty, single-row and load-more fixtures
- `/dev/app-harness/more` — all subtitles present · subtitles failed ·
  setup complete · setup incomplete · billing past due
- `/dev/app-harness/states` — extend the existing index so every one of the
  above is reachable from one page

Fixture series must reproduce the deltas in the reference screenshot so visual
diffs stay comparable: members 81, new 7d 25 (flat), stamps 7d 51 (−8),
rewards 7d 3 (−7).

---

## 13 — Test plan

**Unit** (`tests/unit/*.test.mjs`, node test runner via
`node scripts/ci/node-test-runner.mjs`):

- `console-nav` — every route → correct tab, including `?tab=` and all aliases
- `activity-grouping` — collapse threshold, category exclusions, date-group
  boundaries, ordering, reward rows never collapsing
- `dashboard-trends` — the reworded `formatMetricTrendLabel`, plus the
  suppressed-delta and zero/zero cases
- `numbers-nav` — the `[metric]` union rejecting unknown values
- Low-data banding — the `< 3` / `3–13` / `>= 14` boundaries

**Contracts** (`tests/contracts/`): the §11 event names and payload shapes.

**E2E** (`tests/e2e/`, mobile + `.desktop` pair sharing one `*-flow.ts`, matching
the existing file convention):

- `merchant-console-shell` — tab navigation, active state, pinned action never
  scrolls off at 320×568, rail at 1024, `/app/more` redirect at 900
- `merchant-counter` — present open/close, Escape, focus return, reveal, reset
  confirm + cancel, paused QR not tappable
- `merchant-numbers` — range change, day selection by column and by stepper,
  `aria-live` readout, low-data bands, metric detail routing and `notFound()`
- `merchant-activity-grouping` — group expand, filter + load-more interaction

**A11y** `@a11y`: the five routes above, both projects.

**Visual** `@visual`: 320 · 375 · 430 · 768 · 1024 for Counter, Numbers and
More, plus one greyscale pass over the delta receipt.

**Budgets:** `pnpm bundle:check` — the tab bar is a new always-loaded client
component, so watch the `/app` first-load JS. Removing `SidebarProvider` from
`/app` should net it out or better. `pnpm lighthouse` — CLS must not regress;
the skeletons in §6.5 are the mechanism.

---

## 14 — Delivery lanes

Each lane is a separate PR, green on `pnpm quality:fast` before it opens.

| Lane                    | Scope                                                                                                                                                                              | Reviewable because                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| **L1 — nav model**      | `console-nav.ts` + `merchantTabItems` + `isActiveNavItem` extension + unit tests. No UI                                                                                            | Pure functions, fully tested, zero visual risk            |
| **L2 — shell**          | Four-row grid, `MerchantTabBar`, rail at 900, top bar, skip link. Existing pages render unchanged inside it                                                                        | One structural change, visible everywhere, easy to revert |
| **L3 — Counter**        | `PresentableQrCard`, `TeamCodePanel`, `ResetCodeSheet`, present mode, pinned scanner. Metrics + activity **move out** to their new routes in the same PR so `/app` is never broken | The screen the whole rebuild is for                       |
| **L4 — Numbers**        | `/app/numbers`, `ColumnChart`, delta receipt, range selector, low-data bands                                                                                                       | New route; nothing existing regresses                     |
| **L5 — Numbers detail** | `/app/numbers/[metric]` + breakdowns that have queries behind them                                                                                                                 | Additive                                                  |
| **L6 — Activity**       | Grouping function + feed rework + filters/scope                                                                                                                                    | Isolated to one route                                     |
| **L7 — More**           | `/app/more` + live subtitles + 900px redirect                                                                                                                                      | Isolated                                                  |
| **L8 — sweep**          | Skeletons, harness pages, visual + a11y suites, bundle/Lighthouse, `SidebarProvider` removal from `/app`, dead-code pass                                                           | `pnpm quality:check`                                      |

Lanes 4–7 are independent of each other once L2 and L3 land. L8 last, always.

---

## 15 — Definition of done

- [ ] `pnpm quality:check` green
- [ ] `pnpm tokens:check`, `test:a11y`, `test:visual`, `bundle:check` green
- [ ] No hex literal in `app/`, `components/`, `lib/`
- [ ] Every §7 row has a harness fixture and an assertion
- [ ] No horizontal scroll at 320, 360, 375, 390, 414, 430, 600, 768, 900, 1024, 1280
- [ ] 200% text zoom clips nothing on any of the four tabs
- [ ] Primary action reachable without scrolling on every screen that has one
- [ ] Vermillion appears at most twice per viewport (§10)
- [ ] Every trend and status readable in greyscale
- [ ] Present mode and every sheet trap focus, close on Escape, restore focus
- [ ] Every screen keyboard-operable end to end
- [ ] No number on any Numbers screen without a query behind it
- [ ] `AGENTS.md` updated if any boundary or convention moved

---

## 16 — Out of scope, and things to ask about first

**Out of scope:** the customer journey (`/home`, `/card`, `/claim`, `/pass`),
`/admin`, marketing routes, the poster print pipeline, onboarding and launch
flows, billing checkout, dark theme (DESIGN.md: "No dark theme" for this
surface — `globals.css` has a dark block; do not wire it up here).

**Ask before doing any of these** — each changes product behaviour, not
presentation:

1. **Adding a metric that has no query.** Ship the screen without it.
2. **Changing what a metric counts.** Rewording a label is fine; changing the
   denominator is a product decision.
3. **Removing `/app/qr` as a standalone route.** Posters and NFC assets link to
   it; it stays until someone checks the printed material.
4. **Changing team-code rotation semantics** (the 5am boundary, the rotation
   grace period). Presentation only.
5. **Dropping `SidebarProvider` from anything outside `/app`.** `AdminShell`
   consumes it.
6. **Any change to `lib/merchant/dashboard-query.ts`.** It has a performance
   profile (`pnpm perf:stress`, `scripts/seed-stress.mjs`) that this rebuild
   should not disturb.

---

## Appendix A — Reuse inventory

| Need                       | Use                                                                                   | Path                                                         |
| -------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Button, all variants/sizes | `Button`                                                                              | `components/ui/button.tsx`                                   |
| Sheet / bottom sheet       | `Sheet`                                                                               | `components/ui/sheet.tsx`                                    |
| Toast                      | `sonner`                                                                              | `components/ui/sonner.tsx`                                   |
| Empty state                | `Empty`, or brand `EmptyState`                                                        | `components/ui/empty.tsx`, `components/brand/typography.tsx` |
| Inline error / notice      | `Alert`                                                                               | `components/ui/alert.tsx`                                    |
| Loading                    | `Skeleton`, `Spinner`                                                                 | `components/ui/{skeleton,spinner}.tsx`                       |
| Mono receipt label         | `MonoTag`                                                                             | `components/brand/mono-tag.tsx`                              |
| Receipt-edged card         | `ReceiptCard`                                                                         | `components/brand/receipt-card.tsx`                          |
| Category filter            | `FilterPills`                                                                         | `components/brand/filter-pills.tsx`                          |
| Venue identity mark        | `VenueMark`                                                                           | `components/brand/venue-mark.tsx`                            |
| Icons (HugeIcons)          | `Icon`, `icons.ts`                                                                    | `components/brand/`                                          |
| Sparkline / trend          | `Sparkline`, `TrendChart`                                                             | `components/data/`                                           |
| Show-more list             | `ShowMoreList` (import from the file — not re-exported by `components/data/index.ts`) | `components/data/show-more-list.tsx`                         |
| Stat strip                 | `StatStrip`                                                                           | `components/data/stat-strip.tsx`                             |
| Bottom tab bar precedent   | `CustomerTabBar`                                                                      | `components/layout/customer-tab-bar.tsx`                     |
| Per-stream error isolation | `StreamErrorBoundary`                                                                 | `components/merchant/stream-error-boundary.tsx`              |
| Copy-to-clipboard          | `CopyUrlButton`                                                                       | `components/merchant/copy-url-button.tsx`                    |
| Present QR                 | `PresentQr`                                                                           | `components/merchant/present-qr.tsx`                         |
| Code reveal                | `VenueCodeReveal`                                                                     | `components/merchant/venue-code-reveal.tsx`                  |
| Scanner                    | `MerchantRewardScanner`                                                               | `components/merchant/merchant-reward-scanner.tsx`            |
| Trends / deltas            | `dashboard-trends.ts`                                                                 | `lib/merchant/`                                              |
| Activity view-model        | `activity-display.ts`                                                                 | `lib/merchant/`                                              |
| QR pause states            | `qr-pause-state.ts`                                                                   | `lib/merchant/`                                              |
| Team code                  | `venue-code.ts`                                                                       | `lib/merchant/`                                              |
| Readiness                  | `launch-readiness*.ts`                                                                | `lib/merchant/`                                              |
| Billing copy               | `billing-status-copy.ts`                                                              | `lib/merchant/`                                              |

## Appendix B — Token cheat sheet

Surfaces `bg-paper` / `bg-card` / `bg-paper-deep` · text `text-ink` /
`text-ink-soft` · lines `border-ink` (2px) / `border-line` / `border-line-strong`
(dashed) · accent `bg-primary` + `text-primary-foreground` · second ink
`text-cobalt` · shadows `shadow-2xs` → `shadow-2xl`, all hard offsets, never
blurred · radii `rounded-lg` (10px) for buttons/inputs/cards/keys,
`rounded-3xl`-family for sheet tops, `rounded-full` for the stamp family only ·
containers `max-w-customer` (410px), `max-w-merchant` (1152px) · motion
`duration-[var(--w-dur-fast)] ease-[var(--w-ease)]` with
`motion-reduce:transition-none`.

Type: Bricolage Grotesque (`font-sans` / `font-heading`) for everything human;
Space Mono (`font-mono`) uppercase `tracking-[0.06em]` for the receipt register.
Nothing renders below 10px — `pnpm tokens:check` enforces it.

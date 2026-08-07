# Nabaperks — UX/UI Redesign Audit: Internal Admin / Back-Office & Shared Data Display

**Scope:** `app/admin/**`, `components/admin/**`, `components/data/**`,
`components/layout/admin-shell.tsx`, `app/dev/design-system/**`, `app/dev/app-harness/**`
**Method:** read-only source review of JSX + `className` strings against `DESIGN.md` (Wet Ink) and
`app/globals.css`. No files were modified; no builds or tests were run.
**Reference contract used:** 4px base unit, 14px card gap / 22px section gap, `max-w-merchant`
(72rem) for consoles, 2px ink borders, hard non-blurred offset shadows, 10px radius (18px sheets),
two dashed tones only (`--w-line` 18% / `--w-line-strong` 50%), one focus recipe, one input story
(`Input`/`Textarea`/`SelectField` + `FormField`), 44px tap floor, mono micro-type limited to
`.mono-meta` (11.5px) and `.mono-id` (10px).

---

## 0. Headline: the console is far taller than it needs to be

Rough stacked-height estimates from the markup (desktop >=1280px, default readbacks):

| Route | Structure | Est. height |
|---|---|---|
| `/admin/privacy` | PageTitle + **4 stacked panels**, 25 record cards x2 panels, feed, 25-row table, **3 independent paginators** | **~13,000-14,000px** desktop, ~20,000px+ on phone |
| `/admin/merchants` | PageTitle + 100-row table + **100 QR `AdminRecordCard`s in a plain grid** (no pagination, no reveal) | **~20,000px+** at every breakpoint |
| `/admin/customers` | 25-row membership table where **every desktop row embeds a 2-field + submit form (~160px/row)** + 25-row rewards table with per-row cancel forms | **~7,000-8,000px** |
| `/admin/fraud` | 100 flags x a row containing **two full `AdminActionForm`s, each with a required text input** (~250px/row) | **~26,000px** |
| `/admin/audit` | 100 unpaginated rows, no filters, no sticky header | ~6,000px |
| `/admin/billing` | 100 rows; phone card renders **11 stacked label/value fields** (~800px/card) | ~8,000px desktop, ~80,000px phone |
| `/dev/design-system` | 9 `gap-12` sections, 992 lines of demos, **no table of contents** | ~15,000px |

The pattern behind all of it is identical: **one panel per concern, stacked vertically, with every
per-record write form rendered inline and expanded.** Every fix below is a variant of four moves —
**tabs/segmented views instead of stacked panels**, **row expansion instead of inline forms**,
**pagination/reveal on every list**, and **two-column density on md+**.

---

## A. Admin shell, navigation and wayfinding

### 1. Admin sidebar cannot be collapsed on desktop, and its width fights the table breakpoint
- **File(s):** `components/layout/admin-shell.tsx:40` (`<Sidebar collapsible="offcanvas">`), `:83-90` (trigger only inside the `md:hidden` header), `components/layout/console-sidebar-nav.tsx:19-23` (`--sidebar-width: 17rem`); contrast `components/layout/merchant-app-shell.tsx:118` (`collapsible="icon"`) and `:127-131` (a desktop `SidebarTrigger`).
- **Current UX/UI Problem:** the admin `Sidebar` is `offcanvas`, so at `md+` it renders as a fixed 272px rail (`fixed inset-y-0 w-(--sidebar-width) md:flex`) with **no trigger anywhere on desktop** — the only `SidebarTrigger` lives in the `md:hidden` header. On a 1280px laptop the content column is `1280 - 272 - 48 (px-6) ~= 960px`, yet every admin `DataTable` switches from cards to the semantic table at `cardBreakpoint="xl"` — a **viewport** query at 1280px.
- **Why It Is a Problem:** the console renders 6-7 column tables into ~960px exactly at the width where it decides they fit. Combined with `TableCell`'s inherited `whitespace-nowrap` (finding 59) this guarantees horizontal scrolling on the most common admin viewport, and the operator has no way to reclaim the 272px. It also diverges from the merchant console, which can collapse.
- **Recommended Redesign:** switch to `collapsible="icon"`, add the same `hidden shrink-0 md:flex` `SidebarTrigger` to `SidebarHeader` that `merchant-app-shell.tsx:127` uses, and persist via the existing sidebar cookie. Then move `DataTable`'s breakpoint off the viewport: wrap the panel body in `@container` and use `@6xl:block` / `@6xl:hidden` so the table appears when *the panel* is wide enough, not the window.
- **Priority:** Critical

### 2. Admin content column uses an unsanctioned max width
- **File(s):** `components/layout/admin-shell.tsx:102-103` (`px-4 py-8 sm:px-6` -> `mx-auto w-full max-w-7xl`).
- **Current UX/UI Problem:** `max-w-7xl` (80rem/1280px) is a raw Tailwind value; `DESIGN.md` mints `--container-merchant: 72rem` and the `max-w-merchant` utility for exactly this job, used at `merchant-app-shell.tsx:184`.
- **Why It Is a Problem:** the two consoles measure differently for no product reason and the 80rem value is outside the token contract, so it will drift again. Panel descriptions also run past the `max-w-2xl` that `SectionHeader` assumes.
- **Recommended Redesign:** use `max-w-merchant`, or mint `--container-admin` in `globals.css` and record it in `DESIGN.md`'s spacing block. Keep the `px-4 py-8 sm:px-6` rhythm — that part already matches merchant.
- **Priority:** Medium

### 3. The MFA banner is a permanent, non-actionable strip on every admin page
- **File(s):** `components/layout/admin-shell.tsx:91-101` (`role="status"` ... `border-b-2 border-ink bg-reward/12 px-4 py-3 text-sm font-semibold`).
- **Current UX/UI Problem:** "MFA enforcement is enabled for this admin session." renders full-width above the content on every route, always, with no dismiss and no link — ~49px plus border, forever.
- **Why It Is a Problem:** a banner that never changes is banner-blindness fuel; it also devalues the identical treatment (`bg-reward/12` + 2px ink) that `AdminActionForm` uses for real success messages (`components/admin/action-form.tsx:51`), so a genuine "Stamps adjusted" reads as chrome. `role="status"` on a static string is noise on every navigation.
- **Recommended Redesign:** demote to a `MonoTag tone="leaf"` in the sidebar footer beside the existing "AAL2 verified" chip (they say the same thing) and delete the strip. If a page-level signal is required, render it only for an *unsatisfied* state.
- **Priority:** High

### 4. Sidebar footer is three decorative marketing chips, and there is no sign-out
- **File(s):** `components/layout/admin-shell.tsx:18-22` (`supportStatusItems`), `:54-80`.
- **Current UX/UI Problem:** the footer stacks five `MonoTag`s — operator email, "Service-role readbacks", "Audited support actions", "MFA-aware access", "AAL2 verified" — about 170px of sidebar. Three are static product claims, not state. There is **no log-out control at all** (merchant has one at `merchant-app-shell.tsx:143-155`) and no link to `/admin/security` in the account area.
- **Why It Is a Problem:** an internal console's footer should carry identity and session controls, not copy. An operator on a shared machine cannot end an admin session from within the console.
- **Recommended Redesign:** replace with an account block: truncated operator email with `title`, one `MonoTag tone="leaf"` for AAL state, a "Security" link, and `<form action={signOutAction}><Button variant="secondary" className="w-full justify-start">` matching the merchant shell. Delete `supportStatusItems`.
- **Priority:** High

### 5. Sidebar has 11 flat nav items with no grouping
- **File(s):** `components/layout/console-nav.ts` `adminNavItems` (11 entries), consumed at `components/layout/admin-shell.tsx:45-49`; `console-sidebar-nav.tsx:45-61` already supports `secondaryItems`/`secondaryLabel`, which admin does not pass.
- **Current UX/UI Problem:** Overview, Pilot, Evidence, Merchants, Customers, Referrals, Billing, Privacy, Fraud, Audit, Security render as one undifferentiated `min-h-12` list about 570px tall.
- **Why It Is a Problem:** the items span three unrelated jobs (support/lookup, commercial/analytics, compliance/security). A flat list makes scanning positional rather than semantic and will not survive the next two routes.
- **Recommended Redesign:** use the existing group support: **Support** (Overview, Merchants, Customers, Billing, Referrals), **Insight** (Pilot, Evidence), **Compliance** (Privacy, Fraud, Audit, Security) via `secondaryItems`/`secondaryLabel` and `SidebarGroupLabel`.
- **Priority:** Medium

### 6. No global search / command palette; five routes have no filter at all
- **File(s):** `components/admin/lookup-controls.tsx:21-69` is mounted only at `app/admin/customers/customer-memberships-panel.tsx:51` and `app/admin/privacy/data-request-workflow-panel.tsx:53`. `merchants`, `audit`, `fraud`, `referrals`, `billing` mount no search.
- **Current UX/UI Problem:** to find one merchant an operator loads `/admin/merchants`, which returns the newest 100 rows (`lib/admin/data.ts` `getAdminMerchants().limit(100)`) with no filter, no pagination and no total, then browser-finds by eye.
- **Why It Is a Problem:** the most common admin task (find this venue / this event) is unsupported on 5 of 11 routes, and the 100-row cap is invisible, so an operator can conclude a merchant "does not exist".
- **Recommended Redesign:** promote `AdminLookupControls` to a shell-level sticky filter bar under the page title (`sticky top-0 z-20 bg-background/95`), give every list route a lookup plus `AdminLookupPagination`, and add a Cmd-K palette over the same query params. At minimum print "showing newest 100 of N" wherever a hard `.limit(100)` exists.
- **Priority:** Critical

---

## B. `/admin` overview

### 7. The overview repeats the entire sidebar as a button grid
- **File(s):** `app/admin/page.tsx:132-143`.
- **Current UX/UI Problem:** all `adminNavItems` render again as `variant="secondary"` buttons in `sm:grid-cols-2 lg:grid-cols-4` — 11 links, about 160px. The adjacent comment still says "8 nav links", so it is stale by three items and the `lg:grid-cols-4` rationale no longer matches the row count.
- **Why It Is a Problem:** duplicated navigation with no added information (no counts, no state, no recency), below the fold of a page that already has a persistent sidebar. It is pure height.
- **Recommended Redesign:** delete the grid. If a hub is wanted, render 4-6 **task** cards with live counts ("3 billing issues", "2 open fraud flags", "1 overdue data request") linking into pre-filtered views.
- **Priority:** High

### 8. KPI tiles are dead ends and under-specified
- **File(s):** `app/admin/page.tsx:59-75`.
- **Current UX/UI Problem:** three `MetricTile`s (Merchants / Customers / Billing issues) in `sm:grid-cols-3`, none wrapped in a link, none carrying a `trend`, and "Billing issues" — the only actionable one — is styled identically to the two vanity counts.
- **Why It Is a Problem:** the one number an operator must act on has no affordance and no visual priority; clicking a KPI is the natural gesture and does nothing.
- **Recommended Redesign:** wrap each tile in a `Link` to its filtered route, give "Billing issues" a tone treatment (destructive wash plus a `StatusPill`), and pass `trend` where a delta exists. Consider `StatStrip` — it packs the same three numbers into ~90px rather than ~260px.
- **Priority:** Medium

### 9. Funnel panel's derived-metrics footer uses a one-off hairline
- **File(s):** `app/admin/page.tsx:87` (`border-t border-ink/20 pt-4`).
- **Current UX/UI Problem:** a 1px solid `ink/20` rule. Elsewhere the same job is done by `border-b` (1px `--border`) at `customers/customer-memberships-panel.tsx:42`, by `border-t-2 border-dashed border-ink/20` at `evidence/page.tsx:135`, and by `border-y border-dashed border-ink/30` at `app/dev/app-harness/trial/admin/page.tsx:29`. `.w-rule` — the sanctioned 2px dashed receipt rule — is used **zero times** in the admin tree.
- **Why It Is a Problem:** four rule treatments for one semantic ("divide a panel"), none of which is the documented one. `DESIGN.md` sanctions exactly two dashed tones; `ink/20` and `ink/30` are neither.
- **Recommended Redesign:** standardise on `<hr className="w-rule" />` inside panels and `border-b-2 border-ink` for panel-header separation. Delete `border-ink/20` and `border-ink/30`.
- **Priority:** Medium

---

## C. `/admin/customers`

### 10. Every desktop membership row embeds a live two-field write form
- **File(s):** `app/admin/customers/customer-memberships-panel.tsx:180-184` (column `action` -> `StampAdjustmentForm`), `:207-235`.
- **Current UX/UI Problem:** the `Audited action` column renders `AdminActionForm` with a `Delta` number input plus helper text, a `Reason` input and a 44px submit — a `min-w-[280px]` block about 160px tall — for **all 25 rows**. The mobile card folds the identical form behind `AdminRecordActions` (`:120-126`). `DESIGN.md` calls these "the same `StampAdjustmentForm`"; they are, but only one is progressively disclosed.
- **Why It Is a Problem:** about 4,000px of always-visible form for an action taken on maybe one row per session; 25 simultaneous focusable form groups wreck tab order; row height makes member scanning impossible; and 25 copies of "Positive adds stamps, negative removes them." is pure repetition.
- **Recommended Redesign:** make the desktop cell a single `Button variant="secondary" size="sm">Adjust` that expands an inline detail row (`<tr>` + `colSpan`) or opens a `Sheet`, reusing the `AdminRecordActions` exclusive-accordion `group` so only one row is open. Target row height about 56px; print the helper once, inside the disclosure.
- **Priority:** Critical

### 11. Reward cancellation renders its destructive form inline on every eligible row
- **File(s):** `app/admin/customers/customer-rewards-panel.tsx:154-166`, `:189-209`.
- **Current UX/UI Problem:** each eligible desktop row shows a `Reason` input, a two-line irreversibility helper, a required `AdminConfirmCheck` and a `variant="destructive"` submit — about 190px per row. Ineligible rows print the bare sentence "No action available" in the same column.
- **Why It Is a Problem:** 25 armed destructive controls on screen at once is a mis-click surface, not a safety design; the safety copy loses all weight through repetition; and the mixed "form vs sentence" column makes the table ragged.
- **Recommended Redesign:** collapse to `Button variant="destructive" size="sm">Cancel...` opening an `AlertDialog`/`Sheet` that holds reason + confirm check, so the danger copy appears exactly once at the moment of decision. Replace "No action available" with a muted em dash or `StatusPill tone="neutral"` so the column keeps one shape.
- **Priority:** Critical

### 12. Two panels, two paginators, one URL — and only one has a search box
- **File(s):** `app/admin/customers/page.tsx:47-78` (`page` + `rewardsPage` params), `customer-memberships-panel.tsx:51` (lookup) vs `customer-rewards-panel.tsx` (none).
- **Current UX/UI Problem:** the route owns two independently paginated lists. Paging Rewards re-renders the whole route and returns the operator to the top, above about 4,000px of memberships. Rewards cannot be searched at all, though the venue/contact fragment is already parsed.
- **Why It Is a Problem:** two paginators on one scroll surface is a classic orientation failure; the operator loses their place on every page change, and the shared search silently applies to only one list.
- **Recommended Redesign:** convert to a segmented view — `Memberships | Rewards` via `FilterPills` (`components/brand/filter-pills.tsx`, already in the system and unused in admin) driven by a `?view=` param — so exactly one list, one paginator and one search bar are on screen. Removes roughly half the page height.
- **Priority:** High

---

## D. `/admin/privacy` — the tallest page in the product

### 13. Four stacked panels with three independent paginators
- **File(s):** `app/admin/privacy/page.tsx:65-113` (`DataRequestWorkflowPanel` -> `UnaffiliatedCustomersPanel` -> `LoggedRequestsPanel` -> `ConsentLogPanel`), params `page` / `consentPage` / `unaffiliatedPage` at `:38-40`.
- **Current UX/UI Problem:** four full `AdminPanel`s in `grid gap-6`. Panel 1 renders up to 25 `AdminRecordCard`s (~230px each => ~5,750px), panel 2 up to 25 more (~170px each => ~4,250px), panel 3 an `ActivityFeed`, panel 4 a 25-row table with its own paginator. Estimated **~13,000-14,000px desktop**.
- **Why It Is a Problem:** nothing below panel 1 is discoverable; three paginators mutate one URL so each page change re-lays the whole document; and the four panels serve three jobs (service a request / find an orphan account / track SLA / read evidence) never needed simultaneously.
- **Recommended Redesign:** tabs — `Requests | Unaffiliated | Activity | Consent log` — driven by the URL (`?panel=requests`) so deep links survive, with the shared venue/contact lookup lifted into a page-level sticky filter bar above the tab strip. Each tab then owns one paginator; height drops to one screen plus one list. Keep `AdminPanel className="p-0"` where the body is a table so it stays flush.
- **Priority:** Critical

### 14. The lookup control filters a panel it does not sit in
- **File(s):** `app/admin/privacy/data-request-workflow-panel.tsx:53-57` (lookup inside panel 1); `unaffiliated-customers-panel.tsx:42` — the description literally reads "Filtered by the contact search at the top of the page."
- **Current UX/UI Problem:** panel 2's filtering affordance is thousands of pixels above it and visually owned by panel 1; the only signpost is a sentence.
- **Why It Is a Problem:** a control governing a region it is not adjacent to is a discoverability failure; the operator will assume panel 2 is unfiltered and mis-read an empty state as "no such customer".
- **Recommended Redesign:** promote the lookup to page level (finding 13) and show applied filters as dismissible chips (`MonoTag` + a remove control) directly above each filtered list, so scope is visible where results are.
- **Priority:** High

### 15. Privacy record cards make three raw UUID chips the loudest element
- **File(s):** `app/admin/privacy/data-request-workflow-panel.tsx:107-116`.
- **Current UX/UI Problem:** a `References` field renders three `AdminIdChip`s (`customer:`, `merchant:`, `membership:`) side by side, each an 8-hex-character truncation with a dotted underline.
- **Why It Is a Problem:** three near-identical mono strings dominate the card while being the least often needed; the dotted underline reads as a hyperlink but is a copy button; and an 8-character prefix is not safe to quote in a GDPR record.
- **Recommended Redesign:** move references behind the existing `AdminRecordActions` disclosure ("References"), or render one primary chip (membership) with the rest in a popover. Restyle `AdminIdChip` per finding 51.
- **Priority:** Medium

### 16. Two different write forms sit side by side in one disclosure with no headings
- **File(s):** `app/admin/privacy/data-request-workflow-panel.tsx:119-124` (`grid gap-4 xl:grid-cols-2` -> `ConsentOptOutForm` + `DataRequestForm`).
- **Current UX/UI Problem:** below `xl` the two forms stack with only `gap-4` and no headings — Channel/Reason/[Record opt-out] runs straight into Request type/Channel/Notes/[Log request]. `xl:grid-cols-2` is again a viewport query inside a card nested three levels deep, so at 1280px each column is about 330px.
- **Why It Is a Problem:** two unlabelled forms sharing a "Channel" field read as one form; submitting the wrong one writes the wrong audit record. That is a correctness risk, not just aesthetics.
- **Recommended Redesign:** give each form an `Eyebrow` heading ("Record consent opt-out" / "Log a data request") separated by `.w-rule`; switch the split to `@container` (`@2xl:grid-cols-2`); keep the differing submit variants and add the headings.
- **Priority:** High

### 17. Consent-log "Source" is a whole column of identical pills
- **File(s):** `app/admin/privacy/consent-log-panel.tsx:121-127` (desktop column), `:82-85` (mobile field).
- **Current UX/UI Problem:** every row renders `<SourceLabel>Source: {record.source}</SourceLabel>` — a pill whose first word is the constant "Source:" — while the panel header already carries `Source: consent_records` (`:35`).
- **Why It Is a Problem:** about 14 characters of constant text times 25 rows, in a column competing for width on a table that already overflows.
- **Recommended Redesign:** drop the "Source:" prefix inside rows (the header says it), render the value as plain mono text, and merge it into the `Channel` cell (`email . self_serve`). Reserve `SourceLabel` for panel headers.
- **Priority:** Low

---

## E. `/admin/merchants`

### 18. 100 QR records render as an unpaginated card wall
- **File(s):** `app/admin/merchants/page.tsx:243-266` (`qrCodes.map` into a plain `grid gap-3`), `:268-303` (`QrRecord`); data cap `lib/admin/data.ts getAdminQrCodes().limit(100)`.
- **Current UX/UI Problem:** unlike every other admin list, QR records do not use `DataTable`, have no pagination, no `ShowMoreList`, no search and no breakpoint switch — 100 `AdminRecordCard`s (about 200px each with their disclosure) at **all** widths, roughly 20,000px, appended below a 100-row merchant table.
- **Why It Is a Problem:** the page is effectively infinite; the `#qr-records` cross-link from a merchant row (`:111`) jumps about 8,000px with no return path; finding one venue's QR is a manual scroll.
- **Recommended Redesign:** convert to `DataTable` with `cardBreakpoint="xl"`, `mobilePageSize={10}` and columns `QR id . Merchant . State . Created . Actions`, plus a venue lookup and `AdminLookupPagination`. Better still, make QR records a tab on this page (`?view=accounts|qr`) so the two lists never co-exist, and have the cross-link switch tabs.
- **Priority:** Critical

### 19. Destructive styling is inverted between the two QR controls
- **File(s):** `app/admin/merchants/page.tsx:305-335` (`QrStateForm`: `variant={nextActive ? "secondary" : "destructive"}`, **no** `AdminConfirmCheck`) vs `:337-354` (`RegenerateQrForm`: `variant="secondary"` **with** `AdminConfirmCheck`).
- **Current UX/UI Problem:** "Disable QR" — reversible, and the helper itself says "the QR can be re-enabled later" — gets the destructive silhouette and no confirmation. "Regenerate QR" — which permanently invalidates every printed poster in the venue — gets the neutral secondary silhouette, with the confirm checkbox carrying the entire warning load.
- **Why It Is a Problem:** the colour system tells the operator the opposite of the truth. `DESIGN.md` makes the destructive silhouette semantic ("the different silhouette says danger before the copy does"); here it says danger on the safe action.
- **Recommended Redesign:** `Regenerate QR` -> `variant="destructive"`, keep the confirm check, move it behind a confirm dialog. `Disable QR` -> `variant="secondary"` with a short confirm check ("Scans stop immediately"). `Enable QR` stays `secondary`.
- **Priority:** Critical

### 20. Cross-links are four 12px underlined words with no tap target
- **File(s):** `app/admin/merchants/page.tsx:83-116` (`text-xs`, `focus-ring rounded-sm`, `gap-x-3 gap-y-1`), duplicated near-verbatim at `app/admin/billing/page.tsx:23-44`.
- **Current UX/UI Problem:** Members / Billing / Privacy / QR records render as `text-xs` primary-coloured underlined links inside the first table cell, with no `min-h`, no icon and no `[@media(pointer:coarse)]:min-h-11` — unlike every other compact control in the system.
- **Why It Is a Problem:** four adjacent ~16px-tall targets fail the 44px coarse-pointer floor the contract sets, and four stacked links under the business name make the merchant column the visual centre of gravity of the table.
- **Recommended Redesign:** extract one `AdminCrossLinks` component (the billing copy is a duplicate) rendering `Button variant="link" size="xs"` items, which already carry the coarse-pointer floor, or move the links into a row-level "Open" menu. Reduce to two (Members, Billing) and put the rest in the row detail.
- **Priority:** High

### 21. Merchants page has no lookup, no pagination and no total
- **File(s):** `app/admin/merchants/page.tsx:55-75`; `lib/admin/data.ts getAdminMerchants().limit(100)`.
- **Current UX/UI Problem:** the merchant list is the console's spine and is the only major list with no `AdminLookupControls`, no `AdminLookupPagination` and no row count — while `/admin/customers` and `/admin/privacy` both search *by merchant name*.
- **Why It Is a Problem:** an operator cannot answer "is this venue on the platform?" without scrolling; past 100 merchants the answer becomes silently wrong.
- **Recommended Redesign:** reuse `AdminLookupControls basePath="/admin/merchants"` with a `venue` param plus `AdminLookupPagination` (both already generic), and surface `meta.total` in the panel header as a `MonoTag`.
- **Priority:** High

---

## F. `/admin/billing`

### 22. The mobile billing card is an 11-field wall
- **File(s):** `app/admin/billing/page.tsx:192-259` (11 `fields` entries), rendered by `components/admin/record-card.tsx:57-74` (`dl grid gap-2.5`, label above value).
- **Current UX/UI Problem:** every field is a two-line `dt`/`dd` stack, so one card is about 22 lines / 800px before its `BillingFulfilmentActions` disclosure. With 100 rows and **no `mobilePageSize`**, the phone view is tens of thousands of pixels.
- **Why It Is a Problem:** no operator reads 11 labelled fields per merchant; the decision-relevant ones (status, fulfilment, period end) are buried among Stripe refs.
- **Recommended Redesign:** cut to 4 headline fields plus a "Details" `AdminRecordActions` disclosure holding the rest; add `mobilePageSize={10}`; and give `AdminRecordCard` an inline layout option (`grid-cols-[minmax(0,8rem)_1fr] items-baseline`) which alone halves card height.
- **Priority:** High

### 23. The desktop "Launch fulfilment" cell stacks four `text-xs` lines
- **File(s):** `app/admin/billing/page.tsx:140-167` (`grid min-w-48 gap-2` with a `StatusPill` plus three `text-xs` lines).
- **Current UX/UI Problem:** each row prints Delivery / Pilot end / Stripe sync as three 12px muted lines; with the `Stripe refs` column (`:168-179`, two more mono lines) and the `Controls` disclosure, the table has three multi-line columns and a comfortable minimum width well past the ~960px it gets (finding 1).
- **Why It Is a Problem:** 12px muted text is the wrong register for dates an operator must verify, and the horizontal pressure forces the nowrap scroll.
- **Recommended Redesign:** keep only the `StatusPill` plus the single most decision-relevant date; move the rest into the row's `Details` disclosure. Use `.mono-meta` for dates rather than `text-xs` muted so printed facts are typographically distinct from prose.
- **Priority:** Medium

### 24. Stripe references are plain text, not copyable chips
- **File(s):** `app/admin/billing/page.tsx:171-178` (`font-mono text-xs` spans), mobile equivalents `:239-248` (`mono: true`).
- **Current UX/UI Problem:** the two identifiers an operator most often pastes into the Stripe dashboard are the only ids in the console rendered as plain mono, while audit and privacy ids get `AdminIdChip` with click-to-copy.
- **Why It Is a Problem:** inconsistent identifier affordance; the operator hand-selects an id inside a horizontally scrolling cell.
- **Recommended Redesign:** render both through `AdminIdChip` (`prefix="sub"` / `prefix="cus"`) and make `AdminIdChip` the single id renderer for the console.
- **Priority:** Medium

### 25. Billing panel header is a lone source pill with no title
- **File(s):** `app/admin/billing/page.tsx:78-83` (`<div className="border-b p-5"><SourceLabel>...</SourceLabel></div>`).
- **Current UX/UI Problem:** unlike every sibling panel there is no `SectionHeader` — just a 1px-bordered strip containing a provenance pill, so the header block is about 60px of nothing.
- **Why It Is a Problem:** breaks the panel anatomy (eyebrow/title/description/actions) the rest of the console teaches, and wastes a header row.
- **Recommended Redesign:** add `<SectionHeader title="Subscriptions & poster fulfilment" description="..." actions={<SourceLabel>...</SourceLabel>} />` to match merchants/customers/privacy.
- **Priority:** Low

---

## G. `/admin/audit`

### 26. 100 log rows, no filter, no pagination, no sticky header
- **File(s):** `app/admin/audit/page.tsx:22-138`; `lib/admin/data.ts getAdminAuditLogs(limit = 100)`.
- **Current UX/UI Problem:** the audit table renders 100 rows (`mobilePageSize={10}` covers phones only) with no filter on action, actor, merchant or date, and `TableHeader` does not stick, so column meaning is gone after about 8 rows of scroll.
- **Why It Is a Problem:** an audit log is a search surface by definition ("what did operator X do to merchant Y last Tuesday?"). Without filters or a date range it only answers "what happened most recently".
- **Recommended Redesign:** add `FilterPills` for action category (support / privacy / security / billing), a date-range pair and `AdminLookupPagination`; make the header `sticky top-0 z-10 bg-secondary` inside the scroll container; paginate desktop as well as phone.
- **Priority:** High

### 27. Action names ship raw and snake_cased
- **File(s):** `app/admin/audit/page.tsx:96` (`<span className="font-bold">{log.action}</span>`), mobile card title `:60`.
- **Current UX/UI Problem:** `data_request_logged`, `customer_pii_erased` print as-is in bold Bricolage, while the fraud panel humanises the same class of value (`fraud-flags-panel.tsx:73` `flag.signal.replaceAll("_", " ")`) and privacy does too (`logged-requests-panel.tsx:96`).
- **Why It Is a Problem:** snake_case in the display face is a register violation (mono is the printed voice, Bricolage the spoken one), and the same data reads three ways on three pages.
- **Recommended Redesign:** one `formatAdminAction()` helper in `components/admin/support.tsx` used by audit, fraud, privacy and the overview feed; render the raw key as `.mono-id` beneath where operators need the exact token.
- **Priority:** Medium

---

## H. `/admin/fraud`

### 28. Every flag row carries two complete write forms — about 250px per row, 100 rows
- **File(s):** `app/admin/fraud/fraud-flags-panel.tsx:121-125` (`Review` column), `:189-247` (`FraudFlagActions` -> two `FraudFlagResolutionForm`s, each an `AdminField` + required `Input` + `SubmitButton`).
- **Current UX/UI Problem:** the desktop table renders "Review reason" + input + `Mark reviewed` (filled vermillion primary) **and** "Dismissal reason" + input + `Dismiss` for every row, in a `min-w-56` cell. The mobile card folds the pair behind a disclosure (`:151-155`), so again only one mode is disclosed.
- **Why It Is a Problem:** roughly 26,000px of page; 200 focusable inputs; 100 filled-primary buttons marching down the page, destroying the "one filled red equals the action" rule in `DESIGN.md`; and severity cannot be scanned because rows are 250px apart.
- **Recommended Redesign:** replace the cell with one `Button variant="secondary" size="sm">Review...` opening a row expansion or `Sheet` containing both outcomes as a single form with a `reviewed | dismissed` choice and one reason field. Row height target about 64px. Add bulk selection so a burst of identical low-severity flags can be dismissed together.
- **Priority:** Critical

### 29. Warning and danger tones are visually indistinguishable
- **File(s):** `components/admin/support.tsx:122-130` (`warning` -> `bg-primary/15`, `danger` -> `bg-destructive/15`), consumed at `fraud-flags-panel.tsx:37-45` (`medium` -> warning, `high` -> danger) and `merchants/page.tsx:40-49`.
- **Current UX/UI Problem:** the warning wash is a 15% tint of vermillion `#cf330a` and the danger wash a 15% tint of `#c0301c` — colours `DESIGN.md` itself records as sitting **~1.1:1 apart**. At 15% over card they are effectively one swatch; only the `STATUS_PILL_ICON` glyph differs.
- **Why It Is a Problem:** severity triage by scan — the entire point of the fraud page — does not work. The same collision hits merchant account status (paused vs cancelled) and billing tones.
- **Recommended Redesign:** move `warning` to the sun spot ink (`bg-seal/20 text-foreground`, the documented attention ink) and keep `danger` on destructive; keep both icons; verify each wash holds >=3:1 non-text contrast on card. Document the four tones in `/dev/design-system`.
- **Priority:** High

### 30. Status pills and provenance labels are the same object
- **File(s):** `components/admin/support.tsx:94-109` (`SourceLabel`: `border-ink bg-secondary text-muted-foreground`) vs `:111-135` (`StatusPill` neutral: `border-ink bg-secondary text-secondary-foreground`).
- **Current UX/UI Problem:** a neutral status pill and a "Source: audit_logs" provenance pill share mono face, border and background, differing only in text colour. On `consent-log-panel.tsx` and `pilot/page.tsx` both appear in the same row.
- **Why It Is a Problem:** state and metadata must not share a silhouette; the operator cannot pre-attentively separate "this record is pending" from "this data came from a table".
- **Recommended Redesign:** give `SourceLabel` a quieter, distinct treatment — no border, `.mono-id`, `text-muted-foreground`, a small database glyph — and reserve the bordered pill exclusively for state.
- **Priority:** Medium

### 31. No filters on a triage surface; resolved and open flags interleave
- **File(s):** `app/admin/fraud/page.tsx:10-26`, `fraud-flags-panel.tsx:105-108` (status is a display-only column).
- **Current UX/UI Problem:** flags arrive newest-first regardless of status or severity; there is no default "open only" view and no severity filter, though `FilterPills` exists in the brand layer and is used nowhere in admin.
- **Why It Is a Problem:** the operator scrolls past resolved flags to find work, and high-severity items have no priority position.
- **Recommended Redesign:** default to `status=open`, expose `FilterPills` for `Open / High / All` with counts (the component supports `count`), and sort by severity then recency.
- **Priority:** High

### 32. Redemption-failures panel is three columns of almost nothing
- **File(s):** `app/admin/fraud/redemption-failures-panel.tsx:30-94`.
- **Current UX/UI Problem:** a full `AdminPanel` + `SectionHeader` + `DataTable` (with `xl` card mode and a mobile card renderer) to display Event / Merchant / When — three short values.
- **Why It Is a Problem:** about 350px of chrome for a list that is structurally an activity feed, and it is the second stacked panel making the fraud page taller.
- **Recommended Redesign:** render as `ActivityFeed` (title = event, description = merchant, `timestamp`), or make it the second tab of a `Flags | Failures` segmented view.
- **Priority:** Medium

---

## I. `/admin/referrals`

### 33. Referral rows print unmasked customer emails, breaking the console-wide masking rule
- **File(s):** `app/admin/referrals/referral-ops-panel.tsx:65-69` (`row.referrerEmail`, `row.referredEmail`) and `:127-128`; contrast `maskAdminCustomer` used on customers, privacy, audit, fraud and the overview.
- **Current UX/UI Problem:** every other admin surface renders customer contact through `maskAdminCustomer()` (`components/admin/support.tsx:189-196`) producing `jo***@domain`; the referral panel prints both parties' full addresses at `text-xs`.
- **Why It Is a Problem:** an inconsistency in a privacy control is a privacy incident waiting to happen, and it teaches operators that masking is decorative. It is also the only place raw PII sits at 12px.
- **Recommended Redesign:** route both through `maskAdminCustomer({ email })`, with reveal behind an explicit audited action if full contact is genuinely required.
- **Priority:** Critical

### 34. Referral state tones never signal success, and the whole table is 12px
- **File(s):** `referral-ops-panel.tsx:19-25` (`statusTone` returns only `neutral | warning | danger`), `:64`, `:90`, `:114` (`text-xs leading-5`).
- **Current UX/UI Problem:** an awarded or qualified referral renders as a neutral grey pill — there is no `good` branch — while merchants and privacy both use `tone="good"`. Four of five columns render at `text-xs`, including the identity column.
- **Why It Is a Problem:** the happy path is invisible, so the operator cannot see at a glance whether settlement is working. 12px is below the 13.5px `small` size the type contract sets for anything that is not mono metadata.
- **Recommended Redesign:** add `awarded`/`qualified` -> `"good"`; lift row text to `text-sm` and reserve `text-xs`/`.mono-meta` for timeline and counters; add a status filter and pagination — this list is also capped at 100 with no indication.
- **Priority:** Medium

---

## J. `/admin/pilot` and `/admin/evidence`

### 35. The evidence capture form is a 13-field wall above the ledger it produces
- **File(s):** `app/admin/evidence/page.tsx:51-154` — four field groups (`md:grid-cols-2 xl:grid-cols-4`, `lg:grid-cols-2` with four `Textarea`s, `md:grid-cols-3`, then a `sm:grid-cols-[minmax(0,1fr)_220px_auto]` footer).
- **Current UX/UI Problem:** one always-expanded form with 13 controls including four textareas, roughly 900-1,100px, rendered *above* the "Evidence ledger" the operator usually came to read. There is no step structure, no draft indication, and the merchant-approval checkbox — the legal gate — is a 16px native checkbox in the footer row (`:136-143`).
- **Why It Is a Problem:** capture is occasional and reading is frequent, yet the frequent task sits below a screen of form. The approval gate carries the least visual weight on the page despite being the highest-consequence control.
- **Recommended Redesign:** put capture behind a "Capture an evidence case" button opening a `Sheet`, or split into `Ledger | Capture` tabs with Ledger default. Inside, use three steps (Subject & window -> Narrative -> Sources & approval) with `Eyebrow` step headers and `.w-rule` separators, and promote the approval gate into a bordered `StatusBanner tone="warning"` with a proper `Checkbox`.
- **Priority:** High

### 36. Evidence ledger cards bury a long narrative inside a stacked `dl`
- **File(s):** `app/admin/evidence/page.tsx:163-207` (`lg:grid-cols-2` of `AdminRecordCard`, an `After` field carrying up to 1,200 characters, plus a `Reproducibility` field concatenating version + truncated hash + date).
- **Current UX/UI Problem:** `AdminRecordCard` renders every `dd` at `text-muted-foreground` (`record-card.tsx:66`), so a 1,200-character narrative prints as muted body text in a label/value list, and `metric_snapshot_hash.slice(0, 12)...` is plain text rather than an `AdminIdChip`, so it cannot be copied.
- **Why It Is a Problem:** the card format is designed for short values; a paragraph in a `dd` produces wildly uneven heights in a 2-col grid and unreadable hierarchy, and the reproducibility handle is unusable.
- **Recommended Redesign:** give the narrative its own block below the `dl` (foreground colour, `text-sm leading-6`, `line-clamp-4` plus a "Read more" disclosure), render the hash via `AdminIdChip`, and add a `body` slot to `AdminRecordCard` for exactly this.
- **Priority:** Medium

### 37. The pilot note form is a fixed 4-track grid inside a nested card
- **File(s):** `components/admin/pilot-note-fields.tsx:37-84` (`sm:grid-cols-2 xl:grid-cols-[220px_160px_minmax(0,1fr)_auto]`), mounted at `app/admin/pilot/page.tsx:178-188` inside `AdminRecordActions` inside `AdminRecordCard` inside `ShowMoreList` inside `AdminPanel`.
- **Current UX/UI Problem:** `xl:` is a viewport query but the element sits four containers deep: at a 1280px viewport the available width is roughly 900px minus panel `p-5`, card `p-4` and disclosure `px-3`, about **820px**, into which the rule asks for `220 + 160 + 1fr + auto`. A `Textarea rows={2}` then sits beside a `min-h-11` select and a number input, so baselines do not align.
- **Why It Is a Problem:** the layout switches to its widest form exactly when it least fits, and the submit lands `xl:self-end` against a two-row textarea. Same root cause as finding 1.
- **Recommended Redesign:** container queries (`@container` on the disclosure body, `@2xl:grid-cols-[minmax(0,14rem)_minmax(0,10rem)_minmax(0,1fr)_auto]`) with `items-end` on the track; or simply keep two columns and let the textarea span.
- **Priority:** Medium

### 38. Pilot page mixes three list idioms on one screen
- **File(s):** `app/admin/pilot/page.tsx:43-57` (`MetricTile` grid), `:73-134` (`DataTable`), `:145-195` (`ShowMoreList` of `AdminRecordCard`s).
- **Current UX/UI Problem:** four KPI tiles, then a 4-column metrics table whose `Source` column is a pill per row (finding 17 again), then a card list with an embedded note form — three renderings of "a list of labelled values" inside about 2,500px.
- **Why It Is a Problem:** the operator re-learns the reading pattern three times, and the metrics table and KPI tiles show overlapping data in different shapes.
- **Recommended Redesign:** fold the checklist tiles and metrics table into one `DataTable` with a leading `StatusPill` for pass/fail, or keep tiles and demote the table to a `Details` disclosure; split notes onto a `Merchants` tab.
- **Priority:** Medium

---

## K. Security, MFA enrolment and step-up

### 39. The authenticator QR breaks the QR contract
- **File(s):** `components/admin/mfa-panel.tsx:105-110` (`className="h-44 w-44 rounded-xl bg-white p-2"`).
- **Current UX/UI Problem:** `rounded-xl` is `--radius + 4px` = 14px, there is no ink border, and `QrFrame` (`components/loyalty`) — the system's one QR treatment ("QR ink modules on a pure white, ink-bordered frame, in both themes") — is used nowhere in admin.
- **Why It Is a Problem:** a direct violation of a documented rule; in the dormant dark theme this QR has no frame separating white module ground from dark paper; and 14px is a third radius in a system that sanctions 10px and 18px.
- **Recommended Redesign:** wrap the `<img>` in `QrFrame` (or a `rounded-lg border-2 border-ink bg-white p-3` box if the frame API takes a matrix rather than an image) and size it at least 176px.
- **Priority:** High

### 40. The TOTP secret cannot be copied
- **File(s):** `components/admin/mfa-panel.tsx:111-113` (`<p className="font-mono text-xs break-all">Key: {enrollment.secret}</p>`).
- **Current UX/UI Problem:** a 32-character base32 secret printed as break-all mono text with no copy control, while every UUID in the console has one (`AdminIdChip`).
- **Why It Is a Problem:** manual transcription of a 32-character secret is the highest-error step of enrolment, and `break-all` mid-token wrapping makes it worse.
- **Recommended Redesign:** render through a copy affordance (an `AdminIdChip`-style button with a copy icon and the full value, `.mono-meta`, grouped in 4-character blocks) plus an explicit "Copy key" `Button variant="secondary" size="sm"`.
- **Priority:** High

### 41. Turning **off** two-factor is an outline button with no confirmation
- **File(s):** `components/admin/mfa-panel.tsx:47-58` (`<SubmitButton variant="outline" pendingLabel="Removing...">Turn off two-factor`).
- **Current UX/UI Problem:** the most security-weakening action in the console uses the neutral `outline` variant with no `AdminConfirmCheck`, no reason field and no confirm dialog — while cancelling a single customer reward requires a reason *and* a ticked consequence statement.
- **Why It Is a Problem:** consequence and friction are inverted across the console; one mis-click removes AAL2 from an admin account.
- **Recommended Redesign:** `variant="destructive"` plus `AdminConfirmCheck label="I understand admin sign-in will no longer require a code."` and a required reason written to the audit log, ideally inside an `AlertDialog`.
- **Priority:** Critical

### 42. Enrolment is a two-step machine with no step indicator, no back and no cancel
- **File(s):** `components/admin/mfa-panel.tsx:63-134` (`EnrollPanel` swaps its whole body when `enrollment.ok`).
- **Current UX/UI Problem:** pressing "Set up two-factor" replaces the card with "Scan and confirm". There is no "Step 1 of 2", no way back, no way to abandon a started enrolment, and the pending state is a hand-rolled `{starting ? "Starting..." : ...}` on a plain `Button` (`:91-93`) rather than the system `SubmitButton` recipe with its `Spinner`/`aria-busy`.
- **Why It Is a Problem:** an operator who cannot scan is trapped in the second state, and two pending idioms in one file mean one of them lacks the busy announcement.
- **Recommended Redesign:** add an `Eyebrow` step counter, a `Button variant="ghost">Back` that clears `enrollment`, and use `SubmitButton`/`useActionState` (or `Spinner` + `aria-busy`) for the begin action so all pending states match.
- **Priority:** Medium

### 43. The step-up wall has no escape hatch
- **File(s):** `components/admin/mfa-step-up.tsx:20-56`; gate at `app/admin/layout.tsx:40-42`.
- **Current UX/UI Problem:** when step-up is required this card is the only admin surface rendered. It offers a 6-digit field and "Verify" — no recovery-code path, no sign-out, no support or escalation link, and no indication of what happens after repeated failures.
- **Why It Is a Problem:** an operator with a lost or drifted authenticator has literally no next action inside the product, and cannot even end the session.
- **Recommended Redesign:** add a `Button variant="ghost"` sign-out beneath the submit, a "Use a recovery code" link (or an explicit escalation route), and a clock-skew hint. Keep the `max-w-sm` card but show the operator email as a `MonoTag` rather than mid-paragraph.
- **Priority:** High

### 44. The security page opts out of the console's page anatomy
- **File(s):** `app/admin/security/page.tsx:29-39` (`space-y-6`, hand-rolled `<header>` with `Eyebrow` "Security" and `h1 text-3xl`), `metadata = PRIVATE_ROUTE_METADATA` (`:10`); contrast every other admin route: `grid gap-6` + `<PageTitle eyebrow="Internal admin" ...>` + `metadata = { title: "Admin — ..." }`.
- **Current UX/UI Problem:** different spacing utility (`space-y` vs `grid gap`), different heading scale (`text-3xl` with no `sm:text-4xl`), a different eyebrow taxonomy, no description, and a generic tab title. `AdminMfaPanel` then uses `surface-card space-y-4 p-6` where `AdminPanel` is `surface-card grid gap-4 p-5`, with a `text-xl` heading where `SectionHeader` is `text-lg`.
- **Why It Is a Problem:** four small drifts compound into a page that visibly does not belong to the console, and the tab title makes it unfindable among several admin tabs.
- **Recommended Redesign:** `PageTitle eyebrow="Internal admin" title="Two-factor authentication" description="..."`, `grid gap-6`, `metadata = { title: "Admin — Security" }`, and rebuild both `AdminMfaPanel` states on `AdminPanel` + `SectionHeader`.
- **Priority:** Medium

### 45. The access-denied screen is a dead end
- **File(s):** `app/admin/layout.tsx:21-35`.
- **Current UX/UI Problem:** a `max-w-sm` card with "Access denied" and the raw `access.reason`, and no actions at all — no sign-in link, no sign-out, no route home, no support contact.
- **Why It Is a Problem:** the user is stranded and the reason string is developer-facing.
- **Recommended Redesign:** reuse `EmptyState` (which has an `actions` slot) with a primary "Sign in" and secondary "Back to home", keeping the technical reason as `.mono-id` "Reference:" text exactly as `app/admin/error.tsx:30-34` already does.
- **Priority:** Medium

---

## L. Shared admin components

### 46. Admin invents a second input story for `<select>`
- **File(s):** `components/admin/support.tsx:28-29` (`adminSelectClasses`), used at `privacy/data-request-workflow-panel.tsx:142,163,172`, `evidence/page.tsx:57,67,145`, `pilot-note-fields.tsx:44`; contrast `components/forms/select-field.tsx` (`data-slot="input"`, `h-12`, `appearance-none` plus the house chevron).
- **Current UX/UI Problem:** `adminSelectClasses` is a hand-rolled string (`min-h-11 rounded-lg border-2 border-ink bg-card px-3 text-sm`) with **no `data-slot="input"`**, **no `appearance-none`**, **no chevron**, **no `w-full`** and a different height (44 vs 48px) from `SelectField`. `DESIGN.md` states plainly: "Native selects compose through `SelectField`... do not hand-roll".
- **Why It Is a Problem:** admin selects show the OS chevron beside Wet Ink inputs that show the house one; they are 4px shorter than sibling `Input`s so rows do not baseline-align; without `w-full` a `<select>` sizes to its longest option, so the `grid-cols-2` pairs in the privacy form come out unequal; and the focus/`aria-invalid` rules keyed on `[data-slot=input]` never apply.
- **Recommended Redesign:** delete `adminSelectClasses` and use `SelectField` everywhere. If the console needs a 44px density, add a `size="sm"` variant to `SelectField` rather than a parallel string.
- **Priority:** High

### 47. `AdminField` is a second label system, and it folds helper text into the accessible name
- **File(s):** `components/admin/support.tsx:48-73` (`<label>` wrapping `<Eyebrow>` + control + helper `<span>`); contrast `components/forms/form-field.tsx` (`FieldLabel htmlFor`, `aria-describedby`, `aria-invalid` wiring).
- **Current UX/UI Problem:** admin action forms label with an 11.5px uppercase mono `Eyebrow` inside an implicit `<label>`, while `mfa-panel`/`mfa-step-up` on the same console use `FormField` with the normal `FieldLabel`. Because the helper `<span>` is *inside* the `<label>`, a screen reader announces "DELTA POSITIVE ADDS STAMPS, NEGATIVE REMOVES THEM" as the field name, and the helper is never exposed as a description.
- **Why It Is a Problem:** two label registers in one console; uppercase mono at 11.5px is the hardest legible form for dense data entry; and the a11y contract `FormField` exists to guarantee (`aria-describedby`, `aria-invalid` -> destructive border) is silently absent from every admin write form.
- **Recommended Redesign:** re-implement `AdminField` as a thin wrapper over `FormField` (passing `description` for the helper), keeping the compact visual if wanted but restoring `htmlFor`/`aria-describedby`/`aria-invalid`. At minimum move the helper out of the `<label>` and wire `aria-describedby` by hand.
- **Priority:** High

### 48. `AdminConfirmCheck` — the irreversibility gate — is a 16px native checkbox
- **File(s):** `components/admin/support.tsx:81-92` (`<input type="checkbox" className="focus-ring mt-0.5 size-4 shrink-0 accent-primary">`); same pattern at `evidence/page.tsx:136-143` for the merchant-approval gate.
- **Current UX/UI Problem:** the required consent control for QR regeneration and reward cancellation is a 16x16 native box styled only with `accent-primary`, with no `[@media(pointer:coarse)]` growth and no Wet Ink treatment (no ink border, no offset shadow).
- **Why It Is a Problem:** 16px fails the 44px tap floor on a control that gates irreversible actions; browser-default checkbox rendering is the one place the console falls back to an unstyled default; and a `required` checkbox with no client validation messaging fails quietly on submit in some browsers.
- **Recommended Redesign:** use the shadcn `Checkbox` primitive at `size-5` inside a `min-h-11 flex items-start gap-3` label row (so the whole row is the target), styled `border-2 border-ink data-[state=checked]:bg-primary`, and pair it with a `StatusBanner tone="warning"` for the consequence copy on the most severe actions.
- **Priority:** High

### 49. `AdminActionForm` hand-rolls success/error notices instead of using the system banner
- **File(s):** `components/admin/action-form.tsx:47-74`; contrast `components/loyalty/status-banner.tsx` (`bg-reward/12` / `bg-destructive/10`, 2px ink, semantic `Icon`).
- **Current UX/UI Problem:** the success `<p>` reproduces `StatusBanner`'s success classes by hand with no icon; the error `<p>` reproduces the error tone with no icon; and the download link is a third bespoke bordered treatment (`:56-66`).
- **Why It Is a Problem:** state now reads by colour alone (`DESIGN.md`: "state reads as icon + colour + copy, never colour alone"); the success wash is identical to the always-on MFA banner (finding 3); and three near-copies of one recipe will drift.
- **Recommended Redesign:** render `<StatusBanner tone="success"|"error" title={state.message} />` and turn the export link into a `Button asChild variant="secondary"` with a download icon. Additionally fire a `toast` — `sonner` is themed via `.cn-toast` and used **nowhere** in admin.
- **Priority:** High

### 50. Action results can be invisible after a revalidation
- **File(s):** `components/admin/action-form.tsx:38-42` (resets on success), rendered inside `components/admin/record-actions.tsx:24` (`Disclosure name={group}` — a native exclusive accordion).
- **Current UX/UI Problem:** the outcome message renders *inside* the collapsed disclosure of a record potentially thousands of pixels down the page; opening another record's panel closes this one (that is the point of the shared `name`), taking the confirmation with it. There is no page-level status region.
- **Why It Is a Problem:** the operator can perform an audited mutation and receive no perceivable confirmation, which for a support console is a correctness problem, not polish.
- **Recommended Redesign:** add the toast (finding 49) alongside the inline banner; scroll the disclosure summary into view on completion and stamp the record card with a transient `StatusPill tone="good">updated`.
- **Priority:** High

### 51. `AdminIdChip` truncation is unusable as an identifier, and copy feedback shifts layout
- **File(s):** `components/admin/id-chip.tsx:45-66`.
- **Current UX/UI Problem:** the chip shows `prefix:` + `value.slice(0, 8)` — 8 hex characters of a UUID — styled `underline decoration-dotted` (link-like) with no copy glyph. On success it *inserts* `<span>copied</span>` into the flex row, widening the control inside a `whitespace-nowrap` table cell. Sizing is `text-xs` mono, a third mono register beside `.mono-meta` and `.mono-id`.
- **Why It Is a Problem:** 8 hex characters is not collision-safe to quote in a GDPR or audit record; the dotted underline promises navigation and delivers a clipboard write; and the width change nudges neighbouring content on copy.
- **Recommended Redesign:** render `first8...last4` (`3fa9c1b2...7d0e`), add a leading 16px copy `Icon` so the affordance is explicit and drop the underline, and swap "copied" for a *fixed-width* icon change (copy -> check) so the box never resizes. Standardise on `.mono-meta` and make this the console's single id renderer (findings 24, 36).
- **Priority:** Medium

### 52. `AdminRecordCard` renders all values as muted, stacked and single-column
- **File(s):** `components/admin/record-card.tsx:57-74` (`dl grid gap-2.5`; `dd` always `text-muted-foreground`; `mono` fields `font-mono text-xs`).
- **Current UX/UI Problem:** every field is a two-line `dt`/`dd` stack, and every value — merchant names, emails, stamp counts, narratives — takes `--muted-foreground`. Only the title escapes. There is no emphasis mechanism, no inline layout for short values and no slot for prose.
- **Why It Is a Problem:** with 5-11 fields (privacy, billing, evidence) the card is a wall of uniform grey with flattened hierarchy, and each field costs about 44px — which is why billing cards reach 800px (finding 22).
- **Recommended Redesign:** add (a) `emphasis?: boolean` per field so the primary value renders `text-foreground font-semibold`; (b) `layout?: "stacked" | "inline"` defaulting to inline at `@sm` (`grid-cols-[minmax(0,8rem)_1fr] items-baseline gap-x-3 gap-y-2`), which alone halves card height; (c) a `body` slot for prose. Use `.mono-meta` rather than `font-mono text-xs` for `mono` fields.
- **Priority:** High

### 53. `AdminRecordActions` disclosure uses an off-contract dashed tone
- **File(s):** `components/admin/record-actions.tsx:24` -> `components/merchant/launch/disclosure.tsx:38-42` (`border-2 border-dashed border-ink/25 bg-secondary/40`).
- **Current UX/UI Problem:** a 2px dashed rule at 25% ink. The contract sanctions exactly two dashed tones: `--w-line` (18%) and `--w-line-strong` (50%).
- **Why It Is a Problem:** a third dashed tone in the most-repeated admin chrome (it wraps every per-record action on six routes), so the drift is systemic rather than local.
- **Recommended Redesign:** `border-line` for the resting disclosure and `border-line-strong` when open — both already minted as `--color-line` / `--color-line-strong`.
- **Priority:** Low

### 54. Panel headers carry instructional paragraphs that never collapse
- **File(s):** `privacy/data-request-workflow-panel.tsx:50` (about 250 characters), `customer-memberships-panel.tsx:45`, `merchants/page.tsx:128`, `evidence/page.tsx:46`, `pilot/page.tsx:63`.
- **Current UX/UI Problem:** every panel prints a two-to-three-line procedural description (`max-w-2xl text-sm leading-6`) on every load, forever, to operators who have read it a hundred times. On the privacy page alone that is about 200px of instruction.
- **Why It Is a Problem:** onboarding copy permanently taxing expert users; it pushes the actual controls below the fold and makes `SectionHeader`'s `sm:items-end` alignment put the source pill at an awkward baseline.
- **Recommended Redesign:** keep one short descriptive line and move procedure into a `Disclosure label="How this works"` or an icon-triggered popover beside the title. Give sibling panels one length budget (about 90 characters).
- **Priority:** Medium

### 55. Lookup controls have no pending state and shift layout on clear
- **File(s):** `components/admin/lookup-controls.tsx:32-68`.
- **Current UX/UI Problem:** the `next/form` submit triggers a navigation with no pending affordance (no `useFormStatus`, no `SubmitButton`); the `Clear` ghost button appears only when a filter is active (`:62-66`), so the button row width changes as the operator searches; and there is no "N results for ..." summary near the controls (the count lives in `AdminLookupPagination` far below).
- **Why It Is a Problem:** on a service-role readback that can take a second the operator gets no feedback and will re-submit, and the appearing/disappearing button is a small constant instability.
- **Recommended Redesign:** use `SubmitButton pendingLabel="Searching..."`; always render `Clear`, `disabled` when no filter is active; render applied filters as dismissible chips plus a result count immediately under the form.
- **Priority:** Medium

### 56. Pagination is Previous/Next only, with no page jump and no page-size control
- **File(s):** `components/admin/lookup-controls.tsx:77-147`; `ADMIN_LOOKUP_PAGE_SIZE = 25`, `ADMIN_LOOKUP_MAX_PAGE = 999` in `lib/admin/lookup-query.ts`.
- **Current UX/UI Problem:** with 25 rows per page and up to 999 pages, navigation is one step at a time; the disabled ends render as greyed `size="sm"` buttons; and `justify-between` splits the count line and the buttons to opposite ends of a panel that can be 900px wide.
- **Why It Is a Problem:** reaching page 40 takes 39 round trips, and the split layout forces the eye across the panel to confirm the current page after every press.
- **Recommended Redesign:** add first/last controls and a numeric "Go to page" input, group the count with the controls on the right, and add a rows-per-page select (25/50/100) wired to a `size` query param. Keep the link-based approach — that part is right.
- **Priority:** Medium

### 57. The `p-0` panel override and the "de-styled EmptyState" are copied incantations
- **File(s):** `AdminPanel className="p-0"` + inner `border-b p-5` at `customer-memberships-panel.tsx:41-42`, `customer-rewards-panel.tsx:37-38`, `consent-log-panel.tsx:30-31`, `merchants/page.tsx:124-125`, `audit/page.tsx:35-36`, `billing/page.tsx:78-79`, `pilot/page.tsx:59-60`. `EmptyState className="rounded-none border-0 p-0 shadow-none"` (or the `p-0`-less variant) at `page.tsx:121`, `data-request-workflow-panel.tsx:78,86`, `unaffiliated-customers-panel.tsx:65,73`, `logged-requests-panel.tsx:50`, `merchants/page.tsx:261`, `fraud-flags-panel.tsx:65`, `redemption-failures-panel.tsx:41`, `pilot/page.tsx:200`, `customer-memberships-panel.tsx:71,78`, `customer-rewards-panel.tsx:60`.
- **Current UX/UI Problem:** two de-styling strings copied 7 and 11+ times with inconsistent membership — `p-0` is present in some and absent in others, so the flush/padded empty state differs between panels.
- **Why It Is a Problem:** any change to the panel or empty-state recipe must be made in eighteen places, and the inconsistency is already visible (some empty states are inset by `p-6`, some are flush).
- **Recommended Redesign:** add `AdminPanel` variants — `<AdminPanel variant="flush">` rendering `p-0` with an `<AdminPanelHeader>` owning `border-b-2 border-ink p-5` — and an `EmptyState variant="inline"` that drops border/shadow/radius. Delete every ad-hoc override.
- **Priority:** Medium

### 58. Action-column naming differs on every table
- **File(s):** `customer-memberships-panel.tsx:182` ("Audited action"), `customer-rewards-panel.tsx:156` ("Audited action"), `fraud-flags-panel.tsx:123` ("Review"), `billing/page.tsx:182` ("Controls"), `merchants/page.tsx:294` ("QR controls" as a disclosure label).
- **Current UX/UI Problem:** four labels for one column concept, and the disclosure labels differ again ("Adjust stamps", "Cancel reward", "Privacy actions", "Fulfilment controls", "Review actions", "QR controls").
- **Why It Is a Problem:** the operator cannot build one mental model of where actions live, and the column header is the only per-table hint that a row is actionable.
- **Recommended Redesign:** one header word — `Actions` — across every admin table, with the specific verb reserved for the disclosure/button label inside the cell.
- **Priority:** Low

---

## M. `components/data` — shared data display

### 59. Table cells inherit `whitespace-nowrap`, so no admin table can wrap
- **File(s):** `components/ui/table.tsx` `TableCell` (`"p-2 align-middle whitespace-nowrap"`); `components/data/data-table.tsx:149-157` overrides padding (`px-4 py-3 align-top text-sm`) but **not** the nowrap.
- **Current UX/UI Problem:** every cell in every admin table is nowrap. Long merchant names, emails, evidence sentences and the multi-line fulfilment cells widen the table until `overflow-x-auto` engages. The workaround already exists in the codebase: `components/admin/support.tsx:67` adds `whitespace-normal` to `AdminField`'s helper with a comment describing this exact bug ("inside a table cell the helper would inherit the cell's nowrap").
- **Why It Is a Problem:** this is the mechanical cause of horizontal scrolling across the console; with finding 1 the operator scrolls sideways at exactly the widths where table mode was chosen. A commented workaround at one call site proves the default is wrong.
- **Recommended Redesign:** set `whitespace-normal` in `DataTableCore`'s `TableCell` classes and opt *into* `whitespace-nowrap` per column via `column.className` (dates, ids, pills). Add `break-words` / `[overflow-wrap:anywhere]` for email and id columns.
- **Priority:** Critical

### 60. `DataTable` has no sorting, no `aria-sort`, no column control, no sticky header
- **File(s):** `components/data/data-table.tsx:15-20` (`DataTableColumn` has only `key`/`header`/`cell`/`className`), `:121-135` (header markup).
- **Current UX/UI Problem:** headers are inert text; nothing can be sorted by severity, date, status or amount on any admin table; there is no column-visibility control for the 7-column tables; and `TableHeader` does not stick inside the `overflow-x-auto` container, so on a 100-row audit table column meaning disappears after one screen.
- **Why It Is a Problem:** sorting is the second most basic table affordance after filtering; without it triage depends on the server having chosen the right order for every task, which it cannot.
- **Recommended Redesign:** add `sortable?: boolean` + `sortKey` to `DataTableColumn`, render sortable headers as `<button>` with `aria-sort="ascending|descending|none"` and a chevron `Icon`, driven by `?sort=`/`?dir=` params (consistent with the existing link-based lookup). Make `TableHeader` `sticky top-0 z-10 bg-secondary`. Add an optional column toggle for the wide tables.
- **Priority:** High

### 61. The table header applies two competing type recipes
- **File(s):** `components/data/data-table.tsx:124-132` — `TableHead` gets `text-xs font-extrabold whitespace-nowrap text-muted-foreground uppercase` **and** wraps its content in `<Eyebrow>` (`.eyebrow` = 11.5px Space Mono 700 uppercase muted, as a `<p>`).
- **Current UX/UI Problem:** the `th` sets a 12px Bricolage uppercase style that the nested `<p class="eyebrow">` then overrides to 11.5px mono; a block `<p>` inside a `<th>` also defeats the `h-10` vertical centring.
- **Why It Is a Problem:** dead, contradictory styles that will mislead the next editor, plus one extra element per header cell.
- **Recommended Redesign:** keep `<Eyebrow>` and drop the four conflicting `th` classes, or apply `.eyebrow` directly to the `th` and remove the wrapper element.
- **Priority:** Low

### 62. The horizontal scroll region is unlabelled and unsignposted
- **File(s):** `components/ui/table.tsx` (`<div data-slot="table-container" className="relative w-full overflow-x-auto" tabIndex={0}>`), consumed at `data-table.tsx:118`.
- **Current UX/UI Problem:** the scroll container is focusable (good) but has no `role="region"`/`aria-label`, and there is no visual signal that content continues to the right — no edge fade, no shadow, no hint.
- **Why It Is a Problem:** screen-reader users land on an unnamed focusable div; sighted users may never discover the hidden columns, which on the billing and fraud tables include the action controls.
- **Recommended Redesign:** pass `role="region"` + `aria-label={caption}` from `DataTable` (the caption string already exists) and add a right-edge gradient mask that disappears at scroll end — the one sanctioned functional gradient case.
- **Priority:** Medium

### 63. `mobilePageSize` is applied on 2 of 8 admin tables
- **File(s):** set at `consent-log-panel.tsx:47` and `audit/page.tsx:44`; **absent** on `customer-memberships-panel`, `customer-rewards-panel`, `merchants`, `billing`, `fraud-flags-panel`, `redemption-failures-panel`, `referral-ops-panel`. The prop is documented at `data-table.tsx:67-74` explicitly to prevent "a ~9,000px page at 375px".
- **Current UX/UI Problem:** the mitigation exists and is inconsistently applied — billing (100 rows x about 800px cards) and merchants (100 rows) are the worst offenders and have none.
- **Why It Is a Problem:** the phone experience of the console varies by an order of magnitude between routes for no reason.
- **Recommended Redesign:** default `mobilePageSize` to `10` inside `DataTable` and let call sites opt out rather than in; extend the same reveal to the tablet card path, since `cardBreakpoint="xl"` means tablets get cards too.
- **Priority:** High

### 64. `ShowMoreList` reveals but never collapses
- **File(s):** `components/data/show-more-list.tsx:38-67`.
- **Current UX/UI Problem:** `visibleCount` only increases — there is no "Show fewer" — so an operator who expands 100 pilot merchants must reload to recover their scroll position. The `role="status"` count sits *below* the button, and the button is `w-full sm:w-auto` centred, so on desktop it floats mid-panel.
- **Why It Is a Problem:** one-way progressive disclosure turns a bounded page into an unbounded one with no undo.
- **Recommended Redesign:** add a `Show fewer` secondary control once `visibleCount > initialCount`, move the "Showing X of Y" count inline to the left of the button (`flex items-center justify-between`), and prefer real pagination on the admin routes since the server already supports it.
- **Priority:** Medium

### 65. `ActivityFeed` rows have no action slot, and the SLA feed cannot be acted on
- **File(s):** `components/data/activity-feed.tsx:61-105` (`grid gap-2 p-4 sm:grid-cols-[1fr_auto]`); consumer `app/admin/privacy/logged-requests-panel.tsx:40-52`.
- **Current UX/UI Problem:** below `sm` the timestamp drops beneath the content instead of staying right-aligned; each row is `p-4` with no compact mode; and there is no row-level link or action slot, so the privacy panel can show an **overdue** GDPR request with no way to act on it.
- **Why It Is a Problem:** an SLA-tracking surface whose overdue item is not clickable forces the operator to scroll back to the workflow panel and re-find the subject by hand.
- **Recommended Redesign:** add an optional `action`/`href` per item rendered as a right-aligned `Button variant="link" size="xs"`, plus a `density="compact"` variant (`p-3 gap-1`) for admin feeds. Keep the dashed `[&>li+li]:border-t-2 border-line` separators — those are on contract.
- **Priority:** Medium

### 66. `FunnelChart` bars carry no proportion label and clamp silently
- **File(s):** `components/data/funnel-chart.tsx:26-49` (`Math.max((item.value / max) * 100, 4)`).
- **Current UX/UI Problem:** every bar is normalised to the largest step and clamped to a 4% minimum, but only the absolute count is printed — no percentage of previous step, no drop-off. A step of 1 out of 400 renders identically to a step of 16.
- **Why It Is a Problem:** on the admin overview this is the primary activation-analysis instrument and it cannot answer "where do merchants fall out?".
- **Recommended Redesign:** print `value` plus `down n% from previous` in `.mono-meta` on each row, and mark clamped bars (a hairline tick at true position) so a floored bar is not read as real volume.
- **Priority:** Medium

### 67. `StatStrip` is unused by admin despite being the densest KPI option
- **File(s):** `components/data/stat-strip.tsx:36-76`; admin uses `MetricTile` at `page.tsx:59-75` and `pilot/page.tsx:43-57`.
- **Current UX/UI Problem:** `StatStrip` packs four values into a single ruled card about 90px tall; a `MetricTile` grid costs about 130px per row plus gaps, and considerably more on the pilot page where each tile carries `helper` content.
- **Why It Is a Problem:** the console pays a large height premium for its summary rows while a denser, already-designed, already-themed alternative sits in the same folder.
- **Recommended Redesign:** use `StatStrip` for the admin overview counters and the pilot checklist; reserve `MetricTile` for tiles that genuinely carry helper or trend content.
- **Priority:** Low

---

## N. Developer-facing surfaces

### 68. `/dev/design-system` is a 992-line single scroll with no table of contents
- **File(s):** `app/dev/design-system/page.tsx:183-190` (`mx-auto grid w-full max-w-6xl gap-12 px-6 py-10`), nine `<Section id=...>` blocks (`tokens`, `typography`, `surfaces`, `forms-feedback`, `iconography`, `motion`, `loyalty`, `console-viz`, `console-data`).
- **Current UX/UI Problem:** every section already carries an `id` and `scroll-mt-6`, but **nothing on the page links to them** (count of `href="#...">` on the page: 0). The catalogue is roughly 15,000px with `gap-12` between sections, no sticky nav, no section index, no search and no back-to-top.
- **Why It Is a Problem:** the file describes itself as "the acceptance gate for the foundation layer", yet finding the button sizes or the loyalty states means scroll-hunting. The anchors exist purely for external deep links.
- **Recommended Redesign:** add a sticky left rail (`lg:grid-cols-[200px_minmax(0,1fr)]`, `sticky top-6`) listing the nine sections with `aria-current` on the in-view one, plus a compact chip row on mobile (reuse `FilterPills` or `ConsoleSidebarNav` markup), and a back-to-top affordance per section.
- **Priority:** High

### 69. The catalogue's console section demonstrates the wrong breakpoint
- **File(s):** `app/dev/design-system/page.tsx:889-960` — the section description says "Admin consoles use **xl**...", the eyebrow at `:896` says "Responsive DataTable . admin **xl** cards", but the `DataTable` at `:897-960` passes **no `cardBreakpoint`**, so it renders the `sm` default.
- **Why It Is a Problem:** the one live reference for the admin table pattern demonstrates behaviour contradicting its own caption and the `DESIGN.md` contract; a developer copying from the catalogue ships the wrong breakpoint.
- **Recommended Redesign:** pass `cardBreakpoint="xl"` and `mobilePageSize={10}`, and show both switches side by side with labels ("sm — compact tables" / "xl — admin consoles").
- **Priority:** High

### 70. The catalogue does not document the admin vocabulary it is supposed to gate
- **File(s):** `app/dev/design-system/page.tsx` imports only `AdminRecordCard` (`:22`) and `StatusPill` (`:23`) from the admin layer.
- **Current UX/UI Problem:** `AdminPanel`, `AdminField`, `adminSelectClasses`, `AdminIdChip`, `AdminRecordActions`, `AdminConfirmCheck`, `AdminLookupControls`, `AdminLookupPagination`, `AdminLookupErrorState`, `SourceLabel`, the four `StatusPill` tones, `AdminActionForm`'s success/error/download states and the admin loading/error states appear nowhere in the catalogue.
- **Why It Is a Problem:** every drift in this report — two select stories, two label systems, four rule tones, three mono registers, inverted destructive semantics — is a direct consequence of the console's own vocabulary having no reference surface, while the catalogue calls itself the acceptance gate.
- **Recommended Redesign:** add a tenth `<Section id="admin">` covering panel anatomy (header/flush), the four `StatusPill` tones beside `SourceLabel`, `AdminField` vs `FormField`, the select treatment, `AdminIdChip` rest/copied, `AdminRecordActions` open/closed, the destructive recipe (reason + confirm + variant), lookup + pagination + error state, and the admin loading skeleton.
- **Priority:** High

### 71. The app harness has no index and its navigation leaves the harness
- **File(s):** `app/dev/app-harness/layout.tsx:93-102` mounts the real `MerchantAppShell`; `components/layout/console-nav.ts merchantNavItems` point at `/app`, `/app/customers`, ... There is no `app/dev/app-harness/page.tsx` and no `app/dev/page.tsx`.
- **Current UX/UI Problem:** `/dev` and `/dev/app-harness` both 404, so the developer must already know the 19 lane URLs. Once inside a lane, every sidebar item links to the **real** authenticated `/app` route, so one click ejects the developer out of the harness and into a login redirect.
- **Why It Is a Problem:** the harness exists to make surfaces screenshot-provable, and its own navigation actively breaks that workflow; discovering which lanes exist requires reading the file tree.
- **Recommended Redesign:** add `app/dev/page.tsx` and `app/dev/app-harness/page.tsx` index pages listing every lane as link cards grouped by surface, documenting the `?w=` width override (`app/dev/layout.tsx:51-79`) and `?sidebar=collapsed` — neither of which is surfaced anywhere. Pass a `basePath`/`hrefResolver` into `ConsoleSidebarNav` so the harness rewrites `/app/x` -> `/dev/app-harness/x`.
- **Priority:** High

### 72. Harness pages have no in-page index either
- **File(s):** `app/dev/app-harness/skeletons/page.tsx:106-127` (12 sections, `grid gap-12`, `h2` at `font-mono text-sm break-all`), `app/dev/app-harness/states/page.tsx:152-167` (4 sections).
- **Current UX/UI Problem:** both pages use ids plus `scroll-mt-6` with nothing linking to them, and the skeletons page presents 12 entries with no filter or jump.
- **Why It Is a Problem:** the same class of problem as finding 68 at smaller scale; screenshotting one skeleton means scrolling past eleven.
- **Recommended Redesign:** a shared `HarnessIndex` component rendering a chip row of anchors at the top of every harness page (derivable from the same section list), plus `?only=<id>` to render a single section for clean screenshots.
- **Priority:** Medium

### 73. `/dev/app-harness/trial/admin` renders an admin surface with a fourth divider tone
- **File(s):** `app/dev/app-harness/trial/admin/page.tsx:29` (`border-y border-dashed border-ink/30 py-4 sm:grid-cols-3`), `:22` (`font-heading text-xl font-extrabold` heading instead of `SectionHeader`).
- **Current UX/UI Problem:** the harness mock of the billing/fulfilment panel introduces a fourth dashed tone (`ink/30`) and a bespoke `text-xl` heading, so the fixture does not match the surface it stands in for (`billing/page.tsx` uses `SectionHeader` and `border-b`).
- **Why It Is a Problem:** a harness whose fixture diverges from production yields false screenshot proof.
- **Recommended Redesign:** rebuild the fixture from `SectionHeader` + `.w-rule` + `AdminRecordCard` so the harness renders the same components as the real route.
- **Priority:** Low

### 74. Admin has no per-panel loading skeletons; the whole page waits on the slowest readback
- **File(s):** `app/admin/loading.tsx:9-28` (page title placeholder + **one** panel block), `app/admin/privacy/page.tsx:42-63` (`Promise.all` of four readbacks), `app/admin/customers/page.tsx:36-45` (two); contrast `components/merchant/loading-skeletons.tsx` which exports nine surface-shaped skeletons and is exercised at `app/dev/app-harness/skeletons`.
- **Current UX/UI Problem:** every `/admin/*` segment shares one fallback showing a single panel, while privacy shows four and customers two — so the paint-in shifts layout substantially. There are no `<Suspense>` boundaries per panel, so a slow consent readback blocks the membership lookup the operator actually wanted.
- **Why It Is a Problem:** perceived performance on the console is governed by its slowest query, and the layout jump on resolve is large.
- **Recommended Redesign:** wrap each panel in `<Suspense>` with an `AdminPanelSkeleton` (title line, description line, table/card block) so panels stream independently; add `AdminTableSkeleton` and `AdminRecordCardSkeleton` to a `components/admin/loading-skeletons.tsx` mirroring the merchant pattern, and render them in the harness for proof.
- **Priority:** High

---

## O. Cross-cutting patterns (repeated offenders)

1. **Viewport breakpoints used inside deeply nested containers.** `xl:*` utilities and `cardBreakpoint="xl"` are applied to elements sitting inside a 272px-narrower sidebar inset, a `p-5` panel, a `p-4` card and a `px-3` disclosure — `data-table.tsx:89-92`, `admin-shell.tsx:40+103`, `pilot-note-fields.tsx:39`, `data-request-workflow-panel.tsx:120`, `billing-fulfilment-actions.tsx:24`, `merchants/page.tsx:295`, `customer-memberships-panel.tsx:211`. **Fix once:** `@container` + container queries throughout the admin tree.
2. **Per-record write forms rendered expanded, everywhere.** Customers (stamps), customers (reward cancel), fraud (two forms per row), merchants (two QR forms), privacy (two forms), billing (three fulfilment forms), pilot (note form). Mobile folds them behind `AdminRecordActions`; desktop mostly does not. **Fix once:** one `AdminRowActions` pattern — a compact trigger plus row expansion/sheet — used identically in both modes.
3. **Panel-per-concern stacking instead of tabs.** Privacy (4), customers (2), fraud (2), merchants (2), pilot (3), evidence (2). None of these panels needs to be co-visible. **Fix once:** a `?view=`/`?panel=` segmented-view helper on top of `FilterPills`, keeping URLs linkable.
4. **Divider and dashed-tone zoo.** `border-b` (1px `--border`), `border-t border-ink/20`, `border-t-2 border-dashed border-ink/20`, `border-y border-dashed border-ink/30`, `border-2 border-dashed border-ink/25` — five treatments; `.w-rule` used zero times in admin.
5. **Two of everything in forms.** Two select stories (`SelectField` vs `adminSelectClasses`), two label systems (`FormField` vs `AdminField`), two pending idioms (`SubmitButton` vs hand-rolled `starting ? ...`), two feedback treatments (`StatusBanner` vs `AdminActionForm`'s hand-rolled `<p>`s), three mono registers (`.mono-meta`, `.mono-id`, `font-mono text-xs`).
6. **Copied de-styling strings.** `AdminPanel className="p-0"` + `border-b p-5` (7x), `EmptyState className="rounded-none border-0 p-0 shadow-none"` (11x+), the cross-link `focus-ring rounded-sm font-semibold text-primary underline underline-offset-2 hover:text-[color-mix(...)]` string (2 files, 6 instances).
7. **Hard `.limit(100)` with no total and no pagination.** Merchants, QR codes, audit, fraud flags, redemption failures, referrals, pilot merchants. The operator is never told the list is truncated.
8. **Colour carrying meaning it cannot carry.** `StatusPill` warning (`bg-primary/15`) vs danger (`bg-destructive/15`) at ~1.1:1; `StatusPill neutral` vs `SourceLabel` identical; referral success rendered neutral.
9. **Tap targets below the 44px floor on consequential controls.** `AdminConfirmCheck` (16px), evidence approval checkbox (16px), merchant/billing cross-links (~16px), `AdminIdChip` (has a coarse-pointer floor — the correct pattern the others should copy).
10. **No sorting, filtering, bulk action, toast, or command palette anywhere in the console** — the four affordances that define a back-office are all absent, while `FilterPills`, `sonner`, `Sheet` and `AlertDialog` all exist in the codebase, unused by admin.

---

## P. Top 5 highest-impact changes

1. **Collapse per-row forms into row expansion (findings 10, 11, 28).** Replacing three inline-form columns with a compact trigger plus one expanded row removes an estimated **~30,000px** from `/admin/customers` and `/admin/fraud` alone, restores scan-ability, fixes the destructive-safety problem, and makes the tables usable at 960px.
2. **Convert stacked panels to URL-driven tabs (findings 12, 13, 18, 32, 35, 38).** `/admin/privacy` drops from ~13,500px to roughly one screen plus one list; merchants, customers, fraud, pilot and evidence each halve. One paginator, one filter and one mental model per view.
3. **Fix the width story: collapsible sidebar + container queries + wrapping cells (findings 1, 2, 59, 60, 62).** These four together end horizontal scrolling in the console, which currently affects every table at the most common admin viewport, and unlock sticky headers and sorting.
4. **Give every list a filter, a total and pagination — and add a global lookup (findings 6, 21, 26, 31, 63).** Five routes currently offer no way to find a record and silently truncate at 100. This is the single largest functional gap for day-to-day support work.
5. **Repair destructive-action and feedback semantics (findings 19, 29, 41, 48, 49, 50).** Invert the QR variants, move `warning` off vermillion, make "Turn off two-factor" destructive-and-confirmed, replace the 16px native checkbox, and route every action outcome through `StatusBanner` plus a `toast`. Today the console can perform an irreversible action and show no perceivable confirmation, and its colour system points the wrong way on severity.

# Fix imprecise merchant activity data (phantom "QR downloaded" + stale snapshot counts)

## Context

A merchant reported that **`https://nabaperks.com/app/activity` shows a "QR downloaded" event when no QR was ever downloaded**, and that activity data is "not precise" more broadly.

Investigation found two distinct, real causes:

1. **Phantom `qr_downloaded` events.** The QR download buttons are Next.js `<Link href="/app/qr/download/…">` with prefetch left on, and that route is a **GET handler that records the event on _any_ request, before it even renders the file**. Next.js auto-prefetches in-viewport links **in production only** (`node_modules/next/dist/docs/01-app/02-guides/prefetching.md:57,89`). So simply opening the QR panel in production fires speculative GETs to the download route → up to three phantom "QR downloaded" rows (poster + till-card + sticker), with no human download. Any prefetcher/link-scanner/prerender does the same, because mutating state in a GET violates HTTP safe-method semantics.

2. **Stale snapshot counts in the feed.** `getEnrichedMerchantActivity` joins the **live** `customer_memberships` row (`current_stamp_count`, `total_stamps_earned`, `total_rewards_redeemed`) and renders those _current_ values as point-in-time facts on _historical_ rows. Example: a `customer_joined` row shows "Starting stamps: 7" because the customer now has 7, even though they started at 0.

User decisions (asked during planning): **(a) broaden scope** to the QR fix **plus** activity-feed precision; **(b) investigate** a cleanup of the phantom rows already in production.

Intended outcome: the activity feed only states facts it can actually substantiate — real downloads, and counts captured at event time — and no new phantom events are created.

## Root-cause evidence

- `app/app/qr/download/[asset]/route.ts:49-53` records `record_qr_download` (and PostHog `qr_downloaded` at `:59-66`) **before** the asset body renders at `:68-71`. GET = side effect.
- `components/merchant/launch/qr-panel.tsx:91,98,106` build the download hrefs; rendered at `:192-197` (poster) and `:243-245` (till-card/sticker) as `<Button asChild><Link href={downloadHref}>…</Link></Button>` — **no `prefetch={false}`, no `target`, no `download`** → prefetch-eligible. (The Preview links point at `/app/qr/preview/*`, which does **not** record — confirmed by `tests/micro-specs/merchant-qr.test.ts:901`.)
- Only `qr-panel.tsx` references the download route (grep: 3 hits, all in that file).
- Live-snapshot fields in `lib/merchant/activity.ts`: `customer_joined` "Starting stamps" (`:285`), `stamp_claim_started` "Stamps before stamp" (`:308-313`), `stamp_issued` "Lifetime stamps" (`:352-357`), `reward_unlocked` "Rewards redeemed (lifetime)" (`:384-389`), `reward_redeemed` "Total redemptions" (`:423-428`) — all read the joined live membership, not event metadata. (`stamp_issued` "Stamps now" already prefers `metadata.new_stamp_count` at `:332-342` — the correct pattern to extend.)
- `qr_scanned` (customer) and `qr_downloaded` (merchant) are both mapped to category `"qr"` (`activityCategory` `:906-911`) and summed together as `qrEvents` (`summarizeActivity` `:196-197`) — conflates two unrelated actions.
- Existing tests that pin current behavior: `tests/micro-specs/merchant-qr.test.ts:729` ("records QR downloads before returning…"), `:901` (preview records nothing), `:995` (404 before accounting). `tests/micro-specs/merchant-readbacks.test.ts` covers activity threading/headlines.

## Approach (TDD — Red → Green → Refactor, per `Instructions_tdd.md`)

### Part 1 — Stop phantom `qr_downloaded` (the reported bug)

Three reinforcing layers:

1. **Client: make downloads real downloads, not prefetched navigations.** In `components/merchant/launch/qr-panel.tsx`, change the 3 download triggers from `<Link href={…}>` to a non-prefetched true download — `<Button asChild><a href={downloadHref} download>…</a></Button>` (plain anchor → bypasses the Next router/prefetch entirely; `download` gives correct file-download semantics). Leave the Preview `<Link …>`/`<img>` untouched (they hit the harmless preview route).

2. **Server: ignore speculative/prefetch GETs.** In `app/app/qr/download/[asset]/route.ts`, before recording, detect prefetch/prerender requests via headers — `Sec-Purpose` containing `prefetch`/`prerender`, `Purpose: prefetch`, or `Next-Router-Prefetch` present — and return early (`204 No Content`) **without recording or rendering**. Real anchor-click downloads never send these headers, so this is safe. Defends against browser speculation and link scanners regardless of the client change.

3. **Server: record only after a successful render.** Move the `record_qr_download` RPC + PostHog capture to **after** the asset body is produced (`:68-71`) and before the response is returned, so a render failure no longer leaves a "downloaded" row. (Keeps `merchant-qr.test.ts:729`/`:995` semantics: still recorded before the response, still 404 before accounting.)

**Tests (write first, in `tests/micro-specs/merchant-qr.test.ts`):**
- New: GET with `Sec-Purpose: prefetch` (and a second case with `Next-Router-Prefetch: 1`) → `record_qr_download` **not** called, no `attachment` response.
- New/extended: the rendered QR panel markup exposes the download as a non-prefetched download (e.g. asserts a `download` anchor / not a bare prefetchable `<Link>`), mirroring the existing href assertions at `:696-698`.
- Confirm the existing `:729` test still passes (record happens after render but before return); adjust only its wording if it asserts ordering against the render.

### Part 2 — Activity-feed precision (`lib/merchant/activity.ts`)

Principle: **a historical row must not display live snapshot values as point-in-time facts.** Prefer event `metadata` (captured at write time); when absent, omit the detail rather than render a stale live number.

- `customer_joined`: drop the live-snapshot "Starting stamps" (`:282-287`) unless a starting count exists in `metadata`. (The join RPC currently writes only `{marketing_opt_in}` — see `supabase/migrations/20260613210000_customer_phone_identity.sql:160-169`.)
- `stamp_claim_started`: gate "Stamps before stamp" (`:308-313`) on `metadata`; omit otherwise. (Event is dormant in prod, so low impact — but correct.)
- `stamp_issued` "Lifetime stamps", `reward_unlocked` "Rewards redeemed (lifetime)", `reward_redeemed` "Total redemptions": these are lifetime/current totals, not point-in-time — either remove from per-event detail or relabel so they read explicitly as "current" (decide during implementation; default = relabel to avoid losing useful context). Keep the existing `metadata.new_stamp_count`-first pattern.
- Disambiguate QR scans vs downloads: keep the `qr` category but split the summary so scans and downloads are counted/labelled separately (extend `ActivitySummary`), so "QR activity" is no longer a misleading single number.
- **Optional deeper follow-up (flagged, not default):** enrich the relevant RPCs to write the at-event count into `metadata` (starting stamps on join; `new_stamp_count` on the join-first-stamp `stamp_issued`) so future rows can show accurate point-in-time counts. Deferred because it adds migration blast radius and cannot fix historical rows without a backfill.

**Tests (`tests/micro-specs/merchant-readbacks.test.ts`):** assert join/claim rows do **not** surface a stale live count when metadata is absent; assert metadata-driven counts are used when present; assert scans and downloads summarise separately. Keep existing threading/headline assertions green.

### Part 3 — Investigate cleanup of historical phantom rows (read-only first)

Phantom rows can't be told apart from genuine downloads by value alone, but prefetch leaves a **fingerprint**: viewport prefetch fires GETs for poster + till-card + sticker **near-simultaneously**, producing ~3 `qr_downloaded` rows for one merchant/QR within a second or two — whereas a human downloads one asset deliberately. 

- Deliverable: a **read-only** SQL investigation against production `product_events` (`event_name = 'qr_downloaded'`) grouping by `(merchant_id, qr_code_id)` and bucketing by `created_at` to surface near-simultaneous multi-asset bursts; report counts before proposing anything.
- Then propose a **guarded, dry-run-first** targeted `DELETE` (or soft-annotate via `metadata`) for the burst pattern only. Run via the documented DB path (`SUPABASE_DB_URL`; see `supabase/README.md`). No destructive step without showing the user the matched rows first.

## Files to modify

- `components/merchant/launch/qr-panel.tsx` — 3 download triggers → non-prefetched `<a download>`.
- `app/app/qr/download/[asset]/route.ts` — prefetch-header guard + record-after-render.
- `lib/merchant/activity.ts` — stop rendering stale live-snapshot counts; metadata-gate point-in-time details; split QR scan/download in `summarizeActivity` / `ActivitySummary`.
- `tests/micro-specs/merchant-qr.test.ts` — prefetch-skip + download-semantics tests.
- `tests/micro-specs/merchant-readbacks.test.ts` — precision assertions.
- (Optional, deferred) a migration enriching join/stamp RPC metadata + a read-only investigation script for Part 3.

## Verification

1. `pnpm vitest run tests/micro-specs/merchant-qr.test.ts tests/micro-specs/merchant-readbacks.test.ts` — Red first, then Green.
2. `pnpm typecheck` and `pnpm lint`.
3. Manual (preview tools): open `/app/launch?tab=qr`, use `preview_network` to confirm **no** GET to `/app/qr/download/*` fires on page view; click a real Download and confirm exactly one request + the file; check `/app/activity` shows no new "QR downloaded" rows from the page view, one from the real download.
4. Part 3: run the read-only investigation SQL and review the burst report with the user before any cleanup.

## Out of scope / notes

- `stamp_claim_started` is currently never emitted in production; the claim↔issue threading in `activity.ts` stays as-is (dormant) — flagged, not changed.
- The optional RPC-metadata enrichment + historical backfill is deferred unless the user wants point-in-time counts shown accurately on past rows.

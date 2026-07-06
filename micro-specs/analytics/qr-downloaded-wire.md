---
spec_id: MS-analytics-qr-downloaded-wire
status: implemented
risk_class: product-analytics
owner: amankumarshrestha
last_reviewed: 2026-07-06
allowed_blast_radius:
  - micro-specs/analytics/**
  - app/app/qr/**
  - components/merchant/qr-poster/**
  - tests/unit/qr-downloaded-tracking.test.mjs
  - tests/micro-specs/analytics-qr-downloaded-wire.test.mjs
implementation_surfaces:
  - app/app/qr/**
  - components/merchant/qr-poster/**
  - tests/unit/qr-downloaded-tracking.test.mjs
  - tests/micro-specs/analytics-qr-downloaded-wire.test.mjs
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - reports/db-schema-audit-2026-07-06.md
related_tests:
  - tests/unit/qr-downloaded-tracking.test.mjs
  - tests/micro-specs/analytics-qr-downloaded-wire.test.mjs
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
required_playwright_projects: []
evidence_required:
  - Command output for the declared verification gates.
  - Unit test output proving each explicit QR asset download action records exactly one qr_downloaded product event with an asset_type metadata value, attributed to the acting merchant.
  - Event-contract assertion output showing qr_downloaded stays within the allowed product-event names and the activity feed metadata contract (asset_type) is satisfied.
approved_exceptions: []
---

# MS-analytics-qr-downloaded-wire — Record qr_downloaded product events from QR asset downloads

## 1. Exact Goal and User-Visible Outcomes

The merchant dashboard "QR downloads" count, the activity feed's
"QR downloaded" entries, and the pilot report's qr_downloaded source stop
being permanently zero. Today four surfaces read the `qr_downloaded` product
event (`lib/merchant/dashboard-period-counts.ts`, `lib/merchant/activity.ts`,
`lib/admin/pilot-report-sources.ts`, `lib/analytics/events.ts` registry) but
nothing ever writes it — the only writer ever designed, the
`record_qr_download` RPC, has zero call sites. When this ships, every explicit
QR asset download or print action on the merchant QR surfaces records one
`qr_downloaded` event, and those existing read surfaces light up with no
changes to them.

## 2. Blast Radius

May edit: `app/app/qr/**` (the QR page, its actions, the image route, and the
poster flow — wherever the explicit download/print affordances live),
`tests/unit/qr-downloaded-tracking.test.mjs` (new),
`tests/micro-specs/analytics-qr-downloaded-wire.test.mjs` (new), and this
spec's folder.

Out of scope: every reader (`dashboard-period-counts`, `activity`,
`pilot-report-sources`, the analytics registry — `qr_downloaded` is already an
allowed event name at `lib/analytics/events.ts:25`); the `record_qr_download`
RPC and any migration (its removal belongs to MS-db-dead-field-cleanup); the
customer reward QR (`app/reward/**` — that is a customer surface, not a
merchant asset download); dev-harness fixtures.

## 3. Strict Constraints and Assumptions

- Record through the existing `recordProductEvent` helper
  (`lib/analytics/events.ts`) from server code — the same path every other
  product event uses. Do not insert into `product_events` directly and do not
  call the dying `record_qr_download` RPC.
- Analytics are mirrors (GLOBAL_CONTEXT doctrine): recording is
  fire-and-forget; a failed insert must never fail or slow the download
  itself.
- Only explicit download/print intents count. Inline previews and page
  renders of the QR image must not record events (the image route may serve
  both cases — discriminate by the download affordance, not by the route
  being hit).
- `metadata.asset_type` must be set; the activity feed already formats it
  (`lib/merchant/activity.ts` `formatAssetType`).

## 4. Decisions Already Made

- Event name: `qr_downloaded` (already registered; do not invent a new name).
- Attribution: `merchant_id` of the acting merchant plus `qr_code_id` when the
  asset is tied to one; `actor_type` follows the existing recordProductEvent
  conventions for merchant-initiated actions.
- `asset_type` vocabulary: reuse the established values where they fit
  (`poster_pdf`, `till_card_png`, `sticker_png`) and use `qr_png` for the bare
  QR image download; new values are allowed only if a real affordance has no
  fit.
- No dedup/throttling: raw counts are the product intent; repeated downloads
  count repeatedly.
- Implementation-time finding (2026-07-06 affordance inventory): the ONLY
  explicit download/print affordance today is the poster "Print or save PDF"
  button (`window.print()`), which physically lives in
  `components/merchant/qr-poster/poster-preview-chrome.tsx`, with its mobile
  twin threaded through `a4-poster.tsx`'s PosterActionBar — hence the
  `components/merchant/qr-poster/**` family joins the radius. The bare QR image URL (`/app/qr/image/[qrCodeId]`) is used
  exclusively as an inline `<img>` (no download link exists), so `qr_png`
  stays reserved vocabulary until such an affordance ships.
- The client print handler fires the tracking server action WITHOUT awaiting
  it (`void`), so the print dialog can never be delayed or failed by
  analytics; the action itself resolves merchant + active QR server-side
  (client input is just the template id, validated against the template
  registry) and swallows all errors.

## 5. Behavioral Requirements (EARS)

- WHEN a merchant triggers an explicit QR asset download or print action on
  the QR or poster surfaces, THE system SHALL record exactly one
  `qr_downloaded` product event attributed to that merchant with a
  `metadata.asset_type` identifying the asset.
- WHERE the asset is generated for a specific QR code, THE event SHALL carry
  that `qr_code_id`.
- THE inline rendering of QR previews SHALL NOT record `qr_downloaded`
  events.
- IF recording the event fails, THEN THE download or print action SHALL still
  complete successfully.
- THE existing dashboard period counts, activity feed, and pilot report SHALL
  surface the recorded events without any changes to their code.

## 6. Verification Criteria and Task Breakdown

Observable behaviors to verify:

- Each distinct download affordance on the QR/poster surfaces produces one
  event with the right `asset_type` (unit-test the action/handler layer with
  the analytics call observable).
- A render of the QR page or inline preview produces zero events.
- A simulated analytics failure leaves the download path succeeding.
- The event payload satisfies the activity-feed contract (asset_type present,
  merchant attribution correct).

Task order: (1) inventory the explicit download/print affordances under
`app/app/qr/**` (page buttons, actions, image route download mode, poster
flow); (2) failing unit tests for the tracking behavior; (3) wire
`recordProductEvent` at the affordance layer; (4) green; (5)
`pnpm governance:run-gates --spec MS-analytics-qr-downloaded-wire --record`
and advance with `governance:advance`.

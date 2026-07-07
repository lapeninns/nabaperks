---
spec_id: MS-prefill-announcement-templates
status: active
risk_class: ui-only
owner: claude
last_reviewed: 2026-07-07
allowed_blast_radius:
  - micro-specs/prefill/**
  - components/merchant/announcements/announcement-compose.tsx
  - lib/notifications/announcement-templates.ts
  - app/app/announcements/page.tsx
  - app/dev/app-harness/announcements/harness-client.tsx
  - tests/unit/announcement-templates.test.mjs
  - tests/e2e/merchant-announcements-flow.ts
implementation_surfaces:
  - components/merchant/announcements/announcement-compose.tsx
  - lib/notifications/announcement-templates.ts
  - app/app/announcements/page.tsx
  - app/dev/app-harness/announcements/harness-client.tsx
  - tests/unit/announcement-templates.test.mjs
  - tests/e2e/merchant-announcements-flow.ts
related_tests:
  - tests/unit/announcement-templates.test.mjs
  - tests/e2e/merchant-announcements-flow.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm bundle:check
  - pnpm test:e2e -- --grep "@merchant-announcements"
  - pnpm test:a11y -- --project=chromium --project=mobile-safari
  - pnpm test:visual -- --project=chromium --project=mobile-safari
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Node unit test output proving template length limits, business-type mapping, and clean copy (no emoji or exclamation marks).
  - Playwright @merchant-announcements output proving a template chip prefills the title and body without sending.
  - Command output for the declared verification gates.
approved_exceptions: []
---

# MS-prefill-announcement-templates — Quick-fill venue announcement templates

## 1. Exact Goal and User-Visible Outcomes

The venue announcement composer shows a row of one-tap "Quick fill" chips above
the title field. Tapping a chip fills the title and body with a ready-made, en-GB
venue update (for example "Quiz night is back this week") that the merchant can
edit before sending. Nothing is sent or queued by tapping a chip — only the
existing Send action sends. The chips shown match the venue's business type: a pub
sees pub prompts, a cafe/dessert/bubble-tea venue sees daytime prompts, and every
other venue type sees a venue-neutral set.

## 2. Blast Radius

In scope:

- `lib/notifications/announcement-templates.ts` — the template data (pub, cafe,
  generic) and the `announcementTemplatesForBusinessType` selector.
- `components/merchant/announcements/announcement-compose.tsx` — a `templates`
  prop and the chip row that fills the draft fields.
- `app/app/announcements/page.tsx` — resolve templates from `merchant.business_type`.
- `app/dev/app-harness/announcements/harness-client.tsx` — feed the harness a
  fixed set so the DB-free e2e can exercise a chip.
- Unit + e2e coverage.

Out of scope: the send/queue path, rate-limit and moderation handling,
notification delivery, audience eligibility, any schema change, and the copy of
the platform terms.

## 3. Strict Constraints and Assumptions

- Prefill only. Tapping a chip mutates local draft state; it never sends, queues,
  or persists. This is the program invariant.
- en-GB Wet Ink copy; titles within the 80-character title limit and bodies within
  the 180-character body limit; no emoji and no exclamation marks.
- Templates live in `lib/**` (unit-testable for coverage) and are business-typed
  by mirroring `rewardPresetsForBusinessType`'s grouping.
- `merchant.business_type` is already loaded on the announcements page; reuse it.
- No new dependencies.

## 4. Decisions Already Made

- The template copy is owner-approved (2026-07-07).
- Business-typed grouping: `pub` -> pub set; `cafe`/`dessert`/`bubble_tea` -> cafe
  set; every other or unknown type -> the venue-neutral generic set.
- A chip fills both the title and body; the chip row sits above the title field.
- The component takes a resolved `templates` array (no business logic inside the
  component); the server page runs the selector.

## 5. Behavioral Requirements (EARS)

- WHERE the composer is given one or more templates, THE composer SHALL render a
  labelled chip for each template above the title field.
- WHEN the merchant taps a template chip, THE composer SHALL set the title and body
  draft fields to that template's title and body.
- IF a template chip is tapped, THEN THE composer SHALL NOT send or queue an
  announcement; only the explicit Send action sends.
- THE announcements page SHALL select the template set from the merchant's
  `business_type` (pub, cafe-family, or generic).
- WHERE the composer is given no templates, THE composer SHALL render no chip row
  and behave exactly as before.
- THE template titles SHALL be at most 80 characters and bodies at most 180
  characters, with no emoji or exclamation marks.

## 6. Verification Criteria and Task Breakdown

Observable behaviours to verify:

- Every template in every set is non-empty and within the 80/180 limits, with no
  emoji or exclamation marks (unit).
- `announcementTemplatesForBusinessType` returns the pub set for `pub`, the cafe
  set for `cafe`/`dessert`/`bubble_tea`, and the generic set for other/unknown/
  missing types (unit).
- In the DB-free harness, tapping the "Quiz night" chip fills the title and body
  with its copy and does not produce the "Announcement queued" banner (e2e).
- The existing send, rate-limit, moderation, and empty-audience flows still pass
  (e2e regression).

Tasks:

1. Add the templates lib + unit tests.
2. Add the `templates` prop + chip row to the composer; render nothing when empty.
3. Resolve templates from `business_type` on the real page; feed the harness a set.
4. Extend the `@merchant-announcements` flow with the prefill-not-sent assertion.
5. Run the declared gates, record evidence, and advance.

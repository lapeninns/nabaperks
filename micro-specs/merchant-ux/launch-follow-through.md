---
spec_id: MS-merchant-ux-launch-follow-through
status: implemented
risk_class: ui-only
owner: codex
last_reviewed: 2026-07-10
allowed_blast_radius:
  - micro-specs/merchant-ux/launch-follow-through.md
  - micro-specs/evidence/MS-merchant-ux-launch-follow-through.json
  - app/app/page.tsx
  - app/dev/app-harness/dashboard/page.tsx
  - app/dev/app-harness/launch/page.tsx
  - components/merchant/dashboard-header-actions.tsx
  - components/merchant/launch-readiness-panel.tsx
  - components/merchant/launch/qr-panel-live.tsx
  - components/merchant/launch/email-poster-button.tsx
  - components/merchant/loyalty-card-form.tsx
  - components/merchant/launch/rewards-panel.tsx
  - components/merchant/account/billing-activation-card.tsx
  - components/merchant/account/billing-panel-view.tsx
  - lib/merchant/launch-readiness-core.ts
  - tests/unit/launch-readiness-core.test.mjs
  - tests/micro-specs/merchant-launch-follow-through.test.mjs
  - tests/micro-specs/merchant-venue-announcements-ui.test.mjs
  - tests/e2e/merchant-launch-follow-through-flow.ts
  - tests/e2e/merchant-launch-follow-through.spec.ts
  - tests/e2e/merchant-launch-follow-through.desktop.spec.ts
  - tests/e2e/merchant-launch-follow-through.spec.ts-snapshots/**
  - tests/e2e/merchant-launch-follow-through.desktop.spec.ts-snapshots/**
  - tests/e2e/visual.spec.ts-snapshots/harness-dashboard-mobile-safari.png
  - tests/e2e/visual.spec.ts-snapshots/harness-dashboard-mobile-safari-linux.png
  - tests/e2e/visual.spec.ts-snapshots/harness-qr-chromium.png
  - tests/e2e/visual.spec.ts-snapshots/harness-qr-chromium-linux.png
  - tests/e2e/visual.spec.ts-snapshots/harness-qr-mobile-safari.png
  - tests/e2e/visual.spec.ts-snapshots/harness-qr-mobile-safari-linux.png
implementation_surfaces:
  - micro-specs/merchant-ux/launch-follow-through.md
  - micro-specs/evidence/MS-merchant-ux-launch-follow-through.json
  - app/app/page.tsx
  - app/dev/app-harness/dashboard/page.tsx
  - app/dev/app-harness/launch/page.tsx
  - components/merchant/dashboard-header-actions.tsx
  - components/merchant/launch-readiness-panel.tsx
  - components/merchant/launch/qr-panel-live.tsx
  - components/merchant/launch/email-poster-button.tsx
  - components/merchant/loyalty-card-form.tsx
  - components/merchant/launch/rewards-panel.tsx
  - components/merchant/account/billing-activation-card.tsx
  - components/merchant/account/billing-panel-view.tsx
  - lib/merchant/launch-readiness-core.ts
  - tests/unit/launch-readiness-core.test.mjs
  - tests/micro-specs/merchant-launch-follow-through.test.mjs
  - tests/micro-specs/merchant-venue-announcements-ui.test.mjs
  - tests/e2e/merchant-launch-follow-through-flow.ts
  - tests/e2e/merchant-launch-follow-through.spec.ts
  - tests/e2e/merchant-launch-follow-through.desktop.spec.ts
  - tests/e2e/merchant-launch-follow-through.spec.ts-snapshots/**
  - tests/e2e/merchant-launch-follow-through.desktop.spec.ts-snapshots/**
  - tests/e2e/visual.spec.ts-snapshots/harness-dashboard-mobile-safari.png
  - tests/e2e/visual.spec.ts-snapshots/harness-dashboard-mobile-safari-linux.png
  - tests/e2e/visual.spec.ts-snapshots/harness-qr-chromium.png
  - tests/e2e/visual.spec.ts-snapshots/harness-qr-chromium-linux.png
  - tests/e2e/visual.spec.ts-snapshots/harness-qr-mobile-safari.png
  - tests/e2e/visual.spec.ts-snapshots/harness-qr-mobile-safari-linux.png
related_docs:
  - micro-specs/GLOBAL_CONTEXT.md
  - micro-specs/merchant/launch.md
  - micro-specs/merchant/qr-poster.md
  - reports/merchant-journey-ux-audit-2026-07-09.md
related_tests:
  - tests/unit/launch-readiness-core.test.mjs
  - tests/micro-specs/merchant-launch-follow-through.test.mjs
  - tests/micro-specs/merchant-venue-announcements-ui.test.mjs
  - tests/e2e/merchant-launch-follow-through.spec.ts
  - tests/e2e/merchant-launch-follow-through.desktop.spec.ts
verification_gates:
  - pnpm lint
  - pnpm typecheck
  - pnpm build
  - pnpm test
  - pnpm test:coverage
  - pnpm bundle:check
  - pnpm test:e2e -- --project=chromium --project=mobile-safari --grep "@MS-merchant-ux-launch-follow-through"
  - pnpm test:a11y -- --project=chromium --project=mobile-safari
  - pnpm test:visual -- --project=chromium --project=mobile-safari
required_playwright_projects:
  - chromium
  - mobile-safari
evidence_required:
  - Command output for every declared verification gate.
  - Mobile browser proof at exactly 375x812 that the setup rail is visibly navigable, keyboard focus is visible, the next step is announced, and no horizontal overflow occurs.
  - Desktop browser proof at exactly 1280x800 that the setup rail, dashboard action, QR destination, poster promise, and email-link wording match the same contracts.
  - Axe and visual-regression evidence for the focused mobile and desktop launch states, including the QR poster moment.
  - Source and browser proof that the live dashboard retains its counter actions while an incomplete setup exposes only the authoritative Finish setup action.
approved_exceptions: []
---

# MS-merchant-ux-launch-follow-through — Merchant activation follow-through

## 1. Exact Goal and User-Visible Outcomes

A merchant can understand and operate every remaining launch step on phone or
desktop: the dashboard sends an unfinished venue to its true next task, the
setup rail clearly behaves as navigation, completed QR work stays inside the
launch hub, and the poster screen gives honest phone-native guidance plus the
current free-print offer without implying fulfilment has already happened.

## 2. Blast Radius

May edit only the shared dashboard header action, launch readiness model and
rail, QR/poster presentation, the three isolated numbered setup labels, the
DB-free dashboard/launch harness seams, and the focused source, unit, browser,
accessibility, and visual evidence listed in frontmatter.

Out of scope: changing poster-email recipients or delivery plumbing, attaching
or generating a PDF, creating a fulfilment/reservation workflow, changing the
promo terms or price, changing QR activation rules, database/schema/RLS work,
Stripe behaviour, authentication, onboarding persistence, analytics, customer
flows, hosted writes, or redesigning the Wet Ink foundations.

## 3. Strict Constraints and Assumptions

- `getActivePromo()` remains the one current source of the free-print perk and
  claim instructions. The launch UI must render its exact `perk` and `claim`
  when active and render no promo block when it returns null.
- The existing poster action emails a protected poster-page link, not a PDF.
  Every button, pending state, success state, and error state must say `link`
  and must not claim a file or print job was sent.
- The UI must never say a poster is `on its way`, reserved, ordered, or posted
  until a durable fulfilment state exists. The active offer explains how the
  merchant claims it; it does not manufacture fulfilment state.
- `isVenueOperational(readiness)` remains authoritative for the dashboard.
  Incomplete first-run venues get one Finish setup action to
  `readiness.nextStep.href`; live and paused-but-launched venues retain Announce
  and Scan reward.
- The production dashboard and its DB-free harness use one shared action
  component/model so the audited harness cannot drift from production again.
- Harness readiness always includes the product's billing gate so first-run
  progress stays `N of 5`, matching production instead of drifting to `N of 4`.
- The launch rail remains the navigation; no second tab system is added. Its
  ordered steps need a labelled navigation landmark, an explicit visible cue,
  accurate ready/next-up/to-do accessible names, and the shared Wet Ink focus
  ring at every breakpoint.
- Global progress belongs to the launch header and readiness rail. The card,
  rewards fallback, and billing surfaces do not independently claim `Step N`;
  QR's internal `01 Share` and `02 Print` task order remains intact.
- A ready QR step links to `/app/launch?tab=qr` while the merchant is using the
  hub. `/app/qr` remains available from steady-state merchant navigation.
- Visual proof uses deterministic promo time and exact 375x812 and 1280x800
  viewports. Both must preserve at least 44px interactive targets, readable
  copy, no obscured focus, and no horizontal overflow.
- This slice is presentation-only. Server actions, provider calls, database
  writes, and security boundaries remain unchanged.

## 4. Decisions Already Made

- Add one shared `MerchantDashboardHeaderActions` seam and render it from both
  `/app` and `/dev/app-harness/dashboard`; the harness supplies incomplete or
  operational readiness rather than duplicating buttons.
- Keep the QR checklist href at `QR_LAUNCH_TAB_PATH` in all readiness states and
  use `Review venue QR` once it is ready.
- Label both desktop and mobile readiness lists as `Merchant setup steps` and
  show `Choose a setup step` beside both hub rails; the next unfinished link's
  accessible name ends in `next up`.
- Use the shared `.focus-ring` recipe for rail links instead of a private or
  missing outline treatment.
- Put the active promo beside the poster task and retain the two internal poster
  tasks. Phone guidance leads with emailing the poster link or opening an A4;
  desktop guidance retains 100% print scale.
- Rename the client action to `Email poster link`, pending copy to
  `Emailing link…`, and all result headings to poster-link language.
- Remove isolated numeric step eyebrows from the card, rewards fallback, setup
  activation card, and setup-mode billing receipt; retain useful unnumbered
  labels such as `Billing` or `Rewards` where needed.
- Make the launch harness derive QR active/scannable props from its readiness so
  `?state=live&tab=qr` cannot claim both live and billing-needed at once.

## 5. Behavioral Requirements (EARS)

- **LFT-1 (truthful poster offer):** WHEN an active promo exists, THE QR poster
  surface SHALL show the exact current perk and claim instructions without
  claiming that fulfilment has started; WHEN no promo exists, it SHALL omit the
  promo block.
- **LFT-2 (phone-native poster path):** WHEN a merchant reaches the poster task,
  THE surface SHALL explain phone and computer choices and expose `Email poster
link`; WHILE that action is pending or settled, all status copy SHALL describe
  a link rather than a PDF, attachment, or completed print order.
- **LFT-3 (authoritative dashboard action):** WHILE setup is incomplete, THE
  dashboard header SHALL expose one primary `Finish setup` link to the current
  next step and SHALL NOT expose Scan reward or Announce; WHILE the venue is
  operational, it SHALL preserve Announce and Scan reward.
- **LFT-4 (hub continuity):** WHEN the QR step is ready, THE readiness rail SHALL
  link to `/app/launch?tab=qr` and label the action `Review venue QR` rather than
  leaving the launch hub.
- **LFT-5 (rail discoverability):** WHERE the launch rail is rendered, THE step
  list SHALL live in a `Merchant setup steps` navigation landmark, show a mobile
  `Choose a setup step` cue in hub mode, announce each state as ready, next up,
  or to do, and retain visible keyboard focus.
- **LFT-6 (one progress system):** WHERE card, rewards fallback, or billing setup
  content renders, THE content SHALL omit isolated `Step 2`, `Step 3`, and
  `Step 5 of 5` labels while the readiness header/rail remains the global
  progress source; QR task labels 01 and 02 SHALL remain.
- **LFT-7 (harness fidelity):** WHEN the DB-free launch harness is live, THE QR
  SHALL render active and scan-ready; WHEN billing remains pending, THE harness
  SHALL render the existing billing-needed state. The dashboard harness SHALL
  use the same readiness-driven header action as production and SHALL retain a
  five-step denominator for first-run billing merchants.
- **LFT-8 (responsive access):** AT 375x812 and 1280x800, THE launch rail,
  dashboard action, poster promise, and email-link control SHALL have no
  horizontal overflow, obscured focus, axe A/AA violation, or clipped primary
  action.
- **LFT-9 (no behavioural widening):** IF this UI slice ships, THEN QR activation,
  billing, promo calculation, email delivery, and database behaviour SHALL
  remain byte-for-byte governed by their existing server boundaries.

## 6. Verification Criteria and Task Breakdown

1. Write failing source/unit tests first for the hub-contained QR href and label,
   shared dashboard action seam, exact promo source, honest poster-link wording,
   rail landmark/cue/focus/state semantics, removed step-number fragments, and
   launch-harness QR fidelity.
2. Write focused mobile and desktop Playwright tests tagged
   `@MS-merchant-ux-launch-follow-through`; pin 375x812 and 1280x800, dashboard
   incomplete/live actions, rail href/state/focus, promo text, email-link copy,
   QR task ordering, axe results, overflow, and visual baselines.
3. Extract the shared dashboard header action and use it in production and the
   harness without changing operational-venue behaviour.
4. Keep ready QR navigation inside the hub, add rail landmark/cue/focus and
   next-up semantics, and remove redundant numbered setup labels.
5. Render the current promo's exact perk/claim at the poster moment, make device
   guidance actionable, and rename only the existing email-link presentation.
6. Correct launch-harness QR active/scannable props, update affected baselines,
   run the focused tests, then run every declared gate and record the evidence
   ledger before advancing through the machine-owned lifecycle.

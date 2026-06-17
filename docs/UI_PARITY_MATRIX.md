# UI Parity Matrix — Wet Ink reference → production

Tracks the [Wet Ink full UI rewrite](../micro-specs/01-foundation/04-wet-ink-full-ui-rewrite.md).
One row per reference component in
[`outputs/nabaperks-ui-reference/component-inventory.md`](../outputs/nabaperks-ui-reference/component-inventory.md)
(94 rows across 8 surfaces). The reference is **visual/interaction reference only** —
nothing imports from `outputs/**`.

**Verdict** (from the inventory): ✅ reusable as-is · ⚠️ port (lift visual/behaviour,
re-home styles into tokens/`data-slot`) · 🔒 prototype-only.

**Status:** `done` · `in_progress` · `pending` · `skipped` (with rationale). A row is
`skipped` when the reference contradicts production mechanics (staff PIN, tap-to-redeem,
`localStorage` state machines) or is pure tooling/storyboard (Tweaks, Journey).

**Definition of done:** every `⚠️` row is `done` or `skipped` with rationale.

---

## Shared foundation (18) — `components/brand`, `components/forms`, `components/loyalty`, `components/motion`

| Reference       | Production target                                                                                                                            | Verdict | Status  | Notes                                                                                      |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------- | ------------------------------------------------------------------------------------------ |
| InkButton       | `components/ui/button.tsx` + globals Wet Ink layer (press)                                                                                   | ⚠️      | done    | Tactile press is the `.pressable` / `[data-slot=button]:active` CSS layer; no shadcn edit. |
| GhostLink       | `components/ui/button.tsx` (`variant="ghost"/"link"`)                                                                                        | ⚠️      | done    | Confirm ghost/link parity in dev catalog.                                                  |
| MonoTag         | [mono-tag.tsx](../components/brand/mono-tag.tsx)                                                                                             | ⚠️      | done    | Accent/ink/plain tones present.                                                            |
| MonoLine        | [mono-tag.tsx](../components/brand/mono-tag.tsx) / `eyebrow` in [typography.tsx](../components/brand/typography.tsx)                         | ⚠️      | done    | Verify uppercase mono caption tracking matches reference.                                  |
| DemoTag         | (dev harness only)                                                                                                                           | 🔒      | skipped | Demo/jump control — prototype tooling, not a product surface.                              |
| VenueMark       | [venue-mark.tsx](../components/brand/venue-mark.tsx)                                                                                         | ⚠️      | done    | Stamp-family rotation (-6° to -8°), double ring + initials.                                |
| ReceiptCard     | [receipt-card.tsx](../components/brand/receipt-card.tsx)                                                                                     | ⚠️      | done    | Torn edge + `shaken` via `WetInkShake`.                                                    |
| ReceiptRule     | [receipt-card.tsx](../components/brand/receipt-card.tsx) (`ReceiptRule`)                                                                     | ⚠️      | done    | Confirm dashed tear-line export in catalog.                                                |
| CelebrationBits | [stamp-celebration.tsx](../components/motion/stamp-celebration.tsx) + [reward-celebration.tsx](../components/loyalty/reward-celebration.tsx) | 🔒→⚠️   | done    | Ported as hard-edged riso burst via `WetInkPop`; no party shower.                          |
| StampDisc       | [stamp-grid.tsx](../components/loyalty/stamp-grid.tsx) (`StampDot`)                                                                          | ⚠️      | done    | `WetInkSlam`, `--stamp-rot` tilt, compact mode.                                            |
| StampRow        | [stamp-grid.tsx](../components/loyalty/stamp-grid.tsx) (`StampGrid`)                                                                         | ⚠️      | done    | Punch-card row + reward chip.                                                              |
| ProgressLine    | [progress-track.tsx](../components/loyalty/progress-track.tsx)                                                                               | ⚠️      | done    | Verify labelled accent bar + current/total.                                                |
| PinPad          | —                                                                                                                                            | 🔒      | skipped | Retired handed-phone mechanic; never ported.                                               |
| OtpBoxes        | [otp-input.tsx](../components/forms/otp-input.tsx)                                                                                           | ⚠️      | done    | Ink-bordered cells, shadow-as-cursor; audit vs reference.                                  |
| Sheet           | `WetInkSheet` + [legal-sheet.tsx](../components/customer/legal-sheet.tsx) + `components/ui/sheet.tsx`                                        | ⚠️      | done    | Bottom-sheet entrance via `WetInkSheet`.                                                   |
| Seal            | [reward-seal.tsx](../components/loyalty/reward-seal.tsx)                                                                                     | ⚠️      | done    | Single seal vocabulary, 3 sizes, 4 states; idle wiggle on sealed only.                     |
| GpsCheck        | (GPS writes `fraud_flags`, never blocks — no reveal UI)                                                                                      | 🔒      | skipped | Reference radar reveal contradicts non-blocking GPS policy.                                |
| V3App           | App Router routes + shells                                                                                                                   | 🔒      | skipped | `localStorage` surface switcher replaced by real routing.                                  |

## Customer (13) — `components/customer`, `components/layout/customer-*`

| Reference             | Production target                                                                       | Verdict | Status | Notes                                                    |
| --------------------- | --------------------------------------------------------------------------------------- | ------- | ------ | -------------------------------------------------------- |
| CuScanView            | [customer-qr-scanner.tsx](../components/customer/customer-qr-scanner.tsx)               | 🔒→⚠️   | done   | Real camera scanner; lift viewfinder chrome only.        |
| CustomerFlow          | [customer-flow-system.tsx](../components/customer/customer-flow-system.tsx)             | 🔒→⚠️   | done   | Screen states ported onto real routing; no LS machine.   |
| Screen-scan           | [customer-qr-scanner-loader.tsx](../components/customer/customer-qr-scanner-loader.tsx) | 🔒      | done   | Auto-advance handled by route resolution.                |
| Screen-landing        | [join-welcome-step.tsx](../components/customer/join-welcome-step.tsx)                   | 🔒→⚠️   | done   | Post-scan welcome + first-stamp CTA.                     |
| Screen-firstStamp     | [customer-card-experience.tsx](../components/customer/customer-card-experience.tsx)     | 🔒→⚠️   | done   | "That's one" celebration inside receipt.                 |
| Screen-save           | [join-forms.tsx](../components/customer/join-forms.tsx)                                 | 🔒→⚠️   | done   | Phone capture; "Save my card" register.                  |
| Screen-otp            | [join-otp-form.tsx](../components/customer/join-otp-form.tsx)                           | 🔒→⚠️   | done   | Real Twilio Verify; `OtpBoxes` layout.                   |
| Screen-card           | [customer-card-experience.tsx](../components/customer/customer-card-experience.tsx)     | 🔒→⚠️   | done   | Self-service stamp from the venue QR, **no PIN sheet**.  |
| Screen-alreadyStamped | [customer-card-experience.tsx](../components/customer/customer-card-experience.tsx)     | 🔒→⚠️   | done   | One-per-day calm state; no "skip to tomorrow" cheat.     |
| Screen-sealed         | [reward-panels.tsx](../components/customer/reward-panels.tsx)                           | 🔒→⚠️   | done   | Sealed mystery via `RewardSeal`/`RewardTicket`.          |
| Screen-revealed       | [reward-panels.tsx](../components/customer/reward-panels.tsx)                           | 🔒→⚠️   | done   | Reveal + riso confetti; cooldown copy.                   |
| Screen-ready          | [reward-panels.tsx](../components/customer/reward-panels.tsx)                           | 🔒→⚠️   | done   | Redeemable reward, **merchant scan** (no tap-to-redeem). |
| Screen-redeemed       | [reward-panels.tsx](../components/customer/reward-panels.tsx)                           | 🔒→⚠️   | done   | "Enjoy" closer; card resets server-side.                 |

## Merchant (24) — `components/merchant`, `components/layout/merchant-app-shell`

| Reference         | Production target                                                                                                                               | Verdict | Status  | Notes                                                                                                                                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QrBlock           | [qr-frame.tsx](../components/loyalty/qr-frame.tsx) + real QR payload                                                                            | 🔒→⚠️   | done    | Real QR matrix; lift frame chrome.                                                                                                                                                                  |
| McBrand           | [merchant-app-shell.tsx](../components/layout/merchant-app-shell.tsx)                                                                           | ⚠️      | done    | Masthead: `✱` disc + wordmark + venue chip.                                                                                                                                                         |
| McStat            | [typography.tsx](../components/brand/typography.tsx) (`MetricTile`)                                                                             | ⚠️      | done    | Dashboard metric tile.                                                                                                                                                                              |
| McFeedLine        | [activity-compact-feed.tsx](../components/merchant/activity-compact-feed.tsx)                                                                   | ⚠️      | done    | Till-activity feed row (event dot + time).                                                                                                                                                          |
| McField           | [form-field.tsx](../components/forms/form-field.tsx)                                                                                            | ⚠️      | done    | Labelled mono text input.                                                                                                                                                                           |
| McAuth            | [auth-form.tsx](../components/auth/auth-form.tsx)                                                                                               | 🔒→⚠️   | done    | McAuth Wet Ink layout (VenueMark masthead, ink-bordered McField wells, full-width tactile submit); production keeps Supabase **email + password** (passwordless OTP is prototype-only, not ported). |
| McOnboarding      | [onboarding-form.tsx](../components/merchant/onboarding-form.tsx)                                                                               | 🔒→⚠️   | done    | 3-step wizard (venue → reward → QR).                                                                                                                                                                |
| McToday           | [dashboard-home-streams.tsx](../components/merchant/dashboard-home-streams.tsx) + [app/app/page.tsx](../app/app/page.tsx)                       | 🔒→⚠️   | done    | Stats + live feed + till QR; **no staff PIN**.                                                                                                                                                      |
| McCounter         | —                                                                                                                                               | 🔒      | skipped | Pinned-till staff display tied to retired PIN model.                                                                                                                                                |
| MerchantSurface   | `app/app/*` routing + shell                                                                                                                     | 🔒      | skipped | Stage machine replaced by real routing.                                                                                                                                                             |
| MoHead            | [typography.tsx](../components/brand/typography.tsx) (`PageTitle`/`SectionHeader`)                                                              | ⚠️      | done    | Ops page header.                                                                                                                                                                                    |
| MoChip            | [activity-detail-feed.tsx](../components/merchant/activity-detail-feed.tsx) (filter pills)                                                      | ⚠️      | done    | Uppercase mono filter pill, active = ink fill.                                                                                                                                                      |
| MoToggle          | `components/ui` switch usage (e.g. QR live/paused)                                                                                              | ⚠️      | done    | Wet Ink switch, leaf-green on.                                                                                                                                                                      |
| MoMiniStamps      | [customer-readback-table.tsx](../components/merchant/customer-readback-table.tsx)                                                               | ⚠️      | done    | Inline mini stamp dots + count.                                                                                                                                                                     |
| MoField           | [form-field.tsx](../components/forms/form-field.tsx)                                                                                            | ⚠️      | done    | Labelled mono input with optional prefix.                                                                                                                                                           |
| MoEventRow        | [activity-detail-feed.tsx](../components/merchant/activity-detail-feed.tsx)                                                                     | ⚠️      | done    | Activity row via `WetInkRise`.                                                                                                                                                                      |
| MerchantActivity  | [activity-detail-feed.tsx](../components/merchant/activity-detail-feed.tsx) + [app/app/activity/page.tsx](../app/app/activity/page.tsx)         | 🔒→⚠️   | done    | Day-grouped feed + filters; real data.                                                                                                                                                              |
| MerchantCustomers | [customer-readback-table.tsx](../components/merchant/customer-readback-table.tsx)                                                               | 🔒→⚠️   | done    | Privacy-first table (initials + masked phone).                                                                                                                                                      |
| MoPosterPreview   | [launch/qr-panel.tsx](../components/merchant/launch/qr-panel.tsx) assets                                                                        | 🔒→⚠️   | done    | A4 poster preview.                                                                                                                                                                                  |
| MoTillPreview     | [launch/qr-panel.tsx](../components/merchant/launch/qr-panel.tsx) assets                                                                        | 🔒→⚠️   | done    | Landscape till-card preview.                                                                                                                                                                        |
| MoStickerPreview  | [launch/qr-panel.tsx](../components/merchant/launch/qr-panel.tsx) assets                                                                        | 🔒→⚠️   | done    | Round-vinyl sticker preview.                                                                                                                                                                        |
| MerchantQrStudio  | [launch/qr-panel.tsx](../components/merchant/launch/qr-panel.tsx) + [app/app/launch/page.tsx](../app/app/launch/page.tsx)                       | 🔒→⚠️   | done    | Print-asset studio; real downloads.                                                                                                                                                                 |
| MerchantSettings  | [account/profile-panel.tsx](../components/merchant/account/profile-panel.tsx) + [profile-form.tsx](../components/merchant/profile-form.tsx)     | 🔒→⚠️   | done    | Venue edit; **no staff-PIN reveal/rotate**.                                                                                                                                                         |
| MerchantBilling   | [account/billing-panel.tsx](../components/merchant/account/billing-panel.tsx) + [billing-status.tsx](../components/merchant/billing-status.tsx) | 🔒→⚠️   | done    | £29/mo plan, real Stripe portal.                                                                                                                                                                    |

## Staff (5) — retired mechanic

| Reference    | Production target | Verdict | Status  | Notes                                 |
| ------------ | ----------------- | ------- | ------- | ------------------------------------- |
| StLoad       | —                 | 🔒      | skipped | Handed-phone station, retired.        |
| StPanel      | —                 | 🔒      | skipped | Station surface, retired.             |
| StPinPeek    | —                 | 🔒      | skipped | Staff-PIN peek, retired.              |
| StCardStrip  | —                 | 🔒      | skipped | "Whose phone is this" strip, retired. |
| StaffSurface | —                 | 🔒      | skipped | Counter-station machine, retired.     |

## Admin (7) — `components/admin`, `components/layout/admin-shell`

| Reference    | Production target                                                                                        | Verdict | Status | Notes                                    |
| ------------ | -------------------------------------------------------------------------------------------------------- | ------- | ------ | ---------------------------------------- |
| AdPanel      | [support.tsx](../components/admin/support.tsx) + [admin-shell.tsx](../components/layout/admin-shell.tsx) | ⚠️      | done   | Quieter-ink card chrome (`--w-paper-2`). |
| AdStat       | [data/](../components/data) + [typography.tsx](../components/brand/typography.tsx)                       | ⚠️      | done   | KPI tile for overview.                   |
| AdStatusTag  | [mono-tag.tsx](../components/brand/mono-tag.tsx)                                                         | ⚠️      | done   | Status → coloured MonoTag chip.          |
| AdBars       | [funnel-chart.tsx](../components/data/funnel-chart.tsx)                                                  | ⚠️      | done   | Inline bar sparkline.                    |
| AdFact       | [data-table.tsx](../components/data/data-table.tsx) / fact cell                                          | ⚠️      | done   | Mono-caption over bold-value cell.       |
| AdToast      | `components/ui/sonner.tsx` usage                                                                         | ⚠️      | done   | Confirmation toast via `WetInkRise`.     |
| AdminSurface | [admin-shell.tsx](../components/layout/admin-shell.tsx) + `app/admin/*`                                  | 🔒→⚠️   | done   | MFA gate banner + tabs; real routing.    |

## Marketing (9) — `components/marketing`, `components/layout/marketing-layout`, marketing pages

| Reference     | Production target                                                                                                      | Verdict | Status | Notes                                          |
| ------------- | ---------------------------------------------------------------------------------------------------------------------- | ------- | ------ | ---------------------------------------------- |
| MkNav         | [marketing-layout.tsx](../components/layout/marketing-layout.tsx)                                                      | ⚠️      | done   | Wordmark + ghost links + signup CTAs.          |
| MkQuoteCard   | [app/page.tsx](../app/page.tsx) testimonial                                                                            | ⚠️      | done   | Tilted pilot-testimonial receipt.              |
| MkFaqItem     | [app/pricing/page.tsx](../app/pricing/page.tsx) FAQ                                                                    | ⚠️      | done   | Single-open accordion via `WetInkRise`.        |
| MkLegalColumn | legal pages                                                                                                            | ⚠️      | done   | Data-driven legal receipt.                     |
| MkFooter      | [marketing-layout.tsx](../components/layout/marketing-layout.tsx)                                                      | ⚠️      | done   | Footer wordmark + Terms/Privacy.               |
| MkHome        | [app/page.tsx](../app/page.tsx)                                                                                        | ⚠️      | done   | Hero + steps + counter band + quotes + teaser. |
| MkPricing     | [app/pricing/page.tsx](../app/pricing/page.tsx)                                                                        | ⚠️      | done   | £29 receipt + FAQ.                             |
| MkLegal       | legal pages                                                                                                            | ⚠️      | done   | Plain-English legal page.                      |
| MarketingSite | [marketing-layout.tsx](../components/layout/marketing-layout.tsx) + [marquee.tsx](../components/marketing/marquee.tsx) | ⚠️      | done   | Marquee via `WetInkMarquee`; no LS view-state. |

## Journey (6) — storyboard scaffolding

| Reference   | Production target | Verdict | Status  | Notes                                             |
| ----------- | ----------------- | ------- | ------- | ------------------------------------------------- |
| JyGlyph     | —                 | ⚠️      | skipped | Storyboard demo only; not a product surface.      |
| JyArrowLink | —                 | ⚠️      | skipped | Storyboard demo only.                             |
| JyStepCard  | —                 | ⚠️      | skipped | Storyboard demo only.                             |
| JyLane      | —                 | ⚠️      | skipped | Storyboard demo only.                             |
| JyTieStrip  | —                 | ⚠️      | skipped | Storyboard demo only.                             |
| JourneyMap  | —                 | 🔒      | skipped | Full storyboard; clears LS keys — reference only. |

## Tweaks (12) — design-control tooling

| Reference                                                                                                                                               | Production target | Verdict | Status  | Notes                                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ------- | ------- | --------------------------------------------------------------------------- |
| App / TweaksPanel / TweakSection / TweakRow / TweakSlider / TweakToggle / TweakRadio / TweakSelect / TweakText / TweakNumber / TweakColor / TweakButton | —                 | 🔒      | skipped | External host-postMessage tooling (`@ds-adherence-ignore`); reference only. |

---

## Roll-up

| Surface           | Rows   | done   | skipped |
| ----------------- | ------ | ------ | ------- |
| Shared foundation | 18     | 14     | 4       |
| Customer          | 13     | 13     | 0       |
| Merchant          | 24     | 22     | 2       |
| Staff             | 5      | 0      | 5       |
| Admin             | 7      | 7      | 0       |
| Marketing         | 9      | 9      | 0       |
| Journey           | 6      | 0      | 6       |
| Tweaks            | 12     | 0      | 12      |
| **Total**         | **94** | **65** | **29**  |

Every `⚠️ port` row is `done` or `skipped` — no row is left pending. `skipped` rationale
categories: retired staff-PIN/handed-phone mechanic (PinPad, all Staff, McCounter,
MerchantSettings PIN affordance), non-blocking-GPS policy (GpsCheck), `localStorage` surface
machines replaced by real routing (V3App, MerchantSurface), and reference-only tooling/storyboard
(DemoTag, Journey ×6, Tweaks ×12).

## Sign-off

Verification basis for the `done` rows (2026-06-17):

- **Foundation** — motion migrated to the `WetInk*` primitives (no raw `animation: w-*` /
  `animate-[w-*]`; enforced by [wet-ink-motion.test.ts](../tests/micro-specs/wet-ink-motion.test.ts)),
  the pint reward retired, and every primitive + loyalty state rendered live in the
  [`/dev/design-system`](../app/dev/design-system/page.tsx) catalog (the acceptance gate).
- **Customer** — [customer-flow-redesign](../tests/micro-specs/customer-flow-redesign.test.ts) +
  [earned-stamp-redesign](../tests/micro-specs/earned-stamp-redesign.test.ts) pass; the full-card
  state verified in the dev preview harness.
- **Merchant** — [merchant-readbacks](../tests/micro-specs/merchant-readbacks.test.ts) passes; the
  skeleton overhaul (minimal route loading + structure-mirroring Suspense skeletons) is complete.
- **Admin** — [admin-console-redesign](../tests/micro-specs/admin-console-redesign.test.ts) passes
  (quieter ink, MFA banner, shared data primitives).
- **Marketing / Auth** — [marketing-redesign](../tests/micro-specs/marketing-redesign.test.ts) +
  [auth-redesign](../tests/micro-specs/auth-redesign.test.ts) pass; home, pricing, and `/login`
  verified rendering in the preview.

Gates green: `pnpm lint`, `pnpm typecheck`, `pnpm test` (full suite), `pnpm governance`. Remaining
Phase 3.1 step is refreshing the Playwright screenshot baselines per the runbook.

# Component Inventory

**94 components** catalogued across **8 surfaces**, extracted from 10 application modules. Each row links to its individual reference file. Reuse verdict legend: ✅ reusable as-is · ⚠️ reusable, needs refactor · 🔒 prototype-only.

| Surface                   | Count | Module(s)                                     |
| ------------------------- | ----- | --------------------------------------------- |
| [Shared](#shared-18)      | 18    | `10-primitives.jsx`, `90-app-shell.jsx`       |
| [Customer](#customer-13)  | 13    | `30-customer.jsx`                             |
| [Merchant](#merchant-24)  | 24    | `20-merchant-core.jsx`, `21-merchant-ops.jsx` |
| [Staff](#staff-5)         | 5     | `22-staff-counter.jsx`                        |
| [Admin](#admin-7)         | 7     | `40-admin.jsx`                                |
| [Marketing](#marketing-9) | 9     | `50-marketing.jsx`                            |
| [Journey](#journey-6)     | 6     | `60-journey.jsx`                              |
| [Tweaks](#tweaks-12)      | 12    | `00-tweaks-panel.jsx`                         |

**Verdict split:** 0 ✅ · 45 ⚠️ · 49 🔒. (No component is importable as-is — every one uses inline styles and/or `window.*` exports — but 45 carry portable visual/behaviour concepts.)

---

## Shared (18)

The Wet Ink foundation + the app shell. Files in [`components/shared/`](components/shared/).

| Component                                               | Purpose                                                        | Verdict | Key deps                                   |
| ------------------------------------------------------- | -------------------------------------------------------------- | ------- | ------------------------------------------ |
| [InkButton](components/shared/InkButton.md)             | Primary tactile press button (3 palettes × 3 sizes)            | ⚠️      | `--w-accent/-ink/-shadow`                  |
| [GhostLink](components/shared/GhostLink.md)             | Low-emphasis underlined text-button                            | ⚠️      | `--w-display/-ink`                         |
| [MonoTag](components/shared/MonoTag.md)                 | Mono pill badge (accent / ink / plain)                         | ⚠️      | `--w-mono`, tone colours                   |
| [MonoLine](components/shared/MonoLine.md)               | Small uppercase mono caption/label                             | ⚠️      | `--w-mono/-ink-soft`                       |
| [DemoTag](components/shared/DemoTag.md)                 | Dashed mono demo/jump control (`▸`)                            | 🔒      | `--w-mono/-ink-soft`                       |
| [VenueMark](components/shared/VenueMark.md)             | Tilted rubber-stamp venue logo (double ring + initials)        | ⚠️      | `--w-accent/-display/-mono`                |
| [ReceiptCard](components/shared/ReceiptCard.md)         | Hard-bordered card with torn zig-zag bottom + shake            | ⚠️      | `--w-card/-ink/-shadow`, `w-shake`         |
| [ReceiptRule](components/shared/ReceiptRule.md)         | Dashed tear-line divider                                       | ⚠️      | `--w-line`                                 |
| [CelebrationBits](components/shared/CelebrationBits.md) | Seeded particle overlay (ripple / splat / confetti)            | 🔒      | `w-ripple/-splat/-confetti`                |
| [StampDisc](components/shared/StampDisc.md)             | One stamp slot — filled (`✱` + date) or empty numbered         | ⚠️      | `CelebrationBits`, `w-slam`                |
| [StampRow](components/shared/StampRow.md)               | Centred row of `StampDisc`s = the punch-card                   | ⚠️      | `StampDisc`                                |
| [ProgressLine](components/shared/ProgressLine.md)       | Labelled accent progress bar with `current/total`              | ⚠️      | `MonoLine`, `--w-accent`                   |
| [PinPad](components/shared/PinPad.md)                   | 4-digit keypad with fill dots (**retired mechanic**)           | 🔒      | `MonoLine`, `--w-shadow-sm`                |
| [OtpBoxes](components/shared/OtpBoxes.md)               | OTP boxes over a hidden one-time-code input                    | ⚠️      | `--w-mono/-shadow-sm`                      |
| [Sheet](components/shared/Sheet.md)                     | Bottom-sheet modal with scrim + grab handle                    | ⚠️      | `w-sheet-up`, `--w-paper`                  |
| [Seal](components/shared/Seal.md)                       | Press-and-hold "break the seal" reveal (conic ring)            | ⚠️      | `MonoLine`, `w-wiggle/-shake`, `--w-sun`   |
| [GpsCheck](components/shared/GpsCheck.md)               | Simulated GPS check-in (radar → confirmed)                     | 🔒      | `VenueMark`, `w-ripple/-pop`               |
| [V3App](components/shared/V3App.md)                     | App shell: surface switcher + Tweaks wiring + `go()` deep-link | 🔒      | all surfaces, `useTweaks`, `window.*Entry` |

---

## Customer (13)

The self-serve journey — the star of the flow. All 🔒 (one `localStorage` state machine with faked QR/OTP/stamp/redeem and demo time-skips). Files in [`components/customer/`](components/customer/).

| Component                                                             | Purpose                                                          | Verdict | Key deps                               |
| --------------------------------------------------------------------- | ---------------------------------------------------------------- | ------- | -------------------------------------- |
| [CuScanView](components/customer/CuScanView.md)                       | Mock phone-camera viewfinder that fakes finding the till QR      | 🔒      | `MonoTag/Line`, `VenueMark`, `QrBlock` |
| [CustomerFlow](components/customer/CustomerFlow.md)                   | Single-component state machine for the whole journey (11 states) | 🔒      | ~all primitives; LS `v3_customer`      |
| [Screen-scan](components/customer/Screen-scan.md)                     | `scan` state — delegates to `CuScanView`, auto-advances          | 🔒      | `CuScanView`                           |
| [Screen-landing](components/customer/Screen-landing.md)               | Post-scan welcome + first-stamp CTA                              | 🔒      | `MonoTag`, `InkButton`                 |
| [Screen-firstStamp](components/customer/Screen-firstStamp.md)         | "That's one" celebration + keep-card choice                      | 🔒      | `InkButton`, `GhostLink`               |
| [Screen-save](components/customer/Screen-save.md)                     | Mobile-number capture (no validation/send)                       | 🔒      | `ReceiptCard`, `InkButton`             |
| [Screen-otp](components/customer/Screen-otp.md)                       | 6-digit verify (faked) + dev autofill `482915`                   | 🔒      | `OtpBoxes`, `DemoTag`                  |
| [Screen-card](components/customer/Screen-card.md)                     | Customer home card; stamp via PIN sheet                          | 🔒      | `InkButton`, `GhostLink`, `DemoTag`    |
| [Screen-alreadyStamped](components/customer/Screen-alreadyStamped.md) | Calm one-per-day state + "Skip to tomorrow" cheat                | 🔒      | `MonoTag`, `InkButton`                 |
| [Screen-sealed](components/customer/Screen-sealed.md)                 | Earned-but-sealed mystery reward; interactive `Seal`             | 🔒      | `ReceiptCard`, `Seal`                  |
| [Screen-revealed](components/customer/Screen-revealed.md)             | Reward reveal + confetti; cooldown to tomorrow                   | 🔒      | `CelebrationBits`, `VenueMark`         |
| [Screen-ready](components/customer/Screen-ready.md)                   | Redeemable reward; "Staff: redeem" opens PIN sheet               | 🔒      | `ReceiptCard`, `PinPad`                |
| [Screen-redeemed](components/customer/Screen-redeemed.md)             | "Enjoy" closer; resets card to 0 stamps                          | 🔒      | `VenueMark`, `w-slam`                  |

---

## Merchant (24)

Surface owner + stage views (`20-merchant-core`) and the ops screens (`21-merchant-ops`). Files in [`components/merchant/`](components/merchant/).

| Component                                                     | Purpose                                                               | Verdict | Key deps                                  |
| ------------------------------------------------------------- | --------------------------------------------------------------------- | ------- | ----------------------------------------- |
| [QrBlock](components/merchant/QrBlock.md)                     | Deterministic **fake** venue-QR matrix (also reused by customer scan) | 🔒      | `--w-card/-ink`                           |
| [McBrand](components/merchant/McBrand.md)                     | Merchant masthead — `✱` disc + wordmark + venue chip                  | ⚠️      | `MonoTag`                                 |
| [McStat](components/merchant/McStat.md)                       | One dashboard metric tile                                             | ⚠️      | `--w-shadow-sm`                           |
| [McFeedLine](components/merchant/McFeedLine.md)               | One till-activity feed row (event dot + time)                         | ⚠️      | tone→colour map                           |
| [McField](components/merchant/McField.md)                     | Labelled mono text input                                              | ⚠️      | `MonoLine`                                |
| [McAuth](components/merchant/McAuth.md)                       | `auth` stage — passwordless email → 6-digit code (mocked)             | 🔒      | `McField`, `OtpBoxes`                     |
| [McOnboarding](components/merchant/McOnboarding.md)           | `onboarding` stage — 3-step wizard (venue → reward pool → QR)         | 🔒      | `McField`, `QrBlock`, `CelebrationBits`   |
| [McToday](components/merchant/McToday.md)                     | `app/today` dashboard — stats + live feed + till QR + staff PIN       | 🔒      | `McStat`, `McFeedLine`, `QrBlock`         |
| [McCounter](components/merchant/McCounter.md)                 | `app/counter` pinned till display                                     | 🔒      | `MonoLine`, `DemoTag`                     |
| [MerchantSurface](components/merchant/MerchantSurface.md)     | Surface owner / stage machine (auth → onboarding → app + tabs)        | 🔒      | all `Mc*` + ops screens; LS `v3_merchant` |
| [MoHead](components/merchant/MoHead.md)                       | Ops page header (title + sub + right slot)                            | ⚠️      | `MonoLine`                                |
| [MoChip](components/merchant/MoChip.md)                       | Uppercase mono filter pill (active = ink fill)                        | ⚠️      | CSS vars                                  |
| [MoToggle](components/merchant/MoToggle.md)                   | Wet Ink switch (leaf-green on), `aria-pressed`                        | ⚠️      | CSS vars                                  |
| [MoMiniStamps](components/merchant/MoMiniStamps.md)           | Inline mini stamp-progress dots (`✱`) + count                         | ⚠️      | CSS vars                                  |
| [MoField](components/merchant/MoField.md)                     | Labelled mono input with optional prefix chip                         | ⚠️      | `MonoLine`                                |
| [MoEventRow](components/merchant/MoEventRow.md)               | Activity-feed row (category dot + text/sub + time)                    | ⚠️      | `MO_DOT`, `w-rise`                        |
| [MerchantActivity](components/merchant/MerchantActivity.md)   | Day-grouped activity feed + filters + simulate-live                   | 🔒      | `MoHead/Chip/EventRow`; demo datasets     |
| [MerchantCustomers](components/merchant/MerchantCustomers.md) | Privacy-first read-only members table (initials + masked phone)       | 🔒      | `MoHead`, `MoMiniStamps`                  |
| [MoPosterPreview](components/merchant/MoPosterPreview.md)     | Mini A4 counter-poster mock                                           | 🔒      | `VenueMark`, `QrBlock`                    |
| [MoTillPreview](components/merchant/MoTillPreview.md)         | Mini landscape till-card mock                                         | 🔒      | `QrBlock`                                 |
| [MoStickerPreview](components/merchant/MoStickerPreview.md)   | Mini round-vinyl sticker mock                                         | 🔒      | `QrBlock`                                 |
| [MerchantQrStudio](components/merchant/MerchantQrStudio.md)   | Print-asset studio: 3 previews, faked PNG/PDF downloads, live/paused  | 🔒      | preview comps, `MoToggle`                 |
| [MerchantSettings](components/merchant/MerchantSettings.md)   | Venue edit · staff PIN reveal/rotate · team · pause                   | 🔒      | `MoField`, `Sheet`, `VenueMark`           |
| [MerchantBilling](components/merchant/MerchantBilling.md)     | £29/mo plan, pilot progress, invoices, faked Stripe portal            | 🔒      | `ProgressLine`, demo invoices             |

---

## Staff (5)

The counter station — mobile-first, mostly dark. Files in [`components/staff/`](components/staff/).

| Component                                        | Purpose                                                            | Verdict | Key deps                          |
| ------------------------------------------------ | ------------------------------------------------------------------ | ------- | --------------------------------- |
| [StLoad](components/staff/StLoad.md)             | Hydrates station state from `localStorage`, falls back to `ST_DEF` | 🔒      | LS `v3_staff`                     |
| [StPanel](components/staff/StPanel.md)           | Dark ink-on-paper panel — the station's base surface               | ⚠️      | `--w-ink/-paper`                  |
| [StPinPeek](components/staff/StPinPeek.md)       | Today's PIN, masked with press-and-hold to peek                    | ⚠️      | `StPanel`, `VenueMark`, `--w-sun` |
| [StCardStrip](components/staff/StCardStrip.md)   | "Whose phone is this?" customer-context strip                      | 🔒      | `StPanel`, `VenueMark`            |
| [StaffSurface](components/staff/StaffSurface.md) | Counter-station machine (idle → pin → success \| locked)           | 🔒      | `PinPad`, `St*`; LS `v3_staff`    |

---

## Admin (7)

Internal support console — "quieter ink". Files in [`components/admin/`](components/admin/).

| Component                                        | Purpose                                             | Verdict | Key deps                                      |
| ------------------------------------------------ | --------------------------------------------------- | ------- | --------------------------------------------- |
| [AdPanel](components/admin/AdPanel.md)           | Hard-bordered card chrome wrapping every section    | ⚠️      | `--w-card/-shadow-sm`                         |
| [AdStat](components/admin/AdStat.md)             | KPI tile (display number + mono label) for Overview | ⚠️      | `MonoLine`                                    |
| [AdStatusTag](components/admin/AdStatusTag.md)   | Maps merchant status → coloured `MonoTag` chip      | ⚠️      | `MonoTag`                                     |
| [AdBars](components/admin/AdBars.md)             | Tiny inline bar sparkline for fraud windows         | ⚠️      | `--w-accent/-paper-2`                         |
| [AdFact](components/admin/AdFact.md)             | Mono-caption-over-bold-value key/value cell         | ⚠️      | `MonoLine`                                    |
| [AdToast](components/admin/AdToast.md)           | Bottom-centred dark confirmation toast (`w-rise`)   | ⚠️      | `w-rise`                                      |
| [AdminSurface](components/admin/AdminSurface.md) | MFA gate → 5-tab console + merchant sheet + toast   | 🔒      | all `Ad*`, `Sheet`, `OtpBoxes`; LS `v3_admin` |

---

## Marketing (9)

The "riso poster with three rooms" (home / pricing / legal). All ⚠️ (inline styles + `t.mo`; `MarketingSite`'s LS view-state is the only prototype-only mechanism). Files in [`components/marketing/`](components/marketing/).

| Component                                              | Purpose                                                         | Verdict | Key deps                                  |
| ------------------------------------------------------ | --------------------------------------------------------------- | ------- | ----------------------------------------- |
| [MkNav](components/marketing/MkNav.md)                 | Top nav: wordmark + ghost links + two signup CTAs               | ⚠️      | `GhostLink`, `InkButton`, `scrollTo`      |
| [MkQuoteCard](components/marketing/MkQuoteCard.md)     | Tilted pilot-testimonial receipt                                | ⚠️      | `ReceiptCard`, `VenueMark`                |
| [MkFaqItem](components/marketing/MkFaqItem.md)         | Single-open accordion row (accent `+`/`–` disc)                 | ⚠️      | `w-rise`                                  |
| [MkLegalColumn](components/marketing/MkLegalColumn.md) | Data-driven "condensed" legal receipt                           | ⚠️      | `ReceiptCard`, `ReceiptRule`              |
| [MkFooter](components/marketing/MkFooter.md)           | Footer: wordmark + Terms/Privacy + Restart-flow                 | ⚠️      | `GhostLink`, `DemoTag`                    |
| [MkHome](components/marketing/MkHome.md)               | Landing: hero + 3 steps + counter-moment band + quotes + teaser | ⚠️      | `StampRow`, `MkQuoteCard`                 |
| [MkPricing](components/marketing/MkPricing.md)         | Single-plan pricing page (£29 receipt + FAQ)                    | ⚠️      | `MkFaqItem`, `MonoTag`                    |
| [MkLegal](components/marketing/MkLegal.md)             | Plain-English legal page (two `MkLegalColumn` receipts)         | ⚠️      | `MkLegalColumn`                           |
| [MarketingSite](components/marketing/MarketingSite.md) | Surface root: marquee + nav + page + footer                     | ⚠️      | all `Mk*`; LS `v3_marketing`; `w-marquee` |

---

## Journey (6)

The full-flow storyboard + front door. Files in [`components/journey/`](components/journey/).

| Component                                        | Purpose                                                             | Verdict | Key deps                                 |
| ------------------------------------------------ | ------------------------------------------------------------------- | ------- | ---------------------------------------- |
| [JyGlyph](components/journey/JyGlyph.md)         | Tiny paper chip wrapping a 20×16 inline-SVG screen glyph            | ⚠️      | `JY_GLYPHS` dict                         |
| [JyArrowLink](components/journey/JyArrowLink.md) | Dashed-line + arrowhead connector between step cards                | ⚠️      | `--w-accent/-ink-soft`                   |
| [JyStepCard](components/journey/JyStepCard.md)   | One tappable storyboard card (badge, glyph, title, desc)            | ⚠️      | `MonoTag`, `JyGlyph`                     |
| [JyLane](components/journey/JyLane.md)           | One swimlane: header + horizontal row of cards + arrows             | ⚠️      | `JyStepCard`, `JyArrowLink`              |
| [JyTieStrip](components/journey/JyTieStrip.md)   | Vertical cross-surface tie between lanes (`✱` + note)               | ⚠️      | `MonoTag`, `w-rise`                      |
| [JourneyMap](components/journey/JourneyMap.md)   | Full-flow storyboard; emits `go(surface, preset)`; resets all flows | 🔒      | `JyLane`, `JyTieStrip`; clears 5 LS keys |

---

## Tweaks (12)

The reusable **design-control scaffold** (`@ds-adherence-ignore` — raw hex/px by design, omelette-host protocol). All 🔒 — this is tooling, not a Wet Ink product surface. Files in [`components/tweaks/`](components/tweaks/).

| Component                                         | Purpose                                                             | Verdict | Key deps                                      |
| ------------------------------------------------- | ------------------------------------------------------------------- | ------- | --------------------------------------------- |
| [App](components/tweaks/App.md)                   | Commented USAGE-example harness (scaffold/demo, not the real shell) | 🔒      | `useTweaks`, `TweaksPanel`                    |
| [TweaksPanel](components/tweaks/TweaksPanel.md)   | Floating, draggable, host-driven control panel (+ `useTweaks` hook) | 🔒      | `window.parent` postMessage, `ResizeObserver` |
| [TweakSection](components/tweaks/TweakSection.md) | Uppercase group heading                                             | 🔒      | `.twk-sect`                                   |
| [TweakRow](components/tweaks/TweakRow.md)         | Shared label+value row chassis                                      | 🔒      | `.twk-row`                                    |
| [TweakSlider](components/tweaks/TweakSlider.md)   | Controlled numeric range                                            | 🔒      | `TweakRow`                                    |
| [TweakToggle](components/tweaks/TweakToggle.md)   | iOS-style boolean switch (`role="switch"`)                          | 🔒      | `.twk-toggle` (`#34c759`)                     |
| [TweakRadio](components/tweaks/TweakRadio.md)     | Segmented 2–3 option control (drag-select, auto-fallback to select) | 🔒      | `TweakRow`, `TweakSelect`                     |
| [TweakSelect](components/tweaks/TweakSelect.md)   | Native dropdown for long enums                                      | 🔒      | `TweakRow`                                    |
| [TweakText](components/tweaks/TweakText.md)       | Controlled single-line text input                                   | 🔒      | `TweakRow`                                    |
| [TweakNumber](components/tweaks/TweakNumber.md)   | Numeric stepper with drag-to-scrub label                            | 🔒      | window pointer listeners                      |
| [TweakColor](components/tweaks/TweakColor.md)     | Curated swatch/palette picker (contrast-aware tick)                 | 🔒      | `TweakRow`                                    |
| [TweakButton](components/tweaks/TweakButton.md)   | Two-variant panel action button                                     | 🔒      | `.twk-btn`                                    |

---

## Reuse summary

### Most reusable (the design foundation)

The Wet Ink **shared primitives** carry the entire look and the tactile interaction model. None imports as-is (inline styles + `window.*`), but the _concepts_ port directly and should anchor any component library: **InkButton, MonoTag, MonoLine, GhostLink, VenueMark, ReceiptCard, ReceiptRule, StampDisc/StampRow, ProgressLine, Sheet, OtpBoxes, Seal**, plus the merchant **MoToggle** and admin chrome (**AdPanel, AdStat, AdStatusTag, AdToast**). These are the ⚠️ tier: lift the visual treatment, then re-home styles into the token/`data-slot` layer.

### What needs refactoring before any production use

_Every_ component needs at least: (1) styles moved out of inline objects into the token layer; (2) real module exports replacing `window.*`; (3) accessibility passes (focus, roles, `prefers-reduced-motion` in JS). Beyond that:

- **All 🔒 surface machines** (`CustomerFlow`, `MerchantSurface`, `StaffSurface`, `AdminSurface`, `MarketingSite`, `JourneyMap`, `V3App`) drive state through `localStorage` string-flips and must be rebuilt on real routing + server state.
- **All mocked I/O** must be replaced with real backends: `QrBlock` (fake matrix), `McAuth`/`Screen-otp` (hardcoded OTP `482915`, admin MFA `120626`), `MerchantBilling`/admin billing (faked Stripe), every hardcoded dataset (feeds, customer lists, invoices, fraud flags, audit log).
- **Retired mechanic:** `PinPad` and all "staff PIN / hand the phone over" copy reflect the **superseded** handed-phone model; the live product uses a counter handshake. Treat all staff-PIN UI/copy as prototype-only.
- **The Tweaks scaffold** (all 12) is external tooling tied to a host postMessage protocol — reference only.

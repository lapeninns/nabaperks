# Nabaperks — Manual QA Report (live browser pass)

| Field           | Detail                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------- |
| Branch / commit | `codex/security-scan-remediation` @ `63f1bac68` (16 files changed)                                |
| Environment     | Local dev server, http://localhost:3001 (`pnpm dev -p 3001`), live Chromium                       |
| Date / tester   | 2026-09-03 / Hermes Agent                                                                         |
| Scope           | Guest pricing flow, customer login-entry flow, signed-out gate smoke, console sweep               |
| Companion files | `manual-qa/nabaperks-manual-qa.xlsx` (Run_Log + Defects), `dogfood-output/screenshots/` (4 shots) |

## Verdict

| Flow                                                           | Result                     |
| -------------------------------------------------------------- | -------------------------- |
| Flow 1 — Guest views Growth Plan pricing (desktop)             | Pass                       |
| Flow 2 — Guest views Growth Plan pricing (320px mobile)        | Pass with 1 Low            |
| Flow 3 — Customer opens login and submits bad phone input      | Pass                       |
| Flow 4 — Signed-out visitor hits protected routes (HTTP smoke) | Pass                       |
| Flow 5 — Console-error sweep over guest flows                  | Pass (partial — see notes) |

**Defects: 0 critical, 0 high, 0 medium, 1 low (DEF-001).**

---

## Flow 1 — Guest views Growth Plan pricing on desktop — PASS

Covers MAN-GUEST-01–04. Evidence: `pricing-hero-desktop.png`, `pricing-cards-desktop.png`.

| #   | Action                           | Expected                                                                                 | Actual                                                                                               | Status |
| --- | -------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------ |
| 1   | Open `/pricing`                  | Page loads with hero "Simple pricing for packed venues."                                 | Loaded, hero + stamp-card visual render, title "Pricing — £299.99 launch, then £69.99 every 28 days" | Pass   |
| 2   | Scroll to the Growth Plan sheet  | One bordered sheet holding both payment rhythms side by side                             | One `[data-growth-plan-pricing]` boundary; 28-day and annual cards side by side                      | Pass   |
| 3   | Compare the two rhythms          | 28-day: £69.99 + £299.99 launch; annual: £699.90 + "Save £209.97"; neither price clipped | All three prices visible; `scrollWidth <= clientWidth` on both cards                                 | Pass   |
| 4   | Read the includes panel          | "Both choices include the same Growth Plan" once, plus launch CTAs with 44px+ targets    | Line appears once; launch links measure 48px tall                                                    | Pass   |
| 5   | Scroll past the sheet            | Takeover enquiry sits outside (below) the sheet with its own CTA                         | Takeover top (3176) below sheet bottom (2357); button 55px                                           | Pass   |
| 6   | Resise-check for sideways scroll | No horizontal overflow                                                                   | `OVERFLOW_X: 0` (desktop)                                                                            | Pass   |

Not exercised: clicking "Start your launch" through to checkout — Stripe edges stay with automation + a seeded pass.

## Flow 2 — Guest views Growth Plan pricing at 320px — PASS WITH 1 LOW

Covers MAN-GUEST-01–04 (mobile) and MAN-X-02. Evidence: `pricing-annual-mobile-320.png`.

| #   | Action                                 | Expected                                          | Actual                                                  | Status                           |
| --- | -------------------------------------- | ------------------------------------------------- | ------------------------------------------------------- | -------------------------------- |
| 1   | Open `/pricing` at 320×812             | Hero readable, no sideways scroll                 | Hero clean, `OVERFLOW_X: 0`                             | Pass                             |
| 2   | Scroll to the rhythms                  | Cards stack vertically, annual fully below 28-day | `STACKED_OK: True`                                      | Pass                             |
| 3   | Read each card                         | Prices unclipped at small width                   | Both cards unclipped                                    | Pass                             |
| 4   | Tap-test the CTAs                      | Launch CTAs and takeover button 44px+             | 47px / 47px / 55px                                      | Pass                             |
| 5   | Read the "Choose your rhythm." heading | Heading fully readable                            | Fixed circular "N" badge covers the tail of the heading | **Fail → DEF-001 (Low, Visual)** |

## Flow 3 — Customer opens login and submits bad phone input — PASS

Covers MAN-CUST-03/04. Evidence: `home-login-validation.png`.

| #   | Action                                 | Expected                                                 | Actual                                                                                   | Status |
| --- | -------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------ |
| 1   | Open `/start`                          | Three paths: Scan a QR, Open my cards, Merchant sign-in  | All three render, no JS errors                                                           | Pass   |
| 2   | Choose "Open my cards"                 | Land on the sign-in form                                 | Client-side navigation to `/home/login`: "Welcome back", phone-number field, "Send code" | Pass   |
| 3   | Press "Send code" with the field empty | Stay on the form with a plain inline error; nothing sent | Stayed on `/home/login`; "Enter a valid phone number." + `aria-invalid` markers appeared | Pass   |
| 4   | Type `abc`, press "Send code"          | Same: inline error, no OTP request                       | Same error state; input cleared; no navigation, no network OTP call                      | Pass   |

Not exercised: real OTP entry — needs `CUSTOMER_DEV_OTP_CODE` + seeded DB (covered by `test:db` / live-db specs).

## Flow 4 — Signed-out visitor hits protected routes — PASS (HTTP smoke)

Covers MAN-ADMIN-01 at protocol level; full gate matrix stays with Playwright.

| #   | Action                                                                                                 | Expected                         | Actual               | Status |
| --- | ------------------------------------------------------------------------------------------------------ | -------------------------------- | -------------------- | ------ |
| 1   | GET `/admin`, `/admin/billing`, `/app/scan` signed out                                                 | Redirect to sign-in, not content | All three return 307 | Pass   |
| 2   | GET `/does-not-exist`                                                                                  | Branded 404, no stack trace      | 404 with app shell   | Pass   |
| 3   | GET marketing pages (`/`, `/how-it-works`, `/faq`, `/demo`, `/loyalty-for-pubs`, `/start`, `/offline`) | 200                              | All 200              | Pass   |

## Flow 5 — Console-error sweep — PASS (PARTIAL)

Covers MAN-X-03. An error collector rode along the Flow 1–3 browser session across SPA navigations and stayed empty; no error banners or dead UI appeared anywhere. Full page-load console history is not reachable from this harness, so the automated `pnpm test:e2e` console assertions remain the authority here.

---

## Defects

### DEF-001 — Low / Visual — floating N badge overlaps section heading at 320px

On `/pricing` at a 320px viewport, the fixed circular "N" badge bottom-left covers the end of the "Choose your rhythm." heading. Repro: set 320px width → open `/pricing` → scroll to the heading. Expected: heading fully readable. Actual: badge overlaps glyphs. Logged in `manual-qa/nabaperks-manual-qa.xlsx` (Defects sheet).

## Out of scope for this pass

OTP happy path, merchant onboarding/launch/scan/billing, and signed-in admin journeys — all need seeded Supabase sessions and belong to `pnpm test:db` plus the live-db Playwright specs. Service-backed checks (`test:db`, full `test:e2e`/`a11y`/`visual`, `ops:*`) were not run here.

## Worktree state

Commit `63f1bac68` plus the pre-existing 16-file diff; new untracked outputs: `manual-qa/`, `dogfood-output/`. Dev server left running on :3001.

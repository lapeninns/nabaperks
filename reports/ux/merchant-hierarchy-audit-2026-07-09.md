# Merchant journey hierarchy audit — 2026-07-09

Read-only audit of the Nabaperks merchant journey across **information**, **visual**, and **interaction** hierarchy. Baseline: current working tree (launch header de-dup, Step 2 card label, Activate your venue billing card, onboarding preamble removal, dashboard action order). The temporary screenshot pack used during the audit was removed after the findings were recorded here.

**Method:** Full route/component code pass → Playwright render at 375px and 1280px (harness + selective live Supabase login) → cross-screen consistency pass.

---

## 1. Executive summary

| Layer | Composite (1–5) | Rationale |
| --- | ---: | --- |
| Information hierarchy | **3.6** | PageTitle + eyebrow patterns are strong post-fix on launch/setup; auth mobile layout and a few duplicate labels still bury purpose. |
| Visual hierarchy | **3.5** | Wet Ink emphasis is mostly disciplined; competing primary-styled CTAs on dashboard QR, setup reminder band, and filter pills remain. |
| Interaction hierarchy | **3.4** | Launch billing activation and dashboard scan path are clear; setup form saves and incomplete-setup dashboard still require scroll/hunt on mobile. |

### Five highest-impact problems

1. **Auth acquisition screens (mobile): marketing h1 sits below the form** — first visible heading is card h2 (“Create your account”), not the page purpose line.
2. **Launch card tab (mobile): “Save card” is not in the first screenful** — presets/stepper dominate; sticky footer only appears after scroll.
3. **Dashboard with incomplete setup (mobile): compact readiness rail consumes the first screenful** — venue name h1 drops to ~364px; context is “setup strip”, not “your venue”.
4. **Dashboard Counter QR vs header: two primary-styled actions** — “Scan reward” (header) and “Show full screen” (QR card) both read as primary on mobile.
5. **Live dashboard omits the “Do next” guidance block** that exists in `MerchantNextActions` and the dashboard harness — contextual next steps (rewards ready / quiet members) never surface on `/app`.

---

## 2. Journey map (stage scores)

Scores use anchors: 5 exemplary · 4 minor friction · 3 noticeable competition · 2 hunt · 1 misled.

| Stage | Info | Visual | Interaction | One-line rationale |
| --- | ---: | ---: | ---: | --- |
| Signup | 3 | 3 | 4 | Desktop story is clear; mobile `order-1` form precedes h1 in viewport. |
| Signup verify | 3 | 3 | 4 | Same marketing grid inversion on mobile; code entry goal is still obvious in card. |
| Login | 3 | 3 | 4 | Trust list + form pattern matches signup; mobile h1 below fold. |
| Reset password | 3 | 3 | 4 | Consistent auth chrome; mobile purpose line not first-screenful. |
| Onboarding | 4 | 4 | 4 | Single h1 + “Finish setup”; aside checklist only after long scroll on mobile. |
| Launch hub (all tabs) | 4 | 4 | 3 | Header/rail fixes land well; panel primary saves compete with rail + long forms on mobile. |
| Dashboard | 4 | 3 | 3 | Scan reward is clear; QR card + optional billing notice + missing “Do next” split attention. |
| Members | 4 | 4 | 3 | h1 clear; populated state lacks a dominant action (secondary “Send a reward” only). |
| Activity | 3 | 3 | 4 | Eyebrow and title both “Activity”; filters work but “All” pill uses primary fill. |
| Announcements | 4 | 4 | 3 | Page h1 strong; compose primary “Send announcement” sits below templates on mobile. |
| Poster (`/app/qr`) | 4 | 4 | 4 | Distinct eyebrow “Counter poster”; QR panel hierarchy matches launch live state. |
| Scan reward | 4 | 4 | 4 | Focused h1-in-card; back link secondary; camera region dominates appropriately. |
| Account hub | 4 | 4 | 4 | Tab bar + h1; no page eyebrow (unlike rest of console); billing/manage is secondary when trialing. |

---

## 3. Route tree (actual behaviour)

| Route | Resolves to | Shell | Notes |
| --- | --- | --- | --- |
| `/signup` | Page | Marketing | Indexable acquisition |
| `/signup/verify` | Page | Marketing | Requires `?email=`; redirects to signup if missing |
| `/login` | Page | Marketing | Redirects authed → `safeMerchantNextPath` |
| `/reset-password` | Page | Marketing | OTP flow |
| `/app/onboarding` | Page | **Setup** | Redirects complete → `/app/launch` |
| `/app/launch?tab=` | Page | **Setup** | Tabs: `venue`, `card`, `rewards`, `qr`, `billing`; no merchant → onboarding |
| `/app` | Dashboard | Full + sidebar | Incomplete onboarding → `/app/onboarding` |
| `/app/scan` | Scanner | Full | Activity nav alias highlights Activity |
| `/app/customers` | Members table | Full | |
| `/app/activity` | Feed | Full | Scan routes alias-highlight Activity |
| `/app/announcements` | Compose | Full | |
| `/app/qr` | QrPanel (poster) | Full | |
| `/app/account?tab=` | Profile or Billing | Full | Default tab profile |
| `/app/profile` | **Redirect** | — | → `/app/account?tab=profile` |
| `/app/billing` | **Redirect** | — | → `/app/account?tab=billing` (+ Stripe outcome params) |
| `/app/settings` | **Redirect** | — | → `/app/account?tab=profile` |
| `/app/card` | **No route** | — | Card editor is `/app/launch?tab=card` |
| `/app/rewards` | **No route** | — | Pool is launch tab; scan is `/app/rewards/scan/[scanToken]` |

Shared chrome: `MerchantAppShell` (setup vs full), `MerchantSetupReminder` → compact `LaunchReadinessPanel`, full `LaunchReadinessPanel` on launch, `MerchantBillingNotice` / `billing-status-copy`, `StatusBanner`, `PageTitle` / `SectionHeader` / `Eyebrow`.

---

## 4. Findings (severity order)

| # | Route + state + viewport | Layer | Sev | Status | Evidence | Why it breaks hierarchy | Minimal fix direction |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F1 | `/signup`, `/login`, `/reset-password`, `/signup/verify` · default · **mobile** | Info / Visual | **P1** | CONFIRMED | `app/(auth)/signup/page.tsx:73-98` (`order-1` ReceiptCard, `order-2` PageTitle); rendered: first above-fold heading is h2 “Create your account” at top≈172px, h1 at top≈1051px (`signup-mobile.png`, DOM pass) | Purpose line (“Your first stamp is waiting”) is not what users read first; heading level in viewport starts at h2. | On mobile only, render a compact purpose line (eyebrow + one line) above the card, or swap order so PageTitle lead is first in DOM/visual order without duplicating the card h2. |
| F2 | `/app/launch?tab=card` · default progress · **mobile** | Interaction | **P1** | CONFIRMED | `components/merchant/loyalty-card-form.tsx:245-248` (sticky save); rendered: “Save card” top≈1076px at load, top≈711px only after scroll (`harness-launch-card-mobile.png`, scroll test) | Primary required action is not discoverable in one glance; cadence presets read as the main task. | Shorten first screen (collapse presets), or pin a always-visible full-width save bar in setup shell footer for launch tabs. |
| F3 | `/app` · `setup=incomplete` · **mobile** | Info / Interaction | **P1** | CONFIRMED | `components/merchant/merchant-setup-reminder.tsx:22-28`; `app/app/layout.tsx:42-44`; rendered: h1 “Old Crown Girton” top≈364px, reminder CTA “Add rewards” top≈240px (`harness-dashboard-incomplete-mobile.png`) | Venue identity (where am I?) is displaced by setup chrome; dashboard reads as setup, not home. | Cap reminder height on mobile (single-line + progress) or collapse to dismissible chip below PageTitle so h1 stays in first screenful. |
| F4 | `/app` · live · **mobile** | Visual | **P2** | CONFIRMED | `app/app/page.tsx:59-71` (primary Scan); `components/merchant/present-qr.tsx:41` (default Button on “Show full screen”); rendered: both primary-guess above fold (`harness-dashboard-mobile.png`, `live-onboarded-trialing-app-mobile.png`) | Two vermillion primary actions in first screenful; scan order favours header on stack but QR card still competes. | Style “Show full screen” as secondary on dashboard (keep primary in header), or demote header Scan to secondary when Counter QR card is visible. |
| F5 | `/app` · live · all | Interaction | **P2** | CONFIRMED | `components/merchant/dashboard-next-actions.tsx` exported; **not** imported by `app/app/page.tsx` or `dashboard-home-streams.tsx`; harness mounts it at `app/dev/app-harness/dashboard/page.tsx:168` | Harness proves “Do next” copy/layout; live merchants never see rewards-ready / quiet-member prompts above the fold. | Wire `MerchantNextActions` into `MerchantDashboardStream` (or page) below KPIs with existing metrics inputs—hierarchy-only, no new concepts. |
| F6 | `/app/activity` · default · mobile + desktop | Info | **P2** | CONFIRMED | `app/app/activity/page.tsx:46-49`; rendered h1 “Activity” with eyebrow “Activity” (`harness-activity-mobile.png`) | Eyebrow adds no new information; wastes first-line semantic budget. | Drop eyebrow or retitle to outcome-led line (e.g. “Stamp and reward history”) while keeping h1 short. |
| F7 | `/app/launch?tab=rewards` · `saved=pool` + needsBilling · mobile/desktop | Info | **P2** | CONFIRMED | `components/merchant/launch/rewards-panel.tsx:147-156` (banner title “Your account is created.”); `lib/merchant/launch-header-copy.ts:54-63` (same phrase as page h1 in billing-pending state) | Success banner repeats page-level state already shown in launch header when billing is pending. | When `needsBillingActivation`, banner title should describe the save (“Reward saved”) only; leave activation wording to header + CTA. |
| F8 | `/app` · `billing=not_started` · mobile | Interaction | **P2** | CODE-INFERRED | `app/app/page.tsx:76-84` then `dashboard-home-streams.tsx:79` (notice after QR card); `billing-status-copy.ts:47-58` | Activation notice appears **below** Counter QR; user may copy/share QR before seeing billing gate—order contradicts “billing before stamps” story. | Render `MerchantBillingNotice` above `DashboardQrCard` when `shouldShowMerchantDashboardBillingNotice` is true. |
| F9 | `/app/launch` · all tabs · **mobile** | Visual | **P2** | CONFIRMED | `components/merchant/launch-readiness-panel.tsx:360-380` sticky rail; launch header `app/app/launch/page.tsx:87-95` | Rail + progress + mono tags occupy ~200px before panel content; competes with panel headings on every tab. | Already improved with header de-dup; further reduce rail vertical padding on setup shell or merge progress into header line on mobile. |
| F10 | `/app/announcements` · default · **mobile** | Interaction | **P2** | CONFIRMED | `app/app/announcements/page.tsx:29-37` (decorative icon action only); `announcement-compose.tsx` submit below templates; live: templates top≈615px, send below fold (`live-onboarded-trialing-app-announcements-mobile.png`) | No page-level primary; first actions are optional template chips. | Move audience summary + primary submit into first screenful, or add header action “Compose” anchoring to form. |
| F11 | `/app/customers` · populated · mobile/desktop | Interaction | **P3** | CONFIRMED | `app/app/customers/page.tsx:58-62` (secondary “Send a reward”); rendered: no primary in header actions (`live-onboarded-trialing-app-customers-mobile.png`) | Daily task (scan/send) not reinforced on members surface. | Promote “Send a reward” to primary when table non-empty, or add compact “Scan reward” secondary in header actions. |
| F12 | `/app/account` · both tabs · all | Info | **P3** | CONFIRMED | `app/app/account/page.tsx:43` PageTitle without eyebrow vs `app/app/page.tsx:51-52` “Your venue” | Account feels disconnected from console wayfinding pattern. | Add eyebrow “Account” (or “Your business”) to match other `/app/*` pages. |
| F13 | `/app/account` · profile tab · mobile | Visual | **P3** | CONFIRMED | `components/merchant/account/account-tab-bar.tsx:15` `grid-cols-3` with 2 tabs (`account-tabs.ts:9-12`) | Empty third column on tab bar reads as broken control. | Use `grid-cols-2` when tab count is 2. |
| F14 | `/app/onboarding` · default · **mobile** | Info | **P3** | CONFIRMED | `app/app/onboarding/page.tsx:25-44` grid; aside at lg only col-start-2; rendered: “From sign-up…” h2 top≈1678px (`harness-onboarding-mobile.png`, live onboarding) | Five-step preview not visible during form fill on phone. | On mobile, show collapsed “5 steps” disclosure above form (not full aside). |
| F15 | `/app/launch?tab=venue` · default | Info | **P3** | CONFIRMED | `launch-readiness-contract.ts:27-33` (venue step 1); `venue-location-form.tsx:136-141` eyebrow “Business & venue”, no “Step 1”; card form has “Step 2” (`loyalty-card-form.tsx:149-152`) | Step numbering inconsistent between rail (1 venue) and venue panel (unnumbered). | Add “Step 1 of 5 · Venue” eyebrow on venue panel to match card/billing panels. |
| F16 | Billing · `past_due` / `cancelled` / `suspended` | Info / Interaction | **P2** | CODE-INFERRED | `lib/merchant/billing-status-copy.ts:80-112` (copy + routes only); no harness fixture | Warning hierarchy untested rendered; dashboard notice uses same SectionHeader pattern as calm states. | Add harness billing-state fixture page for visual verification; ensure warning titles outrank KPI cards (full-width banner slot). |
| F17 | `/app/launch` · transient `?saved=` · all | Interaction | **P3** | CONFIRMED | `launch-tab-auto-advance.tsx:20-28` (`history.replaceState` fix) | Prior audit flagged banner race; fix present—banner + Continue CTAs now persist. No action unless regression reappears. | — (documented OK) |

---

## 5. Cross-cutting patterns

1. **Mobile auth/marketing grid prioritises form over story** — shared `order-1`/`order-2` split across all four auth routes undermines first-screenful purpose test on 375px widths.
2. **Setup shell stacks chrome vertically** (header → mobile h1 → sticky rail → panel) before task content — consistent ~250–360px tax before panel h2 on launch mobile.
3. **Primary button variant overused** — dashboard QR, activity filter “All”, account active tab, and header CTAs simultaneously use primary fill; weak global “one dominant action” rule.
4. **Step vocabulary drifts** — “Setup” (nav), “Merchant setup” (eyebrow), “Business & venue” / “Your first venue” / “Review your venue” / numbered steps; rail numbers vs panel eyebrows not always aligned.
5. **Harness–live drift** — dashboard harness includes `MerchantNextActions` and sometimes omits header actions (Announce) that live `/app` has; treat harness as component proof, not journey proof, unless parity is intentional.
6. **Billing activation path is now coherent in code** — `not_started` → launch billing tab + “Proceed to billing”; post-activation → account billing (`billing-status-copy.ts:7-11`). Rendered on harness billing state; live trialing account shows manage path correctly.

---

## 6. Prioritized backlog (impact × effort)

| Seq | Item | Impact | Effort | Owner hint |
| --- | --- | --- | --- | --- |
| 1 | F1 — Mobile auth purpose-first layout | High | M | Auth pages: single-column lead block above card |
| 2 | F2 — Launch card save in first screenful | High | M | `loyalty-card-form.tsx` + optional setup-shell footer slot |
| 3 | F3 — Incomplete-setup reminder vs dashboard h1 | High | S | `LaunchReadinessPanel` compact variant spacing / placement |
| 4 | F5 — Wire `MerchantNextActions` on live dashboard | Med | S | `dashboard-home-streams.tsx` + existing metrics |
| 5 | F4 — Demote dashboard QR primary | Med | S | `present-qr.tsx` trigger variant on dashboard only |
| 6 | F8 — Billing notice above QR when gated | Med | S | `app/app/page.tsx` compose order conditional |
| 7 | F7 — Rewards saved banner de-dupe | Med | S | `rewards-panel.tsx` RewardsStatus title branch |
| 8 | F6 — Activity eyebrow/title | Low | S | `activity/page.tsx` |
| 9 | F10 — Announcements first-screen submit | Med | M | `announcements/page.tsx` + compose layout |
| 10 | F15 + F13 — Step eyebrow + account tab grid | Low | S | venue form + account-tab-bar |
| 11 | F16 — Billing warning harness + visual priority | Med | M | New dev harness states + notice placement |

---

## 7. Appendix

### Deliberate decisions left alone

- Shared `Disclosure` ~40px mobile tap target (WONTFIX).
- Dashboard action-order CSS without automated test (live-verified flex-col-reverse).
- Dormant dark-mode tokens.
- Redeem/collect and poster copy divergence.
- Visual baselines limited to harness-dashboard + harness-qr.
- “Add a card to activate” rail label (test-pinned).
- Launch header state line on all tabs (known; header copy centralisation in `launch-header-copy.ts` is adequate for now).

### Route × state coverage matrix

| Surface | State | Mobile | Desktop | Live Supabase | Notes |
| --- | --- | --- | --- | --- | --- |
| Signup / verify / login / reset | default | ✅ | ✅ | n/a (public) | |
| Onboarding | fresh | ✅ | ✅ | ✅ non-onboarded account | |
| Launch venue/card/rewards/qr/billing | default | ✅ | ✅ | ✅ redirect only (non-onboarded) | |
| Launch | `state=billing` | ✅ | ✅ | harness | Activation card verified |
| Launch | `state=live` | ✅ | ✅ | harness | “You’re live” + QR |
| Dashboard | complete | ✅ | ✅ | ✅ trialing account | |
| Dashboard | incomplete reminder | ✅ | ✅ | harness `?setup=incomplete` | |
| Members / Activity / Announcements | populated | ✅ | ✅ | ✅ trialing | |
| Members / Activity | empty | ✅ | ✅ | harness `/dev/app-harness/states` | |
| Poster `/app/qr` | live | ✅ | ✅ | harness + code | |
| Scan | default | ✅ | ✅ | harness | Camera not exercised |
| Account profile / billing | default | ✅ | ✅ | ✅ billing tab trialing | Billing skeleton on harness billing tab |
| Billing | `not_started` activation | ✅ | ✅ | harness | Live account already trialing |
| Billing | `past_due` / `cancelled` / `suspended` | ❌ | ❌ | CODE-INFERRED | Copy in `billing-status-copy.ts` only |
| Launch | `?saved=` / `?checkout=` banners | ❌ | ❌ | not exercised (read-only) | Cleanup code verified in source |
| QR blocked (&lt;3 rewards) | blocked | ❌ | ❌ | CODE-INFERRED | `qr-panel.tsx:81-92` |
| `/app/rewards/scan/[token]` | scan flow | ❌ | ❌ | not exercised | Deep link; uses ScanCardHeader |

### Score reference (anchors)

- **5** — Purpose + next step obvious from eyebrow + h1 + first paragraph; one primary action; states distinct.
- **3** — Noticeable competition or redundancy; user can proceed with brief scan.
- **1** — Misleading about billing/QR/live state (none found at P0 after recent fixes).

---

*Audit performed read-only against repo + local dev on `:3200`. No product source modified.*

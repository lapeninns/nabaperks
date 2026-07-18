# Nabaperks Merchant Journey — Deep UX Audit

**Date:** 2026-07-09
**Scope:** Landing → signup → email OTP → onboarding → launch/setup → first dashboard
**Method:** Rendered UI observed at mobile 375×812 (primary) and desktop 1280 via the local dev server (`:3000`), public routes + the DB-free harness (`/dev/app-harness/*`), cross-checked against source (`components/auth/*`, `components/merchant/*`, `app/(auth)/*`, `app/app/*`, `lib/merchant/*`, `app/globals.css`). Every finding cites the route and the exact element/copy observed. Assumptions are labelled.
**Business goal audited against:** completed _activations_ (landing → signup → OTP verified → onboarding → setup → billing activated → first stamp), not signups.

> **Honesty note on severity.** The journey is functional end-to-end — no dead-ends, broken submits, or lost-work traps were found, and several fundamentals (accessibility, the value-before-payment structure, the landing→signup handoff) are genuinely strong. There is **no app-breaking Critical**. The biggest activation risk is a _cluster_ of under-reassurance at the billing wall, rated High. I have not inflated the list; low-value nitpicks are collected briefly at the end.

---

## 1. Executive summary

Nabaperks' merchant journey is **well-built and clearly iterated** — the information architecture, copy, and accessibility are above the bar for an early-stage SaaS, and the setup flow makes one smart structural bet: **the working QR code and printable poster are produced _before_ billing is required** (`/app/launch?tab=qr` renders the live QR with an `ENABLED · BILLING NEEDED` badge). A merchant sees the real asset before being asked to pay. That is the correct order and the journey's strongest conversion feature.

The **highest-impact activation risks are concentrated at two seams**, not spread thinly:

1. **The billing wall is under-reassured.** Every merchant must enter card details to reach a live venue (card-required trial). Yet the activation screen (`SetupBillingActivationCard`) omits the **First-Regular Guarantee** that is prominent on `/signup`, never states **"£0 due today,"** and narrows the headline "cancel anytime" to **"Cancel anytime _during the trial_."** For a self-described skeptical, subscription-averse audience, the strongest risk-reversal is missing at the exact moment of hesitation.

Two more meaningful drops: the **email-OTP step** lacks deliverability reassurance (no spam-folder hint, no resend cooldown, and an expired code shows the same message as a wrong code), and the **phone-first "print your poster" moment** is actually a **desktop print task** ("open the A4 sheet and print at 100%") while the marketing's "we print and post your first run — free" promise is not surfaced where it matters.

**Highest-impact, lowest-effort opportunities:** restate the guarantee + "£0 today" + true cancel-anytime on the billing card; reconcile the free/card copy; add spam-folder + resend-cooldown copy to OTP; and swap the not-live dashboard's premium "Scan reward" CTA for "Finish setup." None of these are redesigns; most are copy and small component edits.

**Overall:** a strong, thoughtfully-designed funnel that loses conversion at the trust/reassurance seams rather than at the interaction layer.

---

## 2. Top 10 UX issues (priority order)

| #   | Issue                                                                                              | Stage           | Severity   | Effort | Priority |
| --- | -------------------------------------------------------------------------------------------------- | --------------- | ---------- | ------ | -------- |
| 1   | Guarantee + "£0 today" + true "cancel anytime" missing at the billing/activation moment            | Billing         | High       | Low    | **P0**   |
| 2   | "No payment to start" (`/`) vs "Card required" (`/signup`) — inconsistent free/commitment story    | Landing→Signup  | High       | Low    | **P0**   |
| 3   | "Print your poster" is a desktop A4 task on a phone-first journey; free-print promise not surfaced | Launch (QR)     | High       | Med    | **P1**   |
| 4   | OTP step: no spam-folder reassurance, no resend cooldown, expired = wrong-code message             | Verification    | Medium     | Low    | **P1**   |
| 5   | Not-live dashboard leads with "Scan reward" (nothing to scan) instead of "Finish setup"            | First dashboard | Medium     | Low    | **P1**   |
| 6   | Signup password forces upper+lower+digit+symbol; `a-z`/`A-Z` rule chips render identically         | Signup          | Medium     | Low    | **P1**   |
| 7   | Auth pages carry full marketing header CTA + 20-link footer — leaky funnel, no focused layout      | Signup/Verify   | Medium     | Med    | **P2**   |
| 8   | Launch hub nav _is_ the readiness rail; stamps read as a tracker, tappability not obvious          | Launch          | Medium     | Med    | **P2**   |
| 9   | Onboarding validates only on server round-trip (no inline validation like signup)                  | Onboarding      | Medium     | Med    | **P2**   |
| 10  | Step-number signposting inconsistent; reward-preset "added" not announced to screen readers        | Launch          | Medium/Low | Low    | **P2**   |

---

## 3. Detailed findings (grouped by dimension)

Findings are numbered `F1…`. Later dimensions reference earlier findings rather than repeat them.

### Dimension 1 — First impression & clarity

**F1 · Landing five-second test: passes. (Strength)**
_Route/element:_ `/` hero — eyebrow `NO-APP QR LOYALTY · UK FOOD & DRINK`, h1 `The loyalty card that just opens.`, sub `Scan your till QR — the card opens in their browser. No app, no Apple or Google Wallet pass. Every stamp verified at your counter.`, CTA `Start free pilot`, bullets `Build free — no payment to start` / `30-day pilot, then £49/mo`.
_Observed:_ Within five seconds the category (loyalty for UK food & drink), the differentiator (no app/wallet), the price (£49/mo), and the next action (Start free pilot) are all present.
_Verdict:_ No issue. This is a clear, well-prioritised hero. Credit retained in the scorecard.

**F2 · Landing→signup handoff: strong, promise preserved. (Strength)**
_Route/element:_ `/signup` — eyebrow `START FREE PILOT`, h1 `Your first stamp is waiting.`, body `Set up your venue QR loyalty card in about five minutes. Create your account, verify your email with a six-digit code, then add your venue, rewards, and printed kit.`, form eyebrow `30 DAYS FREE`, form context `This is your operator account. Add your details first — business and venue setup come after you verify your email.`
_Observed:_ The signup page restates the value props, sets a realistic time budget ("about five minutes"), pre-explains the six-digit code, and frames the account as an "operator account" with business/venue to follow. This is a textbook handoff — not a context cliff.
_Verdict:_ No issue; strength.

**F3 · The "free vs card-required" story contradicts itself across surfaces.** → see **F14 (High)** under Trust; it is primarily a trust/content problem.

### Dimension 2 — Information architecture & navigation

**F4 · The launch hub has no conventional tabs — the readiness rail _is_ the navigation. (Medium)**
_Route/element:_ `/app/launch` / `/dev/app-harness/launch` — the five stamps `VENUE · CARD · REWARDS · VENUE QR · BILLING` (`launch-readiness-panel.tsx`). Observed: there is **no horizontal tab strip**; each stamp is a `<Link href="/app/launch?tab=…">` and clicking it switches the panel. Confirmed in source: `LAUNCH_HUB_TABS` has no rendered tablist; nav is driven entirely by the rail.
_Observed vs assumed:_ Fact — the stamps are the only tab affordance. Assumed — that a non-technical landlord may read the stamp row as a _progress tracker_ (it looks like one: numbered discs, "Ready/Next up/To do" labels) rather than as clickable navigation for jumping between steps.
_Why a problem:_ Forward progress is fine (each panel has its own "Save & continue" button via `LaunchSaveNextAction`), but **non-linear navigation** — going back to edit the card after seeing the QR — depends on recognising the stamps as tappable. The affordance is subtle.
_Heuristic:_ Recognition rather than recall; visibility of system status vs. actionability.
_Impact on users:_ Merchants who want to revise an earlier step may not find the way back without hunting.
_Impact on funnel:_ Low-to-moderate; mostly affects edit/revisit, not first-pass completion.
_Fix:_ Give the stamps a clearer interactive cue — a subtle "tap to edit" affordance on ready steps, hover/press elevation already exists but add an explicit `role`/visual "chevron" or a one-time coach line ("Tap any step to jump to it."). Keep the current auto-advance for the linear path.
_Effort:_ Medium · _Priority:_ P2.

**F5 · Step-number signposting is inconsistent and mostly invisible on mobile. (Medium/Low)**
_Route/element:_ Card panel eyebrow `Step 2` (bare; `loyalty-card-form.tsx:152`, hidden on mobile); Rewards `Step 3 · Rewards` (only in the _card-missing fallback_, `rewards-panel.tsx:64`); Billing `STEP 5 OF 5 · BILLING` (`billing-activation-card.tsx:35`, visible on mobile). Rail numbers `1.`–`5.` are desktop-only (`sm:inline`).
_Observed:_ Three different formats; **only 2 of 5 steps carry a number on the happy path**; on a phone the _only_ visible step number is billing's "5 of 5" (card's "Step 2" is `sm`-hidden). The _order_ is correct (venue 1 / card 2 / rewards 3 / qr 4 / billing 5) — this was reconciled in a prior pass — but the _presentation_ is uneven.
_Why a problem:_ "Step 5 of 5" appearing with no visible 1–4 context on mobile can read as "I've somehow skipped to the last step." The mobile header ("3 of 5 steps done. Next: Create your QR") carries the real load, so the numbered eyebrows are redundant where present and confusing where isolated.
_Heuristic:_ Consistency & standards.
_Fix:_ Pick one system. Either (a) drop the per-panel "Step N" eyebrows entirely and rely on the header "N of M · Next: X" + the rail, or (b) show a consistent `Step N of 5 · <name>` on every panel including venue and QR, on all breakpoints. (a) is lower effort and less clutter.
_Effort:_ Low · _Priority:_ P2.

**F6 · Exactly-one-path-to-billing holds. (Strength)**
_Observed:_ First-run activation routes to a single destination — `billing-status-copy.ts` `not_started` → `/app/launch?tab=billing` with the verb "Proceed to billing," matching the launch header CTA, the readiness rail ("Add a card to activate"), and the activation card button. Post-activation management routes to `/app/account?tab=billing`. This single-destination invariant is unit-tested (`tests/unit/billing-status-copy`). No contradiction observed. Strength; retain.

**F7 · A "done" QR rail step navigates _out_ of the hub. (Low)**
_Route/element:_ `launch-readiness-core.ts` — once ready, the `qr` step's `href` becomes `/app/qr` (leaves the setup shell/rail) rather than `/app/launch?tab=qr`.
_Why a problem:_ Minor disorientation — clicking the "done" QR stamp drops the setup context the merchant was in.
_Fix:_ Keep completed setup steps inside the hub (`?tab=qr`) until launch is fully complete. _Effort:_ Low · _Priority:_ P3.

### Dimension 3 — User journey & task completion

**F8 · Nothing is asked twice, and drafts survive. (Strength)**
_Observed:_ Business/venue captured once at `/app/onboarding` (`onboarding-form.tsx`); onboarding success redirects to `/app/launch?tab=card`, _skipping_ the already-captured venue step. Onboarding autosaves a per-user draft to `localStorage` (`onboarding-form.tsx:165–179`), so a merchant who abandons mid-form and returns on the same device keeps their entries. Good "leave and resume" resilience.

**F9 · The QR requires ≥3 active rewards before it can be generated. (Low, by design)**
_Route/element:_ `/app/launch?tab=qr` — `Add 3 rewards before launch.` / `The QR stays blocked until at least 3 active mystery rewards are in the pool.` (`qr-panel.tsx:81–92`; `LAUNCH_MIN_ACTIVE_REWARDS = 3`).
_Observed:_ This is intrinsic to the mystery-reward mechanic (each full card must have something to reveal). It is friction ("I just want my QR") but it is explained inline and offers a direct "Add or activate a reward" link. Acceptable; note only.

**F10 · Unhappy paths at OTP are thin.** → see **F16 (Medium)** under Interaction.

**F11 · Stripe abandon/return is handled, but the return banner can go stale. (Low)**
_Observed:_ `startCheckoutAction` creates a `mode:"subscription"` Checkout Session with `trial_period_days: 30`; `success_url`→`?checkout=success`, `cancel_url`→`?checkout=cancelled`. On return, `/app/launch` calls `completeBillingCheckoutReturn` and `BillingOutcomeMessages` renders `Checkout completed` / `Checkout cancelled` / `Billing sync is still catching up`. Good coverage. Minor: `checkout`/`portal` params are **excluded** from the transient auto-scrub (`launch-search-params.ts`), so the success/cancel banner **persists on manual refresh** and can read as stale. _Fix:_ scrub after first render. _Effort:_ Low · _Priority:_ P3.

### Dimension 4 — Visual hierarchy & layout

**F12 · Not-live dashboard: primary CTA competes with the real next job. (Medium)** → detailed under Conversion (**F19**).

**F13 · Form-field labels sit at the 11.5px uppercase-mono floor. (Low)**
_Route/element:_ `.eyebrow` = `font-size: 0.71875rem (11.5px); font-weight:700; letter-spacing:.06em; text-transform:uppercase; color: muted-foreground` (`globals.css`). Used for every field label: `YOUR NAME`, `EMAIL`, `BUSINESS NAME`, `CARD NAME`, `EMAIL CODE`, etc.
_Observed:_ Contrast passes (muted `#4f473d` on paper ≈ 8:1). But 11.5px, letter-spaced, all-caps _monospace_ for the primary label of every input is a readability trade-off for the stated audience (time-poor, sometimes older landlords, mid-shift, on a phone). Uppercase + tracking measurably slows reading.
_Note on scope:_ This is the deliberate Wet Ink label style, so I am flagging **legibility for this audience**, not the aesthetic. It is a Low-severity consideration, not a defect.
_Fix (optional):_ Consider a slightly larger label size (12.5–13px) or sentence case for the _most critical_ fields (name/email/OTP) while keeping the mono eyebrow elsewhere. _Effort:_ Low · _Priority:_ P3.

### Dimension 5 — Interaction design

**F14 · (Referenced) Billing reassurance** → Trust, below.

**F15 · Password validation timing & the identical-chip bug. (Medium)**
_Route/element:_ `/signup` — `PasswordRequirements` chips render `8+ · A-Z · A-Z · 0-9 · !@#` (observed in screenshot). Rules: `minLength/hasLowercase/hasUppercase/hasDigit/hasSymbol` (`lib/auth/password.ts`).
_Observed (fact):_ The lowercase chip's label is `a-z` and the uppercase chip's is `A-Z`, but the chip has `text-transform: uppercase` (`password-requirements.tsx:91`), so **both render visually as "A-Z"** — the two rules are indistinguishable on screen. Only the hover tooltip / `sr-only` text (`Include a lowercase letter (a–z)` vs `…uppercase…`) disambiguates, and the chips aren't keyboard-focusable, so keyboard users can't reach the tooltip.
_Why a problem:_ A merchant who has an uppercase letter but no lowercase sees "A-Z" already satisfied-looking twice and can't tell which rule is unmet. Adds avoidable password-entry friction at the top of the funnel.
_Heuristic:_ Visibility of system status; error prevention.
_Fix:_ Don't uppercase these two chips (or relabel to `abc` / `ABC`, or `a…z` / `A…Z` with the transform removed for this component). _Effort:_ Low · _Priority:_ P1.
_Related (Medium):_ The **policy itself** forces upper+lower+digit+symbol. Mandatory composition rules are high-friction on a phone and run counter to current NIST/OWASP guidance (favour length over composition). It mirrors the Supabase config, so relaxing it is a backend+frontend change — but worth it: a wary landlord bouncing at "you need a symbol" is a pure-friction loss. _Consider:_ drop the symbol requirement, keep 8+ and length emphasis. _Effort:_ Medium (config + copy) · _Priority:_ P1.

**F16 · OTP step under-serves the unhappy paths. (Medium)**
_Route/element:_ `/signup/verify` — single input (`id=otp`, `type=text`, `inputMode=numeric`, `autocomplete=one-time-code`, `maxLength=6`), `Verify email` / `Resend code` (`signup-verify-form.tsx`); errors from `verifyEmailOtpAction`.
_Observed (facts):_ The input ergonomics are **correct** (numeric keyboard, one-time-code autofill, paste-friendly single field, focus returns to `#otp` on error, error is a `role="alert"` Alert). But:

- **No resend cooldown/feedback.** "Resend code" is always active; spamming it hits the server rate limit (3/15 min) and surfaces `Could not send another code just now. Wait a moment and try again.` — reactively, with no "available in Ns" affordance.
- **No deliverability reassurance.** No "check your spam/junk folder" hint; the only help is `You can resend it here if the first one has gone missing.`
- **Expired code = wrong code.** Both an expired and an incorrect code return the identical `That code was not accepted. Check it and try again.` (`actions.ts:253–258`). A merchant with an _expired_ code is told to "check it" rather than "resend a fresh one."
  _Why a problem:_ Email-OTP is a classic drop-off; the wait + "did it send?" anxiety is where merchants abandon. The screen is silent on the three things that reduce that anxiety.
  _Heuristic:_ Help users recognise/diagnose/recover from errors; match to real-world (email latency, spam).
  _Impact on funnel:_ Directly on OTP success rate and resend rate.
  _Fix:_
- Add under the field: `Codes arrive in under a minute. No email? Check your spam or junk folder.`
- Add a resend cooldown: disable "Resend code" for ~30s with a live "Resend available in 0:24" countdown.
- Split the expired case: `That code has expired — tap "Resend code" for a fresh one.` (Requires distinguishing the expiry branch server-side.)
  _Effort:_ Low–Medium · _Priority:_ P1.

**F17 · Reward-preset "added" state isn't announced to assistive tech. (Medium, a11y)**
_Route/element:_ `/app/launch?tab=rewards` — preset tiles cycle `add → pending ("Open below — save to add") → added ("Added to your pool")` (`loyalty-card-form.tsx:377–441`). State is conveyed via `aria-pressed` + swapped `aria-label` + `disabled`, but there is **no `aria-live` region**, and the live count (`{n} / 3 active`) is likewise not in a live region.
_Why a problem:_ A screen-reader user who taps a preset gets no announcement that it moved to "Added" or that the count changed toward the 3-reward gate — they must re-navigate to discover state.
_Heuristic:_ WCAG 4.1.3 Status Messages (AA).
_Fix:_ Wrap an `aria-live="polite"` status ("Added to your pool — 2 of 3 active rewards") that updates on add/remove. _Effort:_ Low · _Priority:_ P2.

**F18 · Loading/pending/empty states are handled well. (Strength)**
_Observed:_ `SubmitButton` disables + `aria-busy` + spinner + pending label ("Saving…", "Checking…", "Creating QR…") across every action form. Launch panels have `Suspense` skeletons; dashboard streams have per-stream error boundaries + skeletons; the activity feed has a real empty state (`No activity yet` / `Activity will appear after members join, add stamps, redeem rewards, or download QR assets.`). Solid.

### Dimension 6 — Content & UX writing

**F14 (content facet) · "Your account is created" recurs across three later steps. (Low/Medium)**
_Route/element:_ Launch header heading when billing is pending (`launch-header-copy.ts:56`), rewards success title `Your account is created.` (`rewards-panel.tsx:149`), QR success body `Your account is created. Proceed to billing…` (`qr-panel.tsx:162`).
_Observed:_ The account was created back at signup. Reasserting "Your account is created" as a _heading/status_ at the venue, rewards, and QR steps states a stale, backward-looking fact instead of the current action. On the billing screen it becomes the h1 while the card's real action ("Activate your venue") is the h2 beneath it.
_Why a problem:_ Weak, repetitive hierarchy; the most motivating message ("you're one step from live") is buried under a fact the merchant already knew.
_Fix:_ Replace these with forward-looking action copy — launch header when billing pending → `One step from live` (mobile context keeps "The last step before your venue goes live."). _Effort:_ Low · _Priority:_ P2.

**F14b · CTA verbs are generally strong.** "Proceed to billing," "Create QR," "Finish setup," "Save venue details," "Add rewards" are all specific and outcome-oriented. No vague "Submit"/"Continue" primaries observed. Strength.

**F14c · Terminology is mostly consistent, with one plan-name drift.**
_Observed:_ business/venue/card/stamp/reward vocabulary is used consistently across all six stages (venue = the scanning location; card = the mystery visit card; reward = pool item; stamp = a visit). One drift: the plan is unnamed on the activation card ("£49 a month"), called **"Growth Plan"** in the account/cancel copy (`BillingOutcomeMessages`), and marketed as **"The 30-Day First-Regular Launch"** offer. _Fix:_ name the plan consistently at the activation moment. _Effort:_ Low · _Priority:_ P3.

### Dimension 7 — Accessibility (WCAG 2.2 AA)

**F-A11y · Fundamentals are a relative strength; gaps are narrow. (Mixed, mostly strength)**

_Verified strengths (facts from source + tokens):_

- **Field/error association is correctly wired.** `FormField` injects `aria-describedby` (description + error id) and `aria-invalid` (`components/forms/form-field.tsx:66–95`); onboarding fields do the same manually (`onboarding-form-fields.tsx:38–57`). Required fields have visible `*` + `sr-only "(required)"`.
- **Errors move focus.** Signup, verify, and onboarding all move focus to the first invalid field on failed submit (`signup-details-form.tsx:43–55`, `signup-verify-form.tsx:55–58`, `onboarding-form.tsx:99–128`). Form-level errors use `role="alert"` (`Alert`, `OnboardingFormError`).
- **OTP is done right:** `inputMode="numeric"` + `autocomplete="one-time-code"` (mobile SMS/email autofill + numeric keypad).
- **Contrast passes AA comfortably** (computed from `globals.css` light tokens): body ink `#211c16` on paper `#f6f1e6` ≈ **15.0:1**; muted `#4f473d` on paper ≈ **8.1:1** (≈7.3:1 on `paper-2`); white on the vermillion primary `#cf330a` ≈ **5.1:1**; error text `#c0301c` on paper ≈ **5.1:1**, `destructive-strong #a62918` ≈ 6.3:1. All above 4.5:1.
- **Focus is always visible and cannot be defeated:** `.pressable:focus-visible` / `.focus-ring:focus-visible` set a 2px `--ring` outline at 2px offset in an _unlayered_ block, so utility `outline-none` can't remove it (`globals.css:412–415`). Inputs get a matching focus + invalid-state outline.
- **Touch targets:** every Button size reaches ≥44px on coarse pointers (`[@media(pointer:coarse)]:min-h-11`, `button.tsx:37–49`); inputs are `h-12` (48px). Skip-to-content link present; rail links carry descriptive `aria-label` + `aria-current`.

_Gaps (findings):_

- **F17** — reward-preset "added" and live counts not announced (WCAG 4.1.3). _Medium._
- **F-A11y-2 (Low):** onboarding **field-level** errors are plain `<p>`, not live regions; they're read only because focus lands on the associated input. Acceptable, but a second failed submit that doesn't move focus (e.g., same field still invalid) won't re-announce. _Fix:_ mirror signup's inline pattern or add `role="alert"` to field errors. _Effort:_ Low.
- **F-A11y-3 (Low, deliberate):** the shared `Disclosure` summary is ~40px tall on mobile — below the 44px AAA target but meeting the 24px AA minimum (WCAG 2.5.8). Documented as a deliberate WONTFIX in prior work (a 44px fix broke a committed visual baseline and an `::before` hit-area intercepted the summary's own clicks). Noted, not re-litigated.
- **F-A11y-4 (Low):** password-rule chips are non-focusable `<span>`s with hover/focus-within tooltips — keyboard-only users can't surface the tooltip (mitigated by `sr-only` text). Combined with **F15** (identical `A-Z` rendering) this is a small perception gap.

_Assumption:_ full keyboard-only completion of the funnel was verified structurally (all controls are native inputs/buttons/links, no `div` click handlers seen in the audited components) but not driven end-to-end key-by-key. High confidence it completes; flagged as partially assumed.

### Dimension 8 — Mobile & responsive experience

**F-Mobile-1 · Correct keyboards & sticky orientation. (Strength)**
_Observed:_ email field `type=email`/`autocomplete=email`; phone `type=tel`; OTP `inputMode=numeric`. On `/app/launch` mobile, the readiness rail is a **sticky top step-nav** with a progress bar + `N/M` chip that stays in view as the panel scrolls (`LaunchMobileTabNav`). The mobile launch header carries a real visible h1 + "N of M · Next: X" (not sr-only). Good mobile orientation.

**F-Mobile-2 · "Print your poster" is a desktop task on a phone-first journey. (High)** → detailed under Conversion/Trust (**F20**), but it is fundamentally a mobile-context failure: the audited journey "happens on a phone," yet the activation payoff instructs `open the A4 sheet and print at 100% scale — no fit-to-page` (`qr-panel-live.tsx:163–168`), which a phone can't do.

**F-Mobile-3 · Reassurance/orientation blocks land _below_ the fold on mobile. (Low)**
_Observed:_ On `/app/onboarding` the "WHAT HAPPENS NEXT / From sign-up to your first stamp" 5-step roadmap renders _after_ the form on mobile (`order-2`); on `/signup/verify` the "Your operator account is created…" context sits below the code card. The most reassuring content is reachable only by scrolling past the primary control. _Fix:_ hoist a condensed one-liner above the form on mobile. _Effort:_ Low · _Priority:_ P3.

**F-Mobile-4 · Long forms scroll cleanly; no horizontal overflow observed** at 375px across signup, onboarding, and all five launch tabs (prior work added `overflow-x-clip` guards; snapshots showed no clipping). Strength.

### Dimension 9 — Trust, credibility & confidence

**F14 (Trust, the headline finding) · The billing/activation moment is under-reassured. (High)**
_Route/element:_ `/app/launch?tab=billing` — `SetupBillingActivationCard`. Observed copy: eyebrow `STEP 5 OF 5 · BILLING`, h2 `Activate your venue`, body `Add a card through Stripe to activate your venue and start accepting stamps.`, plan rows `Free trial → 30 days`, `Then → £49 a month`, `Billed → Per location`, button `Proceed to billing · £49/mo`, footnote `Secure checkout via Stripe. Cancel anytime during the trial.`
_Observed (facts):_

1. **The First-Regular Guarantee is absent.** It is prominent on `/signup` (`If your live card hasn't brought back a first regular by the end of your 30-day pilot, the pilot stays free until it does.`), but appears **nowhere** on the activation card or `BillingPanel` (verified by reading both).
2. **No explicit "£0 due today."** The trial is implied by "Free trial 30 days" but the card never says the merchant won't be charged now.
3. **"Cancel anytime _during the trial_"** is narrower than the marketing headline "cancel anytime" (unconditional). A skeptic reads: "so after the trial I'm locked in?"
   _Assumption:_ the actual Stripe Checkout screen (external) is standard and shows £0-today; but the merchant hesitates _before_ clicking, on Nabaperks' card, where these cues are missing.
   _Why a problem:_ This is the single mandatory gate to a live venue for a subscription-averse audience. The strongest risk-reversal, the clearest "you won't be charged," and the true cancel promise are all missing at the exact moment of maximum hesitation.
   _Heuristic:_ Reduce risk at the point of commitment; consistency between marketing promise and product moment.
   _Impact on funnel:_ Directly on **billing-activation rate** — the lowest, most valuable step in the funnel.
   _Fix (copy, drop-in):_
   > **Activate your venue** · Step 5 of 5
   > Free trial: **30 days** · Then **£49/mo** · **Due today: £0**
   > [ Proceed to billing · £49/mo ]
   > Secure checkout via Stripe. **Cancel anytime** — one tap from your billing page.
   > **First-Regular Guarantee:** if your live card hasn't brought back a regular by day 30, your pilot stays free until it does.
   > _Effort:_ Low · _Priority:_ **P0**.

**F14-related · Free/card-required story is inconsistent. (High)**
_Route/element:_ `/` bullets `Build free — no payment to start` + `30-day pilot, then £49/mo`; `/signup` bullet `Card required — cancel anytime from your billing page.`
_Observed:_ Both are technically true (build free; card required to _activate_), but the juxtaposition — "no payment to start" then "card required" — reads to a wary landlord like a bait-and-switch.
_Fix:_ Tell one consistent story everywhere: **"Build and preview your whole card free. A card is needed only to switch it on — £0 today, then £49/mo after your 30-day pilot, cancel anytime."** Put that same sentence on `/`, `/signup`, and the billing card. _Effort:_ Low · _Priority:_ **P0**.

**F14d · Security & social-proof cues. (Mostly strength, one caution)**
_Observed:_ "Secure checkout via Stripe" appears at the payment step (good). Landing social proof is framed as **real data** ("Each figure is a real customer action…" — LOYALTY MEMBERS 1,842, VISITED 812, REWARDS 1,180, RETURN 46.8%), which is honest and specific. _Caution (Low):_ the recurring scarcity/urgency (`30 PRINT-RUN SPOTS LEFT IN JULY`, `we onboard 40 new venues per month`) is tied to a real print-capacity constraint but leans on manufactured-urgency patterns; keep it truthful and avoid a permanently-"30 left" counter that erodes trust on repeat visits.

### Dimension 10 — Conversion & business impact

**F19 · The not-live dashboard leads with the wrong primary action. (Medium)**
_Route/element:_ `/app` (brand-new merchant, onboarding complete, launch incomplete) — `PageTitle` actions are `Announce` (secondary) + **`Scan reward` (primary)** (`app/app/page.tsx:55–73`). The real next job — "Add rewards" / finish setup — lives only in the `MerchantSetupReminder` strip above.
_Observed:_ On `/dev/app-harness/dashboard?setup=incomplete` the page's premium CTA is "Scan reward," yet a not-live venue has **no members and nothing to scan**. The reminder strip ("2 of 4 complete · Next: Your rewards · Add rewards →") is correct, but the _page-level primary_ points at a dead action.
_Why a problem:_ The most prominent button on the first-run dashboard is unusable until the venue is live; it competes with the actual activation task.
_Heuristic:_ Match primary action to user's current goal; guide the next best action.
_Impact on funnel:_ Dilutes the finish-setup nudge at a key moment (merchants often land on `/app` before completing launch).
_Fix:_ Make the dashboard header primary CTA _state-aware_: while `!launchReady`, show **"Finish setup →"** (to `nextStep.href`) as primary and demote "Scan reward" to secondary/hidden. Only promote "Scan reward" once live. _Effort:_ Low · _Priority:_ P1.

**F20 · "Poster in hand" stalls on mobile, and the free-print promise isn't surfaced. (High)**
_Route/element:_ `/app/launch?tab=qr` (live) — `LaunchStep step="02"` `Print a counter poster` / `Pick a layout, open the A4 sheet, and print at 100% scale — no fit-to-page.`, five poster tiles opening `/app/qr/poster/{id}` in new tabs (`qr-panel-live.tsx:160–222`).
_Observed (facts):_ The only "get your poster" path here is **self-printing an A4 sheet** — a desktop task. On the phone the journey assumes, "print at 100%, no fit-to-page" isn't actionable. Meanwhile the marketing promise (`/signup`: `Go live by 31 July 2026 and we print and post your first counter-poster run — free`) is **not mentioned anywhere on this screen**. There is no "we're printing and posting yours" status and no "email me the PDF" option.
_Why a problem:_ The activation payoff — the physical thing that makes the loyalty card real at the till — is where a phone-first merchant hits ambiguity: "Do I print this myself? Wait for the free one? How?" The strongest deliverable (free printed posters) is invisible at the moment it would most reassure.
_Impact on funnel:_ On **time-to-live** (signup → poster ready) and on first-stamp rate — a merchant without a poster at the counter can't get a first stamp.
_Fix:_

- Surface the fulfilment promise here: a banner "**Your free printed poster is on its way** — we print and post your first run. Want one at the till tonight? Print an A4 below or **email the PDF to yourself.**"
- Add "**Email me the poster PDF**" (phone-friendly) alongside the A4 tiles.
- Reword the print instruction to be device-aware ("On a computer: open the A4 and print at 100%. On your phone: email it to yourself or your printer.").
  _Effort:_ Medium · _Priority:_ **P1**.

**F21 · Value-before-payment structure is correct. (Strength — the key conversion asset)**
_Observed:_ The setup order is venue → card → rewards → **QR (generated) → billing**. The real QR and poster tiles exist _before_ billing; the QR shows `ENABLED · BILLING NEEDED` and `Finish billing to accept scans.` So the merchant sees and can even test the finished asset before paying — value is demonstrated before effort/payment is demanded. This is exactly right and should be _leaned into_ (e.g., "Here's your live card — switch it on" framing at billing).

### Dimension 11 — Emotional experience

**F22 · The arc is "I'll be live tonight," with two confidence dips.**
_Observed highs:_ "Your first stamp is waiting" (signup), "about five minutes," the visible QR appearing before payment, the "3 of 5 · Next: X" momentum on the launch rail, the celebratory `You're live` / `RewardSeal` state.
_Confidence dips (mapped to findings):_

- **OTP wait** (F16) — the silence on deliverability is where enthusiasm meets doubt.
- **Billing** (F14) — the mandatory card with the guarantee absent is the anxiety peak.
- **Empty dashboard** (F23) — after all that effort, a wall of zeros can feel anticlimactic.
  _What restores confidence:_ each dip has a cheap fix (spam-note + cooldown; guarantee + £0-today; a first-run metrics message — below).

**F23 · First-run empty metrics have no encouragement. (Medium; partly assumed)**
_Route/element:_ `/app` metric tiles (MEMBERS, NEW 7D, STAMPS 7D, REWARDS 7D) via `MerchantDashboardStream`.
_Observed vs assumed:_ The activity feed has a good empty state (`No activity yet…`). But I could **not directly observe a true-empty metrics dashboard** — the harness uses the populated "Old Crown Girton" fixture (1,842 members) — and found **no dedicated empty/zero treatment** for the metric tiles in source. _Assumption:_ a brand-new merchant sees `0` across every tile with delta chips.
_Why a problem (if assumed-true):_ A grid of zeros immediately after activation is deflating and gives no next action.
_Fix:_ Until first data lands, replace the metric grid with a single encouraging card: "**No members yet — that's expected.** Show your counter QR to your next customer and your first join will appear here." (Reuse the QR card's "Show full screen" CTA.) _Effort:_ Low–Medium · _Priority:_ P1. _Recommend verifying the real zero-state first._

### Dimension 12 — Competitive & best-practice comparison

**F24 · Against Square Loyalty / Loyalzoo / Stamp Me / SumUp/Toast — and paper.**

- **vs. paper stamp card (the real alternative):** Nabaperks wins on the pitch (no reprints, fraud-verified at counter, data) but _loses on time-to-first-use unless the poster problem (F20) is solved_ — a paper card is "live" the moment it's printed; Nabaperks requires signup+OTP+setup+**card entry** before a first stamp. The mandatory-billing gate (F14) is the single place paper feels easier. Closing F14/F20 is what makes "live tonight" beat "just photocopy a card."
- **vs. Square/SumUp/Toast loyalty:** those bundle loyalty into an existing POS relationship (loyalty is a toggle on hardware the merchant already trusts). Nabaperks is standalone, so **trust must be manufactured in-flow** — which sharpens the case for F14 (guarantee at billing) and F14d (honest proof). Nabaperks' no-hardware/no-app angle is a genuine differentiator to keep foregrounding.
- **vs. Loyalzoo / Stamp Me:** recognised onboarding patterns Nabaperks already applies well — a **setup checklist** (the readiness rail), **progressive disclosure** (per-tab panels, the `Disclosure` blocks), and an explicit **activation moment** (billing = "switch it on"). The gap vs. best practice is **not structure but reassurance density at the activation moment** and a **phone-native "get your poster"** step. Stamp Me in particular leans on "we mail your materials" — Nabaperks has the same offer but hides it (F20).

---

## 4. User-journey breakdown (six stages)

| Stage                                    | Entry expectation            | Exit state (success)                           | Key friction                                                                                                                                                   | Est. drop-off risk                       |
| ---------------------------------------- | ---------------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| **2. Signup (`/signup`)**                | "Quick account, then set up" | Account created → redirect to `/signup/verify` | Password composition + identical `A-Z` chips (F15); full marketing chrome/leaks (F25); long name-description block on mobile                                   | **Medium** — password friction           |
| **3. Verification (`/signup/verify`)**   | "Enter the code, keep going" | OTP verified → `/app/onboarding`               | No spam note, no resend cooldown, expired=wrong (F16); context below fold (F-Mobile-3)                                                                         | **High** — email latency + silence       |
| **4. Onboarding (`/app/onboarding`)**    | "Tell them about my venue"   | Business+venue saved → `/app/launch?tab=card`  | ~8 fields on mobile; server-round-trip validation only (F26); autosave mitigates abandonment (F8)                                                              | **Medium** — form length                 |
| **5. Launch/setup (`/app/launch` tabs)** | "Build the card, get my QR"  | QR live; then billing → live venue             | Rail-as-nav discoverability (F4); 3-reward gate (F9); step-number inconsistency (F5); **billing wall under-reassured (F14)**; **poster is desktop task (F20)** | **High** at billing; Medium across setup |
| **6. First dashboard (`/app`)**          | "Show me it's working"       | Sees venue name, QR card, (later) real metrics | Premature "Scan reward" primary (F19); empty-metrics anticlimax (F23)                                                                                          | **Low–Medium** — post-activation         |

**Where the funnel actually bleeds:** Stage 3 (OTP anxiety) and Stage 5-billing (the mandatory card with weak reassurance). These two, plus the poster ambiguity, are where I'd expect the largest measurable lift.

---

## 5. Quick wins (≈1 day each)

1. **Billing card reassurance (F14):** add the guarantee line, "Due today: £0," and change "Cancel anytime during the trial" → "Cancel anytime — one tap from your billing page." _(copy only)_
2. **Reconcile free/card copy (F14-related):** one shared sentence on `/`, `/signup`, billing card. _(copy only)_
3. **OTP deliverability copy + resend cooldown (F16):** spam-folder hint + 30s countdown on resend. _(copy + small timer)_
4. **Fix the identical `A-Z` chips (F15):** remove `uppercase` on those two chips or relabel. _(one-line CSS/label)_
5. **State-aware dashboard CTA (F19):** "Finish setup →" as primary while `!launchReady`. _(small conditional)_
6. **"Email me the poster PDF" + fulfilment banner (F20, partial):** surface the free-print promise on the QR panel. _(copy + reuse existing PDF/email plumbing if present)_
7. **Reward-preset `aria-live` (F17):** announce "Added — N of 3 active." _(small a11y add)_
8. **De-stale the billing return banner (F11):** scrub `checkout`/`portal` after first render.
9. **First-run metrics message (F23):** swap the zero-grid for an encouraging QR-forward card. _(verify zero-state first)_

---

## 6. Strategic recommendations (larger work)

1. **A focused auth/checkout layout (F25).** Replace `MarketingLayout` on `/signup` and `/signup/verify` with a stripped funnel layout: logo (non-link or "save & exit"), the form, a minimal footer (Terms/Privacy/Help only). Remove the header "Start free pilot" CTA and the 20-link marketing footer from the funnel. Expect measurable lift in signup+OTP completion.
2. **Rethink the "poster in hand" service moment (F20).** Make fulfilment a first-class, phone-native flow: a "Your free printed poster" status/tracker, "email me the PDF," and clear device-aware print guidance. This is the difference between "live tonight" and "someday when I'm at a computer" — it directly beats the paper card.
3. **Reframe billing as "switch on your live card" (F21/F14).** Lean into value-before-payment: carry the just-built QR/card visual onto the billing screen ("Here's your card — switch it on"), so the card entry feels like _activating an asset you already made_, not _starting a subscription_.
4. **Password policy modernisation (F15).** Move from composition rules to length-forward guidance (align Supabase config + client). Reduces top-of-funnel friction for the exact audience most likely to bounce.
5. **Make the setup rail unmistakably navigable (F4)** — or add a lightweight linear "Back / Next" pattern alongside it so revisiting steps never depends on decoding the stamps.

---

## 7. Prioritised 30/60/90-day roadmap

**Days 0–30 — Reassure the two seams (all quick wins).**
Ship #1–#5 and #7–#8 from §5. These are copy + small component edits with the highest expected lift (billing-activation rate, OTP success). Add analytics events (§10) _first_ so lift is measurable. Verify the real empty-metrics dashboard and ship #9 if confirmed.

**Days 31–60 — Fix the poster moment and the funnel layout.**
Deliver Strategic #1 (focused auth layout) and Strategic #2 (phone-native poster/fulfilment). Reframe billing as "switch on your card" (Strategic #3). Re-measure time-to-live and first-stamp-within-7-days.

**Days 61–90 — Reduce structural friction.**
Password-policy modernisation (Strategic #4); setup-rail navigability / linear back-next (Strategic #5); onboarding inline validation (F26); step-number system cleanup (F5); reward-preset + onboarding a11y announcements (F17, F-A11y-2). Consider progressive onboarding (defer full address to a "we'll help you finish" state) if form-length telemetry shows drop.

---

## 8. UX scorecard

| Dimension                | Score /10 | One-line justification                                                                                                                                                                   |
| ------------------------ | :-------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Clarity**              |     8     | Excellent hero + handoff; diluted only by the free/card story and the recurring "account is created."                                                                                    |
| **Usability**            |     7     | Flow works with good guidance + draft autosave; friction at password, rail-as-nav discoverability, onboarding round-trip validation.                                                     |
| **Accessibility**        |     8     | Strong fundamentals (aria wiring, focus-on-error, 15:1/8:1/5:1 contrast, undefeatable focus ring, 44px coarse targets, one-time-code OTP); gaps are narrow (async status announcements). |
| **Visual design**        |     8     | Cohesive, consistent Wet Ink system; only micro-type labels and a couple of density spots.                                                                                               |
| **Trust**                |     6     | Guarantee/cancel/proof strong in marketing but under-delivered at the billing moment; free/card tension; mild scarcity theatre.                                                          |
| **Mobile experience**    |     7     | Mostly excellent (correct keyboards, sticky rail, no overflow); "print poster" is a desktop task and some context is below the fold.                                                     |
| **Conversion potential** |     6     | Great bones (value before payment) undercut by the billing wall reassurance gap, leaky auth chrome, premature dashboard CTA, password friction.                                          |
| **Overall UX maturity**  |     7     | Clearly and repeatedly iterated, with a strong system and a11y; remaining gaps sit at the trust/conversion seams, not the interaction layer.                                             |

---

## 9. Before-and-after examples

**A. Signup password chips (F15)**

- _Before:_ `8+ · A-Z · A-Z · 0-9 · !@#` (lowercase and uppercase rules render identically).
- _After:_ `8+ · abc · ABC · 123 · !@#` (or remove the `uppercase` transform so `a-z` / `A-Z` differ). Consider dropping the symbol rule entirely.

**B. OTP screen (F16)**

- _Before:_ `Enter your code` → `Use the six-digit code from your email. You can resend it here if the first one has gone missing.` · `[Resend code]` (always active) · wrong+expired both say `That code was not accepted.`
- _After:_ add `Codes arrive in under a minute — check your spam or junk folder if it hasn't.` · `[Resend code — available in 0:23]` · expired path: `That code has expired. Tap "Resend code" for a fresh one.`

**C. The billing moment (F14)**

- _Before:_ `Activate your venue` · `Free trial 30 days / Then £49 a month / Billed Per location` · `[Proceed to billing · £49/mo]` · `Secure checkout via Stripe. Cancel anytime during the trial.`
- _After:_ add `Due today: £0` to the plan rows; change the footnote to `Secure checkout via Stripe. Cancel anytime — one tap from your billing page.`; add `First-Regular Guarantee: if your live card hasn't brought back a regular by day 30, your pilot stays free until it does.`; optional headline swap `Your account is created` → `One step from live`.

**D. Not-live dashboard header (F19)**

- _Before:_ primary `[📷 Scan reward]` + secondary `[📣 Announce]` (nothing to scan yet).
- _After (while `!launchReady`):_ primary `[Finish setup →]` (to `nextStep.href`); demote/hide `Scan reward` until live.

**E. Poster step, phone-first (F20)**

- _Before:_ `Print a counter poster — Pick a layout, open the A4 sheet, and print at 100% scale — no fit-to-page.` + 5 A4 tiles.
- _After:_ banner `Your free printed poster is on its way — we print and post your first run.` + `[Email me the poster PDF]` + device-aware guidance (`On a phone: email it to yourself or your printer. On a computer: open the A4 and print at 100%.`).

---

## 10. Measurement plan

Instrument the funnel end-to-end (PostHog is already wired — `capturePostHogEvent`, e.g. `dashboard_viewed`). Track each transition as its own event with a stable `merchant_id` join key.

| Metric                             | Definition                                                      | Instrument at                                  | Target signal                              |
| ---------------------------------- | --------------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------ |
| **Signup start volume**            | `/signup` starts grouped by referral source                     | `/signup`                                      | Baseline; watch by source                  |
| **Signup completion rate**         | account created ÷ `/signup` starts                              | `signUpAction` success                         | Watch for password-step abandonment (F15)  |
| **OTP success rate**               | verified ÷ verify-page arrivals                                 | `verifyEmailOtpAction` success                 | Primary lift metric for F16                |
| **OTP resend rate**                | resends ÷ verify arrivals                                       | `resendSignupOtpAction`                        | High resend = deliverability anxiety (F16) |
| **Onboarding completion**          | onboarding saved ÷ onboarding starts; add per-field abandonment | `completeOnboardingAction`                     | Watch form-length drop (F26/address)       |
| **Per-tab setup completion**       | venue/card/rewards/qr done ÷ launch entries                     | `getMerchantLaunchReadiness` transitions       | Find the leakiest tab                      |
| **Billing-activation rate**        | checkout completed ÷ reached `?tab=billing`                     | `startCheckoutAction` → `checkout=success`     | **The key metric** for F14                 |
| **Time-to-live**                   | signup → QR poster ready (median)                               | timestamp QR-created + first poster open/email | F20 lift; the "live tonight" proxy         |
| **First-stamp-within-7-days**      | merchants with ≥1 stamp ≤7 days post-activation                 | first `stamp` event per merchant               | The true activation metric                 |
| **Support tickets per activation** | tickets ÷ activations, tagged by stage                          | support tool                                   | Watch OTP + billing + poster tags          |

**Experiments to run first (highest expected value):**

1. A/B the billing card reassurance block (F14) → billing-activation rate.
2. A/B OTP spam-note + resend cooldown (F16) → OTP success + resend rates.
3. A/B "Email me the poster PDF" (F20) → time-to-live + first-stamp-within-7-days.
4. A/B state-aware dashboard CTA (F19) → per-tab setup completion after first `/app` visit.

---

### Appendix — Low-severity / notes (not padding the list above)

- **F25 (Medium, promoted to Strategic #1):** auth pages carry the full marketing header CTA (`Start free pilot`) + a ~20-link footer (spokes, guides, legal) — funnel leakage; no focused layout.
- **F26 (Medium):** onboarding validates only via server round-trip (no inline client validation like signup); slower error feedback and inconsistent with `/signup`.
- Business-type options span `Cafe / Dessert / Bubble tea / Pub or bar / Takeaway / Barber / Salon / Other` — product is broader than the pub-centric marketing; not a bug, a positioning note.
- Harness caveat: the `?setup=incomplete` dashboard shows "2 of 4" while the launch hub shows "N of 5" — a **mock artifact** (`total = checklist.length` is 4 without billing, 5 with). Real `requiresBilling` merchants should see a stable "5"; worth a guard so the denominator never shifts mid-setup in production.
- Not directly observable here (labelled assumptions): real email deliverability + OTP _success_ redirect; the external Stripe Checkout screen; the genuine empty-metrics dashboard (harness uses a populated fixture).

_Prepared from live observation on `:3000` (mobile 375 primary, desktop 1280) + source review. Routes and copy cited inline; assumptions labelled._

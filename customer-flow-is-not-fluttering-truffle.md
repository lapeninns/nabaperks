# Customer Web App — Wallet, Profile, Activity & Rewards

## Context

Today the customer side of Nabaperks is **stateless and QR-driven**: a customer scans a QR, joins, and lands on a single card at `/card/[membershipId]`. There is no home, no way to see *all* their cards, no profile, and no way to log back in on a fresh device. The only persistent navigation belongs to merchants (`/app`) and admins (`/admin`). Customers feel like they're bouncing between disconnected deep-links rather than using an app — which is the "not great as expected" experience.

Customers already get a **real Supabase Auth session** during the join flow (email magic-link or phone OTP), so `getCurrentUser()` works for them — we just never built a logged-in surface on top of it.

**Goal:** add a logged-in customer web app under `/wallet` with four surfaces — **Dashboard/wallet, Profile & account, Activity history, Rewards hub** — plus an **OTP login page** so customers can reach it from any device. The existing QR → join → stamp → reward flow stays fully intact; this is additive.

## Architecture decisions (settled)

- **Namespace:** `/wallet`. Merchant owns `/app`, admin owns `/admin`.
- **Auth entry:** phone/email + OTP login at `/wallet/login`, reusing the exact `signInWithOtp` / `verifyOtp` logic already in [join actions](app/m/[merchantSlug]/join/actions.ts). Set `shouldCreateUser: false` so only people who have joined a venue can log in.
- **Auth gating:** mirror [app/app/layout.tsx](app/app/layout.tsx) — a layout that calls `getCurrentUser()` and redirects to `/wallet/login?next=…`. Login must live *outside* the gated subtree, so use a route group:
  - `app/wallet/login/page.tsx` — public
  - `app/wallet/(authed)/layout.tsx` — auth gate + `CustomerAppShell`
  - `app/wallet/(authed)/page.tsx` → `/wallet` (dashboard), `…/profile`, `…/activity`, `…/rewards`
- **Data access:** reuse the established pattern from [lib/customer/card.ts](lib/customer/card.ts) — `createSupabaseServiceRoleClient()` + resolve the customer from `auth_user_id` + filter all queries by that `customer_id`. (Service role with explicit ownership filtering, same as today.)
- **Shell:** new mobile-first `CustomerAppShell` with a **fixed bottom tab bar** (Wallet / Rewards / Activity / Profile) — more app-like than the merchant top pill nav, but built with the same Wet Ink tokens and active-path logic as [shell-navigation.tsx](components/layout/shell-navigation.tsx).
- **Don't touch the QR flow.** `/card`, `/m`, `/reward`, `/q` keep working as-is on the minimal `CustomerShell`; the wallet links *into* them.

## Implementation

### 1. Data layer — `lib/customer/`

Add a shared resolver and four read functions, each `server-only`, mirroring `getCustomerCardState`'s structure (service-role client, `first()` helper for polymorphic joins, ownership check).

- **`lib/customer/identity.ts`** → `getCurrentCustomer()`: resolve the `customers` row (`id, email, phone, created_at`) from `getCurrentUser().id` via `customers.auth_user_id` (indexed: `customers_auth_user_id_idx`). Returns `null` if not signed in or no customer row. Used by all functions below.
- **`lib/customer/wallet.ts`** → `getCustomerWallet()`: all `customer_memberships` for the customer, joined to `merchants(business_name, business_slug, status)` and the merchant's active `loyalty_cards(card_name, stamps_required, reward_name, is_active)`, plus a count of `reward_events` with `status='unlocked'` per membership. Returns an array of card summaries: `{ membershipId, businessName, cardName, current_stamp_count, stamps_required, unlockedRewards, available }` (`available` reuses the `unavailableMessage` logic from card.ts — merchant status + card active + billing).
- **`lib/customer/rewards.ts`** → `getCustomerRewards()`: `reward_events` across the customer's memberships joined to merchant + card, split into **redeemable** (`status='unlocked'` and `redeemable_from` null/≤ now), **upcoming** (unlocked but future `redeemable_from`), and **redeemed history** (`status='redeemed'`, by `redeemed_at`). Each redeemable item links to the existing `/reward/[rewardId]` page.
- **`lib/customer/activity.ts`** → `getCustomerActivity(limit?)`: `product_events` where `customer_id = <resolved>`, filtered to customer-relevant `event_name`s (`customer_joined`, `stamp_issued`, `reward_unlocked`, `reward_redeemed`), ordered `created_at desc`, enriched with merchant name (batch-load by `merchant_id`). Mirror the display-row shape from [lib/merchant/activity.ts](lib/merchant/activity.ts) (`ActivityDisplayRow`) — extract/share its formatting helpers if cleanly reusable, otherwise a lean customer-scoped version.
- **`lib/customer/profile.ts`** → `getCustomerProfile()`: the `customers` row + latest `consent_records` per channel (marketing opt-in state, read-only) + membership count + member-since (`created_at`).

### 2. Auth — `app/wallet/actions.ts` (`"use server"`)

- `requestWalletOtpAction` / `verifyWalletOtpAction`: lift the body of `requestCustomerIdentityAction` / `verifyCustomerPhoneOtpAction` from [join actions](app/m/[merchantSlug]/join/actions.ts), drop the `merchantSlug`/`qrId` plumbing, set `next = "/wallet"` (email path keeps `/auth/confirm?next=/wallet`), and pass `shouldCreateUser: false`. Keep the existing `enforceRateLimit` guard.
- `signOutCustomerAction`: `supabase.auth.signOut()` then `redirect("/wallet/login")` (the existing [signOutAction](app/(auth)/actions.ts) redirects to merchant `/login`, so we need a customer-targeted one).

### 3. Shell & nav — `components/layout/`

- **`customer-app-shell.tsx`** → `CustomerAppShell`: `min-h-svh bg-background`, sticky top header with `Logo href="/wallet"` + log-out button (`signOutCustomerAction`), centered `max-w-sm` content column with bottom padding to clear the tab bar, and `<CustomerTabBar/>` fixed to the bottom. Takes `signOutAction` as a prop like `MerchantAppShell`.
- **`customer-tab-bar.tsx`** (`"use client"`) → 4 tabs (Wallet `/wallet`, Rewards `/wallet/rewards`, Activity `/wallet/activity`, Profile `/wallet/profile`) with icon + label, active state = ink fill / paper text using the same `isActivePath` semantics as `shell-navigation.tsx` (exact match for `/wallet`, prefix match for the rest). Export from [components/layout/index.ts](components/layout/index.ts).

### 4. Login page — `app/wallet/login/page.tsx` (public)

`MarketingLayout` (or a slim `CustomerShell`) + a client `WalletLoginForm` modeled on [CustomerIdentityForm](components/customer/join-forms.tsx) (email-or-phone → send code → phone OTP entry), wired to the new wallet OTP actions. Copy framed as "Open your wallet" with a "haven't joined yet? scan a venue QR" note for the not-found case.

### 5. Pages — `app/wallet/(authed)/`

- **`layout.tsx`** — `getCurrentUser()` gate → redirect `/wallet/login?next=/wallet`; wrap children in `CustomerAppShell signOutAction={signOutCustomerAction}`.
- **`page.tsx` (Dashboard)** — `getCustomerWallet()`. `PageTitle "Your cards"`; one tile per membership using existing [StampGrid](components/loyalty/stamp-grid.tsx) + [ProgressTrack](components/loyalty) + a "Reward ready" `MonoTag`/`RewardTeaser` when `unlockedRewards > 0`; each tile links to `/card/[membershipId]`. Empty state: "No cards yet — scan a venue's QR to start collecting." Unavailable merchants shown muted.
- **`rewards/page.tsx`** — `getCustomerRewards()`. Sections: Ready to redeem (link → `/reward/[rewardId]`), Coming soon, Redeemed history.
- **`activity/page.tsx`** — `getCustomerActivity()`. Timeline list reusing the activity display-row rendering (mirror merchant activity feed components in `components/merchant/`).
- **`profile/page.tsx`** — `getCustomerProfile()`. Contact (email/phone), member-since, marketing-consent state (read-only this pass), venues-joined count, and a log-out `<form action={signOutCustomerAction}>`.

### 6. Discoverability (small wiring)

- Add a "Your cards" / wallet link from the marketing footer or [app/page.tsx](app/page.tsx) and from `/wallet/login`.
- Optional: when an authenticated customer views `/card/[membershipId]`, show a subtle "← Your cards" link back to `/wallet`. Keep card/reward pages otherwise unchanged so QR deep-links still work for not-logged-in arrivals.

## Reused building blocks (don't rebuild)

- Auth: `getCurrentUser()` ([lib/auth/session.ts](lib/auth/session.ts)), `createSupabaseServiceRoleClient()`/`createSupabaseServerClient()`.
- OTP: `signInWithOtp` / `verifyOtp` patterns from [join actions](app/m/[merchantSlug]/join/actions.ts) + `enforceRateLimit`.
- Layout gate: [app/app/layout.tsx](app/app/layout.tsx); nav active-state: [shell-navigation.tsx](components/layout/shell-navigation.tsx).
- UI: `StampGrid`, `ProgressTrack`, `RewardTeaser`, `StatusBanner`, `ReceiptCard`, `PageTitle`, `Eyebrow`, `MonoTag`, `VenueMark`, `Logo` — all already in `components/loyalty` + `components/brand`.
- Data shape reference: [lib/customer/card.ts](lib/customer/card.ts), [lib/merchant/activity.ts](lib/merchant/activity.ts), [lib/merchant/dashboard.ts](lib/merchant/dashboard.ts).

## Out of scope (flag as follow-ups)

- Editing marketing consents from profile (display read-only this pass).
- Push/PWA install prompt, account deletion, leaving a programme.
- New customer accounts via the login page (login is for existing members only; `shouldCreateUser: false`).

## Verification

1. **Typecheck + lint + tests:** run the project's `typecheck`, `lint`, and test suite (check `package.json` scripts). Memory note: keep tests green. Specifically check whether any route-inventory/snapshot test or `.tmp/redesign-specs.json`-driven test asserts a fixed route set — adding `/wallet/*` may need that inventory updated.
2. **Preview the flows** (preview_start, then drive with preview tools):
   - `/wallet/login` → request code → (phone OTP) verify → lands on `/wallet`.
   - Signed-in `/wallet` shows all of a seeded customer's cards with correct progress; tile → `/card/[id]`.
   - `/wallet/rewards` lists an unlocked reward and links to `/reward/[id]`.
   - `/wallet/activity` shows joined/stamp/reward events newest-first.
   - `/wallet/profile` shows contact + member-since; log out → `/wallet/login`.
   - Hitting `/wallet` while logged out redirects to `/wallet/login`.
   - Bottom tab bar highlights the active tab on each route.
   - Regression: `/q/[qrId]`, `/m/[slug]`, `/card/[id]`, `/reward/[id]` still work unchanged.
   - `preview_resize` to a phone viewport (the primary target) and check dark mode.
3. Screenshot `/wallet` and `/wallet/profile` to share as proof.

Use a seeded customer from the Supabase seed data (`supabase/seed-*`) for a membership with multiple cards and at least one unlocked reward.

# Copy Inventory — Shared UI + System + Notifications

_Scope: components/{ui,forms,layout,motion,data,auth}/**; app/{offline,error.tsx,not-found.tsx,global-error.tsx,manifest.ts}; app/api/auth/hooks/{send-email,send-sms}; app/api/cron/{birthday-rewards,merchant-digest,notifications,privacy-retention}; app/api/notifications/**; lib/notifications/**_

---

## Shared UI primitives — `components/ui/**`

Most `components/ui/*` files are pure primitives/wrappers that render only `children` with no baked-in words (button, badge, card, alert, label, input, textarea, progress, separator, skeleton, table, field, empty, sonner). The only baked-in strings are accessibility labels on icon controls.

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Loading | aria-label | components/ui/spinner.tsx:22 | inline |
| Close | sr-only btn label | components/ui/sheet.tsx:80 | inline |
| Sidebar | sr-only sheet title | components/ui/sidebar.tsx:158 | inline |
| Displays the mobile sidebar. | sr-only sheet desc | components/ui/sidebar.tsx:159 | inline |
| Toggle Sidebar | sr-only btn label | components/ui/sidebar.tsx:217 | inline |
| useSidebar must be used within a SidebarProvider. | dev error (thrown) | components/ui/sidebar.tsx:46 | inline |

_Note: sonner.tsx (Toaster) carries NO default toast text — it only themes icons; all toast copy is passed by callers on other surfaces. empty/alert/field render caller-supplied children only._

## Shared forms — `components/forms/**`

No user-visible baked-in copy. `SubmitButton` renders caller-supplied `children` / `pendingLabel`; `FormField`/`FormMessage`/`SelectField` render caller-supplied labels/errors. (Doc comment references example "Saving…" but it is not rendered.)

## Auth components — `components/auth/**`

### Sign-in / sign-up form — `components/auth/auth-form.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Email | field label | components/auth/auth-form.tsx:78 | inline |
| Password | field label | components/auth/auth-form.tsx:87 | inline |
| Forgot password? | link | components/auth/auth-form.tsx:99 | inline |
| Get a fresh code | link | components/auth/auth-form.tsx:114 | inline |
| Opening… | pending btn label | components/auth/auth-form.tsx:116 | inline |
| Log in | button | components/auth/auth-form.tsx:118 | inline |
| Your name | field label | components/auth/auth-form.tsx:163 | inline |
| Password saved. Enter your email code below. | inline notice | components/auth/auth-form.tsx:179 | inline |
| At least 8 characters, with letters and numbers. | field description | components/auth/auth-form.tsx:189 | inline |
| Confirm password | field label | components/auth/auth-form.tsx:194 | inline |
| Sending… | pending btn label | components/auth/auth-form.tsx:223 | inline |
| Resend code | button | components/auth/auth-form.tsx:227 | inline |
| Create account | button | components/auth/auth-form.tsx:227 | inline |
| Email code | field label | components/auth/auth-form.tsx:247 | inline |
| Checking… | pending btn label | components/auth/auth-form.tsx:260 | inline |
| Verify email | button | components/auth/auth-form.tsx:261 | inline |
| Nabaperks | brand mark name | components/auth/auth-form.tsx:275 | inline |
| New venue | VenueMark caption (sign-up) | components/auth/auth-form.tsx:276 | inline |
| Counter | VenueMark caption (sign-in) | components/auth/auth-form.tsx:276 | inline |
| Open the till | eyebrow (sign-up) | components/auth/auth-form.tsx:278 | inline |
| Back to the counter | eyebrow (sign-in) | components/auth/auth-form.tsx:278 | inline |
| Already piloting? | switch-prompt text (sign-up) | components/auth/auth-form.tsx:286 | inline |
| New venue? | switch-prompt text (sign-in) | components/auth/auth-form.tsx:286 | inline |
| Log in | switch-prompt link (sign-up) | components/auth/auth-form.tsx:288 | inline |
| Start free pilot | switch-prompt link (sign-in) | components/auth/auth-form.tsx:288 | inline |

### Reset-password form — `components/auth/reset-password-form.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Email | field label | components/auth/reset-password-form.tsx:49 | inline |
| Sending… | pending btn label | components/auth/reset-password-form.tsx:70 | inline |
| Resend reset code | button | components/auth/reset-password-form.tsx:74 | inline |
| Send reset code | button | components/auth/reset-password-form.tsx:74 | inline |
| Reset code | field label | components/auth/reset-password-form.tsx:88 | inline |
| New password | field label | components/auth/reset-password-form.tsx:99 | inline |
| At least 8 characters, with letters and numbers. | field description | components/auth/reset-password-form.tsx:102 | inline |
| Confirm new password | field label | components/auth/reset-password-form.tsx:107 | inline |
| Saving… | pending btn label | components/auth/reset-password-form.tsx:118 | inline |
| Set new password | button | components/auth/reset-password-form.tsx:120 | inline |
| Remembered it? | text | components/auth/reset-password-form.tsx:125 | inline |
| Back to log in | link | components/auth/reset-password-form.tsx:130 | inline |

_(auth-field.tsx renders caller-supplied label/description/error only — no baked copy.)_

## Layout — marketing chrome — `components/layout/marketing-layout.tsx` + `marketing-header-nav.tsx`

### Footer & skip link — `components/layout/marketing-layout.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Pricing | default nav link | components/layout/marketing-layout.tsx:15 | inline |
| Log in | default nav link | components/layout/marketing-layout.tsx:16 | inline |
| Skip to content | skip link | components/layout/marketing-layout.tsx:42 | inline |
| © {year} · Marketing by choice | footer copyright | components/layout/marketing-layout.tsx:59 | inline |
| Loyalty for pubs | footer link | components/layout/marketing-layout.tsx:64 | inline |
| About | footer link | components/layout/marketing-layout.tsx:67 | inline |
| Pricing | footer link | components/layout/marketing-layout.tsx:70 | inline |
| Start free pilot | footer link | components/layout/marketing-layout.tsx:73 | inline |
| Terms | footer legal link | components/layout/marketing-layout.tsx:78 | inline |
| Privacy | footer legal link | components/layout/marketing-layout.tsx:81 | inline |
| Merchant links | nav aria-label | components/layout/marketing-layout.tsx:62 | inline |
| Legal links | nav aria-label | components/layout/marketing-layout.tsx:76 | inline |
| nabaperks | footer logo label | components/layout/marketing-layout.tsx:57 | inline |

### Header nav — `components/layout/marketing-header-nav.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Marketing | nav aria-label | components/layout/marketing-header-nav.tsx:33 | inline |
| Start free pilot | CTA button | components/layout/marketing-header-nav.tsx:59 | inline |
| Open menu | icon-btn aria-label | components/layout/marketing-header-nav.tsx:68 | inline |
| Menu | sheet title | components/layout/marketing-header-nav.tsx:78 | inline |

## Layout — console/app shells — `components/layout/*.tsx`

_Cross-cutting shells shared across merchant `/app` and `/admin`. Nav vocabulary sourced from `console-nav.ts`. NOTE: these overlap with the merchant-`/app` and admin agents' surfaces — flagged in Scope notes._

### Shared nav vocabulary — `components/layout/console-nav.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Dashboard | merchant nav label | components/layout/console-nav.ts:87 | inline |
| Setup | merchant nav label | components/layout/console-nav.ts:88 | inline |
| Poster | merchant nav label | components/layout/console-nav.ts:89 | inline |
| Members | merchant nav label | components/layout/console-nav.ts:91 | inline |
| Activity | merchant nav label | components/layout/console-nav.ts:99 | inline |
| Announce | merchant nav label | components/layout/console-nav.ts:102 | inline |
| Profile | merchant account label | components/layout/console-nav.ts:107 | inline |
| Billing | merchant account label | components/layout/console-nav.ts:111 | inline |
| Overview | admin nav label | components/layout/console-nav.ts:122 | inline |
| Pilot | admin nav label | components/layout/console-nav.ts:123 | inline |
| Merchants | admin nav label | components/layout/console-nav.ts:124 | inline |
| Customers | admin nav label | components/layout/console-nav.ts:125 | inline |
| Billing | admin nav label | components/layout/console-nav.ts:126 | inline |
| Privacy | admin nav label | components/layout/console-nav.ts:127 | inline |
| Fraud | admin nav label | components/layout/console-nav.ts:128 | inline |
| Audit | admin nav label | components/layout/console-nav.ts:129 | inline |

### Merchant app shell — `components/layout/merchant-app-shell.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Dashboard | setup-header button | components/layout/merchant-app-shell.tsx:74 | inline |
| Account profile | icon-btn aria-label/title | components/layout/merchant-app-shell.tsx:81-82 | inline |
| Log out | btn aria-label/title (setup) | components/layout/merchant-app-shell.tsx:93-94 | inline |
| Log out | btn text (setup, ≥sm) | components/layout/merchant-app-shell.tsx:97 | inline |
| Toggle navigation | sidebar-trigger aria-label/title | components/layout/merchant-app-shell.tsx:129-130 | inline |
| Merchant navigation | nav aria-label | components/layout/merchant-app-shell.tsx:137 | shared:console-sidebar-nav (prop) |
| Account | secondary nav label | components/layout/merchant-app-shell.tsx:140 | inline |
| Log out | sidebar footer button | components/layout/merchant-app-shell.tsx:153 | inline |
| Open menu | mobile trigger aria-label | components/layout/merchant-app-shell.tsx:162 | inline |

### Admin shell — `components/layout/admin-shell.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Service-role readbacks | footer status tag | components/layout/admin-shell.tsx:19 | inline |
| Audited support actions | footer status tag | components/layout/admin-shell.tsx:20 | inline |
| MFA-aware access | footer status tag | components/layout/admin-shell.tsx:21 | inline |
| Nabaperks Admin | logo label | components/layout/admin-shell.tsx:42 | inline |
| Admin navigation | nav aria-label | components/layout/admin-shell.tsx:46 | shared:console-sidebar-nav (prop) |
| Operator: {operatorEmail} | footer tag + title | components/layout/admin-shell.tsx:56-58 | inline |
| AAL2 verified | footer tag / title (mfa) | components/layout/admin-shell.tsx:73,77 | inline |
| Admin verified | footer tag / title (no-mfa) | components/layout/admin-shell.tsx:73,77 | inline |
| MFA enforcement is enabled for this admin session. | status banner | components/layout/admin-shell.tsx:99 | inline |

### Customer app shell + tab bar — `components/layout/customer-app-shell.tsx`, `customer-tab-bar.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Log out | header button | components/layout/customer-app-shell.tsx:24 | inline |
| Home | tab label | components/layout/customer-tab-bar.tsx:23 | inline |
| Rewards | tab label | components/layout/customer-tab-bar.tsx:24 | inline |
| Scan | tab label | components/layout/customer-tab-bar.tsx:25 | inline |
| Activity | tab label | components/layout/customer-tab-bar.tsx:26 | inline |
| Profile | tab label | components/layout/customer-tab-bar.tsx:27 | inline |
| Home navigation | nav aria-label | components/layout/customer-tab-bar.tsx:51 | inline |

### Console sidebar nav — `components/layout/console-sidebar-nav.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Account | default secondaryLabel | components/layout/console-sidebar-nav.tsx:35 | inline (default param) |

_(section.tsx, contrast-band.tsx, customer-shell.tsx render children only — no baked copy.)_

## Motion — `components/motion/**`

No user-facing copy. All primitives (wet-ink.tsx, stamp-celebration.tsx, motion-provider.tsx) render caller-supplied `children` only; icons are `aria-hidden`.

## Data components — `components/data/**`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Pilot funnel | default aria-label | components/data/funnel-chart.tsx:19 | inline (default param) |
| No data recorded yet. | sr-only chart summary | components/data/trend-chart.tsx:89 | inline |
| Latest: {summary}. | sr-only chart summary | components/data/trend-chart.tsx:89 | inline |
| Nothing to chart yet | empty-plot note | components/data/trend-chart.tsx:167 | inline |
| Trend chart: {labels} | svg aria-label (fallback) | components/data/trend-chart.tsx:103 | inline |
| Trend chart | svg aria-label (no series) | components/data/trend-chart.tsx:104 | inline |

_(activity-feed.tsx, data-table.tsx, sparkline.tsx, stat-strip.tsx render caller props/children only; date formatting is Intl, not copy.)_

---

## System page — Offline — `app/offline/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Offline | metadata title | app/offline/page.tsx:15 | inline |
| You're offline | h1 / EmptyState title | app/offline/page.tsx:26 | inline (prop to shared:EmptyState) |
| Your cards and stamps live safely with us. Reconnect and they will be right here. | EmptyState description | app/offline/page.tsx:27 | inline (prop to shared:EmptyState) |
| Try again | button | app/offline/page.tsx:36 | inline |
| Open my cards | button | app/offline/page.tsx:38 | inline |

_(auto-reload.tsx renders nothing — no copy.)_

## System page — Root error boundary — `app/error.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Something went wrong | CustomerErrorState title | app/error.tsx:22 | inline (prop to shared:CustomerErrorState) |
| This page hit a snag on our side. Nothing you saved has been lost. | CustomerErrorState desc | app/error.tsx:23 | inline (prop to shared:CustomerErrorState) |
| Nabaperks home | secondary action label | app/error.tsx:25 | inline (prop) |

## System page — Not found (404) — `app/not-found.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Page not found | metadata title | app/not-found.tsx:8 | inline |
| Page not found | EmptyState title / h1 | app/not-found.tsx:21 | inline (prop to shared:EmptyState) |
| That link has gone cold. Everything else is where you left it. | EmptyState description | app/not-found.tsx:22 | inline (prop to shared:EmptyState) |
| Nabaperks home | button | app/not-found.tsx:25 | inline |
| Open my cards | button | app/not-found.tsx:28 | inline |

## System page — Global error boundary — `app/global-error.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Something went wrong | h1 | app/global-error.tsx:22 | inline |
| Nabaperks hit a snag loading this page. Nothing you saved has been lost. | body | app/global-error.tsx:23-25 | inline |
| Try again | button | app/global-error.tsx:33 | inline |

## PWA manifest — `app/manifest.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Nabaperks | app name | app/manifest.ts:9 | inline |
| Nabaperks | short_name | app/manifest.ts:10 | inline |
| No-app digital loyalty cards and merchant tools for UK pubs, cafes and takeaways. | description | app/manifest.ts:11-12 | inline |
| My Nabaperks | shortcut name | app/manifest.ts:45 | inline |
| Home | shortcut short_name | app/manifest.ts:46 | inline |
| Open saved loyalty cards and rewards. | shortcut description | app/manifest.ts:47 | inline |
| Scan venue QR | shortcut name | app/manifest.ts:53 | inline |
| Scan | shortcut short_name | app/manifest.ts:54 | inline |
| Scan a Nabaperks venue QR code. | shortcut description | app/manifest.ts:55 | inline |

---

## Server email — OTP codes — `lib/notifications/resend.ts`

Three audiences: `customer`, `merchant-verify`, `merchant-reset`. Each has eyebrow/title/intro/footer/subjectSuffix/textReason. Subject = `` `${code} ${subjectSuffix}` ``. Text body = `` `Your Nabaperks verification code is ${code}. Enter it to ${textReason}. It expires shortly. ${footer}` ``.

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| My Nabaperks | email eyebrow (customer) | lib/notifications/resend.ts:32 | inline |
| Your verification code | email title (customer) | lib/notifications/resend.ts:33 | inline |
| Enter this code to open your cards. It expires shortly. | email intro (customer) | lib/notifications/resend.ts:34 | inline |
| If you didn't request this, you can safely ignore this email. | email footer (customer) | lib/notifications/resend.ts:35 | inline |
| is your Nabaperks code | subject suffix (customer) | lib/notifications/resend.ts:36 | inline |
| open your Nabaperks cards | text reason (customer) | lib/notifications/resend.ts:37 | inline |
| Nabaperks merchant | email eyebrow (verify) | lib/notifications/resend.ts:40 | inline |
| Verify your venue email | email title (verify) | lib/notifications/resend.ts:41 | inline |
| Enter this code on Nabaperks to confirm your email and finish creating your venue account. | email intro (verify) | lib/notifications/resend.ts:42-43 | inline |
| If you did not start a Nabaperks venue signup, you can ignore this email. | email footer (verify) | lib/notifications/resend.ts:44-45 | inline |
| is your Nabaperks verification code | subject suffix (verify) | lib/notifications/resend.ts:46 | inline |
| confirm your Nabaperks venue email | text reason (verify) | lib/notifications/resend.ts:47 | inline |
| Nabaperks merchant | email eyebrow (reset) | lib/notifications/resend.ts:50 | inline |
| Reset your password | email title (reset) | lib/notifications/resend.ts:51 | inline |
| Enter this code on Nabaperks to set a new venue console password. | email intro (reset) | lib/notifications/resend.ts:52 | inline |
| If you did not ask to reset your password, you can ignore this email and your password stays the same. | email footer (reset) | lib/notifications/resend.ts:53-54 | inline |
| is your Nabaperks password reset code | subject suffix (reset) | lib/notifications/resend.ts:55 | inline |
| reset your Nabaperks password | text reason (reset) | lib/notifications/resend.ts:56 | inline |
| Your Nabaperks verification code is {code}. Enter it to {textReason}. It expires shortly. {footer} | email text body (all) | lib/notifications/resend.ts:106 | inline (composed) |

## Server SMS — OTP code — `lib/notifications/twilio.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Your Nabaperks verification code is {code} | SMS body | lib/notifications/twilio.ts:36 | inline |

## Push notifications catalog — `lib/notifications/catalog.ts`

All push title/body pairs keyed by event type. `{businessName}` defaults to "Your venue", `{rewardName}` to "your reward".

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Notifications | push-title (prompt_viewed) | lib/notifications/catalog.ts:103 | inline |
| Notification preference opened. | push-body (prompt_viewed) | lib/notifications/catalog.ts:104 | inline |
| Notifications enabled | push-title (permission_granted) | lib/notifications/catalog.ts:107 | inline |
| Reward and stamp reminders can now reach this browser. | push-body (permission_granted) | lib/notifications/catalog.ts:108 | inline |
| Browser subscribed | push-title (subscription_created) | lib/notifications/catalog.ts:111 | inline |
| This browser can receive loyalty updates. | push-body (subscription_created) | lib/notifications/catalog.ts:112 | inline |
| Notifications off | push-title (subscription_disabled) | lib/notifications/catalog.ts:115 | inline |
| This browser will stop receiving loyalty updates. | push-body (subscription_disabled) | lib/notifications/catalog.ts:116 | inline |
| Notifications unavailable | push-title (subscription_failed) | lib/notifications/catalog.ts:119 | inline |
| This browser could not keep its push subscription active. | push-body (subscription_failed) | lib/notifications/catalog.ts:120 | inline |
| One stamp away | push-title (one_stamp_away) | lib/notifications/catalog.ts:123 | inline |
| {businessName} has a reward nearly ready. | push-body (one_stamp_away) | lib/notifications/catalog.ts:124 | inline |
| Next stamp available | push-title (next_stamp_available) | lib/notifications/catalog.ts:127 | inline |
| {businessName} can stamp your card again today. | push-body (next_stamp_available) | lib/notifications/catalog.ts:128 | inline |
| Reward unlocked | push-title (reward_unlocked_waiting) | lib/notifications/catalog.ts:131 | inline |
| {rewardName} is waiting for the next eligible collection day. | push-body (reward_unlocked_waiting) | lib/notifications/catalog.ts:132 | inline |
| Reward ready | push-title (reward_ready) | lib/notifications/catalog.ts:135 | inline |
| {rewardName} is ready to collect at {businessName}. | push-body (reward_ready) | lib/notifications/catalog.ts:136 | inline |
| Finish your details | push-title (profile_required_to_collect) | lib/notifications/catalog.ts:139 | inline |
| Complete your profile before collecting {rewardName}. | push-body (profile_required_to_collect) | lib/notifications/catalog.ts:140 | inline |
| Reward expiring soon | push-title (reward_expiring_soon) | lib/notifications/catalog.ts:143 | inline |
| {rewardName} is close to its expiry time. | push-body (reward_expiring_soon) | lib/notifications/catalog.ts:144 | inline |
| Reward expired | push-title (reward_expired) | lib/notifications/catalog.ts:147 | inline |
| {rewardName} can no longer be collected. | push-body (reward_expired) | lib/notifications/catalog.ts:148 | inline |
| Reward collected | push-title (reward_collected_cycle_started) | lib/notifications/catalog.ts:151 | inline |
| A new {businessName} stamp cycle has started. | push-body (reward_collected_cycle_started) | lib/notifications/catalog.ts:152 | inline |
| Stamp card waiting | push-title (dormant_progress) | lib/notifications/catalog.ts:155 | inline |
| {businessName} still has progress on your card. | push-body (dormant_progress) | lib/notifications/catalog.ts:156 | inline |
| {businessName} has an update. | push-body fallback (venue_announcement) | lib/notifications/catalog.ts:160 | inline |
| Birthday treat | push-title (birthday_reward_issued) | lib/notifications/catalog.ts:163 | inline |
| {rewardName} is waiting at {businessName}. | push-body (birthday_reward_issued) | lib/notifications/catalog.ts:164 | inline |
| A reward for you | push-title (merchant_reward_received) | lib/notifications/catalog.ts:167 | inline |
| {businessName} sent you {rewardName}. | push-body (merchant_reward_received) | lib/notifications/catalog.ts:168 | inline |
| Your venue | businessName default fallback | lib/notifications/catalog.ts:187 | inline |
| your reward | rewardName default fallback | lib/notifications/catalog.ts:188 | inline |

_(venue_announcement title defaults to announcementTitle || businessName; body to announcementBody || the fallback above — merchant supplies the announcement text at send time.)_
_"Your venue" / "your reward" fallbacks are duplicated in lib/notifications/events.ts:379,443,444 and delivery-worker.ts:897 — see Scope notes._

## Server email — Reward invite — `lib/notifications/reward-invite-email.ts`

`{business}` defaults to "A local venue", `{reward}` to "a reward".

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| A local venue | business default fallback | lib/notifications/reward-invite-email.ts:38 | inline |
| a reward | reward default fallback | lib/notifications/reward-invite-email.ts:39 | inline |
| A reward is waiting for you at {business} | email subject | lib/notifications/reward-invite-email.ts:42 | inline |
| You're getting this one-off email because {business} entered your address to send you a reward. We won't email you again about it. | reason line (PECR) | lib/notifications/reward-invite-email.ts:43 | inline |
| {business} has sent you a reward: {reward}. | email text body line | lib/notifications/reward-invite-email.ts:46 | inline |
| Claim it: {claimUrl} | email text body line | lib/notifications/reward-invite-email.ts:48 | inline |
| Unsubscribe: {unsubscribeUrl} | email text body line | lib/notifications/reward-invite-email.ts:51 | inline |
| A reward is waiting for you | email h1 (html) | lib/notifications/reward-invite-email.ts:66 | inline |
| {business} has sent you {reward}. | email html body | lib/notifications/reward-invite-email.ts:67 | inline |
| Claim your reward | email html CTA button | lib/notifications/reward-invite-email.ts:69 | inline |
| Unsubscribe | email html link | lib/notifications/reward-invite-email.ts:70 | inline |

## Server email — Merchant weekly digest — `lib/notifications/merchant-digest-email.ts`

Subject = `` `Your week at ${businessName}` ``.

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Reply to this email if you'd rather not receive weekly summaries. | opt-out line | lib/notifications/merchant-digest-email.ts:31-32 | inline |
| Members | metric row label | lib/notifications/merchant-digest-email.ts:40 | inline |
| New members | metric row label | lib/notifications/merchant-digest-email.ts:43 | inline |
| Stamps issued | metric row label | lib/notifications/merchant-digest-email.ts:48 | inline |
| Repeat customers | metric row label | lib/notifications/merchant-digest-email.ts:51 | inline |
| Rewards redeemed | metric row label | lib/notifications/merchant-digest-email.ts:53 | inline |
| QR downloads | metric row label | lib/notifications/merchant-digest-email.ts:58 | inline |
| Your week at {businessName} | email subject / h1 | lib/notifications/merchant-digest-email.ts:63,84 | inline |
| Here is the short version from your Nabaperks dashboard. | email intro | lib/notifications/merchant-digest-email.ts:67,85 | inline |
| Nabaperks weekly digest | email eyebrow (html) | lib/notifications/merchant-digest-email.ts:83 | inline |

## Venue-announcement form errors — `lib/notifications/venue-announcement-form-copy.ts`

Merchant-facing validation/error copy for the announcement composer (title + body + tone).

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Daily limit reached | error title (rate_limited) | lib/notifications/venue-announcement-form-copy.ts:11 | inline |
| Announcements can go out up to 2 a day. Try again tomorrow. | error body (rate_limited) | lib/notifications/venue-announcement-form-copy.ts:12 | inline |
| Add a clearer title | error title (invalid_title) | lib/notifications/venue-announcement-form-copy.ts:16 | inline |
| Use a title of at least 3 characters. | error body (invalid_title) | lib/notifications/venue-announcement-form-copy.ts:17 | inline |
| Add a fuller message | error title (invalid_body) | lib/notifications/venue-announcement-form-copy.ts:21 | inline |
| Use a message of at least 10 characters. | error body (invalid_body) | lib/notifications/venue-announcement-form-copy.ts:22 | inline |
| Check the wording | error title (moderation_rejected) | lib/notifications/venue-announcement-form-copy.ts:26 | inline |
| Keep it to a plain venue update without links, phone numbers, payment wording, or claims. | error body (moderation_rejected) | lib/notifications/venue-announcement-form-copy.ts:27 | inline |
| Sign in again | error title (unauthenticated) | lib/notifications/venue-announcement-form-copy.ts:31 | inline |
| Sign in again before sending this announcement. | error body (unauthenticated) | lib/notifications/venue-announcement-form-copy.ts:32 | inline |
| Announcement not sent | default error title | lib/notifications/venue-announcement-form-copy.ts:38 | inline |
| We could not send this announcement. Try again in a moment. | default error body | lib/notifications/venue-announcement-form-copy.ts:39 | inline |

## Server API — hook & route error responses (JSON, not UI prose)

These are `{ error: {...} }` HTTP responses to server-to-server callers (Supabase auth hooks) — surfaced in logs/Supabase, not rendered as end-user UI. Listed for completeness.

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Email hook is not configured. | hook error msg | app/api/auth/hooks/send-email/route.ts:33 | inline |
| Invalid signature. | hook error msg | app/api/auth/hooks/send-email/route.ts:45 | inline |
| Malformed payload. | hook error msg | app/api/auth/hooks/send-email/route.ts:56,61 | inline |
| Missing recipient email or code. | hook error msg | app/api/auth/hooks/send-email/route.ts:67 | inline |
| Email could not be sent. | hook error msg | app/api/auth/hooks/send-email/route.ts:86 | inline |
| SMS hook is not configured. | hook error msg | app/api/auth/hooks/send-sms/route.ts:29 | inline |
| Invalid signature. | hook error msg | app/api/auth/hooks/send-sms/route.ts:41 | inline |
| Malformed payload. | hook error msg | app/api/auth/hooks/send-sms/route.ts:52,57 | inline |
| Missing recipient phone or code. | hook error msg | app/api/auth/hooks/send-sms/route.ts:63 | inline |
| SMS could not be sent. | hook error msg | app/api/auth/hooks/send-sms/route.ts:69 | inline |

_Cron + notification API routes (birthday-rewards, merchant-digest, notifications, privacy-retention, notifications/venue-announcements, notifications/readback, push/**) return only machine error codes ("unauthorized", "unauthenticated", "rate_limited", "purge_failed", validated.error passthrough) — no user-facing prose._

---

## Micro-labels (generic, recurring)
| Label | ~count |
|---|---|
| Log out | 4 (customer-app-shell, merchant-app-shell ×3 incl. setup aria/text/footer) |
| Log in | 3 (auth-form switch prompt, marketing-layout default nav) |
| Start free pilot | 3 (marketing-header-nav CTA, marketing-layout footer, auth-form switch prompt) |
| Pricing | 2 (marketing-layout default nav + footer) |
| Try again | 2 (offline page, global-error) |
| Open my cards | 2 (offline page, not-found) |
| Nabaperks home | 2 (error.tsx, not-found) |
| Something went wrong | 2 (error.tsx, global-error) |
| Sending… | 2 (auth-form, reset-password-form) |
| Saving… | 1 rendered (reset-password-form) + doc-comment example in submit-button.tsx |
| At least 8 characters, with letters and numbers. | 2 (auth-form, reset-password-form) |
| Email | 3 (auth-form ×2, reset-password-form) |
| Password / New password / Confirm password / Confirm new password | 4 distinct labels across auth forms |
| Open menu | 2 (marketing-header-nav, merchant-app-shell mobile) |
| Close / Sidebar / Toggle Sidebar / Toggle navigation | sr-only control labels (ui + shells) |
| Account | 2 (console-sidebar-nav default + merchant-app-shell secondaryLabel) |
| Billing | 2 (merchant account nav + admin nav) |
| Customers | 1 (admin nav; also "Members" on merchant side) |
| Activity | 2 (merchant nav + customer tab bar) |
| Profile | 2 (merchant account nav + customer tab bar) |
| Loading | 1 (spinner aria-label) |

## Scope notes / surprises

- **Cross-surface duplication (biggest signal):** the notification fallbacks **"Your venue"** and **"your reward"** are hardcoded in THREE files — `catalog.ts:187-188` (canonical), `events.ts:379,443,444`, and `delivery-worker.ts:897`. Any consistency pass should treat catalog.ts as source of truth.
- **"At least 8 characters, with letters and numbers."** is duplicated verbatim in `auth-form.tsx:189` and `reset-password-form.tsx:102` — candidate for a shared constant.
- **"Start free pilot"** appears in 3 places (header CTA, footer link, sign-in switch prompt); **"Log out"** in 4 (across two shells). These are intentional per-surface CTAs but worth cross-checking casing.
- **Shell-ownership overlap:** `merchant-app-shell.tsx`, `admin-shell.tsx`, `customer-*-shell.tsx`, `customer-tab-bar.tsx`, and `console-nav.ts` live under `components/layout/**` (my slice = shared UI) but their nav vocabulary ("Dashboard/Setup/Poster/Members/Announce", admin "Pilot/Fraud/Audit", customer "Home/Rewards/Scan") is also the merchant-`/app` and admin agents' surface. Captured here as shared chrome; flag for de-dup with those agents' inventories.
- **Brand-component copy is inline-at-call-site:** system pages (`offline`, `error.tsx`, `not-found.tsx`) pass all their copy as props into shared `EmptyState` / `CustomerErrorState` components in `components/brand/**` (out of slice). The strings themselves are inline in the system-page files, so they are captured; the brand wrapper carries no baked default.
- **"Marketing by choice"** footer tagline (`marketing-layout.tsx:59`) reads as an intentional slogan, not placeholder.
- **No placeholder / lorem / TODO copy found** anywhere in scope. No "test"/dummy strings.
- **Internal/operator vocabulary (not customer-facing):** admin-shell footer tags — "Service-role readbacks", "Audited support actions", "MFA-aware access", "AAL2 verified", "Operator: …". These are operator-console labels.
- **Empty-state / chart copy:** `trend-chart.tsx` carries two visible empty-state phrasings — "Nothing to chart yet" (visible plot note) and "No data recorded yet." (sr-only). Slightly divergent wording for the same "no data" concept within one file.
- **API error strings vs UI copy:** the send-email/send-sms hooks return human-readable error prose ("Invalid signature.", "Malformed payload.", "Email could not be sent."), but they go to Supabase's hook caller, not a browser. Cron/push routes use terse machine codes only. Listed but categorized separately from display copy.
- **Dev harness (`app/dev/**`):** excluded per instructions; spot-checked — push API routes under `app/api/notifications/push/**` contain zero user-facing string literals (all machine codes), so no harness-vs-real-component copy divergence to flag there.
- **`lib/email/**` does not exist** — all email copy lives under `lib/notifications/` (resend.ts, reward-invite-email.ts, merchant-digest-email.ts).

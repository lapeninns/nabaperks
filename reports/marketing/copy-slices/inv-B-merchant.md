# Copy Inventory — Merchant Dashboard (/app)

_Scope: app/app/**, app/(auth)/**, components/merchant/**, lib/merchant/* copy modules, lib/notifications/venue-announcement-form-copy.ts_

## Merchant Auth — Login — `app/(auth)/login/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| QR kit, stamps, and rewards in one console | list item | app/(auth)/login/page.tsx:16 | inline |
| Pick up onboarding where you left off | list item | app/(auth)/login/page.tsx:17 | inline |
| Billing when you activate your live venue QR | list item | app/(auth)/login/page.tsx:18 | inline |
| Email code could not be used | error title | app/(auth)/login/page.tsx:29 | inline |
| Request a fresh code. Provider details are hidden for safety. | error body | app/(auth)/login/page.tsx:30 | inline |
| Sign-in problem | error title (fallback) | app/(auth)/login/page.tsx:35 | inline |
| Something went wrong on the way in. Try again, or reset your password if it keeps happening. | error body (fallback) | app/(auth)/login/page.tsx:36 | inline |
| Merchant access | eyebrow | app/(auth)/login/page.tsx:64 | inline |
| Welcome back to your loyalty counter. | page title | app/(auth)/login/page.tsx:65 | inline |
| Log in to continue venue setup, download your QR kit, manage checks, and review loyalty activity. | description | app/(auth)/login/page.tsx:66 | inline |
| Merchant console | eyebrow | app/(auth)/login/page.tsx:91 | inline |
| Back to the counter | heading | app/(auth)/login/page.tsx:93 | inline |
| Enter your venue email and password to open the console. | body | app/(auth)/login/page.tsx:96 | inline |

## Merchant Auth — Sign up — `app/(auth)/signup/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| No app for your customers to download | list item | app/(auth)/signup/page.tsx:16 | inline |
| Customers stamp themselves from your venue QR | list item | app/(auth)/signup/page.tsx:17 | inline |
| Card required — cancel anytime. | list item | app/(auth)/signup/page.tsx:18 | inline |
| Start free pilot | eyebrow | app/(auth)/signup/page.tsx:41 | inline |
| Your first stamp is waiting. | page title | app/(auth)/signup/page.tsx:42 | inline |
| Set up your venue QR loyalty card in about five minutes. Create your account, verify your email with a {otpCodeLabel} code, then add your venue, rewards, and printed kit. | description (interpolated) | app/(auth)/signup/page.tsx:43 | inline |
| 30 days free | eyebrow | app/(auth)/signup/page.tsx:68 | inline |
| Open your till | heading | app/(auth)/signup/page.tsx:69 | inline |
| Create your account and verify your email with a {otpCodeLabel} code. Card required — cancel anytime. | body (interpolated) | app/(auth)/signup/page.tsx:73 | inline |

## Merchant Auth — Reset password — `app/(auth)/reset-password/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Reset takes about a minute | list item | app/(auth)/reset-password/page.tsx:15 | inline |
| We email a {otpCodeLabel} code to confirm it is you | list item (interpolated) | app/(auth)/reset-password/page.tsx:16 | inline |
| Your venue setup and loyalty data stay exactly as they were | list item | app/(auth)/reset-password/page.tsx:17 | inline |
| Merchant access | eyebrow | app/(auth)/reset-password/page.tsx:31 | inline |
| Reset your console password. | page title | app/(auth)/reset-password/page.tsx:32 | inline |
| Enter your venue email and we will send a {otpCodeLabel} code. Use it to set a new password and get back to your counter. | description (interpolated) | app/(auth)/reset-password/page.tsx:33 | inline |
| Merchant console | eyebrow | app/(auth)/reset-password/page.tsx:58 | inline |
| Reset password | heading | app/(auth)/reset-password/page.tsx:60 | inline |
| Enter your venue email. We will send a {otpCodeLabel} reset code. | body (interpolated) | app/(auth)/reset-password/page.tsx:63 | inline |

## Merchant Auth — Server actions — `app/(auth)/actions.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Use at least 8 characters. | validation (password) | app/(auth)/actions.ts:64 | inline |
| Use a mix of letters and numbers. | validation (password) | app/(auth)/actions.ts:66 | inline |
| Enter a valid email address. | validation (email) | app/(auth)/actions.ts:85,123,183,277 | inline |
| Could not send another code just now. Wait a moment and try again. | error (form) | app/(auth)/actions.ts:108 | inline |
| We sent another {digitLabel} code. Enter it below. | success message (interpolated) | app/(auth)/actions.ts:115 | inline |
| Enter your name. | validation (name) | app/(auth)/actions.ts:122 | inline |
| Passwords do not match. | validation (confirmPassword) | app/(auth)/actions.ts:127,315 | inline |
| Could not create the account just now. Check your details and try again. | error (form) | app/(auth)/actions.ts:152 | inline |
| That email already has a venue account. Log in or reset your password instead. | error (form) | app/(auth)/actions.ts:163 | inline |
| We sent a {digitLabel} code. Enter it below to verify your email. | success message (interpolated) | app/(auth)/actions.ts:170 | inline |
| Enter your password. | validation (password) | app/(auth)/actions.ts:184 | inline |
| Verify your email first — get a fresh code and finish verification. | error (form) | app/(auth)/actions.ts:204 | inline |
| That email or password is not right. | error (form) | app/(auth)/actions.ts:211 | inline |
| Request a fresh email code. | error (form) | app/(auth)/actions.ts:229 | inline |
| Enter the {digitLabel} code from your email. | validation (otp, interpolated) | app/(auth)/actions.ts:231,310 | inline |
| That code was not accepted. Check it and try again. | error (form) | app/(auth)/actions.ts:250,263,334,347 | inline |
| Request a fresh reset code. | error (form) | app/(auth)/actions.ts:308 | inline |
| Could not set that password. Try again. | error (form) | app/(auth)/actions.ts:356 | inline |
| If that email has a venue account, we sent a {digitLabel} reset code. | success message (interpolated) | app/(auth)/actions.ts:293 | inline |
| Too many sign-up attempts. Try again later. | rate-limit error | app/(auth)/actions.ts:399 | inline |
| Too many sign-in attempts. Try again later. | rate-limit error | app/(auth)/actions.ts:401 | inline |
| Too many code checks. Try again later. | rate-limit error | app/(auth)/actions.ts:403 | inline |
| Too many reset attempts. Try again later. | rate-limit error | app/(auth)/actions.ts:405 | inline |

## /app root dashboard — `app/app/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Your venue | eyebrow | app/app/page.tsx:52 | inline |
| {merchant.business_name} | page title (dynamic) | app/app/page.tsx:53 | inline (data) |
| A quick read on how your loyalty card is doing: members, repeat visits, and rewards. | description | app/app/page.tsx:54 | inline |
| Announce | button | app/app/page.tsx:60 | inline |
| Scan reward | button | app/app/page.tsx:66 | inline |
| your venue QR | error-boundary label (aria/fallback context) | app/app/page.tsx:77 | inline |
| your dashboard numbers | error-boundary label | app/app/page.tsx:86 | inline |
| recent activity | error-boundary label | app/app/page.tsx:92 | inline |

## /app layout / loading / error / not-found
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Loading merchant workspace | aria-label (loading) | app/app/loading.tsx:11 | inline |
| That didn't load | empty-state title (error) | app/app/error.tsx:22 | inline |
| Something interrupted your workspace. Try again. Your card, members, and rewards are safe on the server. | empty-state description | app/app/error.tsx:23 | inline |
| Try again | button | app/app/error.tsx:26 | inline |
| Page not found | empty-state title (404) | app/app/not-found.tsx:18 | inline |
| That page does not exist or has moved. Your card, members, and rewards are safe — head back to the dashboard. | empty-state description | app/app/not-found.tsx:19 | inline |
| Back to dashboard | button | app/app/not-found.tsx:23 | inline |
| (route metadata title/desc/OG) | metadata | app/app/layout.tsx:12 | shared:metadata (PRIVATE_ROUTE_METADATA) |

## Account hub — `app/app/account/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Profile | tab heading title | app/app/account/page.tsx:21 | inline |
| Your business and venue details. Save when you're done. | tab heading description | app/app/account/page.tsx:22 | inline |
| Billing | tab heading title | app/app/account/page.tsx:25 | inline |
| Your plan and payments, handled securely by Stripe. | tab heading description | app/app/account/page.tsx:26 | inline |

## Activity — `app/app/activity/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Activity | eyebrow + title | app/app/activity/page.tsx:47,48 | inline |
| Everything happening on your loyalty card: joins, stamps, rewards, and QR downloads. | description | app/app/activity/page.tsx:49 | inline |
| No activity yet | empty-state title | app/app/activity/page.tsx:100 | inline |
| Activity will appear after members join, add stamps, redeem rewards, or download QR assets. | empty-state description | app/app/activity/page.tsx:101 | inline |
| Open your Poster kit | button | app/app/activity/page.tsx:107 | inline |

## Announcements — `app/app/announcements/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Announce | eyebrow | app/app/announcements/page.tsx:30 | inline |
| Message your regulars | title | app/app/announcements/page.tsx:31 | inline |
| Send short venue updates to members who allowed push notifications for your loyalty card. | description | app/app/announcements/page.tsx:32 | inline |
| Announcement composer | aria-label (section) | app/app/announcements/page.tsx:39 | inline |

## Billing (redirect shell) — `app/app/billing/page.tsx` + `actions.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Billing action could not be completed. Try again. | error (thrown) | app/app/billing/actions.ts:10 | inline |

## Card actions — `app/app/card/actions.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Mystery card could not be saved. Check your details and try again. | error (form) | app/app/card/actions.ts:18 | inline |
| Reward could not be saved. Check your details and try again. | error (form) | app/app/card/actions.ts:20 | inline |
| Unable to update reward | error | app/app/card/actions.ts:21 | inline |
| Keep at least 3 active rewards before launch QR stays live. | error | app/app/card/actions.ts:23 | inline |
| Complete merchant onboarding before saving a card. | error (form) | app/app/card/actions.ts:100 | inline |
| Enter a card name. | validation | app/app/card/actions.ts:119 | inline |
| Use 80 characters or fewer. | validation | app/app/card/actions.ts:120 | inline |
| Enter a whole number of stamps. | validation | app/app/card/actions.ts:123 | inline |
| Use at least {DEFAULT_STAMPS_REQUIRED} visits. | validation (interpolated) | app/app/card/actions.ts:125 | inline |
| Use {MAX_STAMPS_REQUIRED} visits or fewer. | validation (interpolated) | app/app/card/actions.ts:127 | inline |
| Enter clear mystery reward terms. | validation | app/app/card/actions.ts:131 | inline |
| Add enough detail for members to understand the offer. | validation | app/app/card/actions.ts:133,220,339 | inline |
| Use 500 characters or fewer. | validation | app/app/card/actions.ts:135,222,341 | inline |
| Surprise reward | reward name (RPC param, stored copy) | app/app/card/actions.ts:149 | inline |
| Complete merchant onboarding before saving rewards. | error (form) | app/app/card/actions.ts:199 | inline |
| Save the mystery card before adding rewards. | validation | app/app/card/actions.ts:209 | inline |
| Enter the reward name. | validation | app/app/card/actions.ts:212 | inline |
| Use 100 characters or fewer. | validation | app/app/card/actions.ts:214,333 | inline |
| Enter clear customer-facing reward terms. | validation | app/app/card/actions.ts:218 | inline |
| Enter a whole-number weight. | validation | app/app/card/actions.ts:227 | inline |
| Use a weight of at least 1. | validation | app/app/card/actions.ts:229 | inline |
| Use a weight of 1,000 or less. | validation | app/app/card/actions.ts:231 | inline |
| Enter a whole-number display order. | validation | app/app/card/actions.ts:235 | inline |
| Birthday reward could not be saved. Check your details and try again. | error (form) | app/app/card/actions.ts:301 | inline |
| Complete merchant onboarding before saving a birthday reward. | error (form) | app/app/card/actions.ts:312 | inline |
| Save your mystery card before setting up a birthday reward. | validation (form) | app/app/card/actions.ts:325 | inline |
| Enter the birthday reward name. | validation | app/app/card/actions.ts:331 | inline |
| Enter clear birthday reward terms. | validation | app/app/card/actions.ts:337 | inline |
| Complete merchant onboarding before updating rewards. | error | app/app/card/actions.ts:379 | inline |

## Customers (members list) — `app/app/customers/page.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Members | eyebrow | app/app/customers/page.tsx:55 | inline |
| Loyalty members | title | app/app/customers/page.tsx:56 | inline |
| Stamp progress and reward status for everyone who has joined your card. | description | app/app/customers/page.tsx:57 | inline |
| Send a reward | button (link) | app/app/customers/page.tsx:60 | inline |
| No members yet | empty-state title | app/app/customers/page.tsx:114 | inline |
| Members will appear here after they join via the venue QR. | empty-state description | app/app/customers/page.tsx:115 | inline |
| Open your Poster kit | button | app/app/customers/page.tsx:121 | inline |

## Send a reward — `app/app/customers/send-reward/page.tsx` + `actions.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Members | eyebrow | app/app/customers/send-reward/page.tsx:43 | inline |
| Send a reward | title | app/app/customers/send-reward/page.tsx:44 | inline |
| Give a member a reward outside the stamp card. It redeems like any other reward, and you choose when it expires. | description | app/app/customers/send-reward/page.tsx:45 | inline |
| Back to members | button | app/app/customers/send-reward/page.tsx:49 | inline |
| Recently sent | section heading | app/app/customers/send-reward/page.tsx:60 | inline |
|  · Invite | list row suffix (kind === "invite") | app/app/customers/send-reward/page.tsx:82 | inline |
| You've already sent this member a reward today. | error | app/app/customers/send-reward/actions.ts:49 | inline |
| You've reached today's sent-reward limit. Try again tomorrow. | error | app/app/customers/send-reward/actions.ts:52 | inline |
| Reward could not be sent. Check the details and try again. | error | app/app/customers/send-reward/actions.ts:54 | inline |
| A local venue | fallback business name (email) | app/app/customers/send-reward/actions.ts:195 | inline |
| Complete merchant onboarding before sending rewards. | error (form) | app/app/customers/send-reward/actions.ts:237 | inline |
| You've sent the maximum rewards for today. Try again tomorrow. | error (form, rate limit) | app/app/customers/send-reward/actions.ts:267 | inline |

## Launch hub — `app/app/launch/page.tsx` + `actions.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| You're live | page heading (launchReady) | app/app/launch/page.tsx:60 | inline |
| Your account is created | page heading (needsBilling) | app/app/launch/page.tsx:62 | inline |
| Bring your venue to life | page heading (default) | app/app/launch/page.tsx:63 | inline |
| Merchant setup | eyebrow | app/app/launch/page.tsx:75 | inline |
| Customers can scan, join, and collect stamps. Your QR is live below when you need the link. | description (launchReady) | app/app/launch/page.tsx:80 | inline |
| Your account is created. Proceed to billing to activate your venue and start accepting stamps. | description (needsBilling) | app/app/launch/page.tsx:82 | inline |
| {readiness.total} setup checks and you're live. Create your QR once the earlier steps are done. | description (default, interpolated) | app/app/launch/page.tsx:83 | inline |
| Open venue QR | button (launchReady) | app/app/launch/page.tsx:87 | inline |
| Proceed to billing | button (needsBilling) | app/app/launch/page.tsx:92 | inline |
| Complete merchant onboarding first. | error (form) | app/app/launch/actions.ts:47 | inline |
| Unable to load venue location. | error (form) | app/app/launch/actions.ts:80 | inline |
| Unable to save venue location. | error (form) | app/app/launch/actions.ts:90 | inline |

## Onboarding — `app/app/onboarding/page.tsx` + `actions.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Merchant setup | eyebrow | app/app/onboarding/page.tsx:29 | inline |
| Tell us about your business | title | app/app/onboarding/page.tsx:30 | inline |
| Your business details are saved. Add your first venue to finish setting up. | description (missing_location) | app/app/onboarding/page.tsx:33 | inline |
| Add your business, find your first venue, and confirm the address to get started. | description (default) | app/app/onboarding/page.tsx:34 | inline |
| What happens next | eyebrow | app/app/onboarding/page.tsx:47 | inline |
| From sign-up to your first stamp | heading | app/app/onboarding/page.tsx:49 | inline |
| Save this form and we will walk you through the rest, one step at a time. | body | app/app/onboarding/page.tsx:51 | inline |
| Profile could not be saved. Check your details and try again. | error (form) | app/app/onboarding/actions.ts:20 | inline |
| Your session expired. Log in again. | error (form) | app/app/onboarding/actions.ts:67 | inline |
| Enter the business name. | validation | app/app/onboarding/actions.ts:87 | inline |
| Choose a business type. | validation | app/app/onboarding/actions.ts:88 | inline |
| merchant | slug fallback (not user-facing copy) | app/app/onboarding/actions.ts:102 | inline (internal) |

## Profile action — `app/app/profile/actions.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Profile could not be saved. Check your details and try again. | error (form) | app/app/profile/actions.ts:14 | inline |
| Complete merchant onboarding first. | error (form) | app/app/profile/actions.ts:71 | inline |
| Enter the business name. | validation | app/app/profile/actions.ts:76 | inline |
| Choose a business type. | validation | app/app/profile/actions.ts:78 | inline |
| Enter a valid contact email. | validation | app/app/profile/actions.ts:80 | inline |
| Enter a valid phone number. | validation | app/app/profile/actions.ts:82 | inline |
| Profile saved. | success message | app/app/profile/actions.ts:128 | inline |

## QR (poster kit) — `app/app/qr/page.tsx` + `actions.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Counter poster | eyebrow | app/app/qr/page.tsx:32 | inline |
| Venue QR | title | app/app/qr/page.tsx:33 | inline |
| Your permanent scan code and printable A4 posters. Share the link anywhere or print a layout for the till. | description | app/app/qr/page.tsx:34 | inline |
| Add at least 3 active mystery rewards before launching the QR. | error (redirect param) | app/app/qr/actions.ts:13 | inline |
| Unable to create QR | error (redirect param) | app/app/qr/actions.ts:14 | inline |
| Unable to update QR | error (redirect param) | app/app/qr/actions.ts:15 | inline |

## QR poster template render — `app/app/qr/poster/[template]/page.tsx` + not-found
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Counter poster | eyebrow (render error) | app/app/qr/poster/[template]/page.tsx:89 | inline |
| Poster could not be generated | title (render error) | app/app/qr/poster/[template]/page.tsx:90 | inline |
| The QR image failed to render just now. This is usually momentary — head back and reopen the poster. | description | app/app/qr/poster/[template]/page.tsx:91 | inline |
| QR render failed. | status banner title | app/app/qr/poster/[template]/page.tsx:94 | inline |
| If it keeps happening, check the venue QR is still live on the poster page. | status banner body | app/app/qr/poster/[template]/page.tsx:95 | inline |
| Back to QR | button | app/app/qr/poster/[template]/page.tsx:100 | inline |
| Poster not found | empty-state title (404) | app/app/qr/poster/[template]/not-found.tsx:16 | inline |
| This poster link is stale — the template or QR it points at does not exist any more. Open the Poster page to pick a fresh template. | empty-state description | app/app/qr/poster/[template]/not-found.tsx:17 | inline |
| Back to Poster | button | app/app/qr/poster/[template]/not-found.tsx:20 | inline |

## QR image route — `app/app/qr/image/[qrCodeId]/route.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| QR code not found | HTTP 404 body text | app/app/qr/image/[qrCodeId]/route.ts:32 | inline |

## Reward scan (collect) — `app/app/rewards/scan/[scanToken]/page.tsx` + not-found + actions
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Reward expired | status banner title | app/app/rewards/scan/[scanToken]/page.tsx:71 | inline |
| This reward expired — ask the customer to re-scan the venue QR for a fresh code. | status banner body | app/app/rewards/scan/[scanToken]/page.tsx:72 | inline |
| Reward not matched | status banner title | app/app/rewards/scan/[scanToken]/page.tsx:80 | inline |
| This reward belongs to another venue. | status banner body | app/app/rewards/scan/[scanToken]/page.tsx:81 | inline |
| Member and card details | sr-only heading | app/app/rewards/scan/[scanToken]/page.tsx:109 | inline |
| Member | detail label (dt) | app/app/rewards/scan/[scanToken]/page.tsx:113 | inline |
| Card | detail label (dt) | app/app/rewards/scan/[scanToken]/page.tsx:116 | inline |
| Reward collected | status banner title | app/app/rewards/scan/[scanToken]/page.tsx:124 | inline |
| Reward marked collected.  | status banner body (collected prefix) | app/app/rewards/scan/[scanToken]/page.tsx:125 | inline |
| This reward is now closed. The member can scan the venue QR again when they are ready for their next stamp. | status banner body | app/app/rewards/scan/[scanToken]/page.tsx:126-127 | inline |
| Cannot collect this reward | status banner title | app/app/rewards/scan/[scanToken]/page.tsx:130 | inline |
| This reward is not ready to collect. | status banner body (fallback) | app/app/rewards/scan/[scanToken]/page.tsx:131 | inline |
| Ready to collect | status banner title | app/app/rewards/scan/[scanToken]/page.tsx:135 | inline |
| Check the reward against the order. Mark it collected when you have served it. | status banner body | app/app/rewards/scan/[scanToken]/page.tsx:136-137 | inline |
| Scan another reward | button | app/app/rewards/scan/[scanToken]/page.tsx:147 | inline |
| Back to dashboard | button | app/app/rewards/scan/[scanToken]/page.tsx:151 | inline |
| Reward collection | eyebrow | app/app/rewards/scan/[scanToken]/page.tsx:162 | inline |
| Check and collect reward | title | app/app/rewards/scan/[scanToken]/page.tsx:163 | inline |
| Confirm the member is at the counter before marking the reward collected. | description | app/app/rewards/scan/[scanToken]/page.tsx:164 | inline |
| Reward not found | empty-state title (404) | app/app/rewards/scan/[scanToken]/not-found.tsx:16 | inline |
| That scan code has gone cold — it may have already been collected or refreshed. Ask the customer to scan the venue QR again, or head back to activity. | empty-state description | app/app/rewards/scan/[scanToken]/not-found.tsx:17 | inline |
| Back to activity | button | app/app/rewards/scan/[scanToken]/not-found.tsx:20 | inline |
| Reward unavailable. | error (form) | app/app/rewards/scan/[scanToken]/actions.ts:25 | inline |

## Scan (scanner) — `app/app/scan/page.tsx` + loading
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Scan reward QR | metadata title | app/app/scan/page.tsx:6 | inline |
| Loading reward scanner | aria-label | app/app/scan/loading.tsx:18 | inline |

## Settings (redirect) — `app/app/settings/page.tsx`
_No copy — redirect only._

---

# Components — `components/merchant/**`

## Account tab bar — `components/merchant/account/account-tab-bar.tsx` + `account-tabs.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Account sections | aria-label (nav) | components/merchant/account/account-tab-bar.tsx:11 | inline |
| Profile | tab label | components/merchant/account/account-tabs.ts:10 | inline |
| Billing | tab label | components/merchant/account/account-tabs.ts:11 | inline |

## Billing panel — `components/merchant/account/billing-panel.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Billing details could not be loaded | status banner title | components/merchant/account/billing-panel.tsx:67 | inline |
| This is usually temporary. | status banner body | components/merchant/account/billing-panel.tsx:68 | inline |
| Try again | link | components/merchant/account/billing-panel.tsx:75 | inline |
| Step 5 of 5 · Billing | eyebrow | components/merchant/account/billing-panel.tsx:105,166 | inline |
| Your account is created | heading | components/merchant/account/billing-panel.tsx:107 | inline |
| Add a card through Stripe to activate your venue and start accepting stamps. | body | components/merchant/account/billing-panel.tsx:109-112 | inline |
| Free trial | plan row label | components/merchant/account/billing-panel.tsx:117,177 | inline |
| 30 days | plan row value | components/merchant/account/billing-panel.tsx:117,177 | inline |
| Then | plan row label | components/merchant/account/billing-panel.tsx:118,178 | inline |
| £29 a month | plan row value | components/merchant/account/billing-panel.tsx:118,178 | inline |
| Billed | plan row label | components/merchant/account/billing-panel.tsx:119,179 | inline |
| Per location | plan row value | components/merchant/account/billing-panel.tsx:119,179 | inline |
| Proceed to billing | button | components/merchant/account/billing-panel.tsx:125 | inline |
| Secure checkout via Stripe. Cancel anytime during the trial. | helper text | components/merchant/account/billing-panel.tsx:127 | inline |
| Manage billing in Account | link | components/merchant/account/billing-panel.tsx:134 | inline |
| once your venue is live. | body (suffix) | components/merchant/account/billing-panel.tsx:138 | inline |
| Your plan | section header eyebrow | components/merchant/account/billing-panel.tsx:166 | inline |
| Activate your venue | section header title (needsCard) | components/merchant/account/billing-panel.tsx:167 | inline |
| Growth Plan | section header title | components/merchant/account/billing-panel.tsx:167 | inline |
| Add a card through Stripe to activate your venue — the first 30 days are free. | section header description (needsCard) | components/merchant/account/billing-panel.tsx:170 | inline |
| Everything on this receipt updates by itself once your Stripe checkout is done. | section header description | components/merchant/account/billing-panel.tsx:171 | inline |
| Your current period ends {date}. | body (interpolated) | components/merchant/account/billing-panel.tsx:186 | inline |
| Your billing period will show here once checkout is done. | body | components/merchant/account/billing-panel.tsx:188 | inline |
| Start checkout | button | components/merchant/account/billing-panel.tsx:197 | inline |
| Open Stripe portal | button | components/merchant/account/billing-panel.tsx:215 | inline |
| Start checkout to add your card and activate the venue. | helper text (portal unavailable) | components/merchant/account/billing-panel.tsx:225 | inline |
| Manage your card and invoices in the Stripe portal. | helper text | components/merchant/account/billing-panel.tsx:226 | inline |
| Checkout completed | status banner title | components/merchant/account/billing-panel.tsx:263 | inline |
| Your billing status should update on this page within a few seconds. | status banner body | components/merchant/account/billing-panel.tsx:266-267 | inline |
| Local dev: keep the Stripe webhook listener running with `stripe listen --forward-to localhost:3000/api/stripe/webhook` and restart after setting STRIPE_WEBHOOK_SECRET so future renewals sync automatically. | dev-only note | components/merchant/account/billing-panel.tsx:271-277 | inline (dev/internal) |
| Checkout cancelled | status banner title | components/merchant/account/billing-panel.tsx:283 | inline |
| You can restart the Growth Plan checkout when you are ready. | status banner body | components/merchant/account/billing-panel.tsx:284 | inline |
| No Stripe customer yet | status banner title | components/merchant/account/billing-panel.tsx:288 | inline |
| Start checkout before opening the Stripe portal. | status banner body | components/merchant/account/billing-panel.tsx:289 | inline |

## Profile panel — `components/merchant/account/profile-panel.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| What customers see | eyebrow | components/merchant/account/profile-panel.tsx:45 | inline |
| Add your venue address in Setup so customers can find you. | fallback body | components/merchant/account/profile-panel.tsx:51 | inline |
| Edit venue details | link | components/merchant/account/profile-panel.tsx:57 | inline |
| Address and GPS checks are managed in Setup. Business contact details saved here feed customer terms, billing setup, merchant notifications, and support; sign-in credentials stay separate. | body | components/merchant/account/profile-panel.tsx:70-72 | inline |

## Announcement compose — `components/merchant/announcements/announcement-compose.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Announcement | section header eyebrow | components/merchant/announcements/announcement-compose.tsx:123 | inline |
| Send a venue update | section header title | components/merchant/announcements/announcement-compose.tsx:124 | inline |
| Short member updates for today, tomorrow, or a quiet shift that needs regulars. | section header description | components/merchant/announcements/announcement-compose.tsx:125 | inline |
| Daily limit reached | status banner title | components/merchant/announcements/announcement-compose.tsx:134 | inline |
| You have sent {n} announcements today. You can send more tomorrow. | status banner body (interpolated) | components/merchant/announcements/announcement-compose.tsx:135-136 | inline |
| No members can receive this yet | empty-state title | components/merchant/announcements/announcement-compose.tsx:142 | inline |
| Members need push permission and venue marketing consent before announcements can go out. | empty-state description | components/merchant/announcements/announcement-compose.tsx:143 | inline |
| Announcement title | field label | components/merchant/announcements/announcement-compose.tsx:154 | inline |
| Kitchen open from noon | input placeholder | components/merchant/announcements/announcement-compose.tsx:169 | inline |
| Announcement body | field label | components/merchant/announcements/announcement-compose.tsx:176 | inline |
| Fresh pies, cask ale, and a few tables free for lunch. | textarea placeholder | components/merchant/announcements/announcement-compose.tsx:191 | inline |
| Sent only to members with push updates enabled for this venue. | helper text | components/merchant/announcements/announcement-compose.tsx:198 | inline |
| Sending… | button pending label | components/merchant/announcements/announcement-compose.tsx:210 | inline |
| Send announcement | button | components/merchant/announcements/announcement-compose.tsx:210 | inline |
| About {n} of your {n} members can receive this. | body (interpolated) | components/merchant/announcements/announcement-compose.tsx:228-230 | inline |
| Daily announcements {used}/{limit} | body (interpolated) | components/merchant/announcements/announcement-compose.tsx:232-240 | inline |
| Eligibility is based on membership, push subscription, and marketing consent. You can send up to {n} venue announcements per day. | helper text (interpolated) | components/merchant/announcements/announcement-compose.tsx:243-247 | inline |
| Announcement queued | status banner title (success) | components/merchant/announcements/announcement-compose.tsx:259 | inline |
| Eligible audience: {n} {member/members}. | status banner line | components/merchant/announcements/announcement-compose.tsx:262-264 | inline |
| Queued for {n} {member/members}. | status banner line | components/merchant/announcements/announcement-compose.tsx:265-268 | inline |
| Skipped: {n} {member/members}. | status banner line | components/merchant/announcements/announcement-compose.tsx:269-272 | inline |
| {n} were skipped because this announcement was already queued for them. | status banner line | components/merchant/announcements/announcement-compose.tsx:274-277 | inline |
| member / members | pluralized noun | components/merchant/announcements/announcement-compose.tsx:350 | inline |

## Announcement form error copy — `lib/notifications/venue-announcement-form-copy.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Daily limit reached | error title (rate_limited) | lib/notifications/venue-announcement-form-copy.ts:11 | shared:venue-announcement-form-copy |
| Announcements can go out up to 2 a day. Try again tomorrow. | error body (rate_limited) | lib/notifications/venue-announcement-form-copy.ts:12 | shared:venue-announcement-form-copy |
| Add a clearer title | error title (invalid_title) | lib/notifications/venue-announcement-form-copy.ts:16 | shared:venue-announcement-form-copy |
| Use a title of at least 3 characters. | error body (invalid_title) | lib/notifications/venue-announcement-form-copy.ts:17 | shared:venue-announcement-form-copy |
| Add a fuller message | error title (invalid_body) | lib/notifications/venue-announcement-form-copy.ts:21 | shared:venue-announcement-form-copy |
| Use a message of at least 10 characters. | error body (invalid_body) | lib/notifications/venue-announcement-form-copy.ts:22 | shared:venue-announcement-form-copy |
| Check the wording | error title (moderation_rejected) | lib/notifications/venue-announcement-form-copy.ts:26 | shared:venue-announcement-form-copy |
| Keep it to a plain venue update without links, phone numbers, payment wording, or claims. | error body (moderation_rejected) | lib/notifications/venue-announcement-form-copy.ts:27 | shared:venue-announcement-form-copy |
| Sign in again | error title (unauthenticated) | lib/notifications/venue-announcement-form-copy.ts:31 | shared:venue-announcement-form-copy |
| Sign in again before sending this announcement. | error body (unauthenticated) | lib/notifications/venue-announcement-form-copy.ts:32 | shared:venue-announcement-form-copy |
| Announcement not sent | error title (default) | lib/notifications/venue-announcement-form-copy.ts:38 | shared:venue-announcement-form-copy |
| We could not send this announcement. Try again in a moment. | error body (default) | lib/notifications/venue-announcement-form-copy.ts:39 | shared:venue-announcement-form-copy |

## Activity compact feed — `components/merchant/activity-compact-feed.tsx`
_No literal copy — renders row.badgeLabel / row.headline / row.primaryAction.label from lib/merchant/activity._

## Activity detail card — `components/merchant/activity-detail-card.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| at {timestampLabel} | inline time joiner | components/merchant/activity-detail-card.tsx:50 | inline |
| Just now | relative time | components/merchant/activity-detail-card.tsx:117 | inline |
| {n} min ago | relative time | components/merchant/activity-detail-card.tsx:120 | inline |
| {n} hr ago | relative time | components/merchant/activity-detail-card.tsx:124 | inline |
| Yesterday | relative time | components/merchant/activity-detail-card.tsx:127 | inline |
| {n} days ago | relative time | components/merchant/activity-detail-card.tsx:128 | inline |

## Activity detail feed — `components/merchant/activity-detail-feed.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| All | filter pill | components/merchant/activity-detail-feed.tsx:27 | inline |
| Joins | filter pill | components/merchant/activity-detail-feed.tsx:28 | inline |
| Stamps | filter pill | components/merchant/activity-detail-feed.tsx:29 | inline |
| Rewards | filter pill | components/merchant/activity-detail-feed.tsx:30 | inline |
| QR | filter pill | components/merchant/activity-detail-feed.tsx:31 | inline |
| Account | filter pill | components/merchant/activity-detail-feed.tsx:32 | inline |
| This week | eyebrow | components/merchant/activity-detail-feed.tsx:116 | inline |
| Stamps | stat strip label | components/merchant/activity-detail-feed.tsx:119 | inline |
| Joins | stat strip label | components/merchant/activity-detail-feed.tsx:120 | inline |
| Rewards | stat strip label | components/merchant/activity-detail-feed.tsx:121 | inline |
| QR | stat strip label | components/merchant/activity-detail-feed.tsx:122 | inline |
| Search activity | input placeholder + aria-label | components/merchant/activity-detail-feed.tsx:143,144 | inline |
| Filter activity by type | aria-label | components/merchant/activity-detail-feed.tsx:151 | inline |
| {n} shown from {m}. | status (aria-live, interpolated) | components/merchant/activity-detail-feed.tsx:177-178 | inline |
| No events in this filter | empty-state title | components/merchant/activity-detail-feed.tsx:184 | inline |
| Try another category or clear the search to see more of the loaded activity. | empty-state description | components/merchant/activity-detail-feed.tsx:185 | inline |
| {n} {event/events} loaded, more available. | footer count (interpolated) | components/merchant/activity-detail-feed.tsx:213-214 | inline |
| Loading… | load-more pending label | components/merchant/activity-detail-feed.tsx:273 | inline |
| Load more | load-more label | components/merchant/activity-detail-feed.tsx:273 | inline |

## Activity copy resolver — `lib/merchant/activity.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Join | badge label | lib/merchant/activity.ts:475 | inline |
| {name} joined | headline (interpolated) | lib/merchant/activity.ts:476 | inline |
| Joined via venue QR and accepted the loyalty programme. | summary | lib/merchant/activity.ts:477 | inline |
| Stamp requested | badge label | lib/merchant/activity.ts:499 | inline |
| {name} requested a stamp | headline | lib/merchant/activity.ts:500 | inline |
| The customer opened the stamp-confirm screen from the venue QR. | summary | lib/merchant/activity.ts:501-502 | inline |
| Stamp collected | badge label | lib/merchant/activity.ts:525 | inline |
| {name} collected {stampLabel} | headline | lib/merchant/activity.ts:526 | inline |
| Customer stamp was issued and a location anomaly was flagged. | summary (geo_flagged) | lib/merchant/activity.ts:528 | inline |
| Customer stamp was issued from the venue QR. | summary | lib/merchant/activity.ts:529 | inline |
| Reward unlocked | badge label | lib/merchant/activity.ts:569 | inline |
| {name} unlocked {rewardLabel} | headline | lib/merchant/activity.ts:570 | inline |
| {reward} is ready to redeem. | summary (interpolated) | lib/merchant/activity.ts:572 | inline |
| A reward became available after reaching the stamp target. | summary | lib/merchant/activity.ts:573 | inline |
| Reward redeemed | badge label | lib/merchant/activity.ts:601 | inline |
| {name} redeemed {rewardLabel} | headline | lib/merchant/activity.ts:602 | inline |
| {reward} was redeemed by the customer. | summary (interpolated) | lib/merchant/activity.ts:604 | inline |
| The customer redeemed a reward. | summary | lib/merchant/activity.ts:605 | inline |
| Birthday treat | badge label (isBirthday) | lib/merchant/activity.ts:641 | inline |
| Reward issued | badge label | lib/merchant/activity.ts:641 | inline |
| Birthday treat issued to {name} | headline (isBirthday) | lib/merchant/activity.ts:643 | inline |
| {rewardLabel} issued to {name} | headline | lib/merchant/activity.ts:644 | inline |
| An automatic birthday reward was issued to this member. | summary (isBirthday) | lib/merchant/activity.ts:646 | inline |
| A reward was issued to this member. | summary | lib/merchant/activity.ts:647 | inline |
| Reward sent | badge label | lib/merchant/activity.ts:663 | inline |
| Reward sent to {name} | headline | lib/merchant/activity.ts:664 | inline |
| {reward} was sent to this member. | summary (interpolated) | lib/merchant/activity.ts:666 | inline |
| A reward was sent to this member. | summary | lib/merchant/activity.ts:667 | inline |
| Invite sent | badge label | lib/merchant/activity.ts:685 | inline |
| Reward invite sent | headline | lib/merchant/activity.ts:686 | inline |
| A reward invite was sent to someone not yet on Nabaperks; it attaches when they join. | summary | lib/merchant/activity.ts:687-688 | inline |
| QR scanned | badge label | lib/merchant/activity.ts:704 | inline |
| {label} scanned the QR | headline | lib/merchant/activity.ts:706 | inline |
| Someone scanned the QR | headline (no label) | lib/merchant/activity.ts:707 | inline |
| The QR opened, but join was unavailable at that moment. | summary | lib/merchant/activity.ts:710 | inline |
| A customer opened the venue QR resolver. | summary | lib/merchant/activity.ts:711 | inline |
| QR downloaded | badge label | lib/merchant/activity.ts:744 | inline |
| {assetType} QR downloaded | headline | lib/merchant/activity.ts:746 | inline |
| QR asset downloaded | headline | lib/merchant/activity.ts:747 | inline |
| A printable or till-ready QR asset was saved. | summary | lib/merchant/activity.ts:748 | inline |
| QR created | badge label | lib/merchant/activity.ts:768 | inline |
| Venue QR created | headline | lib/merchant/activity.ts:769 | inline |
| A permanent join QR was created for this location. | summary | lib/merchant/activity.ts:770 | inline |
| QR enabled / QR disabled | badge label | lib/merchant/activity.ts:799 | inline |
| Venue QR enabled / Venue QR disabled | headline | lib/merchant/activity.ts:800 | inline |
| Customer scanning is open from the permanent venue QR. | summary (enabled) | lib/merchant/activity.ts:802 | inline |
| Customer scanning has been paused from the permanent venue QR. | summary (disabled) | lib/merchant/activity.ts:803 | inline |
| Card setup | badge label | lib/merchant/activity.ts:819,840 | inline |
| Loyalty card setup created | headline | lib/merchant/activity.ts:820 | inline |
| Your stamp card and reward rules were saved. | summary | lib/merchant/activity.ts:821 | inline |
| Loyalty card setup updated | headline | lib/merchant/activity.ts:841 | inline |
| Stamp target, reward copy, or card status changed. | summary | lib/merchant/activity.ts:842 | inline |
| Account | badge label | lib/merchant/activity.ts:861 | inline |
| Merchant account joined | headline | lib/merchant/activity.ts:862 | inline |
| Onboarding completed and the venue profile was saved. | summary | lib/merchant/activity.ts:863 | inline |
| Billing | badge label | lib/merchant/activity.ts:879,900 | inline |
| Growth Plan started | headline | lib/merchant/activity.ts:881 | inline |
| Stripe marked billing as active for this merchant. | summary | lib/merchant/activity.ts:882 | inline |
| Growth Plan cancelled | headline | lib/merchant/activity.ts:902 | inline |
| Stripe marked the Growth Plan subscription as cancelled. | summary | lib/merchant/activity.ts:903 | inline |
| Activity | badge label (default) | lib/merchant/activity.ts:921 | inline |
| Merchant activity event. | summary (default) | lib/merchant/activity.ts:923 | inline |
| Member | fallback customer name | lib/merchant/activity.ts:1227 | inline |
| stamp {n} / a stamp | stamp label | lib/merchant/activity.ts:1243,1250 | inline |
| a reward | reward label fallback | lib/merchant/activity.ts:1254 | inline |
| View member | primary action label | lib/merchant/activity.ts:1071 | inline |
| Open QR | primary action label | lib/merchant/activity.ts:1083 | inline |
| Open card setup | primary action label | lib/merchant/activity.ts:1090 | inline |
| Open billing | primary action label | lib/merchant/activity.ts:1097 | inline |
| Open account | primary action label | lib/merchant/activity.ts:1101 | inline |
| Open QR setup | secondary action label | lib/merchant/activity.ts:1116 | inline |
| Merchant account / Staff member / Automatic / Nabaperks support | actor detail values | lib/merchant/activity.ts:1264,1268,1276,1278 | inline |
| Staff / How / Marketing opt-in / Yes / No / Customer join / etc. | detail labels/values (internal, not rendered by client per toSlimActivityRow) | lib/merchant/activity.ts (various) | inline (internal) |
| Just now / {n} min ago / {n} hr ago / Yesterday / {n} days ago | relative time | lib/merchant/activity.ts:1320-1331 | inline |
| Today / Yesterday | date group label | lib/merchant/activity.ts:1341,1345 | inline |
| Stamp request and stamp issue are grouped into one visit. | threaded summary | lib/merchant/activity.ts:999 | inline |
| Claim opened / Approved | threaded detail labels | lib/merchant/activity.ts:1001-1002 | inline (internal) |

## Billing status copy — `components/merchant/billing-status.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Billing not started | notice title | components/merchant/billing-status.tsx:76 | inline |
| Start your subscription when you are ready to go live. You can set everything else up first. | notice description | components/merchant/billing-status.tsx:78 | inline |
| Start billing | action label | components/merchant/billing-status.tsx:82 | inline |
| Free trial active | notice title | components/merchant/billing-status.tsx:86 | inline |
| Your 30-day free trial is running, with everything switched on. | notice description | components/merchant/billing-status.tsx:88 | inline |
| View billing | action label | components/merchant/billing-status.tsx:92 | inline |
| Billing active | notice title | components/merchant/billing-status.tsx:96 | inline |
| Your subscription is active. Customers can join, collect stamps, and redeem rewards. | notice description | components/merchant/billing-status.tsx:98 | inline |
| Manage billing | action label | components/merchant/billing-status.tsx:102 | inline |
| Billing {status} | notice title (interpolated) | components/merchant/billing-status.tsx:106,117,128,142 | inline |
| A payment needs attention. Your card still works for now, but please sort billing soon. | notice description (past_due) | components/merchant/billing-status.tsx:108 | inline |
| Resolve billing | action label | components/merchant/billing-status.tsx:112 | inline |
| New stamps and rewards are paused until billing is restored. | notice description (cancelled/suspended) | components/merchant/billing-status.tsx:119,130 | inline |
| Restart billing | action label | components/merchant/billing-status.tsx:123 | inline |
| Restore access | action label | components/merchant/billing-status.tsx:134 | inline |
| We could not read your billing status just now. Refresh the page, or open billing to check. | notice description (fallback) | components/merchant/billing-status.tsx:144 | inline |
| Review billing | action label (fallback) | components/merchant/billing-status.tsx:147 | inline |

## Copy URL button — `components/merchant/copy-url-button.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Copy failed — copy it by hand | button (failed) | components/merchant/copy-url-button.tsx:30 | inline |
| Copied | button (copied) | components/merchant/copy-url-button.tsx:30 | inline |
| Copy URL | button | components/merchant/copy-url-button.tsx:30 | inline |
| Copy failed. Use the visible shareable URL instead. | sr-only status | components/merchant/copy-url-button.tsx:33 | inline |
| Shareable URL copied. | sr-only status | components/merchant/copy-url-button.tsx:35 | inline |

## Customer readback table — `components/merchant/customer-readback-table.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Member | table column header | components/merchant/customer-readback-table.tsx:208 | inline |
| Joined | table column header | components/merchant/customer-readback-table.tsx:242 | inline |
| Stamps | table column header | components/merchant/customer-readback-table.tsx:257 | inline |
| Last visit | table column header | components/merchant/customer-readback-table.tsx:272 | inline |
| Not yet | cell (no last visit) | components/merchant/customer-readback-table.tsx:282 | inline |
| Reward | table column header | components/merchant/customer-readback-table.tsx:287 | inline |
| Open scanner | button (mobile) | components/merchant/customer-readback-table.tsx:152 | inline |
| Send reward | button (mobile) | components/merchant/customer-readback-table.tsx:161 | inline |
| Joined: {label} | mobile card time | components/merchant/customer-readback-table.tsx:125 | inline |
| Last: {label} | mobile card time | components/merchant/customer-readback-table.tsx:131,135 | inline |
| Open scanner for {name}'s reward QR | aria-label | components/merchant/customer-readback-table.tsx:305 | inline |
| Scan | button | components/merchant/customer-readback-table.tsx:308 | inline |
| Send a reward to {name} | aria-label | components/merchant/customer-readback-table.tsx:322 | inline |
| Send | button | components/merchant/customer-readback-table.tsx:324 | inline |
| Loyalty members | aria-label (mobile list + table caption context) | components/merchant/customer-readback-table.tsx:185 | inline |
| Nothing on this page | empty-page title | components/merchant/customer-readback-table.tsx:470 | inline |
| Your {n} members end before page {p}. | empty-page body (interpolated) | components/merchant/customer-readback-table.tsx:472 | inline |
| Members | stat strip label | components/merchant/customer-readback-table.tsx:499 | inline |
| Ready | stat strip label | components/merchant/customer-readback-table.tsx:507 | inline |
| Quiet | stat strip label | components/merchant/customer-readback-table.tsx:508 | inline |
| Search members | input placeholder + aria-label | components/merchant/customer-readback-table.tsx:525,526 | inline |
| Filter members by reward status | aria-label | components/merchant/customer-readback-table.tsx:532 | inline |
| All / Ready / Active / Quiet | filter pill labels | components/merchant/customer-readback-table.tsx:537-540 | inline |
| Showing members {a}–{b} of {total}, newest first — search and filters cover this page only. Older members are on the later pages. | pagination note (interpolated) | components/merchant/customer-readback-table.tsx:550-552 | inline |
| {name} has a reward ready. Ask them to show their reward QR. | scan banner (interpolated) | components/merchant/customer-readback-table.tsx:561-562 | inline |
| Open scanner | button | components/merchant/customer-readback-table.tsx:569 | inline |
| No members match your filter | empty-filter title | components/merchant/customer-readback-table.tsx:578 | inline |
| Try a different status or clear the search. | empty-filter body | components/merchant/customer-readback-table.tsx:580 | inline |
| Your loyalty members and their stamp progress | table caption | components/merchant/customer-readback-table.tsx:604 | inline |
| Members pages | nav aria-label | components/merchant/customer-readback-table.tsx:667 | inline |
| Previous page | button | components/merchant/customer-readback-table.tsx:678,682 | inline |
| Page {p} of {t} · {total} members | pagination readback (interpolated) | components/merchant/customer-readback-table.tsx:685-686 | inline |
| Next page | button | components/merchant/customer-readback-table.tsx:695,699 | inline |
| Initials only · phones stay hashed · no marketing without a separate opt-in · exports live with the account owner | privacy note | components/merchant/customer-readback-table.tsx:713-715 | inline |

## Customer readback copy — `lib/merchant/customer-readback.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Reward ready | badge label | lib/merchant/customer-readback.ts:111 | inline |
| Reward waiting | badge label | lib/merchant/customer-readback.ts:115 | inline |
| New today | badge label | lib/merchant/customer-readback.ts:120 | inline |
| Gone quiet | badge label | lib/merchant/customer-readback.ts:124 | inline |
| Redeemed {date} | badge label (interpolated) | lib/merchant/customer-readback.ts:131 | inline |
| Collecting | badge label | lib/merchant/customer-readback.ts:134 | inline |
| Today | joined/last-visit label | lib/merchant/customer-readback.ts:168,181 | inline |
| Yesterday | joined/last-visit label | lib/merchant/customer-readback.ts:169,185 | inline |
| Not yet | last-visit label | lib/merchant/customer-readback.ts:177 | inline |
| Today {time} | last-visit label (interpolated) | lib/merchant/customer-readback.ts:183 | inline |

## Customer identity display — `lib/merchant/customer-identity-display.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Email hidden | identifier fallback | lib/merchant/customer-identity-display.ts:23 | inline |
| Phone ending {digits} | identifier (interpolated) | lib/merchant/customer-identity-display.ts:15 | inline |
| Member | identifier fallback | lib/merchant/customer-identity-display.ts:15 | inline |

## Dashboard home streams — `components/merchant/dashboard-home-streams.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Members | KPI label | components/merchant/dashboard-home-streams.tsx:53 | inline |
| New (7d) | KPI label | components/merchant/dashboard-home-streams.tsx:60 | inline |
| Stamps (7d) | KPI label | components/merchant/dashboard-home-streams.tsx:66 | inline |
| Rewards (7d) | KPI label | components/merchant/dashboard-home-streams.tsx:72 | inline |
| Last 14 days | section header eyebrow | components/merchant/dashboard-home-streams.tsx:91 | inline |
| How the week is going | section header title | components/merchant/dashboard-home-streams.tsx:92 | inline |
| Deltas compare this week with the seven days before; the lines trace the last fortnight. | section header description | components/merchant/dashboard-home-streams.tsx:93 | inline |
| Stamps vs joins | eyebrow | components/merchant/dashboard-home-streams.tsx:117 | inline |
| 2 weeks ago | trend chart start label | components/merchant/dashboard-home-streams.tsx:120 | inline |
| Today | trend chart end label | components/merchant/dashboard-home-streams.tsx:121 | inline |
| Daily stamps issued and new members over the last 14 days | trend chart aria-label | components/merchant/dashboard-home-streams.tsx:122 | inline |
| Stamps | trend series label | components/merchant/dashboard-home-streams.tsx:126 | inline |
| Joins | trend series label | components/merchant/dashboard-home-streams.tsx:131 | inline |
| Recent activity | section header title | components/merchant/dashboard-home-streams.tsx:156 | inline |
| View all | button | components/merchant/dashboard-home-streams.tsx:160 | inline |
| No activity yet | empty-state title | components/merchant/dashboard-home-streams.tsx:171 | inline |
| Activity will appear after members join, add stamps, redeem rewards, or download QR assets. | empty-state description | components/merchant/dashboard-home-streams.tsx:172 | inline |

## Dashboard next actions — `components/merchant/dashboard-next-actions.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Do next | section header title | components/merchant/dashboard-next-actions.tsx:27 | inline |
| {n} {reward/rewards} ready to redeem | next-action label (interpolated) | components/merchant/dashboard-next-actions.tsx:35 | inline |
| No rewards waiting, you're all caught up | next-action label | components/merchant/dashboard-next-actions.tsx:36 | inline |
| {n} {member/members} gone quiet | next-action label (interpolated) | components/merchant/dashboard-next-actions.tsx:43 | inline |
| Every member has visited recently | next-action label | components/merchant/dashboard-next-actions.tsx:44 | inline |
| Repeat members | progress track label | components/merchant/dashboard-next-actions.tsx:52 | inline |
_Note: this component is defined but not imported by any covered route (dashboard uses dashboard-home-streams). See scope notes._

## Dashboard QR card — `components/merchant/dashboard-qr-card.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| your venue | venue name fallback | components/merchant/dashboard-qr-card.tsx:24 | inline |
| Venue QR for {venueName} | QrFrame label (interpolated) | components/merchant/dashboard-qr-card.tsx:63 | inline |
| QR code for {venueName} | img alt (interpolated) | components/merchant/dashboard-qr-card.tsx:69 | inline |
| Counter QR | eyebrow | components/merchant/dashboard-qr-card.tsx:78,111 | inline |
| Show a customer, instantly | heading | components/merchant/dashboard-qr-card.tsx:80 | inline |
| One tap makes it full screen — customers scan to join and collect today's stamp. No app to download. | body | components/merchant/dashboard-qr-card.tsx:83-84 | inline |
| Paused — new customers can't join until you re-enable it under Poster. | body (inactive) | components/merchant/dashboard-qr-card.tsx:98-99 | inline |
| Activate your venue QR | heading (setup prompt) | components/merchant/dashboard-qr-card.tsx:114 | inline |
| Finish setup to create the permanent QR customers scan to join. Once it's live it shows up here for one-tap access. | body (setup prompt) | components/merchant/dashboard-qr-card.tsx:116-118 | inline |
| Go to QR setup | button | components/merchant/dashboard-qr-card.tsx:123 | inline |

## Launch readiness panel — `components/merchant/launch-readiness-panel.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Venue / Card / Rewards / Venue QR / Billing | mobile rail labels | components/merchant/launch-readiness-panel.tsx:41-46 | inline |
| Venue / Card / Pool / QR / Bill | narrow mobile rail labels | components/merchant/launch-readiness-panel.tsx:49-55 | inline |
| Setup | section header eyebrow | components/merchant/launch-readiness-panel.tsx:122 | inline |
| Setup readiness | section header title | components/merchant/launch-readiness-panel.tsx:123 | inline |
| What's left before members can collect stamps. | section header description | components/merchant/launch-readiness-panel.tsx:124 | inline |
| {completed} of {total} complete | mono tag (interpolated) | components/merchant/launch-readiness-panel.tsx:127 | inline |
| Venue is live | reward seal label | components/merchant/launch-readiness-panel.tsx:136,144 | inline |
| You're live | eyebrow / text | components/merchant/launch-readiness-panel.tsx:139,145 | inline |
| Setup is complete. Customers can scan, join, and collect stamps. | body | components/merchant/launch-readiness-panel.tsx:140-141 | inline |
| Setup progress | eyebrow / progress-track label | components/merchant/launch-readiness-panel.tsx:153,229 | inline |
| Setup progress: {completed} of {total} | progress aria-label (interpolated) | components/merchant/launch-readiness-panel.tsx:161,273 | inline |
| Ready / Next up / To do | step status labels | components/merchant/launch-readiness-panel.tsx:204 | inline |
| {label}, {ready/to do} | link aria-label (interpolated) | components/merchant/launch-readiness-panel.tsx:216,329 | inline |
| Next up: {actionLabel}. | body (interpolated) | components/merchant/launch-readiness-panel.tsx:237 | inline |
| Run through the checklist before you print. | body | components/merchant/launch-readiness-panel.tsx:238 | inline |
| Open setup | button (fallback) | components/merchant/launch-readiness-panel.tsx:242 | inline |

## Launch readiness contract/core copy — `lib/merchant/launch-readiness-contract.ts`, `launch-readiness-core.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Your card | setup step label | lib/merchant/launch-readiness-contract.ts:28 | inline |
| Your rewards | setup step label | lib/merchant/launch-readiness-contract.ts:29 | inline |
| Business & venue | setup step label | lib/merchant/launch-readiness-contract.ts:30 | inline |
| Venue QR | setup step label | lib/merchant/launch-readiness-contract.ts:31 | inline |
| Billing | setup step label | lib/merchant/launch-readiness-contract.ts:32 | inline |
| Add your business profile, first venue, and customer-facing address. | step description (venue) | lib/merchant/launch-readiness-contract.ts:39-40 | inline |
| Set the visit target and the mystery reward card customers collect. | step description (card) | lib/merchant/launch-readiness-contract.ts:45-46 | inline |
| Add at least three live rewards so every full card has something to reveal. | step description (rewards) | lib/merchant/launch-readiness-contract.ts:51-52 | inline |
| Review and share the permanent venue QR customers use to collect stamps. | step description (qr) | lib/merchant/launch-readiness-contract.ts:57-58 | inline |
| Add a billing card to activate the venue after the free trial starts. | step description (billing) | lib/merchant/launch-readiness-contract.ts:63-64 | inline |
| Save venue | step action label | lib/merchant/launch-readiness-core.ts:99 | inline |
| Review card / Build card | step action label | lib/merchant/launch-readiness-core.ts:203 | inline |
| Add rewards | step action label | lib/merchant/launch-readiness-core.ts:115 | inline |
| Open venue QR / Create your QR | step action label | lib/merchant/launch-readiness-core.ts:123 | inline |
| View billing / Add a card to activate | billing action label | lib/merchant/launch-readiness-core.ts:164 | inline |
| the next step / billing / your venue QR | rewards continue label | lib/merchant/launch-readiness-core.ts:331,336,340 | inline |

## Launch — advanced GPS checks — `components/merchant/launch/advanced-gps-checks.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Advanced GPS checks | disclosure label | components/merchant/launch/advanced-gps-checks.tsx:51 | inline |
| Off by default. When on, a stamp from outside the radius still goes through — it is only flagged for you to review later. | body | components/merchant/launch/advanced-gps-checks.tsx:54-56 | inline |
| Use GPS anomaly checks | toggle label | components/merchant/launch/advanced-gps-checks.tsx:59 | inline |
| Radius metres | field label | components/merchant/launch/advanced-gps-checks.tsx:70 | inline |
| 100m suits most small, single-site venues. Set anything from 25m to 1000m. | helper text | components/merchant/launch/advanced-gps-checks.tsx:79-80 | inline |
| Drag the pin to your real entrance — the soft GPS check measures from this exact spot, not the postcode centre. | helper text | components/merchant/launch/advanced-gps-checks.tsx:91-92 | inline |
| Geocoded to {lat}, {lng}. | body (interpolated) | components/merchant/launch/advanced-gps-checks.tsx:98 | inline |

## Launch — birthday panel + form — `components/merchant/launch/birthday-panel.tsx`, `birthday-reward-form.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Optional | eyebrow | components/merchant/launch/birthday-panel.tsx:24 | inline |
| Birthday treat | title | components/merchant/launch/birthday-panel.tsx:25 | inline |
| Automatically issue a reward during each member's birthday month. It redeems like any other reward and expires at month end. | description | components/merchant/launch/birthday-panel.tsx:26 | inline |
| Give a birthday treat | toggle label | components/merchant/launch/birthday-reward-form.tsx:41 | inline |
| Members with a saved birthday get this reward automatically during their birthday month. | toggle hint | components/merchant/launch/birthday-reward-form.tsx:42 | inline |
| Reward name | field label | components/merchant/launch/birthday-reward-form.tsx:52 | inline |
| What the member sees, e.g. "Birthday drink". | field hint | components/merchant/launch/birthday-reward-form.tsx:53 | inline |
| Reward terms | field label | components/merchant/launch/birthday-reward-form.tsx:61 | inline |
| 12–500 characters. Anything the member should know before they redeem. | field hint | components/merchant/launch/birthday-reward-form.tsx:62 | inline |
| Saving… | submit pending label | components/merchant/launch/birthday-reward-form.tsx:82 | inline |
| Save birthday reward | submit button | components/merchant/launch/birthday-reward-form.tsx:83 | inline |

## Launch — card panel — `components/merchant/launch/card-panel.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Finish onboarding first | title (no location) | components/merchant/launch/card-panel.tsx:39 | inline |
| Add your venue before you build your loyalty card. | description | components/merchant/launch/card-panel.tsx:40 | inline |
| Mystery Visit Card | default card name | components/merchant/launch/card-panel.tsx:57 | inline |
| Mystery card saved. | status banner title | components/merchant/launch/card-panel.tsx:85 | inline |
| Your visit-card settings are ready for member previews. | status banner body | components/merchant/launch/card-panel.tsx:86 | inline |
| your rewards | LaunchSaveNextAction nextLabel | components/merchant/launch/card-panel.tsx:90 | inline |

## Launch — customer card preview — `components/merchant/launch/customer-card-preview.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Mystery Visit Card | default card name | components/merchant/launch/customer-card-preview.tsx:47 | inline |
| Preview · {n} visits | disclosure label (interpolated) | components/merchant/launch/customer-card-preview.tsx:64 | inline |
| Member preview | eyebrow | components/merchant/launch/customer-card-preview.tsx:77 | inline |
| The live card members see while collecting stamps — updates as you edit the form. | body | components/merchant/launch/customer-card-preview.tsx:78-80 | inline |
| Your card is inactive. Members cannot collect new stamps until you turn it back on. | body (inactive) | components/merchant/launch/customer-card-preview.tsx:110-112 | inline |
| Something's under there. | reward name (preview) | components/merchant/launch/customer-card-preview.tsx:126 | inline |
| Mystery reward stays sealed until the final stamp. | reward description (preview) | components/merchant/launch/customer-card-preview.tsx:127 | inline |
| For you only | eyebrow | components/merchant/launch/customer-card-preview.tsx:136 | inline |
| Active — accepting stamps | mono tag | components/merchant/launch/customer-card-preview.tsx:139 | inline |
| Inactive — no new stamps | mono tag | components/merchant/launch/customer-card-preview.tsx:140 | inline |
| {n} active pool reward(s). Need 3 before launch. | body (interpolated) | components/merchant/launch/customer-card-preview.tsx:143-144 | inline |
| Merchant launch status | aria-label | components/merchant/launch/customer-card-preview.tsx:133 | inline |

## Launch — disclosure — `components/merchant/launch/disclosure.tsx`
_No literal copy — label passed by callers._

## Launch — billing CTA — `components/merchant/launch/launch-billing-cta.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Your account is created. | status banner title | components/merchant/launch/launch-billing-cta.tsx:16 | inline |
| Proceed to billing to activate your venue and start accepting stamps. | status banner body | components/merchant/launch/launch-billing-cta.tsx:17 | inline |
| Proceed to billing | button | components/merchant/launch/launch-billing-cta.tsx:25 | inline |

## Launch — tab auto-advance — `components/merchant/launch/launch-tab-auto-advance.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| {blockedReason} | body (passed in) | components/merchant/launch/launch-tab-auto-advance.tsx:50 | inline |
| Saved. Continue when you are ready, or stay here to review. | body | components/merchant/launch/launch-tab-auto-advance.tsx:52-53 | inline |
| Continue to {nextLabel} | button (default) | components/merchant/launch/launch-tab-auto-advance.tsx:60 | inline |
| Stay on this step | button | components/merchant/launch/launch-tab-auto-advance.tsx:66 | inline |

## Launch — QR error banner — `components/merchant/launch/qr-error-banner.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Unable to update QR. Check the QR status and try again. | resolved error body | components/merchant/launch/qr-error-banner.tsx:17 | inline |
| Unable to create QR. Check your card and reward setup, then try again. | resolved error body | components/merchant/launch/qr-error-banner.tsx:18 | inline |
| QR action failed. | status banner title | components/merchant/launch/qr-error-banner.tsx:21 | inline |

## Launch — QR panel (empty/status states) — `components/merchant/launch/qr-panel.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Venue QR | eyebrow | components/merchant/launch/qr-panel.tsx:54,75 | inline |
| Build your card first | title | components/merchant/launch/qr-panel.tsx:55 | inline |
| Nabaperks needs one active mystery visit card before it can create your permanent venue QR. | description | components/merchant/launch/qr-panel.tsx:56-57 | inline |
| Go to card builder | button | components/merchant/launch/qr-panel.tsx:60,82 | inline |
| Your QR is not live yet | title | components/merchant/launch/qr-panel.tsx:76 | inline |
| Create the permanent venue QR once venue, card, and rewards are ready. Billing is the final activation step. | description | components/merchant/launch/qr-panel.tsx:77-78 | inline |
| Add 3 rewards before launch. | status banner title | components/merchant/launch/qr-panel.tsx:82 | inline |
| The QR stays blocked until at least 3 active mystery rewards are in the pool. | status banner body | components/merchant/launch/qr-panel.tsx:83-84 | inline |
| Add or activate a reward | link | components/merchant/launch/qr-panel.tsx:88 | inline |
| Creating QR… | submit pending label | components/merchant/launch/qr-panel.tsx:98 | inline |
| Create QR | submit button | components/merchant/launch/qr-panel.tsx:99 | inline |
| Finish setup to go live. | status banner title | components/merchant/launch/qr-panel.tsx:103 | inline |
| Next up: {actionLabel}. | status banner body (interpolated) | components/merchant/launch/qr-panel.tsx:104 | inline |
| Continue setup | link | components/merchant/launch/qr-panel.tsx:109 | inline |
| QR code created. | status message | components/merchant/launch/qr-panel.tsx:145 | inline |
| QR code enabled. | status message | components/merchant/launch/qr-panel.tsx:147 | inline |
| QR code disabled. | status message | components/merchant/launch/qr-panel.tsx:149 | inline |
| Your venue QR is live. | status message | components/merchant/launch/qr-panel.tsx:151 | inline |
| Your account is created. Proceed to billing to activate your venue and start accepting stamps. | status banner body | components/merchant/launch/qr-panel.tsx:160 | inline |
| The permanent resolver and share URL are ready below. | status banner body | components/merchant/launch/qr-panel.tsx:161 | inline |
| billing | LaunchSaveNextAction nextLabel | components/merchant/launch/qr-panel.tsx:166 | inline |
| Proceed to billing | LaunchSaveNextAction primaryLabel | components/merchant/launch/qr-panel.tsx:167 | inline |

## Launch — QR panel live — `components/merchant/launch/qr-panel-live.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Venue QR | eyebrow | components/merchant/launch/qr-panel-live.tsx:73 | inline |
| Your permanent counter code. Customers scan once to join, collect today's stamp, and unlock a surprise reward. | body | components/merchant/launch/qr-panel-live.tsx:77-79 | inline |
| Venue QR code | section aria-label | components/merchant/launch/qr-panel-live.tsx:87 | inline |
| Scanner-safe QR code for {activeCardName} | QrFrame label (interpolated) | components/merchant/launch/qr-panel-live.tsx:91 | inline |
| QR code for {activeCardName} | img alt (interpolated) | components/merchant/launch/qr-panel-live.tsx:97 | inline |
| Scan once yourself before the first customer | caption | components/merchant/launch/qr-panel-live.tsx:104 | inline |
| Add your venue address before print. | status banner title | components/merchant/launch/qr-panel-live.tsx:111 | inline |
| Stamps need the right location. | status banner body | components/merchant/launch/qr-panel-live.tsx:112 | inline |
| Complete venue step | link | components/merchant/launch/qr-panel-live.tsx:116 | inline |
| Share the link | launch step title | components/merchant/launch/qr-panel-live.tsx:126 | inline |
| Drop this URL anywhere you already talk about loyalty — socials, email footers, or your website. | launch step description | components/merchant/launch/qr-panel-live.tsx:127 | inline |
| Permanent venue link | eyebrow | components/merchant/launch/qr-panel-live.tsx:132 | inline |
| Open link | button | components/merchant/launch/qr-panel-live.tsx:143 | inline |
| Print a counter poster | launch step title | components/merchant/launch/qr-panel-live.tsx:157 | inline |
| Pick a layout, open the A4 sheet, and print at 100% scale — no fit-to-page. | launch step description | components/merchant/launch/qr-panel-live.tsx:158 | inline |
| Open A4 | link text | components/merchant/launch/qr-panel-live.tsx:202 | inline |
| How customers use this QR | disclosure label | components/merchant/launch/qr-panel-live.tsx:216 | inline |
| New customers scan and join on their phone — no app download. | list item | components/merchant/launch/qr-panel-live.tsx:218 | inline |
| Returning members scan the same code and tap to collect today's stamp. | list item | components/merchant/launch/qr-panel-live.tsx:220-221 | inline |
| On the final visit the reward unseals, redeemable from the next business day. | list item | components/merchant/launch/qr-panel-live.tsx:224-225 | inline |
| Manage | section header eyebrow | components/merchant/launch/qr-panel-live.tsx:232 | inline |
| Pause new scans | section header title | components/merchant/launch/qr-panel-live.tsx:233 | inline |
| Disable the QR if you need to stop new customers joining. Existing members keep their cards. | section header description | components/merchant/launch/qr-panel-live.tsx:234 | inline |
| Disabling… / Enabling… | submit pending label | components/merchant/launch/qr-panel-live.tsx:248 | inline |
| Disable QR / Enable QR | submit button | components/merchant/launch/qr-panel-live.tsx:250 | inline |
| Step {step} | launch step eyebrow (interpolated) | components/merchant/launch/qr-panel-live.tsx:277 | inline |
| Live · accepting scans | mono tag (active) | components/merchant/launch/qr-panel-live.tsx:293 | inline |
| Disabled · no new entry | mono tag (inactive) | components/merchant/launch/qr-panel-live.tsx:300 | inline |

## Launch — rewards panel (status states) — `components/merchant/launch/rewards-panel.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Finish onboarding first | title (no location) | components/merchant/launch/rewards-panel.tsx:63 | inline |
| Add your venue before you build your reward pool. | description | components/merchant/launch/rewards-panel.tsx:64 | inline |
| Step 3 · Rewards | eyebrow (no card) | components/merchant/launch/rewards-panel.tsx:77 | inline |
| Build your card first | title (no card) | components/merchant/launch/rewards-panel.tsx:78 | inline |
| The reward pool is tied to a saved visit card. Create the card, then come back here to load at least 3 active mystery rewards. | description | components/merchant/launch/rewards-panel.tsx:79 | inline |
| Go to card builder | button | components/merchant/launch/rewards-panel.tsx:82 | inline |
| Birthday reward saved. | status banner title | components/merchant/launch/rewards-panel.tsx:151 | inline |
| Members with a saved birthday get it automatically during their birthday month. | status banner body | components/merchant/launch/rewards-panel.tsx:152-153 | inline |
| Your account is created. | status banner title | components/merchant/launch/rewards-panel.tsx:159 | inline |
| Starter rewards loaded. | status banner title | components/merchant/launch/rewards-panel.tsx:161 | inline |
| Reward saved. | status banner title | components/merchant/launch/rewards-panel.tsx:162 | inline |
| {n} of 3 active rewards | reused copy fragment (interpolated) | components/merchant/launch/rewards-panel.tsx:164 | inline |
| Proceed to billing to activate your venue and start accepting stamps. | status banner body | components/merchant/launch/rewards-panel.tsx:169 | inline |
| Your venue QR is live. Open it to copy or test the share link. | status banner body | components/merchant/launch/rewards-panel.tsx:171 | inline |
| Your venue QR is active again. | status banner body | components/merchant/launch/rewards-panel.tsx:173 | inline |
| Three default rewards are active and saved. Create your QR once venue and card are ready. | status banner body | components/merchant/launch/rewards-panel.tsx:176 | inline |
| Launch eligibility has been refreshed with your latest reward changes. | status banner body | components/merchant/launch/rewards-panel.tsx:177 | inline |
| {n} of 3 active rewards are ready. Finish the reward pool before setup can complete. | status banner body (interpolated) | components/merchant/launch/rewards-panel.tsx:178 | inline |
| {n} of 3 active rewards. Add or activate one more reward before continuing. | blocked reason (interpolated) | components/merchant/launch/rewards-panel.tsx:190 | inline |
| Reward update failed. | status banner title | components/merchant/launch/rewards-panel.tsx:202 | inline |
| Unable to update reward. Check the reward and try again. | status banner body | components/merchant/launch/rewards-panel.tsx:203 | inline |
| Your reward pool is ready. | status banner title | components/merchant/launch/rewards-panel.tsx:210 | inline |
| Each reward is already saved. Create your QR once venue, card, and rewards are complete — billing is the final activation step. | status banner body | components/merchant/launch/rewards-panel.tsx:211-212 | inline |
| billing / the next step | continueLabel fallback | components/merchant/launch/rewards-panel.tsx:107-108 | inline |

## Launch — venue panel — `components/merchant/launch/venue-panel.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Main venue | default venue name | components/merchant/launch/venue-panel.tsx:30 | inline |

## Launch — venue location form — `components/merchant/launch/venue-location-form.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Step 1 · Location | eyebrow | components/merchant/launch/venue-location-form.tsx:126 | inline |
| Where do scans happen? | title | components/merchant/launch/venue-location-form.tsx:127 | inline |
| Your printed QR never changes. GPS is an optional soft check. It never blocks a member's stamp, it only flags an odd one for review. | description | components/merchant/launch/venue-location-form.tsx:128-129 | inline |
| Venue location saved. | status banner title | components/merchant/launch/venue-location-form.tsx:133 | inline |
| Your QR and stamp checks now use this address. | status banner body | components/merchant/launch/venue-location-form.tsx:134 | inline |
| your card | LaunchSaveNextAction nextLabel | components/merchant/launch/venue-location-form.tsx:137 | inline |
| Venue name | field label | components/merchant/launch/venue-location-form.tsx:169 | inline |
| Saving location… | submit pending label | components/merchant/launch/venue-location-form.tsx:206 | inline |
| Save venue address | submit button | components/merchant/launch/venue-location-form.tsx:207 | inline |

## Launch — venue pin map — `components/merchant/launch/venue-pin-map.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| © OpenStreetMap contributors | map attribution (HTML) | components/merchant/launch/venue-pin-map.tsx:82-83 | inline |
| Drag the pin to your venue entrance for the soft GPS check | aria-label (role=application) | components/merchant/launch/venue-pin-map.tsx:150 | inline |

## Launch — venue place autocomplete — `components/merchant/launch/venue-place-autocomplete.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Search for your venue | injected input placeholder | components/merchant/launch/venue-place-autocomplete.tsx:247 | inline |
| Find your venue | label | components/merchant/launch/venue-place-autocomplete.tsx:280 | inline |
| Loading venue search… | status text | components/merchant/launch/venue-place-autocomplete.tsx:293 | inline |
| Search Google for your venue, or enter the address below. | helper text | components/merchant/launch/venue-place-autocomplete.tsx:298 | inline |
| Venue search is unavailable right now — enter the address below. | fallback text | components/merchant/launch/venue-place-autocomplete.tsx:306 | inline |
| Dev note: Google blocked this origin. In Google Cloud Console, add http://localhost:3000/* and http://localhost/* to the Maps browser key referrers (do not use :* port wildcards). | dev-only note | components/merchant/launch/venue-place-autocomplete.tsx:310-313 | inline (dev/internal) |

## Loading skeletons — `components/merchant/loading-skeletons.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Loading dashboard metrics | aria-label | components/merchant/loading-skeletons.tsx:66 | inline |
| Loading activity | aria-label | components/merchant/loading-skeletons.tsx:149 | inline |
| Loading loyalty members | aria-label | components/merchant/loading-skeletons.tsx:222 | inline |
| Loading venue QR | aria-label | components/merchant/loading-skeletons.tsx:322 | inline |
| Loading reward pool | aria-label | components/merchant/loading-skeletons.tsx:351 | inline |
| Loading setup form | aria-label | components/merchant/loading-skeletons.tsx:391,416 | inline |
| Loading profile | aria-label | components/merchant/loading-skeletons.tsx:438 | inline |
| Loading billing | aria-label | components/merchant/loading-skeletons.tsx:465 | inline |
| Loading reward | aria-label | components/merchant/loading-skeletons.tsx:507 | inline |

## Loyalty card form — `components/merchant/loyalty-card-form.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Your card | section head title | components/merchant/loyalty-card-form.tsx:138 | inline |
| One active card for {locationName}. The reward reveals after the final qualifying visit. | section head description (interpolated) | components/merchant/loyalty-card-form.tsx:139 | inline |
| Step 1 | section head step | components/merchant/loyalty-card-form.tsx:141 | inline |
| Card name | field label | components/merchant/loyalty-card-form.tsx:146 | inline |
| Visits to reveal | eyebrow + stepper label | components/merchant/loyalty-card-form.tsx:155,157 | inline |
| Choose {min}–{max} visits. Stamps needed before the reward unseals. | cadence hint (interpolated) | components/merchant/loyalty-card-form.tsx:122 | inline |
| Visit cadence presets | aria-label | components/merchant/loyalty-card-form.tsx:165 | inline |
| {n} visits | preset detail (interpolated) | components/merchant/loyalty-card-form.tsx:191 | inline |
| Reward terms | field label | components/merchant/loyalty-card-form.tsx:210,601 | inline |
| Shown on the member card. The suggested copy updates when you change visits, until you edit this field. | field hint | components/merchant/loyalty-card-form.tsx:215 | inline |
| Card is active | toggle label | components/merchant/loyalty-card-form.tsx:220 | inline |
| Members can collect stamps on this card. | toggle hint | components/merchant/loyalty-card-form.tsx:221 | inline |
| Saving... | submit pending label | components/merchant/loyalty-card-form.tsx:235 | inline |
| Save card / Create card | submit button | components/merchant/loyalty-card-form.tsx:235 | inline |
| Reward pool | heading | components/merchant/loyalty-card-form.tsx:291 | inline |
| The surprise is drawn from this pool. At least 3 must be active on {cardName} before you can launch. | body (interpolated) | components/merchant/loyalty-card-form.tsx:293-295 | inline |
| {n} active · ready | mono tag (ready) | components/merchant/loyalty-card-form.tsx:301 | inline |
| {n} / 3 active | mono tag | components/merchant/loyalty-card-form.tsx:302 | inline |
| Each reward saves when you add or edit it. Continue below when you are happy with the pool. | body (ready) | components/merchant/loyalty-card-form.tsx:310-311 | inline |
| Activate {n} more reward(s) to unlock launch. | body (interpolated) | components/merchant/loyalty-card-form.tsx:314-315 | inline |
| Reward ideas | eyebrow | components/merchant/loyalty-card-form.tsx:322 | inline |
| No rewards in the pool yet | empty-state title | components/merchant/loyalty-card-form.tsx:345 | inline |
| Add at least 3 active mystery rewards so the final stamp can reveal a prize. | empty-state description | components/merchant/loyalty-card-form.tsx:347 | inline |
| Add a reward | button | components/merchant/loyalty-card-form.tsx:389 | inline |
| Proceed to billing | continue button (billing) | components/merchant/loyalty-card-form.tsx:396 | inline |
| Continue to {continueLabel} | continue button | components/merchant/loyalty-card-form.tsx:398 | inline |
| your venue QR | default continueLabel | components/merchant/loyalty-card-form.tsx:256 | inline |
| Untitled reward | reward name fallback | components/merchant/loyalty-card-form.tsx:439 | inline |
| · w{weight} | reward weight tag (interpolated) | components/merchant/loyalty-card-form.tsx:462 | inline |
| Edit {rewardName} | aria-label | components/merchant/loyalty-card-form.tsx:475 | inline |
| reward | reward label fallback | components/merchant/loyalty-card-form.tsx:499 | inline |
| Deactivate / Activate {rewardLabel} | switch aria-label | components/merchant/loyalty-card-form.tsx:527 | inline |
| Active / Off | switch text | components/merchant/loyalty-card-form.tsx:543 | inline |
| New reward / Edit reward | eyebrow | components/merchant/loyalty-card-form.tsx:580 | inline |
| Reward name | field label | components/merchant/loyalty-card-form.tsx:591 | inline |
| e.g. Free pastry with any coffee | input placeholder | components/merchant/loyalty-card-form.tsx:593 | inline |
| What the member gets, and any conditions. | textarea placeholder | components/merchant/loyalty-card-form.tsx:603 | inline |
| Active in the pool | toggle label | components/merchant/loyalty-card-form.tsx:610 | inline |
| Counts toward the 3 needed to launch. | toggle hint | components/merchant/loyalty-card-form.tsx:611 | inline |
| Weighting | disclosure label | components/merchant/loyalty-card-form.tsx:616 | inline |
| Defaults are fine to launch. A higher weight is drawn more often. | body | components/merchant/loyalty-card-form.tsx:617-618 | inline |
| Weight | field label | components/merchant/loyalty-card-form.tsx:622 | inline |
| Saving... | submit pending label | components/merchant/loyalty-card-form.tsx:640 | inline |
| Add reward / Save reward | submit button | components/merchant/loyalty-card-form.tsx:640 | inline |
| Cancel | button | components/merchant/loyalty-card-form.tsx:644 | inline |
| Delete | button | components/merchant/loyalty-card-form.tsx:680 | inline |
| Confirm delete | button | components/merchant/loyalty-card-form.tsx:694 | inline |
| Keep it | button | components/merchant/loyalty-card-form.tsx:702 | inline |
| Fewer visits / More visits | stepper aria-label | components/merchant/loyalty-card-form.tsx:783,798 | inline |

## Loyalty card copy — `lib/merchant/loyalty-card-copy.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Complete 3 visits to reveal a surprise reward. Redeem from the next UK business day. | legacy default reward terms | lib/merchant/loyalty-card-copy.ts:7-8 | shared:loyalty-card-copy |
| Collect {n} visit stamps to unlock a surprise reward. Redeem from the next UK business day. | default reward terms (interpolated) | lib/merchant/loyalty-card-copy.ts:20 | shared:loyalty-card-copy |

## Reward presets — `lib/merchant/reward-presets.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Regulars' pint | preset reward name | lib/merchant/reward-presets.ts:26 | shared:reward-presets |
| One house pint, small wine, or soft drink for the member. Valid from the next UK business day. | preset reward terms | lib/merchant/reward-presets.ts:27-28 | shared:reward-presets |
| Good for wet-led regulars. | preset description | lib/merchant/reward-presets.ts:29 | shared:reward-presets |
| Free starter | preset reward name | lib/merchant/reward-presets.ts:32 | shared:reward-presets |
| One starter up to GBP 8 with any main meal. Valid from the next UK business day. | preset reward terms | lib/merchant/reward-presets.ts:33-34 | shared:reward-presets |
| Works for food-led visits. | preset description | lib/merchant/reward-presets.ts:35 | shared:reward-presets |
| Dessert on the house | preset reward name | lib/merchant/reward-presets.ts:38 | shared:reward-presets |
| One dessert from the main menu with any paid main. Valid from the next UK business day. | preset reward terms | lib/merchant/reward-presets.ts:39-40 | shared:reward-presets |
| Useful after evening meals. | preset description | lib/merchant/reward-presets.ts:41 | shared:reward-presets |
| Coffee after lunch | preset reward name | lib/merchant/reward-presets.ts:44 | shared:reward-presets |
| One tea, coffee, or soft drink after a paid lunch. Valid from the next UK business day. | preset reward terms | lib/merchant/reward-presets.ts:45-46 | shared:reward-presets |
| Fits lunch and daytime trade. | preset description | lib/merchant/reward-presets.ts:47 | shared:reward-presets |
| Kids' meal with adult main | preset reward name | lib/merchant/reward-presets.ts:50 | shared:reward-presets |
| One kids' meal with a paid adult main course. Valid from the next UK business day. | preset reward terms | lib/merchant/reward-presets.ts:51-52 | shared:reward-presets |
| A family-table reward. | preset description | lib/merchant/reward-presets.ts:53 | shared:reward-presets |
| Sunday roast upgrade | preset reward name | lib/merchant/reward-presets.ts:56 | shared:reward-presets |
| One roast upgrade or extra side with a Sunday main. Valid from the next UK business day. | preset reward terms | lib/merchant/reward-presets.ts:57-58 | shared:reward-presets |
| A Sunday-led nudge. | preset description | lib/merchant/reward-presets.ts:59 | shared:reward-presets |
| 10% off the next bill | preset reward name | lib/merchant/reward-presets.ts:62 | shared:reward-presets |
| Ten percent off food on one visit, excluding drinks. Valid from the next UK business day. | preset reward terms | lib/merchant/reward-presets.ts:63-64 | shared:reward-presets |
| Simple, familiar value. | preset description | lib/merchant/reward-presets.ts:65 | shared:reward-presets |
| Free item | generic preset reward name | lib/merchant/reward-presets.ts:73 | shared:reward-presets |
| One eligible item from the standard menu or service list. Valid from the next UK business day. | generic preset reward terms | lib/merchant/reward-presets.ts:74-75 | shared:reward-presets |
| A simple reward any local business can tune. | generic preset description | lib/merchant/reward-presets.ts:76 | shared:reward-presets |
| Member upgrade | generic preset reward name | lib/merchant/reward-presets.ts:79 | shared:reward-presets |
| One complimentary upgrade on an eligible purchase. Valid from the next UK business day. | generic preset reward terms | lib/merchant/reward-presets.ts:80-81 | shared:reward-presets |
| Good when an upsell has low fulfilment risk. | generic preset description | lib/merchant/reward-presets.ts:82 | shared:reward-presets |
| 10% off | generic preset reward name | lib/merchant/reward-presets.ts:85 | shared:reward-presets |
| Ten percent off one eligible purchase, excluding gift cards and third-party fees. Valid from the next UK business day. | generic preset reward terms | lib/merchant/reward-presets.ts:86-87 | shared:reward-presets |
| Familiar value without naming a venue type. | generic preset description | lib/merchant/reward-presets.ts:88 | shared:reward-presets |
| Member perk | generic preset reward name | lib/merchant/reward-presets.ts:91 | shared:reward-presets |
| One member-only perk chosen by the business team. Valid from the next UK business day. | generic preset reward terms | lib/merchant/reward-presets.ts:92-93 | shared:reward-presets |
| A flexible placeholder for teams still deciding. | generic preset description | lib/merchant/reward-presets.ts:94 | shared:reward-presets |
| Lunch-trade card | cadence preset label | lib/merchant/reward-presets.ts:105 | shared:reward-presets |
| Pick 3 for quick daytime repeat visits. | cadence preset description | lib/merchant/reward-presets.ts:107 | shared:reward-presets |
| Food-led card | cadence preset label | lib/merchant/reward-presets.ts:110 | shared:reward-presets |
| Works for meals and planned visits. | cadence preset description | lib/merchant/reward-presets.ts:112 | shared:reward-presets |
| Wet-led card | cadence preset label | lib/merchant/reward-presets.ts:115 | shared:reward-presets |
| Pick 6 so a weekly regular unlocks roughly monthly. | cadence preset description | lib/merchant/reward-presets.ts:117 | shared:reward-presets |

## Default reward pool — `lib/merchant/default-reward-pool.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Free pint of your choice | seed reward name | lib/merchant/default-reward-pool.ts:12 | shared:default-reward-pool |
| Choose any pint from our range on the house. Valid from the next UK business day. | seed reward terms | lib/merchant/default-reward-pool.ts:13-14 | shared:default-reward-pool |
| 10% off next visit | seed reward name | lib/merchant/default-reward-pool.ts:20 | shared:default-reward-pool |
| Get 10% off your entire bill on your next visit. Valid from the next UK business day. | seed reward terms | lib/merchant/default-reward-pool.ts:21-22 | shared:default-reward-pool |
| Free dessert of your choice | seed reward name | lib/merchant/default-reward-pool.ts:28 | shared:default-reward-pool |
| Choose any dessert from our menu on the house. Valid from the next UK business day. | seed reward terms | lib/merchant/default-reward-pool.ts:29-30 | shared:default-reward-pool |

## Merchant reward scanner — `components/merchant/merchant-reward-scanner.tsx` + loader
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Reward collection | eyebrow | components/merchant/merchant-reward-scanner.tsx:24 | inline |
| Scan reward QR | heading | components/merchant/merchant-reward-scanner.tsx:26 | inline |
| Point your camera at the QR on the member's phone. We will open the collection screen when it is ready to mark collected. | body | components/merchant/merchant-reward-scanner.tsx:29-31 | inline |
| Camera access blocked | camera error status | components/merchant/merchant-reward-scanner.tsx:87 | inline |
| No camera found | camera error status | components/merchant/merchant-reward-scanner.tsx:88 | inline |
| Camera is busy | camera error status | components/merchant/merchant-reward-scanner.tsx:89 | inline |
| Camera unavailable | camera error status | components/merchant/merchant-reward-scanner.tsx:90 | inline |
| Allow camera access in your browser, make sure you are on HTTPS or localhost, then try again. | camera error detail (denied) | components/merchant/merchant-reward-scanner.tsx:94-95 | inline |
| We could not find a camera on this device. Connect a camera, then try again. | camera error detail (not-found) | components/merchant/merchant-reward-scanner.tsx:96-97 | inline |
| Another app or tab is using the camera. Close it, then try again. | camera error detail (busy) | components/merchant/merchant-reward-scanner.tsx:98 | inline |
| Allow camera access in your browser and use HTTPS or localhost, then try again. | camera error detail (unavailable) | components/merchant/merchant-reward-scanner.tsx:99-100 | inline |
| Camera viewfinder | aria-label | components/merchant/merchant-reward-scanner.tsx:276 | inline |
| Starting camera... | status text (idle) | components/merchant/merchant-reward-scanner.tsx:257 | inline |
| Scanning for a reward QR… | status text (scanning) | components/merchant/merchant-reward-scanner.tsx:260 | inline |
| Reward QR found. Opening collection… | status text (decoded) | components/merchant/merchant-reward-scanner.tsx:261 | inline |
| That is not a reward QR from a member card | status text (invalid) | components/merchant/merchant-reward-scanner.tsx:263 | inline |
| Try again | button (camera error) | components/merchant/merchant-reward-scanner.tsx:291 | inline |
| Back to dashboard | button | components/merchant/merchant-reward-scanner.tsx:296 | inline |
| Starting camera | aria-label + text (loader) | components/merchant/merchant-reward-scanner-loader.tsx:29,33 | inline |
| Back to dashboard | button (loader) | components/merchant/merchant-reward-scanner-loader.tsx:38 | inline |

## Onboarding form + fields — `components/merchant/onboarding-form.tsx`, `onboarding-form-fields.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Cafe | business type option | components/merchant/onboarding-form.tsx:43 | inline |
| Dessert shop | business type option | components/merchant/onboarding-form.tsx:44 | inline |
| Bubble tea | business type option | components/merchant/onboarding-form.tsx:45 | inline |
| Pub or bar | business type option | components/merchant/onboarding-form.tsx:46 | inline |
| Takeaway / quick service | business type option | components/merchant/onboarding-form.tsx:47 | inline |
| Barber | business type option | components/merchant/onboarding-form.tsx:48 | inline |
| Salon | business type option | components/merchant/onboarding-form.tsx:49 | inline |
| Other local business | business type option | components/merchant/onboarding-form.tsx:50 | inline |
| Merchant setup | eyebrow | components/merchant/onboarding-form.tsx:225 | inline |
| Business name | field label | components/merchant/onboarding-form.tsx:230 | inline |
| Phone number | field label | components/merchant/onboarding-form.tsx:288 | inline |
| Saving... | submit pending label | components/merchant/onboarding-form.tsx:304 | inline |
| Finish setup | submit button | components/merchant/onboarding-form.tsx:304 | inline |
| Business type | field label | components/merchant/onboarding-form-fields.tsx:65 | inline |
| Select type | select placeholder option | components/merchant/onboarding-form-fields.tsx:78 | inline |
| (required) | sr-only required marker | components/merchant/onboarding-form-fields.tsx:124 | inline |

## Present QR — `components/merchant/present-qr.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Show full screen | trigger button (default) | components/merchant/present-qr.tsx:32 | inline |
| Close full screen QR | sr-only (close) | components/merchant/present-qr.tsx:60 | inline |
| Scan to join | eyebrow | components/merchant/present-qr.tsx:66 | inline |
| QR code for {venueName} | img alt (interpolated) | components/merchant/present-qr.tsx:77 | inline |
| Customers scan to join and collect today's stamp — no app to download. | body | components/merchant/present-qr.tsx:85-87 | inline |

## Profile form — `components/merchant/profile-form.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Cafe / Dessert shop / Bubble tea / Pub or bar / Takeaway / quick service / Barber / Salon / Other local business | business type options | components/merchant/profile-form.tsx:19-26 | inline |
| Business profile | eyebrow | components/merchant/profile-form.tsx:80 | inline |
| These details appear on customer cards, terms, billing setup, and merchant emails. Your sign-in email is managed separately. | body | components/merchant/profile-form.tsx:81-83 | inline |
| Customer-facing business name | field label | components/merchant/profile-form.tsx:89 | inline |
| Business type | field label | components/merchant/profile-form.tsx:95 | inline |
| Select type | select placeholder option | components/merchant/profile-form.tsx:102 | inline |
| Business contact email | field label | components/merchant/profile-form.tsx:116 | inline |
| Used for customer contact, billing setup, and merchant notifications. Changing this does not change the email you use to sign in. | field description | components/merchant/profile-form.tsx:117 | inline |
| Phone number | field label | components/merchant/profile-form.tsx:125 | inline |
| Saving… | submit pending label | components/merchant/profile-form.tsx:146 | inline |
| Save changes | submit button | components/merchant/profile-form.tsx:146 | inline |

## Reward collection form — `components/merchant/reward-collection-form.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Reward not collected | status banner title | components/merchant/reward-collection-form.tsx:28 | inline |
| Marking collected… | submit pending label | components/merchant/reward-collection-form.tsx:33 | inline |
| Mark reward collected | submit button | components/merchant/reward-collection-form.tsx:33 | inline |

## Send reward form — `components/merchant/send-reward-form.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Reward sent. | status banner title | components/merchant/send-reward-form.tsx:31 | inline |
| Sending to {label}. | body (interpolated) | components/merchant/send-reward-form.tsx:44-49 | inline |
| the selected member | member label fallback | components/merchant/send-reward-form.tsx:47 | inline |
| Member email or phone | field label | components/merchant/send-reward-form.tsx:55 | inline |
| Matched to your members. If they're new to Nabaperks, it waits until they join. | field hint | components/merchant/send-reward-form.tsx:56 | inline |
| Reward name | field label | components/merchant/send-reward-form.tsx:64 | inline |
| What the member sees, e.g. "A drink on us". | field hint | components/merchant/send-reward-form.tsx:66 | inline |
| Reward terms | field label | components/merchant/send-reward-form.tsx:73 | inline |
| 12–500 characters. Anything the member should know before redeeming. | field hint | components/merchant/send-reward-form.tsx:75 | inline |
| Expires in | field label | components/merchant/send-reward-form.tsx:83 | inline |
| {n} days | select option (interpolated) | components/merchant/send-reward-form.tsx:95 | inline |
| Message (optional) | field label | components/merchant/send-reward-form.tsx:107 | inline |
| Up to 200 characters. | field hint | components/merchant/send-reward-form.tsx:108 | inline |
| Sending… | submit pending label | components/merchant/send-reward-form.tsx:121 | inline |
| Send reward | submit button | components/merchant/send-reward-form.tsx:122 | inline |

## Send reward fields (validation) — `lib/merchant/send-reward-fields.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Reward sent. If they're new to Nabaperks, it'll be waiting when they join. | success message | lib/merchant/send-reward-fields.ts:12-13 | shared:send-reward-fields |
| Enter the member's email or phone. | validation (contact) | lib/merchant/send-reward-fields.ts:50 | shared:send-reward-fields |
| Enter the reward name. | validation | lib/merchant/send-reward-fields.ts:54 | shared:send-reward-fields |
| Use 100 characters or fewer. | validation | lib/merchant/send-reward-fields.ts:56 | shared:send-reward-fields |
| Enter clear reward terms. | validation | lib/merchant/send-reward-fields.ts:60 | shared:send-reward-fields |
| Add enough detail for the member to understand it. | validation | lib/merchant/send-reward-fields.ts:62 | shared:send-reward-fields |
| Use 500 characters or fewer. | validation | lib/merchant/send-reward-fields.ts:64 | shared:send-reward-fields |
| Choose a valid expiry. | validation | lib/merchant/send-reward-fields.ts:74 | shared:send-reward-fields |
| Use 200 characters or fewer. | validation | lib/merchant/send-reward-fields.ts:78 | shared:send-reward-fields |

## Sent rewards status — `lib/merchant/sent-rewards.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| New contact | invite recipient fallback | lib/merchant/sent-rewards.ts:82 | inline |
| Phone ending {n} | invite recipient (interpolated) | lib/merchant/sent-rewards.ts:82 | inline |
| Redeemed | reward status label | lib/merchant/sent-rewards.ts:100 | inline |
| Expired | reward/invite status label | lib/merchant/sent-rewards.ts:102,117 | inline |
| Cancelled | reward/invite status label | lib/merchant/sent-rewards.ts:104,119 | inline |
| Sent | reward status label | lib/merchant/sent-rewards.ts:106 | inline |
| Delivered | invite status label | lib/merchant/sent-rewards.ts:116 | inline |
| Invited | invite status label | lib/merchant/sent-rewards.ts:123 | inline |

## Reward collection blocked copy — `lib/merchant/reward-collection.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Log in to your merchant account to mark this reward collected. | blocked reason (unauth) | lib/merchant/reward-collection.ts:84 | inline |
| This reward belongs to a different merchant. | blocked reason | lib/merchant/reward-collection.ts:123 | inline |
| This reward has already been collected. | blocked reason | lib/merchant/reward-collection.ts:125,130 | inline |
| This reward could not be collected. Refresh and try again. | blocked reason | lib/merchant/reward-collection.ts:128,158 | inline |
| This reward cannot be collected until the next opening day. | blocked reason | lib/merchant/reward-collection.ts:133 | inline |
| Ask the customer to finish their profile before this reward can be collected. | blocked reason | lib/merchant/reward-collection.ts:136 | inline |
| This customer must be 18 or over to collect this reward. | blocked reason | lib/merchant/reward-collection.ts:140 | inline |
| This loyalty card is not active. | blocked reason | lib/merchant/reward-collection.ts:143 | inline |
| This customer has not collected enough stamps yet. | blocked reason | lib/merchant/reward-collection.ts:146 | inline |
| This reward is no longer available to collect. | blocked reason | lib/merchant/reward-collection.ts:150 | inline |
| This loyalty programme is unavailable right now. | blocked reason | lib/merchant/reward-collection.ts:154 | inline |
| This reward could not be collected. Try again or refresh. | blocked reason (fallback) | lib/merchant/reward-collection.ts:166 | inline |
| Reward could not be collected. | blocked reason | lib/merchant/reward-collection.ts:107 | inline |

## Stream error boundary — `components/merchant/stream-error-boundary.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Could not load {label} | empty-state title (interpolated) | components/merchant/stream-error-boundary.tsx:59 | inline |
| The rest of your dashboard is unaffected. Try again — your card, members, and rewards are safe on the server. | empty-state description | components/merchant/stream-error-boundary.tsx:60 | inline |
| Retrying… | button pending | components/merchant/stream-error-boundary.tsx:73 | inline |
| Try again | button | components/merchant/stream-error-boundary.tsx:73 | inline |

## Venue address fields — `components/merchant/venue-address-fields.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Venue address | fieldset legend | components/merchant/venue-address-fields.tsx:42 | inline |
| Address line 1 | field label | components/merchant/venue-address-fields.tsx:46 | inline |
| Building number and street | placeholder | components/merchant/venue-address-fields.tsx:47 | inline |
| Address line 2 | field label | components/merchant/venue-address-fields.tsx:61 | inline |
| Flat, unit, or building name (optional) | placeholder | components/merchant/venue-address-fields.tsx:62 | inline |
| Town or city | field label | components/merchant/venue-address-fields.tsx:75 | inline |
| London | placeholder | components/merchant/venue-address-fields.tsx:77 | inline |
| Postcode | field label | components/merchant/venue-address-fields.tsx:89 | inline |
| E1 6AN | placeholder | components/merchant/venue-address-fields.tsx:91 | inline |
| UK venues only. We use these details to place your venue on the map for optional GPS stamp checks. | helper text | components/merchant/venue-address-fields.tsx:105-107 | inline |
| (required) | sr-only required marker | components/merchant/venue-address-fields.tsx:153 | inline |

## Venue address validation — `lib/merchant/venue-address.ts`, `venue-location-submission.ts`, `resolve-venue-address.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Enter the first line of the address. | validation | lib/merchant/venue-address.ts:134 | inline |
| Use 120 characters or fewer. | validation | lib/merchant/venue-address.ts:136,140; venue-location-submission.ts:108 | inline |
| Enter the town or city. | validation | lib/merchant/venue-address.ts:144 | inline |
| Use 80 characters or fewer. | validation | lib/merchant/venue-address.ts:146 | inline |
| Enter the postcode. | validation | lib/merchant/venue-address.ts:150 | inline |
| Enter a valid UK postcode. | validation | lib/merchant/venue-address.ts:152 | inline |
| We could not confirm this place. Enter the address manually. | provider place error | lib/merchant/venue-address.ts:288 | inline |
| We could not confirm this place's location. Enter the address manually. | provider location error | lib/merchant/venue-address.ts:290 | inline |
| Enter the venue name. | validation | lib/merchant/venue-location-submission.ts:106 | inline |
| Enter a whole-number radius. | validation | lib/merchant/venue-location-submission.ts:113 | inline |
| Use at least 25 metres. | validation | lib/merchant/venue-location-submission.ts:115 | inline |
| Use 1,000 metres or fewer. | validation | lib/merchant/venue-location-submission.ts:117 | inline |
| Drop the pin on the map before saving. | validation (form) | lib/merchant/venue-location-submission.ts:121 | inline |
| We could not geocode this address. Check it and try again. | geocode error | lib/merchant/resolve-venue-address.ts:13 | inline |

---

# QR Poster components — `components/merchant/qr-poster/**`

## Poster copy resolver — `components/merchant/qr-poster/poster-copy.ts`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Don't leave your first stamp behind — scan now to unlock it. | progress line (1 stamp) | components/merchant/qr-poster/poster-copy.ts:71 | shared:poster-copy |
| You're already 1 stamp in — don't leave it behind. {N} more visit(s) unlock(s) your mystery reward. | progress line (interpolated) | components/merchant/qr-poster/poster-copy.ts:75 | shared:poster-copy |
| Your first stamp's on us — and it unlocks a mystery reward. | support (1 stamp) | components/merchant/qr-poster/poster-copy.ts:80 | shared:poster-copy |
| Your first stamp's on us. The rest unlock a mystery reward. | support | components/merchant/qr-poster/poster-copy.ts:83 | shared:poster-copy |
| Everyone / wins / something. | bold headline (before/accent/after) | components/merchant/qr-poster/poster-copy.ts:118-120 | shared:poster-copy |
| We're not allowed to tell you what it is. | bold forbidden | components/merchant/qr-poster/poster-copy.ts:123 | shared:poster-copy |
| No app · 20 seconds · No spam | bold friction line | components/merchant/qr-poster/poster-copy.ts:124 | shared:poster-copy |
| Scan to claim your free stamp | bold qr caption | components/merchant/qr-poster/poster-copy.ts:125 | shared:poster-copy |
| One stamp a day · Reward revealed when unlocked | bold reassurance | components/merchant/qr-poster/poster-copy.ts:126 | shared:poster-copy |
| One visit. One / surprise / . | editorial headline (1 stamp) | components/merchant/qr-poster/poster-copy.ts:131-134 | shared:poster-copy |
| {N} visits. One / surprise / . | editorial headline (interpolated) | components/merchant/qr-poster/poster-copy.ts:137-139 | shared:poster-copy |
| Start with a free stamp — the reward stays a mystery until you unlock it. | editorial support (1 stamp) | components/merchant/qr-poster/poster-copy.ts:143 | shared:poster-copy |
| Your first stamp is already waiting. Collect the rest to reveal what you've earned. | editorial support | components/merchant/qr-poster/poster-copy.ts:144 | shared:poster-copy |
| We can't tell you what it is. That's the point. | editorial forbidden | components/merchant/qr-poster/poster-copy.ts:145 | shared:poster-copy |
| No app download · Scan in 20 seconds | editorial friction line | components/merchant/qr-poster/poster-copy.ts:146 | shared:poster-copy |
| Scan to unlock your mystery reward | editorial qr caption | components/merchant/qr-poster/poster-copy.ts:147 | shared:poster-copy |
| Stamps count once per day · Mystery until unlock | editorial reassurance | components/merchant/qr-poster/poster-copy.ts:148 | shared:poster-copy |
| First stamp's / free / . | ticket headline | components/merchant/qr-poster/poster-copy.ts:152-154 | shared:poster-copy |
| Claim it now — your mystery reward unlocks straight after. | ticket support (1 stamp) | components/merchant/qr-poster/poster-copy.ts:158 | shared:poster-copy |
| Claim stamp one today. The rest unlock your mystery reward. | ticket support | components/merchant/qr-poster/poster-copy.ts:159 | shared:poster-copy |
| Staff won't spoil it. We won't either. | ticket forbidden | components/merchant/qr-poster/poster-copy.ts:160 | shared:poster-copy |
| No account needed · Takes 20 seconds | ticket friction line | components/merchant/qr-poster/poster-copy.ts:161 | shared:poster-copy |
| Scan here to claim your free stamp | ticket qr caption | components/merchant/qr-poster/poster-copy.ts:162 | shared:poster-copy |
| One stamp per visit · Mystery until unlock | ticket reassurance | components/merchant/qr-poster/poster-copy.ts:163 | shared:poster-copy |

## Poster pieces — `components/merchant/qr-poster/poster-pieces.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Nabaperks QR code | img alt | components/merchant/qr-poster/poster-pieces.tsx:57 | inline |
| Stamp {n} earned / empty | StampDot label (interpolated) | components/merchant/qr-poster/poster-pieces.tsx:99 | inline |
| Powered by nabaperks | footer brand | components/merchant/qr-poster/poster-pieces.tsx:131 | inline |

## Poster preview chrome — `components/merchant/qr-poster/poster-preview-chrome.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Print or save PDF | button | components/merchant/qr-poster/poster-preview-chrome.tsx:67 | inline |
| Preview matches print. Use A4 portrait at 100% scale — no fit-to-page. Safe margins are built in for framing. | guidance text | components/merchant/qr-poster/poster-preview-chrome.tsx:74-79 | inline |
| Poster templates | nav aria-label | components/merchant/qr-poster/poster-preview-chrome.tsx:105 | inline |
| Open menu | SidebarTrigger aria-label | components/merchant/qr-poster/poster-preview-chrome.tsx:182 | inline |
| Back | button | components/merchant/qr-poster/poster-preview-chrome.tsx:194 | inline |
| Print guidance | sr-only | components/merchant/qr-poster/poster-preview-chrome.tsx:220 | inline |
| Templates | side panel heading | components/merchant/qr-poster/poster-preview-chrome.tsx:263 | inline |
| Print setup | side panel heading | components/merchant/qr-poster/poster-preview-chrome.tsx:275 | inline |
| A4 portrait · 210×297 mm · print at 100% | side panel meta | components/merchant/qr-poster/poster-preview-chrome.tsx:279,302 | inline |

## North Star poster — `components/merchant/qr-poster/northstar/northstar-poster.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Your first stamp's already inked — scan to claim it and unlock a mystery reward. | promise (1 stamp) | components/merchant/qr-poster/northstar/northstar-poster.tsx:60 | inline |
| You're one stamp in — {N} more visit(s) unlock(s) a mystery reward. | promise (interpolated) | components/merchant/qr-poster/northstar/northstar-poster.tsx:65 | inline |
| Everyone / wins / something. | hook headline | components/merchant/qr-poster/northstar/northstar-poster.tsx:98 | inline |
| No app · 20 seconds · No spam | ease line | components/merchant/qr-poster/northstar/northstar-poster.tsx:101 | inline |
| First stamp free | card chip | components/merchant/qr-poster/northstar/northstar-poster.tsx:105 | inline |
| Scan to claim your free stamp | caption | components/merchant/qr-poster/northstar/northstar-poster.tsx:107 | inline |
| Nabaperks QR code | img alt | components/merchant/qr-poster/northstar/northstar-poster.tsx:113 | inline |
| Stamp {n} earned / empty | StampDot label (interpolated) | components/merchant/qr-poster/northstar/northstar-poster.tsx:138 | inline |
| Powered by nabaperks | footer brand | components/merchant/qr-poster/northstar/northstar-poster.tsx:156 | inline |
| Reward revealed when unlocked | footer line | components/merchant/qr-poster/northstar/northstar-poster.tsx:158 | inline |

## Thermal poster — `components/merchant/qr-poster/thermal/thermal-poster.tsx`
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Loyalty receipt | meta line | components/merchant/qr-poster/thermal/thermal-poster.tsx:81 | inline |
| No cash · No app · 20 seconds | meta line | components/merchant/qr-poster/thermal/thermal-poster.tsx:85 | inline |
| Everyone / wins / something | hook | components/merchant/qr-poster/thermal/thermal-poster.tsx:88-90 | inline |
| Today's first stamp | receipt item label | components/merchant/qr-poster/thermal/thermal-poster.tsx:93 | inline |
| Free | receipt item value | components/merchant/qr-poster/thermal/thermal-poster.tsx:93 | inline |
| Mystery reward | receipt item label | components/merchant/qr-poster/thermal/thermal-poster.tsx:94 | inline |
| Locked | receipt item value | components/merchant/qr-poster/thermal/thermal-poster.tsx:94 | inline |
| Visit(s) to unlock | receipt item label (interpolated) | components/merchant/qr-poster/thermal/thermal-poster.tsx:95 | inline |
| To join | total label | components/merchant/qr-poster/thermal/thermal-poster.tsx:100 | inline |
| £0.00 | total value | components/merchant/qr-poster/thermal/thermal-poster.tsx:101 | inline |
| Stamp {n} earned / empty | StampDot label (interpolated) | components/merchant/qr-poster/thermal/thermal-poster.tsx:129 | inline |
| Stamps on your card | caption | components/merchant/qr-poster/thermal/thermal-poster.tsx:138 | inline |
| Nabaperks QR code | img alt | components/merchant/qr-poster/thermal/thermal-poster.tsx:148 | inline |
| Scan to claim your free stamp | scan line | components/merchant/qr-poster/thermal/thermal-poster.tsx:153 | inline |
| Powered by nabaperks | footer brand | components/merchant/qr-poster/thermal/thermal-poster.tsx:164 | inline |
| *** Thank you *** | thanks line | components/merchant/qr-poster/thermal/thermal-poster.tsx:166 | inline |

## A4 poster shell — `components/merchant/qr-poster/a4-poster.tsx`, `poster-variants.tsx`
_No literal copy — compose PosterCopy fields and poster pieces._

---

## Micro-labels (generic, recurring)
| Label | ~count |
|---|---|
| Try again | ~5 (error.tsx, billing-panel, stream-error-boundary, scanner, camera-error) |
| Cancel | ~2 (loyalty-card-form) |
| Saving… / Saving... | ~6 (loyalty-card-form ×2, birthday-form, profile-form, onboarding-form, venue-location-form) |
| Back to dashboard | ~4 (reward scan page, scanner, scanner-loader) |
| Back | ~2 (poster chrome "Back"; qr poster "Back to QR") |
| Proceed to billing | ~6 (launch page, billing-panel, launch-billing-cta, qr-panel ×2, loyalty-card-form) |
| Go to card builder | ~2 (qr-panel, rewards-panel) |
| Open your Poster kit | ~2 (activity empty, customers empty) |
| Finish onboarding first | ~2 (card-panel, rewards-panel) |
| Loading… | ~1 (activity-detail-feed load-more) + Loading X aria-labels (skeletons) |
| Members (eyebrow/label) | ~6 across customers, send-reward, KPIs, stat strips |
| Reward name / Reward terms | ~4 pairs (loyalty-card-form, birthday-form, send-reward-form) |
| (required) | ~2 (onboarding-form-fields, venue-address-fields) |

## Scope notes / surprises
- **Heavy shared-copy modules within slice**: `lib/merchant/reward-presets.ts` (32 preset strings), `components/merchant/qr-poster/poster-copy.ts` (24 template strings), `lib/merchant/loyalty-card-copy.ts`, `lib/merchant/send-reward-fields.ts`, `lib/merchant/default-reward-pool.ts`, and `lib/notifications/venue-announcement-form-copy.ts` are the `shared:` sources; all resolved verbatim above. `lib/merchant/activity.ts` is the single largest inline copy resolver (~90 activity headline/summary/badge strings) — treated as `inline` since strings are hardcoded in that module.
- **Within-slice duplication (relevant to consistency audit)**:
  - "Proceed to billing to activate your venue and start accepting stamps." appears in launch/page.tsx, launch-billing-cta.tsx, qr-panel.tsx, rewards-panel.tsx.
  - "Your account is created" / "Your account is created." heading+banner repeats across launch/page.tsx, billing-panel.tsx, launch-billing-cta.tsx, rewards-panel.tsx, qr-panel.tsx.
  - "Activity will appear after members join, add stamps, redeem rewards, or download QR assets." duplicated in activity/page.tsx and dashboard-home-streams.tsx.
  - "Open your Poster kit" duplicated in activity/page.tsx and customers/page.tsx.
  - Plan receipt lines ("Free trial / 30 days", "Then / £29 a month", "Billed / Per location") appear twice within billing-panel.tsx (SetupBillingActivationCard + AccountBillingCard).
  - "Mystery Visit Card" default appears in card-panel.tsx and customer-card-preview.tsx.
  - Camera "…then try again." remediation copy repeats across 4 CAMERA_ERROR_DETAIL variants.
  - Both `formatMerchantVenueLabel` (lib/merchant/venue-label.ts) and inline `venueLabelOf`/`buildEyebrow`/`buildVenueName` (poster-preview-chrome, poster-copy, northstar, thermal) implement the same "show venue name once" logic with the `·` separator.
- **Dead/unwired component**: `components/merchant/dashboard-next-actions.tsx` (MerchantNextActions: "Do next", "…ready to redeem", "…gone quiet", "Repeat members") is exported but NOT imported by any covered route — the dashboard uses dashboard-home-streams.tsx instead. Its copy is inventoried but may be unreachable.
- **Not consumed in this slice**: `lib/merchant/staff-members.ts` holds user-facing strings ("Give the staff member a name.", "PIN must be 4 to 6 digits.") but no covered route/component imports it (staff-management UI is outside this slice — likely admin). Excluded from the tables; flagged here only.
- **Dev-only / internal copy present**: billing-panel.tsx local-dev Stripe webhook note (gated by NODE_ENV !== "production"); venue-place-autocomplete.tsx "Dev note: Google blocked this origin…" (NODE_ENV-gated); qr/image route DEV_HARNESS constants and "https://nabaperks.com/q/old-crown-girton". No lorem/TODO placeholder text found.
- **Reward name written but never shown to merchant as free text**: card/actions.ts passes `p_reward_name: "Surprise reward"` (stored RPC value), not surfaced as UI label.
- **`app/(auth)/actions.ts` uses `{digitLabel}`/`{length}`** from `merchantEmailOtpAliasDigitLabel()` — auth pages interpolate a shared OTP-length label (not a literal); recorded with the interpolation marker.
- **Auth pages import `AuthForm` / `ResetPasswordForm`** from `components/auth/*` (outside this slice) — those form field labels/buttons live there, not inventoried here.

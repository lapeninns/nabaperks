# Copy Inventory — Customer App (PWA + flows)

_Scope: app/home/**, app/card/**, app/claim/**, app/reward/**, app/scan/**, app/r/**, app/q/**, app/m/**, app/auth/confirm/**, components/customer/**, components/loyalty/**, components/pwa/**, lib/customer/experience/copy.ts (+ referenced pure copy helpers under lib/customer/**)._

Note on sourcing: `shared:copy.ts` = strings resolved from `lib/customer/experience/copy.ts`. `inline` = hardcoded in the file cited. Several other pure helper modules under `lib/customer/**` (not `copy.ts`) also emit user-facing strings; these are tagged `inline` at the helper's own file:line, and the consuming component is noted.

---

## Shared copy module — `lib/customer/experience/copy.ts`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| You scanned the venue QR | list item | lib/customer/experience/copy.ts:38 | inline |
| Save the card to your number with one text, no app | list item | lib/customer/experience/copy.ts:39 | inline |
| Accept the terms and your first stamp prints onto the card | list item | lib/customer/experience/copy.ts:40 | inline |
| How it works | label | lib/customer/experience/copy.ts:43 | inline |
| Already have a card? Use your number and we'll find it. | link/body | lib/customer/experience/copy.ts:46 | inline |
| We'll send a one-time code by text. | helper | lib/customer/experience/copy.ts:50 | inline |
| See how stamps and rewards work | link label | lib/customer/experience/copy.ts:53 | inline |
| 1 stamp unlocks a mystery reward | body (fn) | lib/customer/experience/copy.ts:59 | inline |
| {n} stamps unlock a mystery reward | body (fn) | lib/customer/experience/copy.ts:60 | inline |
| It's yours from {date}. | body (fn) | lib/customer/experience/copy.ts:70 | inline |
| It's yours from the next opening day. | body (fn) | lib/customer/experience/copy.ts:72 | inline |
| Venue QR scanned | eyebrow | lib/customer/experience/copy.ts:85 | inline |
| Keep your card on your phone | headline | lib/customer/experience/copy.ts:86 | inline |
| One text saves {merchant}'s card to your number. New here? Your first stamp lands when you accept the terms. | support line | lib/customer/experience/copy.ts:87 | inline |
| Get today's stamp | CTA label | lib/customer/experience/copy.ts:89 | inline |
| One text, no password | eyebrow | lib/customer/experience/copy.ts:94 | inline |
| Save your card to your number | headline | lib/customer/experience/copy.ts:95 | inline |
| Save {merchant}'s card to your number, {n stamps unlock a mystery reward}. | support line | lib/customer/experience/copy.ts:96 | inline |
| Check your texts | eyebrow | lib/customer/experience/copy.ts:100 | inline |
| Enter your code | headline | lib/customer/experience/copy.ts:101 | inline |
| We sent a one-time code to your phone. | support line | lib/customer/experience/copy.ts:102 | inline |
| Last step | eyebrow | lib/customer/experience/copy.ts:105 | inline |
| Collect your first stamp | headline | lib/customer/experience/copy.ts:106 | inline |
| Accept the loyalty terms and we'll print stamp one onto your card. | support line | lib/customer/experience/copy.ts:108 | inline |
| Welcome back | eyebrow | lib/customer/experience/copy.ts:113 | inline |
| You're already joined | headline | lib/customer/experience/copy.ts:114 | inline |
| {current} of {total} stamps collected. | support line | lib/customer/experience/copy.ts:115 | inline |
| Open your stamp card | CTA label | lib/customer/experience/copy.ts:117 | inline |
| Today's stamp | eyebrow | lib/customer/experience/copy.ts:124,132 | inline |
| Stamp it here | headline | lib/customer/experience/copy.ts:125 | inline |
| You're stamped for today | headline | lib/customer/experience/copy.ts:132 | inline |
| Come back tomorrow to keep building your card. | support line | lib/customer/experience/copy.ts:133 | inline |
| View card | CTA label | lib/customer/experience/copy.ts:135 | inline |
| Reward collected | eyebrow | lib/customer/experience/copy.ts:146 | inline |
| Your reward has been collected. | support line | lib/customer/experience/copy.ts:148 | inline |
| Back to card | CTA label | lib/customer/experience/copy.ts:150 | inline |
| Welcome to {merchant} | headline | lib/customer/experience/copy.ts:167 | inline |
| Reward | eyebrow | lib/customer/experience/copy.ts:182 | inline |
| {merchant} — show this at the counter. | support line | lib/customer/experience/copy.ts:186 | inline |
| Unlocked — yours from {date}. | body (fn) | lib/customer/experience/copy.ts:192 | inline |
| Unlocked — yours from the next opening day. | body (fn) | lib/customer/experience/copy.ts:194 | inline |
| Nabaperks loyalty | eyebrow | lib/customer/experience/copy.ts:201 | inline |
| Card unavailable | headline | lib/customer/experience/copy.ts:202 | inline |
| Open my cards | CTA label | lib/customer/experience/copy.ts:205 | inline |

---

## Home dashboard — `app/home/(authed)/page.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| My Nabaperks | metadata.title | app/home/(authed)/page.tsx:12 | inline |
| My Nabaperks | eyebrow | app/home/(authed)/page.tsx:27 | inline |
| Your cards | h1/title | app/home/(authed)/page.tsx:28 | inline |
| Every card you've collected. Tap one to see its stamps and rewards. | description | app/home/(authed)/page.tsx:29 | inline |

## Home activity — `app/home/(authed)/activity/page.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Your activity · Nabaperks | metadata.title | app/home/(authed)/activity/page.tsx:12 | inline |
| My Nabaperks | eyebrow | app/home/(authed)/activity/page.tsx:31 | inline |
| Activity | title | app/home/(authed)/activity/page.tsx:32 | inline |
| Every stamp and reward across your cards, newest first. | description | app/home/(authed)/activity/page.tsx:33 | inline |
| Nothing here yet | empty title | app/home/(authed)/activity/page.tsx:38 | inline |
| Your stamps and rewards will appear here once you start visiting venues. | empty body | app/home/(authed)/activity/page.tsx:39 | inline |

_(Row item `badgeLabel`/`title`/`description` are data-derived, not static copy.)_

## Home profile — `app/home/(authed)/profile/page.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Your details · Nabaperks | metadata.title | app/home/(authed)/profile/page.tsx:13 | inline |
| My Nabaperks | eyebrow | app/home/(authed)/profile/page.tsx:32 | inline |
| Your details | title | app/home/(authed)/profile/page.tsx:33 | inline |
| How venues can reach you: phone, name, and optional email. | description | app/home/(authed)/profile/page.tsx:34 | inline |
| Finish your details | banner title | app/home/(authed)/profile/page.tsx:38 | inline |
| Add your name and date of birth so rewards are ready for collection. | banner body | app/home/(authed)/profile/page.tsx:39 | inline |
| venue / venues | inline label (fn) | app/home/(authed)/profile/page.tsx:25 | inline |
| Member since {monthYear} · {venueLabel} | footer line | app/home/(authed)/profile/page.tsx:59 | inline |

## Home rewards — `app/home/(authed)/rewards/page.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Your rewards · Nabaperks | metadata.title | app/home/(authed)/rewards/page.tsx:12 | inline |
| My Nabaperks | eyebrow | app/home/(authed)/rewards/page.tsx:23 | inline |
| Rewards | title | app/home/(authed)/rewards/page.tsx:24 | inline |
| Rewards you've earned across every venue, ready for merchant scan, on the way, and ones you've enjoyed. | description | app/home/(authed)/rewards/page.tsx:25 | inline |
| No rewards yet | empty title | app/home/(authed)/rewards/page.tsx:30 | inline |
| Keep collecting stamps. When you complete a card, the reward lands here. | empty body | app/home/(authed)/rewards/page.tsx:31 | inline |
| Ready for scan | section eyebrow | app/home/(authed)/rewards/page.tsx:38 | inline |
| Show these now | section title | app/home/(authed)/rewards/page.tsx:38 | inline |
| Coming soon | section eyebrow | app/home/(authed)/rewards/page.tsx:48 | inline |
| Almost there | section title | app/home/(authed)/rewards/page.tsx:49 | inline |
| Unlocked, but not redeemable just yet. | section desc | app/home/(authed)/rewards/page.tsx:50 | inline |
| Ready from {date}. | note (fn) | app/home/(authed)/rewards/page.tsx:59 | inline |
| Available from the next UK business day. | note | app/home/(authed)/rewards/page.tsx:60 | inline |
| History | section eyebrow | app/home/(authed)/rewards/page.tsx:69,88 | inline |
| Redeemed | section title | app/home/(authed)/rewards/page.tsx:69 | inline |
| Redeemed {date}. | note (fn) | app/home/(authed)/rewards/page.tsx:76 | inline |
| Redeemed. | note | app/home/(authed)/rewards/page.tsx:77 | inline |
| Expired | section title | app/home/(authed)/rewards/page.tsx:88 | inline |
| Rewards that are no longer available to scan. | section desc | app/home/(authed)/rewards/page.tsx:90 | inline |
| Expired {date}. | note (fn) | app/home/(authed)/rewards/page.tsx:99,101 | inline |
| Expired. | note | app/home/(authed)/rewards/page.tsx:102 | inline |

## Home error boundary — `app/home/(authed)/error.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| That didn't load | error title | app/home/(authed)/error.tsx:16 | inline |
| Something interrupted this page. Try again. Your cards and stamps are safe on the server. | error body | app/home/(authed)/error.tsx:17 | inline |

## Home login page — `app/home/login/page.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| My Nabaperks · sign in | metadata.title | app/home/login/page.tsx:13 | inline |
| My Nabaperks | roundel caption | app/home/login/page.tsx:40 | inline |
| Welcome back | h1 | app/home/login/page.tsx:44 | inline |
| Sign in to see every loyalty card you've collected, track your rewards, and pick up where you left off. | body | app/home/login/page.tsx:46 | inline |
| New here? Scan a venue's QR code to collect your first stamp — your first card is created automatically. | body | app/home/login/page.tsx:55 | inline |

## Home login error — `app/home/login/error.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Sign in unavailable | error title | app/home/login/error.tsx:15 | inline |
| Signing in could not be loaded safely. Your cards and stamps are safe — try again in a moment. | error body | app/home/login/error.tsx:16 | inline |
| Scan a venue QR | secondary action label | app/home/login/error.tsx:18 | inline |

## Home actions (login OTP / sign out) — `app/home/actions.ts`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Too many sign-in requests. Try again later. | error (form) | app/home/actions.ts:76 | inline |
| Verification code could not be sent. Try again shortly. | error (form) | app/home/actions.ts:99 | inline |
| If that number has Nabaperks cards, enter the code we sent. Otherwise scan a venue QR to join first. | message | app/home/actions.ts:107 | inline |
| Request a new phone code. | error (contact) | app/home/actions.ts:129 | inline |
| Enter the verification code. | error (otp) | app/home/actions.ts:137 | inline |
| Too many code attempts. Request a new code shortly. | error (form) | app/home/actions.ts:150 | inline |
| That code was not accepted. | error (form) | app/home/actions.ts:162 | inline |
| No cards found for that number yet. Scan a venue QR to join first. | message | app/home/actions.ts:170 | inline |

## Home profile actions — `app/home/(authed)/profile/actions.ts`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| We couldn't save your details. Try again. | error (form) | app/home/(authed)/profile/actions.ts:73 | inline |
| We couldn't email a code to that address. Try again. | error (email) | app/home/(authed)/profile/actions.ts:93 | inline |
| Enter the code we sent to your email to confirm it. | message | app/home/(authed)/profile/actions.ts:100 | inline |
| Your details are saved. | message | app/home/(authed)/profile/actions.ts:105 | inline |
| Enter the code from your email. | error (otp) | app/home/(authed)/profile/actions.ts:113 | inline |
| We couldn't check that code. Try again. | error (form) | app/home/(authed)/profile/actions.ts:119 | inline |
| That code didn't match. Check your email and try again. | error (otp) | app/home/(authed)/profile/actions.ts:124 | inline |
| We couldn't confirm your email. Try again. | error (form) | app/home/(authed)/profile/actions.ts:133 | inline |
| Your email is confirmed. | message | app/home/(authed)/profile/actions.ts:137 | inline |
| We couldn't update that preference. | error | app/home/(authed)/profile/actions.ts:157 | inline |
| We couldn't save that preference. Try again. | error | app/home/(authed)/profile/actions.ts:167 | inline |

---

## Card route — `app/card/[membershipId]/`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| My loyalty card | metadata.title | app/card/[membershipId]/page.tsx:11 | inline |
| Today's stamp | metadata.title | app/card/[membershipId]/stamp/page.tsx:12 | inline |
| Card unavailable | error title | app/card/[membershipId]/error.tsx:15 | inline |
| This card could not be loaded safely. Ask a team member for the current loyalty QR and try again. | error body | app/card/[membershipId]/error.tsx:16 | inline |
| Open my cards | secondary action label | app/card/[membershipId]/error.tsx:18 | inline |

## Self-stamp action — `app/card/[membershipId]/actions.ts`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Scan the venue code to add your stamp. | error | app/card/[membershipId]/actions.ts:32,37 | inline |
| _(block-reason error copy resolved via `blockReasonCopy()`)_ | error | app/card/[membershipId]/actions.ts:51,55 | inline (see block-reasons.ts) |

---

## Claim reward — `app/claim/[token]/page.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Claim your reward · Nabaperks | metadata.title | app/claim/[token]/page.tsx:24 | inline |
| Try again shortly | shell title | app/claim/[token]/page.tsx:56 | inline |
| Too many attempts from here. Please try again in a few minutes. | body | app/claim/[token]/page.tsx:58 | inline |
| You're unsubscribed | shell title | app/claim/[token]/page.tsx:68 | inline |
| You won't get invite emails about this reward again. | body | app/claim/[token]/page.tsx:70 | inline |
| Stop these emails? | shell title | app/claim/[token]/page.tsx:78 | inline |
| We only email once about a reward, but you can stop it here. | body | app/claim/[token]/page.tsx:80 | inline |
| Stop these emails | button | app/claim/[token]/page.tsx:85 | inline |
| This reward link isn't available | shell title | app/claim/[token]/page.tsx:100 | inline |
| It may have already been claimed or expired. If a venue told you to expect a reward, ask them to send it again. | body | app/claim/[token]/page.tsx:102 | inline |
| A local venue | fallback venue name | app/claim/[token]/page.tsx:116 | inline |
| A reward is waiting for you | shell title | app/claim/[token]/page.tsx:119 | inline |
| {venue} sent you {reward_name}. Sent to {masked_hint}. | body (composed) | app/claim/[token]/page.tsx:122-127 | inline |
| a reward | fallback reward name | app/claim/[token]/page.tsx:124 | inline |
| Sign in or join Nabaperks with the same contact and it lands in your rewards automatically. | body | app/claim/[token]/page.tsx:129 | inline |
| Sign in or join to claim | button/link | app/claim/[token]/page.tsx:133 | inline |

---

## Reward route — `app/reward/[rewardId]/`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| My reward | metadata.title | app/reward/[rewardId]/page.tsx:11 | inline |
| Reward unavailable | error title | app/reward/[rewardId]/error.tsx:15 | inline |
| This reward could not be loaded safely. Return to the customer card or ask a team member for help. | error body | app/reward/[rewardId]/error.tsx:16 | inline |
| Open my cards | secondary action label | app/reward/[rewardId]/error.tsx:18 | inline |
| Reward QR not found | HTTP 404 body (see notes) | app/reward/[rewardId]/qr.png/route.ts:23 | inline |
| Reward QR not ready | HTTP 404 body (see notes) | app/reward/[rewardId]/qr.png/route.ts:34 | inline |

## Reward profile-gate actions — `app/reward/[rewardId]/actions.ts`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| We couldn't save your details. Try again. | error (form) | app/reward/[rewardId]/actions.ts:64 | inline |
| We couldn't email a code to that address. Try again. | error (email) | app/reward/[rewardId]/actions.ts:74 | inline |
| Enter the code from your email. | error (otp) | app/reward/[rewardId]/actions.ts:93 | inline |
| We couldn't check that code. Try again. | error (form) | app/reward/[rewardId]/actions.ts:99 | inline |
| That code didn't match. Check your email and try again. | error (otp) | app/reward/[rewardId]/actions.ts:104 | inline |
| We couldn't confirm your email. Try again. | error (form) | app/reward/[rewardId]/actions.ts:113 | inline |

---

## Scan (top-level) — `app/scan/`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Scan venue QR | metadata.title | app/scan/page.tsx:11 | inline |
| Scanner unavailable | error title | app/scan/error.tsx:15 | inline |
| The scanner could not be opened safely. Try again, or point your phone's camera at the printed venue QR. | error body | app/scan/error.tsx:16 | inline |
| Open my cards | secondary action label | app/scan/error.tsx:18 | inline |

---

## Public QR resolve — `app/q/[qrId]/`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Venue QR | metadata.title | app/q/[qrId]/page.tsx:27 | inline |
| QR unavailable | eyebrow | app/q/[qrId]/page.tsx:99,103 | inline |
| This loyalty card is unavailable | empty title | app/q/[qrId]/page.tsx:107 | inline |
| Ask a team member for the current loyalty QR. | empty body | app/q/[qrId]/page.tsx:108 | inline |
| QR busy | eyebrow/screenLabel | app/q/[qrId]/page.tsx:120,122 | inline |
| Try again shortly | eyebrow | app/q/[qrId]/page.tsx:127 | inline |
| Too many scans just now | empty title | app/q/[qrId]/page.tsx:131 | inline |
| Wait a moment, then scan the venue QR again. Your card is safe. | empty body | app/q/[qrId]/page.tsx:132 | inline |
| Open my cards | CTA label | app/q/[qrId]/page.tsx:137 | inline |
| QR unavailable | error title | app/q/[qrId]/error.tsx:15 | inline |
| This QR could not be opened safely. Try again, or ask a team member for the current loyalty QR. | error body | app/q/[qrId]/error.tsx:16 | inline |
| Open my cards | secondary action label | app/q/[qrId]/error.tsx:18 | inline |

---

## Merchant landing — `app/m/[merchantSlug]/page.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Collect your stamp | metadata.title | app/m/[merchantSlug]/page.tsx:23 | inline |
| No-app loyalty | eyebrow | app/m/[merchantSlug]/page.tsx:56 | inline |
| Collect your stamp | title | app/m/[merchantSlug]/page.tsx:57 | inline |
| Save {business}'s card to your number, collect {n} stamps to unseal a mystery reward. No app, no plastic. | description | app/m/[merchantSlug]/page.tsx:58 | inline |
| Mystery reward, sealed | reward title | app/m/[merchantSlug]/page.tsx:84 | inline |
| Collect {n} stamps to unseal a surprise reward, yours from the next UK business day. | reward desc | app/m/[merchantSlug]/page.tsx:88-90 | inline |
| Join rewards | button/link | app/m/[merchantSlug]/page.tsx:97 | inline |
| View reward terms | sheet trigger | app/m/[merchantSlug]/page.tsx:108 | inline |
| This loyalty card is unavailable | banner title | app/m/[merchantSlug]/page.tsx:131 | inline |
| Ask a team member for the current loyalty QR. | banner body | app/m/[merchantSlug]/page.tsx:134 | inline |
| Venue unavailable | error title | app/m/[merchantSlug]/error.tsx:15 | inline |
| This venue page could not be loaded safely. Try again, or ask a team member for the current loyalty QR. | error body | app/m/[merchantSlug]/error.tsx:16 | inline |
| Open my cards | secondary action label | app/m/[merchantSlug]/error.tsx:18 | inline |

## Merchant join — `app/m/[merchantSlug]/join/`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Keep your card | metadata.title | app/m/[merchantSlug]/join/page.tsx:11 | inline |
| Join unavailable | error title | app/m/[merchantSlug]/join/error.tsx:15 | inline |
| This step could not be loaded safely. Your stamps are safe — try again, or ask a team member for help. | error body | app/m/[merchantSlug]/join/error.tsx:16 | inline |
| Open my cards | secondary action label | app/m/[merchantSlug]/join/error.tsx:18 | inline |

## Merchant join actions — `app/m/[merchantSlug]/join/actions.ts`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Too many verification requests. Try again later. | error (form) | app/m/[merchantSlug]/join/actions.ts:97 | inline |
| Verification code could not be sent. Try again shortly. | error (form) | app/m/[merchantSlug]/join/actions.ts:126 | inline |
| New code sent. It can take a moment to arrive. | message | app/m/[merchantSlug]/join/actions.ts:139 | inline |
| Request a new phone code. | error (contact) | app/m/[merchantSlug]/join/actions.ts:164 | inline |
| Enter the verification code. | error (otp) | app/m/[merchantSlug]/join/actions.ts:172 | inline |
| Too many code attempts. Request a new code shortly. | error (form) | app/m/[merchantSlug]/join/actions.ts:185 | inline |
| That code was not accepted. | error (form) | app/m/[merchantSlug]/join/actions.ts:196 | inline |
| Verify your phone before joining. | error (form) | app/m/[merchantSlug]/join/actions.ts:241 | inline |
| Accept the loyalty terms to join. | error (loyaltyTerms) | app/m/[merchantSlug]/join/actions.ts:245 | inline |
| Rewards could not be joined. Try again or ask the venue team. | error (form) | app/m/[merchantSlug]/join/actions.ts:274 | inline |

_(`app/r/[token]`, `app/q/[qrId]/loading.tsx`, `app/auth/confirm/route.ts`, `app/card/.../loading.tsx`, `app/reward/.../loading.tsx`, `app/m/.../loading.tsx` render no static screen copy — redirect/skeleton/route only.)_

---

## Component: CustomerCardExperience — `components/customer/customer-card-experience.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Something's under there. | reward name (sealed) | components/customer/customer-card-experience.tsx:108 | inline |
| Your reward | reward name fallback | components/customer/customer-card-experience.tsx:109 | inline |
| Mystery reward stays sealed until the final stamp. | reward desc | components/customer/customer-card-experience.tsx:130,131 | inline |
| Give it a day to breathe. {waitingRewardTiming} | reward desc (composed) | components/customer/customer-card-experience.tsx:139 | inline (+ shared:copy.ts timing) |
| Reward ready for merchant scan. | reward desc | components/customer/customer-card-experience.tsx:147 | inline |
| Your cards | back link | components/customer/customer-card-experience.tsx:167 | inline |
| That's the full card. | celebration title | components/customer/customer-card-experience.tsx:194 | inline |
| Your reward is ready, claim it at the counter while you're here. | celebration msg | components/customer/customer-card-experience.tsx:196 | inline |
| Your reward is yours from opening time on the next UK business day. | celebration msg | components/customer/customer-card-experience.tsx:197 | inline |
| Welcome to {merchant}. | banner title | components/customer/customer-card-experience.tsx:204 | inline |
| You're in, your first stamp is on the card. | banner body | components/customer/customer-card-experience.tsx:207 | inline |
| You're in. We couldn't add your first stamp just now, so scan the venue QR to collect your first stamp. | banner body | components/customer/customer-card-experience.tsx:209 | inline |
| You're in. Scan the venue QR in store to collect your first stamp. | banner body | components/customer/customer-card-experience.tsx:210 | inline |
| Stamp added. | banner title | components/customer/customer-card-experience.tsx:217 | inline |
| That's one. Your progress is saved. | banner body | components/customer/customer-card-experience.tsx:220 | inline |
| Reward redeemed. | banner title | components/customer/customer-card-experience.tsx:228 | inline |
| New stamp cycle started. | banner body | components/customer/customer-card-experience.tsx:231 | inline |
| Open reward QR | CTA (link) | components/customer/customer-card-experience.tsx:240 | inline |
| Give it a day to breathe | status title | components/customer/customer-card-experience.tsx:244 | inline |
| Stamp secured. | banner title | components/customer/customer-card-experience.tsx:250 | inline |
| Your next scan window opens on the next UK business day. | banner body | components/customer/customer-card-experience.tsx:251 | inline |
| Scan the venue code to add your stamp. | banner title | components/customer/customer-card-experience.tsx:256 | inline |
| Use the printed QR in the venue. One stamp is available per UK business day. | banner body | components/customer/customer-card-experience.tsx:259-260 | inline |
| Scan to stamp | CTA (link) | components/customer/customer-card-experience.tsx:263 | inline |
| Card details | disclosure summary | components/customer/customer-card-experience.tsx:283 | inline |
| One stamp per UK business day | dd/footer | components/customer/customer-card-experience.tsx:293 | inline |
| Something's under there. | reward name (stamp screen) | components/customer/customer-card-experience.tsx:333 | inline |
| See your reward | CTA (link) | components/customer/customer-card-experience.tsx:339 | inline |
| Back to card | CTA (link) | components/customer/customer-card-experience.tsx:344 | inline |
| Need a hand? | action-note title | components/customer/customer-card-experience.tsx:363 | inline |
| Ask a team member for the current loyalty QR, or open your cards to find them. | action-note body | components/customer/customer-card-experience.tsx:364-365 | inline |
| Stamps unavailable | status title (default) | components/customer/customer-card-experience.tsx:391 | inline |
| CARD Nº {ID} | mono card number (fn) | components/customer/customer-card-experience.tsx:405 | inline |

## Component: CustomerErrorState — `components/customer/customer-error-state.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Nabaperks | venue mark name/caption | components/customer/customer-error-state.tsx:35 | inline |
| _(retry button label via `retryButtonState()` — "Try again" / "Trying again")_ | button | components/customer/customer-error-state.tsx:50 | inline (see retry-button.ts) |

## Component: CustomerFlowShell / CustomerReceipt — `components/customer/customer-flow-system.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| nabaperks | brand wordmark | components/customer/customer-flow-system.tsx:76 | inline |
| Setup | progress label (default) | components/customer/customer-flow-system.tsx:126 | inline |
| Step {step} of {total} | progress readout | components/customer/customer-flow-system.tsx:127-128 | inline |
| ONE STAMP PER BUSINESS DAY | footer right (default) | components/customer/customer-flow-system.tsx:151 | inline |

## Component: CustomerLoginForm — `components/customer/customer-login-form.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Phone number | field label | components/customer/customer-login-form.tsx:50 | inline |
| 07400 123456 | placeholder | components/customer/customer-login-form.tsx:57 | inline |
| We'll send a one-time code by text. | helper hint | components/customer/customer-login-form.tsx:77 | shared:copy.ts (JOIN_PHONE_CODE_HINT) |
| If it does not arrive, check the number and resend the code. | helper | components/customer/customer-login-form.tsx:93 | inline |
| Sending… | button (pending) | components/customer/customer-login-form.tsx:100 | inline |
| Resend code | button | components/customer/customer-login-form.tsx:102 | inline |
| Send code | button | components/customer/customer-login-form.tsx:103 | inline |
| Phone code | field label | components/customer/customer-login-form.tsx:117 | inline |
| Checking… | button (pending) | components/customer/customer-login-form.tsx:142 | inline |
| Open my cards | button | components/customer/customer-login-form.tsx:142 | inline |

## Component: CustomerQrScannerLoader (loading fallback) — `components/customer/customer-qr-scanner-loader.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Customer scanner | eyebrow | components/customer/customer-qr-scanner-loader.tsx:27 | inline |
| Scan venue QR | h1 | components/customer/customer-qr-scanner-loader.tsx:31 | inline |
| Point your camera at a Nabaperks venue QR to collect your stamp. No app, no plastic. | body | components/customer/customer-qr-scanner-loader.tsx:34-35 | inline |
| Starting camera | mono status | components/customer/customer-qr-scanner-loader.tsx:51 | inline |
| Back to start | button/link | components/customer/customer-qr-scanner-loader.tsx:59 | inline |
| Open my cards | button/link | components/customer/customer-qr-scanner-loader.tsx:62 | inline |

## Component: CustomerQrScanner — `components/customer/customer-qr-scanner.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Customer scanner | eyebrow | components/customer/customer-qr-scanner.tsx:185 | inline |
| Scan venue QR | h1 | components/customer/customer-qr-scanner.tsx:187 | inline |
| Point your camera at a Nabaperks venue QR to collect your stamp. No app, no plastic. | body | components/customer/customer-qr-scanner.tsx:192-193 | inline |
| Starting camera… | live status | components/customer/customer-qr-scanner.tsx:159 | inline |
| Scanning for a Nabaperks QR… | live status | components/customer/customer-qr-scanner.tsx:161 | inline |
| QR found. Opening your venue card… | live status | components/customer/customer-qr-scanner.tsx:163 | inline |
| That is not a Nabaperks QR. Point your camera at the venue QR to collect a stamp. | live status | components/customer/customer-qr-scanner.tsx:165 | inline |
| Camera unavailable | live status | components/customer/customer-qr-scanner.tsx:166 | inline |
| Try the camera again | button | components/customer/customer-qr-scanner.tsx:229 | inline |
| Back to start | button/link | components/customer/customer-qr-scanner.tsx:235 | inline |
| Open my cards | button/link | components/customer/customer-qr-scanner.tsx:238 | inline |

## Scanner guidance (secondary detail lines) — `lib/customer/scanner-guidance.ts`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| We could not open your camera. Allow camera access, then try again. Or scan the venue QR with your phone's camera app. | detail | lib/customer/scanner-guidance.ts:23 | inline |
| Point your camera at the venue QR on the table or counter. | detail | lib/customer/scanner-guidance.ts:25 | inline |

## Component: HomeActivitySnippet — `components/customer/home-activity-snippet.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Recent activity | section eyebrow | components/customer/home-activity-snippet.tsx:28 | inline |
| Latest visits | section title | components/customer/home-activity-snippet.tsx:28 | inline |
| See all activity | link | components/customer/home-activity-snippet.tsx:54 | inline |

## Component: HomeBirthdayPrompt — `components/customer/home-birthday-prompt.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Birthday treat | tag | components/customer/home-birthday-prompt.tsx:64 | inline |
| Add your birthday for a treat on us | h2 | components/customer/home-birthday-prompt.tsx:65 | inline |
| Some venues give members a reward during their birthday month. Add yours and you won't miss it. | body | components/customer/home-birthday-prompt.tsx:68-70 | inline |
| Add your birthday | button/link | components/customer/home-birthday-prompt.tsx:74 | inline |
| Not now | button | components/customer/home-birthday-prompt.tsx:77 | inline |

## Component: HomeCardTile — `components/customer/home-card-tile.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Reward ready | tag | components/customer/home-card-tile.tsx:15 | inline |
| Reward soon | tag | components/customer/home-card-tile.tsx:16 | inline |
| Ready · {date} | reward-ready label (fn) | components/customer/home-card-tile.tsx:25 | inline |
| Back next opening day | reward-ready label | components/customer/home-card-tile.tsx:26 | inline |
| Open your {business} card | aria-label | components/customer/home-card-tile.tsx:32 | inline |
| Loyalty card | eyebrow fallback | components/customer/home-card-tile.tsx:37 | inline |
| Open reward QR | tag | components/customer/home-card-tile.tsx:47 | inline |
| Open card | tag | components/customer/home-card-tile.tsx:47 | inline |
| Your reward | reward eyebrow | components/customer/home-card-tile.tsx:74 | inline |
| Your reward | reward name fallback | components/customer/home-card-tile.tsx:78 | inline |
| _(status line via `homeCardStatusCopy()`)_ | body | components/customer/home-card-tile.tsx:85 | inline (see home-dashboard.ts) |

## home-dashboard status copy — `lib/customer/home-dashboard.ts`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Reward ready — show QR at the counter | status | lib/customer/home-dashboard.ts:31 | inline |
| This card is unavailable right now. | status fallback | lib/customer/home-dashboard.ts:33 | inline |
| Reward almost ready — back on the next opening day | status | lib/customer/home-dashboard.ts:39 | inline |
| Stamp secured for today | status | lib/customer/home-dashboard.ts:41 | inline |
| {current} of {required} stamps — {remaining} more to unlock | status | lib/customer/home-dashboard.ts:43 | inline |
| Open this card for the latest loyalty status | status fallback | lib/customer/home-dashboard.ts:45 | inline |

## Component: HomeEmptyState — `components/customer/home-empty-state.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Find the Nabaperks QR at the counter, then scan it here | list item | components/customer/home-empty-state.tsx:15 | inline |
| Save the card to your number — one text, no app | list item | components/customer/home-empty-state.tsx:16 | inline |
| Collect a stamp on every visit | list item | components/customer/home-empty-state.tsx:17 | inline |
| How it works | label | components/customer/home-empty-state.tsx:20 | inline |
| Scan a venue QR to start a card | empty title | components/customer/home-empty-state.tsx:25 | inline |
| Cards you collect live here. You don't have any yet. | empty body | components/customer/home-empty-state.tsx:26 | inline |
| Scan venue QR | button/link | components/customer/home-empty-state.tsx:45 | inline |

## Component: HomeRedeemBanner — `components/customer/home-redeem-banner.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Open reward QR for {reward} at {business} | aria-label | components/customer/home-redeem-banner.tsx:17 | inline |
| Ready for scan | tag | components/customer/home-redeem-banner.tsx:21 | inline |
| Show this QR at the counter when you are ready. | body | components/customer/home-redeem-banner.tsx:29 | inline |
| Open reward QR | mono footer | components/customer/home-redeem-banner.tsx:33 | inline |

## Component: HomeSummaryStrip — `components/customer/home-summary-strip.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| card / cards | count label (fn) | components/customer/home-summary-strip.tsx:9 | inline |
| reward ready / rewards ready | count label | components/customer/home-summary-strip.tsx:10 | inline |
| stamp today / stamps today | count label | components/customer/home-summary-strip.tsx:11 | inline |

## Component: CustomerIdentityForm / CustomerJoinForm — `components/customer/join-forms.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Phone number | field label | components/customer/join-forms.tsx:48 | inline |
| 07400 123456 | placeholder | components/customer/join-forms.tsx:57 | inline |
| We'll send a one-time code by text. | helper hint | components/customer/join-forms.tsx:74 | shared:copy.ts (JOIN_PHONE_CODE_HINT) |
| Sending… | button (pending) | components/customer/join-forms.tsx:89 | inline |
| Text me the code | button | components/customer/join-forms.tsx:89 | inline |
| Sending your code | sr-only status | components/customer/join-forms.tsx:92 | inline |
| See how stamps and rewards work | back link | components/customer/join-forms.tsx:103 | shared:copy.ts (JOIN_PHONE_BACK_LABEL) |
| Loyalty terms | eyebrow | components/customer/join-forms.tsx:149 | inline |
| Required | tag | components/customer/join-forms.tsx:150 | inline |
| I agree to keep this loyalty card and that stamps and rewards follow the {venue}, {platform} and {privacy} terms. | consent body (composed) | components/customer/join-forms.tsx:153-163 | inline |
| Marketing updates | eyebrow | components/customer/join-forms.tsx:174 | inline |
| Send me occasional offers from this business. Optional. | consent body | components/customer/join-forms.tsx:176 | inline |
| Finish here and your first stamp lands straight away — no second scan needed. | body | components/customer/join-forms.tsx:194-195 | inline |
| Stamping… | button (pending) | components/customer/join-forms.tsx:198 | inline |
| Get my first stamp | button | components/customer/join-forms.tsx:198 | inline |

## Component: CustomerOtpForm — `components/customer/join-otp-form.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Text code | field label | components/customer/join-otp-form.tsx:64 | inline |
| Enter the verification code sent to your phone. | helper hint | components/customer/join-otp-form.tsx:90 | inline |
| Checking… | submit pending label | components/customer/join-otp-form.tsx:103 | inline |
| Save my card | submit button | components/customer/join-otp-form.tsx:104 | inline |
| Sent to | label | components/customer/join-otp-form.tsx:121 | inline |
| Sending… | submit pending label | components/customer/join-otp-form.tsx:125 | inline |
| Resend code | submit button | components/customer/join-otp-form.tsx:127 | inline |
| Use a different number | link | components/customer/join-otp-form.tsx:143 | inline |

## Component: WelcomeStep — `components/customer/join-welcome-step.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Join the card | progress label | components/customer/join-welcome-step.tsx:37 | inline |
| View full venue terms | sheet trigger | components/customer/join-welcome-step.tsx:50 | inline |
| Already have a card? Use your number and we'll find it. | link | components/customer/join-welcome-step.tsx:62 | shared:copy.ts (JOIN_WELCOME_ALREADY_HAVE_CARD_LABEL) |
| Mystery reward, sealed | reward title | components/customer/join-welcome-step.tsx:91 | inline |
| Collect {n} stamps to unlock a surprise reward, yours from the next UK business day. | reward desc | components/customer/join-welcome-step.tsx:94-96 | inline |
| How it works | label | components/customer/join-welcome-step.tsx:106 | shared:copy.ts (JOIN_WELCOME_HOW_IT_WORKS_LABEL) |
| _(3 how-it-works steps)_ | list items | components/customer/join-welcome-step.tsx:110 | shared:copy.ts (JOIN_WELCOME_HOW_IT_WORKS) |

## Component: JoinWizard — `components/customer/join-wizard.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| You're unlocking | eyebrow | components/customer/join-wizard.tsx:180 | inline |
| {merchant} · {card} | compound label | components/customer/join-wizard.tsx:184,216 | inline |
| _(reward hook via `joinUnlockingRewardHook()`)_ | body | components/customer/join-wizard.tsx:187 | shared:copy.ts |
| Your first stamp | eyebrow | components/customer/join-wizard.tsx:211 | inline |
| Mystery reward, sealed | reward title | components/customer/join-wizard.tsx:229,293 | inline |
| {reward hook}, yours from the next UK business day. | reward desc (composed) | components/customer/join-wizard.tsx:232-236 | inline (+ shared:copy.ts hook) |
| You're already joined | banner title | components/customer/join-wizard.tsx:256 | inline |
| Your stamp card is ready. Continue from your current progress. | banner body | components/customer/join-wizard.tsx:257 | inline |
| Your assigned reward stays hidden until the final stamp and can be redeemed from the next UK business day. | reward desc | components/customer/join-wizard.tsx:294-298 | inline |
| Join the card | progress label | components/customer/join-wizard.tsx:349 | inline |
| This loyalty card is unavailable | banner title | components/customer/join-wizard.tsx:359 | inline |
| Ask a team member for the current loyalty QR. | banner body | components/customer/join-wizard.tsx:363 | inline |

## Component: legal sheet — `components/customer/legal-sheet.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Nº {docNumber} | mono doc number | components/customer/legal-sheet.tsx:80 | inline |
| platform | default trigger label | components/customer/legal-sheet.tsx:136 | inline |
| privacy | default trigger label | components/customer/legal-sheet.tsx:157 | inline |
| venue | trigger label | components/customer/legal-sheet.tsx:183 | inline |
| , (and) | consent link connectors | components/customer/legal-sheet.tsx:185,187 | inline |

_(Sheet title/description/cardTitle and all legal section bodies resolve from `lib/legal/content.ts` — OUTSIDE this slice; see Scope notes.)_

## Component: loading-skeletons — `components/customer/loading-skeletons.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| nabaperks | brand wordmark | components/customer/loading-skeletons.tsx:67 | inline |
| Loading | aria-label (role=status) | components/customer/loading-skeletons.tsx:47 | inline |
| Loading your cards | aria-label (role=status) | components/customer/loading-skeletons.tsx:262 | inline |

## Component: CustomerProfileAboutYou — `components/customer/profile-about-you.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| About you | section eyebrow | components/customer/profile-about-you.tsx:84 | inline |
| Your contact details | section title | components/customer/profile-about-you.tsx:84 | inline |
| Phone | detail label | components/customer/profile-about-you.tsx:116 | inline |
| Not set | detail value fallback | components/customer/profile-about-you.tsx:117,120,126 | inline |
| Verified | tag | components/customer/profile-about-you.tsx:118 | inline |
| Full name | detail label | components/customer/profile-about-you.tsx:120 | inline |
| Date of birth | detail label | components/customer/profile-about-you.tsx:122 | inline |
| Verified contact details are locked for account security. | body | components/customer/profile-about-you.tsx:133 | inline |
| Edit details | button | components/customer/profile-about-you.tsx:141 | inline |
| Full name | field label | components/customer/profile-about-you.tsx:164 | inline |
| Date of birth | field label | components/customer/profile-about-you.tsx:171 | inline |
| Verified email | banner title | components/customer/profile-about-you.tsx:180 | inline |
| {email} is verified and locked for account security. | banner body | components/customer/profile-about-you.tsx:181 | inline |
| Email (optional) | field label | components/customer/profile-about-you.tsx:186 | inline |
| Add one to get reward updates. We'll send a code to confirm it. | field hint | components/customer/profile-about-you.tsx:190 | inline |
| Details not saved | banner title | components/customer/profile-about-you.tsx:197 | inline |
| Saving… | button (pending) | components/customer/profile-about-you.tsx:204 | inline |
| Save changes | button | components/customer/profile-about-you.tsx:204 | inline |
| Cancel | button | components/customer/profile-about-you.tsx:212 | inline |
| Confirm your email | banner title | components/customer/profile-about-you.tsx:228 | inline |
| Enter the code we sent to {email} to verify it. | banner body | components/customer/profile-about-you.tsx:229 | inline |
| Email code | field label | components/customer/profile-about-you.tsx:235 | inline |
| Email not confirmed | banner title | components/customer/profile-about-you.tsx:262 | inline |
| Confirming… | button (pending) | components/customer/profile-about-you.tsx:268 | inline |
| Confirm email | button | components/customer/profile-about-you.tsx:268 | inline |
| Email me a new code | button | components/customer/profile-about-you.tsx:277 | inline |
| Continue without email | button | components/customer/profile-about-you.tsx:282 | inline |

## Component: profile-form-parts — `components/customer/profile-form-parts.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Email | detail label | components/customer/profile-form-parts.tsx:22,29,37 | inline |
| Not added | detail value | components/customer/profile-form-parts.tsx:22 | inline |
| Verified | tag | components/customer/profile-form-parts.tsx:29 | inline |
| Awaiting | tag | components/customer/profile-form-parts.tsx:39 | inline |

## Component: CustomerProfileGateForm — `components/customer/profile-gate-forms.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| A few details before this one's yours | banner title | components/customer/profile-gate-forms.tsx:53 | inline |
| Add your name and date of birth before collection — you must be 18 or over. Email is optional. | banner body | components/customer/profile-gate-forms.tsx:55-56 | inline |
| Full name | field label | components/customer/profile-gate-forms.tsx:61 | inline |
| Date of birth | field label | components/customer/profile-gate-forms.tsx:68 | inline |
| Verified email | banner title | components/customer/profile-gate-forms.tsx:76 | inline |
| {email} is verified and locked for account security. | banner body | components/customer/profile-gate-forms.tsx:77 | inline |
| Email (optional) | field label | components/customer/profile-gate-forms.tsx:82 | inline |
| We'll send a code to confirm it. | field hint | components/customer/profile-gate-forms.tsx:86 | inline |
| Details not saved | banner title | components/customer/profile-gate-forms.tsx:93 | inline |
| Saving… | button (pending) | components/customer/profile-gate-forms.tsx:99 | inline |
| Save my details | button | components/customer/profile-gate-forms.tsx:99 | inline |
| Confirm your email | banner title | components/customer/profile-gate-forms.tsx:119 | inline |
| Enter the code we sent to {email} to finish your profile. | banner body | components/customer/profile-gate-forms.tsx:120-121 | inline |
| Email code | field label | components/customer/profile-gate-forms.tsx:127 | inline |
| Email not confirmed | banner title | components/customer/profile-gate-forms.tsx:152 | inline |
| Confirming… | button (pending) | components/customer/profile-gate-forms.tsx:157 | inline |
| Confirm email | button | components/customer/profile-gate-forms.tsx:157 | inline |
| Email me a new code | button | components/customer/profile-gate-forms.tsx:169 | inline |
| Continue without email | button | components/customer/profile-gate-forms.tsx:174 | inline |

## Component: CustomerProfileMarketing — `components/customer/profile-marketing-consent.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Email | channel label | components/customer/profile-marketing-consent.tsx:23 | inline |
| Reward updates and offers by email. | channel helper | components/customer/profile-marketing-consent.tsx:24 | inline |
| SMS | channel label | components/customer/profile-marketing-consent.tsx:28 | inline |
| Occasional offers by text message. | channel helper | components/customer/profile-marketing-consent.tsx:29 | inline |
| WhatsApp | channel label | components/customer/profile-marketing-consent.tsx:32 | inline |
| Updates and offers on WhatsApp. | channel helper | components/customer/profile-marketing-consent.tsx:33 | inline |
| Marketing | section eyebrow | components/customer/profile-marketing-consent.tsx:65 | inline |
| Updates from your venues | section title | components/customer/profile-marketing-consent.tsx:65 | inline |
| Optional. Turning these off won't affect stamps or rewards. | body | components/customer/profile-marketing-consent.tsx:67 | inline |
| You choose this when you join a venue — change it here any time. | body | components/customer/profile-marketing-consent.tsx:88 | inline |
| Receive {label} updates | sr-only label | components/customer/profile-marketing-consent.tsx:144 | inline |

## marketing-consent row state — `lib/customer/experience/marketing-consent-row.ts`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Couldn't save — try again | live-region msg | lib/customer/experience/marketing-consent-row.ts:62 | inline |
| Saved | live-region msg | lib/customer/experience/marketing-consent-row.ts:63 | inline |

## Component: PushNotificationSettingsDisclosure — `components/customer/push-notification-settings-disclosure.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Push | section eyebrow | components/customer/push-notification-settings-disclosure.tsx:29 | inline |
| Browser notifications | section title | components/customer/push-notification-settings-disclosure.tsx:29 | inline |

## Component: PushNotificationSettings — `components/customer/push-notification-settings.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Stamps and rewards | pref label | components/customer/push-notification-settings.tsx:44 | inline |
| Card progress, reward readiness, and collection updates. | pref helper | components/customer/push-notification-settings.tsx:45 | inline |
| Reminders | pref label | components/customer/push-notification-settings.tsx:49 | inline |
| Next stamp windows and reward expiry notices. | pref helper | components/customer/push-notification-settings.tsx:50 | inline |
| Venue offers | pref label | components/customer/push-notification-settings.tsx:54 | inline |
| Only sent when your venue consent also allows it. | pref helper | components/customer/push-notification-settings.tsx:55 | inline |
| Push is on for this browser. | message | components/customer/push-notification-settings.tsx:162 | inline |
| Push could not be enabled here. | message | components/customer/push-notification-settings.tsx:166 | inline |
| Push is off for this browser. | message | components/customer/push-notification-settings.tsx:190 | inline |
| Push could not be changed here. | message | components/customer/push-notification-settings.tsx:194 | inline |
| Preference was not saved. | message | components/customer/push-notification-settings.tsx:213 | inline |
| Push | section eyebrow | components/customer/push-notification-settings.tsx:228 | inline |
| Browser notifications | section title | components/customer/push-notification-settings.tsx:228 | inline |
| Turn off push | button | components/customer/push-notification-settings.tsx:258 | inline |
| Enable push | button | components/customer/push-notification-settings.tsx:267 | inline |
| Checking this browser | status title | components/customer/push-notification-settings.tsx:327 | inline |
| Push status will appear here. | status body | components/customer/push-notification-settings.tsx:328 | inline |
| Push is not available | status title | components/customer/push-notification-settings.tsx:333 | inline |
| This browser cannot receive Nabaperks push. | status body | components/customer/push-notification-settings.tsx:334 | inline |
| Install needed | status title | components/customer/push-notification-settings.tsx:339 | inline |
| Add Nabaperks to your home screen to enable push. | status body | components/customer/push-notification-settings.tsx:340 | inline |
| Push is blocked | status title | components/customer/push-notification-settings.tsx:345 | inline |
| Change browser permission before enabling push here. | status body | components/customer/push-notification-settings.tsx:346 | inline |
| Push is on | status title | components/customer/push-notification-settings.tsx:351 | inline |
| This browser can receive loyalty updates. | status body | components/customer/push-notification-settings.tsx:352 | inline |
| Push needs attention | status title | components/customer/push-notification-settings.tsx:357 | inline |
| Try again or use this page from another browser. | status body | components/customer/push-notification-settings.tsx:358 | inline |
| Push is ready | status title | components/customer/push-notification-settings.tsx:363 | inline |
| Enable this browser for loyalty updates. | status body | components/customer/push-notification-settings.tsx:364 | inline |

## Component: RewardCollectionLive — `components/customer/reward-collection-live.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Reward collected. Updating your screen. | sr-only status | components/customer/reward-collection-live.tsx:104 | inline |
| Waiting for the merchant to scan your reward QR. | sr-only status | components/customer/reward-collection-live.tsx:106 | inline |

## Component: RewardCollectionQr — `components/customer/reward-collection-qr.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| We could not show your reward QR | banner title | components/customer/reward-collection-qr.tsx:60 | inline |
| Pull down to refresh, or ask a team member. | banner body | components/customer/reward-collection-qr.tsx:62 | inline |
| Still not showing? You may be signed out on this phone — sign in with your number to bring it back. | banner body (composed) | components/customer/reward-collection-qr.tsx:65-74 | inline |
| sign in with your number | link text | components/customer/reward-collection-qr.tsx:72 | inline |
| Show a fresh QR | button | components/customer/reward-collection-qr.tsx:85 | inline |
| Merchant-scan QR for {rewardName} | figure aria-label | components/customer/reward-collection-qr.tsx:89 | inline |
| QR code for collecting {rewardName} | img alt | components/customer/reward-collection-qr.tsx:100 | inline |
| Merchant scans this QR from their device | body | components/customer/reward-collection-qr.tsx:115 | inline |

## Component: reward-list-cards — `components/customer/reward-list-cards.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Ready | tag | components/customer/reward-list-cards.tsx:39 | inline |
| Open reward QR | button/link | components/customer/reward-list-cards.tsx:51 | inline |

_(`No additional exclusions configured.` at line 24 is a sentinel string used to HIDE the terms text — not rendered as copy.)_

## Component: reward-panels — `components/customer/reward-panels.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Mystery reward | eyebrow | components/customer/reward-panels.tsx:34,60 | inline |
| Give it a day to breathe | banner title | components/customer/reward-panels.tsx:43 | inline |
| _(waiting timing via `waitingRewardTiming()`)_ | banner body | components/customer/reward-panels.tsx:44 | shared:copy.ts |
| Return to card | button/link | components/customer/reward-panels.tsx:47 | inline |
| Ready for merchant scan. | banner title | components/customer/reward-panels.tsx:73 | inline |
| Redeemed | eyebrow | components/customer/reward-panels.tsx:104 | inline |
| Reward collected. | banner title | components/customer/reward-panels.tsx:113 | inline |
| The merchant has scanned your QR. A new stamp cycle has started. | banner body | components/customer/reward-panels.tsx:114 | inline |
| CARD Nº {ID} | mono footer (fn) | components/customer/reward-panels.tsx:158 | inline |

## Component: StampCollector — `components/customer/stamp-collector.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| That's every stamp on this card. | hint | components/customer/stamp-collector.tsx:52 | inline |
| Stamp secured. Your next scan window opens on the next UK business day. | hint | components/customer/stamp-collector.tsx:54 | inline |
| Adding your stamp, keep this screen open a moment. | hint | components/customer/stamp-collector.tsx:56 | inline |
| Press and hold the stamp, or tap it, to add today's mark. | hint | components/customer/stamp-collector.tsx:58 | inline |
| You're stamped for today. Come back tomorrow. | hint | components/customer/stamp-collector.tsx:59 | inline |
| That's the full card. | celebration title | components/customer/stamp-collector.tsx:124 | inline |
| Your mystery reward is unlocked. | celebration msg | components/customer/stamp-collector.tsx:125 | inline |
| Stamp added. | banner title | components/customer/stamp-collector.tsx:130 | inline |
| That's one. Your progress is saved. | banner body | components/customer/stamp-collector.tsx:131 | inline |
| Mystery reward stays sealed until the final stamp. | reward desc | components/customer/stamp-collector.tsx:249 | inline |
| Stamp not added | banner title | components/customer/stamp-collector.tsx:277 | inline |
| If this keeps failing, ask the venue team to check today's stamp from their console. | banner body | components/customer/stamp-collector.tsx:283-284 | inline |
| This venue may try a soft location check within {n}m. Your stamp still saves if your phone cannot share location. | body | components/customer/stamp-collector.tsx:293-295 | inline |

## stamp announcement (live region) — `lib/customer/experience/stamp-announcement.ts`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Stamp added. That's the full card, your reward is unlocked. | live-region | lib/customer/experience/stamp-announcement.ts:31 | inline |
| Stamp added. That's {current} of {total}. | live-region | lib/customer/experience/stamp-announcement.ts:32 | inline |
| Adding your stamp. | live-region | lib/customer/experience/stamp-announcement.ts:34 | inline |

## Component: StampPressButton — `components/customer/stamp-press-button.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Add today's stamp | button aria-label (default) | components/customer/stamp-press-button.tsx:83 | inline |
| Stamp added | button aria-label (secured) | components/customer/stamp-press-button.tsx:217 | inline |
| Tap, or press and hold, to add today's stamp. | sr-only hint | components/customer/stamp-press-button.tsx:257 | inline |

## Component: UnavailableRecoveryActions — `components/customer/unavailable-recovery.tsx`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Scan a QR | button/link | components/customer/unavailable-recovery.tsx:19 | inline |
| Open my cards | button/link | components/customer/unavailable-recovery.tsx:22 | inline |

## block reasons (stamp/redeem error copy) — `lib/customer/experience/block-reasons.ts`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| You're already stamped today. Come back tomorrow. | error | lib/customer/experience/block-reasons.ts:63 | inline |
| Your reward is ready — redeem it before collecting more stamps. | error | lib/customer/experience/block-reasons.ts:65 | inline |
| This venue isn't taking stamps yet. | error | lib/customer/experience/block-reasons.ts:67 | inline |
| You're going a little fast. Wait a few minutes, then try again. | error | lib/customer/experience/block-reasons.ts:69 | inline |
| Your reward is almost ready. The venue is still finishing its reward setup, so ask a team member. | error | lib/customer/experience/block-reasons.ts:71 | inline |
| Verify your identity from the venue QR before continuing. | error | lib/customer/experience/block-reasons.ts:73 | inline |
| Add your details before collection — a name and date of birth, plus a verified email if you add one. | error | lib/customer/experience/block-reasons.ts:75 | inline |
| This loyalty programme is unavailable right now. | error | lib/customer/experience/block-reasons.ts:77 | inline |
| That didn't go through. Try again or ask the venue team. | error | lib/customer/experience/block-reasons.ts:79 | inline |

## issued-reward display badges — `lib/customer/issued-reward-display.ts`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Birthday treat | source badge | lib/customer/issued-reward-display.ts:41 | inline |
| Sent by {business} | source badge | lib/customer/issued-reward-display.ts:43 | inline |
| Expires {date} | expiry note | lib/customer/issued-reward-display.ts:51 | inline |

## redeemed-proof line — `lib/customer/experience/redeemed-proof.ts`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Collected {date} · {venue} | proof line | lib/customer/experience/redeemed-proof.ts:34 | inline |

## retry-button state — `lib/customer/experience/retry-button.ts`

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Trying again | retry button (pending) | lib/customer/experience/retry-button.ts:14 | inline |
| Try again | retry button | lib/customer/experience/retry-button.ts:15 | inline |

---

## components/loyalty/** (shared loyalty primitives)

### progress-track.tsx
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Reward progress | label (default) | components/loyalty/progress-track.tsx:8 | inline |
| {label}: {current} of {total} | aria-label | components/loyalty/progress-track.tsx:28 | inline |

### qr-frame.tsx
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Scanner-safe QR code | figure aria-label (default) | components/loyalty/qr-frame.tsx:7 | inline |

### reward-celebration.tsx
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Card complete | section aria-label | components/loyalty/reward-celebration.tsx:33 | inline |

### reward-seal.tsx (default aria-labels)
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Mystery reward, sealed | aria-label (sealed) | components/loyalty/reward-seal.tsx:31 | inline |
| Reward unlocked, resting until it's ready | aria-label (waiting) | components/loyalty/reward-seal.tsx:32 | inline |
| Reward ready for merchant scan | aria-label (ready) | components/loyalty/reward-seal.tsx:33 | inline |
| Reward redeemed | aria-label (redeemed) | components/loyalty/reward-seal.tsx:34 | inline |

### reward-ticket.tsx
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Mystery reward | kicker (sealed) | components/loyalty/reward-ticket.tsx:13 | inline |
| Your reward | kicker (waiting) | components/loyalty/reward-ticket.tsx:14 | inline |
| Your reward · ready | kicker (ready) | components/loyalty/reward-ticket.tsx:15 | inline |
| Redeemed | kicker (redeemed) | components/loyalty/reward-ticket.tsx:16 | inline |
| Sealed | stub word | components/loyalty/reward-ticket.tsx:21 | inline |
| Unlocked | stub word | components/loyalty/reward-ticket.tsx:22 | inline |
| Ready | stub word | components/loyalty/reward-ticket.tsx:23 | inline |
| Done | stub word | components/loyalty/reward-ticket.tsx:24 | inline |
| Reward | section aria-label | components/loyalty/reward-ticket.tsx:61 | inline |
| Ready · {readyDate} | mono chip | components/loyalty/reward-ticket.tsx:97 | inline |
| Redeemed | stamp overlay | components/loyalty/reward-ticket.tsx:108 | inline |

### stamp-dot.tsx (aria-labels are data-derived: `Stamp N earned/empty`, optionally `, {date}` — composed at call sites, see stamp-grid)

### stamp-grid.tsx
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Mystery reward | RewardChip label (default) | components/loyalty/stamp-grid.tsx:31 | inline |
| {label}, ready for merchant scan / {label}, sealed | RewardSeal aria-label (composed) | components/loyalty/stamp-grid.tsx:67 | inline |
| Ready | chip caption | components/loyalty/stamp-grid.tsx:73 | inline |
| Reward | chip caption | components/loyalty/stamp-grid.tsx:73 | inline |
| {current} of {total} stamps earned[, mystery reward at the end] | list aria-label | components/loyalty/stamp-grid.tsx:141 | inline |
| Stamp {n} earned / Stamp {n} empty | stamp dot label | components/loyalty/stamp-grid.tsx:171 | inline |

### stamp-journey-preview.tsx
| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| Example loyalty journey: {n} stamps then a mystery reward | list aria-label | components/loyalty/stamp-journey-preview.tsx:41 | inline |
| Stamp {n} earned / Stamp {n} empty | stamp dot label | components/loyalty/stamp-journey-preview.tsx:73 | inline |

### reward-teaser.tsx / status-banner.tsx / index.ts / use-stamp-journey-loop.ts
_No user-facing string literals (teaser is a shim; status-banner takes copy via props; the loop/index have no copy)._

---

## components/pwa/app-pwa.tsx (PWA install prompt)

| Copy (verbatim) | Type | Location | Source |
|---|---|---|---|
| On iPhone, open Safari's Share menu, then choose Add to Home Screen. | iOS install desc | components/pwa/app-pwa.tsx:30 | inline |
| Install Nabaperks admin | prompt title (admin) | components/pwa/app-pwa.tsx:35 | inline |
| Open support tools from your device without finding a tab. | prompt desc (admin) | components/pwa/app-pwa.tsx:36 | inline |
| Install My Nabaperks | prompt title (customer) | components/pwa/app-pwa.tsx:39 | inline |
| Keep your loyalty cards one tap from the home screen. | prompt desc (customer) | components/pwa/app-pwa.tsx:40 | inline |
| Install Nabaperks | prompt title (marketing) | components/pwa/app-pwa.tsx:43 | inline |
| Keep Nabaperks handy on this device. | prompt desc (marketing) | components/pwa/app-pwa.tsx:44 | inline |
| Install Nabaperks merchant | prompt title (merchant) | components/pwa/app-pwa.tsx:47 | inline |
| Keep the counter console ready on this device. | prompt desc (merchant) | components/pwa/app-pwa.tsx:48 | inline |
| Install Nabaperks | aside aria-label | components/pwa/app-pwa.tsx:274 | inline |
| 1. Tap Share | step chip | components/pwa/app-pwa.tsx:302 | inline |
| 2. Add to Home Screen | step chip | components/pwa/app-pwa.tsx:304 | inline |
| Not now | button | components/pwa/app-pwa.tsx:310 | inline |
| Install | button | components/pwa/app-pwa.tsx:313 | inline |

---

## Micro-labels (generic, recurring)

| Label | ~count |
|---|---|
| Open my cards | ~13 (across error boundaries, unavailable states, scanner, login form, tab-bar reachable states) |
| Back to card / Return to card | ~4 |
| Cancel | 1 (profile edit) |
| Not now | ~2 (birthday prompt, PWA install) |
| Sending… | ~3 (login, join phone, otp resend) |
| Checking… | ~2 (login verify, otp verify) |
| Confirming… | ~2 (profile email verify — home + gate) |
| Saving… | ~2 (profile save — home + gate) |
| Save changes / Save my details / Save my card | ~3 (distinct wordings) |
| Confirm email | ~2 (home + gate) |
| Email me a new code | ~2 (home + gate) |
| Continue without email | ~2 (home + gate) |
| Resend code / Send code | ~3 |
| Loading / Loading your cards | ~2 (skeleton aria-labels) |
| Scan venue QR / Scan a QR / Scan to stamp | ~5 (distinct scan CTAs) |
| Back to start | 2 (scanner + loader) |
| Open reward QR | ~5 |

---

## Scope notes / surprises

- **Copy sourced from OUTSIDE this slice (not `copy.ts`):**
  - `lib/customer/experience/copy.ts` is the named "shared copy module," but it holds only a small slice of the journey (view-model eyebrow/headline/support/CTA + join how-it-works + waiting-timing). The **bulk of customer copy is inline** in components, and a further large set lives in **other pure helper modules** under `lib/customer/**` (`block-reasons.ts`, `home-dashboard.ts`, `scanner-guidance.ts`, `stamp-announcement.ts`, `redeemed-proof.ts`, `issued-reward-display.ts`, `marketing-consent-row.ts`, `retry-button.ts`) — all tagged `inline` above at their own file:line. A consistency audit should treat these helper modules as de-facto copy sources even though they are not `copy.ts`.
  - The legal sheets (`components/customer/legal-sheet.tsx`) render titles, descriptions, `cardTitle`, doc numbers, and all section bodies from **`lib/legal/content.ts`** (venue terms / platform terms / privacy) — that file is outside this slice's paths and was not inventoried here. Only the sheet trigger labels ("venue", "platform", "privacy", "View reward terms", "View full venue terms") and connectors are inline.

- **Within-slice duplication (candidates for the cross-surface audit):**
  - "Ask a team member for the current loyalty QR." appears verbatim in `app/q/[qrId]/page.tsx`, `app/m/[merchantSlug]/page.tsx`, and `components/customer/join-wizard.tsx` (and near-variants in every error boundary).
  - "This loyalty card is unavailable" — `app/q/[qrId]/page.tsx`, `app/m/[merchantSlug]/page.tsx`, `join-wizard.tsx`. Note `home-dashboard.ts` uses the slightly different "This card is unavailable right now."
  - "Mystery reward, sealed" — `app/m/[merchantSlug]/page.tsx`, `join-welcome-step.tsx`, `join-wizard.tsx` (×2). `reward-seal.tsx` default label is the near-identical "Mystery reward, sealed" and `reward-ticket.tsx` kicker is "Mystery reward".
  - "Point your camera at a Nabaperks venue QR to collect your stamp. No app, no plastic." duplicated between the scanner loader fallback and the live scanner (intentional, per CUS-P2-11 comment — flagged for awareness only).
  - "Open reward QR" appears as a tag, mono footer, and button/link across home-card-tile, home-redeem-banner, reward-list-cards, and customer-card-experience.
  - "That's one. Your progress is saved." and "Stamp added." appear in both `customer-card-experience.tsx` and `stamp-collector.tsx`.
  - "Give it a day to breathe" appears in `customer-card-experience.tsx` and `reward-panels.tsx`.
  - "Continue without email" / "Email me a new code" / "Confirm your email" banners are near-identical across `profile-about-you.tsx` (home) and `profile-gate-forms.tsx` (reward redeem gate); the reward-gate variant adds "you must be 18 or over."
  - The `waitingRewardTiming()` string "It's yours from …" (copy.ts) and `waitingRewardSupportLine()`/`rewardViewModel` "Unlocked — yours from …" (copy.ts) both encode the same next-opening-day timing with different wording.
  - "CARD Nº {ID}" card-number formatter is duplicated inline in `customer-card-experience.tsx:405` and `reward-panels.tsx:158`.

- **Brand naming inconsistency:** the product reads as **"Nabaperks"** / **"My Nabaperks"** throughout customer copy. The system prompt also referenced "Stampiee" — that name does NOT appear anywhere in this customer slice.

- **Non-UI / edge strings noted, not counted as screen copy:**
  - `app/reward/[rewardId]/qr.png/route.ts` returns plain-text HTTP 404 bodies "Reward QR not found" / "Reward QR not ready". These are image-endpoint responses; the visible fallback the customer actually sees is the `RewardCollectionQr` error banner. Listed in the reward-route table for completeness but they are not rendered as UI text.
  - `app/reward/[rewardId]/status/route.ts` returns only machine JSON error codes ("unauthenticated", "not_found") — not user-facing.
  - `app/home/session/reset/route.ts`, `app/r/[token]/page.tsx`, `app/auth/confirm/route.ts` are redirect-only (no copy). Note: `auth/confirm` redirects failures to `/login?error=verification`, a merchant-side route outside this slice.

- **No TODO / placeholder / lorem copy** was found in the customer slice. Comments reference spec IDs (CUS-Pn-nn / VCU-Pn-nn) but no unfinished user-facing text.

- **Dev harness (`app/dev/**`, excluded):** `reward-list-cards.tsx`'s doc comment states its cards are shared with the `/dev` home-harness; the harness reuses the real components rather than hardcoding copy, so there is no divergent harness-only customer copy to flag.

# Copy & CTA Inventory

Every user-facing string captured from the prototype, grouped by surface and screen, transcribed verbatim (en-GB). The voice rules and glyph set live in [design-system.md §7](design-system.md#7-voice--iconography-copy-conventions).

**House rules observed throughout:** plain warm British English; **no emoji; no exclamation marks**; the only non-letter marks are the glyphs `✱ ? ✓ ▸ ⌫ ·` and masked-data dots (`···`/`●`). Demo/jump shortcuts (dashed `▸` tags) are prototype chrome.

---

## Marketing (`50-marketing.jsx`)

**Marquee:** `NO APP · NO PLASTIC · NO PASSWORD · STAMPED IN SECONDS ·`

**Hero (home):**

- Eyebrow: `For UK counters`
- H1: `Loyalty, stamped before the coffee cools.`
- Sub: `A paper stamp card that lives in the customer's browser. They scan your till QR, you stamp with a PIN, a mystery reward unseals on visit three.`
- CTAs: `Start a 30-day pilot` · `Watch the counter moment`
- Line: `£29/month after the pilot · one price, one venue`
- Demo card: `The Old Crown · Bristol` / `Free hot drink after 3 visits` / `CARD Nº OC-0248` / `1 VISIT TO THE SEAL`

**Three steps (home):**

- `01 Scan` — "Customers point a camera at your till card. The stamp card opens in the browser — nothing to install."
- `02 Stamp` — "They hand the phone over; staff type a 4-digit PIN. A rubber stamp slams down. That's the whole transaction."
- `03 Unseal` — "Visit three breaks a wax seal on a mystery reward from your pool. Redeemable from the next day."
- Strip line: `Built for cafes, barbers, bakeries & bars · UK pilot now open`

**Counter-moment band (`MK_BEATS`):**

- Eyebrow `The counter moment`; H2 `Four beats, under ten seconds.`; CTA `Play the slam`
- Sub: "The whole product is one small piece of theatre at the till. Choreographed so the queue never notices."
- BEAT 01 `Scan` — "Camera up at the till card. The stamp card opens in the browser — two seconds, no app store detour."
- BEAT 02 `Hand over` — "The phone crosses the counter, screen first. Same ritual as a paper card, minus the soggy cardboard."
- BEAT 03 `PIN` — "Staff tap today's 4-digit PIN. It rotates itself nightly at 04:00, so there's nothing to remember on a Friday."
- BEAT 04 `Slam` — "The stamp slams, the receipt shakes. On visit three a wax seal breaks over a mystery reward."

**Testimonials (`MK_QUOTES`):** eyebrow `From the pilot`, H2 `Counters that kept it.`

- "Regulars hand their phone over before they've even ordered. It's the bit of theatre our counter was missing." — `Maya · Manager`, The Old Crown, Bristol
- "Set up between the lunch rush and the school run. Nobody has once asked where the app is." — `Fern · Owner`, Fern & Loaf, Bath
- "The seal is silly and brilliant. People book a third cut just to break the thing open." — `Marlowe · Barber`, Marlowe's, Leeds

**Pricing teaser (home):** `After the 30-day pilot` → `£29/month` → `One price · one venue · no contracts` → `Unlimited stamps, the mystery pool, the printed QR kit — everything, no tiers.` → CTA `See what's included` → `No card to start the pilot`

**Pricing page (`MkPricing`):**

- Headline `One price. The whole machine.`
- Sub: `£29 a month per venue, after a free 30-day pilot. No tiers, no seats, no "contact sales".`
- Plan: `Growth plan · per venue`, badge `The only plan`, price `£29/month`
- `Billed monthly through Stripe · VAT included` · `Everything included` · `No card to start · cancel any time`
- Bullets (`MK_PLAN_BULLETS`):
  1. `Unlimited stamps & members`
  2. `Mystery reward pool — you pick the prizes`
  3. `Printed QR kit: A4 poster, till card, sticker`
  4. `Staff PIN that rotates itself nightly at 04:00`
  5. `Weekly digest of visits, regulars & redemptions`
- The pilot: `30 days free. No card. If it doesn't earn its keep, walk away.` + `After day 30` callout
- CTAs: `Start your 30-day pilot` (×2)

**FAQ (`MK_FAQS`)** — heading `Asked at the counter`:

1. `Is there a contract?` — "No. It's month to month after the pilot — £29, one venue, one month's notice to leave. The pilot itself needs no card at all."
2. `Do I need any hardware?` — "None. Customers use their own phones, and staff approve stamps by typing a 4-digit PIN on the customer's screen. The only kit is printed paper — we send print-ready files."
3. `Who owns the customer data?` — "You do, scoped to your venue. Phone numbers are stored hashed and shown masked, nothing is sold, and marketing texts only ever go to customers who tick the separate opt-in. UK GDPR throughout."
4. `What counts as a visit?` — "One stamp per customer per UK business day, approved by staff PIN at the counter. No drive-by stamping from the bus stop."
5. `What if I want to cancel?` — "One month's notice from your billing page, any time. Earned rewards stay redeemable while things wind down, so no regular is left holding a broken seal."

**Legal page (`MkLegal`):**

- Eyebrow `Plain English summary · not the full legal text`; H1 `The small print, kept legible.`
- Sub: "Two receipts: what everyone agrees to, and what happens to the data. The full versions arrive with your merchant agreement."
- CTA `Back to the homepage`; per-column footnote `Full text travels with your merchant agreement`
- `MK_TERMS` = `Terms, condensed` · `Nº T-2026` (4 rows); `MK_PRIVACY` = `Privacy, condensed` · `Nº P-2026` (4 rows) — full text in [MkLegal.md](components/marketing/MkLegal.md)

**Nav / footer:**

- Nav links: `Merchant login`, `Start free`, `← Home`, `Pricing`
- Footer tagline `For UK counters`; links `Terms` · `Privacy` · `Restart flow`; `© 2026 Nabaperks · Bristol · Stamped, not tracked`

---

## Customer (`30-customer.jsx`)

**Scan (`CuScanView`):** `Point your camera at the till card` → `Found it — opening your card`; chrome `Camera` · `Thu 12 Jun`; till card `The Old Crown · Bristol` / `Free hot drink after 3 visits` / `Scan to join · no app, no plastic`; `QR found`; `Looking for a code… · tap to skip` → `nabaperks.app/q/oc-0248`; footnote `Scans are rate-limited to 60 a minute — a busy counter is fine`

**Header (all states):** wordmark `nabaperks` (with `✱`); demo `Restart flow`

**Shared receipt body:** `The Old Crown · Bristol` / `Free hot drink after 3 visits` / `CARD Nº OC-0248` / saved `SAVED TO 07123···89` / unsaved `UNSAVED · THIS BROWSER`

**landing:** `Scanned at the counter` · `Your first stamp is waiting.` · "The Old Crown stamps this card every visit. Three visits unseal a mystery reward. No app — it lives right here." · CTA `Collect my first stamp` · `No signup yet · takes ten seconds`

**firstStamp:** `Stamped` · `That's one.` · "Two more visits and the seal breaks. Keep the card so it survives a closed tab." · `Keep my card` · `Maybe later`

**save:** `Keep your card` · "One text, no password. Your stamp is already on the card." · label `Mobile number` · placeholder `07123 456789` · `Text me the code` · `Skip for now`

**otp:** `Enter the code` · `Sent to {phone || "07123 456789"} · expires in 10 min` · `Save my card` · demo `Autofill code` · "Texts are limited to five each quarter hour — plenty for one card"

**card:** `Your card` · tag `Saved`/`Unsaved` · `Mystery reward, sealed` · `{3 − visits} more visit(s) to break it open.` · `I'm at the counter — stamp it` · `Today's stamp is on · one per day` · `Save this card` · demo `See what staff see`

**alreadyStamped:** `Today's done` · `One stamp a day keeps it fair.` · "Today's stamp is already drying on your card. The next one's waiting whenever you're back." · `Next stamp` · `One per UK business day.` · `From 13 Jun` · `Back to my card` · demo `Skip to tomorrow`

**sealed:** `Three visits` · `Something's under there.` · `You've earned the mystery reward.` · `CARD Nº OC-0248` · `SEALED 12 JUN`

**revealed / ready:** `Unsealed` · `Free flat white` · `From the Old Crown, with thanks.` · VenueMark `Nº RW-8821` · ready: `Ready to redeem` + "Show this at the counter. Staff redeem it once with their PIN." + `Staff: redeem this reward` · revealed: `Redeemable from tomorrow` + "Give it a day to breathe — it's yours from opening time tomorrow." + demo `Skip to tomorrow`

**redeemed:** VenueMark `✓` `12 JUN 2026` · `Enjoy.` · "The card starts again — same deal, next visit." · `Back to my card`

**Stamp/redeem sheets:** stamp `Staff: stamp this card` / "Customer hands the phone across the counter"; redeem `Staff: redeem reward` / "One redemption — marked off for good"

---

## Merchant (`20-merchant-core.jsx`, `21-merchant-ops.jsx`)

**Auth (`McAuth`):** `Start your 30-day pilot` / `Merchant access` · `Set up your loyalty counter.` / `Welcome back to the counter.` · "No password, no card details. We email a six-digit code and the whole setup takes about five minutes." · `Check your inbox.` · `Sent to {email} · expires in 10 min` · CTAs `Email me a code` → `Create my account` / `Sign me in` · `Already set up? Sign in` / `New here? Create your account` · `Use a different email` · `30 days free · £29/month after · one price, one venue` · field `Venue email`, placeholder `hello@oldcrown.pub` · demo `Autofill hello@oldcrown.pub`, `Autofill code`

**Onboarding (`McOnboarding`):** `Setup · about 5 minutes` · `Three steps, then you're live.` · demo `Skip setup` · steps `Name your venue` / `Stock the reward pool` / `Print your QR`

- Step 1: `Venue name` / `City` (placeholders `The Old Crown` / `Bristol`) · `Save — next` · "Customers see this name the moment their card opens."
- Step 2: `WEIGHT ×{n}` · placeholder `Add a reward — e.g. Free pastry` · `Add` · "Heavier weights turn up more often. One is drawn when the seal breaks at visit 3." · `Pool's stocked — next` · `Back` · seeds `Free flat white` (w3) / `Slice of cake` (w2) / `20% off next visit` (w1)
- Step 3: `Print poster + till card` · "One permanent code · this is the moment you go live." · live: `Live at {venue}` / `The counter is ready.` / "Stick the poster where the queue forms. The first scan does the rest." / `Open Today at the counter`

**Today (`McToday`):** `Thursday 12 June · Bristol` · `Today at the counter` · `Pilot · day 23 of 30` · stats `14 / Stamps today`, `3 / Rewards ready`, `5 / New members`, `41% / Come back twice` · feed `Live from the till` / `Auto-refreshing` ("Asha K. unsealed a mystery reward" 11:42; "Asha K. — stamp 3 of 3" 11:41; "Tom R. — stamp 2 of 3" 10:18; "Priya S. joined from the counter QR" 09:51) · "Weekly digest lands Monday 08:00." · `Full activity log` · `Your till QR` / "One permanent code · 60 scans/min headroom" / `Reprint poster & till card` / `See what customers get` · `Staff PIN` reveal `7 3 1 2` / `● ● ● ●` / "Today's PIN · rotates tonight at 04:00 · tap to hide" / "Rotates nightly at 04:00 · tap to reveal"

**Counter (`McCounter`):** `Counter mode · pin this tab` · `STAMPS TODAY` `14` · `LAST: ASHA K. · 11:41 · STAMP 3/3` · "Customers hand you their phone with the PIN pad already open. Type today's PIN — that's the whole job." · demo `Simulate a stamp`

**Surface chrome:** tabs `Today` `Activity` `Customers` `QR studio` `Settings` `Billing` `Counter`; demo `Restart flow`

**Activity (`MerchantActivity`):** `Activity` · `This week at the counter · {n} events` · `Simulate a live event` · filters `All` `Stamps` `Rewards` `Joins` `Redemptions` `System` · groups `Today · Thu 12 Jun` / `Yesterday · Wed 11 Jun` / `Earlier this week` · empty `Nothing in this lane yet.` / "It fills up as the counter hums." · footnote "Events keep for 12 months · customers appear as initials beyond your own till" (full feed text in [MerchantActivity.md](components/merchant/MerchantActivity.md))

**Customers (`MerchantCustomers`):** `Customers` · `7 members · readback only` · `Initials only · phones stay hashed` · columns `Member` `Joined` `Stamps` `Last visit` `Reward` · badges `Reward ready` `New today` `Collecting` `Redeemed 11 Jun` `Gone quiet` · footnote "No marketing without a separate opt-in · exports live with the account owner" · `Open Asha's card as the customer`

**QR studio (`MerchantQrStudio`):** `QR studio` · "One permanent code — reprints never invalidate it" · `86` `Scans this week` · on `QR live at the counter · rate limit 60 scans/min — never near it` / off `QR paused` · paused `Paused, not broken.` + "Scans now show a polite "ask a team member" note…" · assets `Counter poster` `A4 · 300dpi`, `Till card` `148×105mm`, `Sticker` `60mm round` · buttons `PNG` / `Print PDF` → `Preparing…` → `Downloaded ✓` · footer "Points to nabaperks.app/m/old-crown · printed copies never expire" · `Scan it as a customer`

**Settings (`MerchantSettings`):** `Settings` · `Venue · staff PIN · team · programme` · `Venue details` (`Venue name`/`City`/`Card link` prefix `nabaperks.app/m/`) `Save venue details` → `Saved ✓` · `Staff PIN` `Rotated just now` "One shared counter PIN approves stamps and redemptions." `Reveal today's PIN`/`Hide it`/`Rotate now` · footnote "Rotates nightly at 04:00 UK · 3 wrong tries locks the pad for 10 minutes" · `Team` (Maya/Manager/`Can reveal the PIN`, Jordan/Counter/`Stamps & redeems`) `Signed in as hello@oldcrown.pub` · `Programme` tags `Paused`/`Running` · pause `Sheet`: `Pause the programme?` / "Customers keep every stamp and any unsealed reward…" / `Pause it` / `Keep it running`

**Billing (`MerchantBilling`):** `Billing` · "One price · one venue · Stripe handles the cards" · `Active` / `Trial · day {day} of 30` · `Growth plan · The Old Crown` `£29` `/month after the pilot` · `Pilot day` progress · `Pilot ends Fri 19 Jun · first charge £29.00` / `Next charge 19 Jul · £29.00` · `VISA` `···· 4242` `Expires 08/27 · added on day 12` · `Manage in Stripe` → `Opening…` · `Invoices` (`NP-0048` `19 Jun 2026 · First month` `£29.00` `UPCOMING`/`PAID`; `NP-0034`; `NP-0021`) · footnote `Receipts also land at hello@oldcrown.pub` · `If a payment ever fails` "Nothing dramatic. Customers keep every stamp…"

---

## Staff (`22-staff-counter.jsx`)

**Header:** `nabaperks` · `Staff · The Old Crown` · demo `Restart flow`

**idle:** `Counter mode · pin this tab` · `Stamps today` · `LAST: {who} · {at} · {note}` · "Customers hand you their phone with the PIN pad already open. Type today's PIN — that's the whole job." · CTA `Customer handed you a phone?` · `Thu 12 Jun · QR scans breathe at 60 a minute — plenty for a queue` · PIN peek `Today's PIN` / `●●●●` ↔ `7312` / `Hold to peek · rotates nightly at 04:00` / `Keep it off the till roll` / `STAFF ONLY`

**pin:** `Card Nº OC-0248` · `Asha K.` · `Stamp 2 of 3` · PinPad `Staff PIN` / "Check the purchase, then stamp the visit" · `Three misses locks the pad for 10 min` / `{n} tries left before lockout` · `Back to counter` · demo `Fumble the PIN ×3`

**success:** VenueMark `✓` `12 JUN · 3/3` · `Stamped. Hand it back.` · "That's Asha's third visit — the seal is breaking on her screen right now." · `Back to the counter in {n.n}s` · `See the customer's card`

**locked:** `PIN pad locked` · clock `10:00` · `Three wrong tries · counts down on its own` · "Take a breath — it unlocks itself. The customer's stamp will keep; nothing is lost." · demo `Skip the wait` · `Maya can reveal today's PIN from the merchant app`

---

## Admin (`40-admin.jsx`)

**Chrome:** `nabaperks` · `Internal` · `ops@nabaperks.co` · `Sign out` · demo `Restart flow`

**Gate (MFA):** `Internal · MFA required` · `Internal only.` · "Support console for Nabaperks staff. Every session — and every action inside it — lands in the audit log." · `Work email` placeholder `you@nabaperks.co` · `6-digit MFA code` · `Unlock console` · demo `Autofill MFA code` · "Sessions idle out after 30 min · IP logged · ops only" · toast `Signed in · session logged`

**Tabs:** `overview` `merchants` `billing` `audit` `fraud` (→ `Fraud · N` when flags open)

**Overview:** stats `Live merchants` (/ "6 onboarded · 2 flagged below"), `Members` (/ "+38 this week, all venues"), `Stamps this week` (/ "One per member per UK business day"), `Rewards redeemed` (/ "Last 7 days · all venues") · `Needs attention` · `Past due` "The Brass Tap · invoice unpaid 9 days — Stripe retries 14 JUN" · `Fraud` "high_stamp_velocity · Fade & Co Barbers — 23 stamps in 15 min" · clear `Fraud queue clear — nothing waiting on you.` · footer "Mirrors product_events · refreshed 2 min ago · read-only unless audited"

**Merchants / Billing / Audit / Fraud / merchant sheet:** full datasets (merchant rows, Stripe statuses, 7-entry audit log, fraud flags FR-0117 / FR-0102, support actions + toasts) transcribed verbatim in [AdminSurface.md](components/admin/AdminSurface.md). Notable: billing footer `£29 a month · one price · one venue · 30-day pilot, no card to start`; fraud footer `Signals, not verdicts · rate limits already held the line`; audit footer `Append-only · kept 24 months · readable by every admin`.

---

## Journey (`60-journey.jsx`)

**Header:** `nabaperks` · `Full flow · v2` · `Thu 12 Jun 2026 · Bristol` · `Reset every flow` → `All flows reset ✓` · `The whole loop, on one table.` · "Every surface of Nabaperks v2 — merchant, customer, staff, admin and the shop window — dealt out as one storyboard. Tap any card to jump into that exact screen, live." · `6 surfaces` · `30+ screens` · `One counter`

**Lanes:** Merchant `hello@oldcrown.pub` · Customer `Asha K. · first visit` · Staff `Maya & Jordan · behind the bar` · Admin `internal support` · Marketing `the shop window` (each `{n} screens`)

**Tie strips:** `✱ The counter moment` — "Customer 03 · Staff 02 — one phone, one PIN, one slam"; `✱ Stripe webhooks` — "Merchant 08 · Admin 04 — billing truth flows both ways"

**Footer receipt:** `The cast · The Old Crown, Bristol` · "Asha K. · Tom R. · Priya S. · Dan W. — regulars · Maya (manager) · Jordan — crew" · `Card Nº OC-0248 · Reward Nº RW-8821` · `One stamp a day` · `Seal at three` · `Next-day redeem` · `£29 a month` · "Tweak the ink, motion & counter check from the Tweaks panel"

(Per-step titles/descriptions — 32 cards across 5 lanes — transcribed verbatim in [JourneyMap.md](components/journey/JourneyMap.md).)

---

## Shared-primitive default copy

- `VenueMark`: initials `OC`, caption `OLD CROWN`
- `StampDisc`: fallback date `12 JUN`, glyph `✱`
- `ProgressLine`: label `Visits`
- `PinPad`: label `Staff PIN`, sublabel `Hand the phone to staff`, footer `Any 4 digits work in this prototype`
- `Seal`: glyph `?`, `Press & hold to break the seal` / `Tap to break the seal`
- `GpsCheck`: `Checking you're at the venue` → `You're here`; `Looking for {venue}…` → `{venue} confirmed — stamping your card.`; footer `One stamp per day · location simulated in this prototype`; default venue `The Old Crown`

---

## Consolidated CTA / button inventory

Primary actions across the prototype (deduplicated):

| Surface               | CTAs                                                                                                                                                                                                                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Marketing             | `Start a 30-day pilot` · `Start your 30-day pilot` · `Start free` · `Merchant login` · `Watch the counter moment` · `Play the slam` · `See what's included` · `Back to the homepage`                                                                                                                                                                                     |
| Customer              | `Collect my first stamp` · `Keep my card` · `Maybe later` · `Text me the code` · `Skip for now` · `Save my card` · `I'm at the counter — stamp it` · `Save this card` · `Staff: redeem this reward` · `Back to my card`                                                                                                                                                  |
| Merchant              | `Email me a code` · `Create my account` · `Sign me in` · `Save — next` · `Add` · `Pool's stocked — next` · `Print poster + till card` · `Open Today at the counter` · `Simulate a stamp` · `Reprint poster & till card` · `Save venue details` · `Reveal today's PIN` · `Rotate now` · `Pause programme` / `Resume programme` · `Manage in Stripe` · `PNG` / `Print PDF` |
| Staff                 | `Customer handed you a phone?` · `Back to counter` · `See the customer's card`                                                                                                                                                                                                                                                                                           |
| Admin                 | `Unlock console` · `Sign out` · `View` · `Send payment update link` · `Resend magic link` · `Regenerate QR` · `Mark reviewed` / `Dismiss` / `Reopen`                                                                                                                                                                                                                     |
| Demo (prototype-only) | `Restart flow` · `Reset every flow` · `Autofill …` · `Skip setup` · `Skip to tomorrow` · `Fumble the PIN ×3` · `Skip the wait` · `Simulate a live event`                                                                                                                                                                                                                 |

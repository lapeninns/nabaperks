# Flows, State Machines & Navigation

How the prototype moves between screens, what it persists, and what is faked. Everything here is **prototype behaviour** — state lives in `localStorage`, transitions are string-flips, and all I/O is mocked. None of it reflects real server/routing logic.

---

## The shell: surfaces & cross-surface navigation

`V3App` ([90-app-shell.jsx](extracted-source/90-app-shell.jsx)) mounts exactly one of six surfaces and persists the choice in `localStorage["v3_surface"]`:

```
Journey (default) · Marketing · Merchant · Customer · Staff · Admin
```

### `go(target, preset)` — the deep-link primitive

Threaded into every surface as the `go` prop. To jump _into a specific screen of another surface_, it primes that surface's state **before** switching:

```
go("Customer", "sealed")
  → look up window.CustomerEntry = { lsKey: "v3_customer", presets: {...} }
  → localStorage.setItem("v3_customer", JSON.stringify(presets["sealed"]))
  → setSurface("Customer"); scrollTo(0,0)
  → CustomerFlow boots, reads v3_customer, lands on the "sealed" screen
```

Each surface publishes a `window.<Name>Entry = { lsKey, presets }`. The preset keys are the valid deep-link targets:

| Entry            | Preset keys                                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| `CustomerEntry`  | scan · landing · firstStamp · save · card · sealed · revealed · ready · redeemed · alreadyStamped |
| `MerchantEntry`  | signup · onboarding · today · activity · customers · qr · settings · billing · counter            |
| `StaffEntry`     | idle · pin · success · locked                                                                     |
| `AdminEntry`     | gate · overview · merchants · billing · audit · fraud                                             |
| `MarketingEntry` | home · pricing · legal                                                                            |
| _(Journey)_      | — stateless, no Entry; it is the default front door                                               |

### Who navigates where (observed `go()` calls)

| From                                | Call                            | Effect                              |
| ----------------------------------- | ------------------------------- | ----------------------------------- |
| `JourneyMap` (any card)             | `go(lane.surface, step.preset)` | Jump into any screen of any surface |
| `CustomerFlow` (card / ready)       | `go("Staff", "pin")`            | "See what staff see"                |
| `StaffSurface` (success)            | `go("Customer", "card")`        | "See the customer's card"           |
| `MerchantCustomers`                 | `go("Customer", "ready")`       | "Open Asha's card as the customer"  |
| `MerchantQrStudio`                  | `go("Customer", "landing")`     | "Scan it as a customer"             |
| `AdminSurface` (merchant sheet, m1) | `go("Merchant", "today")`       | "Open their merchant dashboard"     |
| `Marketing` (all signup CTAs)       | `go("Merchant", "signup")`      | Start a pilot / merchant login      |

The two `JyTieStrip`s on the journey map annotate the deliberate cross-surface seams: **"The counter moment"** (Customer `firstStamp` ↔ Staff `pin`) and **"Stripe webhooks"** (Merchant `billing` ↔ Admin `billing`).

---

## Customer journey (`CustomerFlow`)

The star of the flow — a single component with an 11-state machine on `step`, plus flags `visits (0–3)`, `saved`, `dayReady`, `stampedToday`. Persists `{ step, visits, saved, dayReady, stampedToday }` to `localStorage["v3_customer"]` (transient `phone`/`otp`/`sheet`/`slam`/`shake` are not saved).

```
scan ──(CuScanView finds QR / 1500·mo timer / tap)──▶ landing
landing ──(Collect → stamp Sheet → doStamp, 950·mo)──▶ firstStamp        [or → alreadyStamped if stampedToday]
firstStamp ──(Keep my card)──▶ save        ──(Maybe later)──▶ card
save ──(Text me the code)──▶ otp           ──(Skip for now)──▶ card
otp ──(Save my card, needs 6 digits, sets saved)──▶ card
card ──(stamp Sheet → doStamp; visits hit 3, 1100·mo)──▶ sealed
     ──(if stampedToday)──▶ alreadyStamped
     ──(Save this card)──▶ save     ──(See what staff see)──▶ go("Staff","pin")
alreadyStamped ──(Back to my card)──▶ card     ──(Skip to tomorrow, clears stampedToday)──▶ card
sealed ──(Seal onBroken)──▶ revealed
revealed ──(Skip to tomorrow, sets dayReady)──▶ ready     [shares render branch with ready; confetti only on revealed]
ready ──(Staff: redeem → redeem Sheet → doRedeem)──▶ redeemed
redeemed ──(Back to my card, resets visits:0, dayReady:false)──▶ card
reset() ("Restart flow") ─ clears timers + localStorage ─▶ scan
```

**Sheet routing:** when a stamp is requested, `t.verify === "GPS"` → `GpsCheck`, otherwise → `PinPad`. The sheet's done-handler is `doStamp` (stamp) or `doRedeem` (redeem).
**Tweak hooks read:** `t.mo` (all timings), `t.celebration` (Slam/Ripple/Burst), `t.reveal` (Seal Hold/Tap), `t.verify` (PIN/GPS).

---

## Merchant surface (`MerchantSurface`)

Owner switches on `stage ∈ {auth, onboarding, app}`; in `app`, a pill tab-bar routes screens. Persists `{ stage, tab, obStep, venue, city, rewards }` to `localStorage["v3_merchant"]`.

```
auth (McAuth)
  ├─ onDone("create") ─▶ onboarding (obStep=1)
  └─ onDone("signin") ─▶ app (tab=today)
onboarding (McOnboarding: step 1 venue → 2 reward pool → 3 print/go-live)
  └─ onLive() / onSkip() ─▶ app (tab=today)
app  ─ tab router:
     today    → McToday            (this module)
     counter  → McCounter          (this module)
     activity → MerchantActivity   ┐
     customers→ MerchantCustomers  │ from 21-merchant-ops,
     qr       → MerchantQrStudio   │ each receives ({ t, go })
     settings → MerchantSettings   │
     billing  → MerchantBilling    ┘
restart() ("Restart flow") ─ clears LS ─▶ auth
```

---

## Staff counter station (`StaffSurface`)

Mostly-dark till tab. State machine on `st.mode`. Persists to `localStorage["v3_staff"]` (hydrated by `StLoad`).

```
idle (counter mode) ──("Customer handed you a phone?")──▶ pin
pin ──(Back to counter)──▶ idle
pin ──(PinPad.onDone → stamped())──▶ success        (increments stampsToday, sets last)
pin ──(demo "Fumble the PIN ×3" → fumble())──▶ locked (lockLeft=600s)   ← only path to locked
success ──(2200·mo auto-return countdown)──▶ idle
success ──("See the customer's card")──▶ go("Customer","card")
locked ──(real 1s clock ticks to 0 / demo "Skip the wait")──▶ idle
any ──(header "Restart flow")──▶ idle (reset)
```

> **Note:** `PinPad` accepts any 4 digits — there is no real wrong-PIN detection. The only route to `locked` is the demo "Fumble the PIN ×3" tag. The lockout clock (`setInterval` 1s) and success auto-return (`setInterval` 90ms + `Date.now()`) are genuine timers; everything else is faked.

---

## Admin console (`AdminSurface`)

`stage ∈ {gate, console}`; console has 5 tabs. Persists `{ stage, tab, resolvedFlags, pausedIds, auditExtra }` to `localStorage["v3_admin"]`.

```
gate (MFA) ──(6-digit code + email contains "@" → Unlock)──▶ console (overview)
  └─ MFA is FAKED: any 6 digits unlock; demo autofill 120626
console ─ tabs: overview · merchants · billing · audit · fraud
  merchant row "View" ─▶ merchant detail Sheet (support actions, each writes an audit row + toast)
  fraud flag ─▶ Mark reviewed / Dismiss / Reopen (updates resolvedFlags, toast, audit)
Sign out ─▶ gate
reset() ("Restart flow") ─ clears LS ─▶ gate
```

`openFlags = AD_FLAGS.filter(not closed && not resolved)` drives the fraud tab badge and the Overview "Needs attention" panel. Support actions append session-only audit rows (stamped with the literal `"12 JUN · just now"`).

---

## Marketing site (`MarketingSite`)

Three views, single conditional render. Persists `{ view }` to `localStorage["v3_marketing"]`.

```
home ⇄ pricing ⇄ legal
  MkNav brand: scroll-to-top (smooth) on home, else → home
  "See what's included" → pricing ; footer Terms/Privacy → legal ; "Back to the homepage" → home
  every setView() does window.scrollTo(0,0)
  reset() (footer "Restart flow") clears LS
```

Uses `w-marquee` (top strip, `22·mo`s) and `w-rise` (view + FAQ entrances). `MkHome.watchMoment()` smooth-scrolls to the counter band then fires a stamp slam after `650·mo`ms.

---

## Journey storyboard (`JourneyMap`)

Stateless front door. Five swimlanes of tappable `JyStepCard`s; each card emits `go(lane.surface, step.preset)`. Render order (staggered ×`mo`): Merchant → Customer → _tie: counter moment_ → Staff → _tie: Stripe webhooks_ → Admin → Marketing.

| Lane              | Steps → preset (all valid `go()` targets)                                                                |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| **Merchant** (9)  | signup · onboarding · qr · today · activity · customers · settings · billing · counter                   |
| **Customer** (10) | scan · landing · firstStamp · save · card · sealed · revealed · ready · redeemed · alreadyStamped (spur) |
| **Staff** (4)     | idle · pin · success · locked (spur)                                                                     |
| **Admin** (6)     | gate · overview · merchants · billing · audit · fraud                                                    |
| **Marketing** (3) | home · pricing · legal                                                                                   |

`JyGlyph` draws each card's icon from the `JY_GLYPHS` dictionary (31 keys: form, steps, qr, dash, feed, people, key, pound, till, phone, spark, stamp, save, card, seal, gift, clock, check, calendar, tab, hand, lock, shield, pulse, rows, sync, scroll, flag, home, tag, scale). "Reset every flow" clears **all five** surface keys at once (`v3_customer`, `v3_merchant`, `v3_staff`, `v3_admin`, `v3_marketing`).

---

## localStorage keys (master list)

| Key            | Owner             | Shape (persisted fields)                                                                                                                                       |
| -------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `v3_surface`   | `V3App`           | current surface string                                                                                                                                         |
| `v3_customer`  | `CustomerFlow`    | `{ step, visits, saved, dayReady, stampedToday }`                                                                                                              |
| `v3_merchant`  | `MerchantSurface` | `{ stage, tab, obStep, venue, city, rewards }`                                                                                                                 |
| `v3_staff`     | `StaffSurface`    | station state (mode, stampsToday, last, attempts, lock…)                                                                                                       |
| `v3_admin`     | `AdminSurface`    | `{ stage, tab, resolvedFlags, pausedIds, auditExtra }`                                                                                                         |
| `v3_marketing` | `MarketingSite`   | `{ view }`                                                                                                                                                     |
| _(tweaks)_     | `useTweaks`       | **none in-page** — persistence delegated to the host via `postMessage`; defaults live in the `/*EDITMODE-BEGIN*/…/*EDITMODE-END*/` block in `90-app-shell.jsx` |

---

## Mocked / faked behaviour (do not mistake for real logic)

| Area                     | What's faked                                                                                                                      |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **QR codes**             | `QrBlock` renders a deterministic sine-hash matrix — decorative, no real payload/scan                                             |
| **Customer OTP**         | code is the literal `482915`; any 6 digits are accepted; nothing is sent                                                          |
| **Merchant auth**        | passwordless "email a code" is mocked; code `482915`; "expires in 10 min" is static text                                          |
| **Admin MFA**            | any 6 digits unlock; demo autofill `120626`; idle-out / IP-logging is prose only                                                  |
| **Staff / customer PIN** | `PinPad` accepts any 4 digits; "Any 4 digits work in this prototype"; lockout only via demo tag                                   |
| **GPS check-in**         | `GpsCheck` is two `setTimeout`s (locating → found); "location simulated in this prototype"                                        |
| **Stripe / billing**     | "Manage in Stripe" and payment links are `setTimeout` fakes; all invoices/figures hardcoded                                       |
| **Downloads**            | QR-studio PNG/PDF "downloads" are `setTimeout` fakes (`Preparing… → Downloaded ✓`)                                                |
| **All datasets**         | feeds, customer lists, stats, invoices, audit log, fraud flags, team — hardcoded demo data                                        |
| **Time**                 | dates are hardcoded ("Thu 12 Jun 2026"); business-day rollover is faked by "Skip to tomorrow" tags; no real `Europe/London` check |
| **Motion timing**        | every animation/timer is scaled by `t.mo` (Tweaks "Motion scale", 0.5–2)                                                          |

> **Retired mechanic flagged throughout:** the prototype's staff-PIN model (`PinPad`, "hand the phone over", "type today's PIN", nightly PIN rotation) is the _older_ approach. The live product replaced the handed-phone staff PIN with a **counter handshake** (code → paired station). The v3 staff station hints at the newer direction (`StPinPeek` lives on the paired station) but the `pin` screen still implements the handed-phone flow. Treat all staff-PIN UI and copy as prototype-only.

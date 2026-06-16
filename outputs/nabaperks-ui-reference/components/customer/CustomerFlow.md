# CustomerFlow

- **Surface:** customer-web (the whole self-serve customer journey)
- **Source module:** [extracted-source/30-customer.jsx](../../extracted-source/30-customer.jsx) (lines 127–517)
- **Export:** `window.CustomerFlow` (global). Also `window.CustomerEntry = { lsKey: CU_LS_KEY, presets: CU_PRESETS }`.
- **Reuse verdict:** 🔒 Prototype-only (single-component state machine, localStorage persistence, hardcoded venue/offer/card, faked stamp/redeem via PIN sheet, demo "Skip to tomorrow" jumps, no real API)

## Visual purpose

The star of the prototype: one mobile-first component (≈410 px column) that walks a customer through the entire loyalty arc on their own phone — scan → landing → first stamp → save card → verify code → card → sealed → revealed → ready → redeemed, plus the calm "already stamped today" branch. It renders a persistent header (the `✱ nabaperks` wordmark and a "Restart flow" demo tag), one of eleven step bodies, and a bottom `Sheet` that hosts the staff handshake (`PinPad`) or, when the active tweak is GPS, a `GpsCheck`. The shared receipt card (`cardBody`) — venue, offer, stamp row, progress, card number, saved/unsaved line — is reused across the landing, first-stamp, card, and already-stamped screens.

## Props / state

| Prop | Type                      | Notes                                                                                                                                                                                                                                                                                                                                                                                 |
| ---- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `t`  | object (tweaks)           | The active tweak settings. Reads `t.mo` (motion multiplier → local `mo`), `t.celebration` (passed to `StampRow` / `CelebrationBits`, value compared against `"Ripple"` else `"Burst"`), `t.reveal` (passed to `Seal` as `mode`), `t.verify` (compared against `"GPS"` to choose `GpsCheck` vs `PinPad` for the stamp sheet). Exact shape **unclear from source** (defined elsewhere). |
| `go` | `(surface, step) => void` | Cross-surface navigation. Used once: `go("Staff", "pin")` from the card screen's "See what staff see" demo tag.                                                                                                                                                                                                                                                                       |

**Local state (all via `useStateCu` / `useRefCu`):**
| Name | Init | Role |
| --- | --- | --- |
| `cu` | `{ ...CU_FALLBACK, ...(cuLoadState() || {}) }` | The persisted machine state. Destructured into `step, visits, saved, dayReady, stampedToday`. `patch(p)` merges into it. |
| `sheetOpen` | `false` | Whether the bottom `Sheet` is open. |
| `sheetPurpose` | `"stamp"` | `"stamp"` or `"redeem"` — selects sheet contents and the done-handler. |
| `slam` | `-1` | Index of the stamp currently "slamming" down (drives `StampRow` `slamIndex`); `-1` = none. |
| `shake` | `false` | Triggers the receipt-card shake on a fresh stamp. |
| `phone` | `""` | Mobile-number input on the save screen. |
| `otp` | `""` | OTP digits on the verify screen (6 = complete). |
| `cuTimers` | `useRefCu([])` | Holds pending `setTimeout` handles so they can be cleared on reset/unmount. |

**Persistence (prototype-ism):** a `useEffect` writes `{ step, visits, saved, dayReady, stampedToday }` to `localStorage["v3_customer"]` on every `cu` change. `cuLoadState()` reads it back on mount; `reset()` removes it.

## UX behaviour

- **Header:** always shows the wordmark and a `DemoTag` "Restart flow" wired to `reset()` (clears timers, removes the localStorage key, resets to `CU_FALLBACK`, clears sheet/phone/otp/slam/shake).
- **Stamp flow:** `requestStamp()` — if `stampedToday` it short-circuits to the calm `alreadyStamped` screen; otherwise it opens the stamp sheet. `doStamp()` closes the sheet, bumps `visits` (capped at 3), sets `stampedToday: true`, fires the slam (`slam = next-1`) and shake, then schedules step transitions (prototype-ism — `setTimeout` mocks scaled by `mo`): from `landing` it advances to `firstStamp` after `950 * mo`; once `next >= 3` it advances to `sealed` after `1100 * mo`. Shake clears after `360 * mo`, slam after `1400 * mo`.
- **Redeem flow:** `doRedeem()` closes the sheet and sets `step: "redeemed"`.
- **Save / OTP:** the save screen collects a phone number then advances to `otp`; the OTP screen enables "Save my card" only when `otp.length === 6`, which sets `{ saved: true, step: "card" }`. A `DemoTag` "Autofill code" sets the dev OTP `"482915"` (prototype-ism — no real verification).
- **Sheet contents:** for a stamp with `t.verify === "GPS"` it renders `GpsCheck`; otherwise `PinPad` with labels that change by purpose ("Staff: stamp this card" / "Staff: redeem reward").
- **Demo jumps:** several `DemoTag`s let a demoer skip time/state: "See what staff see" (`go("Staff","pin")`), "Skip to tomorrow" on `alreadyStamped` (`stampedToday:false → card`) and on `revealed` (`dayReady:true, stampedToday:false → ready`).
- **Layout:** outer wrapper `maxWidth: 410, padding: "26px 20px 110px", minHeight: "100vh"` — mobile thumb column.

## Dependencies

- **Internal:** `CuScanView` (same module), `cardBody` helper.
- **Shared primitives (window globals):** `InkButton`, `GhostLink`, `MonoTag`, `MonoLine`, `DemoTag`, `VenueMark`, `ReceiptCard`, `ReceiptRule`, `CelebrationBits`, `StampRow`, `ProgressLine`, `PinPad`, `OtpBoxes`, `Sheet`, `Seal`, `GpsCheck`. (`StampDisc` is used by `StampRow`, not directly here.)
- **CSS variables:** `--w-paper`, `--w-card`, `--w-ink`, `--w-ink-soft`, `--w-line`, `--w-accent`, `--w-sun`, `--w-leaf`, `--w-r`, `--w-mono`. (`--w-mo` motion is applied via `t.mo`, not the var directly here.)
- **Keyframes:** `w-rise` (most screen entrances), `w-pop` (revealed/ready/redeemed entrance, "QR found"), `w-slam` (redeemed stamp slam). Stamp/seal/confetti keyframes (`w-slam`, `w-soft-stamp`, `w-shake`, `w-splat`, `w-confetti`, etc.) are consumed inside `StampRow`/`Seal`/`CelebrationBits`.
- **localStorage:** key **`v3_customer`** (`CU_LS_KEY`) — read on mount, written on every state change, removed on reset.
- **Globals / window:** reads `React`; writes `window.CustomerFlow` and `window.CustomerEntry`.
- **Mock/dev details:** dev OTP `"482915"`; resolved QR URL `nabaperks.app/q/oc-0248`; card number `OC-0248`; reward number `RW-8821`; fixed dates (`10/11/12 JUN`, "From 13 Jun", `12 JUN 2026`). No real network, auth, or geolocation.

## Reuse notes

The value here is the **journey choreography and copy**, not the implementation. The eleven-state arc (and the way `visits`, `saved`, `dayReady`, `stampedToday` flags gate it) is an excellent reference for the production phone-first flow, and the en-GB copy is on-brand and worth lifting nearly verbatim. But the whole thing is a self-contained demo: state lives in one component and `localStorage`, every venue/offer/number is hardcoded, stamping and redeeming are faked through a staff `PinPad` (which contradicts the production v3 "counter handshake, no shared PIN" model — see project notes), time travel is driven by `setTimeout` and "Skip to tomorrow" tags, and there is no real OTP/QR/GPS backend. For production this maps onto `/q/[qrId]`, the `issue_self_service_stamp` / `redeem_self_service_reward` RPCs, Twilio Verify, and server-derived card state rather than a localStorage blob.

## Screen states

The machine is a flat `if (step === …)` ladder assigning to `body`; `step` is the single discriminant. Note **`revealed` and `ready` share one render branch** (`if (step === "revealed" || step === "ready")`), differing by the `isReady` flag (`step === "ready" || dayReady`).

| State            | Entry trigger(s)                                                                              | Renders                                                                                                                                           | Exits to                                                                                                                      |
| ---------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `scan`           | initial `CU_FALLBACK`; `reset()`                                                              | `CuScanView` (camera mock)                                                                                                                        | `landing` (timer ~1500·mo, tap, or scrim → `onDone`)                                                                          |
| `landing`        | `CuScanView` `onDone`                                                                         | Receipt card + "Your first stamp is waiting." + "Collect my first stamp"                                                                          | opens stamp sheet → `doStamp` → (from landing) `firstStamp` after 950·mo; `alreadyStamped` if `stampedToday`                  |
| `firstStamp`     | `doStamp` from `landing` after 950·mo                                                         | "That's one." + receipt + "Keep my card" / "Maybe later"                                                                                          | `save` ("Keep my card"); `card` ("Maybe later")                                                                               |
| `save`           | "Keep my card" (firstStamp); "Save this card" (card); preset                                  | Phone-number input + "Text me the code"                                                                                                           | `otp` ("Text me the code"); `card` ("Skip for now")                                                                           |
| `otp`            | "Text me the code" (save)                                                                     | `OtpBoxes` + "Save my card" (enabled at 6 digits) + "Autofill code" demo tag                                                                      | `card` with `saved:true` (on 6-digit submit)                                                                                  |
| `card`           | "Maybe later"/"Skip for now"; OTP submit; "Back to my card" (alreadyStamped/redeemed); preset | Receipt card + sealed-mystery panel + "I'm at the counter — stamp it" + (conditional) save link, "Today's stamp is on" note, "See what staff see" | opens stamp sheet → `doStamp` (→ `sealed` when visits hit 3); `alreadyStamped` if `stampedToday`; `save`; `go("Staff","pin")` |
| `alreadyStamped` | `requestStamp()` when `stampedToday` (from landing/card); preset                              | "One stamp a day keeps it fair." + receipt + "Next stamp / From 13 Jun" + "Back to my card" + "Skip to tomorrow"                                  | `card` ("Back to my card"); `card` with `stampedToday:false` ("Skip to tomorrow")                                             |
| `sealed`         | `doStamp` when `next >= 3` after 1100·mo; preset                                              | "Something's under there." + `Seal` (interactive break)                                                                                           | `revealed` (Seal `onBroken`)                                                                                                  |
| `revealed`       | `Seal` `onBroken`; preset                                                                     | `CelebrationBits` + "Free flat white" + "Redeemable from tomorrow" + "Skip to tomorrow"                                                           | `ready` ("Skip to tomorrow": `dayReady:true, stampedToday:false`)                                                             |
| `ready`          | "Skip to tomorrow" (revealed); preset; (or `revealed` while `dayReady` true)                  | Same branch as `revealed` but `isReady` → "Ready to redeem" + "Staff: redeem this reward"                                                         | opens redeem sheet → `doRedeem` → `redeemed`                                                                                  |
| `redeemed`       | `doRedeem`; preset                                                                            | ✓ stamp slam + "Enjoy." + "Back to my card"                                                                                                       | `card` with `visits:0, dayReady:false`                                                                                        |

(Per-state reference files: `Screen-scan.md`, `Screen-landing.md`, `Screen-firstStamp.md`, `Screen-save.md`, `Screen-otp.md`, `Screen-card.md`, `Screen-alreadyStamped.md`, `Screen-sealed.md`, `Screen-revealed.md`, `Screen-ready.md`, `Screen-redeemed.md`.)

## Config

`CU_PRESETS` (demo entry-points, one per step) and `CU_FALLBACK` (initial/default state), verbatim, plus the load helper. `window.CustomerEntry = { lsKey: CU_LS_KEY, presets: CU_PRESETS }` exposes these for the demo harness.

```jsx
const CU_LS_KEY = "v3_customer"

const CU_FALLBACK = {
  step: "scan",
  visits: 0,
  saved: false,
  dayReady: false,
  stampedToday: false,
}

const CU_PRESETS = {
  scan: {
    step: "scan",
    visits: 0,
    saved: false,
    dayReady: false,
    stampedToday: false,
  },
  landing: {
    step: "landing",
    visits: 0,
    saved: false,
    dayReady: false,
    stampedToday: false,
  },
  firstStamp: {
    step: "firstStamp",
    visits: 1,
    saved: false,
    dayReady: false,
    stampedToday: true,
  },
  save: {
    step: "save",
    visits: 1,
    saved: false,
    dayReady: false,
    stampedToday: true,
  },
  card: {
    step: "card",
    visits: 2,
    saved: true,
    dayReady: false,
    stampedToday: false,
  },
  sealed: {
    step: "sealed",
    visits: 3,
    saved: true,
    dayReady: false,
    stampedToday: true,
  },
  revealed: {
    step: "revealed",
    visits: 3,
    saved: true,
    dayReady: false,
    stampedToday: true,
  },
  ready: {
    step: "ready",
    visits: 3,
    saved: true,
    dayReady: true,
    stampedToday: false,
  },
  redeemed: {
    step: "redeemed",
    visits: 3,
    saved: true,
    dayReady: true,
    stampedToday: false,
  },
  alreadyStamped: {
    step: "alreadyStamped",
    visits: 1,
    saved: false,
    dayReady: false,
    stampedToday: true,
  },
}

function cuLoadState() {
  try {
    return JSON.parse(localStorage.getItem(CU_LS_KEY)) || null
  } catch (e) {
    return null
  }
}
```

## Source snippet

Signature, core handlers, shared receipt body, and the wrapper/sheet (step render branches are documented in the per-state files) — `[trimmed]`.

```jsx
function CustomerFlow({ t, go }) {
  const [cu, setCu] = useStateCu(() => ({
    ...CU_FALLBACK,
    ...(cuLoadState() || {}),
  }))
  const { step, visits, saved, dayReady, stampedToday } = cu
  const patch = (p) => setCu((s) => ({ ...s, ...p }))

  const [sheetOpen, setSheetOpen] = useStateCu(false)
  const [sheetPurpose, setSheetPurpose] = useStateCu("stamp") // stamp | redeem
  const [slam, setSlam] = useStateCu(-1)
  const [shake, setShake] = useStateCu(false)
  const [phone, setPhone] = useStateCu("")
  const [otp, setOtp] = useStateCu("")
  const cuTimers = useRefCu([])

  useEffectCu(() => {
    localStorage.setItem(
      CU_LS_KEY,
      JSON.stringify({ step, visits, saved, dayReady, stampedToday })
    )
  }, [cu])

  // Clear any pending stamp-animation timers on unmount (surface switch).
  useEffectCu(
    () => () => {
      cuTimers.current.forEach(clearTimeout)
      cuTimers.current = []
    },
    []
  )

  const mo = t.mo
  const cuDates = ["10 JUN", "11 JUN", "12 JUN"].slice(3 - Math.min(3, visits))

  const requestStamp = () => {
    if (stampedToday) {
      patch({ step: "alreadyStamped" })
      return
    }
    setSheetPurpose("stamp")
    setSheetOpen(true)
  }

  const doStamp = () => {
    setSheetOpen(false)
    const next = Math.min(3, visits + 1)
    setSlam(next - 1)
    setShake(true)
    patch({ visits: next, stampedToday: true })
    cuTimers.current.push(setTimeout(() => setShake(false), 360 * mo))
    cuTimers.current.push(setTimeout(() => setSlam(-1), 1400 * mo))
    if (step === "landing")
      cuTimers.current.push(
        setTimeout(() => patch({ step: "firstStamp" }), 950 * mo)
      )
    else if (next >= 3)
      cuTimers.current.push(
        setTimeout(() => patch({ step: "sealed" }), 1100 * mo)
      )
  }

  const doRedeem = () => {
    setSheetOpen(false)
    patch({ step: "redeemed" })
  }

  const reset = () => {
    cuTimers.current.forEach(clearTimeout)
    cuTimers.current = []
    localStorage.removeItem(CU_LS_KEY)
    setCu({ ...CU_FALLBACK })
    setSheetOpen(false)
    setPhone("")
    setOtp("")
    setSlam(-1)
    setShake(false)
  }

  /* ---------- shared receipt body ---------- */
  const cardBody = (extra) => (
    <ReceiptCard shaking={shake} mo={mo}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <MonoLine>The Old Crown · Bristol</MonoLine>
          <div
            style={{
              fontWeight: 800,
              fontSize: 21,
              lineHeight: 1.12,
              marginTop: 5,
            }}
          >
            Free hot drink after 3 visits
          </div>
        </div>
        <VenueMark size={62} />
      </div>
      <ReceiptRule />
      <div style={{ position: "relative", padding: "8px 0 4px" }}>
        <StampRow
          current={visits}
          total={3}
          slamIndex={slam}
          celebration={t.celebration}
          mo={mo}
          dates={cuDates}
        />
      </div>
      <ReceiptRule />
      <ProgressLine current={visits} total={3} />
      {extra}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 14,
        }}
      >
        <MonoLine style={{ fontSize: 10 }}>CARD Nº OC-0248</MonoLine>
        <MonoLine style={{ fontSize: 10 }}>
          {saved ? "SAVED TO 07123···89" : "UNSAVED · THIS BROWSER"}
        </MonoLine>
      </div>
    </ReceiptCard>
  )

  /* ---------- steps ---------- */
  let body = null
  // if (step === "scan") { ... }      → Screen-scan.md
  // if (step === "landing") { ... }   → Screen-landing.md
  // … one branch per step …           [trimmed — see per-state files]

  return (
    <div
      style={{
        maxWidth: 410,
        margin: "0 auto",
        padding: "26px 20px 110px",
        minHeight: "100vh",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 22,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: "var(--w-accent)",
              border: "2px solid var(--w-ink)",
              display: "inline-grid",
              placeItems: "center",
              color: "#fff",
              fontWeight: 800,
              fontSize: 13,
              transform: "rotate(-6deg)",
            }}
          >
            ✱
          </span>
          <span
            style={{
              fontWeight: 800,
              fontSize: 16.5,
              letterSpacing: "-0.01em",
            }}
          >
            nabaperks
          </span>
        </div>
        <DemoTag onClick={reset}>Restart flow</DemoTag>
      </div>
      {body}
      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} mo={mo}>
        {sheetPurpose === "stamp" && t.verify === "GPS" ? (
          <GpsCheck venue="The Old Crown" mo={mo} onDone={doStamp} />
        ) : (
          <PinPad
            label={
              sheetPurpose === "stamp"
                ? "Staff: stamp this card"
                : "Staff: redeem reward"
            }
            sublabel={
              sheetPurpose === "stamp"
                ? "Customer hands the phone across the counter"
                : "One redemption — marked off for good"
            }
            onDone={sheetPurpose === "stamp" ? doStamp : doRedeem}
          />
        )}
      </Sheet>
    </div>
  )
}

/* ---------- exports ---------- */
Object.assign(window, {
  CustomerFlow,
  CustomerEntry: { lsKey: CU_LS_KEY, presets: CU_PRESETS },
})
```

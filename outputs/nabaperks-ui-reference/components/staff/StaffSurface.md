# StaffSurface

- **Surface:** staff (counter station)
- **Source module:** [extracted-source/22-staff-counter.jsx](../../extracted-source/22-staff-counter.jsx) (lines 101–326)
- **Export:** `window.StaffSurface` (global), plus `window.StaffEntry = { lsKey: ST_LS, presets: ST_PRESETS }`.
- **Reuse verdict:** 🔒 Prototype-only (whole-screen demo state machine: hardcoded counts/names/PIN, `localStorage` persistence, timer-mocked lockout/auto-return, demo "Fumble"/"Skip"/"Restart" affordances).

## Visual purpose

The **staff counter station** — mobile-first, mostly dark, the tab that "stays pinned by the till all day" (per the header comment). It is a four-state screen machine wrapped in a 430px-max thumb column: an idle counter showing today's stamp tally; a PIN-entry screen for a handed-over phone; a success "stamped, hand it back" confirmation; and a locked-out countdown after three wrong tries. A persistent header carries the `✱` wordmark, a `Staff · The Old Crown` tag, and a demo "Restart flow" control.

## Props / state

| Prop | Type                        | Default | Notes                                                                                                                                |
| ---- | --------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `t`  | object (theme/timing)       | —       | Read for `t.mo` (motion multiplier, applied to every animation/timeout) and `t.celebration` (passed to `CelebrationBits` as `type`). |
| `go` | `(surface, screen) => void` | —       | Cross-surface navigation. Used once on success: `go("Customer", "card")` to jump to the customer's card.                             |

**State (all via `useStateSt`/`useRefSt` aliases of React hooks):**
| Item | Type | Init | Role |
| --- | --- | --- | --- |
| `st` | state object | `StLoad` (hydrated from `localStorage`) | The station state: `{ mode, stampsToday, attempts, lockLeft, last }`. Persisted on every change. |
| `shake` | boolean | `false` | Drives the `ReceiptCard`'s shake on a wrong PIN. |
| `leftMs` | number (ms) | `2200 * mo` | Countdown remaining for the success → idle auto-return, shown to 0.1s. |
| `stTimers` | ref (array) | `[]` | Collected `setTimeout` ids, cleared on unmount and on reset. |
| `fumbling` | ref (boolean) | `false` | Guards the demo fumble sequence so it can't overlap a real stamp. |

Local mutator: `const up = (patch) => setSt((s) => ({ ...s, ...patch }))`.

## State machine

`st.mode` is the machine. Four states; the render picks a `body` per mode, all inside the shared header chrome. The default state is `idle` (`ST_DEF.mode`), or whatever was persisted.

| State     | `data-screen-label`    | What's shown                                                                                                        |
| --------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `idle`    | `Staff · Counter idle` | Counter mode: big `stampsToday` tally, a "LAST: …" chip (leaf dot + who/at/note), `StPinPeek`, and the primary CTA. |
| `pin`     | `Staff · PIN entry`    | `StCardStrip` (customer context) + a `ReceiptCard` wrapping `PinPad`, three attempt dots, and lockout-warning copy. |
| `success` | `Staff · Stamped`      | Slammed `VenueMark` `✓` + `CelebrationBits`, "Stamped. Hand it back.", and a live auto-return countdown.            |
| `locked`  | `Staff · Locked out`   | "PIN pad locked" tag, a big mono `StClock(lockLeft)` countdown, calm reassurance copy.                              |

**Transitions (triggers):**

- `idle → pin` — primary CTA "Customer handed you a phone?" → `up({ mode: "pin", attempts: 0 })`.
- `pin → idle` — `GhostLink` "Back to counter" → `up({ mode: "idle", attempts: 0 })`.
- `pin → success` — `PinPad` `onDone` → `stamped()`: sets `mode: "success"`, `attempts: 0`, increments `stampsToday`, and writes `last = { who: "ASHA K.", at: "JUST NOW", note: "STAMP 3/3" }`. Guarded by `fumbling.current` (a fumble in progress blocks it).
- `pin → locked` — **demo only** via `DemoTag` "Fumble the PIN ×3" → `fumble()`: a timer-driven sequence that sets `attempts` 1→2→3 (each with a `shake` pulse), then flips `mode: "locked", lockLeft: 600`. There is no real wrong-PIN detection wired to `PinPad`; the only path to `locked` is this demo control.
- `locked → idle` — two paths: (a) the **real ten-minute clock** ticks `lockLeft` to ≤1 and resets to `{ mode: "idle", attempts: 0, lockLeft: 600 }`; (b) **demo** `DemoTag` "Skip the wait" → `up({ mode: "idle", attempts: 0, lockLeft: 600 })`.
- `success → idle` — the `leftMs` countdown reaches ≤0 → `setSt((s) => (s.mode === "success" ? { ...s, mode: "idle" } : s))` (auto-return to counter).
- `success → (Customer/card)` — `GhostLink` "See the customer's card" → `go("Customer", "card")` (leaves the staff surface entirely).
- `any → idle (default)` — header `DemoTag` "Restart flow" → `reset()`: removes the `localStorage` key, clears timers, resets `fumbling`/`shake`, and sets state back to `{ ...ST_DEF }`.

## UX behaviour

- **Entry animation:** `idle`, `pin`, `locked` bodies animate in with `rise = w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both`; `success` uses `w-pop ${420 * mo}ms …` on the wrapper and `w-slam ${420 * mo}ms …` on the venue mark.
- **Wrong-PIN feedback (demo):** `fumble()` increments attempts with a `setTimeout(… 560 * mo)` between hits and a `setTimeout(… 320 * mo)` shake pulse each time; the third hit locks the pad. All ids are pushed to `stTimers` for cleanup.
- **Lockout countdown:** `setInterval` at `1000ms` ticks `lockLeft` down once a second (a genuine 10-minute clock, not scaled by `mo`); auto-unlocks at the bottom.
- **Success auto-return:** `setInterval` at `90ms` recomputes `leftMs = total - (Date.now() - t0)` and shows it to `0.1s`; returns to idle at zero. `total = 2200 * mo`.
- **Persistence:** an effect writes `st` to `localStorage` on every change; another clears all timers on unmount.
- **Attempt dots (pin screen):** three dots fill with `var(--w-accent)` as `attempts` rises; copy reads "Three misses locks the pad for 10 min" at zero, otherwise "{n} try/tries left before lockout".

## Helpers & config

These live at module scope and are documented here (verbatim) rather than as separate components — `StClock` is an arrow-function formatter and `ST_DEF`/`ST_PRESETS`/`ST_LS` are config objects.

**`ST_LS`** — the `localStorage` key (also re-exported as `window.StaffEntry.lsKey`):

```jsx
const ST_LS = "v3_staff"
```

**`ST_DEF`** — the default station state (the `idle` baseline):

```jsx
const ST_DEF = {
  mode: "idle",
  stampsToday: 14,
  attempts: 0,
  lockLeft: 600,
  last: { who: "ASHA K.", at: "11:41", note: "STAMP 3/3" },
}
```

**`ST_PRESETS`** — per-state seed snapshots, re-exported as `window.StaffEntry.presets` (used by an external entry/preview to jump straight to a state):

```jsx
const ST_PRESETS = {
  idle: { ...ST_DEF },
  pin: { ...ST_DEF, mode: "pin" },
  success: {
    ...ST_DEF,
    mode: "success",
    stampsToday: 15,
    last: { who: "ASHA K.", at: "JUST NOW", note: "STAMP 3/3" },
  },
  locked: { ...ST_DEF, mode: "locked", attempts: 3 },
}
```

**`StClock`** — a `mm:ss` formatter (arrow function, ≈ line 33) used by the locked screen; clamps negatives to 0 and zero-pads both parts:

```jsx
const StClock = (s) =>
  `${String(Math.floor(Math.max(0, s) / 60)).padStart(2, "0")}:${String(Math.max(0, s) % 60).padStart(2, "0")}`
```

## Dependencies

- **Local (this module):** `StPanel`, `StPinPeek`, `StCardStrip`, `StLoad`, `StClock`, `ST_DEF`, `ST_LS`, `ST_PRESETS`, `ST_DIM`, `ST_MID`.
- **Shared primitives:** `InkButton`, `GhostLink`, `MonoTag`, `MonoLine`, `DemoTag`, `VenueMark`, `ReceiptCard`, `ReceiptRule`, `CelebrationBits`, `PinPad`.
- **CSS variables:** `--w-accent`, `--w-ink`, `--w-paper`, `--w-leaf`, `--w-sun`, `--w-display`, `--w-mono`. (Plus `--w-ink`/`--w-paper` inherited through `StPanel`.)
- **Keyframes:** `w-rise` (idle/pin/locked entry), `w-pop` + `w-slam` (success).
- **localStorage:** key `"v3_staff"` — written on every state change, read by `StLoad`, removed by `reset()`. _Prototype-ism._
- **Globals / window:** reads `React` (destructured `useState`/`useEffect`/`useRef`); writes `window.StaffSurface` and `window.StaffEntry`.
- **Timer / clock mocks (prototype-isms):**
  - `setInterval(…, 1000)` — the real 10-minute lockout clock (`lockLeft`).
  - `setInterval(…, 90)` + `Date.now()` deltas — the success → idle auto-return (`leftMs`, `total = 2200 * mo`).
  - `setTimeout(… 320 * mo / 560 * mo)` — the demo fumble sequence's shake + step delays, ids collected in `stTimers`.

## Reuse notes

This is a self-contained **prototype** of the whole counter station, not a production screen — keep it as a UX/flow reference, not as code to lift. Specifics that are demo-only: the stamp tally (`14`/`15`), customer identity (`ASHA K.` / `Asha K.` / `OC-0248`), and the PIN all hardcoded; state persisted to `localStorage`; the only route to `locked` is the "Fumble the PIN ×3" `DemoTag` (no real wrong-PIN check is wired to `PinPad`); and "Skip the wait" / "Restart flow" are demo escape hatches. Production equivalents would derive state from the server, wire real PIN validation and lockout, and drop the demo affordances.

**v3 "counter handshake" caveat (faithful to source).** The file header calls this "Nabaperks v3 'Wet Ink' — Staff counter station", and the v3 design replaces the older shared/handed-phone staff PIN with a code on a _paired station_. The idle screen reflects that direction — it surfaces "Today's PIN" on the station (`StPinPeek`, masked, hold-to-peek). **However, this same prototype's `pin` screen still implements the older handed-phone flow** — its copy literally reads "Customers hand you their phone with the PIN pad already open. Type today's PIN — that's the whole job." and "Customer handed you a phone?", and `PinPad` is labelled "Staff PIN". So the module shows both ideas side by side; do not present the PIN-entry screen as the finished v3 handshake — it is the legacy mechanic preserved within a v3-labelled prototype.

## Source snippet

Signature + the persistence/clock effects and the two state mutators (the per-mode JSX bodies are large and **[trimmed]** — see the source module and the State machine table above):

```jsx
function StaffSurface({ t, go }) {
  const mo = t.mo
  const [st, setSt] = useStateSt(StLoad)
  const [shake, setShake] = useStateSt(false)
  const [leftMs, setLeftMs] = useStateSt(2200 * mo)
  const stTimers = useRefSt([])
  const fumbling = useRefSt(false)

  const up = (patch) => setSt((s) => ({ ...s, ...patch }))

  useEffectSt(() => {
    localStorage.setItem(ST_LS, JSON.stringify(st))
  }, [st])

  // locked: a real ten-minute clock, ticking once a second
  useEffectSt(() => {
    if (st.mode !== "locked") return
    const id = setInterval(() => {
      setSt((s) =>
        s.lockLeft <= 1
          ? { ...s, mode: "idle", attempts: 0, lockLeft: 600 }
          : { ...s, lockLeft: s.lockLeft - 1 }
      )
    }, 1000)
    return () => clearInterval(id)
  }, [st.mode])

  // success: slam, then hand the station back to the counter
  useEffectSt(() => {
    if (st.mode !== "success") return
    const total = 2200 * mo
    const t0 = Date.now()
    setLeftMs(total)
    const id = setInterval(() => {
      const rem = total - (Date.now() - t0)
      if (rem <= 0)
        setSt((s) => (s.mode === "success" ? { ...s, mode: "idle" } : s))
      else setLeftMs(rem)
    }, 90)
    return () => clearInterval(id)
  }, [st.mode])

  useEffectSt(() => () => stTimers.current.forEach(clearTimeout), [])

  const stamped = () => {
    if (fumbling.current) return
    setSt((s) => ({
      ...s,
      mode: "success",
      attempts: 0,
      stampsToday: s.stampsToday + 1,
      last: { who: "ASHA K.", at: "JUST NOW", note: "STAMP 3/3" },
    }))
  }

  const fumble = () => {
    if (fumbling.current) return
    fumbling.current = true
    const hit = (n) => {
      up({ attempts: n })
      setShake(true)
      stTimers.current.push(setTimeout(() => setShake(false), 320 * mo))
      if (n < 3) stTimers.current.push(setTimeout(() => hit(n + 1), 560 * mo))
      else
        stTimers.current.push(
          setTimeout(() => {
            fumbling.current = false
            up({ mode: "locked", lockLeft: 600 })
          }, 560 * mo)
        )
    }
    hit(1)
  }

  const reset = () => {
    localStorage.removeItem(ST_LS)
    stTimers.current.forEach(clearTimeout)
    fumbling.current = false
    setShake(false)
    setSt({ ...ST_DEF })
  }

  const rise = `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both`
  let body = null

  /* ---------- idle / pin / success / locked bodies [trimmed] ---------- */

  return (
    <div
      style={{
        maxWidth: 430,
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
          marginBottom: 20,
          flexWrap: "wrap",
          gap: 8,
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
          <MonoTag style={{ marginLeft: 4 }}>Staff · The Old Crown</MonoTag>
        </div>
        <DemoTag onClick={reset}>Restart flow</DemoTag>
      </div>
      {body}
    </div>
  )
}

/* ---------- exports ---------- */
Object.assign(window, {
  StaffSurface,
  StaffEntry: { lsKey: ST_LS, presets: ST_PRESETS },
})
```

# MerchantSettings

- **Surface:** merchant (full screen — venue · staff PIN · team · programme)
- **Source module:** [extracted-source/21-merchant-ops.jsx](../../extracted-source/21-merchant-ops.jsx) (lines 423–578)
- **Export:** `window.MerchantSettings` (via `Object.assign(window, …)` at module foot)
- **Reuse verdict:** 🔒 Prototype-only (hardcoded venue/PIN/team values, faked save + PIN rotation via `setTimeout`, in-memory pause, motion multiplier, global export). The four-card layout and `Sheet` confirmation pattern are reusable.

## Visual purpose

The merchant settings hub inside `MerchantSurface`. A `MoHead` titled "Settings", then a responsive grid of four `ReceiptCard`s: **Venue details** (editable `MoField`s + save), **Staff PIN** (masked PIN boxes, reveal/hide, rotate), **Team** (two hardcoded members), and **Programme** (running/paused with a pause-confirmation `Sheet`).

## Props / state

| Prop | Type                  | Notes                                                                |
| ---- | --------------------- | -------------------------------------------------------------------- |
| `t`  | theme object          | Reads `t.mo` (motion multiplier; scales all animations and timers).  |
| `go` | `(screen, …) => void` | Navigation fn from host. **Received but not called** in this screen. |

**State (local):**

- `name` `"The Old Crown"`, `city` `"Bristol"`, `slug` `"old-crown"` — editable venue fields.
- `savedTick` (bool) — "Saved ✓" flash on the save button.
- `pin` `"7312"`, `pinShown` (bool), `rotated` (bool) — staff-PIN state.
- `pauseOpen` (bool, the `Sheet`), `paused` (bool, programme state).

**Effect (lines 435–439) — prototype-ism, auto-hide PIN:**

```jsx
useEffectMo(() => {
  if (!pinShown) return
  const id = setTimeout(() => setPinShown(false), 3400 * mo)
  return () => clearTimeout(id)
}, [pinShown, pin])
```

## UX behaviour & navigation

- **`saveVenue`** — sets `savedTick` true, then `setTimeout(() => setSavedTick(false), 1800 * mo)`. Purely cosmetic; nothing persists.
- **`rotateNow`** (the **Rotate now** `DemoTag`) — hardcodes the new PIN to **`"4906"`** (`setPin("4906")`), sets `rotated` true, reveals it. No real rotation.
- **Reveal today's PIN / Hide it** toggles `pinShown`; PIN auto-hides after `3400 * mo` ms (effect above). PIN boxes render `●` masked or the digit when shown, with a staggered `w-pop` animation per box.
- **Pause programme** → opens the `Sheet`; **Pause it** in the sheet sets `paused` true and closes it; **Resume programme** sets it back. **Keep it running** (`GhostLink`) just closes the sheet.
- `go` is **not** invoked. Screen wrapper `w-rise`; `data-screen-label="Merchant · Settings"`.

## Hardcoded demo data

- Venue: name `"The Old Crown"`, city `"Bristol"`, slug `"old-crown"` (prefix `nabaperks.app/m/`).
- Staff PIN: initial `"7312"`, rotated value `"4906"`.
- Team (lines 516–519): `[{ n: "Maya", role: "Manager", note: "Can reveal the PIN" }, { n: "Jordan", role: "Counter", note: "Stamps & redeems" }]` — first member gets the accent avatar + `ink` tone tag.
- Signed-in email: `hello@oldcrown.pub`.
- Programme copy references "Live since 21 May".

## Dependencies

- **Local sub-primitives:** `MoHead`, `MoField`.
- **Shared primitives (window):** `ReceiptCard`, `ReceiptRule`, `InkButton`, `MonoTag`, `MonoLine`, `VenueMark`, `Sheet`, `GhostLink`.
- **CSS variables:** `--w-ink`, `--w-ink-soft`, `--w-paper`, `--w-paper-2`, `--w-accent`, `--w-line`, `--w-r`, `--w-mono`.
- **Keyframes:** `w-rise` (screen entrance), `w-pop` (PIN-box reveal, staggered by `i * 45 * mo`).
- **localStorage:** none.
- **Globals / window:** reads `React` (`useStateMo`, `useEffectMo`); writes `window.MerchantSettings`.
- **Mocks:** `setTimeout` for the save flash, the PIN auto-hide effect, and the hardcoded `rotateNow`. No network.

## Reuse notes

The card structure, masked-PIN reveal pattern, and the calm pause-confirmation `Sheet` are all reusable references. **Important:** the entire "Staff PIN" card reflects the prototype's shared-PIN model — the live product replaced the handed-phone staff PIN with a **counter handshake** (per CLAUDE.md), so this card is prototype-era and should not be ported as-is. To productionise the rest: persist venue edits via a server action, source team + email from the merchant account, drop the `mo` multiplier and hardcoded values, and export properly.

## Source snippet

```jsx
function MerchantSettings({ t, go }) {
  const mo = t.mo
  const [name, setName] = useStateMo("The Old Crown")
  const [city, setCity] = useStateMo("Bristol")
  const [slug, setSlug] = useStateMo("old-crown")
  const [savedTick, setSavedTick] = useStateMo(false)
  const [pin, setPin] = useStateMo("7312")
  const [pinShown, setPinShown] = useStateMo(false)
  const [rotated, setRotated] = useStateMo(false)
  const [pauseOpen, setPauseOpen] = useStateMo(false)
  const [paused, setPaused] = useStateMo(false)

  useEffectMo(() => {
    if (!pinShown) return
    const id = setTimeout(() => setPinShown(false), 3400 * mo)
    return () => clearTimeout(id)
  }, [pinShown, pin])

  const saveVenue = () => {
    setSavedTick(true)
    setTimeout(() => setSavedTick(false), 1800 * mo)
  }
  const rotateNow = () => {
    setPin("4906")
    setRotated(true)
    setPinShown(true)
  }

  return (
    <div
      data-screen-label="Merchant · Settings"
      style={{ animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both` }}
    >
      <MoHead title="Settings" sub="Venue · staff PIN · team · programme" />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(310px, 1fr))",
          gap: 24,
          alignItems: "start",
        }}
      >
        {/* venue details */}
        <ReceiptCard mo={mo}>
          {/* … Venue name / City / Card link MoFields + Save venue details [trimmed] … */}
        </ReceiptCard>

        {/* staff PIN */}
        <ReceiptCard mo={mo}>
          {/* … masked PIN boxes (w-pop), Reveal/Hide, Rotate now [trimmed] … */}
          <div
            style={{
              display: "flex",
              gap: 9,
              justifyContent: "center",
              margin: "6px 0 14px",
            }}
          >
            {pin.split("").map((d, i) => (
              <div
                key={i}
                style={{
                  width: 46,
                  height: 56,
                  border: "2px solid var(--w-ink)",
                  borderRadius: "var(--w-r)",
                  background: "var(--w-paper)",
                  display: "grid",
                  placeItems: "center",
                  fontFamily: "var(--w-mono)",
                  fontSize: pinShown ? 24 : 15,
                  fontWeight: 700,
                  animation: pinShown
                    ? `w-pop ${280 * mo}ms ${i * 45 * mo}ms cubic-bezier(0.16,1.2,0.3,1) both`
                    : "none",
                }}
              >
                {pinShown ? d : "●"}
              </div>
            ))}
          </div>
          {/* … */}
        </ReceiptCard>

        {/* team */}
        <ReceiptCard mo={mo}>
          {/* … Maya / Jordan rows [trimmed] … */}
        </ReceiptCard>

        {/* pause programme */}
        <ReceiptCard mo={mo}>
          {/* … Running/Paused tag + Pause/Resume button [trimmed] … */}
          {paused ? (
            <InkButton size="md" full onClick={() => setPaused(false)}>
              Resume programme
            </InkButton>
          ) : (
            <InkButton
              size="md"
              full
              variant="outline"
              onClick={() => setPauseOpen(true)}
            >
              Pause programme
            </InkButton>
          )}
        </ReceiptCard>
      </div>

      <Sheet open={pauseOpen} onClose={() => setPauseOpen(false)} mo={mo}>
        {/* … "Pause the programme?" confirmation [trimmed] … */}
        <div style={{ display: "grid", gap: 10 }}>
          <InkButton
            full
            variant="dark"
            onClick={() => {
              setPaused(true)
              setPauseOpen(false)
            }}
          >
            Pause it
          </InkButton>
          <GhostLink onClick={() => setPauseOpen(false)}>
            Keep it running
          </GhostLink>
        </div>
      </Sheet>
    </div>
  )
}
```

_(Card bodies marked `[trimmed]`; verbatim copy + the team array are in the aggregation `Copy strings` / `Flow & state` sections.)_

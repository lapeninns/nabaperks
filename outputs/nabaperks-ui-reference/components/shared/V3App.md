# V3App (app shell)

- **Surface:** shared (top-level orchestrator / prototype chrome)
- **Source module:** [extracted-source/90-app-shell.jsx](../../extracted-source/90-app-shell.jsx) (lines 15–96)
- **Export:** none — mounted directly via `ReactDOM.createRoot(document.getElementById("root")).render(<V3App />)` (line 98)
- **Reuse verdict:** 🔒 Prototype-only (it is the demo harness: surface switcher chrome + Tweaks wiring + localStorage deep-link priming)

## Visual purpose

The root component of the whole prototype. It renders exactly one "surface" at a time (Journey / Marketing / Merchant / Customer / Staff / Admin), plus two pieces of always-on prototype chrome: a fixed bottom-centre **surface switcher** pill bar, and the floating **Tweaks panel** of design controls. It is the thing that makes a single HTML file behave like six apps.

## Props / state

Takes no props (it is the render root).

| State      | Source                                                          | Notes                                                                   |
| ---------- | --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `t`        | `useTweaks(V3_TWEAK_DEFAULTS)`                                  | The live tweak object passed to every surface as `t`.                   |
| `setTweak` | `useTweaks(...)`                                                | Updates a tweak value (and, via the tweaks host protocol, persists it). |
| `surface`  | `useStateSh(() => localStorage v3_surface, fallback "Journey")` | Which surface is mounted. Validated against `V3_SURFACES`.              |

## UX behaviour

- **Surface persistence:** an effect writes `surface` to `localStorage["v3_surface"]` on every change, so a reload reopens the same surface.
- **Live theming from tweaks:** an effect mirrors tweak values onto the document — `document.documentElement.style.setProperty("--w-accent", t.ink)` and `document.body.dataset.grain = String(t.grain)`. So the "Accent ink" and "Paper grain" tweaks re-theme every surface instantly.
- **Surface switcher:** a fixed, horizontally-scrollable pill bar at `bottom:16px`, dark ink background, one button per surface; the active surface shows paper-on-ink, others are dimmed. Journey's label is prefixed with the `✱` wordmark disc. Clicking sets the surface and scrolls to top.
- **`go(target, preset)` deep-link:** the cross-surface navigation primitive threaded into every surface. It looks up `window.<Target>Entry` (e.g. `window.CustomerEntry`), and if that entry exposes `presets[preset]`, it writes that preset blob into the entry's `lsKey` _before_ switching surface — so the target surface boots straight into the requested screen/stage. Then `setSurfaceRaw(target)` + `window.scrollTo(0,0)`.

## Dependencies

- **Shared primitives:** none directly.
- **Cross-module components (read as globals):** `JourneyMap`, `MarketingSite`, `MerchantSurface`, `CustomerFlow`, `StaffSurface`, `AdminSurface`, plus `TweaksPanel`, `TweakSection`, `TweakRadio`, `TweakSlider`, `TweakColor`, `TweakToggle` and the `useTweaks` hook.
- **Cross-module entry objects:** `window.CustomerEntry`, `window.MerchantEntry`, `window.StaffEntry`, `window.AdminEntry`, `window.MarketingEntry` (each `{ lsKey, presets }`). Note: Journey has no Entry (it is stateless and is the default).
- **CSS variables:** `--w-accent` (written at runtime from `t.ink`), `--w-ink`, `--w-paper`, `--w-mono`.
- **localStorage:** `v3_surface` (own), and writes every other surface's key when priming a preset.
- **Globals / window:** reads `React`, `ReactDOM`, all surface components and Entry objects off `window`.

## Reuse notes

🔒 Prototype-only. This is the demo's spine, not a portable component: it assumes a single-page, all-surfaces-in-one-bundle world, drives navigation by writing JSON into `localStorage` and flipping a string, and reads everything off `window`. In production these surfaces are separate Next.js routes/apps (per the repo's spec-domain map), so the switcher, the `go()`-via-localStorage trick, and the global Entry objects all disappear. **What _is_ reusable as reference:** the tweak schema (`V3_TWEAK_DEFAULTS`) documents every design dial the prototype exposes, and the `t.ink → --w-accent` / `t.grain → body[data-grain]` wiring shows exactly how the theme is meant to be driven.

## Config: V3_TWEAK_DEFAULTS & V3_SURFACES

The global design-control schema (verbatim) and the surface list:

```jsx
const V3_TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/ {
  celebration: "Slam", // stamp moment: Slam | Ripple | Burst
  reveal: "Hold", // seal reveal: Hold | Tap
  verify: "PIN", // counter check: PIN | GPS
  mo: 1, // motion scale 0.5–2 (×duration multiplier everywhere)
  ink: "#E8430F", // accent ink: #E8430F vermillion | #2B43C8 cobalt | #1E8A4C leaf
  grain: true, // paper grain overlay on/off
} /*EDITMODE-END*/

const V3_SURFACES = [
  "Journey",
  "Marketing",
  "Merchant",
  "Customer",
  "Staff",
  "Admin",
]
```

These six are the "6 surfaces" named in the JourneyMap header. `mo` (motion scale) is the single most cross-cutting tweak — almost every animation duration/delay in every module is written as `ms * t.mo`.

## Source snippet

```jsx
function V3App() {
  const [t, setTweak] = useTweaks(V3_TWEAK_DEFAULTS)
  const [surface, setSurfaceRaw] = useStateSh(() => {
    const s = localStorage.getItem("v3_surface")
    return V3_SURFACES.includes(s) ? s : "Journey"
  })

  useEffectSh(() => {
    localStorage.setItem("v3_surface", surface)
  }, [surface])
  useEffectSh(() => {
    document.documentElement.style.setProperty("--w-accent", t.ink)
    document.body.dataset.grain = String(t.grain)
  }, [t.ink, t.grain])

  // go("Customer", "sealed") — prime the target surface's state, then switch.
  const go = (target, preset) => {
    const entries = {
      Customer: window.CustomerEntry,
      Merchant: window.MerchantEntry,
      Staff: window.StaffEntry,
      Admin: window.AdminEntry,
      Marketing: window.MarketingEntry,
    }
    const entry = entries[target]
    if (entry && preset && entry.presets && entry.presets[preset]) {
      localStorage.setItem(entry.lsKey, JSON.stringify(entry.presets[preset]))
    }
    setSurfaceRaw(target)
    window.scrollTo(0, 0)
  }

  return (
    <div>
      {surface === "Journey" && <JourneyMap t={t} go={go} />}
      {surface === "Marketing" && <MarketingSite t={t} go={go} />}
      {surface === "Merchant" && <MerchantSurface t={t} go={go} />}
      {surface === "Customer" && <CustomerFlow t={t} go={go} />}
      {surface === "Staff" && <StaffSurface t={t} go={go} />}
      {surface === "Admin" && <AdminSurface t={t} go={go} />}
      {/* surface switcher — prototype chrome */}
      <div
        style={{
          position: "fixed",
          bottom: 16,
          left: "50%",
          transform: "translateX(-50%)" /* …pill bar… */,
        }}
      >
        {V3_SURFACES.map((s) => (
          <button
            key={s}
            onClick={() => {
              setSurfaceRaw(s)
              window.scrollTo(0, 0)
            }} /* …active=paper-on-ink… */
          >
            {s === "Journey" ? "✱ Journey" : s}
          </button>
        ))}
      </div>
      <TweaksPanel>
        {/* Celebration / Seal reveal / Counter check / Motion / Ink / Grain controls */}
      </TweaksPanel>
    </div>
  )
}
ReactDOM.createRoot(document.getElementById("root")).render(<V3App />)
```

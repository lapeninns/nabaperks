# GpsCheck

- **Surface:** shared (primitive)
- **Source module:** [extracted-source/10-primitives.jsx](../../extracted-source/10-primitives.jsx) (lines 415–457)
- **Export:** `window.GpsCheck` (global)
- **Reuse verdict:** 🔒 Prototype-only (location is fully simulated via `setTimeout`; inline styles, prop-driven timing, global export)

## Visual purpose

An animated location check-in screen offered as an alternative to the staff PIN. It shows expanding cobalt "radar" ripples around a pulsing locator dot while "locating", then pops a green `VenueMark` (`✓` / `12 M AWAY`) once "found", before auto-advancing to stamp the card.

> **Prototype-ism.** The footer states "location simulated in this prototype" — no real geolocation is requested. The two phases are driven purely by `setTimeout`.

## Props / state

| Prop     | Type         | Default           | Notes                                                                 |
| -------- | ------------ | ----------------- | --------------------------------------------------------------------- |
| `onDone` | `() => void` | —                 | Called after the "found" phase resolves (`2500 * mo` ms after mount). |
| `venue`  | `string`     | `"The Old Crown"` | Venue name interpolated into the status copy.                         |
| `mo`     | `number`     | `1`               | Motion multiplier; scales the phase timers and animations.            |

**State:** `const [phase, setPhase] = useState("locating")` — transitions to `"found"`.

## UX behaviour — timing mocks present

- On mount, a `useEffect` sets two `setTimeout`s: one flips `phase → "found"` at `1600 * mo` ms; the other calls `onDone()` at `2500 * mo` ms. Both are cleared on unmount. **These `setTimeout`s are the prototype timing mock** standing in for a real geolocation lookup.
- Heading (`MonoLine`, strong): "Checking you're at the venue" → "You're here".
- "Locating" visuals: three `70×70` cobalt ripple rings (`w-ripple`, infinite, staggered by `i*450` ms) around a `22px` cobalt locator dot.
- "Found" visuals: the dot is replaced by `<VenueMark size={92} initials="✓" caption="12 M AWAY" color="var(--w-leaf)" angle={-6} />`, entering via `w-pop`.
- Sub copy (display font): `Looking for {venue}…` → `{venue} confirmed — stamping your card.`
- Footer `MonoLine`: "One stamp per day · location simulated in this prototype".

## Dependencies

- **Shared primitives:** `MonoLine` (heading + footer), `VenueMark` (the "found" mark).
- **CSS variables:** `--w-ink`, `--w-ink-soft`, `--w-cobalt`, `--w-leaf`, `--w-display`.
- **Keyframes:** `w-ripple` (locating rings), `w-pop` (found mark entrance).
- **localStorage:** none.
- **Globals / window:** reads `React` (destructured `useState`, `useEffect`); writes itself to `window.GpsCheck`.

## Reuse notes

Prototype-only: the location check is entirely faked with timers and never touches the Geolocation API. The screen design (radar ripples → confirmed mark → auto-advance) is a good reference for a real GPS check-in, but a production build must: (1) request real geolocation and surface permission-denied / not-at-venue states (the prototype only shows the happy path); (2) per the product model, GPS must _never block_ — it writes `fraud_flags` for review, so "found" should not be a hard gate; (3) replace `setTimeout` phases with real async resolution; (4) move inline styles to tokens and honour `prefers-reduced-motion`; (5) replace `window.*` with a module export. Default `venue` "The Old Crown" is demo content.

## Source snippet

```jsx
function GpsCheck({ onDone, venue = "The Old Crown", mo = 1 }) {
  const [phase, setPhase] = useState("locating")
  useEffect(() => {
    const a = setTimeout(() => setPhase("found"), 1600 * mo)
    const b = setTimeout(() => onDone && onDone(), 2500 * mo)
    return () => {
      clearTimeout(a)
      clearTimeout(b)
    }
  }, [])
  return (
    <div style={{ textAlign: "center", padding: "6px 0 10px" }}>
      <MonoLine style={{ color: "var(--w-ink)", fontWeight: 700 }}>
        {phase === "locating" ? "Checking you're at the venue" : "You're here"}
      </MonoLine>
      <div
        style={{
          position: "relative",
          width: 150,
          height: 150,
          margin: "22px auto",
        }}
      >
        {phase === "locating" &&
          [0, 1, 2].map((i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 70,
                height: 70,
                marginLeft: -35,
                marginTop: -35,
                border: "2.5px solid var(--w-cobalt)",
                borderRadius: "50%",
                animation: `w-ripple ${1500 * mo}ms ${i * 450 * mo}ms cubic-bezier(0.2,0,0,1) infinite`,
                opacity: 0,
              }}
            ></div>
          ))}
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            transform: "translate(-50%,-50%)",
            animation:
              phase === "found"
                ? `w-pop ${360 * mo}ms cubic-bezier(0.16,1.2,0.3,1) both`
                : "none",
          }}
        >
          {phase === "locating" ? (
            <div
              style={{
                width: 22,
                height: 22,
                borderRadius: "50%",
                background: "var(--w-cobalt)",
                border: "2px solid var(--w-ink)",
              }}
            ></div>
          ) : (
            <VenueMark
              size={92}
              initials="✓"
              caption="12 M AWAY"
              color="var(--w-leaf)"
              angle={-6}
            />
          )}
        </div>
      </div>
      <div
        style={{
          fontSize: 14,
          color: "var(--w-ink-soft)",
          fontFamily: "var(--w-display)",
        }}
      >
        {phase === "locating"
          ? `Looking for ${venue}…`
          : `${venue} confirmed — stamping your card.`}
      </div>
      <MonoLine style={{ marginTop: 16, fontSize: 10 }}>
        One stamp per day · location simulated in this prototype
      </MonoLine>
    </div>
  )
}
```

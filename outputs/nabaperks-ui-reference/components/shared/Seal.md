# Seal

- **Surface:** shared (primitive)
- **Source module:** [extracted-source/10-primitives.jsx](../../extracted-source/10-primitives.jsx) (lines 358–411)
- **Export:** `window.Seal` (global)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (real-time timer logic, inline styles, prop-driven timing, global export)

## Visual purpose

A "mystery seal" reveal control: a tilted `var(--w-sun)` wax-stamp disc bearing a `?`, surrounded by a conic-gradient progress ring. The user presses and holds (or taps) to "break the seal"; the ring fills, the seal wiggles, then shakes and breaks, firing `onBroken`. Used to gate a reward reveal.

## Props / state

| Prop       | Type              | Default  | Notes                                                                         |
| ---------- | ----------------- | -------- | ----------------------------------------------------------------------------- |
| `mode`     | `"Hold" \| "Tap"` | `"Hold"` | `Hold` = press-and-hold to fill the ring; `Tap` = break immediately on press. |
| `onBroken` | `() => void`      | —        | Called `360 * mo` ms after the break animation starts.                        |
| `mo`       | `number`          | `1`      | Motion multiplier; scales hold duration, break delay, and animations.         |
| `size`     | `number`          | `104`    | Disc diameter; drives the `?` glyph size.                                     |

**State:** `progress` (`0→1` ring fill), `breaking` (boolean, plays the break/shake). Plus `timer = useRef(null)` holding the `setInterval` handle.

## UX behaviour — timing mocks present

- **`start` (pointer down):**
  - `Tap` mode → calls `finish()` immediately.
  - `Hold` mode → records `t0 = Date.now()` and opens a `setInterval(…, 24)` that recomputes `progress = min(1, (Date.now() - t0) / (850 * mo))`; at `p >= 1` it clears the interval and calls `finish()`. **`Date.now()` + `setInterval` are prototype timing mocks** for the hold gesture.
- **`stop` (pointer up / leave):** in `Hold` mode, clears the interval and resets `progress` to 0 (unless already `breaking`); in `Tap` mode does nothing.
- **`finish`:** sets `breaking = true`, then `setTimeout(onBroken, 360 * mo)` — another timing mock for the break delay.
- Cleanup: `useEffect(() => () => clearInterval(timer.current), [])` clears the interval on unmount.
- Animation: container plays `w-shake` while `breaking`, else `w-wiggle` (infinite) while `progress > 0`, else none — all scaled by `mo`.
- Visuals: outer conic-gradient ring (`var(--w-ink)` up to `progress*360deg`) masked to a thin ring via `radial-gradient` mask; inner `var(--w-sun)` disc with `2px solid var(--w-ink)`, `var(--w-shadow-sm)`, rotated `-6deg`, dashed inner ring, and a display-font `?` at `size * 0.42`.
- Footer `MonoLine`: "Press & hold to break the seal" (Hold) or "Tap to break the seal" (Tap).

## Dependencies

- **Shared primitives:** `MonoLine` (footer instruction).
- **CSS variables:** `--w-ink`, `--w-sun`, `--w-display`, `--w-shadow-sm`.
- **Keyframes:** `w-shake` (breaking), `w-wiggle` (holding).
- **localStorage:** none.
- **Globals / window:** reads `React` (destructured `useState`, `useEffect`, `useRef`); writes itself to `window.Seal`.

## Reuse notes

A delightful, on-brand reveal gesture worth keeping as a reference. The `Date.now()`/`setInterval`/`setTimeout` are **prototype timing mocks** standing in for the hold gesture and break delay — a production version should keep the gesture (it is real UX, not faked data) but: (1) reduce reliance on a 24ms polling interval (consider `requestAnimationFrame` or a CSS-driven hold); (2) move inline styles to tokens; (3) respect `prefers-reduced-motion` instead of the `mo` prop; (4) replace `window.*` with a module export. The conic-gradient + mask ring technique is worth documenting.

## Source snippet

```jsx
function Seal({ mode = "Hold", onBroken, mo = 1, size = 104 }) {
  const [progress, setProgress] = useState(0)
  const [breaking, setBreaking] = useState(false)
  const timer = useRef(null)

  const finish = () => {
    setBreaking(true)
    setTimeout(() => onBroken && onBroken(), 360 * mo)
  }
  const start = () => {
    if (mode === "Tap") {
      finish()
      return
    }
    const t0 = Date.now()
    timer.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - t0) / (850 * mo))
      setProgress(p)
      if (p >= 1) {
        clearInterval(timer.current)
        finish()
      }
    }, 24)
  }
  const stop = () => {
    if (mode === "Tap") return
    clearInterval(timer.current)
    if (!breaking) setProgress(0)
  }
  useEffect(() => () => clearInterval(timer.current), [])

  return (
    <div style={{ textAlign: "center" }}>
      <div
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        style={{
          width: size,
          height: size,
          margin: "0 auto",
          position: "relative",
          cursor: "pointer",
          userSelect: "none",
          touchAction: "none",
          animation: breaking
            ? `w-shake ${300 * mo}ms`
            : progress > 0
              ? `w-wiggle ${420 * mo}ms infinite`
              : "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: -6,
            borderRadius: "50%",
            background: `conic-gradient(var(--w-ink) ${progress * 360}deg, transparent 0deg)`,
            WebkitMask: "radial-gradient(circle, transparent 64%, #000 65%)",
            mask: "radial-gradient(circle, transparent 64%, #000 65%)",
          }}
        ></div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: "var(--w-sun)",
            border: "2px solid var(--w-ink)",
            boxShadow: "var(--w-shadow-sm)",
            display: "grid",
            placeItems: "center",
            transform: "rotate(-6deg)",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 7,
              border: "1.5px dashed rgba(33,28,22,0.5)",
              borderRadius: "50%",
            }}
          ></div>
          <div
            style={{
              fontFamily: "var(--w-display)",
              fontWeight: 800,
              fontSize: size * 0.42,
            }}
          >
            ?
          </div>
        </div>
      </div>
      <MonoLine style={{ marginTop: 14 }}>
        {mode === "Hold"
          ? "Press & hold to break the seal"
          : "Tap to break the seal"}
      </MonoLine>
    </div>
  )
}
```

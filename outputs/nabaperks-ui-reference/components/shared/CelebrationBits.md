# CelebrationBits

- **Surface:** shared (primitive)
- **Source module:** [extracted-source/10-primitives.jsx](../../extracted-source/10-primitives.jsx) (lines 142–192)
- **Export:** `window.CelebrationBits` (global)
- **Reuse verdict:** 🔒 Prototype-only (deterministic seeded particle generator, inline styles, CSS-var animation hooks)

## Visual purpose

An absolutely-positioned particle layer overlaid on a stamp/celebration moment. Renders one of three effects: `Ripple` (expanding rings), `Slam`/`Burst` (ink "splats" radiating from centre), and `Burst` additionally throws 16 confetti chips. Positions are computed deterministically from a `seed` (sine-based pseudo-random) so the scatter is stable across renders.

## Props / state

| Prop   | Type                            | Default  | Notes                                                                                                   |
| ------ | ------------------------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `type` | `"Slam" \| "Burst" \| "Ripple"` | `"Slam"` | Selects which particle sets render. `Slam` = splats; `Burst` = splats + confetti; `Ripple` = two rings. |
| `mo`   | `number`                        | `1`      | Motion multiplier; scales every animation duration/delay.                                               |
| `seed` | `number`                        | `1`      | Drives the deterministic `rnd()` scatter; memoised on `[seed]`.                                         |

**State:** none. Uses `useMemo(..., [seed])` to compute `splats` (7) and `confetti` (16) once per seed.

## UX behaviour

- `rnd(i, s)` = `Math.sin(seed*997 + i*131 + s*17) * 10000`, fractional part — a deterministic pseudo-random in `[0,1)`.
- **Splats** (7): random offset `sx/sy` (±55px), `size` 4–11px, `delay` 0–60ms; accent-coloured circles animated via `w-splat` (`480ms`), passing `--sx`/`--sy` CSS variables to the keyframe.
- **Confetti** (16): random `cx` (±110px), `cy` (-30 to -190px), rotation `cr` (±270deg), `w` 5–11 / `h` 8–16, colour cycling `[accent, ink, cobalt, sun]`; animated via `w-confetti` (`900ms`), passing `--cx`/`--cy`/`--cr`.
- **Ripple** (2 rings): `70×70` accent-bordered circles, staggered (`620 + i*200` ms, `i*120` ms delay), via `w-ripple`.
- Container is `position: absolute; inset: 0; pointerEvents: none; overflow: visible` — it never intercepts taps.
- All particle elements start `opacity: 0` and rely on the keyframe `forwards` fill.

## Dependencies

- **Shared primitives:** none. (Rendered _by_ `StampDisc` when `slammed`.)
- **CSS variables:** `--w-accent`, `--w-ink`, `--w-cobalt`, `--w-sun`. Sets custom props `--sx`, `--sy`, `--cx`, `--cy`, `--cr` consumed by the keyframes.
- **Keyframes:** `w-ripple`, `w-splat`, `w-confetti`.
- **localStorage:** none.
- **Globals / window:** reads `React` (destructured `useMemo`); writes itself to `window.CelebrationBits`.

## Reuse notes

Prototype-only as written: the sine-hash particle generator and CSS-variable→keyframe coupling are clever but opaque, and the whole effect is decorative. For production: (1) gate behind `prefers-reduced-motion`; (2) replace the inline `rnd` with a documented seeded RNG or precomputed layouts; (3) move the CSS-var animation hooks into a documented, reusable particle utility; (4) replace `window.*` with a module export. No timing mocks (`setInterval`/`Date.now`) — timing is purely CSS animation, scaled by `mo`. Worth keeping the _visual recipe_ as a reference, not the code.

## Source snippet

```jsx
function CelebrationBits({ type = "Slam", mo = 1, seed = 1 }) {
  const bits = useMemo(() => {
    const rnd = (i, s) => {
      const x = Math.sin(seed * 997 + i * 131 + s * 17) * 10000
      return x - Math.floor(x)
    }
    const splats = Array.from({ length: 7 }, (_, i) => ({
      sx: (rnd(i, 1) - 0.5) * 110,
      sy: (rnd(i, 2) - 0.5) * 110,
      size: 4 + rnd(i, 3) * 7,
      delay: rnd(i, 4) * 60,
    }))
    const confetti = Array.from({ length: 16 }, (_, i) => ({
      cx: (rnd(i, 5) - 0.5) * 220,
      cy: -30 - rnd(i, 6) * 160,
      cr: (rnd(i, 7) - 0.5) * 540,
      w: 5 + rnd(i, 8) * 6,
      h: 8 + rnd(i, 9) * 8,
      color: [
        "var(--w-accent)",
        "var(--w-ink)",
        "var(--w-cobalt)",
        "var(--w-sun)",
      ][i % 4],
      delay: rnd(i, 10) * 110,
    }))
    return { splats, confetti }
  }, [seed])

  const center = { position: "absolute", left: "50%", top: "50%" }
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      {type === "Ripple" &&
        [0, 1].map((i) => (
          <div
            key={"r" + i}
            style={{
              ...center,
              width: 70,
              height: 70,
              marginLeft: -35,
              marginTop: -35,
              border: "3px solid var(--w-accent)",
              borderRadius: "50%",
              animation: `w-ripple ${(620 + i * 200) * mo}ms ${i * 120 * mo}ms cubic-bezier(0.2,0,0,1) forwards`,
              opacity: 0,
            }}
          ></div>
        ))}
      {(type === "Slam" || type === "Burst") &&
        bits.splats.map((s, i) => (
          <div
            key={"s" + i}
            style={{
              ...center,
              width: s.size,
              height: s.size,
              marginLeft: -s.size / 2,
              marginTop: -s.size / 2,
              background: "var(--w-accent)",
              borderRadius: "50%",
              "--sx": s.sx + "px",
              "--sy": s.sy + "px",
              animation: `w-splat ${480 * mo}ms ${s.delay * mo}ms cubic-bezier(0.2,0,0,1) forwards`,
              opacity: 0,
            }}
          ></div>
        ))}
      {type === "Burst" &&
        bits.confetti.map((c, i) => (
          <div
            key={"c" + i}
            style={{
              ...center,
              width: c.w,
              height: c.h,
              marginLeft: -c.w / 2,
              marginTop: -c.h / 2,
              background: c.color,
              border: "1px solid var(--w-ink)",
              "--cx": c.cx + "px",
              "--cy": c.cy + "px",
              "--cr": c.cr + "deg",
              animation: `w-confetti ${900 * mo}ms ${c.delay * mo}ms cubic-bezier(0.2,0,0,1) forwards`,
              opacity: 0,
            }}
          ></div>
        ))}
    </div>
  )
}
```

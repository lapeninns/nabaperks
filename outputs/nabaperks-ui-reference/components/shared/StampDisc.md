# StampDisc

- **Surface:** shared (primitive)
- **Source module:** [extracted-source/10-primitives.jsx](../../extracted-source/10-primitives.jsx) (lines 196–230)
- **Export:** `window.StampDisc` (global)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles, prop-driven animation timing, hard-coded fallback date, global export)

## Visual purpose

A single loyalty-card stamp slot in two states: **filled** (a tilted accent disc with the `✱` wordmark glyph, a dashed inner ring, and a mono date) or **empty** (a dashed-outline circle showing its 1-based index number). When freshly applied (`slammed`) it plays a slam or soft-stamp animation and overlays `CelebrationBits`.

## Props / state

| Prop          | Type                            | Default  | Notes                                                                                        |
| ------------- | ------------------------------- | -------- | -------------------------------------------------------------------------------------------- |
| `filled`      | `boolean`                       | —        | Renders the inked disc (true) or the empty numbered slot (false).                            |
| `index`       | `number`                        | —        | 0-based position; empty slot shows `index + 1`; also seeds `CelebrationBits` as `index + 2`. |
| `slammed`     | `boolean`                       | —        | When true, runs the apply animation and renders `CelebrationBits`.                           |
| `celebration` | `"Slam" \| "Ripple" \| "Burst"` | `"Slam"` | `Ripple` → `w-soft-stamp`; otherwise `w-slam`. Passed through to `CelebrationBits`.          |
| `mo`          | `number`                        | `1`      | Motion multiplier; scales animation durations.                                               |
| `size`        | `number`                        | `64`     | Disc diameter; drives derived font sizes.                                                    |
| `date`        | `string`                        | —        | Mono date label on the filled disc. Falls back to the literal `"12 JUN"` when absent.        |

**State:** none (stateless function component).

## UX behaviour

- Apply animation when `slammed`: `Ripple` → `w-soft-stamp 340ms cubic-bezier(0.2,0,0,1) both`; else `w-slam 380ms cubic-bezier(0.16,1.2,0.3,1) both` (both × `mo`).
- **Filled:** accent-background circle, white text, `2px solid var(--w-ink)`, rotated `-6deg`; dashed white inner ring at `inset: 5`. Centre shows the `✱` glyph at `size * 0.4` (display, weight 800) and a mono date at `Math.max(7, size * 0.11)`.
- **Empty:** `2px dashed var(--w-line)` circle, ink-soft mono numeral at `size * 0.26` showing `index + 1`.
- When `slammed`, mounts `<CelebrationBits type={celebration} mo={mo} seed={index + 2} />` as an overlay.

## Dependencies

- **Shared primitives:** `CelebrationBits` (rendered when `slammed`).
- **CSS variables:** `--w-accent`, `--w-ink`, `--w-line`, `--w-ink-soft`, `--w-display`, `--w-mono`.
- **Keyframes:** `w-soft-stamp`, `w-slam` (apply); plus those used by `CelebrationBits` (`w-ripple`, `w-splat`, `w-confetti`).
- **localStorage:** none.
- **Globals / window:** reads `React`; writes itself to `window.StampDisc`.

## Reuse notes

The filled/empty stamp slot is core product UI and worth preserving. For production: (1) the fallback date `"12 JUN"` is demo content — production must always supply a real `date`; (2) move inline styles to the token/`data-slot` layer; (3) drive animation via CSS classes + `prefers-reduced-motion` rather than `mo` props; (4) replace `window.*` with a module export. The `✱` glyph is the wordmark signature, used correctly here. No timing mocks.

## Source snippet

```jsx
function StampDisc({
  filled,
  index,
  slammed,
  celebration = "Slam",
  mo = 1,
  size = 64,
  date,
}) {
  const anim = slammed
    ? celebration === "Ripple"
      ? `w-soft-stamp ${340 * mo}ms cubic-bezier(0.2,0,0,1) both`
      : `w-slam ${380 * mo}ms cubic-bezier(0.16,1.2,0.3,1) both`
    : "none"
  return (
    <div style={{ position: "relative", width: size, height: size }}>
      {filled ? (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            background: "var(--w-accent)",
            color: "#fff",
            border: "2px solid var(--w-ink)",
            display: "grid",
            placeItems: "center",
            transform: "rotate(-6deg)",
            animation: anim,
            position: "relative",
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: 5,
              border: "1.5px dashed rgba(255,255,255,0.65)",
              borderRadius: "50%",
            }}
          ></div>
          <div style={{ textAlign: "center", lineHeight: 1 }}>
            <div
              style={{
                fontSize: size * 0.4,
                fontWeight: 800,
                fontFamily: "var(--w-display)",
              }}
            >
              ✱
            </div>
            <div
              style={{
                fontFamily: "var(--w-mono)",
                fontSize: Math.max(7, size * 0.11),
                letterSpacing: "0.04em",
                marginTop: 1,
              }}
            >
              {date || "12 JUN"}
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            width: size,
            height: size,
            borderRadius: "50%",
            border: "2px dashed var(--w-line)",
            display: "grid",
            placeItems: "center",
            color: "var(--w-ink-soft)",
            fontFamily: "var(--w-mono)",
            fontSize: size * 0.26,
          }}
        >
          {index + 1}
        </div>
      )}
      {slammed && (
        <CelebrationBits type={celebration} mo={mo} seed={index + 2} />
      )}
    </div>
  )
}
```

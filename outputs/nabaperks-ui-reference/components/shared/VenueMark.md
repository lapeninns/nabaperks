# VenueMark

- **Surface:** shared (primitive)
- **Source module:** [extracted-source/10-primitives.jsx](../../extracted-source/10-primitives.jsx) (lines 94–112)
- **Export:** `window.VenueMark` (global)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles, global export, hard-coded default copy)

## Visual purpose

The rubber-stamp venue logo: a tilted circular "stamp" with a double ring (solid outer + dashed inner), large display-font initials, and a small mono caption. Evokes a hand-applied ink stamp. Reused beyond venues — `GpsCheck` renders it with initials `✓` / caption `12 M AWAY` to show a confirmed location.

## Props / state

| Prop       | Type                  | Default             | Notes                                                |
| ---------- | --------------------- | ------------------- | ---------------------------------------------------- |
| `initials` | `string`              | `"OC"`              | Large display text in the centre.                    |
| `caption`  | `string`              | `"OLD CROWN"`       | Small mono caption; only rendered when `size >= 58`. |
| `size`     | `number`              | `72`                | Drives width/height and all derived font sizes.      |
| `color`    | `string (CSS colour)` | `"var(--w-accent)"` | Border + ring + text colour.                         |
| `angle`    | `number (deg)`        | `-8`                | Rotation, for the off-kilter stamp look.             |

**State:** none (stateless function component).

## UX behaviour

- Circular `div` (`borderRadius: 50%`), `2.5px solid` outer border in `color`, rotated by `angle`.
- Absolutely-positioned inner ring at `inset: 4`, `1.5px dashed` in `color`, `opacity: 0.75`.
- Initials sized at `size * 0.34` (display font, weight 800); caption sized at `Math.max(6.5, size * 0.082)` (mono), capped to `maxWidth: size * 0.74` with `whiteSpace: nowrap` + `overflow: hidden`.
- Caption is conditionally hidden below `size: 58` to avoid crowding small marks.
- Purely presentational — no interaction.

## Dependencies

- **Shared primitives:** none.
- **CSS variables:** `--w-accent` (default `color`), `--w-display`, `--w-mono`. (Callers pass other colour tokens, e.g. `--w-leaf` from `GpsCheck`.)
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** reads `React`; writes itself to `window.VenueMark`.

## Reuse notes

A strong, distinctive brand mark worth preserving. For production: (1) move inline styles into the token/`data-slot` layer; (2) the default `initials`/`caption` ("OC" / "OLD CROWN") are demo content — production callers must always pass real venue data; (3) replace `window.*` with a module export. The size-driven font scaling is clean and worth keeping. The `✱` disc is not used here (initials are arbitrary text). No state or timing mocks.

## Source snippet

```jsx
function VenueMark({
  initials = "OC",
  caption = "OLD CROWN",
  size = 72,
  color = "var(--w-accent)",
  angle = -8,
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        flexShrink: 0,
        border: `2.5px solid ${color}`,
        color,
        display: "grid",
        placeItems: "center",
        position: "relative",
        transform: `rotate(${angle}deg)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 4,
          borderRadius: "50%",
          border: `1.5px dashed ${color}`,
          opacity: 0.75,
        }}
      ></div>
      <div style={{ textAlign: "center", lineHeight: 1 }}>
        <div
          style={{
            fontFamily: "var(--w-display)",
            fontWeight: 800,
            fontSize: size * 0.34,
          }}
        >
          {initials}
        </div>
        {size >= 58 && (
          <div
            style={{
              fontFamily: "var(--w-mono)",
              fontSize: Math.max(6.5, size * 0.082),
              letterSpacing: "0.02em",
              marginTop: 3,
              maxWidth: size * 0.74,
              overflow: "hidden",
              whiteSpace: "nowrap",
              margin: "3px auto 0",
            }}
          >
            {caption}
          </div>
        )}
      </div>
    </div>
  )
}
```

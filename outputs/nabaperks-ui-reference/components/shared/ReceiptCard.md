# ReceiptCard

- **Surface:** shared (primitive)
- **Source module:** [extracted-source/10-primitives.jsx](../../extracted-source/10-primitives.jsx) (lines 116–134)
- **Export:** `window.ReceiptCard` (global)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles, CSS gradient zig-zag, prop-driven animation timing, global export)

## Visual purpose

The signature container of the Wet Ink system: a hard-bordered card with a torn/perforated **zig-zag bottom edge** rendered via layered CSS gradients, sitting on a hard offset drop-shadow. Mimics a paper receipt. Can `shake` (error feedback) via the `w-shake` keyframe, with the duration scaled by the `mo` motion multiplier.

## Props / state

| Prop       | Type            | Default | Notes                                                             |
| ---------- | --------------- | ------- | ----------------------------------------------------------------- |
| `children` | `ReactNode`     | —       | Card body content.                                                |
| `shaking`  | `boolean`       | —       | When true, runs the `w-shake` animation (error/invalid feedback). |
| `mo`       | `number`        | `1`     | Motion multiplier; scales the shake duration (`300 * mo` ms).     |
| `style`    | `CSSProperties` | —       | Spread onto the outer (shadow) wrapper.                           |

**State:** none (stateless function component).

## UX behaviour

- Outer wrapper applies `filter: drop-shadow(var(--w-shadow))` so the shadow follows the zig-zag silhouette (a regular `box-shadow` would not).
- Inner body: `background: var(--w-card)`, `2px solid var(--w-ink)` border with `borderBottom: none`, top corners rounded (`var(--w-r) var(--w-r) 0 0`), padding `20px 20px 14px`.
- Shake: `animation: w-shake 300ms cubic-bezier(0.36,0.07,0.19,0.97)` (× `mo`) when `shaking`, else `none`.
- Bottom edge: a 12px-tall strip whose two `linear-gradient` layers (-45° and 45°, `17px` tiles) cut the perforated triangular border. `marginTop: -1` butts it against the body.

## Dependencies

- **Shared primitives:** none.
- **CSS variables:** `--w-card`, `--w-ink`, `--w-r`, `--w-shadow`.
- **Keyframes:** `w-shake` (only when `shaking`).
- **localStorage:** none.
- **Globals / window:** reads `React`; writes itself to `window.ReceiptCard`.

## Reuse notes

The zig-zag receipt edge is a core brand signature and worth preserving verbatim as a reference. For production: (1) the gradient zig-zag is fragile and hard to maintain inline — consider an SVG border or a documented utility class; (2) move styles into the token/`data-slot` layer; (3) replace `window.*` with a module export; (4) `shaking` + `mo` couple animation policy into props — production should drive shake via a CSS class and respect `prefers-reduced-motion`. No state, no timing mocks (the shake is CSS-driven).

## Source snippet

```jsx
function ReceiptCard({ children, style, shaking, mo = 1 }) {
  return (
    <div style={{ filter: "drop-shadow(var(--w-shadow))", ...style }}>
      <div
        style={{
          background: "var(--w-card)",
          border: "2px solid var(--w-ink)",
          borderBottom: "none",
          borderRadius: "var(--w-r) var(--w-r) 0 0",
          padding: "20px 20px 14px",
          animation: shaking
            ? `w-shake ${300 * mo}ms cubic-bezier(0.36,0.07,0.19,0.97)`
            : "none",
        }}
      >
        {children}
      </div>
      <div
        style={{
          height: 12,
          marginTop: -1,
          background:
            "linear-gradient(-45deg, transparent 8.5px, var(--w-ink) 8.5px, var(--w-ink) 11px, var(--w-card) 11px) 0 0 / 17px 100%, " +
            "linear-gradient(45deg, transparent 8.5px, var(--w-ink) 8.5px, var(--w-ink) 11px, var(--w-card) 11px) 0 0 / 17px 100%",
        }}
      ></div>
    </div>
  )
}
```

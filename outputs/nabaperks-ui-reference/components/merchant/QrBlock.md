# QrBlock

- **Surface:** merchant (owned + exported here; reused cross-module by the customer scan view)
- **Source module:** [extracted-source/20-merchant-core.jsx](../../extracted-source/20-merchant-core.jsx) (lines 50–74)
- **Export:** `window.QrBlock` (global)
- **Reuse verdict:** 🔒 Prototype-only (deterministic _fake_ QR — renders no real payload)

## Visual purpose

The rendered venue QR placeholder for the "Wet Ink" system: a hard-bordered, rounded card holding a small SVG "QR code". The matrix is a deterministic pseudo-random fill (same pattern every render) with three corner _finder_ squares drawn in ink, so it reads as a recognisable QR without encoding anything. Used in onboarding (step 3, "Print your QR"), on the Today tab ("Your till QR"), and reused by the customer scan view in another module.

## Props / state

| Prop   | Type          | Default | Notes                                                                   |
| ------ | ------------- | ------- | ----------------------------------------------------------------------- |
| `size` | `number` (px) | `148`   | Sets the SVG `width`/`height`. Inner `viewBox` is fixed at `0 0 13 13`. |

**State:** none. The cell list is recomputed inline on every render from a fixed sine-hash, so output is stable.

## UX behaviour

- Pure presentational; no handlers, no animation.
- Cell generation: a 13×13 grid where each cell is filled when `frac(sin(x*13.7 + y*7.3) * 43758.5453) > 0.52` — a classic shader-style hash, **not** an encoder.
- Cells overlapping the three finder regions (top-left, top-right, bottom-left 4×4 corners) are filtered out, then `finder(0,0)`, `finder(10,0)`, `finder(0,10)` draw the framed corner eyes.

## Dependencies

- **Shared primitives:** none.
- **CSS variables:** `--w-card`, `--w-ink`, `--w-r`.
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** writes itself to `window.QrBlock` (via the module's `Object.assign(window, …)`); reused by the customer scan view in `21-merchant-ops` / customer modules. Cross-module shared primitive.

## Reuse notes

Prototype-only as drawn — it renders a _fake_ matrix with no payload, so it can never be scanned. The card chrome (border, radius, padding, ink finders) is a faithful Wet Ink reference and worth keeping. For production, replace the sine-hash matrix with a real QR generator that encodes the venue's permanent `/q/[qrId]` URL, keep the visual frame, and remove the `window.*` export in favour of a module import. Note the magic constants (`13` grid, `0.52` threshold, finder offsets `0/10`) are presentational only.

## Source snippet

```jsx
function QrBlock({ size = 148 }) {
  // deterministic fake QR — same pattern every render
  const cells = []
  for (let y = 0; y < 13; y++)
    for (let x = 0; x < 13; x++) {
      const v = Math.sin(x * 13.7 + y * 7.3) * 43758.5453
      if (v - Math.floor(v) > 0.52) cells.push([x, y])
    }
  const finder = (cx, cy) => (
    <g key={cx + "-" + cy}>
      <rect
        x={cx}
        y={cy}
        width={3}
        height={3}
        fill="none"
        stroke="var(--w-ink)"
        strokeWidth={0.55}
      />
      <rect x={cx + 1} y={cy + 1} width={1} height={1} fill="var(--w-ink)" />
    </g>
  )
  return (
    <div
      style={{
        background: "var(--w-card)",
        border: "2px solid var(--w-ink)",
        borderRadius: "var(--w-r)",
        padding: 12,
        display: "inline-block",
      }}
    >
      <svg width={size} height={size} viewBox="0 0 13 13">
        {cells
          .filter(
            ([x, y]) =>
              !((x < 4 && y < 4) || (x > 8 && y < 4) || (x < 4 && y > 8))
          )
          .map(([x, y], i) => (
            <rect
              key={i}
              x={x}
              y={y}
              width={1}
              height={1}
              fill="var(--w-ink)"
            />
          ))}
        {finder(0, 0)}
        {finder(10, 0)}
        {finder(0, 10)}
      </svg>
    </div>
  )
}
```

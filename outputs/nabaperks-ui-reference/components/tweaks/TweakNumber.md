# TweakNumber

- **Surface:** tweaks (omelette-starter scaffold — form-control helper, NOT a Wet-Ink surface)
- **Source module:** [extracted-source/00-tweaks-panel.jsx](../../extracted-source/00-tweaks-panel.jsx) (lines 427–459; style classes `.twk-num`, `.twk-num-lbl`, `.twk-num input`, `.twk-num-unit` lines 129–138)
- **Export:** `window.TweakNumber` (global; `Object.assign(window, …)` lines 537–541)
- **Reuse verdict:** 🔒 Prototype-only (raw hex/px scaffold styling, drag-scrub via JS pointer handlers, global export — tooling layer by design)

## Visual purpose

A compact numeric stepper with a **drag-to-scrub label** (Blender/Figma-style): drag the label left/right to nudge the value, or type directly into the field. The precise-number control of the panel. A single 26px pill (`.twk-num`) holding a scrub label (`cursor:ew-resize`), a right-aligned tabular-nums `<input type="number">` with spinners hidden, and an optional unit suffix. **Raw hex/px by design** (`@ds-adherence-ignore`).

## Props / state

| Prop       | Type                  | Default | Notes                                                               |
| ---------- | --------------------- | ------- | ------------------------------------------------------------------- |
| `label`    | `string`              | —       | Rendered as the drag-scrub handle (`.twk-num-lbl`).                 |
| `value`    | `number`              | —       | Bound to `<input type="number">`.                                   |
| `min`      | `number`              | —       | Optional lower clamp (`null`/absent ⇒ no lower bound).              |
| `max`      | `number`              | —       | Optional upper clamp (`null`/absent ⇒ no upper bound).              |
| `step`     | `number`              | `1`     | Scrub increment per px and input step; also sets decimal precision. |
| `unit`     | `string`              | `''`    | Optional suffix span; rendered only when truthy.                    |
| `onChange` | `(n: number) => void` | —       | Emits a clamped **number**.                                         |

**State / refs:**

- `const startRef = React.useRef({ x: 0, val: 0 })` — captures the pointer X and value at scrub start.
- A local `clamp(n)` applies `min`/`max` when provided.

## UX behaviour

- **Drag-scrub:** `onPointerDown` on the label captures `{ x: e.clientX, val: value }`, computes `decimals` from `step` (`(String(step).split('.')[1] || '').length`), then tracks `pointermove`/`pointerup` on `window`. Each move: `raw = startVal + dx * step`, snapped to the step grid (`Math.round(raw/step)*step`), fixed to `decimals`, clamped, and emitted. `e.preventDefault()` on start suppresses text selection.
- **Type-in:** the `<input type="number">` `onChange` emits `clamp(Number(e.target.value))`, so typed values are also coerced and clamped.
- **Chrome:** native spin buttons are hidden (`-webkit-appearance:none`, `-moz-appearance:textfield`); the value is right-aligned with `font-variant-numeric:tabular-nums`; the label cursor is `ew-resize` to signal scrubbability.

## Dependencies

- **Shared primitives:** none — renders its own `.twk-num` row directly (does **not** use `TweakRow`).
- **CSS variables:** none — **raw hex/px by design**. Recorded representative values: `.twk-num{height:26px; border:.5px solid rgba(0,0,0,.1); border-radius:7px; background:rgba(255,255,255,.6)}`, `.twk-num-lbl{color:rgba(41,38,27,.6); cursor:ew-resize}`, `.twk-num input{text-align:right; font-variant-numeric:tabular-nums}`, `.twk-num-unit{color:rgba(41,38,27,.45)}`.
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** reads `React` (`useRef`); attaches/removes `pointermove`/`pointerup` on `window` during a scrub; writes itself to `window.TweakNumber`. Styling depends on `__TWEAKS_STYLE` (injected by `TweaksPanel`).

## Reuse notes

A nicely considered numeric control: step-aware decimal handling, clamp on both scrub and type-in, and a draggable-label scrub. The scrub is implemented with global `window` pointer listeners (a scaffold mechanic), and like `TweakToggle`/`TweakColor`'s native path it inlines its own row rather than using `TweakRow`. Raw hex/px is intentional (`@ds-adherence-ignore`). The decimal/step/clamp logic is the portable part worth referencing; the window-listener scrub is prototype-grade.

## Source snippet

```jsx
function TweakNumber({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
}) {
  const clamp = (n) => {
    if (min != null && n < min) return min
    if (max != null && n > max) return max
    return n
  }
  const startRef = React.useRef({ x: 0, val: 0 })
  const onScrubStart = (e) => {
    e.preventDefault()
    startRef.current = { x: e.clientX, val: value }
    const decimals = (String(step).split(".")[1] || "").length
    const move = (ev) => {
      const dx = ev.clientX - startRef.current.x
      const raw = startRef.current.val + dx * step
      const snapped = Math.round(raw / step) * step
      onChange(clamp(Number(snapped.toFixed(decimals))))
    }
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }
  return (
    <div className="twk-num">
      <span className="twk-num-lbl" onPointerDown={onScrubStart}>
        {label}
      </span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(e) => onChange(clamp(Number(e.target.value)))}
      />
      {unit && <span className="twk-num-unit">{unit}</span>}
    </div>
  )
}
```

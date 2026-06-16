# TweakRadio

- **Surface:** tweaks (omelette-starter scaffold — form-control helper, NOT a Wet-Ink surface)
- **Source module:** [extracted-source/00-tweaks-panel.jsx](../../extracted-source/00-tweaks-panel.jsx) (lines 332–402; style classes `.twk-seg`, `.twk-seg-thumb`, `.twk-seg button` lines 111–120)
- **Export:** `window.TweakRadio` (global; `Object.assign(window, …)` lines 537–541)
- **Reuse verdict:** 🔒 Prototype-only (raw hex/px scaffold styling, drag via JS pointer handlers, global export — tooling layer by design)

## Visual purpose

A segmented control for 2–3 short options (e.g. "compact / regular / comfy"), with a sliding white thumb behind the active segment. The segmented enum control of the panel — and the one with the most behaviour. Track `.twk-seg` is a padded rounded `rgba(0,0,0,.06)` strip; `.twk-seg-thumb` is the `rgba(255,255,255,.9)` highlight that slides via a `transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s` (suppressed while dragging). Per the USAGE comment it is "the segmented control for 2–3 short options (auto-falls-back to `TweakSelect` past ~16/~10 chars per label)". **Raw hex/px by design** (`@ds-adherence-ignore`).

## Props / state

| Prop       | Type                                                  | Default | Notes                                                                                   |
| ---------- | ----------------------------------------------------- | ------- | --------------------------------------------------------------------------------------- |
| `label`    | `string`                                              | —       | Passed to `TweakRow` (or to `TweakSelect` on fallback).                                 |
| `value`    | `any`                                                 | —       | Active option value (string/number/boolean). Compared by `===`.                         |
| `options`  | `Array<string \| number \| boolean \| {value,label}>` | —       | Each option is a primitive (used as both value and label) or an object `{value,label}`. |
| `onChange` | `(v) => void`                                         | —       | Emits the **original option value** (type-preserving — numbers/booleans survive).       |

**State / refs:**

- `const [dragging, setDragging] = React.useState(false)` — toggles the `dragging` class (which kills the thumb transition for 1:1 tracking).
- `const valueRef = React.useRef(value); valueRef.current = value;` — the active value is read inside pointer-move handlers; ref'd so a stale closure doesn't fire `onChange` on every move.
- `const trackRef = React.useRef(null)` — the segment track, measured to map pointer X → segment.

## UX behaviour

- **Fit heuristic / auto-fallback:** computes the longest option label length and compares against a per-count budget `{ 2: 16, 3: 10 }[options.length] ?? 0`. The source comment derives this from the ~248px track, ~12px per-button padding, and ~6.3px/char at 11.5px system-ui. If labels don't fit (or there are >3 options, since the budget defaults to `0`), it renders a `TweakSelect` instead. The fallback's `resolve(s)` maps the `<select>`'s string back to the original option value so the dropdown stays type-preserving.
- **Normalisation:** options are normalised to `{ value, label }`; `idx` is the active index (clamped to ≥0 so an unmatched value still renders sensibly).
- **Thumb positioning:** inline style `left: calc(2px + idx * (100% - 4px) / n)` and `width: calc((100% - 4px) / n)`.
- **Click + drag selection:** `onPointerDown` selects the segment under the cursor (`segAt`), then tracks `pointermove`/`pointerup` on `window`, firing `onChange` whenever the cursor crosses into a new segment (guarded by `valueRef` to avoid redundant calls). `segAt(clientX)` floors the cursor's fractional position across the inner track width into a segment index.
- **ARIA:** container is `role="radiogroup"`; each button is `role="radio"` with `aria-checked={o.value === value}`.

## Dependencies

- **Shared primitives:** `TweakRow` (wrapper for the segment path) and `TweakSelect` (the long-/many-option fallback).
- **CSS variables:** none — **raw hex/px by design**. Recorded representative values: `.twk-seg{padding:2px; background:rgba(0,0,0,.06)}`, `.twk-seg-thumb{background:rgba(255,255,255,.9); transition:left .15s cubic-bezier(.3,.7,.4,1),width .15s}`, `.twk-seg button{min-height:22px; cursor:default}`.
- **Keyframes:** none (CSS `transition` only; suppressed via `.twk-seg.dragging .twk-seg-thumb{transition:none}`).
- **localStorage:** none.
- **Globals / window:** reads `React` (`useState`, `useRef`); attaches/removes `pointermove`/`pointerup` on `window` during a drag; writes itself to `window.TweakRadio`. Styling depends on `__TWEAKS_STYLE` (injected by `TweaksPanel`).

## Reuse notes

The richest helper: type-preserving `onChange`, a documented label-fit heuristic with graceful `TweakSelect` fallback, and a stale-closure-safe drag implemented with window pointer listeners. Raw hex/px and the JS-driven thumb/drag are intentional scaffold mechanics (`@ds-adherence-ignore`) rather than a production pattern — a product control would lean on CSS and avoid global pointer listeners. The fit budget (`{2:16, 3:10}`) is tuned to the panel's exact 280px width, so it is not portable to a differently sized container without recomputation. Worth referencing for the fallback and type-preservation logic.

## Source snippet

```jsx
function TweakRadio({ label, value, options, onChange }) {
  const trackRef = React.useRef(null)
  const [dragging, setDragging] = React.useState(false)
  const valueRef = React.useRef(value)
  valueRef.current = value

  const labelLen = (o) => String(typeof o === "object" ? o.label : o).length
  const maxLen = options.reduce((m, o) => Math.max(m, labelLen(o)), 0)
  const fitsAsSegments = maxLen <= ({ 2: 16, 3: 10 }[options.length] ?? 0)
  if (!fitsAsSegments) {
    const resolve = (s) => {
      const m = options.find(
        (o) => String(typeof o === "object" ? o.value : o) === s
      )
      return m === undefined ? s : typeof m === "object" ? m.value : m
    }
    return (
      <TweakSelect
        label={label}
        value={value}
        options={options}
        onChange={(s) => onChange(resolve(s))}
      />
    )
  }
  const opts = options.map((o) =>
    typeof o === "object" ? o : { value: o, label: o }
  )
  const idx = Math.max(
    0,
    opts.findIndex((o) => o.value === value)
  )
  const n = opts.length

  const segAt = (clientX) => {
    const r = trackRef.current.getBoundingClientRect()
    const inner = r.width - 4
    const i = Math.floor(((clientX - r.left - 2) / inner) * n)
    return opts[Math.max(0, Math.min(n - 1, i))].value
  }

  const onPointerDown = (e) => {
    setDragging(true)
    const v0 = segAt(e.clientX)
    if (v0 !== valueRef.current) onChange(v0)
    const move = (ev) => {
      if (!trackRef.current) return
      const v = segAt(ev.clientX)
      if (v !== valueRef.current) onChange(v)
    }
    const up = () => {
      setDragging(false)
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  return (
    <TweakRow label={label}>
      <div
        ref={trackRef}
        role="radiogroup"
        onPointerDown={onPointerDown}
        className={dragging ? "twk-seg dragging" : "twk-seg"}
      >
        <div
          className="twk-seg-thumb"
          style={{
            left: `calc(2px + ${idx} * (100% - 4px) / ${n})`,
            width: `calc((100% - 4px) / ${n})`,
          }}
        />
        {opts.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={o.value === value}
          >
            {o.label}
          </button>
        ))}
      </div>
    </TweakRow>
  )
}
```

# TweakSlider

- **Surface:** tweaks (omelette-starter scaffold — form-control helper, NOT a Wet-Ink surface)
- **Source module:** [extracted-source/00-tweaks-panel.jsx](../../extracted-source/00-tweaks-panel.jsx) (lines 312–319; style class `.twk-slider` + thumb pseudo-elements lines 103–109)
- **Export:** `window.TweakSlider` (global; `Object.assign(window, …)` lines 537–541)
- **Reuse verdict:** 🔒 Prototype-only (raw hex/px scaffold styling, global export — tooling layer by design)

## Visual purpose

A horizontal range control for numeric tweaks, with the current value shown in the row's value readout (e.g. `16px`). The numeric control of the panel. A thin 4px track (`rgba(0,0,0,.12)`, fully rounded) with a 14px white circular thumb (`.twk-slider::-webkit-slider-thumb` / `::-moz-range-thumb`, soft drop shadow). **Raw hex/px by design** (`@ds-adherence-ignore`).

## Props / state

| Prop       | Type                  | Default | Notes                                                                           |
| ---------- | --------------------- | ------- | ------------------------------------------------------------------------------- |
| `label`    | `string`              | —       | Passed through to `TweakRow`.                                                   |
| `value`    | `number`              | —       | Current value; also bound to the native `<input type="range">`.                 |
| `min`      | `number`              | `0`     | Range minimum.                                                                  |
| `max`      | `number`              | `100`   | Range maximum.                                                                  |
| `step`     | `number`              | `1`     | Range step.                                                                     |
| `unit`     | `string`              | `''`    | Appended to the readout: `value` prop on `TweakRow` is `` `${value}${unit}` ``. |
| `onChange` | `(v: number) => void` | —       | Called with `Number(e.target.value)` — emits a **number**, not the raw string.  |

**State:** none — fully controlled via `value`/`onChange`.

## UX behaviour

- Wraps a native `<input type="range" className="twk-slider">` inside a `TweakRow`, with the formatted `` `${value}${unit}` `` shown as the row readout.
- `onChange` coerces the input string to a number before calling the caller's handler, so consumers always receive `number`.
- Thumb cursor is `cursor:default` (per `.twk-slider::-webkit-slider-thumb`), consistent with the panel's non-`pointer` chrome styling.

## Dependencies

- **Shared primitives:** `TweakRow` (wrapper).
- **CSS variables:** none — **raw hex/px by design**. Recorded representative values: `.twk-slider{height:4px; background:rgba(0,0,0,.12); border-radius:999px}`, thumb `width:14px; height:14px; background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.2)`.
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** reads `React` (indirectly via `TweakRow`); writes itself to `window.TweakSlider`. Styling depends on `__TWEAKS_STYLE` (injected by `TweaksPanel`).

## Reuse notes

A clean controlled numeric slider; the `Number()` coercion on change is the one substantive behaviour and is correct. Raw hex/px is intentional scaffold styling (`@ds-adherence-ignore`). Portable as a pattern, but visually depends on the panel's injected stylesheet and is exported via the scaffold `window.*` convention.

## Source snippet

```jsx
function TweakSlider({
  label,
  value,
  min = 0,
  max = 100,
  step = 1,
  unit = "",
  onChange,
}) {
  return (
    <TweakRow label={label} value={`${value}${unit}`}>
      <input
        type="range"
        className="twk-slider"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
    </TweakRow>
  )
}
```

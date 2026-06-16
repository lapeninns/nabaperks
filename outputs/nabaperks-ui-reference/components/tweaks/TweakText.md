# TweakText

- **Surface:** tweaks (omelette-starter scaffold — form-control helper, NOT a Wet-Ink surface)
- **Source module:** [extracted-source/00-tweaks-panel.jsx](../../extracted-source/00-tweaks-panel.jsx) (lines 418–425; style class `.twk-field` lines 95–98)
- **Export:** `window.TweakText` (global; `Object.assign(window, …)` lines 537–541)
- **Reuse verdict:** 🔒 Prototype-only (raw hex/px scaffold styling, global export — tooling layer by design)

## Visual purpose

A single-line free-text input for string tweaks (labels, copy, URLs, etc.). The free-text control of the panel. Shares the `.twk-field` chrome with `TweakSelect`/`TweakNumber` — a 26px-tall translucent-white box with a 7px radius and a focus state that firms the border and lightens the background. **Raw hex/px by design** (`@ds-adherence-ignore`).

## Props / state

| Prop          | Type                  | Default | Notes                                         |
| ------------- | --------------------- | ------- | --------------------------------------------- |
| `label`       | `string`              | —       | Passed to `TweakRow`.                         |
| `value`       | `string`              | —       | Bound to `<input type="text" value>`.         |
| `placeholder` | `string`              | —       | Native input placeholder.                     |
| `onChange`    | `(s: string) => void` | —       | Emits `e.target.value` (string, no coercion). |

**State:** none — fully controlled via `value`/`onChange`.

## UX behaviour

- Renders a native `<input type="text" className="twk-field">` inside a `TweakRow`.
- `onChange` passes the raw string straight through; no trimming or validation.
- Inherits `.twk-field:focus` styling (border firms to `rgba(0,0,0,.25)`, background lightens to `rgba(255,255,255,.85)`).

## Dependencies

- **Shared primitives:** `TweakRow` (wrapper).
- **CSS variables:** none — **raw hex/px by design**. Recorded representative values: `.twk-field{height:26px; padding:0 8px; border:.5px solid rgba(0,0,0,.1); border-radius:7px; background:rgba(255,255,255,.6)}`.
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** reads `React` (indirectly via `TweakRow`); writes itself to `window.TweakText`. Styling depends on `__TWEAKS_STYLE` (injected by `TweaksPanel`).

## Reuse notes

The simplest control — a thin controlled text input. Nothing product-specific; raw hex/px is intentional scaffold styling (`@ds-adherence-ignore`). Portable as a pattern, but depends on the panel stylesheet and uses the scaffold `window.*` export.

## Source snippet

```jsx
function TweakText({ label, value, placeholder, onChange }) {
  return (
    <TweakRow label={label}>
      <input
        className="twk-field"
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </TweakRow>
  )
}
```

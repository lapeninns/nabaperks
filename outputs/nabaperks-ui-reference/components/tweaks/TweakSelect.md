# TweakSelect

- **Surface:** tweaks (omelette-starter scaffold — form-control helper, NOT a Wet-Ink surface)
- **Source module:** [extracted-source/00-tweaks-panel.jsx](../../extracted-source/00-tweaks-panel.jsx) (lines 404–416; style class `.twk-field` + `select.twk-field` lines 95–101)
- **Export:** `window.TweakSelect` (global; `Object.assign(window, …)` lines 537–541)
- **Reuse verdict:** 🔒 Prototype-only (raw hex/px scaffold styling, global export — tooling layer by design)

## Visual purpose

A native dropdown for enum tweaks with many or long options — the fallback `TweakRadio` defers to, and a control to reach for directly per the USAGE note ("reach for `TweakSelect` directly when options are many or long"). The list-enum control of the panel. Styled `.twk-field` (26px tall, translucent white, 7px radius) with a custom inline-SVG caret via `select.twk-field{background-image:url("data:image/svg+xml;utf8,<svg…>…")}`. **Raw hex/px by design** (`@ds-adherence-ignore`).

## Props / state

| Prop       | Type                                       | Default | Notes                                                                                 |
| ---------- | ------------------------------------------ | ------- | ------------------------------------------------------------------------------------- |
| `label`    | `string`                                   | —       | Passed to `TweakRow`.                                                                 |
| `value`    | `any`                                      | —       | Bound to the native `<select value>`.                                                 |
| `options`  | `Array<string \| number \| {value,label}>` | —       | Primitive options use the value as the label; object options provide `{value,label}`. |
| `onChange` | `(s: string) => void`                      | —       | Emits `e.target.value` — a **string** (native `<select>` always yields strings).      |

**State:** none — fully controlled via `value`/`onChange`.

## UX behaviour

- Renders a native `<select className="twk-field">` inside a `TweakRow`.
- Each option is mapped to `{ value, label }`: `const v = typeof o === 'object' ? o.value : o; const l = typeof o === 'object' ? o.label : o;`.
- `onChange` passes the raw string `e.target.value`. (When used as `TweakRadio`'s fallback, `TweakRadio` supplies a `resolve` wrapper that maps that string back to the original typed value — `TweakSelect` itself does not type-coerce.)

## Dependencies

- **Shared primitives:** `TweakRow` (wrapper).
- **CSS variables:** none — **raw hex/px by design**. Recorded representative values: `.twk-field{height:26px; padding:0 8px; border-radius:7px; background:rgba(255,255,255,.6)}`, `:focus{border-color:rgba(0,0,0,.25); background:rgba(255,255,255,.85)}`, plus the inline data-URI caret SVG with `padding-right:22px`.
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** reads `React` (indirectly via `TweakRow`); writes itself to `window.TweakSelect`. Styling depends on `__TWEAKS_STYLE` (injected by `TweaksPanel`).

## Reuse notes

A straightforward controlled native select with a custom caret. Note it emits **strings only** — type preservation for numeric/boolean enums is the caller's job (as `TweakRadio` does via `resolve`). Raw hex/px and the inline data-URI caret are intentional scaffold styling (`@ds-adherence-ignore`). Portable as a pattern, but depends on the panel stylesheet and uses the scaffold `window.*` export.

## Source snippet

```jsx
function TweakSelect({ label, value, options, onChange }) {
  return (
    <TweakRow label={label}>
      <select
        className="twk-field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {options.map((o) => {
          const v = typeof o === "object" ? o.value : o
          const l = typeof o === "object" ? o.label : o
          return (
            <option key={v} value={v}>
              {l}
            </option>
          )
        })}
      </select>
    </TweakRow>
  )
}
```

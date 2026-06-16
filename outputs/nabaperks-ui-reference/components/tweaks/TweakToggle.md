# TweakToggle

- **Surface:** tweaks (omelette-starter scaffold — form-control helper, NOT a Wet-Ink surface)
- **Source module:** [extracted-source/00-tweaks-panel.jsx](../../extracted-source/00-tweaks-panel.jsx) (lines 321–330; style class `.twk-toggle` lines 122–127)
- **Export:** `window.TweakToggle` (global; `Object.assign(window, …)` lines 537–541)
- **Reuse verdict:** 🔒 Prototype-only (raw hex/px scaffold styling, global export — tooling layer by design)

## Visual purpose

An iOS-style on/off switch for boolean tweaks (e.g. "Dark mode"), laid out inline with its label. The boolean control of the panel. A 32×18px pill that turns green (`#34c759`) when on, with a 14px white knob that slides 14px right via `transform:translateX(14px)`. **Raw hex/px by design** (`@ds-adherence-ignore`).

## Props / state

| Prop       | Type                   | Default | Notes                                                        |
| ---------- | ---------------------- | ------- | ------------------------------------------------------------ |
| `label`    | `string`               | —       | Left-hand label.                                             |
| `value`    | `boolean` (truthy)     | —       | Drives both the visual state (`data-on`) and `aria-checked`. |
| `onChange` | `(v: boolean) => void` | —       | Called with `!value` on click (toggles).                     |

**State:** none — fully controlled via `value`/`onChange`.

## UX behaviour

- Renders its own inline row (`'twk-row twk-row-h'`) directly — note it does **not** wrap `TweakRow`; it inlines the same `.twk-lbl` structure (label only, no value readout).
- The switch is a `<button type="button" role="switch">` with `aria-checked={!!value}` and `data-on={value ? '1' : '0'}`; CSS keys the green track and knob translate off `data-on="1"`.
- Click handler is `() => onChange(!value)` — a pure toggle of the current boolean.
- Knob cursor is `cursor:default` per `.twk-toggle`.

## Dependencies

- **Shared primitives:** none — does **not** use `TweakRow` (inlines its own `.twk-row twk-row-h` + `.twk-lbl`).
- **CSS variables:** none — **raw hex/px by design**. Recorded representative values: `.twk-toggle{width:32px; height:18px; background:rgba(0,0,0,.15)}`, on-state `.twk-toggle[data-on="1"]{background:#34c759}`, knob `.twk-toggle i{width:14px; height:14px; background:#fff}`, on-knob `transform:translateX(14px)`.
- **Keyframes:** none (CSS `transition` only).
- **localStorage:** none.
- **Globals / window:** reads `React`; writes itself to `window.TweakToggle`. Styling depends on `__TWEAKS_STYLE` (injected by `TweaksPanel`).

## Reuse notes

A correct controlled boolean switch with sensible ARIA (`role="switch"` + `aria-checked`). Raw hex/px and the green `#34c759` are intentional scaffold styling (`@ds-adherence-ignore`). Note the deliberate departure from the shared chassis — it does not reuse `TweakRow` because it never shows a value readout. Portable as a pattern; export is the scaffold `window.*` convention and styling depends on the panel stylesheet.

## Source snippet

```jsx
function TweakToggle({ label, value, onChange }) {
  return (
    <div className="twk-row twk-row-h">
      <div className="twk-lbl">
        <span>{label}</span>
      </div>
      <button
        type="button"
        className="twk-toggle"
        data-on={value ? "1" : "0"}
        role="switch"
        aria-checked={!!value}
        onClick={() => onChange(!value)}
      >
        <i />
      </button>
    </div>
  )
}
```

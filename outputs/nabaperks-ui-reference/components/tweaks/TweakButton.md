# TweakButton

- **Surface:** tweaks (omelette-starter scaffold — form-control helper, NOT a Wet-Ink surface)
- **Source module:** [extracted-source/00-tweaks-panel.jsx](../../extracted-source/00-tweaks-panel.jsx) (lines 530–535; style class `.twk-btn` + `.twk-btn.secondary` lines 140–144)
- **Export:** `window.TweakButton` (global; `Object.assign(window, …)` lines 537–541)
- **Reuse verdict:** 🔒 Prototype-only (raw hex/px scaffold styling, global export — tooling layer by design)

## Visual purpose

A small action button for the panel (e.g. "Reset", "Randomise") — a 26px-tall pill in one of two weights. The action control of the panel. Primary `.twk-btn` is near-black (`rgba(0,0,0,.78)`) with white text; `.twk-btn.secondary` is a faint `rgba(0,0,0,.06)` fill with inherited text. **Raw hex/px by design** (`@ds-adherence-ignore`). This is the scaffold's own utility button — distinct from the Wet-Ink `InkButton` primitive.

## Props / state

| Prop        | Type         | Default | Notes                                                                |
| ----------- | ------------ | ------- | -------------------------------------------------------------------- |
| `label`     | `string`     | —       | Button text.                                                         |
| `onClick`   | `() => void` | —       | Click handler (passed straight to the native `<button>`).            |
| `secondary` | `boolean`    | `false` | Selects the `.twk-btn secondary` variant when true, else `.twk-btn`. |

**State:** none — stateless presentational button.

## UX behaviour

- Renders a native `<button type="button">` with class `'twk-btn secondary'` or `'twk-btn'`.
- No press-state animation or disabled handling (unlike the Wet-Ink `InkButton`); hover darkens the fill via CSS only (`.twk-btn:hover`, `.twk-btn.secondary:hover`).
- Cursor is `cursor:default` (consistent with the panel's non-`pointer` chrome).

## Dependencies

- **Shared primitives:** none.
- **CSS variables:** none — **raw hex/px by design**. Recorded representative values: `.twk-btn{height:26px; padding:0 12px; border-radius:7px; background:rgba(0,0,0,.78); color:#fff}`, hover `background:rgba(0,0,0,.88)`, `.twk-btn.secondary{background:rgba(0,0,0,.06); color:inherit}`.
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** reads `React`; writes itself to `window.TweakButton`. Styling depends on `__TWEAKS_STYLE` (injected by `TweaksPanel`).

## Reuse notes

A minimal two-variant action button for the control panel. Deliberately simpler than the Wet-Ink `InkButton` (no press transform, no `disabled`, no token palette) because it is tooling chrome, not product UI — raw hex/px is correct here (`@ds-adherence-ignore`). Portable as a pattern but depends on the panel stylesheet and uses the scaffold `window.*` export.

## Source snippet

```jsx
function TweakButton({ label, onClick, secondary = false }) {
  return (
    <button
      type="button"
      className={secondary ? "twk-btn secondary" : "twk-btn"}
      onClick={onClick}
    >
      {label}
    </button>
  )
}
```

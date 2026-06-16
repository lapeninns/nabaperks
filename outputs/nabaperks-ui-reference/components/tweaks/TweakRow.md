# TweakRow

- **Surface:** tweaks (omelette-starter scaffold — layout helper, NOT a Wet-Ink surface)
- **Source module:** [extracted-source/00-tweaks-panel.jsx](../../extracted-source/00-tweaks-panel.jsx) (lines 298–308; style classes `.twk-row`, `.twk-row-h`, `.twk-lbl`, `.twk-val` lines 84–89)
- **Export:** `window.TweakRow` (global; `Object.assign(window, …)` lines 537–541)
- **Reuse verdict:** 🔒 Prototype-only (raw hex/px scaffold styling, global export — tooling layer by design)

## Visual purpose

The standard control row inside the panel: a label (with an optional right-aligned value readout) above or beside its control. The shared wrapper that gives every control consistent label/value layout and spacing. Two layouts: stacked (`.twk-row` — column, label over control) and inline (`.twk-row twk-row-h` — row, label and control side-by-side, space-between). The label block `.twk-lbl` is a baseline-aligned space-between flex; the optional value `.twk-val` renders in `rgba(41,38,27,.5)` with `font-variant-numeric:tabular-nums`. **Raw hex/px by design** (`@ds-adherence-ignore`).

## Props / state

| Prop       | Type        | Default | Notes                                                                                                                                                                                                                               |
| ---------- | ----------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`    | `string`    | —       | Left-hand label text.                                                                                                                                                                                                               |
| `value`    | `any`       | —       | Optional right-hand readout. Rendered only when `value != null` (so `0`/empty-string would still render; `null`/`undefined` omit the span). Callers pass pre-formatted strings (e.g. `TweakSlider` passes `` `${value}${unit}` ``). |
| `children` | `ReactNode` | —       | The control element placed beneath/beside the label.                                                                                                                                                                                |
| `inline`   | `boolean`   | `false` | When true, applies `twk-row-h` for the side-by-side (horizontal) layout.                                                                                                                                                            |

**State:** none — pure presentational component.

## UX behaviour

- Chooses class `'twk-row twk-row-h'` when `inline`, else `'twk-row'`.
- Renders `.twk-lbl` containing the `label` span and, conditionally, the `.twk-val` readout, then `children`.
- No interaction of its own; it is the layout chassis reused by `TweakSlider`, `TweakRadio`, `TweakSelect`, `TweakText`, and the curated-options `TweakColor`.

## Dependencies

- **Shared primitives:** none (but is the wrapper consumed by most control helpers).
- **CSS variables:** none — **raw hex/px by design**. Recorded representative values: `.twk-row{gap:5px}`, `.twk-row-h{flex-direction:row; justify-content:space-between; gap:10px}`, `.twk-lbl{color:rgba(41,38,27,.72)}`, `.twk-val{color:rgba(41,38,27,.5); font-variant-numeric:tabular-nums}`.
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** reads `React`; writes itself to `window.TweakRow`. (Styling depends on `__TWEAKS_STYLE` injected by `TweaksPanel`.)

## Reuse notes

The shared row chassis for the scaffold's controls; raw hex/px is intentional here (`@ds-adherence-ignore`). The `value != null` guard is a small but deliberate correctness choice (lets `0` and `''` render while omitting absent readouts). Trivial and portable as a layout primitive, but only styled inside a `TweaksPanel`; export is the scaffold `window.*` pattern.

## Source snippet

```jsx
function TweakRow({ label, value, children, inline = false }) {
  return (
    <div className={inline ? "twk-row twk-row-h" : "twk-row"}>
      <div className="twk-lbl">
        <span>{label}</span>
        {value != null && <span className="twk-val">{value}</span>}
      </div>
      {children}
    </div>
  )
}
```

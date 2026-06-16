# TweakSection

- **Surface:** tweaks (omelette-starter scaffold — layout helper, NOT a Wet-Ink surface)
- **Source module:** [extracted-source/00-tweaks-panel.jsx](../../extracted-source/00-tweaks-panel.jsx) (lines 289–296; style class `.twk-sect` lines 91–93)
- **Export:** `window.TweakSection` (global; `Object.assign(window, …)` lines 537–541)
- **Reuse verdict:** 🔒 Prototype-only (raw hex/px scaffold styling, global export — tooling layer by design)

## Visual purpose

A group heading inside the `TweaksPanel` body — a small uppercase, letter-spaced caption that separates runs of controls (e.g. "Typography", "Theme"). Styled via `.twk-sect`: `font-size:10px; font-weight:600; letter-spacing:.06em; text-transform:uppercase; color:rgba(41,38,27,.45); padding:10px 0 0` (with `:first-child` dropping the top padding). Per the module banner `@ds-adherence-ignore`, these are **raw hex/px by design**, not `--w-*` tokens.

## Props / state

| Prop       | Type        | Default | Notes                                                                                                                                                                                     |
| ---------- | ----------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `label`    | `string`    | —       | The heading text, rendered in `<div className="twk-sect">`.                                                                                                                               |
| `children` | `ReactNode` | —       | Optional — rendered immediately after the heading. In the USAGE example `TweakSection` is self-closing (`<TweakSection label="Typography" />`) with controls placed as siblings after it. |

**State:** none — pure presentational component.

## UX behaviour

- Renders a fragment: the `.twk-sect` heading then any `children`.
- No interaction; purely a visual divider. The `.twk-sect:first-child{padding-top:0}` rule removes the leading gap when a section is the first element in the panel body.

## Dependencies

- **Shared primitives:** none.
- **CSS variables:** none — **raw hex/px by design**. Recorded representative values (not to be converted to `--w-*`): `.twk-sect{font-size:10px; letter-spacing:.06em; color:rgba(41,38,27,.45); padding:10px 0 0}`.
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** reads `React`; writes itself to `window.TweakSection`. (Relies on `__TWEAKS_STYLE`, injected once by `TweaksPanel`, for its `.twk-sect` class.)

## Reuse notes

Pure layout chrome for the scaffold panel; correctly uses raw hex/px (`@ds-adherence-ignore`), so no token migration applies. The component itself is trivial and portable, but its styling only exists when rendered inside a `TweaksPanel` (which injects `__TWEAKS_STYLE`). Global `window.*` export is a scaffold-ism rather than a module export.

## Source snippet

```jsx
function TweakSection({ label, children }) {
  return (
    <>
      <div className="twk-sect">{label}</div>
      {children}
    </>
  )
}
```

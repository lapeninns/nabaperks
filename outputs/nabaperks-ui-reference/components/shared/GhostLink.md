# GhostLink

- **Surface:** shared (primitive)
- **Source module:** [extracted-source/10-primitives.jsx](../../extracted-source/10-primitives.jsx) (lines 43–52)
- **Export:** `window.GhostLink` (global)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles, global export, no semantic link/role)

## Visual purpose

A low-emphasis text action rendered as an underlined, borderless button in the display typeface. Used for secondary/tertiary actions (e.g. "back", "not now") where the heavy `InkButton` block would be too loud. Keeps the Wet Ink display font and ink colour but drops the hard border and offset shadow.

## Props / state

| Prop       | Type            | Default | Notes                                          |
| ---------- | --------------- | ------- | ---------------------------------------------- |
| `onClick`  | `() => void`    | —       | Click handler. No disabled handling in source. |
| `children` | `ReactNode`     | —       | Label.                                         |
| `style`    | `CSSProperties` | —       | Spread last, so callers can override anything. |

**State:** none (stateless function component).

## UX behaviour

- Plain `<button>` with `background: none`, `border: none`, `cursor: pointer`.
- `fontFamily: var(--w-display)`, `fontWeight: 700`, `fontSize: 15`, `color: var(--w-ink)`.
- `textDecoration: underline` with `textUnderlineOffset: 4` for the inky-link look.
- `padding: 8` and `minHeight: 44` keep it at the 44px tap target.
- No press animation, no `disabled` prop, no hover styling in source.

## Dependencies

- **Shared primitives:** none.
- **CSS variables:** `--w-display`, `--w-ink`.
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** reads `React`; writes itself to `window.GhostLink`.

## Reuse notes

A clean, simple secondary-action treatment worth keeping. For production: (1) move inline styles to the token/`data-slot` layer; (2) add a `disabled` state for parity with `InkButton`; (3) consider rendering as a real `<a>` (or adding `type="button"`) depending on whether the action navigates; (4) replace the `window.*` export with a module export. No timing mocks or state.

## Source snippet

```jsx
function GhostLink({ onClick, children, style }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "none",
        border: "none",
        cursor: "pointer",
        fontFamily: "var(--w-display)",
        fontWeight: 700,
        fontSize: 15,
        color: "var(--w-ink)",
        textDecoration: "underline",
        textUnderlineOffset: 4,
        padding: 8,
        minHeight: 44,
        ...style,
      }}
    >
      {children}
    </button>
  )
}
```

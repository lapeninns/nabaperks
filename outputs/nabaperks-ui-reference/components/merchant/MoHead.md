# MoHead

- **Surface:** merchant (local sub-primitive)
- **Source module:** [extracted-source/21-merchant-ops.jsx](../../extracted-source/21-merchant-ops.jsx) (lines 9–19)
- **Export:** local to module (not on `window`)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles)

## Visual purpose

The standard header block for every merchant ops screen. A large display title, an optional mono-uppercase subtitle beneath it, and an optional right-hand slot (a `DemoTag`, a count + toggle, a `MonoTag` status, etc.). Flex row that wraps and bottom-aligns the two sides.

## Props / state

| Prop    | Type                | Default | Notes                                             |
| ------- | ------------------- | ------- | ------------------------------------------------- |
| `title` | `string` (rendered) | —       | The `<h2>` text. `fontSize: 29, fontWeight: 800`. |
| `sub`   | `ReactNode`         | —       | Rendered inside `MonoLine` only when truthy.      |
| `right` | `ReactNode`         | —       | Right-hand slot, placed after the title block.    |

**State:** none (pure render).

## UX behaviour

- `display: flex` with `justifyContent: "space-between"`, `alignItems: "flex-end"`, `gap: 16`, `flexWrap: "wrap"` and `marginBottom: 20`.
- The `sub` line only renders when provided (`{sub && <MonoLine …>}`).

## Dependencies

- **Shared primitives:** `MonoLine` (window global).
- **CSS variables:** none directly (inherits; `MonoLine` supplies its own).
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** reads `React` indirectly (JSX); reads `window.MonoLine`. Not exported.

## Reuse notes

A clean, portable page-header pattern. For production: move the inline layout into the `data-slot` / token layer and let the consuming screen pass typography via CSS rather than hardcoded `fontSize`/`fontWeight`. The `right` slot is a good API. No prototype-isms (no timers, globals, or mock data) inside this component itself.

## Source snippet

```jsx
function MoHead({ title, sub, right }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "flex-end",
        gap: 16,
        flexWrap: "wrap",
        marginBottom: 20,
      }}
    >
      <div>
        <h2
          style={{ fontSize: 29, fontWeight: 800, lineHeight: 1.05, margin: 0 }}
        >
          {title}
        </h2>
        {sub && <MonoLine style={{ marginTop: 7 }}>{sub}</MonoLine>}
      </div>
      {right}
    </div>
  )
}
```

# DemoTag

- **Surface:** shared (primitive)
- **Source module:** [extracted-source/10-primitives.jsx](../../extracted-source/10-primitives.jsx) (lines 81–90)
- **Export:** `window.DemoTag` (global)
- **Reuse verdict:** 🔒 Prototype-only (a demo/jump control with no production analogue)

## Visual purpose

A dashed-border mono chip used as a prototype navigation/jump affordance — a clickable "demo tag" prefixed with a `▸` play marker. The dashed border and small uppercase mono label visually mark it as a meta/demo control distinct from real product buttons.

## Props / state

| Prop       | Type         | Default | Notes                                                         |
| ---------- | ------------ | ------- | ------------------------------------------------------------- |
| `onClick`  | `() => void` | —       | Click handler (jumps to a demo state in the prototype shell). |
| `children` | `ReactNode`  | —       | Label; rendered after the literal `▸ ` prefix.                |

**State:** none (stateless function component).

## UX behaviour

- `<button>` with `background: transparent`, `border: 1.5px dashed var(--w-ink-soft)`, `borderRadius: 8`.
- Typography: `fontFamily: var(--w-mono)`, `fontSize: 10.5`, `fontWeight: 700`, `letterSpacing: 0.08em`, `textTransform: uppercase`, `color: var(--w-ink-soft)`.
- `padding: 6px 10px`, `minHeight: 32` (below the 44px tap target — acceptable as a non-primary demo control).
- Renders literal text `▸ {children}`. No press animation or disabled handling.

## Dependencies

- **Shared primitives:** none.
- **CSS variables:** `--w-ink-soft`, `--w-mono`.
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** reads `React`; writes itself to `window.DemoTag`.

## Reuse notes

Prototype-only: this is scaffolding for navigating the demo flow, not a product surface. The dashed-tag treatment could be reused as a generic "debug / demo" affordance, but there is no production equivalent and it should not ship in customer UI. The `▸` marker is a literal character in source. No state or timing mocks.

## Source snippet

```jsx
function DemoTag({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: "transparent",
        border: "1.5px dashed var(--w-ink-soft)",
        borderRadius: 8,
        fontFamily: "var(--w-mono)",
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--w-ink-soft)",
        cursor: "pointer",
        padding: "6px 10px",
        minHeight: 32,
      }}
    >
      ▸ {children}
    </button>
  )
}
```

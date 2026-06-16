# ReceiptRule

- **Surface:** shared (primitive)
- **Source module:** [extracted-source/10-primitives.jsx](../../extracted-source/10-primitives.jsx) (lines 136–138)
- **Export:** `window.ReceiptRule` (global)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles, global export)

## Visual purpose

A horizontal dashed divider — the "tear line" between sections inside a `ReceiptCard`. A single dashed top-border with vertical margin, matching the perforated receipt aesthetic.

## Props / state

| Prop    | Type            | Default | Notes                                                    |
| ------- | --------------- | ------- | -------------------------------------------------------- |
| `style` | `CSSProperties` | —       | Spread last; callers can override `margin`, colour, etc. |

**State:** none (stateless function component).

## UX behaviour

- Static `div`: `borderTop: 2px dashed var(--w-line)`, `margin: 14px 0`.
- No interactivity.

## Dependencies

- **Shared primitives:** none.
- **CSS variables:** `--w-line`.
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** reads `React`; writes itself to `window.ReceiptRule`.

## Reuse notes

Trivial divider, fully portable. For production: (1) could be replaced by a one-line utility class / `<hr>` with a `data-slot`; (2) replace `window.*` with a module export. No state or timing mocks.

## Source snippet

```jsx
function ReceiptRule({ style }) {
  return (
    <div
      style={{
        borderTop: "2px dashed var(--w-line)",
        margin: "14px 0",
        ...style,
      }}
    ></div>
  )
}
```

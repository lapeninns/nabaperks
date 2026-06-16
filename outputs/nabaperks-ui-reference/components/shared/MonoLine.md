# MonoLine

- **Surface:** shared (primitive)
- **Source module:** [extracted-source/10-primitives.jsx](../../extracted-source/10-primitives.jsx) (lines 72–79)
- **Export:** `window.MonoLine` (global)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles, global export)

## Visual purpose

A single line of small, uppercase, letter-spaced mono text in the soft-ink colour — used for captions, field labels, and receipt-style metadata. The plain `div` companion to `MonoTag` (no pill, no border). It is the workhorse label typeface throughout the prototype (used inside `ProgressLine`, `PinPad`, `Seal`, `GpsCheck`, etc.).

## Props / state

| Prop       | Type            | Default | Notes                                                                                    |
| ---------- | --------------- | ------- | ---------------------------------------------------------------------------------------- |
| `children` | `ReactNode`     | —       | Label content.                                                                           |
| `style`    | `CSSProperties` | —       | Spread last; callers frequently override `color`, `fontWeight`, `fontSize`, `marginTop`. |

**State:** none (stateless function component).

## UX behaviour

- Static `div`. Typography: `fontFamily: var(--w-mono)`, `fontSize: 11.5`, `letterSpacing: 0.06em`, `textTransform: uppercase`, `color: var(--w-ink-soft)`.
- No interactivity. Callers commonly upgrade it to a stronger emphasis by passing `style={{ color: "var(--w-ink)", fontWeight: 700 }}` (seen in `PinPad`, `GpsCheck`).

## Dependencies

- **Shared primitives:** none.
- **CSS variables:** `--w-mono`, `--w-ink-soft`.
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** reads `React`; writes itself to `window.MonoLine`.

## Reuse notes

The most reusable primitive in the set — a pure label component. For production: (1) move the inline style to a single utility class / `data-slot` token; (2) replace `window.*` with a module export. Otherwise faithful and portable as-is. No state or timing mocks.

## Source snippet

```jsx
function MonoLine({ children, style }) {
  return (
    <div
      style={{
        fontFamily: "var(--w-mono)",
        fontSize: 11.5,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        color: "var(--w-ink-soft)",
        ...style,
      }}
    >
      {children}
    </div>
  )
}
```

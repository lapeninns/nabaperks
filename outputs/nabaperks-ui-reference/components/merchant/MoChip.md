# MoChip

- **Surface:** merchant (local sub-primitive)
- **Source module:** [extracted-source/21-merchant-ops.jsx](../../extracted-source/21-merchant-ops.jsx) (lines 21–33)
- **Export:** local to module (not on `window`)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles, active state via JS props)

## Visual purpose

A pill-shaped filter chip in the mono typeface, uppercase. Inactive chips are a transparent capsule with a faint `--w-line` border and soft ink text; the active chip flips to a solid ink fill with paper text and a full-strength ink border. Used as the Activity-feed category filter row.

## Props / state

| Prop       | Type         | Default | Notes                                                    |
| ---------- | ------------ | ------- | -------------------------------------------------------- |
| `active`   | `boolean`    | —       | Toggles border colour, background fill, and text colour. |
| `onClick`  | `() => void` | —       | Click handler.                                           |
| `children` | `ReactNode`  | —       | Chip label.                                              |

**State:** none (presentational; active state is controlled by the parent).

## UX behaviour

- Mono uppercase: `fontFamily: "var(--w-mono)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em"`.
- `borderRadius: 999` capsule, `padding: "7px 14px"`, `whiteSpace: "nowrap"`, `cursor: "pointer"`.
- Active → `border: "2px solid var(--w-ink)"`, `background: "var(--w-ink)"`, `color: "var(--w-paper)"`. Inactive → `border: "2px solid var(--w-line)"`, `background: "transparent"`, `color: "var(--w-ink-soft)"`.

## Dependencies

- **Shared primitives:** none.
- **CSS variables:** `--w-mono`, `--w-ink`, `--w-line`, `--w-paper`, `--w-ink-soft`.
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** reads `React` indirectly (JSX). Not exported.

## Reuse notes

A solid toggle-chip pattern. For production: move styling to the `data-slot` layer, add `aria-pressed` (it has none here, unlike `MoToggle`), and consider a focus-visible ring. No timers or mock data inside the component.

## Source snippet

```jsx
function MoChip({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontFamily: "var(--w-mono)",
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        padding: "7px 14px",
        borderRadius: 999,
        cursor: "pointer",
        border: active ? "2px solid var(--w-ink)" : "2px solid var(--w-line)",
        background: active ? "var(--w-ink)" : "transparent",
        color: active ? "var(--w-paper)" : "var(--w-ink-soft)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  )
}
```

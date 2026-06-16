# InkButton

- **Surface:** shared (primitive)
- **Source module:** [extracted-source/10-primitives.jsx](../../extracted-source/10-primitives.jsx) (lines 7–41)
- **Export:** `window.InkButton` (global)
- **Reuse verdict:** ⚠️ Reusable concept, needs refactor (inline styles, press-state via JS, global export)

## Visual purpose

The primary tactile button of the "Wet Ink" system: a hard-bordered, offset-shadow block in one of three palettes (accent / dark / outline). On press it physically "presses into the paper" — the offset shadow collapses and the button translates down-right, reinforcing the rubber-stamp / riso-print metaphor.

## Props / state

| Prop       | Type                               | Default     | Notes                                                                                                              |
| ---------- | ---------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------ |
| `variant`  | `"primary" \| "dark" \| "outline"` | `"primary"` | Maps to a `palettes` lookup. `primary`=accent bg/white text, `dark`=ink bg/paper text, `outline`=card bg/ink text. |
| `size`     | `"lg" \| "md" \| "sm"`             | `"lg"`      | Padding + font-size + `minHeight` (54/46/38px — all ≥ the 44px tap target except `sm`).                            |
| `full`     | `boolean`                          | —           | `width: 100%` when true.                                                                                           |
| `onClick`  | `() => void`                       | —           | Suppressed when `disabled`.                                                                                        |
| `disabled` | `boolean`                          | —           | Drops opacity to 0.45 and removes the click handler + press transform.                                             |
| `style`    | `CSSProperties`                    | —           | Spread last, so callers can override anything.                                                                     |
| `children` | `ReactNode`                        | —           | Label.                                                                                                             |

**State:** `const [down, setDown] = useState(false)` — tracks the active press to swap shadow/transform.

## UX behaviour

- `onPointerDown` → `down=true`; `onPointerUp` / `onPointerLeave` → `down=false`.
- Pressed look (only when not disabled): `boxShadow` shrinks `var(--w-shadow)` → `1px 1px 0 var(--w-ink)` and `transform: translate(3px,3px)`, over a `90ms` transition on transform + box-shadow.
- `touchAction: "manipulation"` and `whiteSpace: "nowrap"` to keep it tap-friendly and single-line.

## Dependencies

- **Shared primitives:** none.
- **CSS variables:** `--w-accent`, `--w-ink`, `--w-paper`, `--w-card`, `--w-r`, `--w-shadow`, `--w-display`.
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** reads `React` (destructured `useState`); writes itself to `window.InkButton`.

## Reuse notes

The visual treatment is the canonical Wet Ink button and worth preserving verbatim as a design reference. For production it needs: (1) styles moved into the token/`data-slot` layer instead of inline objects; (2) press feedback via CSS `:active` rather than a `useState` + pointer handlers; (3) a proper module export instead of `window.*`; (4) an `aria-disabled` / native `disabled` attribute instead of just dropping the handler. Palette + size scales are clean and portable.

## Source snippet

```jsx
function InkButton({
  variant = "primary",
  size = "lg",
  full,
  onClick,
  children,
  style,
  disabled,
}) {
  const [down, setDown] = useState(false)
  const palettes = {
    primary: { background: "var(--w-accent)", color: "#fff" },
    dark: { background: "var(--w-ink)", color: "var(--w-paper)" },
    outline: { background: "var(--w-card)", color: "var(--w-ink)" },
  }
  const sizes = {
    lg: { padding: "15px 24px", fontSize: 17, minHeight: 54 },
    md: { padding: "11px 18px", fontSize: 15, minHeight: 46 },
    sm: { padding: "7px 14px", fontSize: 13.5, minHeight: 38 },
  }
  const press = down && !disabled
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onPointerDown={() => setDown(true)}
      onPointerUp={() => setDown(false)}
      onPointerLeave={() => setDown(false)}
      style={{
        fontFamily: "var(--w-display)",
        fontWeight: 700,
        letterSpacing: "0.01em",
        border: "2px solid var(--w-ink)",
        borderRadius: "var(--w-r)",
        cursor: disabled ? "default" : "pointer",
        width: full ? "100%" : undefined,
        boxShadow: press ? "1px 1px 0 var(--w-ink)" : "var(--w-shadow)",
        transform: press ? "translate(3px,3px)" : "none",
        transition: "transform 90ms, box-shadow 90ms",
        whiteSpace: "nowrap",
        opacity: disabled ? 0.45 : 1,
        touchAction: "manipulation",
        ...palettes[variant],
        ...sizes[size],
        ...style,
      }}
    >
      {children}
    </button>
  )
}
```

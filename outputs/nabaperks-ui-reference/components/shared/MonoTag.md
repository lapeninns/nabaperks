# MonoTag

- **Surface:** shared (primitive)
- **Source module:** [extracted-source/10-primitives.jsx](../../extracted-source/10-primitives.jsx) (lines 56–70)
- **Export:** `window.MonoTag` (global)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles, global export)

## Visual purpose

A small pill-shaped status/label chip in the mono typeface — the Wet Ink equivalent of a badge. Three tones (`accent` / `ink` / `plain`) signal emphasis: accent = hot-coloured, ink = solid dark, plain = transparent with a thin line border. Uppercase, letter-spaced mono text reinforces the receipt/stamp aesthetic.

## Props / state

| Prop       | Type                           | Default   | Notes                                                                         |
| ---------- | ------------------------------ | --------- | ----------------------------------------------------------------------------- |
| `tone`     | `"accent" \| "ink" \| "plain"` | `"plain"` | Falls back to `plain` when unset. Selects bg/colour/border from a `t` lookup. |
| `children` | `ReactNode`                    | —         | Label content (often text alongside an icon, given the `gap: 6` flex).        |
| `style`    | `CSSProperties`                | —         | Spread last, so callers can override anything.                                |

**State:** none (stateless function component).

## UX behaviour

- `display: inline-flex` with `alignItems: center` and `gap: 6` — allows an icon + text pairing.
- Typography: `fontFamily: var(--w-mono)`, `fontSize: 11`, `fontWeight: 700`, `textTransform: uppercase`, `letterSpacing: 0.08em`.
- Fully rounded (`borderRadius: 999`), `padding: 4px 11px`, `whiteSpace: nowrap`.
- Tone palette: `accent` = accent bg / white text / ink border; `ink` = ink bg / paper text / ink border; `plain` = transparent / ink-soft text / line border. All borders `1.5px solid`.

## Dependencies

- **Shared primitives:** none.
- **CSS variables:** `--w-accent`, `--w-ink`, `--w-paper`, `--w-ink-soft`, `--w-line`, `--w-mono`.
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** reads `React`; writes itself to `window.MonoTag`.

## Reuse notes

A tidy, portable badge primitive. For production: (1) move the tone lookup + inline styles into the token/`data-slot` layer or a CVA-style variant map; (2) replace `window.*` with a module export; (3) the white `#fff` literal in the `accent` tone could be tokenised (`--w-accent-ink`). The accent tone uses a literal `#fff`, not a token. No state or timing mocks.

## Source snippet

```jsx
function MonoTag({ children, tone, style }) {
  const t = {
    accent: {
      background: "var(--w-accent)",
      color: "#fff",
      border: "1.5px solid var(--w-ink)",
    },
    ink: {
      background: "var(--w-ink)",
      color: "var(--w-paper)",
      border: "1.5px solid var(--w-ink)",
    },
    plain: {
      background: "transparent",
      color: "var(--w-ink-soft)",
      border: "1.5px solid var(--w-line)",
    },
  }[tone || "plain"]
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        fontFamily: "var(--w-mono)",
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.08em",
        borderRadius: 999,
        padding: "4px 11px",
        whiteSpace: "nowrap",
        ...t,
        ...style,
      }}
    >
      {children}
    </span>
  )
}
```

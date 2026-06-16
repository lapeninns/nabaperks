# McStat

- **Surface:** merchant (module-local helper)
- **Source module:** [extracted-source/20-merchant-core.jsx](../../extracted-source/20-merchant-core.jsx) (lines 92–107)
- **Export:** none (module-local; not on `window`)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles)

## Visual purpose

A single metric tile for the Today dashboard: a large display-font number over a small uppercase mono caption, in a hard-bordered offset-shadow card. Supports an `accent` tone that flips the card to the hot accent fill with white text (used for the lead "Stamps today" stat).

## Props / state

| Prop    | Type                    | Default | Notes                                                                                                                            |
| ------- | ----------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `value` | `ReactNode`             | —       | The big number/string (e.g. `"14"`, `"41%"`).                                                                                    |
| `label` | `ReactNode`             | —       | Uppercase mono caption beneath.                                                                                                  |
| `tone`  | `"accent" \| undefined` | —       | `"accent"` → accent background + white text, caption opacity `0.9`; otherwise card background + ink text, caption opacity `0.6`. |

**State:** none.

## UX behaviour

- Pure presentational; no handlers.
- Number uses `--w-display` at `fontSize 38`, `lineHeight 1`; caption uses `--w-mono` at `fontSize 10.5`, `letterSpacing 0.08em`, uppercased.
- Carries the small offset shadow `var(--w-shadow-sm)`.

## Dependencies

- **Shared primitives:** none.
- **CSS variables:** `--w-accent`, `--w-card`, `--w-ink`, `--w-r`, `--w-shadow-sm`, `--w-display`, `--w-mono`.
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** none (module-local).

## Reuse notes

Clean, faithful Wet Ink stat tile and a good reference. For production: move inline styles to the token/`data-slot` layer and replace the boolean-ish `tone` string with a typed variant. The display/mono type pairing and accent-flip pattern are portable verbatim.

## Source snippet

```jsx
function McStat({ value, label, tone }) {
  return (
    <div
      style={{
        background: tone === "accent" ? "var(--w-accent)" : "var(--w-card)",
        color: tone === "accent" ? "#fff" : "var(--w-ink)",
        border: "2px solid var(--w-ink)",
        borderRadius: "var(--w-r)",
        boxShadow: "var(--w-shadow-sm)",
        padding: "16px 18px",
      }}
    >
      <div
        style={{
          fontFamily: "var(--w-display)",
          fontWeight: 800,
          fontSize: 38,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontFamily: "var(--w-mono)",
          fontSize: 10.5,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginTop: 8,
          opacity: tone === "accent" ? 0.9 : 0.6,
        }}
      >
        {label}
      </div>
    </div>
  )
}
```

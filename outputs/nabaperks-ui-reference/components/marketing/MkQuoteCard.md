# MkQuoteCard

- **Surface:** marketing (content sub-component)
- **Source module:** [extracted-source/50-marketing.jsx](../../extracted-source/50-marketing.jsx) (lines 84–102)
- **Export:** none (module-local function, rendered by `MkHome` from the `MK_QUOTES` array)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles, rotation as a prop, data-shape coupling)

## Visual purpose

A single pilot testimonial rendered as a tilted paper receipt. The quote sits in display type, a dashed `ReceiptRule` divides it from the attribution row, and the attribution pairs the speaker/venue (mono lines) with a `VenueMark` initials disc. Each card is rotated by its own `angle` so the social-proof strip reads as a scatter of pinned receipts.

## Props / state

| Prop       | Type     | Default | Notes                                                                              |
| ---------- | -------- | ------- | ---------------------------------------------------------------------------------- |
| `q`        | `string` | —       | Quote body. Rendered wrapped in literal straight double-quotes: `"{q}"`.           |
| `who`      | `string` | —       | Speaker + role, e.g. `"Maya · Manager"`.                                           |
| `venue`    | `string` | —       | Venue + city, e.g. `"The Old Crown, Bristol"`.                                     |
| `initials` | `string` | —       | Two-letter venue mark, e.g. `"OC"`. Also used as the React `key` at the call site. |
| `angle`    | `number` | —       | Degrees of `rotate(...)` applied to the outer wrapper.                             |
| `mo`       | `number` | —       | Motion multiplier (from `t.mo`), passed straight through to `ReceiptCard`.         |

Props are spread from each `MK_QUOTES` entry via `<MkQuoteCard key={qt.initials} {...qt} mo={mo} />`.

**State:** none.

## UX behaviour

- Static; the only motion is the entrance/animation owned by `ReceiptCard mo={mo}`.
- `VenueMark` is rendered at `size={46}` with a fixed `angle={-7}` (independent of the card's own `angle`).

## Dependencies

- **Shared primitives:** `ReceiptCard`, `ReceiptRule`, `MonoLine`, `VenueMark` (all on `window`).
- **CSS variables:** `--w-display`, `--w-ink`.
- **Keyframes:** none directly (any entrance animation belongs to `ReceiptCard`).
- **localStorage:** none.
- **Globals / window:** reads the four shared primitives above. Not exported.

## Reuse notes

A clean, portable testimonial card. For production: (1) move inline styles into the token layer; (2) treat `angle` as presentation chosen by the container, not baked per data row, so the same card can be reused outside the scatter layout; (3) the literal `"{q}"` quote wrapping should be a styled quotation treatment rather than typed glyphs. Otherwise the data shape (`q/who/venue/initials`) is sensible and reusable.

## Source snippet

```jsx
function MkQuoteCard({ q, who, venue, initials, angle, mo }) {
  return (
    <div style={{ transform: `rotate(${angle}deg)` }}>
      <ReceiptCard mo={mo}>
        <div
          style={{
            fontSize: 16.5,
            fontWeight: 700,
            lineHeight: 1.4,
            fontFamily: "var(--w-display)",
          }}
        >
          "{q}"
        </div>
        <ReceiptRule />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div>
            <MonoLine style={{ color: "var(--w-ink)", fontWeight: 700 }}>
              {who}
            </MonoLine>
            <MonoLine style={{ fontSize: 10, marginTop: 3 }}>{venue}</MonoLine>
          </div>
          <VenueMark size={46} initials={initials} angle={-7} />
        </div>
      </ReceiptCard>
    </div>
  )
}
```

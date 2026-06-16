# McBrand

- **Surface:** merchant (module-local helper)
- **Source module:** [extracted-source/20-merchant-core.jsx](../../extracted-source/20-merchant-core.jsx) (lines 78–90)
- **Export:** none (module-local; not on `window`)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles, literal `✱` wordmark glyph)

## Visual purpose

The merchant masthead lockup: the rotated `✱` accent disc (the Nabaperks wordmark signature) beside the lowercase `nabaperks` wordmark, with an optional venue chip trailing. Sits top-left in `MerchantSurface`'s header on every stage.

## Props / state

| Prop    | Type             | Default | Notes                                                                                                 |
| ------- | ---------------- | ------- | ----------------------------------------------------------------------------------------------------- |
| `venue` | `string \| null` | —       | When truthy, renders a trailing `MonoTag` with the venue name. Passed `null` outside the `app` stage. |

**State:** none.

## UX behaviour

- Pure presentational; no handlers.
- The disc is a 28×28 accent circle, ink-bordered, white `✱` at `fontWeight 800`, rotated `-6deg` — the canonical Wet Ink stamp tilt.
- Venue chip only appears once the merchant is in the `app` stage (caller passes `venueTag`).

## Dependencies

- **Shared primitives:** `MonoTag`.
- **CSS variables:** `--w-accent`, `--w-ink`.
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** reads shared primitives from `window` (`MonoTag`); not itself exported.

## Reuse notes

Faithful Wet Ink masthead. The `✱` is the brand wordmark/logo signature and is allowed (per DESIGN.md it stays the wordmark signature only). For production: lift inline styles into the token/`data-slot` layer, and the disc + wordmark belong in `components/brand` rather than re-declared per surface. The rotation, sizing, and lowercase wordmark are portable verbatim.

## Source snippet

```jsx
function McBrand({ venue }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span
        style={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          background: "var(--w-accent)",
          border: "2px solid var(--w-ink)",
          display: "inline-grid",
          placeItems: "center",
          color: "#fff",
          fontWeight: 800,
          fontSize: 14,
          transform: "rotate(-6deg)",
        }}
      >
        ✱
      </span>
      <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: "-0.01em" }}>
        nabaperks
      </span>
      {venue && <MonoTag style={{ marginLeft: 6 }}>{venue}</MonoTag>}
    </div>
  )
}
```

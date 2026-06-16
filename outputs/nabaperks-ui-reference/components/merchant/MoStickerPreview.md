# MoStickerPreview

- **Surface:** merchant (printable-asset preview variant, used inside `MerchantQrStudio`)
- **Source module:** [extracted-source/21-merchant-ops.jsx](../../extracted-source/21-merchant-ops.jsx) (lines 321–337)
- **Export:** local to module (referenced via the `MO_ASSETS` array; not on `window`)
- **Reuse verdict:** 🔒 Prototype-only (hardcoded copy, no props, baked-in `QrBlock`). Circular-sticker layout is a reusable reference.

## Visual purpose

A round vinyl sticker mock. A square `aspectRatio: "1 / 1"` cell centres an 82%-width circle (tilted `-8°`, hard shadow) with an inner dashed ring. Inside, an accent-coloured "Stamp your visit" line, a `QrBlock`, and a small venue line are stacked.

## Props / state

| Prop | Type | Notes                                                                        |
| ---- | ---- | ---------------------------------------------------------------------------- |
| —    | —    | **Takes no props.** Copy is hardcoded ("Stamp your visit", "The Old Crown"). |

**State:** none (pure render).

## UX behaviour

- Outer cell `display: grid, placeItems: center, aspectRatio: "1 / 1"`.
- Circle: `width: "82%", aspectRatio: "1 / 1", borderRadius: "50%", background: var(--w-card)`, ink border, `boxShadow: var(--w-shadow)`, `transform: rotate(-8deg)`, stacked column centred with `gap: 7`.
- Inner ring: absolutely positioned `inset: 7, borderRadius: "50%", border: "1.5px dashed var(--w-line)"`.
- Top line accent-coloured: `MonoLine fontSize: 8, color: var(--w-accent)`. `QrBlock size={64}`.

## Dependencies

- **Shared primitives (window):** `MonoLine`. **`QrBlock`** — referenced, not in the provided shared list; defined elsewhere in the prototype (unclear from this source). Only `size` is passed.
- **CSS variables:** `--w-card`, `--w-ink`, `--w-line`, `--w-accent`, `--w-shadow`.
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** reads `React` indirectly (JSX); reads `window.MonoLine` and `QrBlock`. Not exported (held in `MO_ASSETS`).

## Reuse notes

A characterful circular-sticker mock with a die-cut dashed ring. For production: parameterise the venue copy and confirm `QrBlock`'s source module. Preview only — download is simulated in `MerchantQrStudio`.

## Source snippet

```jsx
function MoStickerPreview() {
  return (
    <div
      style={{ display: "grid", placeItems: "center", aspectRatio: "1 / 1" }}
    >
      <div
        style={{
          width: "82%",
          aspectRatio: "1 / 1",
          borderRadius: "50%",
          background: "var(--w-card)",
          border: "2px solid var(--w-ink)",
          boxShadow: "var(--w-shadow)",
          transform: "rotate(-8deg)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
          position: "relative",
          padding: 12,
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 7,
            borderRadius: "50%",
            border: "1.5px dashed var(--w-line)",
          }}
        ></div>
        <MonoLine
          style={{ fontSize: 8, fontWeight: 700, color: "var(--w-accent)" }}
        >
          Stamp your visit
        </MonoLine>
        <QrBlock size={64} />
        <MonoLine style={{ fontSize: 7.5 }}>The Old Crown</MonoLine>
      </div>
    </div>
  )
}
```

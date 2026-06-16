# MoPosterPreview

- **Surface:** merchant (printable-asset preview variant, used inside `MerchantQrStudio`)
- **Source module:** [extracted-source/21-merchant-ops.jsx](../../extracted-source/21-merchant-ops.jsx) (lines 283–302)
- **Export:** local to module (referenced via the `MO_ASSETS` array; not on `window`)
- **Reuse verdict:** 🔒 Prototype-only (hardcoded venue/offer copy, no props, baked-in `QrBlock`). The poster layout is a reusable visual reference.

## Visual purpose

A miniature A4 counter poster, tilted `-2°` with a hard offset shadow. Vertical layout: venue line + "Stamp your visit." headline at top, a central `QrBlock`, then the offer line and a `VenueMark` at the bottom. The largest of the three QR-studio asset previews (`aspectRatio: "3 / 4"`).

## Props / state

| Prop | Type | Notes                                                                                                      |
| ---- | ---- | ---------------------------------------------------------------------------------------------------------- |
| —    | —    | **Takes no props.** All content is hardcoded ("The Old Crown · Bristol", "Free hot drink after 3 visits"). |

**State:** none (pure render).

## UX behaviour

- `aspectRatio: "3 / 4"`, `background: var(--w-card)`, ink border, `borderRadius: var(--w-r)`, `boxShadow: var(--w-shadow)`, `transform: rotate(-2deg)`.
- `display: flex, flexDirection: column, justifyContent: space-between, alignItems: center, textAlign: center, overflow: hidden`.
- Headline `fontWeight: 800, fontSize: 21`. Offer line `MonoLine fontSize: 8.5` in full ink. `QrBlock size={92}`, `VenueMark size={34} angle={-8}`.

## Dependencies

- **Shared primitives (window):** `MonoLine`, `VenueMark`. **`QrBlock`** — referenced but **not in the shared-primitives list provided**; defined elsewhere in the prototype (unclear from this source which module). `size` is the only prop passed.
- **CSS variables:** `--w-card`, `--w-ink`, `--w-r`, `--w-shadow`.
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** reads `React` indirectly (JSX); reads `window.MonoLine`, `window.VenueMark`, and `QrBlock`. Not exported (held in `MO_ASSETS`).

## Reuse notes

A faithful poster mock worth keeping as a print-asset reference. For production: parameterise venue name, city and offer copy (currently hardcoded for the demo merchant), confirm where `QrBlock` lives, and move styling to `data-slot`. This renders a _preview_, not a print-ready file — the actual PDF/PNG generation is faked in `MerchantQrStudio` via `setTimeout`.

## Source snippet

```jsx
function MoPosterPreview() {
  return (
    <div
      style={{
        aspectRatio: "3 / 4",
        background: "var(--w-card)",
        border: "2px solid var(--w-ink)",
        borderRadius: "var(--w-r)",
        boxShadow: "var(--w-shadow)",
        transform: "rotate(-2deg)",
        padding: "16px 14px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        textAlign: "center",
        overflow: "hidden",
      }}
    >
      <div>
        <MonoLine style={{ fontSize: 9 }}>The Old Crown · Bristol</MonoLine>
        <div
          style={{
            fontWeight: 800,
            fontSize: 21,
            lineHeight: 1.05,
            marginTop: 6,
          }}
        >
          Stamp your visit.
        </div>
      </div>
      <QrBlock size={92} />
      <div>
        <MonoLine
          style={{ fontSize: 8.5, fontWeight: 700, color: "var(--w-ink)" }}
        >
          Free hot drink after 3 visits
        </MonoLine>
        <div
          style={{ display: "flex", justifyContent: "center", marginTop: 7 }}
        >
          <VenueMark size={34} angle={-8} />
        </div>
      </div>
    </div>
  )
}
```

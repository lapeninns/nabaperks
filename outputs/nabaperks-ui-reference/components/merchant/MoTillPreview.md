# MoTillPreview

- **Surface:** merchant (printable-asset preview variant, used inside `MerchantQrStudio`)
- **Source module:** [extracted-source/21-merchant-ops.jsx](../../extracted-source/21-merchant-ops.jsx) (lines 304–319)
- **Export:** local to module (referenced via the `MO_ASSETS` array; not on `window`)
- **Reuse verdict:** 🔒 Prototype-only (hardcoded copy, no props, baked-in `QrBlock`). Layout is a reusable reference.

## Visual purpose

A miniature landscape till card (`aspectRatio: "5 / 3"`), tilted `+1.5°` with a hard offset shadow. Horizontal layout: venue line, "Stamp your visit." headline, and a small "3 visits · mystery reward" line stacked on the left; a `QrBlock` on the right.

## Props / state

| Prop | Type | Notes                                                                                 |
| ---- | ---- | ------------------------------------------------------------------------------------- |
| —    | —    | **Takes no props.** Copy is hardcoded ("The Old Crown", "3 visits · mystery reward"). |

**State:** none (pure render).

## UX behaviour

- `aspectRatio: "5 / 3"`, `background: var(--w-card)`, ink border, `boxShadow: var(--w-shadow)`, `transform: rotate(1.5deg)`.
- `display: flex, alignItems: center, gap: 12, overflow: hidden`. Left column `flex: 1, minWidth: 0`.
- Headline `fontWeight: 800, fontSize: 16`. `QrBlock size={66}`.

## Dependencies

- **Shared primitives (window):** `MonoLine`. **`QrBlock`** — referenced, not in the provided shared list; defined elsewhere in the prototype (unclear from this source). Only `size` is passed.
- **CSS variables:** `--w-card`, `--w-ink`, `--w-r`, `--w-shadow`.
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** reads `React` indirectly (JSX); reads `window.MonoLine` and `QrBlock`. Not exported (held in `MO_ASSETS`).

## Reuse notes

A clean landscape-card mock. For production: parameterise the venue/offer copy and confirm `QrBlock`'s home. As with the other previews, this is a _visual preview_; the "download" action is faked in `MerchantQrStudio`.

## Source snippet

```jsx
function MoTillPreview() {
  return (
    <div
      style={{
        aspectRatio: "5 / 3",
        background: "var(--w-card)",
        border: "2px solid var(--w-ink)",
        borderRadius: "var(--w-r)",
        boxShadow: "var(--w-shadow)",
        transform: "rotate(1.5deg)",
        padding: "12px 14px",
        display: "flex",
        alignItems: "center",
        gap: 12,
        overflow: "hidden",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <MonoLine style={{ fontSize: 8.5 }}>The Old Crown</MonoLine>
        <div
          style={{
            fontWeight: 800,
            fontSize: 16,
            lineHeight: 1.08,
            margin: "5px 0 6px",
          }}
        >
          Stamp your visit.
        </div>
        <MonoLine style={{ fontSize: 8 }}>3 visits · mystery reward</MonoLine>
      </div>
      <QrBlock size={66} />
    </div>
  )
}
```

# Screen-sealed

- **Surface:** customer-web (CustomerFlow state `sealed`)
- **Source module:** [extracted-source/30-customer.jsx](../../extracted-source/30-customer.jsx) (lines 391–415)
- **Export:** none (render branch of `CustomerFlow`)
- **Reuse verdict:** 🔒 Prototype-only (reward content hardcoded; reveal is a local interaction)

## Visual purpose

The "third visit reached, reward earned but still sealed" moment. An accent `MonoTag` "Three visits", headline "Something's under there.", a one-line paragraph, then a `ReceiptCard` containing the interactive `Seal` (a wax/rubber seal the user breaks open) and a footer with the card number and a "SEALED 12 JUN" line.

## Props / state

Reads `mo` and `t.reveal` (passed to `Seal` as `mode`). The `Seal` calls `onBroken={() => patch({ step: "revealed" })}`. Does not render the shared receipt — uses a bare `ReceiptCard`.

## UX behaviour

- Entered from `doStamp` once `visits` hits 3 (scheduled `1100 * mo` after the third stamp); also via the `sealed` preset.
- Breaking the `Seal` (its `onBroken` callback) → `revealed`.
- Entrance via `w-rise`.

## Dependencies

- **Internal:** none beyond `patch`.
- **Shared primitives:** `MonoTag`, `ReceiptCard`, `Seal`, `ReceiptRule`, `MonoLine`.
- **CSS variables:** `--w-ink-soft`.
- **Keyframes:** `w-rise` (entrance); `Seal` internally consumes the splat/stamp keyframes.
- **localStorage:** `v3_customer`.

## Reuse notes

The "mystery sealed reward" mechanic is a core brand delight; the `Seal` interaction (mode driven by the `reveal` tweak) is worth preserving. The reward itself and the "SEALED 12 JUN" date are hardcoded; the break is a local UI event, not a server confirmation.

## Source snippet

```jsx
if (step === "sealed") {
  body = (
    <div
      data-screen-label="Customer · Sealed"
      style={{ animation: `w-rise ${380 * mo}ms both` }}
    >
      <div style={{ textAlign: "center", margin: "6px 0 22px" }}>
        <MonoTag tone="accent">Three visits</MonoTag>
        <h1
          style={{
            fontSize: 32,
            fontWeight: 800,
            lineHeight: 1.06,
            margin: "16px 0 8px",
          }}
        >
          Something's under there.
        </h1>
        <p style={{ fontSize: 15, color: "var(--w-ink-soft)", margin: 0 }}>
          You've earned the mystery reward.
        </p>
      </div>
      <ReceiptCard mo={mo}>
        <div style={{ padding: "16px 0 10px" }}>
          <Seal
            mode={t.reveal}
            mo={mo}
            onBroken={() => patch({ step: "revealed" })}
          />
        </div>
        <ReceiptRule />
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <MonoLine style={{ fontSize: 10 }}>CARD Nº OC-0248</MonoLine>
          <MonoLine style={{ fontSize: 10 }}>SEALED 12 JUN</MonoLine>
        </div>
      </ReceiptCard>
    </div>
  )
}
```

# Screen-firstStamp

- **Surface:** customer-web (CustomerFlow state `firstStamp`)
- **Source module:** [extracted-source/30-customer.jsx](../../extracted-source/30-customer.jsx) (lines 239–256)
- **Export:** none (render branch of `CustomerFlow`)
- **Reuse verdict:** 🔒 Prototype-only

## Visual purpose

The celebratory beat right after the first stamp. Accent tag "Stamped", headline "That's one.", a paragraph nudging the customer to save the card, the shared receipt (`cardBody(null)`, now 1 stamp), and a two-action choice: primary "Keep my card" and a ghost "Maybe later".

## Props / state

Reads `mo` and — via `cardBody` — `visits` (1), `saved`, `slam`, `shake`. Buttons call `patch({ step: "save" })` and `patch({ step: "card" })`.

## UX behaviour

- Entered from `landing` after `doStamp` schedules it (`950 * mo`). Also reachable directly via the `firstStamp` preset.
- "Keep my card" → `save`. "Maybe later" → `card`.
- Entrance via `w-rise`.

## Dependencies

- **Internal:** `cardBody`.
- **Shared primitives:** `MonoTag`, `InkButton`, `GhostLink`, plus (via `cardBody`) `ReceiptCard`, `ReceiptRule`, `StampRow`, `ProgressLine`, `VenueMark`, `MonoLine`.
- **CSS variables:** `--w-ink-soft`.
- **Keyframes:** `w-rise`.
- **localStorage:** `v3_customer`.

## Reuse notes

The "save it so it survives a closed tab" framing is the prototype's pitch for phone-first persistence — keep the copy, drop the localStorage dependency.

## Source snippet

```jsx
if (step === "firstStamp") {
  body = (
    <div data-screen-label="Customer · First stamp">
      <div
        style={{
          textAlign: "center",
          margin: "6px 0 22px",
          animation: `w-rise ${380 * mo}ms both`,
        }}
      >
        <MonoTag tone="accent">Stamped</MonoTag>
        <h1
          style={{
            fontSize: 34,
            fontWeight: 800,
            lineHeight: 1.05,
            margin: "16px 0 10px",
          }}
        >
          That's one.
        </h1>
        <p
          style={{
            fontSize: 15.5,
            lineHeight: "23px",
            color: "var(--w-ink-soft)",
            margin: "0 auto",
            maxWidth: "28ch",
          }}
        >
          Two more visits and the seal breaks. Keep the card so it survives a
          closed tab.
        </p>
      </div>
      {cardBody(null)}
      <div style={{ marginTop: 22, display: "grid", gap: 8 }}>
        <InkButton full onClick={() => patch({ step: "save" })}>
          Keep my card
        </InkButton>
        <GhostLink onClick={() => patch({ step: "card" })}>
          Maybe later
        </GhostLink>
      </div>
    </div>
  )
}
```

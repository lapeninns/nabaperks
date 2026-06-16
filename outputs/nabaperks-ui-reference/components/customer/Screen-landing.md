# Screen-landing

- **Surface:** customer-web (CustomerFlow state `landing`)
- **Source module:** [extracted-source/30-customer.jsx](../../extracted-source/30-customer.jsx) (lines 218–237)
- **Export:** none (render branch of `CustomerFlow`)
- **Reuse verdict:** 🔒 Prototype-only (hardcoded venue/offer, faked stamp via PIN sheet)

## Visual purpose

The post-scan welcome. A `MonoTag` "Scanned at the counter", a big headline "Your first stamp is waiting.", an explanatory paragraph, the shared receipt card (`cardBody(null)`, showing 0 stamps), and a primary "Collect my first stamp" button with a reassuring sub-line.

## Props / state

Reads `step` (must be `landing`), `mo`, and — through `cardBody` — `visits` (0 here), `saved`, `slam`, `shake`. The button calls `requestStamp`.

## UX behaviour

- Entered from `scan` via `CuScanView` `onDone`.
- "Collect my first stamp" → `requestStamp()`: opens the stamp `Sheet` (or, were `stampedToday` already true, jumps to `alreadyStamped` — not reachable from the `landing` preset where `stampedToday:false`). Completing the sheet (`doStamp`) bumps `visits` and, because `step === "landing"`, schedules a transition to `firstStamp` after `950 * mo`.
- Entrance via `w-rise` (scaled by `mo`).

## Dependencies

- **Internal:** `cardBody`, `requestStamp`.
- **Shared primitives:** `MonoTag`, `MonoLine`, `InkButton`, plus (via `cardBody`) `ReceiptCard`, `ReceiptRule`, `StampRow`, `ProgressLine`, `VenueMark`.
- **CSS variables:** `--w-ink-soft`.
- **Keyframes:** `w-rise`.
- **localStorage:** `v3_customer`.

## Reuse notes

Copy is strong and on-brand ("No app — it lives right here"). The stamp itself is faked through a staff `PinPad` sheet — in production the first stamp would come from the QR-resolved self-service stamp RPC, not a counter PIN.

## Source snippet

```jsx
if (step === "landing") {
  body = (
    <div
      data-screen-label="Customer · Landing"
      style={{ animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both` }}
    >
      <div style={{ textAlign: "center", margin: "6px 0 22px" }}>
        <MonoTag>Scanned at the counter</MonoTag>
        <h1
          style={{
            fontSize: 34,
            fontWeight: 800,
            lineHeight: 1.05,
            margin: "16px 0 10px",
          }}
        >
          Your first stamp is waiting.
        </h1>
        <p
          style={{
            fontSize: 15.5,
            lineHeight: "23px",
            color: "var(--w-ink-soft)",
            margin: "0 auto",
            maxWidth: "30ch",
          }}
        >
          The Old Crown stamps this card every visit. Three visits unseal a
          mystery reward. No app — it lives right here.
        </p>
      </div>
      {cardBody(null)}
      <div style={{ marginTop: 22, display: "grid", gap: 10 }}>
        <InkButton full onClick={requestStamp}>
          Collect my first stamp
        </InkButton>
        <MonoLine style={{ textAlign: "center", fontSize: 10 }}>
          No signup yet · takes ten seconds
        </MonoLine>
      </div>
    </div>
  )
}
```

# Screen-alreadyStamped

- **Surface:** customer-web (CustomerFlow state `alreadyStamped`)
- **Source module:** [extracted-source/30-customer.jsx](../../extracted-source/30-customer.jsx) (lines 356–389)
- **Export:** none (render branch of `CustomerFlow`)
- **Reuse verdict:** 🔒 Prototype-only (one-per-day enforced client-side; demo time-skip)

## Visual purpose

The calm "one stamp a day keeps it fair" state shown when a customer tries to stamp again on a day they've already been stamped. An ink `MonoTag` "Today's done", headline "One stamp a day keeps it fair.", a gentle paragraph, the shared receipt with an inset "Next stamp / One per UK business day." panel tagged "From 13 Jun", then a dark "Back to my card" and a "Skip to tomorrow" demo tag.

## Props / state

Reads `mo` and `cardBody` internals (`visits`, `saved`, `slam`, `shake`). The branch is reached from `requestStamp()` whenever `stampedToday` is true. Buttons: `patch({ step: "card" })` and `patch({ stampedToday: false, step: "card" })`.

## UX behaviour

- Entered when `requestStamp()` runs while `stampedToday` (from `landing` or `card`); also via the `alreadyStamped` preset.
- "Back to my card" → `card`.
- "Skip to tomorrow" `DemoTag` → clears `stampedToday` and returns to `card`, simulating the next UK business day (prototype-ism — there is no real date check; `stampedToday` is a plain flag).
- Entrance via `w-rise`.

## Dependencies

- **Internal:** `cardBody`.
- **Shared primitives:** `MonoTag`, `InkButton`, `DemoTag`, plus (via `cardBody`) `ReceiptCard`, `ReceiptRule`, `StampRow`, `ProgressLine`, `VenueMark`, `MonoLine`.
- **CSS variables:** `--w-ink-soft`, `--w-r`, `--w-line`.
- **Keyframes:** `w-rise`.
- **localStorage:** `v3_customer`.

## Reuse notes

This calm, non-punitive treatment of the one-per-day rule is a model worth keeping. The rule is real in production (Postgres enforces one stamp per `Europe/London` business day), but here it's a client-side boolean with a "Skip to tomorrow" cheat; the "From 13 Jun" date is hardcoded.

## Source snippet

```jsx
if (step === "alreadyStamped") {
  body = (
    <div
      data-screen-label="Customer · Already stamped"
      style={{ animation: `w-rise ${380 * mo}ms both` }}
    >
      <div style={{ textAlign: "center", margin: "6px 0 22px" }}>
        <MonoTag tone="ink">Today's done</MonoTag>
        <h1
          style={{
            fontSize: 30,
            fontWeight: 800,
            lineHeight: 1.08,
            margin: "16px 0 10px",
          }}
        >
          One stamp a day keeps it fair.
        </h1>
        <p
          style={{
            fontSize: 15,
            lineHeight: "22px",
            color: "var(--w-ink-soft)",
            margin: "0 auto",
            maxWidth: "30ch",
          }}
        >
          Today's stamp is already drying on your card. The next one's waiting
          whenever you're back.
        </p>
      </div>
      {cardBody(
        <div
          style={{
            marginTop: 14,
            padding: "12px 14px",
            borderRadius: "var(--w-r)",
            border: "2px dashed var(--w-line)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 10,
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>Next stamp</div>
            <div style={{ fontSize: 13, color: "var(--w-ink-soft)" }}>
              One per UK business day.
            </div>
          </div>
          <MonoTag>From 13 Jun</MonoTag>
        </div>
      )}
      <div style={{ marginTop: 22, display: "grid", gap: 10 }}>
        <InkButton full variant="dark" onClick={() => patch({ step: "card" })}>
          Back to my card
        </InkButton>
        <div style={{ textAlign: "center" }}>
          <DemoTag onClick={() => patch({ stampedToday: false, step: "card" })}>
            Skip to tomorrow
          </DemoTag>
        </div>
      </div>
    </div>
  )
}
```

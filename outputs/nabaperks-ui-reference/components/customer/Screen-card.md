# Screen-card

- **Surface:** customer-web (CustomerFlow state `card`)
- **Source module:** [extracted-source/30-customer.jsx](../../extracted-source/30-customer.jsx) (lines 315–354)
- **Export:** none (render branch of `CustomerFlow`)
- **Reuse verdict:** 🔒 Prototype-only (faked stamp via staff PIN sheet, cross-surface demo jump)

## Visual purpose

The customer's home card — the screen they return to between visits. A header with "Your card" and a saved/unsaved `MonoTag`, the shared receipt with an inset dashed "Mystery reward, sealed" panel (a rotated `?` disc plus a "N more visits" counter), then a dark primary "I'm at the counter — stamp it", a conditional "Today's stamp is on" note, a conditional "Save this card" ghost link, and a "See what staff see" demo tag.

## Props / state

Reads `mo`, `saved` (toggles the header tag and the save link), `visits` (drives the `3 - visits` counter and `visit`/`visits` pluralisation), `stampedToday` (shows the "one per day" note), plus `cardBody` internals. Buttons: `requestStamp`, `patch({ step: "save" })`, and `go("Staff", "pin")`.

## UX behaviour

- Entered from many places: "Maybe later"/"Skip for now", OTP success, "Back to my card" (from `alreadyStamped` / `redeemed`), or the `card` preset.
- "I'm at the counter — stamp it" → `requestStamp()`: if `stampedToday`, jumps to `alreadyStamped`; otherwise opens the stamp `Sheet`. Completing it (`doStamp`) bumps `visits` and, once it reaches 3, schedules `sealed` after `1100 * mo`.
- "Save this card" (only when `!saved`) → `save`.
- "See what staff see" `DemoTag` → `go("Staff", "pin")` (cross-surface demo navigation — prototype-ism).
- Entrance via `w-rise`.

## Dependencies

- **Internal:** `cardBody`, `requestStamp`, `go`.
- **Shared primitives:** `MonoTag`, `InkButton`, `GhostLink`, `DemoTag`, `MonoLine`, plus (via `cardBody`) `ReceiptCard`, `ReceiptRule`, `StampRow`, `ProgressLine`, `VenueMark`.
- **CSS variables:** `--w-r`, `--w-line`, `--w-sun`, `--w-ink`, `--w-ink-soft`.
- **Keyframes:** `w-rise`.
- **localStorage:** `v3_customer`.

## Reuse notes

This is the natural "card home" reference. The stamp action routes through a staff `PinPad` (handed phone), which contradicts the production v3 counter-handshake model — reuse the layout and copy, not the verification mechanic. The "See what staff see" jump is a demo affordance only.

## Source snippet

```jsx
if (step === "card") {
  body = (
    <div
      data-screen-label="Customer · Card"
      style={{ animation: `w-rise ${380 * mo}ms both` }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          margin: "4px 0 18px",
        }}
      >
        <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>Your card</h1>
        <MonoTag tone={saved ? "ink" : "plain"}>
          {saved ? "Saved" : "Unsaved"}
        </MonoTag>
      </div>
      {cardBody(
        <div
          style={{
            marginTop: 14,
            padding: "12px 14px",
            borderRadius: "var(--w-r)",
            border: "2px dashed var(--w-line)",
            display: "flex",
            gap: 12,
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "var(--w-sun)",
              border: "2px solid var(--w-ink)",
              display: "grid",
              placeItems: "center",
              fontWeight: 800,
              fontSize: 19,
              transform: "rotate(-6deg)",
              flexShrink: 0,
            }}
          >
            ?
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14.5 }}>
              Mystery reward, sealed
            </div>
            <div style={{ fontSize: 13, color: "var(--w-ink-soft)" }}>
              {3 - visits} more {3 - visits === 1 ? "visit" : "visits"} to break
              it open.
            </div>
          </div>
        </div>
      )}
      <div style={{ marginTop: 22, display: "grid", gap: 10 }}>
        <InkButton full variant="dark" onClick={requestStamp}>
          I'm at the counter — stamp it
        </InkButton>
        {stampedToday && (
          <MonoLine style={{ textAlign: "center", fontSize: 10 }}>
            Today's stamp is on · one per day
          </MonoLine>
        )}
        {!saved && (
          <GhostLink onClick={() => patch({ step: "save" })}>
            Save this card
          </GhostLink>
        )}
        <div style={{ textAlign: "center" }}>
          <DemoTag onClick={() => go("Staff", "pin")}>
            See what staff see
          </DemoTag>
        </div>
      </div>
    </div>
  )
}
```

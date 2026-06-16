# Screen-save

- **Surface:** customer-web (CustomerFlow state `save`)
- **Source module:** [extracted-source/30-customer.jsx](../../extracted-source/30-customer.jsx) (lines 258–287)
- **Export:** none (render branch of `CustomerFlow`)
- **Reuse verdict:** 🔒 Prototype-only (input is collected but never validated or sent)

## Visual purpose

The "keep your card" screen. Headline "Keep your card", a reassuring paragraph ("One text, no password"), then a `ReceiptCard` containing a labelled mobile-number text input (mono font, paper background, ink border) and a primary "Text me the code" button. Below the card a ghost "Skip for now".

## Props / state

Reads `mo` and local `phone` (the controlled input value). Writes `phone` via `setPhone`. Buttons call `patch({ step: "otp" })` and `patch({ step: "card" })`.

## UX behaviour

- Entered from `firstStamp` ("Keep my card") or `card` ("Save this card"); also via the `save` preset.
- Input: `inputMode="tel"`, placeholder `07123 456789`. No validation — any value (or none) advances.
- "Text me the code" → `otp` (no real SMS is sent — prototype-ism). "Skip for now" → `card`.
- Entrance via `w-rise`.

## Dependencies

- **Internal:** none beyond local state.
- **Shared primitives:** `ReceiptCard`, `MonoLine`, `InkButton`, `GhostLink`.
- **CSS variables:** `--w-ink-soft`, `--w-mono`, `--w-ink`, `--w-paper`, `--w-r`.
- **Keyframes:** `w-rise`.
- **localStorage:** `v3_customer` (note: the typed phone number is **not** persisted — only `step/visits/saved/dayReady/stampedToday` are written).

## Reuse notes

The phone field accepts UK-style `07…` formatting visually but does no normalisation; production would accept `07…`, store E.164, and call Twilio Verify. The "one text, no password" copy matches the real phone-first identity model.

## Source snippet

```jsx
if (step === "save") {
  body = (
    <div
      data-screen-label="Customer · Save card"
      style={{ animation: `w-rise ${380 * mo}ms both` }}
    >
      <div style={{ textAlign: "center", margin: "6px 0 24px" }}>
        <h1
          style={{
            fontSize: 30,
            fontWeight: 800,
            lineHeight: 1.08,
            margin: "10px 0",
          }}
        >
          Keep your card
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
          One text, no password. Your stamp is already on the card.
        </p>
      </div>
      <ReceiptCard mo={mo}>
        <MonoLine style={{ marginBottom: 8 }}>Mobile number</MonoLine>
        <input
          value={phone}
          inputMode="tel"
          placeholder="07123 456789"
          onChange={(e) => setPhone(e.target.value)}
          style={{
            width: "100%",
            padding: "14px 16px",
            fontSize: 18,
            fontFamily: "var(--w-mono)",
            color: "var(--w-ink)",
            background: "var(--w-paper)",
            border: "2px solid var(--w-ink)",
            borderRadius: "var(--w-r)",
            outline: "none",
          }}
        />
        <div style={{ marginTop: 14 }}>
          <InkButton full onClick={() => patch({ step: "otp" })}>
            Text me the code
          </InkButton>
        </div>
      </ReceiptCard>
      <div style={{ textAlign: "center", marginTop: 12 }}>
        <GhostLink onClick={() => patch({ step: "card" })}>
          Skip for now
        </GhostLink>
      </div>
    </div>
  )
}
```

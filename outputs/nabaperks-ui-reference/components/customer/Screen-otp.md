# Screen-otp

- **Surface:** customer-web (CustomerFlow state `otp`)
- **Source module:** [extracted-source/30-customer.jsx](../../extracted-source/30-customer.jsx) (lines 289–313)
- **Export:** none (render branch of `CustomerFlow`)
- **Reuse verdict:** 🔒 Prototype-only (no real verification; dev autofill code)

## Visual purpose

The verification screen. Headline "Enter the code", a sub-line echoing the destination number and a 10-minute expiry, the `OtpBoxes` six-digit entry, then a primary "Save my card" (disabled until six digits), a `DemoTag` "Autofill code", and a rate-limit footnote.

## Props / state

Reads `mo`, local `phone` (echoed in the sub-line, falling back to `07123 456789`), and local `otp`. Derives `const done = otp.length === 6`. Writes `otp` via `setOtp`. The primary button calls `patch({ saved: true, step: "card" })`.

## UX behaviour

- Entered from `save` ("Text me the code"); also via the `otp` preset.
- `OtpBoxes` drives `otp`; the button is `disabled={!done}` (enabled at exactly 6 digits).
- "Save my card" → sets `saved: true` and `step: "card"`. No code is actually checked — any 6 digits pass (prototype-ism).
- **Dev OTP:** `DemoTag` "Autofill code" calls `setOtp("482915")` — the mock one-time code baked into the prototype.
- Entrance via `w-rise`.

## Dependencies

- **Internal:** none beyond local state.
- **Shared primitives:** `OtpBoxes`, `InkButton`, `DemoTag`, `MonoLine`.
- **CSS variables:** `--w-ink-soft`.
- **Keyframes:** `w-rise`.
- **localStorage:** `v3_customer` (writes `saved:true` on success).

## Reuse notes

Verification is entirely faked: there is no SMS round-trip and the code is never validated against anything — `"482915"` is a hardcoded autofill convenience. The "limited to five each quarter hour" footnote is illustrative. Production wires this to Twilio Verify and a signed session cookie.

## Source snippet

```jsx
if (step === "otp") {
  const done = otp.length === 6
  body = (
    <div
      data-screen-label="Customer · Verify code"
      style={{ animation: `w-rise ${380 * mo}ms both` }}
    >
      <div style={{ textAlign: "center", margin: "6px 0 24px" }}>
        <h1 style={{ fontSize: 30, fontWeight: 800, margin: "10px 0" }}>
          Enter the code
        </h1>
        <p style={{ fontSize: 15, color: "var(--w-ink-soft)", margin: 0 }}>
          Sent to {phone || "07123 456789"} · expires in 10 min
        </p>
      </div>
      <OtpBoxes value={otp} onChange={setOtp} />
      <div style={{ display: "grid", gap: 10, marginTop: 24 }}>
        <InkButton
          full
          disabled={!done}
          onClick={() => patch({ saved: true, step: "card" })}
        >
          Save my card
        </InkButton>
        <div style={{ textAlign: "center" }}>
          <DemoTag onClick={() => setOtp("482915")}>Autofill code</DemoTag>
        </div>
        <MonoLine style={{ textAlign: "center", fontSize: 10 }}>
          Texts are limited to five each quarter hour — plenty for one card
        </MonoLine>
      </div>
    </div>
  )
}
```

# Screen-redeemed

- **Surface:** customer-web (CustomerFlow state `redeemed`)
- **Source module:** [extracted-source/30-customer.jsx](../../extracted-source/30-customer.jsx) (lines 470–487)
- **Export:** none (render branch of `CustomerFlow`)
- **Reuse verdict:** 🔒 Prototype-only (reset loops back to a fresh card client-side)

## Visual purpose

The closing beat after a reward is redeemed. A large `VenueMark` stamped with a `✓` tick (caption "12 JUN 2026", leaf-green, slammed in via `w-slam`), the headline "Enjoy.", a "the card starts again" line, and a dark "Back to my card" button. Centred layout.

## Props / state

Reads `mo`. The button calls `patch({ visits: 0, dayReady: false, step: "card" })` — restarting the loyalty card from zero stamps.

## UX behaviour

- Entered via `doRedeem` (from the `ready` screen's redeem sheet); also via the `redeemed` preset.
- "Back to my card" → resets `visits` to 0, clears `dayReady`, and returns to `card`, so the next cycle begins ("same deal, next visit").
- Entrance via `w-pop`; the tick mark animates in with `w-slam`.

## Dependencies

- **Internal:** none beyond `patch`.
- **Shared primitives:** `VenueMark`, `InkButton`.
- **CSS variables:** `--w-ink-soft`, `--w-leaf`.
- **Keyframes:** `w-pop` (entrance), `w-slam` (tick slam).
- **localStorage:** `v3_customer` (writes `visits:0, dayReady:false`).

## Reuse notes

The "card starts again" loop is a real product behaviour; here it's a client-side `visits: 0` reset with no server redemption record. The redeemed date ("12 JUN 2026") is hardcoded.

## Source snippet

```jsx
if (step === "redeemed") {
  body = (
    <div
      data-screen-label="Customer · Redeemed"
      style={{ animation: `w-pop ${420 * mo}ms both`, textAlign: "center" }}
    >
      <div style={{ margin: "12px 0 20px" }}>
        <div
          style={{
            display: "inline-block",
            animation: `w-slam ${420 * mo}ms cubic-bezier(0.16,1.2,0.3,1) both`,
          }}
        >
          <VenueMark
            size={110}
            initials="✓"
            caption="12 JUN 2026"
            color="var(--w-leaf)"
            angle={-6}
          />
        </div>
      </div>
      <h1 style={{ fontSize: 32, fontWeight: 800, margin: "0 0 8px" }}>
        Enjoy.
      </h1>
      <p
        style={{ fontSize: 15, color: "var(--w-ink-soft)", margin: "0 0 26px" }}
      >
        The card starts again — same deal, next visit.
      </p>
      <InkButton
        full
        variant="dark"
        onClick={() => patch({ visits: 0, dayReady: false, step: "card" })}
      >
        Back to my card
      </InkButton>
    </div>
  )
}
```

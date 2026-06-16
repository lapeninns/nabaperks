# Screen-revealed

- **Surface:** customer-web (CustomerFlow state `revealed`)
- **Source module:** [extracted-source/30-customer.jsx](../../extracted-source/30-customer.jsx) (lines 417–468)
- **Export:** none (render branch of `CustomerFlow`)
- **Reuse verdict:** 🔒 Prototype-only (reward hardcoded; "Skip to tomorrow" demo jump)

## Visual purpose

The payoff: the seal is broken and the reward is named. Confetti (`CelebrationBits`), an accent `MonoTag` "Unsealed", a big "Free flat white" headline, a thank-you line, and a `ReceiptCard` with a large `VenueMark` (reward Nº RW-8821). **In the `revealed` (not-yet-ready) form**, the card shows a plain `MonoTag` "Redeemable from tomorrow" with cooldown copy, and the only action is a "Skip to tomorrow" demo tag. (This branch is shared with `ready` — see [Screen-ready.md](./Screen-ready.md) for the redeemable form.)

## Props / state

This single branch handles `step === "revealed" || step === "ready"`. It computes `const isReady = step === "ready" || dayReady;`. For the **`revealed`** state, `isReady` is `false` (the `revealed` preset has `dayReady:false`), so:

- `CelebrationBits` renders (only `step === "revealed"` triggers it).
- `VenueMark` colour is `var(--w-ink-soft)`.
- The "Redeemable from tomorrow" branch shows.
  Reads `mo`, `t.celebration` (`"Ripple"` else `"Burst"`), `dayReady`, `step`.

## UX behaviour

- Entered when the `Seal` on `sealed` is broken (`onBroken → step: "revealed"`); also via the `revealed` preset.
- Entrance via `w-pop` (not `w-rise`).
- "Skip to tomorrow" `DemoTag` → `patch({ dayReady: true, stampedToday: false, step: "ready" })`, flipping into the redeemable `ready` form (prototype time-skip).

## Dependencies

- **Internal:** none beyond `patch`.
- **Shared primitives:** `CelebrationBits`, `MonoTag`, `ReceiptCard`, `VenueMark`, `ReceiptRule`, `DemoTag` (and `InkButton` in the shared `ready` half).
- **CSS variables:** `--w-ink-soft`, `--w-leaf` (used by the `ready` half).
- **Keyframes:** `w-pop` (entrance); `CelebrationBits` consumes `w-confetti`/`w-splat`.
- **localStorage:** `v3_customer`.

## Reuse notes

The reveal celebration is a brand highlight. Note the deliberate cooldown ("Give it a day to breathe") before a reward becomes redeemable — a real product rule expressed here purely via the `dayReady` flag and a demo skip. Reward name ("Free flat white") and number (`RW-8821`) are hardcoded.

## Source snippet

Full shared branch (the `revealed` path is the `!isReady` side; the `ready` path is documented in [Screen-ready.md](./Screen-ready.md)).

```jsx
if (step === "revealed" || step === "ready") {
  const isReady = step === "ready" || dayReady
  body = (
    <div
      data-screen-label={
        isReady ? "Customer · Reward ready" : "Customer · Revealed"
      }
      style={{
        animation: `w-pop ${420 * mo}ms cubic-bezier(0.16,1.2,0.3,1) both`,
        position: "relative",
      }}
    >
      {step === "revealed" && (
        <CelebrationBits
          type={t.celebration === "Ripple" ? "Ripple" : "Burst"}
          mo={mo}
          seed={9}
        />
      )}
      <div style={{ textAlign: "center", margin: "6px 0 20px" }}>
        <MonoTag tone="accent">Unsealed</MonoTag>
        <h1
          style={{
            fontSize: 36,
            fontWeight: 800,
            lineHeight: 1.02,
            margin: "16px 0 8px",
          }}
        >
          Free flat white
        </h1>
        <p style={{ fontSize: 15, color: "var(--w-ink-soft)", margin: 0 }}>
          From the Old Crown, with thanks.
        </p>
      </div>
      <ReceiptCard mo={mo}>
        <div style={{ textAlign: "center", padding: "6px 0" }}>
          <VenueMark
            size={84}
            caption="Nº RW-8821"
            initials="✱"
            color={isReady ? "var(--w-leaf)" : "var(--w-ink-soft)"}
          />
          <ReceiptRule />
          {isReady ? (
            <div>
              <MonoTag tone="ink">Ready to redeem</MonoTag>
              <p
                style={{
                  fontSize: 14,
                  color: "var(--w-ink-soft)",
                  margin: "12px 0 0",
                }}
              >
                Show this at the counter. Staff redeem it once with their PIN.
              </p>
            </div>
          ) : (
            <div>
              <MonoTag>Redeemable from tomorrow</MonoTag>
              <p
                style={{
                  fontSize: 14,
                  color: "var(--w-ink-soft)",
                  margin: "12px 0 0",
                }}
              >
                Give it a day to breathe — it's yours from opening time
                tomorrow.
              </p>
            </div>
          )}
        </div>
      </ReceiptCard>
      <div style={{ marginTop: 22, display: "grid", gap: 10 }}>
        {isReady ? (
          <InkButton
            full
            onClick={() => {
              setSheetPurpose("redeem")
              setSheetOpen(true)
            }}
          >
            Staff: redeem this reward
          </InkButton>
        ) : (
          <div style={{ textAlign: "center" }}>
            <DemoTag
              onClick={() =>
                patch({ dayReady: true, stampedToday: false, step: "ready" })
              }
            >
              Skip to tomorrow
            </DemoTag>
          </div>
        )}
      </div>
    </div>
  )
}
```

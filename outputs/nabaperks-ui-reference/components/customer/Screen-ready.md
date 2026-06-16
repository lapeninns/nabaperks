# Screen-ready

- **Surface:** customer-web (CustomerFlow state `ready`)
- **Source module:** [extracted-source/30-customer.jsx](../../extracted-source/30-customer.jsx) (lines 417–468)
- **Export:** none (render branch of `CustomerFlow`)
- **Reuse verdict:** 🔒 Prototype-only (redeem via staff PIN sheet; reward hardcoded)

## Visual purpose

The redeemable form of the reward screen — the next day, after the cooldown. Shares the `revealed` render branch but with `isReady === true`: the screen label is "Customer · Reward ready", the `VenueMark` turns leaf-green, the card shows an ink `MonoTag` "Ready to redeem" with "Show this at the counter…" copy, and the action becomes a primary "Staff: redeem this reward". No confetti (that only fires on `revealed`).

## Props / state

Same shared branch as [Screen-revealed.md](./Screen-revealed.md), keyed on `const isReady = step === "ready" || dayReady;`. For the `ready` state `isReady` is `true` (the `ready` preset has `dayReady:true, stampedToday:false`). Reads `mo`. The primary button calls `setSheetPurpose("redeem")` + `setSheetOpen(true)`.

## UX behaviour

- Entered from `revealed` via "Skip to tomorrow" (`dayReady:true, stampedToday:false, step:"ready"`); also via the `ready` preset. (`revealed` rendered while `dayReady` was already true would also show this form, but no in-flow path sets that.)
- "Staff: redeem this reward" → opens the `Sheet` with `sheetPurpose: "redeem"`. Completing it runs `doRedeem` → `redeemed`.
- Entrance via `w-pop`.

## Dependencies

- **Internal:** `setSheetPurpose`, `setSheetOpen` (→ `Sheet` → `PinPad` → `doRedeem`).
- **Shared primitives:** `MonoTag`, `ReceiptCard`, `VenueMark`, `ReceiptRule`, `InkButton` (and the sheet's `PinPad`).
- **CSS variables:** `--w-ink-soft`, `--w-leaf`.
- **Keyframes:** `w-pop`.
- **localStorage:** `v3_customer`.

## Reuse notes

The redeem action goes through the staff `PinPad` sheet ("Staff redeem it once with their PIN"), which reflects the prototype's handed-phone model rather than production's counter handshake. The reward name/number are hardcoded. See [Screen-revealed.md](./Screen-revealed.md) for the full shared source branch.

## Source snippet

The redeemable (`isReady`) half of the shared `revealed`/`ready` branch (full branch in [Screen-revealed.md](./Screen-revealed.md)).

```jsx
// inside: if (step === "revealed" || step === "ready") { const isReady = step === "ready" || dayReady; …
<VenueMark size={84} caption="Nº RW-8821" initials="✱" color={isReady ? "var(--w-leaf)" : "var(--w-ink-soft)"} />
<ReceiptRule />
{isReady ? (
  <div>
    <MonoTag tone="ink">Ready to redeem</MonoTag>
    <p style={{ fontSize: 14, color: "var(--w-ink-soft)", margin: "12px 0 0" }}>
      Show this at the counter. Staff redeem it once with their PIN.
    </p>
  </div>
) : ( /* … Redeemable from tomorrow … */ )}
// …
{isReady ? (
  <InkButton full onClick={() => { setSheetPurpose("redeem"); setSheetOpen(true); }}>
    Staff: redeem this reward
  </InkButton>
) : ( /* … Skip to tomorrow demo tag … */ )}
```

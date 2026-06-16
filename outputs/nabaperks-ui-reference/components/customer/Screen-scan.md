# Screen-scan

- **Surface:** customer-web (CustomerFlow state `scan`)
- **Source module:** [extracted-source/30-customer.jsx](../../extracted-source/30-customer.jsx) (line 214–216)
- **Export:** none (render branch of `CustomerFlow`)
- **Reuse verdict:** 🔒 Prototype-only (faked camera/QR via timers)

## Visual purpose

The opening state. Delegates entirely to `CuScanView` — a mock phone-camera viewfinder that pretends to find the till QR, then auto-advances to `landing`. See [CuScanView.md](./CuScanView.md) for the full screen.

## Props / state

Reads only `mo` (`= t.mo`). The branch passes `onDone={() => patch({ step: "landing" })}`. The `cu` flags (`visits/saved/dayReady/stampedToday`) are not read here.

## UX behaviour

- Initial state from `CU_FALLBACK`, or re-entered via `reset()` ("Restart flow").
- `CuScanView` auto-advances after ~1500·mo, or immediately on tap/scrim — both call `onDone`, setting `step: "landing"`.

## Dependencies

- **Internal:** `CuScanView`.
- **Shared primitives:** (via `CuScanView`) `MonoTag`, `MonoLine`, `VenueMark`, plus `QrBlock` (unclear from source).
- **CSS variables / keyframes:** see `CuScanView` (`w-rise`, `w-ripple`, `w-pop`).
- **localStorage:** `v3_customer` (parent persists `step`).

## Reuse notes

Thin wrapper around the scan mock; reuse considerations live in [CuScanView.md](./CuScanView.md).

## Source snippet

```jsx
if (step === "scan") {
  body = <CuScanView mo={mo} onDone={() => patch({ step: "landing" })} />
}
```

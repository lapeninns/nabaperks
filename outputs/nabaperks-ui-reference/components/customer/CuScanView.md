# CuScanView

- **Surface:** customer-web (scan screen, internal to the customer flow)
- **Source module:** [extracted-source/30-customer.jsx](../../extracted-source/30-customer.jsx) (lines 29–123)
- **Export:** none — module-internal function, rendered by `CustomerFlow` for `step === "scan"`. Not assigned to `window`.
- **Reuse verdict:** 🔒 Prototype-only (timer-driven fake scan, hardcoded venue/QR copy, inline styles, no real camera or QR decode)

## Visual purpose

A mock phone-camera viewfinder for the "scan the till card" moment. A dark (`--w-ink`) framed rectangle holds camera chrome (a "Camera" label, a fake date), four corner brackets, two searching ripples, and a small rotated till card showing the venue mark, the offer, and a `QrBlock`. After a short delay the prototype "finds" the code: the ripples stop, a leaf-green border snaps around the QR, a "QR found" pop tag appears, and the status copy switches to the resolved URL. It is purely theatrical — there is no camera access and no QR decoding.

## Props / state

| Prop     | Type         | Default | Notes                                                                                                                                                                            |
| -------- | ------------ | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `mo`     | `number`     | —       | Motion multiplier (passed down from `CustomerFlow` as `t.mo`). Scales every timeout and animation duration.                                                                      |
| `onDone` | `() => void` | —       | Called when the auto-advance timer fires, on tap of the whole view (`onClick={onDone}`), and via the rendered scrim. In `CustomerFlow` it is `() => patch({ step: "landing" })`. |

**State:** `const [locked, setLocked] = useStateCu(false)` — flips to `true` once the first timer fires; drives the "found it" visuals (accent tag, green QR border, pop tag, resolved URL/status copy).

## UX behaviour

- On mount, two timers are set (prototype-ism — `setTimeout` mocks, both scaled by `mo`):
  - `setTimeout(() => setLocked(true), 820 * mo)` — after ~820 ms the view shows the "found" state.
  - `setTimeout(() => onDone && onDone(), 1500 * mo)` — after ~1500 ms it auto-advances to `landing`.
  - Both are cleared on unmount (`return () => { clearTimeout(a); clearTimeout(b); }`).
- Whole surface is clickable (`cursor: "pointer"`, `onClick={onDone}`) so the user can "tap to skip" before the auto-advance fires.
- Status line copy: `"Looking for a code… · tap to skip"` before lock, `"nabaperks.app/q/oc-0248"` after lock (hardcoded resolved QR URL — prototype-ism).
- Top tag copy: `"Point your camera at the till card"` (tone `ink`) → `"Found it — opening your card"` (tone `accent`).
- Entrance via `w-rise` keyframe scaled by `mo`.

## Dependencies

- **Shared primitives (window globals):** `MonoTag`, `MonoLine`, `VenueMark`. Also `QrBlock` (referenced on line 98) — a fake QR block; **unclear from source** within this file (not in the supplied shared-primitives list and not defined in `30-customer.jsx`).
- **CSS variables:** `--w-ink`, `--w-card`, `--w-r`, `--w-shadow`, `--w-leaf`.
- **Keyframes:** `w-rise` (entrance), `w-ripple` (searching circles), `w-pop` ("QR found" tag).
- **localStorage:** none directly (the parent persists state).
- **Globals / window:** reads `React` (destructured as `useStateCu`/`useEffectCu`).

## Reuse notes

This is a presentational stage prop, not a scanner. The "lock then advance" choreography and the corner-bracket viewfinder framing are worth keeping as a visual reference for a real camera/QR screen, but every behaviour here is faked: fixed timers stand in for QR detection, the venue ("The Old Crown · Bristol"), offer ("Free hot drink after 3 visits") and resolved URL (`nabaperks.app/q/oc-0248`) are hardcoded, and there is no camera permission, error, or empty state. The "Scans are rate-limited to 60 a minute" footnote is illustrative copy only. For production, replace with a real QR resolver hitting `/q/[qrId]` and lift the styling out of inline objects.

## Source snippet

```jsx
function CuScanView({ mo, onDone }) {
  const [locked, setLocked] = useStateCu(false)
  useEffectCu(() => {
    const a = setTimeout(() => setLocked(true), 820 * mo)
    const b = setTimeout(() => onDone && onDone(), 1500 * mo)
    return () => {
      clearTimeout(a)
      clearTimeout(b)
    }
  }, [])

  const edge = "3px solid rgba(246,241,230,0.92)"
  const corner = {
    position: "absolute",
    width: 34,
    height: 34,
    pointerEvents: "none",
  }
  const chrome = { color: "rgba(246,241,230,0.55)", fontSize: 10 }

  return (
    <div
      data-screen-label="Customer · Scan"
      onClick={onDone}
      style={{
        animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both`,
        cursor: "pointer",
      }}
    >
      <div style={{ textAlign: "center", margin: "2px 0 16px" }}>
        <MonoTag tone={locked ? "accent" : "ink"}>
          {locked
            ? "Found it — opening your card"
            : "Point your camera at the till card"}
        </MonoTag>
      </div>

      <div
        style={{
          position: "relative",
          background: "var(--w-ink)",
          border: "2px solid var(--w-ink)",
          borderRadius: 18,
          height: 468,
          overflow: "hidden",
          boxShadow: "var(--w-shadow)",
          display: "grid",
          placeItems: "center",
        }}
      >
        {/* camera chrome */}
        <div
          style={{
            position: "absolute",
            top: 14,
            left: 20,
            right: 20,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <MonoLine style={chrome}>Camera</MonoLine>
          <MonoLine style={chrome}>Thu 12 Jun</MonoLine>
        </div>

        {/* corner brackets */}
        <div
          style={{
            ...corner,
            top: 40,
            left: 18,
            borderTop: edge,
            borderLeft: edge,
            borderTopLeftRadius: 10,
          }}
        ></div>
        <div
          style={{
            ...corner,
            top: 40,
            right: 18,
            borderTop: edge,
            borderRight: edge,
            borderTopRightRadius: 10,
          }}
        ></div>
        <div
          style={{
            ...corner,
            bottom: 44,
            left: 18,
            borderBottom: edge,
            borderLeft: edge,
            borderBottomLeftRadius: 10,
          }}
        ></div>
        <div
          style={{
            ...corner,
            bottom: 44,
            right: 18,
            borderBottom: edge,
            borderRight: edge,
            borderBottomRightRadius: 10,
          }}
        ></div>

        {/* searching ripples behind the card */}
        {!locked &&
          [0, 1].map((i) => (
            <div
              key={i}
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 90,
                height: 90,
                marginLeft: -45,
                marginTop: -45,
                border: "2.5px solid rgba(246,241,230,0.4)",
                borderRadius: "50%",
                animation: `w-ripple ${1500 * mo}ms ${i * 500 * mo}ms cubic-bezier(0.2,0,0,1) infinite`,
                opacity: 0,
              }}
            ></div>
          ))}

        {/* the till card in frame */}
        <div
          style={{
            position: "relative",
            width: 234,
            background: "var(--w-card)",
            border: "2px solid var(--w-ink)",
            borderRadius: "var(--w-r)",
            padding: "14px 16px 14px",
            textAlign: "center",
            transform: "rotate(-3deg)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <VenueMark size={36} angle={-8} />
            <div style={{ textAlign: "left" }}>
              <MonoLine style={{ fontSize: 9 }}>
                The Old Crown · Bristol
              </MonoLine>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: 13.5,
                  lineHeight: 1.12,
                  marginTop: 2,
                }}
              >
                Free hot drink after 3 visits
              </div>
            </div>
          </div>
          <div
            style={{
              display: "inline-block",
              marginTop: 10,
              padding: 6,
              borderRadius: 8,
              border: `3px solid ${locked ? "var(--w-leaf)" : "transparent"}`,
              transition: `border-color ${180 * mo}ms`,
            }}
          >
            <QrBlock size={110} />
          </div>
          <MonoLine style={{ fontSize: 8.5, marginTop: 8 }}>
            Scan to join · no app, no plastic
          </MonoLine>
          {locked && (
            <div
              style={{
                position: "absolute",
                left: "50%",
                bottom: -14,
                transform: "translateX(-50%)",
                animation: `w-pop ${320 * mo}ms cubic-bezier(0.16,1.2,0.3,1) both`,
              }}
            >
              <MonoTag tone="accent">QR found</MonoTag>
            </div>
          )}
        </div>

        {/* status line */}
        <div
          style={{
            position: "absolute",
            bottom: 16,
            left: 0,
            right: 0,
            textAlign: "center",
          }}
        >
          <MonoLine style={chrome}>
            {locked
              ? "nabaperks.app/q/oc-0248"
              : "Looking for a code… · tap to skip"}
          </MonoLine>
        </div>
      </div>
      <MonoLine style={{ textAlign: "center", marginTop: 14, fontSize: 10 }}>
        Scans are rate-limited to 60 a minute — a busy counter is fine
      </MonoLine>
    </div>
  )
}
```

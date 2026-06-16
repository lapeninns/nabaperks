# StPinPeek

- **Surface:** staff (counter station)
- **Source module:** [extracted-source/22-staff-counter.jsx](../../extracted-source/22-staff-counter.jsx) (lines 54–82)
- **Export:** none (module-local; rendered only inside `StaffSurface`'s idle screen).
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles; PIN value `"7312"` hardcoded in the JSX; module-local with no export).

## Visual purpose

The "today's PIN" widget shown on the idle counter screen. The PIN sits masked as four dots inside a dark `StPanel`; staff **press and hold** to peek the real code, which flips to the sun (yellow) accent while held and reverts on release. A `VenueMark` stamped "STAFF ONLY" sits to the right and shares the peek highlight.

## Props / state

| Prop   | Type | Default | Notes           |
| ------ | ---- | ------- | --------------- |
| _none_ | —    | —       | Takes no props. |

**State:** `const [peek, setPeek] = useStateSt(false)` — true only while a pointer is held on the PIN digits.

## UX behaviour

- **Hold to peek (pointer-driven):** `onPointerDown` → `peek=true`; `onPointerUp` and `onPointerLeave` → `peek=false`. Same press-and-release idiom as the masked PIN reveal elsewhere in the system.
- Masked display shows `"●●●●"`; on peek it swaps to the literal `"7312"`.
- While peeking, the digit colour goes `var(--w-paper)` → `var(--w-sun)` over a `120ms` colour transition, and the `VenueMark` colour switches from `ST_DIM` to `var(--w-sun)`.
- Helper copy under the digits also swaps: idle → `"Hold to peek · rotates nightly at 04:00"`; peeking → `"Keep it off the till roll"`.
- `userSelect: "none"` and `touchAction: "none"` on the digit block keep the hold gesture from selecting text or scrolling.

## Dependencies

- **Shared primitives:** `MonoLine`, `VenueMark`. Renders inside the local `StPanel`.
- **CSS variables:** `--w-mono`, `--w-paper`, `--w-sun`. (Also `--w-ink` indirectly, via `StPanel`.) Uses the module-local `ST_DIM` tone for de-emphasised text.
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** reads `React` (destructured `useState` as `useStateSt`).

## Reuse notes

The hold-to-peek interaction is a genuinely nice, reusable pattern for revealing a secret on a shared screen and worth preserving as a reference. Caveats for production: (1) the PIN value `"7312"` is hardcoded literally in the JSX — a real station would receive the rotating PIN from the server (the copy even says it "rotates nightly at 04:00", and the locked-screen copy notes "Maya can reveal today's PIN from the merchant app"); (2) inline styles should move to the token / `data-slot` layer; (3) needs a real export. **v3 mechanic note:** this masked-PIN-on-the-station belongs to the v3 "counter handshake" — the code/PIN lives on the _paired station_ rather than being a shared staff PIN typed into a customer's handed-over phone — though within this same prototype the PIN-entry screen still shows the older handed-phone "Staff PIN" pad (see `StaffSurface.md`).

## Source snippet

```jsx
function StPinPeek() {
  const [peek, setPeek] = useStateSt(false)
  return (
    <StPanel style={{ padding: "18px 20px", marginTop: 14 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 14,
        }}
      >
        <div>
          <MonoLine style={{ color: ST_DIM }}>Today's PIN</MonoLine>
          <div
            onPointerDown={() => setPeek(true)}
            onPointerUp={() => setPeek(false)}
            onPointerLeave={() => setPeek(false)}
            style={{
              fontFamily: "var(--w-mono)",
              fontSize: 31,
              fontWeight: 700,
              letterSpacing: "0.32em",
              margin: "8px 0 4px",
              cursor: "pointer",
              userSelect: "none",
              touchAction: "none",
              color: peek ? "var(--w-sun)" : "var(--w-paper)",
              transition: "color 120ms",
            }}
          >
            {peek ? "7312" : "●●●●"}
          </div>
          <MonoLine style={{ fontSize: 10, color: ST_DIM }}>
            {peek
              ? "Keep it off the till roll"
              : "Hold to peek · rotates nightly at 04:00"}
          </MonoLine>
        </div>
        <VenueMark
          size={62}
          caption="STAFF ONLY"
          color={peek ? "var(--w-sun)" : ST_DIM}
        />
      </div>
    </StPanel>
  )
}
```

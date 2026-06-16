# StCardStrip

- **Surface:** staff (counter station)
- **Source module:** [extracted-source/22-staff-counter.jsx](../../extracted-source/22-staff-counter.jsx) (lines 86–97)
- **Export:** none (module-local; rendered only at the top of `StaffSurface`'s PIN-entry screen).
- **Reuse verdict:** 🔒 Prototype-only (every value — venue mark, card number, name, progress — is hardcoded; a real strip would be driven by the resolved card/membership).

## Visual purpose

A "whose phone is this?" context strip shown above the PIN pad during entry. It is a dark `StPanel` laid out as a row: a tilted `VenueMark`, then the card number (`Card Nº OC-0248`) over the customer name (`Asha K.`), then an accent `MonoTag` showing progress (`Stamp 2 of 3`). It reassures staff which customer's card they're about to stamp.

## Props / state

| Prop   | Type | Default | Notes                                   |
| ------ | ---- | ------- | --------------------------------------- |
| _none_ | —    | —       | Takes no props; all content is literal. |

**State:** none — pure presentational row.

## UX behaviour

- Static; no interaction.
- Layout: flex row, `gap: 14`, vertically centred; the name/number block is the flex child (`flex: 1, minWidth: 0`) so long values truncate rather than push the tag off-row.
- `VenueMark` is tilted `angle={-6}` and tinted `var(--w-paper)` to read on the dark panel.
- The progress tag uses `tone="accent"`.

## Dependencies

- **Shared primitives:** `VenueMark`, `MonoLine`, `MonoTag`. Renders inside the local `StPanel`.
- **CSS variables:** `--w-paper` (passed to `VenueMark`); ink/paper surface inherited from `StPanel`. Uses module-local `ST_DIM` for the de-emphasised card-number line.
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** none.

## Reuse notes

A real, useful pattern — show the customer context next to the stamp action — but the prototype hardcodes every field: card number `OC-0248`, name `Asha K.`, and progress `Stamp 2 of 3` are literals in the JSX, matching the demo's fixed `Asha K.` customer. For production it must take the resolved card / membership as props (number, display name, current/target stamp count) and move its inline styles to the token / `data-slot` layer. The truncation-safe row layout is sound and reusable. Note it sits inside the v3 PIN-entry screen, which is itself the _older_ handed-phone flow within this prototype (see `StaffSurface.md` for the v3 handshake caveat).

## Source snippet

```jsx
function StCardStrip() {
  return (
    <StPanel
      style={{
        padding: "15px 18px",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <VenueMark size={48} color="var(--w-paper)" angle={-6} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <MonoLine style={{ fontSize: 10, color: ST_DIM }}>
          Card Nº OC-0248
        </MonoLine>
        <div
          style={{
            fontWeight: 800,
            fontSize: 19,
            lineHeight: 1.1,
            marginTop: 3,
          }}
        >
          Asha K.
        </div>
      </div>
      <MonoTag tone="accent">Stamp 2 of 3</MonoTag>
    </StPanel>
  )
}
```

# AdStat

- **Surface:** admin (internal support console — local sub-primitive)
- **Source module:** [extracted-source/40-admin.jsx](../../extracted-source/40-admin.jsx) (lines 80–88)
- **Export:** none — module-local function, used only inside `40-admin.jsx`. Not on `window`.
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles, not exported)

## Visual purpose

A single KPI tile for the Overview tab: a big display-font number over a mono label and a smaller mono sub-line, on a hard-bordered `var(--w-paper-2)` block. Four of these sit in an auto-fit grid at the top of Overview (Live merchants / Members / Stamps this week / Rewards redeemed).

## Props / state

| Prop    | Type        | Default | Notes                                                                       |
| ------- | ----------- | ------- | --------------------------------------------------------------------------- |
| `value` | `ReactNode` | —       | The headline figure (34px `var(--w-display)`, weight 800, `lineHeight: 1`). |
| `label` | `ReactNode` | —       | Rendered inside `MonoLine` at full ink, weight 700.                         |
| `sub`   | `ReactNode` | —       | Rendered inside `MonoLine` at 10px (the muted caption).                     |

**State:** none.

## UX behaviour

- Static tile, no interaction. The `var(--w-paper-2)` fill is what visually separates the "stat" tiles from the white `var(--w-card)` panels around them.

## Dependencies

- **Shared primitives:** `MonoLine` (for both `label` and `sub`).
- **CSS variables:** `--w-paper-2`, `--w-ink`, `--w-r`, `--w-shadow-sm`, `--w-display`.
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** none (module-local).

## Reuse notes

Generic KPI/stat tile, fully portable. For production move the inline styles to the token layer and export it. Note `label` is styled to override `MonoLine`'s default colour to full `--w-ink` (weight 700) so the label reads stronger than the sub-caption.

## Source snippet

```jsx
function AdStat({ value, label, sub }) {
  return (
    <div
      style={{
        background: "var(--w-paper-2)",
        border: "2px solid var(--w-ink)",
        borderRadius: "var(--w-r)",
        padding: "16px 16px 14px",
        boxShadow: "var(--w-shadow-sm)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--w-display)",
          fontWeight: 800,
          fontSize: 34,
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      <MonoLine
        style={{ marginTop: 8, color: "var(--w-ink)", fontWeight: 700 }}
      >
        {label}
      </MonoLine>
      <MonoLine style={{ marginTop: 4, fontSize: 10 }}>{sub}</MonoLine>
    </div>
  )
}
```

## Hardcoded demo data (passed by callers in the Overview tab)

| value | label              | sub                                  |
| ----- | ------------------ | ------------------------------------ |
| `4`   | `Live merchants`   | `6 onboarded · 2 flagged below`      |
| `506` | `Members`          | `+38 this week, all venues`          |
| `962` | `Stamps this week` | `One per member per UK business day` |
| `41`  | `Rewards redeemed` | `Last 7 days · all venues`           |

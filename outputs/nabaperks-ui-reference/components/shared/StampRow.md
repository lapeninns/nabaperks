# StampRow

- **Surface:** shared (primitive)
- **Source module:** [extracted-source/10-primitives.jsx](../../extracted-source/10-primitives.jsx) (lines 232–241)
- **Export:** `window.StampRow` (global)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles, single-row flex with no wrap, global export)

## Visual purpose

The loyalty card face: a centred row of `StampDisc`s, `current` of `total` filled, optionally slamming a single index. The composition primitive that turns the per-slot `StampDisc` into a full punch-card.

## Props / state

| Prop          | Type                            | Default | Notes                                                          |
| ------------- | ------------------------------- | ------- | -------------------------------------------------------------- |
| `current`     | `number`                        | —       | Count of filled stamps; slot `i` is filled when `i < current`. |
| `total`       | `number`                        | —       | Number of slots rendered.                                      |
| `slamIndex`   | `number`                        | `-1`    | Index of the slot to animate as just-applied; `-1` = none.     |
| `celebration` | `"Slam" \| "Ripple" \| "Burst"` | —       | Passed through to the slammed `StampDisc`.                     |
| `mo`          | `number`                        | —       | Motion multiplier, passed through.                             |
| `size`        | `number`                        | `64`    | Disc size, passed through.                                     |
| `dates`       | `string[]`                      | `[]`    | Per-slot date labels; `dates[i]` passed to each disc.          |

**State:** none (stateless function component).

## UX behaviour

- `display: flex` with `gap: 14`, `justifyContent: center`.
- Maps `Array.from({ length: total })` to `StampDisc`, setting `filled={i < current}`, `slammed={i === slamIndex}`, and forwarding `celebration`/`mo`/`size`/`dates[i]`.
- No wrapping — long cards (high `total`) will overflow horizontally on a narrow column. Sizing is the caller's responsibility.

## Dependencies

- **Shared primitives:** `StampDisc` (one per slot).
- **CSS variables:** none directly (all visual styling lives in `StampDisc`).
- **Keyframes:** none directly (delegated to `StampDisc` / `CelebrationBits`).
- **localStorage:** none.
- **Globals / window:** reads `React`; writes itself to `window.StampRow`.

## Reuse notes

A clean composition primitive worth keeping. For production: (1) add wrapping or a layout strategy for cards with many stamps on the ≈410px column; (2) move the inline flex to the token/`data-slot` layer; (3) replace `window.*` with a module export. The `current`/`total`/`slamIndex` contract is portable. No state or timing mocks.

## Source snippet

```jsx
function StampRow({
  current,
  total,
  slamIndex = -1,
  celebration,
  mo,
  size = 64,
  dates = [],
}) {
  return (
    <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
      {Array.from({ length: total }, (_, i) => (
        <StampDisc
          key={i}
          index={i}
          filled={i < current}
          slammed={i === slamIndex}
          celebration={celebration}
          mo={mo}
          size={size}
          date={dates[i]}
        />
      ))}
    </div>
  )
}
```

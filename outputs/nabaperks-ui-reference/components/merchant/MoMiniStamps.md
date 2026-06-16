# MoMiniStamps

- **Surface:** merchant (local sub-primitive)
- **Source module:** [extracted-source/21-merchant-ops.jsx](../../extracted-source/21-merchant-ops.jsx) (lines 54–71)
- **Export:** local to module (not on `window`)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles)

## Visual purpose

A compact inline stamp-progress indicator for table rows. Renders `total` dots: filled dots are accent-coloured discs with the `✱` wordmark glyph (rotated -6°), empty dots are dashed `--w-line` circles. A small mono `current/total` count trails the row. Used in the Customers readback table.

## Props / state

| Prop      | Type     | Default | Notes                                                  |
| --------- | -------- | ------- | ------------------------------------------------------ |
| `current` | `number` | —       | How many dots are filled (first `current` of `total`). |
| `total`   | `number` | `3`     | Total dots rendered.                                   |

**State:** none (pure render).

## UX behaviour

- `display: "inline-flex", gap: 5, alignItems: "center"`.
- Filled disc: `18×18`, `borderRadius: "50%"`, `background: var(--w-accent)`, ink border, white `✱` at `fontSize: 9, fontWeight: 800, transform: "rotate(-6deg)"`.
- Empty disc: `18×18` with `border: "2px dashed var(--w-line)"`.
- Trailing count: `fontFamily: var(--w-mono), fontSize: 11.5, fontWeight: 700` showing `{current}/{total}`.

## Dependencies

- **Shared primitives:** none.
- **CSS variables:** `--w-accent`, `--w-ink`, `--w-line`, `--w-mono`.
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** reads `React` indirectly (JSX). Not exported.

## Reuse notes

A neat miniaturised cousin of the full `StampRow`/`StampDisc` primitives. For production: move styling to `data-slot`, and note the `✱` glyph is the brand disc/wordmark — keep it as the only emoji-like mark per the design rules. Portable as-is for a read-only mini progress chip.

## Source snippet

```jsx
function MoMiniStamps({ current, total = 3 }) {
  return (
    <div style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>
      {Array.from({ length: total }, (_, i) =>
        i < current ? (
          <span
            key={i}
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              background: "var(--w-accent)",
              border: "2px solid var(--w-ink)",
              display: "inline-grid",
              placeItems: "center",
              color: "#fff",
              fontSize: 9,
              fontWeight: 800,
              transform: "rotate(-6deg)",
            }}
          >
            ✱
          </span>
        ) : (
          <span
            key={i}
            style={{
              width: 18,
              height: 18,
              borderRadius: "50%",
              border: "2px dashed var(--w-line)",
              display: "inline-block",
            }}
          ></span>
        )
      )}
      <span
        style={{
          fontFamily: "var(--w-mono)",
          fontSize: 11.5,
          fontWeight: 700,
          marginLeft: 4,
        }}
      >
        {current}/{total}
      </span>
    </div>
  )
}
```

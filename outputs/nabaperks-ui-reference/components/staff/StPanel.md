# StPanel

- **Surface:** staff (counter station)
- **Source module:** [extracted-source/22-staff-counter.jsx](../../extracted-source/22-staff-counter.jsx) (lines 42–50)
- **Export:** none (module-local; consumed by `StPinPeek`, `StCardStrip`, and every `StaffSurface` screen).
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles; no token/`data-slot` layer; module-local with no export).

## Visual purpose

The dark "ink panel" that gives the staff station its mostly-dark look. It is the inverse of the customer paper card: an ink-on-paper block — ink background, paper text, ink border, 16px radius — sized for the till. Every staff screen (idle counter, PIN entry, success, locked) sits inside one or more of these.

## Props / state

| Prop       | Type            | Default | Notes                                                                                                                         |
| ---------- | --------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `children` | `ReactNode`     | —       | Panel contents.                                                                                                               |
| `style`    | `CSSProperties` | —       | Spread last, so callers override padding/alignment etc. Used throughout (e.g. `padding: "18px 20px"`, `textAlign: "center"`). |

**State:** none — pure presentational wrapper.

## UX behaviour

- Static container; no interaction of its own.
- Fixed look: `background: var(--w-ink)`, `color: var(--w-paper)`, `border: 2px solid var(--w-ink)`, `borderRadius: 16`, default `padding: "26px 22px"`.
- The dark surface is what lets paper-tinted text tones (`ST_DIM` / `ST_MID`, defined alongside the component) read correctly.

## Dependencies

- **Shared primitives:** none.
- **CSS variables:** `--w-ink`, `--w-paper`.
- **Keyframes:** none (animation, when present, is applied by the parent screen wrapper, not the panel).
- **localStorage:** none.
- **Globals / window:** none.

## Reuse notes

The canonical dark surface for the staff station and worth preserving as a design reference (it is the deliberate inverse of the light customer card). For production: (1) move the inline style object into the token / `data-slot` layer; (2) note the hardcoded `borderRadius: 16` does not use the `--w-r` token that other Wet Ink surfaces use — reconcile that; (3) give it a real module export instead of relying on module-local scope. The two paper-on-ink text tones it pairs with are module constants, quoted here for context:

```jsx
// paper-on-ink tones for the dark panels
const ST_DIM = "rgba(246,241,230,0.55)"
const ST_MID = "rgba(246,241,230,0.74)"
```

## Source snippet

```jsx
function StPanel({ children, style }) {
  return (
    <div
      style={{
        background: "var(--w-ink)",
        color: "var(--w-paper)",
        border: "2px solid var(--w-ink)",
        borderRadius: 16,
        padding: "26px 22px",
        ...style,
      }}
    >
      {children}
    </div>
  )
}
```

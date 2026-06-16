# JyTieStrip

- **Surface:** journey (storyboard building block)
- **Source module:** [extracted-source/60-journey.jsx](../../extracted-source/60-journey.jsx) (lines 311–325)
- **Export:** not exported (module-local; used internally by `JourneyMap`)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles, motion factor + delay threaded as props)

## Visual purpose

A vertical connector drawn _between two lanes_ to call out a cross-surface relationship — the points where two surfaces meet on the same real-world moment. It is a centred stack: a short dashed accent rule, a labelled row (an accent `MonoTag` prefixed with the `✱` wordmark disc plus a `MonoLine` note), and another short dashed accent rule, so it reads as a tie threaded vertically through the storyboard. Used twice in `JourneyMap`: "The counter moment" (Customer ↔ Staff) and "Stripe webhooks" (Merchant ↔ Admin).

## Props / state

| Prop    | Type   | Default | Notes                                                                                                    |
| ------- | ------ | ------- | -------------------------------------------------------------------------------------------------------- |
| `label` | string | —       | Short title; rendered inside a `MonoTag tone="accent"` as `✱ {label}`.                                   |
| `note`  | string | —       | Longer caption rendered in a `MonoLine` (`fontSize: 10`), explaining which step on each surface is tied. |
| `mo`    | number | —       | Motion factor; multiplies the `w-rise` entrance duration and delay.                                      |
| `delay` | number | —       | Entrance stagger in ms (before `mo`). `JourneyMap` passes 150 and 210.                                   |

**State:** none.

## UX behaviour

- Static, non-interactive. Entrance only: `animation: w-rise ${380 * mo}ms ${delay * mo}ms cubic-bezier(0.2,0,0,1) both`.
- Layout is `display: grid; justifyItems: center; gap: 3` with negative top margin (`margin: "-4px 0 2px"`) to pull it snug between lanes.
- Two 14px-tall `borderLeft: 2px dashed var(--w-accent)` rules sandwich the label row; the label row wraps (`flexWrap: "wrap"`) and stays centred.
- The `✱` is hardcoded into the tag text (`✱ {label}`) — the wordmark/logo disc reused as a marker, consistent with the brand rule that `✱` is the logo signature.

## Dependencies

- **Shared primitives:** `MonoTag` (`tone="accent"`, the `✱ {label}` pill), `MonoLine` (the note).
- **Journey-local:** none.
- **CSS variables:** `--w-accent` (the dashed rules). (Tag/line colours come from those primitives.)
- **Keyframes:** `w-rise` (entrance).
- **localStorage:** none.
- **Globals / window:** reads `React`, `MonoTag`, `MonoLine` (window globals). Not assigned to `window`.

## Reuse notes

A tidy "cross-link annotation" element, portable as a reference for storyboards that need to mark shared moments between tracks. For production: replace the `mo`/`delay` motion knobs with design-system motion tokens, move dimensions to the token layer, and keep `✱` reserved strictly for the wordmark per `DESIGN.md`. Purely decorative, so no a11y obligations beyond legible contrast.

## Source snippet

```jsx
function JyTieStrip({ label, note, mo, delay }) {
  return (
    <div
      style={{
        display: "grid",
        justifyItems: "center",
        gap: 3,
        margin: "-4px 0 2px",
        animation: `w-rise ${380 * mo}ms ${delay * mo}ms cubic-bezier(0.2,0,0,1) both`,
      }}
    >
      <div
        style={{ height: 14, borderLeft: "2px dashed var(--w-accent)" }}
      ></div>
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <MonoTag tone="accent">✱ {label}</MonoTag>
        <MonoLine style={{ fontSize: 10 }}>{note}</MonoLine>
      </div>
      <div
        style={{ height: 14, borderLeft: "2px dashed var(--w-accent)" }}
      ></div>
    </div>
  )
}
```

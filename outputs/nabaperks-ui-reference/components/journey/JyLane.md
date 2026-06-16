# JyLane

- **Surface:** journey (storyboard building block)
- **Source module:** [extracted-source/60-journey.jsx](../../extracted-source/60-journey.jsx) (lines 290–309)
- **Export:** not exported (module-local; used internally by `JourneyMap`)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles, motion factor + staggered delay threaded as props, horizontal-scroll lane with no scroll affordance)

## Visual purpose

One swimlane of the storyboard: a labelled header row (a `MonoTag` for the surface name, a `MonoLine` for the "who" caption, a dashed rule that fills remaining width, and a right-aligned `N screens` count) above a horizontally-scrolling row of `JyStepCard`s connected by `JyArrowLink`s. Each lane represents a surface (Merchant, Customer, Staff, Admin, Marketing) and reads left-to-right as that surface's screen sequence. The whole lane rises in on mount.

## Props / state

| Prop    | Type                        | Default | Notes                                                                                                                                                                                                                                                                                        |
| ------- | --------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lane`  | object                      | —       | A lane record from `JY_LANES`. Fields read: `lane.label` (surface name), `lane.who` (caption, e.g. `"Asha K. · first visit"`), `lane.steps` (array of step records), `lane.steps.length` (rendered as the screen count), `lane.slim` (passed to each card), `lane.surface` (passed to `go`). |
| `go`    | `(surface, preset) => void` | —       | Navigation callback. Each card calls `go(lane.surface, step.preset)` on activation.                                                                                                                                                                                                          |
| `mo`    | number                      | —       | Motion factor; multiplies both the entrance duration and delay (`w-rise ${380 * mo}ms ${delay * mo}ms …`) and is passed down to each `JyStepCard`.                                                                                                                                           |
| `delay` | number                      | —       | Entrance stagger in ms (before the `mo` multiply). `JourneyMap` passes 60/120/180/240/300 to stagger the lanes.                                                                                                                                                                              |

**State:** none.

## UX behaviour

- Entrance: `animation: w-rise ${380 * mo}ms ${delay * mo}ms cubic-bezier(0.2,0,0,1) both` on the `<section>` — each lane rises/fades in on a staggered delay.
- The cards row is `display: flex; overflowX: auto` — it scrolls horizontally when the lane is wider than the viewport (no visible scrollbar styling or arrow affordance in source).
- Cards are interleaved with connectors: for each step `i`, render `<JyArrowLink spur={step.spur} />` when `i > 0`, then the `<JyStepCard>`. The connector's colour reflects the _upcoming_ card's `spur` flag.
- Each `React.Fragment` is keyed by `step.preset` (the step's unique preset id).
- The header rule (`flex: 1; borderTop: 2px dashed var(--w-line)`) stretches between the caption and the screen count.

## Dependencies

- **Shared primitives:** `MonoTag` (surface label, `tone="ink"`), `MonoLine` (the "who" caption and the "N screens" count).
- **Journey-local:** `JyStepCard`, `JyArrowLink`.
- **CSS variables:** `--w-line` (the dashed header rule). (Card/connector colours come from those components.)
- **Keyframes:** `w-rise` (entrance).
- **localStorage:** none.
- **Globals / window:** reads `React` (`React.Fragment`), `MonoTag`, `MonoLine` (window globals), and the module-local `JyStepCard`/`JyArrowLink`. Not assigned to `window`.

## Reuse notes

A clean, data-driven lane layout — directly reusable as a reference for any "swimlane of cards" storyboard. For production: (1) `mo`/`delay` are demo motion knobs and should be replaced by design-system motion tokens that honour `prefers-reduced-motion`; (2) the horizontal `overflowX: auto` row needs a real scroll affordance / keyboard-scroll story for accessibility; (3) inline styles → token/`data-slot` layer. The `lane` shape (label/who/steps/slim/surface) is storyboard data, not a backend model.

**Prototype-ism:** the staggered entrance (`w-rise` with per-lane `delay`) and `mo` scaling are presentation tuning, not product behaviour.

## Source snippet

```jsx
function JyLane({ lane, go, mo, delay }) {
  return (
    <section
      style={{
        animation: `w-rise ${380 * mo}ms ${delay * mo}ms cubic-bezier(0.2,0,0,1) both`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <MonoTag tone="ink">{lane.label}</MonoTag>
        <MonoLine style={{ fontSize: 10 }}>{lane.who}</MonoLine>
        <div
          style={{
            flex: 1,
            minWidth: 40,
            borderTop: "2px dashed var(--w-line)",
          }}
        ></div>
        <MonoLine style={{ fontSize: 10 }}>
          {lane.steps.length} screens
        </MonoLine>
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          overflowX: "auto",
          padding: "10px 6px 14px",
        }}
      >
        {lane.steps.map((step, i) => (
          <React.Fragment key={step.preset}>
            {i > 0 && <JyArrowLink spur={step.spur} />}
            <JyStepCard
              step={step}
              slim={lane.slim}
              mo={mo}
              onClick={() => go(lane.surface, step.preset)}
            />
          </React.Fragment>
        ))}
      </div>
    </section>
  )
}
```

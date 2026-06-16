# JyStepCard

- **Surface:** journey (storyboard building block)
- **Source module:** [extracted-source/60-journey.jsx](../../extracted-source/60-journey.jsx) (lines 235–288)
- **Export:** not exported (module-local; used internally by `JyLane`)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles, hover/press state via JS, motion factor threaded as a prop, "torn receipt" edge faked with layered gradients)

## Visual purpose

A single tappable card on the storyboard, standing in for one screen of a surface. It shows a mono step number (`Nº 01`) or `SPUR` badge, a `JyGlyph` for the destination, a display-weight title, a soft-ink description, and an optional `MonoTag` "tie" pill (cross-surface link, e.g. _Counter moment_, _Stripe webhooks_). Normal steps render with a torn-receipt bottom edge (a zig-zag perforation) and no bottom border, so the card looks like a tear-off ticket; _spur_ steps render as a fully-bordered dashed box with no perforation (a deliberate off-the-happy-path look).

## Props / state

| Prop      | Type         | Default | Notes                                                                                                                                                                                                                                                     |
| --------- | ------------ | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `step`    | object       | —       | A step record from `JY_LANES[].steps`. Fields read: `step.n` (number string, e.g. `"01"` or `"··"`), `step.spur` (boolean branch flag), `step.glyph` (key into `JY_GLYPHS`), `step.title`, `step.desc`, `step.tie` (optional cross-surface label string). |
| `slim`    | `boolean`    | —       | When true (the Marketing lane), card width `168` and min-height `88`; otherwise `180` / `122`.                                                                                                                                                            |
| `mo`      | number       | —       | Motion factor (multiplies the 90ms transition durations — `transition: transform ${90 * mo}ms, filter ${90 * mo}ms`). Comes from `t.mo` at the top level (a "reduce motion" scalar — see prototype-ism note).                                             |
| `onClick` | `() => void` | —       | Fired on click and on Enter/Space keydown. In practice `JyLane` passes `() => go(lane.surface, step.preset)`.                                                                                                                                             |

**State:** `const [hov, setHov] = useStateJy(false)` and `const [down, setDown] = useStateJy(false)` — track hover and active-press to drive the lift transform and offset-shadow. (`useStateJy` is `React.useState`, aliased at the top of the module: `const { useState: useStateJy } = React`.)

## UX behaviour

- `role="button"`, `tabIndex={0}`, and an `onKeyDown` that calls `onClick()` on `"Enter"` or `" "` (with `preventDefault`) — keyboard-activatable.
- Hover lifts the card up-left (`translate(-2px,-2px)`) and grows the offset shadow (`drop-shadow(5px 5px 0 var(--w-ink))`); press pushes it down-right (`translate(2px,2px)`) and collapses the shadow (`drop-shadow(1px 1px 0 var(--w-ink))`); resting shadow is `drop-shadow(3px 3px 0 var(--w-ink))`. Shadows use CSS `filter: drop-shadow(...)` (not `box-shadow`) so the offset follows the torn perforation silhouette.
- `onPointerLeave` resets both `hov` and `down` so a card can't get stuck pressed.
- Border: `2px dashed var(--w-ink)` for spurs, `2px solid var(--w-ink)` otherwise. For non-spur cards the body has `borderBottom: "none"` and `borderRadius: "var(--w-r) var(--w-r) 0 0"`, and a separate 8px-tall element below renders the torn perforation via two layered `linear-gradient`s (zig-zag teeth). Spurs get a full border and full `var(--w-r)` radius with no perforation strip.
- The step-number badge reads `step.spur ? "SPUR" : "Nº " + step.n` in `var(--w-mono)`, accent colour.
- If `step.tie` is present, a `MonoTag tone="accent"` pill is pinned to the bottom of the card body (`marginTop: "auto"`).

## Dependencies

- **Shared primitives:** `MonoTag` (the optional "tie" pill).
- **Journey-local:** `JyGlyph` (the screen glyph chip).
- **CSS variables:** `--w-card` (body bg), `--w-ink` (borders, shadow, perforation teeth), `--w-accent` (step number / SPUR badge), `--w-mono` (step number font), `--w-display` (title font), `--w-ink-soft` (description), `--w-r` (radius).
- **Keyframes:** none directly (the lift/press is CSS transitions on `transform`/`filter`; the entrance animation is owned by the parent `JyLane`).
- **localStorage:** none.
- **Globals / window:** reads `React` (via `useStateJy`), `MonoTag` (window global), `JyGlyph` (module-local). Not assigned to `window`.

## Reuse notes

The torn-receipt card is a signature Wet Ink artefact and worth keeping verbatim as reference. For production: (1) hover/press should be CSS `:hover`/`:active` rather than `useState` + pointer handlers; (2) the `mo` motion-scalar prop is a prototype convenience — production should honour `prefers-reduced-motion` via the design-system motion tokens instead of threading a multiplier through props; (3) the layered-gradient perforation and all dimensions belong in the token/`data-slot` layer; (4) `role="button"` + manual keydown should likely be a real `<button>`; (5) the `step` shape is storyboard-specific (number/glyph/tie/spur) and is not a backend model.

**Prototype-ism:** `mo` (motion factor) and the entrance/transition timings are demo-tuning knobs, not product behaviour.

## Source snippet

```jsx
function JyStepCard({ step, slim, mo, onClick }) {
  const [hov, setHov] = useStateJy(false)
  const [down, setDown] = useStateJy(false)
  const lift = down
    ? "translate(2px,2px)"
    : hov
      ? "translate(-2px,-2px)"
      : "none"
  const shadow = down
    ? "drop-shadow(1px 1px 0 var(--w-ink))"
    : hov
      ? "drop-shadow(5px 5px 0 var(--w-ink))"
      : "drop-shadow(3px 3px 0 var(--w-ink))"
  const border = step.spur
    ? "2px dashed var(--w-ink)"
    : "2px solid var(--w-ink)"
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onClick()
        }
      }}
      onPointerEnter={() => setHov(true)}
      onPointerLeave={() => {
        setHov(false)
        setDown(false)
      }}
      onPointerDown={() => setDown(true)}
      onPointerUp={() => setDown(false)}
      style={{
        width: slim ? 168 : 180,
        flexShrink: 0,
        cursor: "pointer",
        outline: "none",
        filter: shadow,
        transform: lift,
        transition: `transform ${90 * mo}ms, filter ${90 * mo}ms`,
      }}
    >
      <div
        style={{
          background: "var(--w-card)",
          border,
          borderBottom: step.spur ? border : "none",
          borderRadius: step.spur ? "var(--w-r)" : "var(--w-r) var(--w-r) 0 0",
          padding: "12px 13px 9px",
          minHeight: slim ? 88 : 122,
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          <span
            style={{
              fontFamily: "var(--w-mono)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              color: "var(--w-accent)",
              paddingTop: 5,
            }}
          >
            {step.spur ? "SPUR" : "Nº " + step.n}
          </span>
          <JyGlyph kind={step.glyph} />
        </div>
        <div
          style={{
            fontFamily: "var(--w-display)",
            fontWeight: 800,
            fontSize: 14.5,
            lineHeight: 1.15,
            marginTop: 7,
          }}
        >
          {step.title}
        </div>
        <div
          style={{
            fontSize: 11.5,
            lineHeight: 1.45,
            color: "var(--w-ink-soft)",
            marginTop: 5,
          }}
        >
          {step.desc}
        </div>
        {step.tie && (
          <div style={{ marginTop: "auto", paddingTop: 8 }}>
            <MonoTag
              tone="accent"
              style={{ fontSize: 8.5, padding: "2px 8px" }}
            >
              {step.tie}
            </MonoTag>
          </div>
        )}
      </div>
      {!step.spur && (
        <div
          style={{
            height: 8,
            marginTop: -1,
            background:
              "linear-gradient(-45deg, transparent 5px, var(--w-ink) 5px, var(--w-ink) 7px, var(--w-card) 7px) 0 0 / 10px 100%, " +
              "linear-gradient(45deg, transparent 5px, var(--w-ink) 5px, var(--w-ink) 7px, var(--w-card) 7px) 0 0 / 10px 100%",
          }}
        ></div>
      )}
    </div>
  )
}
```

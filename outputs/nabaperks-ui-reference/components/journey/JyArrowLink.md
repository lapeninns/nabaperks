# JyArrowLink

- **Surface:** journey (storyboard building block)
- **Source module:** [extracted-source/60-journey.jsx](../../extracted-source/60-journey.jsx) (lines 223–233)
- **Export:** not exported (module-local; used internally by `JyLane`)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles, hardcoded sizes)

## Visual purpose

The connector drawn _between_ two storyboard step cards within a lane: a short dashed horizontal line ending in a small filled triangular arrowhead, pointing left-to-right. It signals sequence ("this step leads to the next"). When the next step is a _spur_ (an off-the-happy-path branch), the connector is drawn in the hot accent colour instead of soft ink.

## Props / state

| Prop   | Type      | Default | Notes                                                                                                         |
| ------ | --------- | ------- | ------------------------------------------------------------------------------------------------------------- |
| `spur` | `boolean` | —       | When truthy, colours both the dashed line and the arrowhead `var(--w-accent)`; otherwise `var(--w-ink-soft)`. |

**State:** none (pure presentational).

## UX behaviour

- Static, non-interactive. No hover/press handlers.
- Self-centres vertically within the lane row (`alignSelf: "center"`, `flexShrink: 0`) so it lines up against cards of varying height.
- Colour is derived once: `const ink = spur ? "var(--w-accent)" : "var(--w-ink-soft)"`, applied to both the 16px-wide `2px dashed` top border and the `fill` of the 7×10 arrowhead `<path>`.

## Dependencies

- **Shared primitives:** none.
- **CSS variables:** `--w-accent` (spur), `--w-ink-soft` (default).
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** reads `React` only (not assigned to `window`).

## Reuse notes

A small, clean connector primitive — portable as-is for a reference storyboard, but for production the dimensions (16px line, 7×10 arrowhead) and the dashed-border-as-line technique should move into the token/`data-slot` styling layer, and the binary `spur` colour switch would read better as a semantic variant prop than an inline ternary. No accessibility concerns since it is decorative.

## Source snippet

```jsx
function JyArrowLink({ spur }) {
  const ink = spur ? "var(--w-accent)" : "var(--w-ink-soft)"
  return (
    <div
      style={{
        alignSelf: "center",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        padding: "0 3px",
      }}
    >
      <div style={{ width: 16, borderTop: `2px dashed ${ink}` }}></div>
      <svg
        width="7"
        height="10"
        viewBox="0 0 7 10"
        style={{ display: "block" }}
      >
        <path d="M0 0L7 5 0 10z" fill={ink} />
      </svg>
    </div>
  )
}
```

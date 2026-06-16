# MoEventRow

- **Surface:** merchant (local sub-primitive)
- **Source module:** [extracted-source/21-merchant-ops.jsx](../../extracted-source/21-merchant-ops.jsx) (lines 144–162)
- **Export:** local to module (not on `window`)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles, animation scaled by `mo`)

## Visual purpose

A single row in the Activity feed. A three-column grid: a small category-coloured status dot (colour from `MO_DOT`), the event text + sub-line in the middle, and a mono timestamp on the right. Rows after the first carry a dashed top rule; rows flagged `live` animate in with the `w-rise` keyframe.

## Props / state

| Prop    | Type                              | Default | Notes                                                                                 |
| ------- | --------------------------------- | ------- | ------------------------------------------------------------------------------------- |
| `ev`    | `{ cat, time, text, sub, live? }` | —       | The event object. `cat` indexes `MO_DOT` for the dot colour.                          |
| `first` | `boolean`                         | —       | When true, removes the dashed top border.                                             |
| `mo`    | `number`                          | —       | **Motion multiplier** (prototype-ism). Scales the `w-rise` duration: `${340 * mo}ms`. |
| `live`  | `boolean`                         | —       | When true, applies the `w-rise` entrance animation (used for simulated live events).  |

**State:** none (pure render).

`MO_DOT` is a sibling style-map object (not a component) in this module: `{ stamp: "var(--w-accent)", reward: "var(--w-sun)", join: "var(--w-cobalt)", redeem: "var(--w-leaf)", system: "var(--w-ink-soft)" }`.

## UX behaviour

- Grid: `gridTemplateColumns: "14px 1fr auto", gap: 13, alignItems: "start", padding: "11px 0 10px"`.
- Top rule: `borderTop: first ? "none" : "2px dashed var(--w-line)"`.
- Entrance: `animation: live ? "w-rise ${340*mo}ms cubic-bezier(0.2,0,0,1) both" : "none"`.
- Dot: `11×11` disc, `marginTop: 5`, `background: MO_DOT[ev.cat]`, `border: "1.5px solid var(--w-ink)"`.
- Text block: bold `fontSize: 14.5` title over a `fontSize: 12.5` `--w-ink-soft` sub-line.
- Time: mono `fontSize: 11.5`, `--w-ink-soft`, `whiteSpace: "nowrap"`.

## Dependencies

- **Shared primitives:** none.
- **CSS variables:** `--w-accent`, `--w-sun`, `--w-cobalt`, `--w-leaf`, `--w-ink-soft`, `--w-ink`, `--w-line`, `--w-mono` (via `MO_DOT` and inline styles).
- **Keyframes:** `w-rise` (when `live`).
- **localStorage:** none.
- **Globals / window:** reads `React` indirectly (JSX); reads module-local `MO_DOT`. Not exported.

## Reuse notes

A clean timeline-row pattern. For production: drop the `mo` multiplier for a single motion token (and respect `prefers-reduced-motion`), move `MO_DOT` into a typed category-colour token map, and move styling to `data-slot`. The `cat → colour` mapping is a useful contract to keep.

> **Prototype-ism:** `mo` (motion-speed multiplier) and the `live` flag exist to support the "Simulate a live event" demo button in `MerchantActivity`.

## Source snippet

```jsx
function MoEventRow({ ev, first, mo, live }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "14px 1fr auto",
        gap: 13,
        alignItems: "start",
        padding: "11px 0 10px",
        borderTop: first ? "none" : "2px dashed var(--w-line)",
        animation: live
          ? `w-rise ${340 * mo}ms cubic-bezier(0.2,0,0,1) both`
          : "none",
      }}
    >
      <span
        style={{
          width: 11,
          height: 11,
          borderRadius: "50%",
          marginTop: 5,
          background: MO_DOT[ev.cat],
          border: "1.5px solid var(--w-ink)",
        }}
      ></span>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14.5, lineHeight: 1.25 }}>
          {ev.text}
        </div>
        <div
          style={{ fontSize: 12.5, color: "var(--w-ink-soft)", marginTop: 2 }}
        >
          {ev.sub}
        </div>
      </div>
      <span
        style={{
          fontFamily: "var(--w-mono)",
          fontSize: 11.5,
          color: "var(--w-ink-soft)",
          marginTop: 2,
          whiteSpace: "nowrap",
        }}
      >
        {ev.time}
      </span>
    </div>
  )
}
```

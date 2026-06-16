# ProgressLine

- **Surface:** shared (primitive)
- **Source module:** [extracted-source/10-primitives.jsx](../../extracted-source/10-primitives.jsx) (lines 243–260)
- **Export:** `window.ProgressLine` (global)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles, no ARIA progress semantics, global export)

## Visual purpose

A labelled progress bar in the Wet Ink style: a `MonoLine` caption and a `current/total` mono counter above a hard-bordered, fully-rounded track with an accent fill. A thin ink divider on the fill's right edge separates it from the empty remainder (only mid-progress). The fill width animates smoothly.

## Props / state

| Prop      | Type     | Default    | Notes                                                                     |
| --------- | -------- | ---------- | ------------------------------------------------------------------------- |
| `current` | `number` | —          | Filled amount; drives both the counter and `width: (current/total)*100%`. |
| `total`   | `number` | —          | Denominator for the counter and the percentage.                           |
| `label`   | `string` | `"Visits"` | Caption shown via `MonoLine`.                                             |

**State:** none (stateless function component).

## UX behaviour

- Header row: `MonoLine` label on the left, a bold mono `{current}/{total}` counter on the right, baseline-aligned.
- Track: `height: 12`, `2px solid var(--w-ink)`, `borderRadius: 999`, `background: var(--w-card)`, `overflow: hidden`.
- Fill: accent background, width `(current / total) * 100%`, with `transition: width 500ms cubic-bezier(0.2,0,0,1)`.
- A `2px solid var(--w-ink)` right border appears on the fill **only** when `current > 0 && current < total` (an ink seam mid-progress; hidden at empty/full).

## Dependencies

- **Shared primitives:** `MonoLine` (the label).
- **CSS variables:** `--w-ink`, `--w-card`, `--w-accent`, `--w-mono` (counter font).
- **Keyframes:** none (the fill uses a CSS `transition`, not a keyframe).
- **localStorage:** none.
- **Globals / window:** reads `React`; writes itself to `window.ProgressLine`.

## Reuse notes

A neat, on-brand progress bar. For production: (1) add `role="progressbar"` + `aria-valuenow/min/max` for accessibility; (2) guard against `total === 0` (division → `NaN`); (3) move inline styles to the token/`data-slot` layer; (4) default `label` "Visits" is fine en-GB copy but should usually be supplied explicitly; (5) replace `window.*` with a module export. No state or timing mocks.

## Source snippet

```jsx
function ProgressLine({ current, total, label = "Visits" }) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 7,
        }}
      >
        <MonoLine>{label}</MonoLine>
        <span
          style={{ fontFamily: "var(--w-mono)", fontSize: 13, fontWeight: 700 }}
        >
          {current}/{total}
        </span>
      </div>
      <div
        style={{
          height: 12,
          border: "2px solid var(--w-ink)",
          borderRadius: 999,
          background: "var(--w-card)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${(current / total) * 100}%`,
            background: "var(--w-accent)",
            borderRight:
              current > 0 && current < total
                ? "2px solid var(--w-ink)"
                : "none",
            transition: "width 500ms cubic-bezier(0.2,0,0,1)",
          }}
        ></div>
      </div>
    </div>
  )
}
```

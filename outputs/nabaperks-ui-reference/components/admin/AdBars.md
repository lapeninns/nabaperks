# AdBars

- **Surface:** admin (internal support console — local sub-primitive)
- **Source module:** [extracted-source/40-admin.jsx](../../extracted-source/40-admin.jsx) (lines 97–106)
- **Export:** none — module-local function, used only inside `40-admin.jsx`. Not on `window`.
- **Reuse verdict:** ⚠️ Reusable, needs refactor (tiny inline bar chart, fine for a reference but inline-styled and not exported)

## Visual purpose

A minimal inline bar sparkline used on each Fraud flag to show a time-window distribution (stamps-per-minute or joins-per-5-min). Bars at or above a threshold of 8 turn the hot accent colour at full opacity; everything below renders as faint ink. Sits in a hard-bordered `var(--w-paper-2)` strip 56px tall.

## Props / state

| Prop   | Type       | Default | Notes                                                                                                           |
| ------ | ---------- | ------- | --------------------------------------------------------------------------------------------------------------- |
| `bars` | `number[]` | —       | Array of magnitudes. Heights normalise against `Math.max(...bars, 1)` (the `1` guards an all-zero/empty array). |
| `dim`  | `boolean`  | —       | When truthy drops the whole strip to `opacity: 0.45` (used when the flag is resolved).                          |

**State:** none.

## UX behaviour

- Each bar: `width: 13`, `height: Math.max(3, (b / max) * 38)` (so a minimum visible nub of 3px), `borderRadius: 2`.
- Colour rule: `b >= 8` → `var(--w-accent)` at full opacity; otherwise `var(--w-ink)` at `opacity: 0.35`. The literal `8` is a hardcoded "this looks like a spike" threshold, not data-driven.
- Container is `width: "fit-content"`, bars bottom-aligned (`alignItems: "flex-end"`), `gap: 4`.

## Dependencies

- **Shared primitives:** none.
- **CSS variables:** `--w-paper-2`, `--w-ink`, `--w-accent`, `--w-r`.
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** none (module-local).

## Reuse notes

Handy throwaway sparkline. The hardcoded `8` spike threshold and the `38`/`13`/`3` pixel constants would need to become props (or be derived) for general reuse. Good enough as a visual reference for the Wet Ink "hard little bars" treatment.

## Source snippet

```jsx
function AdBars({ bars, dim }) {
  const max = Math.max(...bars, 1)
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: 4,
        height: 56,
        padding: "10px 12px 8px",
        background: "var(--w-paper-2)",
        border: "2px solid var(--w-ink)",
        borderRadius: "var(--w-r)",
        opacity: dim ? 0.45 : 1,
        width: "fit-content",
      }}
    >
      {bars.map((b, i) => (
        <div
          key={i}
          style={{
            width: 13,
            height: Math.max(3, (b / max) * 38),
            borderRadius: 2,
            background: b >= 8 ? "var(--w-accent)" : "var(--w-ink)",
            opacity: b >= 8 ? 1 : 0.35,
          }}
        ></div>
      ))}
    </div>
  )
}
```

## Hardcoded demo data (the `bars` arrays come from `AD_FLAGS`)

| Flag                            | `bars`                                  | `window` caption                    |
| ------------------------------- | --------------------------------------- | ----------------------------------- |
| `FR-0117` (high_stamp_velocity) | `[1, 1, 2, 1, 2, 3, 9, 12, 8, 2, 1, 1]` | `10:30 — 10:45 · stamps per minute` |
| `FR-0102` (repeat_device_join)  | `[1, 2, 1, 4, 3, 1, 1, 0, 1, 0, 1, 0]`  | `15:20 — 16:20 · joins per 5 min`   |

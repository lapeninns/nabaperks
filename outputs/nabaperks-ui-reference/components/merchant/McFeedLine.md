# McFeedLine

- **Surface:** merchant (module-local helper)
- **Source module:** [extracted-source/20-merchant-core.jsx](../../extracted-source/20-merchant-core.jsx) (lines 109–118)
- **Export:** none (module-local; not on `window`)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles, tone→colour map could be tokenised)

## Visual purpose

One row of the "Live from the till" activity feed on the Today tab: a coloured event dot, the event description, and a mono timestamp, separated by a dashed receipt-style rule. The dot colour encodes the event kind (stamp / reward / join / redeem).

## Props / state

| Prop   | Type                                        | Default | Notes                                                                               |
| ------ | ------------------------------------------- | ------- | ----------------------------------------------------------------------------------- |
| `time` | `ReactNode`                                 | —       | Right-aligned mono timestamp (e.g. `"11:42"`).                                      |
| `what` | `ReactNode`                                 | —       | Event description, the flexible middle column.                                      |
| `tone` | `"stamp" \| "reward" \| "join" \| "redeem"` | —       | Selects the dot colour from a lookup. Unmatched values yield `undefined` (no fill). |

**State:** none.

## UX behaviour

- Pure presentational; no handlers.
- Dot colour map: `stamp → --w-accent`, `reward → --w-sun`, `join → --w-cobalt`, `redeem → --w-leaf`.
- Bottom border is `2px dashed var(--w-line)` — the dashed "tear-off receipt" divider motif.

## Dependencies

- **Shared primitives:** none.
- **CSS variables:** `--w-accent`, `--w-sun`, `--w-cobalt`, `--w-leaf`, `--w-ink`, `--w-line`, `--w-ink-soft`, `--w-mono`.
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** none (module-local).

## Reuse notes

Faithful Wet Ink feed row. For production: move inline styles to the token layer and promote the tone→colour map to a shared status-colour token set (mirrors the project's `ACTIVITY_CATEGORY_ICON`/`STATUS_ICON` maps). Note the four `tone` values map to the four loyalty event types (stamp, reward, join, redeem); a `redeem` tone exists in the map but is not exercised by the Today feed sample data.

## Source snippet

```jsx
function McFeedLine({ time, what, tone }) {
  const dot = {
    stamp: "var(--w-accent)",
    reward: "var(--w-sun)",
    join: "var(--w-cobalt)",
    redeem: "var(--w-leaf)",
  }[tone]
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 0",
        borderBottom: "2px dashed var(--w-line)",
      }}
    >
      <span
        style={{
          width: 11,
          height: 11,
          borderRadius: "50%",
          background: dot,
          border: "1.5px solid var(--w-ink)",
          flexShrink: 0,
        }}
      ></span>
      <span style={{ fontSize: 14.5, fontWeight: 600, flex: 1 }}>{what}</span>
      <span
        style={{
          fontFamily: "var(--w-mono)",
          fontSize: 11,
          color: "var(--w-ink-soft)",
        }}
      >
        {time}
      </span>
    </div>
  )
}
```

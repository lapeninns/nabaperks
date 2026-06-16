# AdFact

- **Surface:** admin (internal support console — local sub-primitive)
- **Source module:** [extracted-source/40-admin.jsx](../../extracted-source/40-admin.jsx) (lines 108–115)
- **Export:** none — module-local function, used only inside `40-admin.jsx`. Not on `window`.
- **Reuse verdict:** ⚠️ Reusable, needs refactor (trivial key/value pair, inline-styled, not exported)

## Visual purpose

A compact key-over-value label pair: a small mono caption (`k`) above a bolder value (`v`). Used in the merchant-detail `Sheet` as a 2-column grid of facts (Owner / Joined / Members / Stamps · 7d).

## Props / state

| Prop | Type        | Default | Notes                                                                                                                                                |
| ---- | ----------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `k`  | `ReactNode` | —       | The caption, rendered inside `MonoLine` at 10px.                                                                                                     |
| `v`  | `ReactNode` | —       | The value (14.5px, weight 700), single-line with `overflow: hidden; textOverflow: ellipsis; whiteSpace: nowrap` so long values like emails truncate. |

**State:** none.

## UX behaviour

- Wrapper has `minWidth: 0` so the value can ellipsis-truncate inside a grid track rather than overflow.

## Dependencies

- **Shared primitives:** `MonoLine`.
- **CSS variables:** none directly (colour deferred to `MonoLine` defaults; value uses inherited ink).
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** none (module-local).

## Reuse notes

A generic definition-list cell. Fully portable; for production it would just be a styled `<dt>`/`<dd>` pair. Nothing prototype-specific.

## Source snippet

```jsx
function AdFact({ k, v }) {
  return (
    <div style={{ minWidth: 0 }}>
      <MonoLine style={{ fontSize: 10 }}>{k}</MonoLine>
      <div
        style={{
          fontWeight: 700,
          fontSize: 14.5,
          marginTop: 2,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {v}
      </div>
    </div>
  )
}
```

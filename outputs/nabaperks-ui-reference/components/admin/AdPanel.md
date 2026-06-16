# AdPanel

- **Surface:** admin (internal support console — local sub-primitive)
- **Source module:** [extracted-source/40-admin.jsx](../../extracted-source/40-admin.jsx) (lines 63–78)
- **Export:** none — module-local function, used only inside `40-admin.jsx`. Not on `window`.
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles, no token/`data-slot` layer, not exported)

## Visual purpose

The quiet card chrome of the admin surface: a hard-bordered (`2px solid var(--w-ink)`) `var(--w-card)` block with a small offset shadow and an optional header row (title, sub-line, and a `right` slot for a tag/status). This is the "internal tool wearing the brand" panel — almost no rotation, no playful tilt; it wraps every console section (Overview attention list, Merchants/Billing/Audit tables, each Fraud flag).

## Props / state

| Prop       | Type            | Default | Notes                                                                                                                                   |
| ---------- | --------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `title`    | `ReactNode`     | —       | When present, renders the header row + an `<h2>` (18px, weight 800). When absent, no header and body padding switches to a flat `18px`. |
| `sub`      | `ReactNode`     | —       | Sub-line under the title (13.5px, `var(--w-ink-soft)`). Only rendered when `title` is present.                                          |
| `right`    | `ReactNode`     | —       | Right-aligned header slot, baseline-aligned with the title. In source: `MonoTag` status/open-count chips.                               |
| `children` | `ReactNode`     | —       | Body content.                                                                                                                           |
| `style`    | `CSSProperties` | —       | Spread last onto the `<section>`, so callers override anything (used by Fraud to set `opacity: 0.78` when resolved).                    |

**State:** none — pure presentational wrapper.

## UX behaviour

- Header layout: `display: flex; justifyContent: space-between; alignItems: baseline; gap: 12` with title block on the left and `right` slot on the right.
- Body padding is conditional on `title`: `"14px 18px 18px"` when titled, else `"18px"`.
- `overflow: hidden` clips inner table borders to the rounded corner.

## Dependencies

- **Shared primitives:** none directly (callers pass `MonoTag` etc. into `right`/`children`).
- **CSS variables:** `--w-card`, `--w-ink`, `--w-ink-soft`, `--w-r`, `--w-shadow-sm`.
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** none (module-local).

## Reuse notes

Clean, portable panel concept. For production: move the inline style objects into the token / `data-slot` layer, export it as a real module instead of leaving it file-local, and let `title`/`sub` be true headings for accessibility. The conditional padding and baseline-aligned `right` slot are worth keeping.

## Source snippet

```jsx
function AdPanel({ title, sub, right, children, style }) {
  return (
    <section
      style={{
        background: "var(--w-card)",
        border: "2px solid var(--w-ink)",
        borderRadius: "var(--w-r)",
        boxShadow: "var(--w-shadow-sm)",
        overflow: "hidden",
        ...style,
      }}
    >
      {title && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 12,
            padding: "16px 18px 0",
          }}
        >
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
              {title}
            </h2>
            {sub && (
              <div
                style={{
                  fontSize: 13.5,
                  color: "var(--w-ink-soft)",
                  marginTop: 3,
                }}
              >
                {sub}
              </div>
            )}
          </div>
          {right}
        </div>
      )}
      <div style={{ padding: title ? "14px 18px 18px" : "18px" }}>
        {children}
      </div>
    </section>
  )
}
```

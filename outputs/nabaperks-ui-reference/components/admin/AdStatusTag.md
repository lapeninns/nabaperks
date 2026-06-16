# AdStatusTag

- **Surface:** admin (internal support console — local sub-primitive)
- **Source module:** [extracted-source/40-admin.jsx](../../extracted-source/40-admin.jsx) (lines 90–95)
- **Export:** none — module-local function, used only inside `40-admin.jsx`. Not on `window`.
- **Reuse verdict:** ⚠️ Reusable, needs refactor (status→tone mapping is a clean switch, but it leans on `MonoTag` and one inline-style override; not exported)

## Visual purpose

Maps a merchant's billing/lifecycle `status` string onto a coloured `MonoTag` chip. Used in the Merchants table, the Billing table, and the merchant-detail sheet header. Four states: Active, Trial, Past due, Suspended.

## Props / state

| Prop     | Type                                          | Default | Notes                                                                                                   |
| -------- | --------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------- |
| `status` | `"active" \| "trial" \| "past_due" \| string` | —       | Anything not matching the first three falls through to the **Suspended** branch (the default `return`). |

**State:** none.

## Status → rendering map

| `status` value                     | Renders                                                                                                                              | Tone                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| `"active"`                         | `<MonoTag tone="ink">Active</MonoTag>`                                                                                               | ink                             |
| `"trial"`                          | `<MonoTag>Trial</MonoTag>`                                                                                                           | default (no tone prop)          |
| `"past_due"`                       | `<MonoTag tone="accent">Past due</MonoTag>`                                                                                          | accent                          |
| anything else (e.g. `"suspended"`) | `<MonoTag style={{ background: "var(--w-paper-2)", color: "var(--w-ink)", border: "1.5px solid var(--w-ink)" }}>Suspended</MonoTag>` | inline-overridden paper-2 / ink |

## UX behaviour

- Pure mapping; no interaction. Note the **Suspended** case does not use a `tone` prop — it overrides `MonoTag`'s styling inline with a paper-2 background and a thinner `1.5px` ink border.

## Dependencies

- **Shared primitives:** `MonoTag`.
- **CSS variables:** `--w-paper-2`, `--w-ink` (only in the Suspended branch; the other branches defer colour to `MonoTag`'s `tone`).
- **Keyframes:** none.
- **localStorage:** none.
- **Globals / window:** none (module-local).

## Reuse notes

The status→tone switch is a clean, reusable pattern. For production: drive it from a typed status enum, and replace the inline Suspended override with a proper `MonoTag` tone (e.g. `tone="muted"`) so all four branches go through the same styling path.

## Source snippet

```jsx
function AdStatusTag({ status }) {
  if (status === "active") return <MonoTag tone="ink">Active</MonoTag>
  if (status === "trial") return <MonoTag>Trial</MonoTag>
  if (status === "past_due") return <MonoTag tone="accent">Past due</MonoTag>
  return (
    <MonoTag
      style={{
        background: "var(--w-paper-2)",
        color: "var(--w-ink)",
        border: "1.5px solid var(--w-ink)",
      }}
    >
      Suspended
    </MonoTag>
  )
}
```

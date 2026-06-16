# AdToast

- **Surface:** admin (internal support console — local sub-primitive)
- **Source module:** [extracted-source/40-admin.jsx](../../extracted-source/40-admin.jsx) (lines 117–127)
- **Export:** none — module-local function, used only inside `40-admin.jsx`. Not on `window`.
- **Reuse verdict:** ⚠️ Reusable, needs refactor (fixed-position pill toast, inline-styled, not exported; auto-dismiss logic lives in the parent)

## Visual purpose

A bottom-centred, dark, pill-shaped confirmation toast. Renders as an ink-filled rounded capsule with a `✓` and uppercase mono text, rising in via the `w-rise` keyframe. Shown after every audited support action ("Signed in · session logged", "Flag FR-0117 dismissed", "Payment link sent…", etc.) and at the bottom of both the gate screen and the console.

## Props / state

| Prop    | Type                                | Default | Notes                                                                                                                                                       |
| ------- | ----------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `toast` | `{ id: any, text: string } \| null` | —       | When `null`, the component renders nothing (`if (!toast) return null;`). `id` is used as the React `key` so a new toast re-triggers the entrance animation. |
| `mo`    | `number`                            | —       | Motion multiplier from the prototype's theme (`t.mo`); scales the animation duration (`260 * mo` ms).                                                       |

**State:** none — the toast object and its lifecycle (auto-dismiss) are owned by `AdminSurface`.

## UX behaviour

- `position: fixed; left: 50%; bottom: 86; transform: translateX(-50%); zIndex: 70` — floats above the surface, clear of the bottom tab bar.
- Status marker: the text is prefixed literally with `✓ ` (`✓ {toast.text}`).
- Entrance: `animation: w-rise ${260 * mo}ms cubic-bezier(0.2,0,0,1) both`.
- **Auto-dismiss is NOT in this component.** The parent runs `setTimeout(() => setToast(null), 2600 * mo)` in a `useEffect` keyed on `toast` (lines 150–154) — a prototype-ism (timer-based mock, scaled by `mo`).

## Dependencies

- **Shared primitives:** none.
- **CSS variables:** `--w-ink`, `--w-paper`. (Shadow is a hardcoded `0 6px 24px rgba(33,28,22,0.35)`, not a token.)
- **Keyframes:** `w-rise`.
- **localStorage:** none.
- **Globals / window:** none (module-local).

## Reuse notes

Standard toast/snackbar concept and portable. For production: render through a toast provider/portal rather than a bare fixed `<div>`, give it an ARIA live region for screen readers, replace the `✓ ` text-prefix with the brand `Icon` wrapper, and move the auto-dismiss timer into the toast system. The hardcoded `rgba(33,28,22,0.35)` shadow should become a token.

## Source snippet

```jsx
function AdToast({ toast, mo }) {
  if (!toast) return null
  return (
    <div
      key={toast.id}
      style={{
        position: "fixed",
        left: "50%",
        bottom: 86,
        transform: "translateX(-50%)",
        zIndex: 70,
        background: "var(--w-ink)",
        color: "var(--w-paper)",
        borderRadius: 999,
        padding: "11px 20px",
        fontFamily: "var(--w-mono)",
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        whiteSpace: "nowrap",
        boxShadow: "0 6px 24px rgba(33,28,22,0.35)",
        animation: `w-rise ${260 * mo}ms cubic-bezier(0.2,0,0,1) both`,
      }}
    >
      ✓ {toast.text}
    </div>
  )
}
```

# Sheet

- **Surface:** shared (primitive)
- **Source module:** [extracted-source/10-primitives.jsx](../../extracted-source/10-primitives.jsx) (lines 336–354)
- **Export:** `window.Sheet` (global)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles, no focus trap / Esc / scroll-lock, prop-driven animation timing, global export)

## Visual purpose

A bottom-sheet modal: a scrim over the screen plus a paper panel that slides up from the bottom, hard-bordered on three sides with large top corner radii and a grab-handle pill. The mobile-first overlay for confirmations and secondary flows.

## Props / state

| Prop       | Type         | Default | Notes                                                            |
| ---------- | ------------ | ------- | ---------------------------------------------------------------- |
| `open`     | `boolean`    | —       | When falsy the component returns `null` (not mounted).           |
| `onClose`  | `() => void` | —       | Called when the scrim is clicked.                                |
| `children` | `ReactNode`  | —       | Sheet body content.                                              |
| `mo`       | `number`     | `1`     | Motion multiplier; scales the slide-up duration (`320 * mo` ms). |

**State:** none (stateless; visibility is driven by the `open` prop).

## UX behaviour

- Early return: `if (!open) return null` — no portal, rendered inline in the tree at `position: fixed; inset: 0; zIndex: 60`.
- Scrim: full-bleed `rgba(33,28,22,0.5)` overlay; `onClick` → `onClose`.
- Panel: bottom-anchored, horizontally centred (`left: 50%; translateX(-50%)`), `width: 100%`, `maxWidth: 430` (the thumb-column width). `borderTop/Left/Right: 2px solid var(--w-ink)` (no bottom border), `borderRadius: 18px 18px 0 0`, padding `14px 22px 30px`.
- Entrance: `animation: w-sheet-up 320ms cubic-bezier(0.2,0,0,1)` (× `mo`).
- Grab handle: a `44×5` rounded `var(--w-line)` pill centred above the content.
- No close-on-Escape, no focus trap, no body scroll lock, and no exit animation (it just unmounts) in source.

## Dependencies

- **Shared primitives:** none.
- **CSS variables:** `--w-paper`, `--w-ink`, `--w-line`. (Scrim colour `rgba(33,28,22,0.5)` is a literal, matching the ink tone.)
- **Keyframes:** `w-sheet-up`.
- **localStorage:** none.
- **Globals / window:** reads `React`; writes itself to `window.Sheet`.

## Reuse notes

The visual treatment (grab handle, three-sided border, slide-up) is on-brand and worth keeping. For production it needs the usual modal hardening: (1) render through a portal; (2) trap focus and close on `Escape`; (3) lock body scroll while open; (4) add an exit animation / unmount transition; (5) move inline styles to tokens and the scrim literal to a token; (6) replace `window.*` with a module export. The `mo` prop should give way to CSS + `prefers-reduced-motion`. No timing mocks.

## Source snippet

```jsx
function Sheet({ open, onClose, children, mo = 1 }) {
  if (!open) return null
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 60 }}>
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(33,28,22,0.5)",
        }}
      ></div>
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: 0,
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: 430,
          background: "var(--w-paper)",
          borderTop: "2px solid var(--w-ink)",
          borderLeft: "2px solid var(--w-ink)",
          borderRight: "2px solid var(--w-ink)",
          borderRadius: "18px 18px 0 0",
          padding: "14px 22px 30px",
          animation: `w-sheet-up ${320 * mo}ms cubic-bezier(0.2,0,0,1)`,
        }}
      >
        <div
          style={{
            width: 44,
            height: 5,
            borderRadius: 999,
            background: "var(--w-line)",
            margin: "0 auto 16px",
          }}
        ></div>
        {children}
      </div>
    </div>
  )
}
```

# MoToggle

- **Surface:** merchant (local sub-primitive)
- **Source module:** [extracted-source/21-merchant-ops.jsx](../../extracted-source/21-merchant-ops.jsx) (lines 35–52)
- **Export:** local to module (not on `window`)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles, animation duration scaled by `mo`)

## Visual purpose

A hard-bordered Wet Ink switch. A 60×32 capsule track with an offset small-shadow; "on" fills the track with `--w-leaf` (green), "off" leaves it `--w-paper-2`. A 24×24 ink-bordered card-coloured knob slides 28px across on a `cubic-bezier(0.2,0,0,1)` ease. Used as the QR-studio live/paused switch.

## Props / state

| Prop      | Type         | Default | Notes                                                                                                                                                                    |
| --------- | ------------ | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `on`      | `boolean`    | —       | Drives track colour and knob `translateX(28px / 0)`. Also mirrored to `aria-pressed`.                                                                                    |
| `onClick` | `() => void` | —       | Click handler (parent flips `on`).                                                                                                                                       |
| `mo`      | `number`     | `1`     | **Motion multiplier** (prototype-ism). Scales the knob transition: `transition: transform ${170 * mo}ms cubic-bezier(0.2,0,0,1)`. Comes from `t.mo` on the theme object. |

**State:** none (controlled; `on` lives in the parent).

## UX behaviour

- Track: `width: 60, height: 32, borderRadius: 999, border: "2px solid var(--w-ink)", boxShadow: "var(--w-shadow-sm)"`. Background `var(--w-leaf)` when on, `var(--w-paper-2)` when off.
- Knob: absolutely positioned `top:2 left:2`, `24×24`, `borderRadius: "50%"`, `background: var(--w-card)`, ink border; slides via `transform: translateX(28px)` when on.
- Accessibility: `aria-pressed={on}` is set (better than `MoChip`).

## Dependencies

- **Shared primitives:** none.
- **CSS variables:** `--w-ink`, `--w-leaf`, `--w-paper-2`, `--w-card`, `--w-shadow-sm`.
- **Keyframes:** none (uses a CSS `transition`, not a named keyframe).
- **localStorage:** none.
- **Globals / window:** reads `React` indirectly (JSX). Not exported.

## Reuse notes

A faithful, accessible-ish switch. For production: drop the `mo` multiplier in favour of a single motion token (and honour `prefers-reduced-motion`), move styling to `data-slot`, and consider a `role="switch"` with a label association. The visual treatment is canonical Wet Ink and worth preserving.

> **Prototype-ism:** the `mo` prop is a global "motion speed" multiplier threaded from the theme; it has no production analogue.

## Source snippet

```jsx
function MoToggle({ on, onClick, mo = 1 }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      style={{
        width: 60,
        height: 32,
        borderRadius: 999,
        border: "2px solid var(--w-ink)",
        background: on ? "var(--w-leaf)" : "var(--w-paper-2)",
        cursor: "pointer",
        position: "relative",
        padding: 0,
        boxShadow: "var(--w-shadow-sm)",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: 2,
          width: 24,
          height: 24,
          borderRadius: "50%",
          background: "var(--w-card)",
          border: "2px solid var(--w-ink)",
          transform: on ? "translateX(28px)" : "translateX(0)",
          transition: `transform ${170 * mo}ms cubic-bezier(0.2,0,0,1)`,
          display: "block",
          boxSizing: "border-box",
        }}
      ></span>
    </button>
  )
}
```

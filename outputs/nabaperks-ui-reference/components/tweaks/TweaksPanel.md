# TweaksPanel

- **Surface:** tweaks (omelette-starter scaffold — reusable design-control panel, NOT a Wet-Ink surface)
- **Source module:** [extracted-source/00-tweaks-panel.jsx](../../extracted-source/00-tweaks-panel.jsx) (lines 197–285; `useTweaks` lines 173–188; shared `__TWEAKS_STYLE` lines 60–168)
- **Export:** `window.TweaksPanel` and `window.useTweaks` (globals; see the `Object.assign(window, …)` at lines 537–541)
- **Reuse verdict:** 🔒 Prototype-only (host postMessage protocol, `window.parent` coupling, raw hex/px scaffold styling, global export — it is the design-control tooling layer by design)

## Visual purpose

The reusable floating control panel — the "design-control" surface a prototype mounts so it can be retuned live (fonts, colours, density, toggles, etc.). It is a fixed bottom-right glassmorphic card (`backdrop-filter: blur(24px) saturate(160%)`, translucent paper background `rgba(250,249,247,.78)`), draggable by its header, scrollable body, with a close (`✕`) button. It is **not** a Wet-Ink surface: per the top banner `// @ds-adherence-ignore -- omelette starter scaffold (raw elements/hex/px by design)` it deliberately styles in **raw hex/px**, not the `--w-*` tokens, because it is tooling chrome (marked `data-omelette-chrome=""`), not product UI.

## Props / state

| Prop       | Type        | Default    | Notes                                                                         |
| ---------- | ----------- | ---------- | ----------------------------------------------------------------------------- |
| `title`    | `string`    | `'Tweaks'` | Rendered in the header `<b>`.                                                 |
| `children` | `ReactNode` | —          | The control helpers (`TweakSection`, `TweakSlider`, …) placed in `.twk-body`. |

**State / refs:**

- `const [open, setOpen] = React.useState(false)` — panel hidden until the host activates edit mode. `if (!open) return null;`
- `const dragRef = React.useRef(null)` — the panel DOM node (for measuring + positioning during drag/clamp).
- `const offsetRef = React.useRef({ x: 16, y: 16 })` — current `right`/`bottom` offset in px.
- `const PAD = 16` — viewport padding kept on every edge.

## UX behaviour

- **Mount / protocol order (deliberate):** the message listener is registered **before** announcing availability — the source comment warns "if the announce ran first, the host's activate could land before our handler exists and the toolbar toggle would silently no-op."
- **Open / close are host-driven:** the panel listens for `__activate_edit_mode` → `setOpen(true)` and `__deactivate_edit_mode` → `setOpen(false)`. The close button calls `dismiss()`, which sets `open=false` locally **and** posts `__edit_mode_dismissed`; the host then echoes `__deactivate_edit_mode` back, "which is what actually hides the panel" (per comment), keeping the host toolbar toggle in lockstep.
- **Drag:** `onMouseDown` on `.twk-hd` computes start offsets from `getBoundingClientRect()`, then tracks `mousemove`/`mouseup` on `window`, updating `offsetRef` and re-clamping. The close `✕` calls `e.stopPropagation()` on its own `onMouseDown` so clicking it never starts a drag.
- **Viewport clamping:** `clampToViewport()` keeps the panel within `PAD` of every edge. On open it observes size via `ResizeObserver` (falls back to a `resize` listener when `ResizeObserver` is undefined).
- **Zoom compensation:** the panel scales by `transform:scale(var(--dc-inv-zoom,1))` with `transform-origin:bottom right` — a host-provided inverse-zoom variable so chrome stays a constant on-screen size.

## useTweaks hook

`function useTweaks(defaults)` (lines 173–188) — the single source of truth for tweak values, exported to `window` per the top USAGE comment.

- **Signature / return:** `useTweaks(defaults) → [values, setTweak]`. `values` is the live tweak object (the `t` other modules read); `setTweak` mutates it.
- **State shape:** `const [values, setValues] = React.useState(defaults)` — initialised straight from the caller's `defaults` (e.g. `TWEAK_DEFAULTS`). The shape is whatever the host author declares, e.g. `{ primaryColor: "#D97757", palette: ["#D97757","#29261b","#f6f4ef"], fontSize: 16, density: "regular", dark: false }`. Values may be strings, numbers, booleans, or arrays (palettes).
- **`setTweak` is dual-signature:** accepts either `setTweak('key', value)` **or** `setTweak({ key: value, … })`. The object form guards against a `useState`-style call writing a literal `"[object Object]"` key into the persisted JSON. Internally:
  ```js
  const edits =
    typeof keyOrEdits === "object" && keyOrEdits !== null
      ? keyOrEdits
      : { [keyOrEdits]: val }
  setValues((prev) => ({ ...prev, ...edits }))
  ```
- **Persistence (host-delegated, no localStorage):** every `setTweak` posts `window.parent.postMessage({ type: '__edit_mode_set_keys', edits }, '*')`. The comment states the host then "rewrites the EDITMODE block on disk" — i.e. it edits the `/*EDITMODE-BEGIN*/…/*EDITMODE-END*/` JSON literal in the source file. There is **no `localStorage` write** in this module; persistence lives entirely in the host.
- **Same-window broadcast:** `setTweak` also fires `window.dispatchEvent(new CustomEvent('tweakchange', { detail: edits }))`. The comment notes the parent message only reaches the host, not in-page peers, so the custom event lets same-window listeners (named example: "deck-stage rail thumbnails") react to edits.

## Dependencies

- **Shared primitives:** intended to wrap the `Tweak*` helpers in this module (`TweakSection`, `TweakRow`, and the controls). `useTweaks` has no component dependencies.
- **CSS variables:** none of the `--w-*` design tokens — this scaffold uses **raw hex/px by design**. Representative raw values from `__TWEAKS_STYLE` (recorded, **not** to be converted to `--w-*`): panel `width:280px`, `right:16px; bottom:16px`, `z-index:2147483646`, `background:rgba(250,249,247,.78)`, text `color:#29261b`, `border-radius:14px`, `backdrop-filter:blur(24px) saturate(160%)`, header `b{font-size:12px}`, body `gap:10px`. The **one** CSS custom property it reads is host-provided, not Wet Ink: `--dc-inv-zoom` (inverse-zoom scale, default `1`).
- **Keyframes:** none (transitions only, e.g. the segmented-thumb `transition`).
- **localStorage:** none — persistence is delegated to the host via `postMessage` (see useTweaks hook).
- **Globals / window:** reads `React` (`useState`, `useRef`, `useEffect`, `useCallback`); reads/writes `window.parent` via `postMessage`; listens on `window` for `message`; dispatches a `tweakchange` `CustomEvent` on `window`; uses `ResizeObserver`/`window.resize`; writes `useTweaks` + `TweaksPanel` to `window`.

## Reuse notes

This is prototype/scaffold tooling, not a product surface, and not a candidate for the Wet-Ink token migration — the raw hex/px is **correct** here by design (`@ds-adherence-ignore`). It is tightly coupled to the omelette host: it assumes a `window.parent` that speaks the edit-mode protocol (`__edit_mode_available`, `__activate_edit_mode`, `__deactivate_edit_mode`, `__edit_mode_set_keys`, `__edit_mode_dismissed`) and that rewrites an on-disk `/*EDITMODE-*/` block to persist. Outside that host it renders but cannot persist and never opens. The `useTweaks` state model (defaults-seeded object, dual-signature `setTweak`, same-window `tweakchange` event) is a clean, portable pattern worth referencing for any live-tuning surface; the postMessage/global-export plumbing is host-specific.

## Source snippet

```jsx
function useTweaks(defaults) {
  const [values, setValues] = React.useState(defaults)
  const setTweak = React.useCallback((keyOrEdits, val) => {
    const edits =
      typeof keyOrEdits === "object" && keyOrEdits !== null
        ? keyOrEdits
        : { [keyOrEdits]: val }
    setValues((prev) => ({ ...prev, ...edits }))
    window.parent.postMessage({ type: "__edit_mode_set_keys", edits }, "*")
    window.dispatchEvent(new CustomEvent("tweakchange", { detail: edits }))
  }, [])
  return [values, setTweak]
}

function TweaksPanel({ title = "Tweaks", children }) {
  const [open, setOpen] = React.useState(false)
  const dragRef = React.useRef(null)
  const offsetRef = React.useRef({ x: 16, y: 16 })
  const PAD = 16

  const clampToViewport = React.useCallback(() => {
    const panel = dragRef.current
    if (!panel) return
    const w = panel.offsetWidth,
      h = panel.offsetHeight
    const maxRight = Math.max(PAD, window.innerWidth - w - PAD)
    const maxBottom = Math.max(PAD, window.innerHeight - h - PAD)
    offsetRef.current = {
      x: Math.min(maxRight, Math.max(PAD, offsetRef.current.x)),
      y: Math.min(maxBottom, Math.max(PAD, offsetRef.current.y)),
    }
    panel.style.right = offsetRef.current.x + "px"
    panel.style.bottom = offsetRef.current.y + "px"
  }, [])
  // [trimmed] — two React.useEffect blocks: (1) on `open`, clampToViewport + ResizeObserver
  //   (resize-listener fallback); (2) on mount, addEventListener('message', onMsg) handling
  //   __activate_edit_mode / __deactivate_edit_mode, then postMessage __edit_mode_available.

  const dismiss = () => {
    setOpen(false)
    window.parent.postMessage({ type: "__edit_mode_dismissed" }, "*")
  }

  const onDragStart = (e) => {
    const panel = dragRef.current
    if (!panel) return
    const r = panel.getBoundingClientRect()
    const sx = e.clientX,
      sy = e.clientY
    const startRight = window.innerWidth - r.right
    const startBottom = window.innerHeight - r.bottom
    const move = (ev) => {
      offsetRef.current = {
        x: startRight - (ev.clientX - sx),
        y: startBottom - (ev.clientY - sy),
      }
      clampToViewport()
    }
    const up = () => {
      window.removeEventListener("mousemove", move)
      window.removeEventListener("mouseup", up)
    }
    window.addEventListener("mousemove", move)
    window.addEventListener("mouseup", up)
  }

  if (!open) return null
  return (
    <>
      <style>{__TWEAKS_STYLE}</style>
      <div
        ref={dragRef}
        className="twk-panel"
        data-omelette-chrome=""
        style={{ right: offsetRef.current.x, bottom: offsetRef.current.y }}
      >
        <div className="twk-hd" onMouseDown={onDragStart}>
          <b>{title}</b>
          <button
            className="twk-x"
            aria-label="Close tweaks"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={dismiss}
          >
            ✕
          </button>
        </div>
        <div className="twk-body">{children}</div>
      </div>
    </>
  )
}
```

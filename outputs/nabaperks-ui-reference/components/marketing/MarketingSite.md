# MarketingSite

- **Surface:** marketing (surface root)
- **Source module:** [extracted-source/50-marketing.jsx](../../extracted-source/50-marketing.jsx) (lines 447–496)
- **Export:** `window.MarketingSite` + `window.MarketingEntry` (via `Object.assign(window, …)`)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles, `localStorage`-backed view state, `window.scrollTo` on every nav, global export, marquee via `mo` multiplier)

## Visual purpose

The top-level marketing surface — the "riso poster with three rooms". A persistent dark **marquee strip** ("NO APP · NO PLASTIC · NO PASSWORD · STAMPED IN SECONDS · ") scrolls across the top, then `MkNav`, then exactly one of the three page views (`MkHome` / `MkPricing` / `MkLegal`), then `MkFooter`. The whole surface has `paddingBottom: 110` to clear the app chrome.

## Props / state

| Prop | Type                   | Default | Notes                                                                                                                                                                |
| ---- | ---------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `t`  | theme/transport object | —       | Carries `t.mo` (motion multiplier; scales the marquee duration `22 * t.mo` s) and `t.celebration`, threaded down into the views. Full shape **unclear from source**. |
| `go` | `(role, step) => void` | —       | App-level navigation, passed to `MkNav`, `MkHome`, `MkPricing` for the merchant-signup CTAs. Signature inferred from call sites.                                     |

**State:**

- `const [view, setViewRaw] = useStateMk(() => { … })` — lazy initial value: reads `mkLoadState()` from `localStorage` and uses `s.view` if it is one of `["home", "pricing", "legal"]`, else falls back to `"home"`.

## Views & state

- **Views:** `home | pricing | legal`. Rendered by single-view switching — only the matching block renders:
  ```jsx
  {
    view === "home" && <MkHome t={t} go={go} setView={setView} />
  }
  {
    view === "pricing" && <MkPricing t={t} go={go} />
  }
  {
    view === "legal" && <MkLegal t={t} setView={setView} />
  }
  ```
- **Persistence:** `const MK_LS = "v3_marketing"` (declared at module top, line 5). A `useEffectMk` writes `{ view }` to `localStorage` on every `view` change: `localStorage.setItem(MK_LS, JSON.stringify({ view }))`. On mount, `mkLoadState()` rehydrates it (`JSON.parse(localStorage.getItem(MK_LS)) || null`, guarded by try/catch).
- **`setView(v)`** — the navigation helper passed to chrome/views: `setViewRaw(v); window.scrollTo(0, 0)`. **Every view change scrolls the window to the top.**
- **`reset()`** — wired to `MkFooter`'s "Restart flow" `DemoTag`: `localStorage.removeItem(MK_LS); setView("home")`. **Prototype-only demo affordance.**
- **`window.MarketingEntry`** — a presets descriptor exported alongside the component:
  ```js
  window.MarketingEntry = {
    lsKey: MK_LS, // "v3_marketing"
    presets: {
      home: { view: "home" },
      pricing: { view: "pricing" },
      legal: { view: "legal" },
    },
  }
  ```
  This lets a harness deep-link the surface into any view by seeding `localStorage` key `v3_marketing` with one of the presets. `Object.assign(window, { MarketingSite, MarketingEntry: window.MarketingEntry })` publishes both globals.
- **Marquee:** `const marqueeItems = "NO APP · NO PLASTIC · NO PASSWORD · STAMPED IN SECONDS · "`, rendered as two `<span>`s each repeating it 6× (`marqueeItems.repeat(6)`), animated with `w-marquee ${22 * t.mo}s linear infinite`.

## UX behaviour

- Marquee runs continuously (duration scaled by `t.mo`).
- Navigating between views always resets scroll to `(0, 0)` (note: this is `window.scrollTo(0, 0)`, distinct from `MkNav`'s smooth scroll-to-top on the brand mark while already home).
- No transition between views beyond each view's own `w-rise` entrance animation.

## Dependencies

- **Shared primitives (indirect, via children):** `InkButton`, `GhostLink`, `MonoTag`, `MonoLine`, `DemoTag`, `VenueMark`, `ReceiptCard`, `ReceiptRule`, `StampDisc`, `StampRow` — none referenced directly in this function except through `MkNav` / `MkHome` / `MkPricing` / `MkLegal` / `MkFooter`.
- **Module-local children:** `MkNav`, `MkHome`, `MkPricing`, `MkLegal`, `MkFooter` (and transitively `MkQuoteCard`, `MkFaqItem`, `MkLegalColumn`).
- **CSS variables:** `--w-ink`, `--w-paper`, `--w-mono`.
- **Keyframes:** `w-marquee` (the top strip). (`w-rise` is used by the child views.)
- **localStorage:** key `v3_marketing` (`MK_LS`) — read on mount, written on every `view` change, cleared by `reset()`.
- **Globals / window:** uses `window.scrollTo`; exports `window.MarketingSite` and `window.MarketingEntry`.

## Reuse notes

The three-room composition (marquee + nav + one view + footer) is sound and portable. For production: (1) replace `window.*` exports with proper module exports; (2) view state belongs in the router/URL (`/`, `/pricing`, `/legal`), not `localStorage` — the `v3_marketing` key and the presets descriptor are a **prototype harness mechanism**; (3) `window.scrollTo(0, 0)` on nav should be the router's scroll-restoration behaviour; (4) the marquee duration should derive from `prefers-reduced-motion`, not a `t.mo` multiplier; (5) the "Restart flow" reset is **prototype-only** and must not ship. Marquee copy is plain en-GB, no emoji, no exclamation marks.

## Source snippet

```jsx
function MarketingSite({ t, go }) {
  const [view, setViewRaw] = useStateMk(() => {
    const s = mkLoadState()
    return s && ["home", "pricing", "legal"].includes(s.view) ? s.view : "home"
  })

  useEffectMk(() => {
    localStorage.setItem(MK_LS, JSON.stringify({ view }))
  }, [view])

  const setView = (v) => {
    setViewRaw(v)
    window.scrollTo(0, 0)
  }
  const reset = () => {
    localStorage.removeItem(MK_LS)
    setView("home")
  }

  const marqueeItems =
    "NO APP · NO PLASTIC · NO PASSWORD · STAMPED IN SECONDS · "

  return (
    <div style={{ paddingBottom: 110 }}>
      {/* marquee strip */}
      <div
        style={{
          background: "var(--w-ink)",
          color: "var(--w-paper)",
          overflow: "hidden",
          borderBottom: "2px solid var(--w-ink)",
        }}
      >
        <div
          style={{
            display: "flex",
            whiteSpace: "nowrap",
            width: "max-content",
            animation: `w-marquee ${22 * t.mo}s linear infinite`,
            fontFamily: "var(--w-mono)",
            fontSize: 12,
            letterSpacing: "0.12em",
            padding: "8px 0",
          }}
        >
          <span>{marqueeItems.repeat(6)}</span>
          <span>{marqueeItems.repeat(6)}</span>
        </div>
      </div>

      <MkNav go={go} view={view} setView={setView} />

      {view === "home" && <MkHome t={t} go={go} setView={setView} />}
      {view === "pricing" && <MkPricing t={t} go={go} />}
      {view === "legal" && <MkLegal t={t} setView={setView} />}

      <MkFooter setView={setView} onReset={reset} />
    </div>
  )
}

window.MarketingEntry = {
  lsKey: MK_LS,
  presets: {
    home: { view: "home" },
    pricing: { view: "pricing" },
    legal: { view: "legal" },
  },
}

Object.assign(window, { MarketingSite, MarketingEntry: window.MarketingEntry })
```

# MkFooter

- **Surface:** marketing (chrome)
- **Source module:** [extracted-source/50-marketing.jsx](../../extracted-source/50-marketing.jsx) (lines 151–175)
- **Export:** none (module-local function, rendered once at the bottom of `MarketingSite`)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles, duplicated `✱` disc, both legal links go to one view, `DemoTag` prototype-ism)

## Visual purpose

The marketing footer: a dashed top rule, then a centred 1100px row pairing a smaller `nabaperks` mark + tagline on the left with footer links on the right, and a fine-print copyright line beneath. Carries the riso-poster signature `✱` disc (a smaller `-6deg` copy of the nav mark).

## Props / state

| Prop      | Type             | Default | Notes                                                                                                                                                  |
| --------- | ---------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `setView` | `(view) => void` | —       | Used by the `Terms` and `Privacy` links — **both call `setView("legal")`** (there is a single legal view; they do not deep-link to separate sections). |
| `onReset` | `() => void`     | —       | Wired to the `DemoTag` "Restart flow" control; in `MarketingSite` this is `reset` — clears `localStorage` key `v3_marketing` and returns to home.      |

**State:** none.

## UX behaviour

- **Footer links:** `Terms` and `Privacy` (`GhostLink`, `fontSize: 13.5`) both `→ setView("legal")`.
- **Restart flow:** a `DemoTag` (prototype demo affordance) calling `onReset`.
- Tagline mono line: `For UK counters`. Copyright line: `© 2026 Nabaperks · Bristol · Stamped, not tracked`.
- Row uses `flexWrap: "wrap"` for narrow widths.

## Dependencies

- **Shared primitives:** `GhostLink`, `MonoLine`, `DemoTag` (all on `window`).
- **CSS variables:** `--w-line`, `--w-accent`, `--w-ink`.
- **Keyframes:** none.
- **localStorage:** none directly (the `onReset` it receives clears `v3_marketing` in `MarketingSite`).
- **Globals / window:** reads `GhostLink`, `MonoLine`, `DemoTag`. Not exported.

## Reuse notes

For production: (1) inline styles → token layer; (2) reuse the brand wordmark/`Icon` instead of the third hand-rolled `✱` disc in this module; (3) `Terms` and `Privacy` should deep-link to their respective receipts rather than both opening the same `legal` view; (4) **`DemoTag` "Restart flow" is a prototype-only affordance** (it wipes demo state) and must not ship. The footer copy is plain, warm, en-GB and on-brand.

## Source snippet

```jsx
function MkFooter({ setView, onReset }) {
  return (
    <div style={{ borderTop: "2px dashed var(--w-line)", marginTop: 60 }}>
      <div
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          padding: "26px 28px 8px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: "var(--w-accent)",
              border: "2px solid var(--w-ink)",
              display: "inline-grid",
              placeItems: "center",
              color: "#fff",
              fontWeight: 800,
              fontSize: 13,
              transform: "rotate(-6deg)",
            }}
          >
            ✱
          </span>
          <span style={{ fontWeight: 800, fontSize: 16.5 }}>nabaperks</span>
          <MonoLine style={{ marginLeft: 10 }}>For UK counters</MonoLine>
        </div>
        <div
          style={{
            display: "flex",
            gap: 6,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <GhostLink
            style={{ fontSize: 13.5 }}
            onClick={() => setView("legal")}
          >
            Terms
          </GhostLink>
          <GhostLink
            style={{ fontSize: 13.5 }}
            onClick={() => setView("legal")}
          >
            Privacy
          </GhostLink>
          <DemoTag onClick={onReset}>Restart flow</DemoTag>
        </div>
      </div>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 28px" }}>
        <MonoLine style={{ fontSize: 9.5 }}>
          © 2026 Nabaperks · Bristol · Stamped, not tracked
        </MonoLine>
      </div>
    </div>
  )
}
```

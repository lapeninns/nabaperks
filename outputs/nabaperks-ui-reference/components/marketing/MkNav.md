# MkNav

- **Surface:** marketing (chrome)
- **Source module:** [extracted-source/50-marketing.jsx](../../extracted-source/50-marketing.jsx) (lines 62–82)
- **Export:** none (module-local function, rendered inside `MarketingSite`)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles, hand-rolled `✱` disc, scroll-to-top side effect, `go(...)`/`setView(...)` callback contract)

## Visual purpose

The top navigation bar of the marketing "riso poster". A centred 1100px row: on the left the `nabaperks` wordmark (the signature `✱` disc rotated `-6deg` + display-font lemma), on the right a small cluster of ghost links and two `InkButton`s. The brand button doubles as "scroll to top" when already on home, or "go home" from any other view.

## Props / state

| Prop      | Type                             | Default | Notes                                                                                                                                                                                       |
| --------- | -------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `go`      | `(role, step) => void`           | —       | App-level navigation into another surface. Both nav `InkButton`s call `go("Merchant", "signup")`. Signature inferred from call sites; not defined in this module — **unclear from source**. |
| `view`    | `"home" \| "pricing" \| "legal"` | —       | Current marketing view; drives which ghost links show and whether the brand click scrolls vs. navigates.                                                                                    |
| `setView` | `(view) => void`                 | —       | Switches the marketing view (defined in `MarketingSite`, also scrolls to top).                                                                                                              |

**State:** none (stateless presentational chrome).

## UX behaviour

- **Brand button:** `onClick={() => view === "home" ? window.scrollTo({ top: 0, behavior: "smooth" }) : setView("home")}` — smooth-scrolls to top when already home, otherwise returns to home.
- **Ghost links (conditional):** `← Home` shows only when `view !== "home"`; `Pricing` shows only when `view !== "pricing"`. Both `GhostLink`s at `fontSize: 14`.
- **CTAs:** `Merchant login` (`InkButton size="sm" variant="outline"`) and `Start free` (`InkButton size="sm"`) both fire `go("Merchant", "signup")`.
- Row uses `flexWrap: "wrap"` with `gap: 10` so it reflows on narrow widths.

## Dependencies

- **Shared primitives:** `GhostLink`, `InkButton` (both on `window`).
- **CSS variables:** `--w-ink`, `--w-accent`, `--w-display`.
- **Keyframes:** none.
- **localStorage:** none directly (view persistence lives in `MarketingSite`).
- **Globals / window:** reads `GhostLink`, `InkButton`; calls `window.scrollTo`. Not exported.

## Reuse notes

The layout and CTA pattern are sound. For production: (1) move inline styles into the token/`data-slot` layer; (2) replace the bespoke inline `✱` disc with the brand `Icon`/wordmark component so the logo signature is defined once (it is duplicated again in `MkFooter`); (3) formalise the `go(role, step)` contract — its shape is only implied by call sites here. The `scrollTo` smooth-scroll-on-home behaviour is a nice touch worth keeping but should be a documented affordance, not an inline ternary.

## Source snippet

```jsx
function MkNav({ go, view, setView }) {
  return (
    <div
      style={{
        maxWidth: 1100,
        margin: "0 auto",
        padding: "18px 28px",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: 10,
      }}
    >
      <button
        onClick={() =>
          view === "home"
            ? window.scrollTo({ top: 0, behavior: "smooth" })
            : setView("home")
        }
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          color: "var(--w-ink)",
        }}
      >
        <span
          style={{
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: "var(--w-accent)",
            border: "2px solid var(--w-ink)",
            display: "inline-grid",
            placeItems: "center",
            color: "#fff",
            fontWeight: 800,
            fontSize: 15,
            transform: "rotate(-6deg)",
          }}
        >
          ✱
        </span>
        <span
          style={{
            fontWeight: 800,
            fontSize: 19,
            fontFamily: "var(--w-display)",
          }}
        >
          nabaperks
        </span>
      </button>
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        {view !== "home" && (
          <GhostLink style={{ fontSize: 14 }} onClick={() => setView("home")}>
            ← Home
          </GhostLink>
        )}
        {view !== "pricing" && (
          <GhostLink
            style={{ fontSize: 14 }}
            onClick={() => setView("pricing")}
          >
            Pricing
          </GhostLink>
        )}
        <InkButton
          size="sm"
          variant="outline"
          onClick={() => go("Merchant", "signup")}
        >
          Merchant login
        </InkButton>
        <InkButton size="sm" onClick={() => go("Merchant", "signup")}>
          Start free
        </InkButton>
      </div>
    </div>
  )
}
```

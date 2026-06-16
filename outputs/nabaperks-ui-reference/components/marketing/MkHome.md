# MkHome

- **Surface:** marketing (page view — `home`)
- **Source module:** [extracted-source/50-marketing.jsx](../../extracted-source/50-marketing.jsx) (lines 179–332)
- **Export:** none (module-local function, rendered by `MarketingSite` when `view === "home"`)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles throughout, `setTimeout` slam mock, `scrollIntoView` side effect, motion via `mo` multiplier, copy embedded in JSX)

## Visual purpose

The marketing landing page, top to bottom: a two-column **hero** (headline + dual CTAs on the left, a live tilted `ReceiptCard` demo card on the right); a **three-step** row of tilted bordered cards (the middle one inverted to the accent palette); a dark "**counter moment**" ink band with an interactive `StampDisc` and a "Play the slam" button plus the four `MK_BEATS`; a **social-proof** strip mapping `MK_QUOTES` to `MkQuoteCard`s; and a **pricing teaser** receipt linking to the pricing view. Everything reads as paper receipts pinned at slight angles on a riso poster.

## Props / state

| Prop      | Type                   | Default | Notes                                                                                                                                                        |
| --------- | ---------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `t`       | theme/transport object | —       | Carries `t.mo` (motion multiplier) and `t.celebration` (passed to `StampRow`/`StampDisc`). Full shape **unclear from source** (defined outside this module). |
| `go`      | `(role, step) => void` | —       | App-level navigation; hero/CTAs call `go("Merchant", "signup")`.                                                                                             |
| `setView` | `(view) => void`       | —       | Switches marketing view; pricing-teaser CTA calls `setView("pricing")`.                                                                                      |

**State / refs:**

- `const counterRef = useRefMk(null)` — ref on the dark counter-moment band, scrolled into view by "Watch the counter moment".
- `const [slamKey, setSlamKey] = useStateMk(0)` — incremented to re-trigger the stamp slam (used as `key` on the disc wrapper and as `slammed={slamKey > 0}`).

## UX behaviour

- **`watchMoment()`** (the outline hero CTA): scrolls `counterRef` into view (`behavior: "smooth", block: "start"`), then — **prototype-ism** — `setTimeout(() => setSlamKey(k => k + 1), 650 * mo)` fires the slam after the scroll, on a motion-scaled delay.
- **"Play the slam"** (`InkButton size="sm"`) increments `slamKey` directly.
- Hero CTAs: `Start a 30-day pilot` → `go("Merchant", "signup")`; `Watch the counter moment` (`variant="outline"`) → `watchMoment()`.
- Pricing-teaser CTA: `See what's included` (`InkButton full`) → `setView("pricing")`.
- Three-step cards: middle card (`i === 1`) renders accent bg / white text; rotations are per-index (`-1` / `0.6` / `0.8` deg).
- Root wrapper carries `data-screen-label="Marketing — Home"` and a `w-rise` entrance (`380 * mo` ms).
- Hero demo card shows `StampRow current={2} total={3}` with `dates={["3 JUN", "9 JUN"]}`; counter-moment disc is `StampDisc filled index={2} … size={96} date="12 JUN"`.

## Dependencies

- **Shared primitives:** `MonoTag`, `MonoLine`, `InkButton`, `ReceiptCard`, `ReceiptRule`, `VenueMark`, `StampRow`, `StampDisc` (all on `window`); plus the module-local `MkQuoteCard`.
- **Content constants:** `MK_BEATS` (4 beats), `MK_QUOTES` (3 quotes) — both module-local in `50-marketing.jsx`.
- **CSS variables:** `--w-ink`, `--w-ink-soft`, `--w-paper`, `--w-card`, `--w-accent`, `--w-mono`, `--w-r`, `--w-shadow`.
- **Keyframes:** `w-rise` (page + section entrances). Stamp/celebration keyframes (`w-slam`, `w-soft-stamp`, `w-confetti`, etc.) are owned by `StampDisc`/`StampRow`.
- **localStorage:** none directly.
- **Globals / window:** reads the shared primitives; uses `Element.scrollIntoView`. Not exported.

## Prototype-isms

- `setTimeout(() => setSlamKey(k => k + 1), 650 * mo)` in `watchMoment` — a timed mock to choreograph the slam after a smooth scroll.
- All styling is inline; copy strings (hero, three steps, beats, teaser) are embedded directly in the JSX rather than sourced from a content layer.

## Reuse notes

The page composition and the "counter moment" demo are the strongest marketing assets here. For production: (1) inline styles → token/`data-slot` layer; (2) lift hero/steps/teaser copy into a content source; (3) replace the `setTimeout` slam choreography with a proper animation hook that respects `prefers-reduced-motion` (drop the `mo` multiplier); (4) the per-index magic rotations and the `i === 1` accent inversion should be expressed declaratively per card.

## Source snippet

```jsx
function MkHome({ t, go, setView }) {
  const mo = t.mo
  const counterRef = useRefMk(null)
  const [slamKey, setSlamKey] = useStateMk(0)

  const watchMoment = () => {
    if (counterRef.current)
      counterRef.current.scrollIntoView({ behavior: "smooth", block: "start" })
    setTimeout(() => setSlamKey((k) => k + 1), 650 * mo) // prototype: timed slam after scroll
  }

  return (
    <div
      data-screen-label="Marketing — Home"
      style={{ animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both` }}
    >
      {/* hero */}
      <div
        style={
          {
            /* 1100px two-column grid [trimmed] */
          }
        }
      >
        <div>
          <MonoTag tone="accent">For UK counters</MonoTag>
          <h1 style={{ fontSize: "clamp(44px, 6vw, 76px)" /* [trimmed] */ }}>
            Loyalty, stamped before the coffee cools.
          </h1>
          <p
            style={
              {
                /* [trimmed] */
              }
            }
          >
            A paper stamp card that lives in the customer's browser. They scan
            your till QR, you stamp with a PIN, a mystery reward unseals on
            visit three.
          </p>
          <div
            style={{
              display: "flex",
              gap: 14,
              flexWrap: "wrap",
              marginBottom: 26,
            }}
          >
            <InkButton onClick={() => go("Merchant", "signup")}>
              Start a 30-day pilot
            </InkButton>
            <InkButton variant="outline" onClick={watchMoment}>
              Watch the counter moment
            </InkButton>
          </div>
          <MonoLine>£29/month after the pilot · one price, one venue</MonoLine>
        </div>

        {/* receipt demo */}
        <div style={{ transform: "rotate(2deg)" }}>
          <ReceiptCard mo={mo}>
            {/* The Old Crown · Bristol · "Free hot drink after 3 visits" · VenueMark [trimmed] */}
            <StampRow
              current={2}
              total={3}
              celebration={t.celebration}
              mo={mo}
              dates={["3 JUN", "9 JUN"]}
            />
            {/* CARD Nº OC-0248 · 1 VISIT TO THE SEAL [trimmed] */}
          </ReceiptCard>
        </div>
      </div>

      {/* three steps — 01 Scan / 02 Stamp (accent) / 03 Unseal [trimmed map] */}

      {/* the counter moment — dark ink band */}
      <div
        ref={counterRef}
        style={{
          background: "var(--w-ink)",
          color: "var(--w-paper)" /* [trimmed] */,
        }}
      >
        {/* "Four beats, under ten seconds." + interactive StampDisc */}
        <div
          key={slamKey}
          style={{ display: "inline-block", position: "relative" }}
        >
          <StampDisc
            filled
            index={2}
            slammed={slamKey > 0}
            celebration={t.celebration}
            mo={mo}
            size={96}
            date="12 JUN"
          />
        </div>
        <InkButton size="sm" onClick={() => setSlamKey((k) => k + 1)}>
          Play the slam
        </InkButton>
        {/* MK_BEATS.map(...) → BEAT 01–04 [trimmed] */}
      </div>

      {/* social proof strip — "Counters that kept it." */}
      {MK_QUOTES.map((qt) => (
        <MkQuoteCard key={qt.initials} {...qt} mo={mo} />
      ))}

      {/* pricing teaser — £29/month receipt → setView("pricing") [trimmed] */}
    </div>
  )
}
```

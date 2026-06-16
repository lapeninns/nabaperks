# McToday

- **Surface:** merchant (stage view — the default `today` tab of the `app` stage)
- **Source module:** [extracted-source/20-merchant-core.jsx](../../extracted-source/20-merchant-core.jsx) (lines 345–409)
- **Export:** none (rendered by `MerchantSurface`; not on `window`)
- **Reuse verdict:** 🔒 Prototype-only (hardcoded stats/feed/date/PIN; PIN-reveal contradicts current v3 design)

## Visual purpose

The merchant home dashboard. A header (mono date + "Today at the counter" + a pilot-day chip), a four-tile stat strip (`McStat`), then a two-column body: a "Live from the till" activity feed (`ReceiptCard` of `McFeedLine`s) beside a right rail with the "Your till QR" card (`QrBlock`) and a tap-to-reveal "Staff PIN" card.

## Props / state

| Prop    | Type                                        | Default | Notes                                                                                   |
| ------- | ------------------------------------------- | ------- | --------------------------------------------------------------------------------------- |
| `t`     | `object` (tweaks)                           | —       | Reads `t.mo` for the `w-rise`/`w-pop` durations and passes `mo` into `ReceiptCard`.     |
| `goTab` | `(tabId: string) => void`                   | —       | The surface's `setTab`; used by "Full activity log" → `activity` and "Reprint…" → `qr`. |
| `go`    | `(surface: string, screen: string) => void` | —       | Cross-surface navigator; "See what customers get" → `go("Customer", "card")`.           |

**State:** `const [pinShown, setPinShown] = useStateMc(false)` — toggles the Staff PIN reveal.

## UX behaviour

- Entrance via `w-rise`.
- **Stat strip:** four `McStat`s, the first (`"Stamps today" = 14`) in accent tone; the grid is `auto-fit minmax(150px, 1fr)` so it reflows responsively.
- **Feed card:** static `McFeedLine`s; a `GhostLink` "Full activity log" calls `goTab("activity")`.
- **Till-QR card:** renders `QrBlock`; "Reprint poster & till card" `InkButton` calls `goTab("qr")`; "See what customers get" `GhostLink` calls `go("Customer", "card")` (cross-surface jump).
- **Staff PIN card:** the whole card is a `role="button"` toggling `pinShown`. Revealed it shows `7 3 1 2` in accent; hidden it shows `● ● ● ●`. The PIN digits are keyed on `String(pinShown)` so each toggle replays `w-pop`. Copy mentions nightly rotation at 04:00.
- **Prototype-isms:** the date ("Thursday 12 June · Bristol"), pilot day ("day 23 of 30"), all four stat numbers, the entire feed, and the PIN `7 3 1 2` / rotation time are hardcoded. The Staff-PIN reveal reflects the **older** handed-phone PIN model; current production v3 replaced the shared staff PIN with a counter handshake — treat this card as out of date.

## Dependencies

- **Shared primitives:** `MonoLine`, `MonoTag`, `ReceiptCard`, `ReceiptRule`, `InkButton`, `GhostLink`.
- **Module-local:** `McStat`, `McFeedLine`, `QrBlock`.
- **CSS variables:** `--w-accent`, `--w-ink`, `--w-mono`, plus those consumed by the primitives.
- **Keyframes:** `w-rise` (entrance), `w-pop` (PIN reveal, `300 * mo` ms).
- **localStorage:** none (the surface persists `tab`).
- **Globals / window:** reads shared primitives + `QrBlock` from `window`; receives `t`, `goTab`, `go` from `MerchantSurface`. Not itself exported.

## Reuse notes

Prototype-only: every metric and the feed are canned, and the Staff-PIN card encodes the retired PIN model. The dashboard _layout_ — stat strip, live-feed receipt, till-QR rail — is a faithful Wet Ink reference. For production: source stats from `product_events`, stream the feed from `stamp_events`/`reward_events`/membership joins, derive the date/pilot-day server-side, and replace the Staff-PIN card with the current counter-handshake affordance. The `go("Customer","card")` link shows the intended preview cross-link between merchant and customer surfaces.

## Source snippet

```jsx
function McToday({ t, goTab, go }) {
  const mo = t.mo
  const [pinShown, setPinShown] = useStateMc(false)
  return (
    <div
      style={{ animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both` }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: 18,
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div>
          <MonoLine>Thursday 12 June · Bristol</MonoLine>
          <h1 style={{ fontSize: 34, fontWeight: 800, margin: "6px 0 0" }}>
            Today at the counter
          </h1>
        </div>
        <MonoTag tone="ink">Pilot · day 23 of 30</MonoTag>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: 14,
          marginBottom: 20,
        }}
      >
        <McStat value="14" label="Stamps today" tone="accent" />
        <McStat value="3" label="Rewards ready" />
        <McStat value="5" label="New members" />
        <McStat value="41%" label="Come back twice" />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.5fr 1fr",
          gap: 18,
          alignItems: "start",
        }}
      >
        <ReceiptCard mo={mo}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 18 }}>
              Live from the till
            </div>
            <MonoTag>Auto-refreshing</MonoTag>
          </div>
          <ReceiptRule />
          <McFeedLine
            time="11:42"
            what="Asha K. unsealed a mystery reward"
            tone="reward"
          />
          <McFeedLine time="11:41" what="Asha K. — stamp 3 of 3" tone="stamp" />
          <McFeedLine time="10:18" what="Tom R. — stamp 2 of 3" tone="stamp" />
          <McFeedLine
            time="09:51"
            what="Priya S. joined from the counter QR"
            tone="join"
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginTop: 10,
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <MonoLine style={{ fontSize: 10 }}>
              Weekly digest lands Monday 08:00.
            </MonoLine>
            <GhostLink
              style={{ fontSize: 13.5, padding: "4px 0" }}
              onClick={() => goTab("activity")}
            >
              Full activity log
            </GhostLink>
          </div>
        </ReceiptCard>

        <div style={{ display: "grid", gap: 18 }}>
          <ReceiptCard mo={mo}>
            <div style={{ fontWeight: 800, fontSize: 18, marginBottom: 4 }}>
              Your till QR
            </div>
            <MonoLine style={{ marginBottom: 14 }}>
              One permanent code · 60 scans/min headroom
            </MonoLine>
            <div style={{ textAlign: "center" }}>
              <QrBlock />
            </div>
            <div style={{ marginTop: 14, display: "grid", gap: 4 }}>
              <InkButton
                full
                size="sm"
                variant="outline"
                onClick={() => goTab("qr")}
              >
                Reprint poster &amp; till card
              </InkButton>
              <GhostLink
                style={{ fontSize: 13, justifySelf: "center" }}
                onClick={() => go("Customer", "card")}
              >
                See what customers get
              </GhostLink>
            </div>
          </ReceiptCard>
          <div
            role="button"
            onClick={() => setPinShown(!pinShown)}
            style={{ cursor: "pointer" }}
          >
            <ReceiptCard mo={mo}>
              <div style={{ fontWeight: 800, fontSize: 18 }}>Staff PIN</div>
              <div
                key={String(pinShown)}
                style={{
                  fontFamily: "var(--w-mono)",
                  fontSize: 30,
                  fontWeight: 700,
                  letterSpacing: "0.3em",
                  margin: "10px 0 4px",
                  color: pinShown ? "var(--w-accent)" : "var(--w-ink)",
                  animation: `w-pop ${300 * mo}ms cubic-bezier(0.16,1.2,0.3,1) both`,
                }}
              >
                {pinShown ? "7 3 1 2" : "● ● ● ●"}
              </div>
              <MonoLine style={{ fontSize: 10 }}>
                {pinShown
                  ? "Today's PIN · rotates tonight at 04:00 · tap to hide"
                  : "Rotates nightly at 04:00 · tap to reveal"}
              </MonoLine>
            </ReceiptCard>
          </div>
        </div>
      </div>
    </div>
  )
}
```

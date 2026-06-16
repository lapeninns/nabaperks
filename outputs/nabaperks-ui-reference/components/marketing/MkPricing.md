# MkPricing

- **Surface:** marketing (page view — `pricing`)
- **Source module:** [extracted-source/50-marketing.jsx](../../extracted-source/50-marketing.jsx) (lines 336–415)
- **Export:** none (module-local function, rendered by `MarketingSite` when `view === "pricing"`)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles, copy embedded in JSX, motion via `mo` multiplier, hand-rolled `✱` bullets)

## Visual purpose

The pricing page. A centred heading block ("One price. The whole machine."), then a two-column grid: a tilted **plan receipt** (`Growth plan · per venue`, big `£29/month`, the five `MK_PLAN_BULLETS` each with an accent `✱`, and a CTA) beside a **pilot explainer** column with a dashed "After day 30" callout. Below, a single-open **FAQ accordion** built from `MK_FAQS` via `MkFaqItem`, capped by a final CTA. One plan, no tiers — the layout deliberately reads as a single receipt rather than a pricing matrix.

## Props / state

| Prop | Type                   | Default | Notes                                                                   |
| ---- | ---------------------- | ------- | ----------------------------------------------------------------------- |
| `t`  | theme/transport object | —       | Carries `t.mo` (motion multiplier). Full shape **unclear from source**. |
| `go` | `(role, step) => void` | —       | Both plan + FAQ CTAs call `go("Merchant", "signup")`.                   |

**State:** `const [openFaq, setOpenFaq] = useStateMk(0)` — index of the open FAQ row (starts with the first open; `-1` means all closed). Single-open behaviour via `onToggle={() => setOpenFaq(openFaq === i ? -1 : i)}`.

## UX behaviour

- Plan CTA: `Start your 30-day pilot` (`InkButton full`) → `go("Merchant", "signup")`.
- FAQ CTA: `Start your 30-day pilot` (`InkButton`) → `go("Merchant", "signup")`.
- FAQ rows render `<MkFaqItem … open={openFaq === i} onToggle={…} mo={mo} />` for each `MK_FAQS` entry; first row open on mount.
- Plan bullets: each `MK_PLAN_BULLETS` string prefixed by an accent `✱` glyph (`color: var(--w-accent)`).
- Plan badges: `MonoTag tone="ink"` reading `The only plan`.
- Root wrapper carries `data-screen-label="Marketing — Pricing"` and a `w-rise` entrance (`380 * mo` ms).

## Dependencies

- **Shared primitives:** `MonoTag`, `MonoLine`, `InkButton`, `ReceiptCard`, `ReceiptRule` (all on `window`); plus module-local `MkFaqItem`.
- **Content constants:** `MK_PLAN_BULLETS` (5 items), `MK_FAQS` (5 Q&A) — both module-local.
- **CSS variables:** `--w-ink`, `--w-ink-soft`, `--w-accent`, `--w-line`, `--w-r`.
- **Keyframes:** `w-rise` (page entrance; FAQ answer reveal lives in `MkFaqItem`).
- **localStorage:** none directly.
- **Globals / window:** reads the shared primitives. Not exported.

## Reuse notes

A clean single-plan pricing page. For production: (1) inline styles → token layer; (2) lift heading/explainer/callout copy into a content source (`MK_PLAN_BULLETS`/`MK_FAQS` are already externalised — extend that); (3) the accent `✱` list bullets should be a styled list treatment, not typed glyphs; (4) thread `prefers-reduced-motion` instead of the `mo` multiplier. The single-open FAQ pattern (parent-held `openFaq` index) is reusable.

## Source snippet

```jsx
function MkPricing({ t, go }) {
  const mo = t.mo
  const [openFaq, setOpenFaq] = useStateMk(0)
  return (
    <div
      data-screen-label="Marketing — Pricing"
      style={{ animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both` }}
    >
      <div style={{ maxWidth: 1060, margin: "0 auto", padding: "36px 28px 0" }}>
        {/* heading — "One price. The whole machine." [trimmed] */}

        <div
          style={
            {
              /* two-column grid [trimmed] */
            }
          }
        >
          {/* the plan receipt */}
          <div
            style={{
              transform: "rotate(-1deg)",
              maxWidth: 520,
              margin: "0 auto",
              width: "100%",
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
                <MonoLine style={{ color: "var(--w-ink)", fontWeight: 700 }}>
                  Growth plan · per venue
                </MonoLine>
                <MonoTag tone="ink">The only plan</MonoTag>
              </div>
              <div
                style={{
                  fontSize: 64,
                  fontWeight: 800,
                  lineHeight: 1,
                  margin: "16px 0 4px",
                }}
              >
                £29
                <span
                  style={{
                    fontSize: 20,
                    fontWeight: 700,
                    color: "var(--w-ink-soft)",
                  }}
                >
                  /month
                </span>
              </div>
              <MonoLine style={{ fontSize: 10 }}>
                Billed monthly through Stripe · VAT included
              </MonoLine>
              <ReceiptRule />
              <MonoLine style={{ marginBottom: 12 }}>
                Everything included
              </MonoLine>
              <div style={{ display: "grid", gap: 11 }}>
                {MK_PLAN_BULLETS.map((b) => (
                  <div
                    key={b}
                    style={{ display: "flex", gap: 11, alignItems: "baseline" }}
                  >
                    <span
                      style={{
                        color: "var(--w-accent)",
                        fontWeight: 800,
                        fontSize: 16,
                        flexShrink: 0,
                      }}
                    >
                      ✱
                    </span>
                    <span
                      style={{
                        fontSize: 15.5,
                        fontWeight: 700,
                        lineHeight: 1.4,
                      }}
                    >
                      {b}
                    </span>
                  </div>
                ))}
              </div>
              <ReceiptRule />
              <InkButton full onClick={() => go("Merchant", "signup")}>
                Start your 30-day pilot
              </InkButton>
              <MonoLine
                style={{ fontSize: 10, textAlign: "center", marginTop: 12 }}
              >
                No card to start · cancel any time
              </MonoLine>
            </ReceiptCard>
          </div>

          {/* pilot explainer — "30 days free. No card…" + "After day 30" dashed callout [trimmed] */}
        </div>

        {/* FAQ — "Asked at the counter" */}
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "58px 0 0" }}>
          <h2
            style={
              {
                /* [trimmed] */
              }
            }
          >
            Asked at the counter
          </h2>
          <div style={{ borderBottom: "2px dashed var(--w-line)" }}>
            {MK_FAQS.map((f, i) => (
              <MkFaqItem
                key={f.q}
                q={f.q}
                a={f.a}
                open={openFaq === i}
                mo={mo}
                onToggle={() => setOpenFaq(openFaq === i ? -1 : i)}
              />
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 44 }}>
            <InkButton onClick={() => go("Merchant", "signup")}>
              Start your 30-day pilot
            </InkButton>
            <MonoLine style={{ marginTop: 14 }}>
              No card to start · £29/month after · one month's notice
            </MonoLine>
          </div>
        </div>
      </div>
    </div>
  )
}
```

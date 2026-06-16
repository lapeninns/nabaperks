# MerchantBilling

- **Surface:** merchant (full screen — billing / plan / invoices)
- **Source module:** [extracted-source/21-merchant-ops.jsx](../../extracted-source/21-merchant-ops.jsx) (lines 589–687)
- **Export:** `window.MerchantBilling` (via `Object.assign(window, …)` at module foot)
- **Reuse verdict:** 🔒 Prototype-only (hardcoded prices/invoices/card, faked Stripe via `setTimeout`, demo "skip to day 30" toggle, motion multiplier, global export). The plan-card + invoice-list layout is a reusable pattern.

## Visual purpose

The billing screen inside `MerchantSurface`. `MoHead` titled "Billing" with a trial/active `MonoTag`. Two columns: a **plan card** (£29/month, pilot-day `ProgressLine`, a faked card-on-file + "Manage in Stripe"), and a stacked **invoices** card plus a dashed "If a payment ever fails" explainer. A `DemoTag` rewinds/skips the pilot between day 23 and day 30.

## Props / state

| Prop | Type                  | Notes                                                                |
| ---- | --------------------- | -------------------------------------------------------------------- |
| `t`  | theme object          | Reads `t.mo` (motion multiplier; scales animations + Stripe timers). |
| `go` | `(screen, …) => void` | Navigation fn from host. **Received but not called** in this screen. |

**State (local):**

- `const [day30, setDay30] = useStateMo(false)` — demo toggle between pilot day 23 and day 30 (active).
- `const [stripe, setStripe] = useStateMo("idle")` — `"idle" | "opening" | "note"` for the faked Stripe portal.

**Derived:** `day = day30 ? 30 : 23`; `invoices` prepends the first-month invoice (`NP-0048`, `£29.00`) as **`PAID`** when `day30`, else **`UPCOMING`**, ahead of the two `MO_INVOICES`.

## UX behaviour & navigation

- **`openStripe`** (lines 594–599) — **prototype-ism, faked async**:
  ```jsx
  const openStripe = () => {
    if (stripe !== "idle") return
    setStripe("opening")
    setTimeout(() => setStripe("note"), 1100 * mo)
    setTimeout(() => setStripe("idle"), 3600 * mo)
  }
  ```
  Button reads "Opening…" while `"opening"` (and is disabled); the `"note"` phase shows a "Stripe portal would open in a new tab — simulated here" `MonoLine`; reverts to `idle` after `3600 * mo` ms. No tab opens.
- **"Skip to day 30" / "Rewind to day 23"** (`DemoTag`) toggles `day30`, which flips the trial tag (`Trial · day N of 30` ↔ `Active`), the plan blurb, the next-charge line, and the lead invoice status. The newly-`PAID` invoice animates in via `w-rise` (`day30 && i === 0`).
- `go` is **not** invoked. Screen wrapper `w-rise`; `data-screen-label="Merchant · Billing"`.

## Hardcoded demo data (prices, plans, figures)

- Plan: **"Growth plan · The Old Crown"**, **£29/month after the pilot**, "First 30 days free".
- Pilot: day **23 of 30** (toggle to **30**); "Pilot ends Fri 19 Jun · first charge £29.00"; active next charge "19 Jul · £29.00".
- Card on file: **VISA ···· 4242**, "Expires 08/27 · added on day 12".
- **`MO_INVOICES`** (lines 584–587):
  ```jsx
  const MO_INVOICES = [
    {
      id: "NP-0034",
      date: "01 Jun 2026",
      amount: "£0.00",
      note: "Pilot month",
      status: "PAID",
    },
    {
      id: "NP-0021",
      date: "21 May 2026",
      amount: "£0.00",
      note: "Pilot start",
      status: "PAID",
    },
  ]
  ```
  Lead invoice (in-component): `{ id: "NP-0048", date: "19 Jun 2026", amount: "£29.00", note: "First month", status: "PAID" | "UPCOMING" }`.
- Billing email: `hello@oldcrown.pub`.

## Dependencies

- **Local sub-primitives:** `MoHead`.
- **Shared primitives (window):** `ReceiptCard`, `ReceiptRule`, `InkButton`, `MonoTag`, `MonoLine`, `DemoTag`, `ProgressLine`.
- **CSS variables:** `--w-ink`, `--w-ink-soft`, `--w-paper-2`, `--w-r`, `--w-mono`.
- **Keyframes:** `w-rise` (screen entrance, the Stripe `note`, and the new day-30 invoice).
- **localStorage:** none.
- **Globals / window:** reads `React` (`useStateMo`); writes `window.MerchantBilling`.
- **Mocks:** `setTimeout`-driven fake Stripe portal (see `openStripe`); the `day30` toggle is a demo time-travel device. No network.

## Reuse notes

The single-price framing ("One price · one venue · Stripe handles the cards"), the pilot `ProgressLine`, and the reassuring `past_due` explainer are good product references. To productionise: source the plan, invoices, card and trial state from Stripe + billing tables, replace `openStripe` with a real Customer Portal redirect, remove the `day30` time-travel toggle and the `mo` multiplier, and export properly. The £29 price and `NP-####` invoice ids are demo values.

## Source snippet

```jsx
function MerchantBilling({ t, go }) {
  const mo = t.mo
  const [day30, setDay30] = useStateMo(false)
  const [stripe, setStripe] = useStateMo("idle") // idle | opening | note

  const openStripe = () => {
    if (stripe !== "idle") return
    setStripe("opening")
    setTimeout(() => setStripe("note"), 1100 * mo)
    setTimeout(() => setStripe("idle"), 3600 * mo)
  }

  const day = day30 ? 30 : 23
  const invoices = day30
    ? [
        {
          id: "NP-0048",
          date: "19 Jun 2026",
          amount: "£29.00",
          note: "First month",
          status: "PAID",
        },
        ...MO_INVOICES,
      ]
    : [
        {
          id: "NP-0048",
          date: "19 Jun 2026",
          amount: "£29.00",
          note: "First month",
          status: "UPCOMING",
        },
        ...MO_INVOICES,
      ]

  return (
    <div
      data-screen-label="Merchant · Billing"
      style={{ animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both` }}
    >
      <MoHead
        title="Billing"
        sub="One price · one venue · Stripe handles the cards"
        right={
          <MonoTag tone={day30 ? "ink" : "accent"}>
            {day30 ? "Active" : `Trial · day ${day} of 30`}
          </MonoTag>
        }
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
          gap: 24,
          alignItems: "start",
          maxWidth: 880,
        }}
      >
        {/* plan */}
        <ReceiptCard mo={mo}>
          <MonoLine>Growth plan · The Old Crown</MonoLine>
          <div
            style={{
              fontWeight: 800,
              fontSize: 27,
              lineHeight: 1.05,
              margin: "8px 0 4px",
            }}
          >
            £29
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "var(--w-ink-soft)",
              }}
            >
              /month after the pilot
            </span>
          </div>
          {/* … pilot blurb + ProgressLine + next-charge + DemoTag [trimmed] … */}
          <ReceiptRule />
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span
              style={{
                fontFamily: "var(--w-mono)",
                fontSize: 11,
                fontWeight: 700,
                padding: "5px 9px",
                border: "2px solid var(--w-ink)",
                borderRadius: 6,
                background: "var(--w-paper-2)",
              }}
            >
              VISA
            </span>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: "var(--w-mono)",
                  fontSize: 13.5,
                  fontWeight: 700,
                }}
              >
                ···· 4242
              </div>
              <MonoLine style={{ fontSize: 9.5 }}>
                Expires 08/27 · added on day 12
              </MonoLine>
            </div>
            <InkButton
              size="sm"
              variant="dark"
              disabled={stripe === "opening"}
              onClick={openStripe}
            >
              {stripe === "opening" ? "Opening…" : "Manage in Stripe"}
            </InkButton>
          </div>
          {stripe === "note" && (
            <MonoLine
              style={{
                fontSize: 9.5,
                marginTop: 10,
                animation: `w-rise ${280 * mo}ms both`,
              }}
            >
              Stripe portal would open in a new tab — simulated here, nothing
              left the page.
            </MonoLine>
          )}
        </ReceiptCard>

        <div style={{ display: "grid", gap: 24 }}>
          {/* invoices */}
          <ReceiptCard mo={mo}>
            <div style={{ fontWeight: 800, fontSize: 17 }}>Invoices</div>
            <ReceiptRule />
            {invoices.map((inv, i) => (
              <div
                key={inv.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 1fr auto auto",
                  gap: 12,
                  alignItems: "baseline",
                  padding: "10px 0",
                  borderTop: i === 0 ? "none" : "2px dashed var(--w-line)",
                  fontFamily: "var(--w-mono)",
                  animation:
                    day30 && i === 0 ? `w-rise ${320 * mo}ms both` : "none",
                }}
              >
                <span style={{ fontSize: 11.5, fontWeight: 700 }}>
                  {inv.id}
                </span>
                <span style={{ fontSize: 11, color: "var(--w-ink-soft)" }}>
                  {inv.date} · {inv.note}
                </span>
                <span style={{ fontSize: 12.5, fontWeight: 700 }}>
                  {inv.amount}
                </span>
                <MonoTag
                  tone={inv.status === "PAID" ? "ink" : "plain"}
                  style={{ fontSize: 8.5 }}
                >
                  {inv.status}
                </MonoTag>
              </div>
            ))}
            {/* … "Receipts also land at hello@oldcrown.pub" [trimmed] … */}
          </ReceiptCard>

          {/* past_due explainer */}
          {/* … "If a payment ever fails" dashed card [trimmed] … */}
        </div>
      </div>
    </div>
  )
}
```

_(Pilot blurb, `past_due` explainer card, and minor footers marked `[trimmed]`; verbatim copy is in the aggregation `Copy strings` section.)_

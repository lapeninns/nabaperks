# MkLegal

- **Surface:** marketing (page view — `legal`)
- **Source module:** [extracted-source/50-marketing.jsx](../../extracted-source/50-marketing.jsx) (lines 419–443; copy objects at lines 42–58)
- **Export:** none (module-local function, rendered by `MarketingSite` when `view === "legal"`)
- **Reuse verdict:** ⚠️ Reusable, needs refactor (inline styles, copy embedded as module constants, motion via `mo` multiplier)

## Visual purpose

The "plain-English" legal page. A centred heading block ("The small print, kept legible.") under a `MonoTag` disclaimer that this is a summary, not the full legal text. Below, a two-column grid of two tilted `MkLegalColumn` receipts — one for `MK_TERMS`, one for `MK_PRIVACY` — and a single outline CTA back to the homepage. Reads as two receipts pinned at slight opposing angles.

## Props / state

| Prop      | Type                   | Default | Notes                                                                   |
| --------- | ---------------------- | ------- | ----------------------------------------------------------------------- |
| `t`       | theme/transport object | —       | Carries `t.mo` (motion multiplier). Full shape **unclear from source**. |
| `setView` | `(view) => void`       | —       | The closing CTA calls `setView("home")`.                                |

**State:** none.

## UX behaviour

- Renders `<MkLegalColumn data={MK_TERMS} mo={mo} angle={-0.8} />` and `<MkLegalColumn data={MK_PRIVACY} mo={mo} angle={0.9} />`.
- Closing CTA: `Back to the homepage` (`InkButton variant="outline"`) → `setView("home")`.
- Top `MonoTag` disclaimer: `Plain English summary · not the full legal text`.
- Root wrapper carries `data-screen-label="Marketing — Legal"` and a `w-rise` entrance (`380 * mo` ms).

## Legal copy

Two copy objects defined as module-local constants in `50-marketing.jsx` (lines 42–58). These are **content, not components** — each is a `{ title, no, rows: [[heading, body], …] }` object consumed by `MkLegalColumn`. Captured verbatim:

### `MK_TERMS` (lines 42–49)

- **title:** `Terms, condensed`
- **no:** `Nº T-2026`
- **rows:**
  1. `Participation` — "The card lives in your browser. No app, no plastic, nothing to install — if the QR scans, you're in."
  2. `Merchant-controlled reward terms` — "Each venue sets its own offer, visit target and exclusions. We do the stamping; they do the generosity."
  3. `Abuse & fraud prevention` — "One stamp per UK business day, approved at the counter. Odd patterns get flagged for a human, never silently punished."
  4. `Availability restrictions` — "If billing lapses, new joins and stamps pause but earned rewards stand. Merchants leave with one month's notice."

### `MK_PRIVACY` (lines 51–58)

- **title:** `Privacy, condensed`
- **no:** `Nº P-2026`
- **rows:**
  1. `Data collected` — "Visits, stamps, rewards — and a phone number only if you save your card, stored hashed and shown masked."
  2. `Purposes` — "Used to run the card: show progress, unseal rewards, spot misuse. Never sold, never swapped."
  3. `Marketing consent separation` — "Marketing is a separate, optional tick. No consent, no texts — your stamps work either way."
  4. `Data requests` — "Ask and we'll show, export or delete what we hold on you. UK GDPR, minus the runaround."

Verbatim source:

```jsx
const MK_TERMS = {
  title: "Terms, condensed",
  no: "Nº T-2026",
  rows: [
    [
      "Participation",
      "The card lives in your browser. No app, no plastic, nothing to install — if the QR scans, you're in.",
    ],
    [
      "Merchant-controlled reward terms",
      "Each venue sets its own offer, visit target and exclusions. We do the stamping; they do the generosity.",
    ],
    [
      "Abuse & fraud prevention",
      "One stamp per UK business day, approved at the counter. Odd patterns get flagged for a human, never silently punished.",
    ],
    [
      "Availability restrictions",
      "If billing lapses, new joins and stamps pause but earned rewards stand. Merchants leave with one month's notice.",
    ],
  ],
}

const MK_PRIVACY = {
  title: "Privacy, condensed",
  no: "Nº P-2026",
  rows: [
    [
      "Data collected",
      "Visits, stamps, rewards — and a phone number only if you save your card, stored hashed and shown masked.",
    ],
    [
      "Purposes",
      "Used to run the card: show progress, unseal rewards, spot misuse. Never sold, never swapped.",
    ],
    [
      "Marketing consent separation",
      "Marketing is a separate, optional tick. No consent, no texts — your stamps work either way.",
    ],
    [
      "Data requests",
      "Ask and we'll show, export or delete what we hold on you. UK GDPR, minus the runaround.",
    ],
  ],
}
```

## Dependencies

- **Shared primitives:** `MonoTag`, `MonoLine`, `InkButton` (on `window`); plus module-local `MkLegalColumn`, `MK_TERMS`, `MK_PRIVACY`.
- **CSS variables:** `--w-ink-soft` (and, via `MkLegalColumn`, `--w-display`, `--w-ink`).
- **Keyframes:** `w-rise` (page entrance).
- **localStorage:** none directly.
- **Globals / window:** reads the shared primitives. Not exported.

## Reuse notes

A clean two-receipt legal-summary page. For production: (1) inline styles → token layer; (2) the copy is already externalised into `MK_TERMS`/`MK_PRIVACY` objects — move them to a proper content source and link to the full legal text rather than relying on the "travels with your merchant agreement" footnote; (3) `prefers-reduced-motion` instead of the `mo` multiplier. The disclaimer-first framing ("summary, not the full legal text") is good practice. Copy is plain, warm, en-GB and on-brand (no emoji, no exclamation marks).

## Source snippet

```jsx
function MkLegal({ t, setView }) {
  const mo = t.mo
  return (
    <div
      data-screen-label="Marketing — Legal"
      style={{ animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both` }}
    >
      <div style={{ maxWidth: 1060, margin: "0 auto", padding: "36px 28px 0" }}>
        <div style={{ textAlign: "center", marginBottom: 38 }}>
          <MonoTag>Plain English summary · not the full legal text</MonoTag>
          <h1
            style={
              {
                /* [trimmed] */
              }
            }
          >
            The small print, kept legible.
          </h1>
          <p
            style={
              {
                /* [trimmed] */
              }
            }
          >
            Two receipts: what everyone agrees to, and what happens to the data.
            The full versions arrive with your merchant agreement.
          </p>
        </div>
        <div
          style={
            {
              /* two-column grid [trimmed] */
            }
          }
        >
          <MkLegalColumn data={MK_TERMS} mo={mo} angle={-0.8} />
          <MkLegalColumn data={MK_PRIVACY} mo={mo} angle={0.9} />
        </div>
        <div style={{ textAlign: "center", marginTop: 44 }}>
          <InkButton variant="outline" onClick={() => setView("home")}>
            Back to the homepage
          </InkButton>
        </div>
      </div>
    </div>
  )
}
```

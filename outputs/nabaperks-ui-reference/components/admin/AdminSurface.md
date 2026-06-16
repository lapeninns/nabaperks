# AdminSurface

- **Surface:** admin (internal support console — the top-level surface)
- **Source module:** [extracted-source/40-admin.jsx](../../extracted-source/40-admin.jsx) (lines 131–482; exports 484–498)
- **Export:** `Object.assign(window, { AdminSurface })` plus a separate `window.AdminEntry` descriptor object (see below).
- **Reuse verdict:** 🔒 Prototype-only (single mega-component, `localStorage`-backed mock state, faked MFA, `Date.now`/`setTimeout` mocks, hardcoded support datasets, inline styles throughout)

## Visual purpose

The internal staff support console — "an internal tool wearing the brand". Quieter ink than the customer surface: `var(--w-paper-2)` panels, hard `2px` ink borders, almost no rotation. Flow: an MFA **gate** screen, then a **console** with a five-tab pill switcher (Overview · Merchants · Billing · Audit · Fraud), a merchant-detail bottom `Sheet`, and a confirmation toast. Branded with a small accent `✱` disc + `nabaperks` wordmark + an `Internal` `MonoTag`.

## Props / state

### Props

| Prop | Type                       | Notes                                                                                                                                                |
| ---- | -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `t`  | theme object               | Only `t.mo` is read — the motion multiplier (`const mo = t.mo`), used to scale animation/timeout durations.                                          |
| `go` | `(surface, route) => void` | Cross-surface navigation. Called once: from the merchant-detail sheet for `m1` only — `go("Merchant", "today")` ("Open their merchant dashboard →"). |

### State (all via `useStateAd`, the file's alias for `React.useState`)

| State           | Initial                          | Purpose                                                                                                                    |
| --------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `stage`         | `adLoad().stage \|\| "gate"`     | `"gate"` or `"console"`. Persisted.                                                                                        |
| `tab`           | `adLoad().tab \|\| "overview"`   | Active console tab. Persisted.                                                                                             |
| `resolvedFlags` | `adLoad().resolvedFlags \|\| {}` | Map of `flagId → verdict` (`"Reviewed"`/`"Dismissed"`). Persisted.                                                         |
| `pausedIds`     | `adLoad().pausedIds \|\| []`     | Merchant ids whose programme has been paused via the sheet. Persisted.                                                     |
| `auditExtra`    | `adLoad().auditExtra \|\| []`    | Session-generated audit entries, prepended to the base log. Persisted (with the `fresh` flag stripped — see effect below). |
| `email`         | `"ops@nabaperks.co"`             | Gate work-email field. **Not** persisted.                                                                                  |
| `otp`           | `""`                             | Gate MFA code field. **Not** persisted.                                                                                    |
| `sheetId`       | `null`                           | Currently-open merchant id in the detail `Sheet`. **Not** persisted.                                                       |
| `toast`         | `null`                           | Current toast `{ id, text }`. **Not** persisted.                                                                           |

## Sections & gate

The MFA gate plus five console tabs. Map of what each shows:

| Section                     | Trigger                                       | What it shows                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Gate (MFA)**              | `stage === "gate"` (initial / after Sign out) | `data-screen-label="Admin · Internal gate"`. Centred `var(--w-paper-2)` card: `Internal · MFA required` tag, heading **"Internal only."**, copy that every session lands in the audit log, a **Work email** text input (prefilled `ops@nabaperks.co`), a **6-digit MFA code** `OtpBoxes`, an **Unlock console** `InkButton` (dark, `full`, disabled until `ready`), and a `DemoTag` "Autofill MFA code". Footer mono line about idle-out. |
| **Overview**                | `tab === "overview"`                          | Four `AdStat` KPI tiles, then a **Needs attention** `AdPanel` listing the Past-due item (deep-links to Billing) and — only when fraud flags are open — a Fraud item (deep-links to Fraud). When the fraud queue is clear, a dashed "Clear" row replaces it. Footer: mirrors `product_events`, read-only unless audited.                                                                                                                   |
| **Merchants**               | `tab === "merchants"`                         | `AdPanel` "Merchants" containing a 6-column grid table (Venue / Status / Members / Stamps 7d / Owner / ⟨view⟩) built from `AD_MERCHANTS`. Status via `AdStatusTag`; a `Paused` `MonoTag` is added for ids in `pausedIds`; each row has a `View` `InkButton` opening the detail sheet. Uses `AD_TH`/`AD_TD` cell-style objects.                                                                                                            |
| **Billing**                 | `tab === "billing"`                           | `AdPanel` "Stripe sync" with a 4-column table (Merchant / Plan / Status / Last webhook event) from `AD_MERCHANTS`; past-due rows tint `var(--w-paper-2)`. Below: a dashed **Past due** callout for The Brass Tap with a **Send payment update link** `InkButton` (fires `act(...)`). Footer: pricing line.                                                                                                                                |
| **Audit**                   | `tab === "audit"`                             | `AdPanel` "Audit log" rendering `audit = [...auditExtra, ...AD_AUDIT_BASE]` as a 3-column (ts / who / what) list. `fresh` (session-new) rows tint `var(--w-paper-2)` and show the timestamp in accent. Footer: append-only · kept 24 months.                                                                                                                                                                                              |
| **Fraud**                   | `tab === "fraud"`                             | One `AdPanel` per `AD_FLAGS` entry: detail prose, an `AdBars` sparkline, the window caption, a `ReceiptRule`, then either a resolved state (`✓ resolution` + a `Reopen` `GhostLink` if not pre-closed) or action buttons **Mark reviewed** / **Dismiss** (`InkButton`s calling `resolveFlag`). Footer: "Signals, not verdicts".                                                                                                           |
| **Merchant detail (Sheet)** | `sheetId` set (any tab)                       | `data-screen-label="Admin · merchant detail"`. Bottom `Sheet` with a `VenueMark`, name/kind/note, `AdStatusTag`, a 2×2 grid of `AdFact`s (Owner/Joined/Members/Stamps·7d), a `ReceiptRule`, and three audited support actions (Resend magic link / Regenerate QR / Pause-or-Resume programme). For `m1` only, a `GhostLink` to open the merchant dashboard.                                                                               |

### MFA gate behaviour — IS THE CODE FAKED?

**Yes — the MFA is entirely faked (prototype-ism).**

- `const ready = otp.length === 6 && email.includes("@");` — the gate only checks the code is **6 digits long** and the email contains an `@`. No value is verified; **any** 6-digit string unlocks.
- The **Autofill MFA code** `DemoTag` sets `otp` to `"120626"` (a demo convenience; it is not validated against anything).
- **Unlock console** simply runs `setStage("console")` and shows a `"Signed in · session logged"` toast. No network, no real MFA, no real session.
- Footer copy `Sessions idle out after 30 min · IP logged · ops only` is descriptive prose only — there is **no** idle timer, IP logging, or auth in the prototype.
- **Sign out** (console header `GhostLink`) just does `setStage("gate"); setOtp("")`.

## UX behaviour & flow

- **Persistence effect (lines 143–148):** on any change to `stage/tab/resolvedFlags/pausedIds/auditExtra`, writes the whole bundle to `localStorage[AD_LS]`. Crucially it maps `auditExtra` to strip the transient `fresh` flag before persisting (`auditExtra.map(({ fresh, ...rest }) => rest)`), so reloaded session entries lose their accent highlight.
- **Toast auto-dismiss effect (lines 150–154):** when `toast` is set, `setTimeout(() => setToast(null), 2600 * mo)` clears it; cleaned up on change. **Prototype-ism: `setTimeout` mock.**
- **`act(toastText, auditText)` (lines 156–159):** prepends a `fresh: true` audit entry stamped `ts: "12 JUN · just now"`, `who: "ops@nabaperks.co"`, then fires a toast with `id: Date.now()`. **Prototype-isms: hardcoded `"12 JUN · just now"` timestamp and `Date.now()` as a toast key.**
- **`resolveFlag(f, verdict)` (lines 161–165):** records `resolvedFlags[f.id] = verdict` and calls `act` with verdict-specific copy (`dismissed`/`marked as reviewed`).
- **`reset()` (lines 167–171):** the `DemoTag` "Restart flow" handler — `localStorage.removeItem(AD_LS)` then resets every state value back to gate defaults.
- **`openFlags`:** `AD_FLAGS.filter((f) => !f.closed && !resolvedFlags[f.id])` — drives the tab badge and the Overview attention list. `FR-0102` ships pre-`closed`, so by default only `FR-0117` is "open".
- **`tabLabel`:** the Fraud tab shows `Fraud · N` when `openFlags.length` is non-zero, else just the tab key.
- **Tab body animation:** the body wrapper is keyed on `tab` with `animation: w-rise ${380 * mo}ms …` so each tab switch re-animates.
- **Console header:** brand on the left; on the right `ops@nabaperks.co` mono line, a **Sign out** `GhostLink`, and a **Restart flow** `DemoTag`.

## Dependencies

- **Shared primitives (window globals):** `InkButton`, `GhostLink`, `MonoTag`, `MonoLine`, `DemoTag`, `VenueMark`, `ReceiptRule`, `Sheet`, `OtpBoxes`.
- **Local sub-primitives (this module):** `AdPanel`, `AdStat`, `AdStatusTag`, `AdBars`, `AdFact`, `AdToast` (each documented separately).
- **Local style objects:** `AD_TH`, `AD_TD` (table header/cell inline-style objects, lines 57–61) — used inside the Merchants and Billing tables; not components.
- **CSS variables:** `--w-paper`, `--w-paper-2`, `--w-card`, `--w-ink`, `--w-ink-soft`, `--w-line`, `--w-accent`, `--w-leaf`, `--w-r`, `--w-shadow-sm`, `--w-display`, `--w-mono`. (The `✱` brand disc and one toast shadow use hardcoded `#fff` / `rgba(...)` values, not tokens.)
- **Keyframes:** `w-rise` (gate card, tab-body transitions, toast).
- **localStorage:** key **`"v3_admin"`** (the `AD_LS` constant). Read via `adLoad()` (lines 8–10, try/catch → `{}`), written by the persistence effect, removed by `reset()`.
- **Globals / window:** destructures `React` as `{ useState: useStateAd, useEffect: useEffectAd }`; writes `window.AdminSurface` and `window.AdminEntry`.

## Prototype-isms (labelled)

- **Inline styles everywhere** — no token/`data-slot` layer; every element is styled inline.
- **`localStorage["v3_admin"]`** persists mock session state across reloads (a demo convenience, not real server state).
- **Faked MFA** — see "MFA gate behaviour" above; any 6-digit code unlocks, demo autofill is `"120626"`.
- **`Date.now()`** used only as a React `key` for toasts (lines 159, 207).
- **`setTimeout`** auto-dismiss for the toast (line 152), scaled by `mo`.
- **Hardcoded timestamps** — new audit entries are stamped the literal string `"12 JUN · just now"`; the static datasets carry baked dates like `"12 JUN 04:02"`.
- **Hardcoded support datasets** — `AD_MERCHANTS`, `AD_FLAGS`, `AD_AUDIT_BASE` (verbatim below).
- **Descriptive-only security copy** — idle-out / IP-logging / append-only-24-months are prose, not implemented behaviour.

## `window.AdminEntry` (the export descriptor)

A plain object exposing the localStorage key and named preset states (the prototype's harness uses these to jump straight to a stage/tab):

```jsx
window.AdminEntry = {
  lsKey: AD_LS, // "v3_admin"
  presets: {
    gate: { stage: "gate", tab: "overview" },
    overview: { stage: "console", tab: "overview" },
    merchants: { stage: "console", tab: "merchants" },
    billing: { stage: "console", tab: "billing" },
    audit: { stage: "console", tab: "audit" },
    fraud: { stage: "console", tab: "fraud" },
  },
}

Object.assign(window, { AdminSurface })
```

## Hardcoded demo datasets (verbatim)

### `AD_LS` + loader (lines 6–10)

```jsx
const AD_LS = "v3_admin"

function adLoad() {
  try {
    return JSON.parse(localStorage.getItem(AD_LS)) || {}
  } catch (e) {
    return {}
  }
}
```

### `AD_MERCHANTS` (lines 14–33)

```jsx
const AD_MERCHANTS = [
  {
    id: "m1",
    name: "The Old Crown",
    city: "Bristol",
    kind: "Pub",
    initials: "OC",
    owner: "hello@oldcrown.pub",
    status: "trial",
    note: "Pilot day 23/30",
    joined: "21 MAY 2026",
    members: 128,
    stampsWk: 341,
    plan: "£0 · pilot",
    webhook: "customer.subscription.updated",
    webhookAt: "12 JUN 04:02",
  },
  {
    id: "m2",
    name: "Fade & Co Barbers",
    city: "Leeds",
    kind: "Barbers",
    initials: "FC",
    owner: "book@fadeandco.uk",
    status: "active",
    note: "Since Mar 2026",
    joined: "02 MAR 2026",
    members: 96,
    stampsWk: 212,
    plan: "£29/mo",
    webhook: "invoice.paid",
    webhookAt: "01 JUN 06:14",
  },
  {
    id: "m3",
    name: "Crumb Bakery",
    city: "York",
    kind: "Bakery",
    initials: "CB",
    owner: "hi@crumbbakery.co.uk",
    status: "trial",
    note: "Pilot day 9/30",
    joined: "04 JUN 2026",
    members: 54,
    stampsWk: 147,
    plan: "£0 · pilot",
    webhook: "checkout.session.completed",
    webhookAt: "04 JUN 11:36",
  },
  {
    id: "m4",
    name: "The Brass Tap",
    city: "Manchester",
    kind: "Pub",
    initials: "BT",
    owner: "cellar@brasstap.pub",
    status: "past_due",
    note: "Invoice unpaid 9 days",
    joined: "12 JAN 2026",
    members: 88,
    stampsWk: 64,
    plan: "£29/mo",
    webhook: "invoice.payment_failed",
    webhookAt: "09 JUN 06:02",
  },
  {
    id: "m5",
    name: "Marigold Nails",
    city: "Sheffield",
    kind: "Salon",
    initials: "MN",
    owner: "studio@marigoldnails.uk",
    status: "suspended",
    note: "Paused 11 JUN",
    joined: "18 APR 2026",
    members: 37,
    stampsWk: 0,
    plan: "£29/mo",
    webhook: "customer.subscription.paused",
    webhookAt: "11 JUN 09:00",
  },
  {
    id: "m6",
    name: "Penny Lane Records Café",
    city: "Liverpool",
    kind: "Café",
    initials: "PL",
    owner: "counter@pennylanerecords.uk",
    status: "active",
    note: "Since Feb 2026",
    joined: "09 FEB 2026",
    members: 103,
    stampsWk: 198,
    plan: "£29/mo",
    webhook: "invoice.paid",
    webhookAt: "05 JUN 06:11",
  },
]
```

### `AD_FLAGS` (lines 35–43)

```jsx
const AD_FLAGS = [
  {
    id: "FR-0117",
    type: "high_stamp_velocity",
    venue: "Fade & Co Barbers",
    city: "Leeds",
    when: "12 JUN 10:42",
    detail:
      "23 stamps approved in 15 minutes from one staff PIN. Typical pace for this venue is about 4 an hour.",
    bars: [1, 1, 2, 1, 2, 3, 9, 12, 8, 2, 1, 1],
    window: "10:30 — 10:45 · stamps per minute",
  },
  {
    id: "FR-0102",
    type: "repeat_device_join",
    venue: "Crumb Bakery",
    city: "York",
    when: "09 JUN 16:20",
    detail:
      "4 join attempts from one device inside an hour. The rate limit held at 5 texts per 15 minutes — nothing got through twice.",
    bars: [1, 2, 1, 4, 3, 1, 1, 0, 1, 0, 1, 0],
    window: "15:20 — 16:20 · joins per 5 min",
    closed:
      "Dismissed · 09 JUN 17:01 · shared family tablet, confirmed with the venue",
  },
]
```

### `AD_AUDIT_BASE` (lines 45–53)

```jsx
const AD_AUDIT_BASE = [
  {
    ts: "12 JUN 09:58",
    who: "ops@nabaperks.co",
    what: "revealed staff PIN for The Old Crown · support ticket #482",
  },
  {
    ts: "12 JUN 04:00",
    who: "system",
    what: "nightly staff PIN rotation completed · 6 venues",
  },
  {
    ts: "11 JUN 17:12",
    who: "ops@nabaperks.co",
    what: "resent magic link to hello@oldcrown.pub",
  },
  {
    ts: "11 JUN 11:02",
    who: "ops@nabaperks.co",
    what: "paused programme for Marigold Nails · billing suspended",
  },
  {
    ts: "10 JUN 14:47",
    who: "ops@nabaperks.co",
    what: "regenerated venue QR for Crumb Bakery — old code honoured for 24h",
  },
  {
    ts: "10 JUN 09:05",
    who: "system",
    what: "Stripe sync replayed 2 missed webhook events",
  },
  {
    ts: "09 JUN 17:01",
    who: "ops@nabaperks.co",
    what: "dismissed fraud flag FR-0102 (repeat_device_join) · Crumb Bakery",
  },
]
```

> **Note on legacy naming:** the hardcoded `AD_AUDIT_BASE` and `AD_FLAGS` data reference "staff PIN" reveal/rotation and `high_stamp_velocity` from "one staff PIN". This is verbatim prototype content. Per `CLAUDE.md`, the production v3 design replaced the shared staff PIN with a counter handshake — so this demo copy is stale relative to the live product and would not survive `no-legacy-naming` checks. Quoted faithfully here, not endorsed.

## Source snippet — component signature + state + helpers (lines 131–181, verbatim)

```jsx
function AdminSurface({ t, go }) {
  const mo = t.mo;
  const [stage, setStage] = useStateAd(() => adLoad().stage || "gate");
  const [tab, setTab] = useStateAd(() => adLoad().tab || "overview");
  const [resolvedFlags, setResolvedFlags] = useStateAd(() => adLoad().resolvedFlags || {});
  const [pausedIds, setPausedIds] = useStateAd(() => adLoad().pausedIds || []);
  const [auditExtra, setAuditExtra] = useStateAd(() => adLoad().auditExtra || []);
  const [email, setEmail] = useStateAd("ops@nabaperks.co");
  const [otp, setOtp] = useStateAd("");
  const [sheetId, setSheetId] = useStateAd(null);
  const [toast, setToast] = useStateAd(null);

  useEffectAd(() => {
    localStorage.setItem(AD_LS, JSON.stringify({
      stage, tab, resolvedFlags, pausedIds,
      auditExtra: auditExtra.map(({ fresh, ...rest }) => rest),
    }));
  }, [stage, tab, resolvedFlags, pausedIds, auditExtra]);

  useEffectAd(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2600 * mo);
    return () => clearTimeout(id);
  }, [toast]);

  const act = (toastText, auditText) => {
    setAuditExtra((a) => [{ ts: "12 JUN · just now", who: "ops@nabaperks.co", what: auditText, fresh: true }, ...a]);
    setToast({ id: Date.now(), text: toastText });
  };

  const resolveFlag = (f, verdict) => {
    setResolvedFlags((r) => ({ ...r, [f.id]: verdict }));
    act(`Flag ${f.id} ${verdict.toLowerCase()}`,
      `${verdict === "Dismissed" ? "dismissed" : "marked as reviewed"} fraud flag ${f.id} (${f.type}) · ${f.venue}`);
  };

  const reset = () => {
    localStorage.removeItem(AD_LS);
    setStage("gate"); setTab("overview"); setResolvedFlags({}); setPausedIds([]);
    setAuditExtra([]); setOtp(""); setEmail("ops@nabaperks.co"); setSheetId(null); setToast(null);
  };

  const openFlags = AD_FLAGS.filter((f) => !f.closed && !resolvedFlags[f.id]);
  const selected = AD_MERCHANTS.find((m) => m.id === sheetId);
  const brand = (
    <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
      <span style={{ width: 26, height: 26, borderRadius: "50%", background: "var(--w-accent)", border: "2px solid var(--w-ink)", display: "inline-grid", placeItems: "center", color: "#fff", fontWeight: 800, fontSize: 13, transform: "rotate(-6deg)" }}>✱</span>
      <span style={{ fontWeight: 800, fontSize: 16.5, letterSpacing: "-0.01em" }}>nabaperks</span>
      <MonoTag tone="ink" style={{ marginLeft: 4 }}>Internal</MonoTag>
    </div>
  );
```

## Source snippet — gate stage (lines 185–221, verbatim) [representative; the faked-auth section]

```jsx
if (stage === "gate") {
  const ready = otp.length === 6 && email.includes("@")
  return (
    <div
      data-screen-label="Admin · Internal gate"
      style={{
        maxWidth: 430,
        margin: "0 auto",
        padding: "26px 20px 120px",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <div
        style={{ display: "flex", justifyContent: "center", marginBottom: 22 }}
      >
        {brand}
      </div>
      <div
        style={{
          background: "var(--w-paper-2)",
          border: "2px solid var(--w-ink)",
          borderRadius: "var(--w-r)",
          boxShadow: "var(--w-shadow-sm)",
          padding: "26px 22px",
          animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both`,
        }}
      >
        <MonoTag tone="ink">Internal · MFA required</MonoTag>
        <h1
          style={{
            fontSize: 30,
            fontWeight: 800,
            lineHeight: 1.05,
            margin: "14px 0 8px",
          }}
        >
          Internal only.
        </h1>
        <p
          style={{
            fontSize: 14.5,
            lineHeight: "21px",
            color: "var(--w-ink-soft)",
            margin: "0 0 20px",
          }}
        >
          Support console for Nabaperks staff. Every session — and every action
          inside it — lands in the audit log.
        </p>
        <MonoLine style={{ marginBottom: 7 }}>Work email</MonoLine>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@nabaperks.co"
          style={{
            width: "100%",
            padding: "14px 16px",
            fontSize: 18,
            fontFamily: "var(--w-mono)",
            color: "var(--w-ink)",
            background: "var(--w-paper)",
            border: "2px solid var(--w-ink)",
            borderRadius: "var(--w-r)",
            outline: "none",
          }}
        />
        <MonoLine style={{ margin: "16px 0 9px" }}>6-digit MFA code</MonoLine>
        <OtpBoxes value={otp} onChange={setOtp} />
        <div style={{ marginTop: 20 }}>
          <InkButton
            full
            variant="dark"
            disabled={!ready}
            onClick={() => {
              setStage("console")
              setToast({ id: Date.now(), text: "Signed in · session logged" })
            }}
          >
            Unlock console
          </InkButton>
        </div>
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <DemoTag onClick={() => setOtp("120626")}>Autofill MFA code</DemoTag>
        </div>
      </div>
      <MonoLine style={{ textAlign: "center", marginTop: 16, fontSize: 10 }}>
        Sessions idle out after 30 min · IP logged · ops only
      </MonoLine>
      <AdToast toast={toast} mo={mo} />
    </div>
  )
}
```

## Source snippet — console shell + tab switcher + sheet + toast (lines 223–227, 410–482) [trimmed; per-tab `body` blocks for Overview/Merchants/Billing/Audit/Fraud are built above lines 231–408 and omitted here]

```jsx
  /* ---------- stage: console ---------- */

  const tabs = ["overview", "merchants", "billing", "audit", "fraud"];
  const tabLabel = (k) => (k === "fraud" && openFlags.length ? `Fraud · ${openFlags.length}` : k);
  const audit = [...auditExtra, ...AD_AUDIT_BASE];

  let body = null;

  // … tab bodies for "overview" | "merchants" | "billing" | "audit" | "fraud" [trimmed] …

  return (
    <div data-screen-label={`Admin · ${tab}`} style={{ maxWidth: 1080, margin: "0 auto", padding: "26px 24px 120px", minHeight: "100vh" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
        {brand}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <MonoLine style={{ fontSize: 10 }}>ops@nabaperks.co</MonoLine>
          <GhostLink style={{ fontSize: 13.5 }} onClick={() => { setStage("gate"); setOtp(""); }}>Sign out</GhostLink>
          <DemoTag onClick={reset}>Restart flow</DemoTag>
        </div>
      </div>

      <div style={{ display: "inline-flex", gap: 3, flexWrap: "wrap", background: "var(--w-paper-2)", border: "2px solid var(--w-ink)", borderRadius: 999, padding: 4, marginBottom: 22 }}>
        {tabs.map((k) => (
          <button key={k} onClick={() => setTab(k)} style={{
            fontFamily: "var(--w-mono)", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.05em",
            padding: "9px 16px", borderRadius: 999, border: "none", cursor: "pointer", whiteSpace: "nowrap",
            background: tab === k ? "var(--w-ink)" : "transparent", color: tab === k ? "var(--w-paper)" : "var(--w-ink-soft)",
          }}>{tabLabel(k)}</button>
        ))}
      </div>

      <div key={tab} style={{ animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both` }}>
        {body}
      </div>

      <Sheet open={!!selected} onClose={() => setSheetId(null)} mo={mo}>
        {selected && (
          <div data-screen-label="Admin · merchant detail">
            {/* VenueMark + name/kind/note + AdStatusTag header [trimmed] */}
            {/* 2×2 AdFact grid: Owner / Joined / Members / Stamps · 7d [trimmed] */}
            <ReceiptRule />
            <MonoLine style={{ marginBottom: 10 }}>Support actions · every one is audited</MonoLine>
            {/* Resend magic link · Regenerate QR · Pause/Resume programme InkButtons [trimmed] */}
            {selected.id === "m1" && (
              <div style={{ textAlign: "center", marginTop: 10 }}>
                <GhostLink style={{ fontSize: 13.5 }} onClick={() => go("Merchant", "today")}>
                  Open their merchant dashboard →
                </GhostLink>
              </div>
            )}
          </div>
        )}
      </Sheet>

      <AdToast toast={toast} mo={mo} />
    </div>
  );
}
```

## Reuse notes

This is a demo harness, not a console to ship. To extract value: lift the **section layout** (KPI grid, attention list, the three table shapes, the fraud-flag card, the merchant sheet) into separate components; replace `localStorage` mock state with server data; replace the faked gate with real Supabase Auth + MFA + RLS; turn `AD_MERCHANTS`/`AD_FLAGS`/`AD_AUDIT_BASE` into queries against `merchants`/`fraud_flags`/`audit_logs`; and route the support actions (resend link, regenerate QR, pause programme, resolve flag) through audited server actions/RPCs rather than local `act()` toasts. The visual language (quiet paper-2 panels, hard borders, mono table headers) is the keeper.

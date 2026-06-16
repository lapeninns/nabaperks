# MerchantQrStudio

- **Surface:** merchant (full screen — QR studio / print assets)
- **Source module:** [extracted-source/21-merchant-ops.jsx](../../extracted-source/21-merchant-ops.jsx) (lines 345–417)
- **Export:** `window.MerchantQrStudio` (via `Object.assign(window, …)` at module foot)
- **Reuse verdict:** 🔒 Prototype-only (faked downloads via `setTimeout`, hardcoded scan count + URL, motion multiplier, global export). The asset-grid + preview-card layout is a reusable pattern.

## Visual purpose

The print-asset studio inside `MerchantSurface`. `MoHead` titled "QR studio" with a right slot showing a big "86" scans count and a `MoToggle` (QR live/paused). Below: a status line, a "Paused, not broken." explainer card (only when off), and a responsive grid of three asset cards — each a tilted preview (`MoPosterPreview` / `MoTillPreview` / `MoStickerPreview`), a name + spec + blurb, and PNG / Print-PDF download buttons. A footer rule, the destination URL, and a "Scan it as a customer" `DemoTag`.

## Props / state

| Prop | Type                      | Notes                                                                                 |
| ---- | ------------------------- | ------------------------------------------------------------------------------------- |
| `t`  | theme object              | Reads `t.mo` (motion multiplier; scales all animations and the fake-download timers). |
| `go` | `(screen, state) => void` | Navigation fn from host. Called as `go("Customer", "landing")`.                       |

**State (local):**

- `const [dl, setDl] = useStateMo({})` — per-button download status map, values `"prep" | "done"` keyed by `id + "png"` / `id + "pdf"`.
- `const [qrOn, setQrOn] = useStateMo(true)` — whether the QR is "live".

## UX behaviour & navigation

- **`download(key)`** (lines 350–355) — **prototype-ism, faked async**:
  ```jsx
  const download = (key) => {
    if (dl[key]) return
    setDl((d) => ({ ...d, [key]: "prep" }))
    setTimeout(() => setDl((d) => ({ ...d, [key]: "done" })), 850 * mo)
    setTimeout(
      () =>
        setDl((d) => {
          const n = { ...d }
          delete n[key]
          return n
        }),
      2600 * mo
    )
  }
  ```
  Sets `"prep"`, flips to `"done"` after `850 * mo` ms, then clears after `2600 * mo` ms. No file is produced.
- **`lbl(key, base)`** maps status → button label: `"prep" → "Preparing…"`, `"done" → "Downloaded ✓"`, else `base` (`"PNG"` / `"Print PDF"`). Buttons disable while `"prep"`.
- **`MoToggle`** flips `qrOn`. When off: assets dim to `opacity: 0.55`, status line reads "QR paused", and the "Paused, not broken." card appears (`w-rise`).
- **"Scan it as a customer"** (`DemoTag`) → `go("Customer", "landing")`.
- Screen wrapper `w-rise` entrance; `data-screen-label="Merchant · QR studio"`.

## Hardcoded demo data

- Scan count: literal **`86`** with sub "Scans this week".
- Destination URL: literal **`nabaperks.app/m/old-crown`**.
- **`MO_ASSETS`** (lines 339–343) — the three print assets, each pairing a preview component:
  ```jsx
  const MO_ASSETS = [
    {
      id: "poster",
      name: "Counter poster",
      sub: "A4 for the till, tables, and the door.",
      spec: "A4 · 300dpi",
      Preview: MoPosterPreview,
    },
    {
      id: "till",
      name: "Till card",
      sub: "Lands beside the card machine.",
      spec: "148×105mm",
      Preview: MoTillPreview,
    },
    {
      id: "sticker",
      name: "Sticker",
      sub: "Round vinyl for windows and trays.",
      spec: "60mm round",
      Preview: MoStickerPreview,
    },
  ]
  ```

## Dependencies

- **Local sub-primitives:** `MoHead`, `MoToggle`, plus the preview components `MoPosterPreview` / `MoTillPreview` / `MoStickerPreview` (via `MO_ASSETS`).
- **Shared primitives (window):** `InkButton`, `MonoLine`, `DemoTag`, `ReceiptRule`. (Previews also pull `QrBlock`, `VenueMark`.)
- **CSS variables:** `--w-mono`, `--w-ink-soft`, `--w-r`.
- **Keyframes:** `w-rise` (screen entrance + paused-card entrance).
- **localStorage:** none.
- **Globals / window:** reads `React` (`useStateMo`); writes `window.MerchantQrStudio`.
- **Mocks:** `setTimeout`-driven fake downloads (see `download` above) — both timers scaled by `mo`.

## Reuse notes

The "one permanent code, reprints never invalidate it" framing and the paused-state messaging are strong product references. To productionise: wire real asset generation (replacing the `setTimeout` fakes and `Downloaded ✓` flash), source the scan count and venue URL from data, parameterise the previews, drop the `mo` multiplier for motion tokens, and export properly. Note the rate-limit copy ("60 scans/min — never near it") and the QR-redirect promise are demo claims to verify against the real backend.

## Source snippet

```jsx
function MerchantQrStudio({ t, go }) {
  const mo = t.mo
  const [dl, setDl] = useStateMo({})
  const [qrOn, setQrOn] = useStateMo(true)

  const download = (key) => {
    if (dl[key]) return
    setDl((d) => ({ ...d, [key]: "prep" }))
    setTimeout(() => setDl((d) => ({ ...d, [key]: "done" })), 850 * mo)
    setTimeout(
      () =>
        setDl((d) => {
          const n = { ...d }
          delete n[key]
          return n
        }),
      2600 * mo
    )
  }
  const lbl = (key, base) =>
    dl[key] === "prep"
      ? "Preparing…"
      : dl[key] === "done"
        ? "Downloaded ✓"
        : base

  return (
    <div
      data-screen-label="Merchant · QR studio"
      style={{ animation: `w-rise ${380 * mo}ms cubic-bezier(0.2,0,0,1) both` }}
    >
      <MoHead
        title="QR studio"
        sub="One permanent code — reprints never invalidate it"
        right={
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ textAlign: "right" }}>
              <div
                style={{
                  fontFamily: "var(--w-mono)",
                  fontSize: 21,
                  fontWeight: 700,
                  lineHeight: 1,
                }}
              >
                86
              </div>
              <MonoLine style={{ fontSize: 9, marginTop: 3 }}>
                Scans this week
              </MonoLine>
            </div>
            <MoToggle on={qrOn} onClick={() => setQrOn(!qrOn)} mo={mo} />
          </div>
        }
      />
      {/* … status line + "Paused, not broken." card (when !qrOn) [trimmed] … */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
          gap: 22,
          opacity: qrOn ? 1 : 0.55,
          transition: `opacity ${220 * mo}ms`,
        }}
      >
        {MO_ASSETS.map(({ id, name, sub, spec, Preview }) => (
          <div
            key={id}
            style={{ display: "grid", gap: 14, alignContent: "start" }}
          >
            <div style={{ padding: "8px 6px" }}>
              <Preview />
            </div>
            <div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  gap: 8,
                }}
              >
                <div style={{ fontWeight: 800, fontSize: 16.5 }}>{name}</div>
                <MonoLine style={{ fontSize: 9.5 }}>{spec}</MonoLine>
              </div>
              <div
                style={{
                  fontSize: 13,
                  color: "var(--w-ink-soft)",
                  marginTop: 3,
                }}
              >
                {sub}
              </div>
            </div>
            <div style={{ display: "flex", gap: 9 }}>
              <InkButton
                size="sm"
                variant="outline"
                disabled={dl[id + "png"] === "prep"}
                onClick={() => download(id + "png")}
              >
                {lbl(id + "png", "PNG")}
              </InkButton>
              <InkButton
                size="sm"
                variant="dark"
                disabled={dl[id + "pdf"] === "prep"}
                onClick={() => download(id + "pdf")}
              >
                {lbl(id + "pdf", "Print PDF")}
              </InkButton>
            </div>
          </div>
        ))}
      </div>
      <ReceiptRule style={{ margin: "26px 0 16px" }} />
      <div
        style={{
          display: "flex",
          gap: 14,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <MonoLine style={{ fontSize: 10 }}>
          Points to nabaperks.app/m/old-crown · printed copies never expire
        </MonoLine>
        <DemoTag onClick={() => go("Customer", "landing")}>
          Scan it as a customer
        </DemoTag>
      </div>
    </div>
  )
}
```

_(Status line + "Paused, not broken." explainer card marked `[trimmed]`; verbatim copy is in the aggregation `Copy strings` section.)_

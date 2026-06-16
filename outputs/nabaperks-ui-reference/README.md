# Nabaperks UI Reference Library

A **read-only reference library** extracted from the prototype artifact `Nabaperks Full Flow.html` (titled _"Nabaperks v2 — Full Flow (Wet Ink)"_). Every reusable UX/UI component in that single-file prototype has been unpacked, named, documented, and catalogued here so it can be inspected without running the bundle.

> ⚠️ **This is reference material, not production source of truth.**
> The artifact is a **visual/interaction prototype** built with in-browser Babel, inline styles, `window.*` globals, and `localStorage`-backed mock state. Nothing here is wired to a backend, and the code style is deliberately prototype-grade. For what the product actually does today, the real repo's `docs/ARCHITECTURE.md` and `docs/PROJECT_SPEC.md` remain the source of truth. Treat this folder as a **design/interaction reference**, not as importable code.

---

## How the artifact was decoded

The HTML file is a **self-unpacking bundle**, not plain markup. Its `<body>` carries three data `<script>` blocks plus a loader:

| Block              | `type`                    | Contents                                                                    |
| ------------------ | ------------------------- | --------------------------------------------------------------------------- |
| Manifest           | `__bundler/manifest`      | JSON map of `UUID → { mime, compressed (gzip), data (base64) }` — 22 assets |
| External resources | `__bundler/ext_resources` | empty `[]`                                                                  |
| Template           | `__bundler/template`      | a JSON-encoded HTML string (the real page) with UUID placeholders           |

At runtime the loader base64-decodes each asset, gunzips the compressed ones into `Blob` URLs, substitutes the UUIDs in the template with those blob URLs, re-parses the document, and re-executes the scripts (React → ReactDOM → Babel → the `text/babel` app modules in order).

To extract, [extracted-source/](extracted-source/) was produced by reversing exactly that: decode base64 → gunzip → write each asset to a readable file, and JSON-decode the template. The exact, re-runnable decoder is saved at [`extracted-source/decode.cjs`](extracted-source/decode.cjs) (`node decode.cjs`), and [`extracted-source/_manifest-report.json`](extracted-source/_manifest-report.json) holds the raw asset table.

### What the 22 assets are

- **3 vendor libraries** — `vendor-react.development.js`, `vendor-react-dom.development.js`, `vendor-babel-standalone.js` (unmodified; documented only as dependencies, not catalogued).
- **9 web-font files** — Bricolage Grotesque (display) + Space Mono (mono), 3 unicode subsets each.
- **10 application modules** — the actual prototype source (≈220 KB of JSX), listed below.

### The 10 application modules (load order = template order)

| File                                                            | Module role                                                             | Surface folder                 |
| --------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------ |
| [`00-tweaks-panel.jsx`](extracted-source/00-tweaks-panel.jsx)   | Design-control scaffold ("Tweaks" panel + form controls)                | `components/tweaks/`           |
| [`10-primitives.jsx`](extracted-source/10-primitives.jsx)       | Shared Wet Ink primitives (buttons, stamps, sheet, seal…)               | `components/shared/`           |
| [`30-customer.jsx`](extracted-source/30-customer.jsx)           | Customer self-serve journey (the star of the flow)                      | `components/customer/`         |
| [`20-merchant-core.jsx`](extracted-source/20-merchant-core.jsx) | Merchant surface owner: auth → onboarding → app                         | `components/merchant/`         |
| [`21-merchant-ops.jsx`](extracted-source/21-merchant-ops.jsx)   | Merchant ops screens: activity, customers, QR studio, settings, billing | `components/merchant/`         |
| [`22-staff-counter.jsx`](extracted-source/22-staff-counter.jsx) | Staff counter station (the till tab)                                    | `components/staff/`            |
| [`40-admin.jsx`](extracted-source/40-admin.jsx)                 | Internal admin/support console                                          | `components/admin/`            |
| [`50-marketing.jsx`](extracted-source/50-marketing.jsx)         | Marketing site: home / pricing / legal                                  | `components/marketing/`        |
| [`60-journey.jsx`](extracted-source/60-journey.jsx)             | Full-flow storyboard + front door                                       | `components/journey/`          |
| [`90-app-shell.jsx`](extracted-source/90-app-shell.jsx)         | Surface switcher + Tweaks wiring + `go()` deep-link                     | `components/shared/` (`V3App`) |

> The numeric filename prefixes are this library's naming, derived from each module's own header comments and the template's load order. The originals were referenced internally as e.g. `tweaks-panel.jsx`, `20-merchant-core`, `21-merchant-ops`, `40-admin.jsx`, `60-journey.jsx`.

---

## Folder map

```
nabaperks-ui-reference/
  README.md                 ← you are here
  component-inventory.md     ← master table of all 94 components + reuse verdicts
  design-system.md           ← tokens, type, spacing, motion, states, layout patterns
  copy-inventory.md          ← every user-facing string / CTA, grouped by surface
  flows.md                   ← state machines, navigation, localStorage, mocks
  extracted-source/          ← decoded, renamed, unmodified source (10 app modules + vendor + fonts)
  components/
    shared/      (18)   InkButton, StampDisc, Sheet, Seal, GpsCheck, … + V3App shell
    customer/    (13)   CustomerFlow + 11 screen states + CuScanView
    merchant/    (24)   MerchantSurface + stages + ops screens + Mo* sub-primitives
    staff/       (5)    StaffSurface + St* parts
    admin/       (7)    AdminSurface + Ad* sub-primitives
    marketing/   (9)    MarketingSite + Mk* pages/parts
    journey/     (6)    JourneyMap + Jy* storyboard parts
    tweaks/      (12)   TweaksPanel + Tweak* controls (design-control scaffold)
```

**94 component reference files** across **8 surfaces**.

## How to read a component reference file

Every file under `components/**` follows the same shape:

- **Metadata block** — Surface · Source module (linked, with line range) · Export (`window.*` / local-only) · **Reuse verdict**.
- **Visual purpose** — what it looks like and why it exists.
- **Props / state** — inferred props table + the hooks/state it holds.
- **UX behaviour** — interactions, animation, transitions, timings.
- **Dependencies** — shared primitives, CSS variables, keyframes, `localStorage`, globals.
- **Reuse notes** — as-is / refactor / prototype-only and what would need to change.
- **Source snippet** — faithful, verbatim JSX (trimmed with `[trimmed]` markers for large components).

### Reuse verdict legend

| Marker                      | Meaning                                                                                        |
| --------------------------- | ---------------------------------------------------------------------------------------------- |
| ✅ Reusable as-is           | Visual + behaviour port cleanly; only the export/style mechanism is prototype-grade            |
| ⚠️ Reusable, needs refactor | Sound concept, but inline styles / `window.*` export / missing a11y / reduced-motion need work |
| 🔒 Prototype-only           | Mock data, faked timing, localStorage state machine, or scaffold — reference only              |

---

## Design language (at a glance)

**Wet Ink (Honey & Ink v2)** — a riso-print / rubber-stamp direction: warm paper, near-black ink, one hot accent (vermillion `#E8430F` by default), hard offset shadows, almost everything rotated a few degrees. Display type is **Bricolage Grotesque**, mono is **Space Mono**. Copy is plain, warm, British (en-GB) — **no emoji, no exclamation marks** (the `✱ ? ✓ ▸ ⌫` characters are glyphs/icons, not emoji). Full breakdown in [design-system.md](design-system.md).

## Constraints honoured during extraction

- **Faithful to the artifact** — code is quoted verbatim; nothing was modernised, re-styled, or "fixed".
- **No invented behaviour** — no backend/API was inferred; unknowns are marked "unclear from source".
- **Not connected to production** — these files are inert documentation.
- **Prototype-isms are labelled** — mock timers, faked OTP/PIN, hardcoded datasets, and retired mechanics (e.g. the handed-phone staff PIN) are flagged where they appear.

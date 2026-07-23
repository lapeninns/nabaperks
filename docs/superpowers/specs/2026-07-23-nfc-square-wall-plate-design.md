# NFC square wall plate redesign (100 × 100 mm)

**Date:** 2026-07-23  
**Status:** Approved for planning (pending user review of this spec)  
**Scope:** One-sided Wet Ink `nfc-square` design `tap` — billboard stack for wall mounting  
**Out of scope:** Second face, new design IDs, manufacturer plant pack / bleed package, CR80 card changes

---

## 1. Problem

The current 100 × 100 mm plate is a thin counter TAP field: brand eyebrow, TAP seal, cryptic stamp cue, and corner QR. On a **wall** it fails to:

1. Stop walkers with **venue pride** as the hero signal
2. Explain **why** to tap (mystery / loyalty benefit)
3. Show **how** joining works (steps + honest first-stamp copy)
4. Surface friction and terms that already exist in content but are not drawn on the die

CR80 already carries richer journey copy; the square plate should match that conversion job without copying the landscape card layout.

---

## 2. Goals and constraints

### Goals

- Wall-first: venue name is the largest signal on the die
- Full content kit on one face: mystery, 3 steps, stamp track, QR, friction, terms
- Honest join copy aligned with OTP funnel
- React preview and PDF print parity
- Type ≥ 6.5 pt floor; native `@page { size: 100mm 100mm }`
- Printed QR tagged with `?src=qr` (parity with CR80); NDEF target remains the same join path as today (shared URL policy)

### Constraints

- Wet Ink system only (tokens, fonts, hard offset shadows — no `filter: drop-shadow` on the sheet)
- One-sided; catalogue remains design id `tap` only
- British English; no free-stamp or “already stamped” claims
- Placeholders `{stamps}` / `{StampsWord}` for 1–6 only

### Non-goals

- Multi-design A/B catalogue
- Separate wall vs till design ids
- Changing join funnel behaviour

---

## 3. Placement and hierarchy

**Placement:** Premises wall (not till-only). Read order:

1. Across the room — venue name
2. Approach — TAP seal + join line
3. Close — mystery, steps, track, QR, legal

**Approach:** Billboard stack (three horizontal bands).

| Band   | Approx. height | Job                                        |
| ------ | -------------- | ------------------------------------------ |
| Hero   | ~28 mm         | Venue pride + Nab a Perks mark             |
| Action | ~36 mm         | TAP convert + honest claim                 |
| Proof  | ~36 mm         | Mystery, steps, track, QR, friction, terms |

Bands may use hairline ink rules or paper-deep fills to separate; do not use card-in-card stacks that fight the single composition.

---

## 4. Locked copy

| Slot             | Copy                                                             |
| ---------------- | ---------------------------------------------------------------- |
| Eyebrow          | `Venue loyalty`                                                  |
| Brand            | `Nab a Perks`                                                    |
| Venue            | `{merchantName}` (hero type)                                     |
| Tap word         | `TAP`                                                            |
| Tap sub          | `Phone here`                                                     |
| Claim line       | `Tap to join — today's stamp after one text`                     |
| Mystery kicker   | `Mystery inside`                                                 |
| Mystery accent   | `Unlock at {stamps}`                                             |
| Flow             | `Tap` · `Stamp` · `Unlock` (numbered 1–3)                        |
| Stamp track      | `01` active · `02` · `{stamps} = reward` (mirror CR80 semantics) |
| Friction         | `No app · One text · In your browser`                            |
| Terms / die rule | `One stamp per UK day · 18+ to redeem`                           |
| QR friction      | `No NFC? Scan the code`                                          |
| Cut label        | `Square 100 × 100 mm · print at 100%`                            |

Catalogue `shared.reassurance` may remain for email/kit contexts; the **printed** terms line is the shorter die rule above.

---

## 5. Visual system

- Paper `#f6f1e6`, paper-deep `#ece5d4`, ink `#211c16`, accent `#cf330a`, sun `#f5a623`, white QR well
- Fonts: Bricolage Grotesque (display), Space Mono (meta)
- Vermillion TAP seal with hard box-shadow offset (not CSS `filter: drop-shadow` on wrappers)
- Hero band: paper-deep strip; venue uppercase or title-case per existing merchant name casing rules — prefer strong display weight, ellipsis if overlength
- Proof band: receipt-like calm block; stamp track as a compact horizontal meter; QR ≥ catalogue `qrOuterMm` (20 mm) with quiet zone

Screen preview: native millimetre size (no transform-scale sheet wrapper that ghosts type). Scroll the stage if the viewport is smaller than 100 mm.

---

## 6. Content schema changes

Bump `config/nfc-square-designs.json` collection `revision` (5). Expand `front` for design `tap`:

**Existing (keep):** `brandEyebrow`, `brandName`, `tapWord`, `tapSub`  
**Replace / drop on-die:** cryptic `stampCue` as sole lower copy

**Add to `front`:**

- `claimLine` (string)
- `mysteryKicker` (string)
- `mysteryAccent` (string, may include `{stamps}`)
- `flow` (exactly three short strings)

**Add to `shared`:**

- `dieRule`: `One stamp per UK day · 18+ to redeem`

**Stamp track:** Resolve in content code from `stampsRequired` the same way CR80 does (active `01`, next hollow, final `{stamps} = reward`) — not a free-form catalogue string. Drop on-die reliance on the old cryptic `stampCue` field (remove from catalogue or leave unused and assert unused in contracts).

Update:

- `lib/qr/nfc-square-content-types.ts`
- `lib/qr/nfc-square-content-readers.ts`
- `lib/qr/nfc-square-content.ts`
- Contracts in `tests/contracts/nfc-square-designs-catalog.test.mjs` and unit design tests

Tone / useCase metadata: rename use case copy from “Counter and till” to **wall and premises plate** (still production rollout).

---

## 7. Implementation surfaces

| Surface            | Path / module                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------ |
| React face         | `components/merchant/qr-poster/nfc-square/nfc-square-front.tsx` + CSS                                  |
| Sheet / print page | `nfc-square-sheet.tsx`, `a4-nfc-square.tsx` + CSS (`@page 100mm 100mm`)                                |
| PDF                | `lib/notifications/nfc-square-pdf-sheet.ts` (+ render entry) — redraw three bands                      |
| Preview            | `/dev/nfc-square-preview`                                                                              |
| Merchant           | `/app/qr/nfc-square/[design]`                                                                          |
| Share URL          | Append `?src=qr` for **printed** QR only via existing `appendQrShareChannel` helper                    |
| Tracking           | Keep `nfc_square` print analytics; do not invent new asset types unless required by existing contracts |

---

## 8. Testing

- Catalogue schema accepts new front fields; rejects unresolved placeholders
- Unit: content resolution for stamps 1–6
- Unit: PDF builds one-page 100×100 for production design
- Contract: floor type ≥ 6.5 pt in catalogue `typeTiersPt`
- Contract: no A4 origin geometry; sheet remains `square-100`
- Manual: `/dev/nfc-square-preview?design=tap` — bands readable; hard refresh after CSS changes

---

## 9. Success criteria

- Venue name is unmistakably the wall hero
- A guest can answer: what is this, why tap, what happens next, how to join without NFC
- Copy does not claim a stamp before OTP
- Print at 100% matches preview structure
- Quality gate for touched NFC-square tests passes

---

## 10. Decisions log

| Decision            | Choice                    |
| ------------------- | ------------------------- |
| Placement           | Premises wall             |
| Hook                | Brand / venue pride led   |
| Content density     | Full kit                  |
| First-stamp promise | Honest OTP line           |
| Layout              | Billboard stack (3 bands) |
| Faces               | One-sided only            |

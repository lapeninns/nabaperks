# NFC Square Wall Plate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the one-sided 100×100 mm NFC plate as a wall-first billboard stack with full honest join copy, React↔PDF parity, and `?src=qr` on printed QR.

**Architecture:** Expand `nfc-square-designs` catalogue + content types; rebuild `NfcSquareFront` into hero / action / proof bands; redraw `drawNfcSquarePage`; drop transform-scale preview chrome; tag share URLs with `appendQrShareChannel(..., "qr")`.

**Tech Stack:** Next.js App Router, CSS modules, pdf-lib, existing `lib/qr/nfc-square-*` resolvers, Vitest-style `node:test` unit/contracts.

**Spec:** `docs/superpowers/specs/2026-07-23-nfc-square-wall-plate-design.md`

## Global Constraints

- Wet Ink only; type floor ≥ 6.5 pt; native `@page 100mm 100mm`
- One face; design id `tap` only; British English; no free-stamp claims
- Honest claim: `Tap to join — today's stamp after one text`
- No `filter: drop-shadow` on sheet wrappers
- Printed QR uses `?src=qr`; NDEF/join URL policy otherwise unchanged

## File map

| File                                                  | Role                          |
| ----------------------------------------------------- | ----------------------------- |
| `config/nfc-square-designs.json`                      | Copy + `dieRule` + revision 5 |
| `lib/qr/nfc-square-content-types.ts`                  | Front + base types            |
| `lib/qr/nfc-square-content-readers.ts`                | `nfcSquareDieRule()`          |
| `lib/qr/nfc-square-content.ts`                        | Resolve new front fields      |
| `components/.../nfc-square-front.tsx` + CSS           | Billboard UI                  |
| `components/.../a4-nfc-square.tsx` + CSS              | Native preview (no scale)     |
| `lib/notifications/nfc-square-pdf-sheet.ts`           | PDF bands                     |
| `app/dev/nfc-square-preview/page.tsx`                 | `?src=qr`                     |
| `app/app/qr/nfc-square/[design]/page.tsx`             | `?src=qr`                     |
| `tests/unit/nfc-square-designs.test.mjs`              | Content assertions            |
| `tests/contracts/nfc-square-designs-catalog.test.mjs` | Catalogue assertions          |
| `tests/unit/nfc-square-pdf.test.mjs`                  | PDF still builds              |

---

### Task 1: Catalogue + content model

**Files:**

- Modify: `config/nfc-square-designs.json`
- Modify: `lib/qr/nfc-square-content-types.ts`
- Modify: `lib/qr/nfc-square-content-readers.ts`
- Modify: `lib/qr/nfc-square-content.ts`
- Modify: `tests/unit/nfc-square-designs.test.mjs`
- Modify: `tests/contracts/nfc-square-designs-catalog.test.mjs`

- [ ] Update catalogue revision to 5, add `shared.dieRule`, expand `front` (claimLine, mysteryKicker, mysteryAccent, flow[3]), remove `stampCue`, update useCase/description for wall
- [ ] Update types and resolver; add `dieRule` on content base
- [ ] Update unit + contract tests; run them until green

### Task 2: React billboard face + preview chrome

**Files:**

- Modify: `nfc-square-front.tsx` + `.module.css`
- Modify: `a4-nfc-square.tsx` + `.module.css`

- [ ] Three-band layout; venue hero; TAP + claim; proof (mystery, flow, stamp track from `stampsRequired`, QR, friction, dieRule)
- [ ] Native mm preview without transform scale / drop-shadow filter

### Task 3: PDF parity + share URL

**Files:**

- Modify: `lib/notifications/nfc-square-pdf-sheet.ts`
- Modify: preview + merchant nfc-square pages
- Test: `tests/unit/nfc-square-pdf.test.mjs`

- [ ] Redraw PDF to match three bands; claimFriction ≥ 6.5 pt
- [ ] `appendQrShareChannel(url, "qr")` on printed QR generation
- [ ] Run NFC square unit/contract/pdf tests

---

**Execution:** User asked to implement immediately — proceed inline in this session (executing-plans style), skip commit steps unless asked.

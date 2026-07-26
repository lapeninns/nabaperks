# Print kit design system

Date: 2026-07-26
Status: approved (design)

## Problem

The print kit ships 15 artifacts — 8 A4 counter posters, 5 A4 table tents, 2 NFC
formats. An audit of the production export for Barley Mow found 17 confirmed
defects. Every one of them traces to the same absence: there is no shared print
design system beneath the artifacts. Each design invents its own margins, its own
vertical spacing and its own stamp metaphor, and nothing checks the result.

Two further facts shape the response:

- `scripts/verify-poster-pdfs.mjs` already exists, already asserts safe frames,
  and is wired into **no** workflow — it is a package script only.
- That verifier measures text against the **page** safe frame. It is structurally
  blind to the defect classes that actually shipped.

## Audit findings

Confirmed by rendering the production PDFs at 100–400 dpi and by measurement.

### Hard defects (17)

| #   | Artifact         | Defect                                                                 | Evidence     |
| --- | ---------------- | ---------------------------------------------------------------------- | ------------ |
| 1   | `primer`         | Ruled lines strike through all four description lines                  | 200 dpi crop |
| 2   | `primer`         | Row 04's description is guillotined by the section rule                | 200 dpi crop |
| 3   | `seal`           | Empty outlined tint box top-left — a redaction bar with no content     | 200 dpi crop |
| 4   | `seal`           | Broken glyph fragment (arc + two strokes) beside "No 10"               | 200 dpi crop |
| 5   | `chalk`          | Smiley roundel stroke crosses the "d" of "reward"                      | 250 dpi crop |
| 6   | `chalk`          | Two mismatched underlines (red + orange, differing length and angle)   | 100 dpi      |
| 7   | `chalk`          | All three cut-stubs read "START TODAY" for stamps 1/2/3                | 100 dpi      |
| 8   | `pinned`         | Six stub cells all repeat "STAMP ONE STARTS TODAY"                     | 100 dpi      |
| 9   | `pinned`         | Stray white card fragment at the right edge                            | 100 dpi      |
| 10  | `tally`          | Orphan grey circle clipped behind the card                             | 100 dpi      |
| 11  | `tally`          | Says "circle one" where every other artifact says "stamp"              | 100 dpi      |
| 12  | `window`         | Crop marks, registration targets and colour bar baked into artwork     | 100 dpi      |
| 13  | `lastcall`       | "TODAY ONLY" badge floats into the body column; icon cluster unaligned | 100 dpi      |
| 14  | `tent-classic`   | "UNLOCK. / YOUR. / REWARD." — "YOUR." is not a sentence                | 100 dpi      |
| 15  | `tent-welcome`   | Bunting string clipped by the header band / running off the sheet      | 100 dpi      |
| 16  | `tent-today`     | Corner triangles hang outside the face boundary                        | 100 dpi      |
| 17  | `nfc-tap` (back) | "At stamp 3" is clipped by the red roundel                             | 400 dpi crop |

Plus two structural faults:

- `nfc-square` shows stamp chips `01`, `02` only — for a **3**-stamp card — then
  jumps to "3 = REWARD".
- Both NFC formats have **no bleed**: page size equals trim exactly
  (242.362 × 153.071 pt and 283.465 pt square), so trim variance shows a white
  sliver against the full-bleed red panel.

### Retracted during measurement

Two initial calls did not survive checking and are recorded so they are not
re-raised:

- **`receipt` margins are correct.** The paper container runs 35.0–174.7 mm; text
  sits at 43.0–167.0 mm — an 8.0 mm / 7.7 mm symmetric inset.
- **`seal`'s rule overflow is ~0.6 mm**, a dash-pattern end, not a defect.

### QR scannability

Computed from the `qrcode` library at the catalogue's **actual** settings — error
correction level **H**, 4-module quiet zone per side — across the realistic range
of share-URL lengths. Module size in mm:

| Format     | Outer | 40 ch (37 mod) | 52 ch (41 mod) | 72 ch (49 mod) | Verdict         |
| ---------- | ----- | -------------- | -------------- | -------------- | --------------- |
| Poster     | 54 mm | 1.200          | 1.102          | 0.947          | fine            |
| Tent       | 40 mm | 0.889          | 0.816          | 0.702          | fine            |
| NFC card   | 18 mm | **0.400**      | **0.367**      | **0.316**      | far under floor |
| NFC square | 20 mm | **0.444**      | **0.408**      | **0.351**      | far under floor |

At EC-H worst case (49 modules) a 0.5 mm module needs a **28.5 mm** outer box —
over half the height of an 85.6 × 54 mm card. Enlarging the QR alone cannot fix
the NFC formats. See "Owed decision" below.

### Brand lockup

Three lockups exist for one brand. `Nabaperks` is canonical — 205 uses across the
product — and all 19 divergent spellings (`Nab a Perks` ×16, `NABAPERKS` ×3) are
inside the print kit. The print kit is the only place the brand is wrong.

## Root cause

Five systemic absences produce all 17 defects:

1. **No shared page grid.** Margins are invented per design.
2. **No vertical rhythm.** 20–30% of the sheet is dead space on `lastcall`,
   `tally`, `tent-today`, `tent-sealed` and `nfc-square`.
3. **No collision or clip guard.** Nothing prevents a rule crossing a text run
   (#1, #2), a shape crossing a glyph (#5, #17), or a decoration escaping its
   container (#9, #10, #15, #16).
4. **No shared stamp component.** Five metaphors across one kit.
5. **Two render paths that drift** — `components/merchant/qr-poster/**` (React
   preview) and `lib/notifications/*-pdf*.ts` (pdf-lib print).

## Design

### Geometry

| Format       | Trim                 | Bleed    | Margin                       | Live area   |
| ------------ | -------------------- | -------- | ---------------------------- | ----------- |
| A4 poster    | 210 × 297            | —        | 18 mm                        | 174 × 261   |
| A4 tent face | 210 × 148.5          | —        | 12 mm + 10 mm fold-safe band | 186 × 112.5 |
| NFC card     | 85.6 × 54 (ISO ID-1) | **3 mm** | 4 mm from trim               | 77.6 × 46   |
| NFC square   | 100 × 100            | **3 mm** | 5 mm from trim               | 90 × 90     |

A 12-column grid on the live width. The QR column starts on a grid line.

The A4 margin is a deliberate change from the catalogue's current
`safeMarginMm: 15`. `assertPosterLayoutGeometry` reads that value from the
catalogue, so the existing verifier follows the new margin automatically.

### Rhythm

The existing type tiers are good and contract-pinned (`POSTER_PDF_TYPE`: 12 pt
body, 1.4 leading, display leading 1.06) and are retained. What is missing is a
spacing scale. Derive it from body leading: `12 × 1.4 = 16.8 pt ≈ 5.9 mm` →
**6 mm base unit**. Permitted gaps: 6 / 12 / 18 / 24 / 36 mm. Nothing else.

### Zones

Every A4 sheet composes five zones against a fixed chrome budget:

```
18  top margin
 8  RAIL       eyebrow + kit number
12  gap
??  STATEMENT  headline              <- absorbs all slack
18  gap
??  PROOF      sub-copy + friction   <- takes 24-40mm as needed
18  gap
64  ACTION     QR + scan CTA + venue <- RESERVED, never yields
12  gap
14  LEGAL      18+ / terms
18  bottom margin
---
182mm fixed chrome + 115mm shared between STATEMENT and PROOF
```

The sheet is fully allocated, so no space can pool into a dead band. PROOF takes
what its copy needs; STATEMENT absorbs the remainder. ACTION is reserved at
64 mm because getting a phone scanned is the poster's whole job — today it is the
zone that gets squeezed.

Tents keep the two-column split (statement/proof left, QR action right, stamp
rail on a bottom rail) on the same rhythm.

### Shared components

Six components, one implementation each, rendered by both paths:

- **`StampRail`** — 3 slots, **none pre-filled**, slot 1 flagged "today's, if you
  join now", then a divider, then the reward as a **seal mark, not a circle**.
  Replaces all five current metaphors.
- **`StepRail`** — Tap → Join → Return in a deliberately different visual
  language (chevrons, not numbered circles), so it cannot be confused with stamp
  progress.
- **`QrBlock`** — QR + quiet zone + card + caption, minimum module size enforced.
- **`VenueLockup`** — venue name + partner chip.
- **`Wordmark`** — `Nabaperks`, one lockup.
- **`LegalLine`** — the 18+ / terms line.

### Shared layout module

The layout maths move into a pure module both paths import. The paths then differ
only in how they **paint** — pdf-lib primitives versus React/CSS. This is the
permanent fix for the render-path drift, and the layout ledger falls out of it for
free.

### Layout ledger and guards

Every placed primitive records
`{ kind: 'text'|'rule'|'shape'|'qr'|'image', bboxMm, container, role, clipTo? }`.
Guards assert on the ledger in-process — no PDF re-parsing:

| Guard           | Assertion                                                 | Catches                     |
| --------------- | --------------------------------------------------------- | --------------------------- |
| G1 safe-area    | every bbox ⊆ its container's live area                    | container-relative overflow |
| G2 collision    | no `text` bbox intersects `rule`/`shape` off-allowlist    | #1, #2, #5, #17             |
| G3 clip         | `decoration` must declare `clipTo`; bbox ⊆ that container | #9, #10, #15, #16           |
| G4 degenerate   | no empty shape; no glyph outside a declared text run      | #3, #4                      |
| G5 rhythm       | every inter-zone gap ∈ {6,12,18,24,36} mm                 | dead bands                  |
| G6 QR floor     | `outerMm / (modules + 2×quiet) ≥ 0.5 mm`                  | NFC QR                      |
| G7 lockup       | rendered brand strings ⊆ {`Nabaperks`}                    | brand drift                 |
| G8 stamp parity | `StampRail` record sequence identical across all 15       | #7, #8, #11                 |

Separately: **wire `posters:verify-pdfs` into CI.** It exists, it passes, and
nothing runs it.

### Production correctness

- Strip crop marks, registration targets and the colour bar from `window`. These
  belong to a press, not to artwork a merchant prints on an office A4.
- Add 3 mm bleed to both NFC formats with a documented trim box.
- NFC QR sizing is blocked on the owed decision below. Both formats need
  re-laying regardless, so the re-lay reserves a QR box sized by whichever option
  is chosen.

### Owed decision — NFC QR (blocks PR 4 only)

Enlarging the QR alone cannot reach the 0.5 mm floor on a business card. Three
routes, none of which block PRs 1–3:

Measured at the 70-character worst-case slug (option A) and a 30-character short
link (options B, C):

| Option                                  | Modules | Outer | Module       | Cost                                                                               |
| --------------------------------------- | ------- | ----- | ------------ | ---------------------------------------------------------------------------------- |
| A. Drop EC **H → M** for NFC only       | 37      | 24 mm | **0.533 mm** | Less damage tolerance — acceptable for a wallet card, unlike a scuffed wall poster |
| B. Short NFC link (`/t/AB12CD`), keep H | 33      | 22 mm | **0.537 mm** | New short-code route — real product scope beyond a print re-lay                    |
| C. A + B together                       | 29      | 20 mm | **0.541 mm** | Both of the above; smallest QR box                                                 |

All three clear the floor, but only just — each outer above is the minimum that
does. For a 0.6 mm comfort margin the boxes grow to 27 mm (A) and 22 mm (C).

**RESOLVED 2026-07-26 — option A at 27 mm.** Both NFC formats drop to error
correction **M** and size their QR box at **27 mm**. Measured at the 70-character
worst-case slug that is 37 modules → **0.600 mm** per module, a comfortable
margin above the 0.5 mm floor rather than the 0.533 mm the minimum size gives.

Rationale: EC-H buys damage tolerance, which earns its cost on a wall poster that
gets scuffed and splashed. A card in a wallet does not face that, and the poster
and tent formats keep EC-H unchanged. Option A is print-kit-local, so it unblocks
PR 4 immediately.

**Still worth doing separately:** option B, a short `/t/XXXXXX` NFC link. It is
product scope, not a print change, and if it ships later the box shrinks from
27 mm to 22 mm at the same 0.6 mm comfort — a meaningful reclaim on an
85.6 × 54 mm card.

**PR 4 must** change the EC level for the NFC catalogues only, set both QR boxes
to 27 mm, and re-lay both formats around the larger box — which they need anyway
for the bleed and safe-area work.

### Copy changes

Catalogue-owned, so these land in `config/*.json`, not in renderers — the
`poster-render-ownership` contract requires it.

| Artifact       | From                             | To                                        |
| -------------- | -------------------------------- | ----------------------------------------- |
| `chalk`        | 3 × "START TODAY"                | "STAMP 1 — TODAY" / "STAMP 2" / "STAMP 3" |
| `pinned`       | 6 × "STAMP ONE STARTS TODAY"     | shared `StampRail`                        |
| `tally`        | "SCAN TO START CIRCLE ONE TODAY" | "SCAN TO START STAMP ONE TODAY"           |
| `tent-classic` | "UNLOCK. YOUR. REWARD."          | "UNLOCK YOUR REWARD."                     |
| `nfc-square`   | `01` / `02` chips                | full 3-slot `StampRail`                   |

## Sequencing

Four PRs. Each re-blesses only its own visual baselines.

1. **System** — geometry, rhythm, shared layout module, six components, ledger,
   eight guards, CI wiring. Applied to `primer` only, to prove the system
   end-to-end. Guards scoped by a migration list that may only ever shrink.
2. **Posters** — remaining 7.
3. **Tents** — all 5.
4. **NFC** — both formats, including bleed and the QR increase.

Collapsible to three (system+posters / tents / NFC) if merge overhead dominates.

## Risks and known gotchas

- **Visual baselines are darwin-only locally.** Do **not** run
  `--update-snapshots` on this machine; bless `-linux` twins from CI artifacts.
- **Tailwind silently drops classes added after its initial scan** — affects the
  React preview path. Build from classes already present in the repo.
- **The poster export does not clean stale PDFs** — clear `output/posters` before
  re-exporting or old files masquerade as current.
- **Source-quality contracts** cap file size and ban `any`/assertions across
  `lib/qr/*`, `lib/notifications/*-pdf*` and the poster components. The shared
  layout module must be split to stay inside those budgets.
- Merges are owner-gated; `main` is a ruleset with no bypass actors.

## Out of scope

- New poster, tent or NFC concepts. The eight material identities are the
  strongest asset in the kit and are retained.
- Changes to the offer, pricing or legal copy.
- CMYK / rich-black separation. Flagged for a later print-production pass; the
  kit is currently RGB throughout.

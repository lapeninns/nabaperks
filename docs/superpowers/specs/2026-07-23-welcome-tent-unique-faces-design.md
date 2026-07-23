# Welcome table tent — unique faces

**Date:** 2026-07-23  
**Status:** Approved (user locked design; proceed to plan)  
**Scope:** Redesign `welcome` faceA and faceB copy in `config/table-tent-designs.json` so the five A4 tents yield ten unique faces  
**Out of scope:** New face variants, CSS/PDF layout changes, renaming Regulars, new design IDs, join-funnel behaviour

---

## 1. Problem

`welcome` is `regulars` with faces reversed. Across five tents that yields eight unique faces, not ten. Regulars already owns belonging / loss-aversion; Welcome’s FOH use case needs its own words.

---

## 2. Goals and constraints

### Goals

- Ten unique customer-facing faces across the five production tents (headline sets must not repeat)
- Welcome is the how-it-works onboarding tent for front-of-house and welcome tables
- React preview and PDF continue to resolve from the same catalogue
- Honest British English; existing tent honesty guards still pass

### Constraints

- Copy-only redesign — reuse existing `TentFaceVariant` values (`plan`, `scan`) and tones (`paper`)
- Keep Welcome’s bunting material identity in CSS (no new decorative treatment)
- Placeholders remain `{stamps}` / `{StampsWord}` only where already used; Welcome faces in this redesign do not require unresolved placeholders
- No free-stamp or fabricated-proof claims (same catalogue contract tests)

### Non-goals

- Changing Regulars, Sealed, Today, or Classic copy
- New PDF draw paths or host-sheet layout
- Merchant UX beyond existing tent print routes

---

## 3. Kit role after redesign

| Id         | Role                                  |
| ---------- | ------------------------------------- |
| `regulars` | Belonging + loss-aversion (unchanged) |
| `welcome`  | How-it-works onboarding (new copy)    |
| `sealed`   | Mystery seal (unchanged)              |
| `today`    | Daily urgency (unchanged)             |
| `classic`  | Minimal scan (unchanged)              |

---

## 4. Locked Welcome copy

**Meta**

- `description`: `How-it-works front, first-visit invite back — the front-of-house onboarding tent.`
- `useCase`: `Front-of-house and welcome tables` (unchanged)
- `tone`: `how-it-works-onboarding`

**Face A (front)**

| Field        | Value                                                                                                                    |
| ------------ | ------------------------------------------------------------------------------------------------------------------------ |
| `variant`    | `plan`                                                                                                                   |
| `tone`       | `paper`                                                                                                                  |
| `headline`   | `["How it works.", "Scan.", "Stamp.", "Reward."]`                                                                        |
| `accent`     | `Reward.`                                                                                                                |
| `body`       | `Point your camera at the code. Stamp one lands today. Fill the card and the sealed reward opens — no app, no password.` |
| `showStamps` | `true`                                                                                                                   |
| `cta`        | `Scan · Start in 10 seconds`                                                                                             |

**Face B (back)**

| Field        | Value                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------------- |
| `variant`    | `scan`                                                                                                      |
| `tone`       | `paper`                                                                                                     |
| `headline`   | `["New here?", "Your card", "starts now."]`                                                                 |
| `accent`     | `starts now.`                                                                                               |
| `body`       | `This code opens your card in the browser. One stamp per UK date — today's is waiting the moment you scan.` |
| `showStamps` | `true`                                                                                                      |
| `cta`        | `Scan to open your card`                                                                                    |

---

## 5. Uniqueness rule

After the change, serialise every design’s `faceA` and `faceB` headlines (joined with spaces, trimmed). The resulting ten strings must be unique. In particular, Welcome must not share either Regulars headline set:

- `This table starts your card.`
- `Regulars keep a card here.`

---

## 6. Catalogue / proof updates

- Update `config/table-tent-designs.json` Welcome design block as above
- Bump `collection.revision` from `1` to `2`
- Add a catalogue contract assertion that all ten face headline sets are unique
- Update unit/e2e expectations only if they hard-code old Welcome headlines (none found at design time beyond id presence)
- If `docs/copy-audit/print-assets/table-tents/welcome.md` exists in the worktree, align it with the locked copy

---

## 7. Acceptance

1. `welcome` faceA and faceB match the locked copy tables
2. Ten unique headline sets across the five tents
3. Catalogue honesty test still passes
4. `resolveTentContent("welcome", n)` resolves both faces for stamps 1–6 with no unresolved `{` tokens
5. Preview/PDF still render Welcome without new layout work

# Welcome tent unique faces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Welcome table tent’s reverse-of-Regulars faces with locked how-it-works copy so the five tents yield ten unique faces.

**Architecture:** Single source of truth remains `config/table-tent-designs.json`. Readers (`lib/qr/tent-content.ts`) and PDF/React hosts already consume that catalogue — change copy + catalogue contracts only; no new variants or layout.

**Tech Stack:** JSON catalogue, Node test runner (`node:test`), existing tent content resolver.

## Global Constraints

- British English; honest copy — no free-stamp / fabricated-proof claims (existing catalogue honesty regexes)
- Reuse variants `plan` + `scan`, tone `paper` only
- Ten unique face headline sets across all designs
- Do not change Regulars, Sealed, Today, or Classic copy
- Commit only when the user explicitly asks

---

### Task 1: Prove Welcome must not mirror Regulars

**Files:**

- Modify: `tests/contracts/table-tent-designs-catalog.test.mjs`
- Modify: `config/table-tent-designs.json` (Task 2 — after red)

**Interfaces:**

- Consumes: catalogue `designs[].faceA.headline` / `faceB.headline` arrays
- Produces: contract that fails while Welcome still duplicates Regulars

- [ ] **Step 1: Write the failing uniqueness + Welcome identity test**

Append to `tests/contracts/table-tent-designs-catalog.test.mjs`:

```js
test("table-tent faces are ten unique headline sets (Welcome is not Regulars reversed)", () => {
  const catalog = JSON.parse(
    readProjectFile("config", "table-tent-designs.json")
  )
  const faceKey = (face) => face.headline.join(" ").trim()
  const keys = catalog.designs.flatMap(({ faceA, faceB }) => [
    faceKey(faceA),
    faceKey(faceB),
  ])

  assert.equal(keys.length, 10)
  assert.equal(new Set(keys).size, 10)

  const welcome = catalog.designs.find(({ id }) => id === "welcome")
  const regulars = catalog.designs.find(({ id }) => id === "regulars")
  assert.ok(welcome)
  assert.ok(regulars)
  assert.notDeepEqual(
    [faceKey(welcome.faceA), faceKey(welcome.faceB)].sort(),
    [faceKey(regulars.faceA), faceKey(regulars.faceB)].sort()
  )
  assert.deepEqual(welcome.faceA.headline, [
    "How it works.",
    "Scan.",
    "Stamp.",
    "Reward.",
  ])
  assert.deepEqual(welcome.faceB.headline, [
    "New here?",
    "Your card",
    "starts now.",
  ])
})
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm exec node --test tests/contracts/table-tent-designs-catalog.test.mjs
```

Expected: FAIL — Welcome headlines still match Regulars (reversed), and uniqueness set size is 8 not 10.

- [ ] **Step 3: Apply locked Welcome catalogue copy**

In `config/table-tent-designs.json`:

1. Set `collection.revision` to `2`.
2. Replace the `welcome` design object with:

```json
{
  "id": "welcome",
  "name": "Welcome",
  "description": "How-it-works front, first-visit invite back — the front-of-house onboarding tent.",
  "rollout": "production",
  "useCase": "Front-of-house and welcome tables",
  "tone": "how-it-works-onboarding",
  "faceA": {
    "variant": "plan",
    "tone": "paper",
    "headline": ["How it works.", "Scan.", "Stamp.", "Reward."],
    "accent": "Reward.",
    "body": "Point your camera at the code. Stamp one lands today. Fill the card and the sealed reward opens — no app, no password.",
    "showStamps": true,
    "cta": "Scan · Start your card"
  },
  "faceB": {
    "variant": "scan",
    "tone": "paper",
    "headline": ["New here?", "Your card", "starts now."],
    "accent": "starts now.",
    "body": "This code opens your card in the browser. Complete the quick join, then collect today's stamp — one per UK date.",
    "showStamps": true,
    "cta": "Scan to open your card"
  }
}
```

Leave the other four designs unchanged.

- [ ] **Step 4: Run catalogue + unit tent tests**

Run:

```bash
pnpm exec node --test tests/contracts/table-tent-designs-catalog.test.mjs tests/unit/tent-designs.test.mjs
```

Expected: PASS — uniqueness 10, Welcome headlines match locked copy, honesty guards still pass, `resolveTentContent("welcome", 1..6)` resolves without `{` leftovers.

- [ ] **Step 5: Align copy-audit doc if present**

If `docs/copy-audit/print-assets/table-tents/welcome.md` exists, update Face A / Face B sections to the locked headlines, body, CTA, variant, and tone. If the path is absent, skip.

- [ ] **Step 6: Stop for review (do not commit unless asked)**

Report: files changed, test commands run, and that revision is `2`. Commit only if the user requests it.

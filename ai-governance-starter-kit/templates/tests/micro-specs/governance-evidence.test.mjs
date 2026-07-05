import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"

import {
  GRANDFATHER_GATE,
  RUN_HISTORY_CAP,
  evaluateLedger,
  ledgerPath,
  newLedger,
  readLedger,
  recordAttestation,
  recordRun,
  recordTransition,
  runEntryFor,
  writeLedger,
} from "../../scripts/governance-evidence.mjs"

const ADOPTION = "2026-07-05"

function spec({
  specId = "MS-test-evidence",
  status = "implemented",
  gates = ["pnpm test", "pnpm lint"],
  exceptions = [],
} = {}) {
  return {
    file: "governance/test-evidence.md",
    metadata: {
      spec_id: specId,
      status,
      verification_gates: gates,
      approved_exceptions: exceptions,
    },
  }
}

function passingRun(gates = ["pnpm test", "pnpm lint"], overrides = {}) {
  return {
    timestamp: "2026-07-05T10:00:00.000Z",
    git_sha: "a".repeat(40),
    git_branch: "main",
    dirty: false,
    gates: gates.map((command) => ({ command, exit_code: 0, duration_ms: 5 })),
    all_passed: true,
    ...overrides,
  }
}

function implementedTransition(overrides = {}) {
  return {
    from: "active",
    to: "implemented",
    at: "2026-07-05T10:00:00.000Z",
    sha: "a".repeat(40),
    dirty: false,
    by: "tester",
    ...overrides,
  }
}

test("Given ledger writes When round-tripped Then serialization is deterministic and runs are capped", (t) => {
  const root = mkdtempSync(path.join(tmpdir(), "evidence-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))

  const ledger = newLedger("MS-test-evidence")
  for (let i = 0; i < RUN_HISTORY_CAP + 5; i += 1) {
    recordRun(ledger, passingRun(["pnpm test"], { timestamp: `2026-07-05T10:00:${String(i).padStart(2, "0")}.000Z` }))
  }
  const file = writeLedger(root, ledger)

  assert.equal(file, ledgerPath(root, "MS-test-evidence"))
  const first = readFileSync(file, "utf8")
  writeLedger(root, readLedger(root, "MS-test-evidence"))
  assert.equal(readFileSync(file, "utf8"), first, "re-serializing an unchanged ledger is byte-identical")

  const reread = readLedger(root, "MS-test-evidence")
  assert.equal(reread.runs.length, RUN_HISTORY_CAP)
  assert.equal(reread.runs.at(-1).timestamp, "2026-07-05T10:00:14.000Z", "newest run is last")
})

test("Given a covering latest run When evaluated Then the ledger passes", () => {
  const ledger = newLedger("MS-test-evidence")
  recordTransition(ledger, implementedTransition())
  recordRun(ledger, passingRun())

  assert.deepEqual(evaluateLedger(spec(), ledger, ADOPTION), [])
})

test("Given adoption is disabled When evaluated Then nothing is enforced", () => {
  assert.deepEqual(evaluateLedger(spec(), null, null), [])
})

test("Given a missing ledger When evaluated Then implemented status fails", () => {
  const failures = evaluateLedger(spec(), null, ADOPTION)
  assert.equal(failures.length, 1)
  assert.match(failures[0], /has no evidence ledger/)
})

test("Given a hand-flipped status When evaluated Then provenance fails", () => {
  const ledger = newLedger("MS-test-evidence")
  recordRun(ledger, passingRun())

  const failures = evaluateLedger(spec(), ledger, ADOPTION)
  assert.ok(failures.some((f) => f.includes('no transition to "implemented"')))
})

test("Given the latest run misses a declared gate When evaluated Then coverage fails", () => {
  const ledger = newLedger("MS-test-evidence")
  recordTransition(ledger, implementedTransition())
  recordRun(ledger, passingRun(["pnpm test"]))

  const failures = evaluateLedger(spec(), ledger, ADOPTION)
  assert.ok(failures.some((f) => f.includes('does not cover gate "pnpm lint"')))
})

test("Given gates edited after recording When evaluated Then stale evidence fails", () => {
  const ledger = newLedger("MS-test-evidence")
  recordTransition(ledger, implementedTransition())
  recordRun(ledger, passingRun(["pnpm test", "pnpm lint"]))

  const edited = spec({ gates: ["pnpm test", "pnpm lint", "pnpm typecheck"] })
  const failures = evaluateLedger(edited, ledger, ADOPTION)
  assert.ok(failures.some((f) => f.includes('does not cover gate "pnpm typecheck"')))
})

test("Given a doctored all_passed flag When evaluated Then the inconsistency fails", () => {
  const ledger = newLedger("MS-test-evidence")
  recordTransition(ledger, implementedTransition())
  const run = passingRun()
  run.gates[1].exit_code = 1
  recordRun(ledger, run) // all_passed stays true — a hand edit

  const failures = evaluateLedger(spec(), ledger, ADOPTION)
  assert.ok(failures.some((f) => f.includes("inconsistent")))
})

test("Given a dirty transition When evaluated Then it fails unless an evidence-waiver exists", () => {
  const ledger = newLedger("MS-test-evidence")
  recordTransition(ledger, implementedTransition({ dirty: true }))
  recordRun(ledger, passingRun())

  const failures = evaluateLedger(spec(), ledger, ADOPTION)
  assert.ok(failures.some((f) => f.includes("dirty tree")))

  const waived = spec({
    exceptions: ["evidence-waiver: hotfix advanced dirty (expires: 2099-01-01)"],
  })
  assert.deepEqual(evaluateLedger(waived, ledger, ADOPTION), [])
})

test("Given a grandfather stub When evaluated Then it passes only until the first machine transition", () => {
  const ledger = newLedger("MS-test-evidence")
  recordAttestation(ledger, {
    gate: GRANDFATHER_GATE,
    by: "tester",
    at: `${ADOPTION}T00:00:00.000Z`,
    note: "grandfathered",
  })

  assert.deepEqual(evaluateLedger(spec(), ledger, ADOPTION), [])

  recordTransition(ledger, implementedTransition())
  const failures = evaluateLedger(spec(), ledger, ADOPTION)
  assert.ok(
    failures.some((f) => f.includes("does not cover") || f.includes("no recorded gate runs")),
    "a transitioned ledger must carry real covering runs"
  )
})

test("Given a union execution When attributed per spec Then only declared gates are recorded", () => {
  const union = [
    { command: "pnpm test", exit_code: 0, duration_ms: 5 },
    { command: "pnpm lint", exit_code: 0, duration_ms: 5 },
    { command: "pnpm build", exit_code: 0, duration_ms: 5 },
  ]
  const entry = runEntryFor(
    spec({ gates: ["pnpm test", "pnpm lint"] }),
    union,
    { sha: "b".repeat(40), branch: "main", dirty: false },
    "2026-07-05T11:00:00.000Z"
  )

  assert.deepEqual(
    entry.gates.map((gate) => gate.command),
    ["pnpm test", "pnpm lint"]
  )
  assert.equal(entry.all_passed, true)

  const partial = runEntryFor(
    spec({ gates: ["pnpm test", "pnpm missing"] }),
    union,
    { sha: "b".repeat(40), branch: "main", dirty: false },
    "2026-07-05T11:00:00.000Z"
  )
  assert.equal(partial.all_passed, false, "a declared gate that never executed cannot pass")
})

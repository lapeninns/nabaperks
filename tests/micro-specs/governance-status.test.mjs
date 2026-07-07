import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const statusCli = path.join(projectRoot, "scripts/governance-status.mjs")

/**
 * MS-governance-status-cli — the read-only portfolio dashboard. Rows for
 * non-terminal specs, an attention list for implemented/verified specs
 * awaiting their next lifecycle step, and the checker's current failures —
 * displayed, never enforced (exit 0 even when the checker is red).
 */

function runStatus(cwd, ...args) {
  try {
    const stdout = execFileSync("node", [statusCli, ...args], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      // Hermetic: this suite itself runs inside recording gate runs.
      env: { ...process.env, GOVERNANCE_REPROVING_SPECS: "", GOVERNANCE_CHANGED_FILES: "" },
    })
    return { status: 0, stdout, stderr: "" }
  } catch (error) {
    return {
      status: error.status ?? 1,
      stdout: error.stdout?.toString() ?? "",
      stderr: error.stderr?.toString() ?? "",
    }
  }
}

function makeFixture(t) {
  const root = mkdtempSync(path.join(tmpdir(), "governance-status-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))

  writeFileSync(
    path.join(root, "package.json"),
    `${JSON.stringify(
      {
        name: "fixture",
        type: "module",
        scripts: {
          "governance:check": "node scripts/check-governance.mjs",
          test: "node --test tests/micro-specs/*.test.mjs",
          "test:coverage": "node --version",
          lint: "node --version",
          typecheck: "node --version",
        },
      },
      null,
      2
    )}\n`
  )
  mkdirSync(path.join(root, "micro-specs/governance"), { recursive: true })
  mkdirSync(path.join(root, "micro-specs/evidence"), { recursive: true })

  // An active spec deliberately missing its coverage floor gate: the planted
  // checker failure the dashboard must display without enforcing.
  writeFileSync(
    path.join(root, "micro-specs/governance/active.md"),
    specSource("MS-fx-active", "active", [
      "pnpm lint",
      "pnpm typecheck",
      "pnpm governance:check",
      "pnpm test",
    ])
  )
  writeFileSync(
    path.join(root, "micro-specs/governance/shipped.md"),
    specSource("MS-fx-shipped", "implemented", [
      "pnpm lint",
      "pnpm typecheck",
      "pnpm governance:check",
      "pnpm test",
      "pnpm test:coverage",
    ])
  )
  writeFileSync(
    path.join(root, "micro-specs/evidence/MS-fx-shipped.json"),
    `${JSON.stringify({
      spec_id: "MS-fx-shipped",
      runs: [
        {
          timestamp: "2026-06-30T12:00:00.000Z",
          git_sha: "abcdef1234567890",
          gates: [
            { command: "pnpm lint", exit_code: 0 },
            { command: "pnpm typecheck", exit_code: 0 },
            { command: "pnpm governance:check", exit_code: 0 },
            { command: "pnpm test", exit_code: 0 },
            { command: "pnpm test:coverage", exit_code: 0 },
          ],
          all_passed: true,
        },
      ],
      transitions: [{ from: "active", to: "implemented", at: "2026-06-30T12:00:00.000Z" }],
      manual_attestations: [],
    })}\n`
  )

  return root
}

function specSource(specId, status, gates) {
  return [
    "---",
    `spec_id: ${specId}`,
    `status: ${status}`,
    "risk_class: docs-tooling",
    "owner: fixture",
    "last_reviewed: 2026-07-01",
    "allowed_blast_radius:",
    "  - micro-specs/**",
    "implementation_surfaces:",
    `  - micro-specs/governance/${specId}.md`,
    "related_tests:",
    "  - not-yet-created",
    "verification_gates:",
    ...gates.map((gate) => `  - ${gate}`),
    "required_playwright_projects: []",
    "evidence_required:",
    "  - readback",
    "approved_exceptions: []",
    "---",
    "",
    `# ${specId}`,
    "",
  ].join("\n")
}

test("Given a portfolio with a nudge and a planted failure When status runs Then it reports everything and exits 0", (t) => {
  const root = makeFixture(t)

  const result = runStatus(root)

  assert.equal(result.status, 0, `report-only: exit 0 even when the checker is red (${result.stderr})`)
  assert.match(result.stdout, /MS-fx-active\s+active/)
  assert.match(result.stdout, /MS-fx-shipped\s+implemented/)
  assert.match(result.stdout, /green \d+d @abcdef12/)
  assert.match(result.stdout, /Attention — awaiting the next lifecycle step:/)
  assert.match(result.stdout, /MS-fx-shipped: implemented for \d+d, awaiting verification/)
  assert.match(result.stdout, /Checker failures \(\d+\)/)
  assert.match(result.stdout, /requires a "test:coverage" gate/)
})

test("Given --json When status runs Then rows, attention, and failures parse as JSON", (t) => {
  const root = makeFixture(t)

  const result = runStatus(root, "--json")

  assert.equal(result.status, 0, result.stderr)
  const report = JSON.parse(result.stdout)
  assert.ok(report.rows.some((row) => row.id === "MS-fx-shipped" && row.status === "implemented"))
  assert.ok(report.attention.some((entry) => entry.id === "MS-fx-shipped"))
  assert.ok(report.failures.some((failure) => failure.includes('requires a "test:coverage" gate')))
})

test("Given an unknown flag When status runs Then usage exits 2", (t) => {
  const root = makeFixture(t)

  const result = runStatus(root, "--wat")

  assert.equal(result.status, 2)
  assert.match(result.stderr, /unknown flag "--wat"/)
})

test("Given the real repo When status runs Then it renders and exits 0", () => {
  const result = runStatus(projectRoot)

  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /MS-pwa/)
  assert.match(result.stdout, /pass --all to list terminal specs/)
})

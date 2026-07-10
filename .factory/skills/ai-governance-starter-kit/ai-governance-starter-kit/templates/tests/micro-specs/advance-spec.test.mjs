import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath, pathToFileURL } from "node:url"

import { readLedger } from "../../scripts/governance-evidence.mjs"
import { validateGovernance } from "../../scripts/governance-rules.mjs"

const scriptsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../scripts")
const advanceCli = path.join(scriptsDir, "advance-spec.mjs")

const TODAY = new Date().toISOString().slice(0, 10)

test("Given sequential governed work When branch ownership is checked Then proven specs keep attribution", () => {
  const source = readFileSync(advanceCli, "utf8")

  assert.match(source, /attributionOwnersForFile/)
  assert.doesNotMatch(source, /\["active", "implemented", "verified"\]\.includes/)
})

// npm-based fixtures so the executed gates work wherever node does.
const FIXTURE_SCRIPTS = {
  "governance:check": "node --version",
  test: "node --version",
  "test:coverage": "node --version",
  lint: "node --version",
  typecheck: "node --version",
}

function makeRepo(t, { scripts = FIXTURE_SCRIPTS, spec, specPath = "micro-specs/governance/example.md" } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "advance-spec-"))
  t.after(() => rmSync(root, { recursive: true, force: true }))

  writeFileSync(
    path.join(root, "package.json"),
    `${JSON.stringify({ name: "fixture", type: "module", packageManager: "npm@10.0.0", scripts }, null, 2)}\n`
  )
  mkdirSync(path.join(root, "tests/micro-specs"), { recursive: true })
  writeFileSync(path.join(root, "tests/micro-specs/example.test.mjs"), "// fixture\n")

  const specFile = path.join(root, specPath)
  mkdirSync(path.dirname(specFile), { recursive: true })
  writeFileSync(specFile, spec)

  git(root, ["init", "-q"])
  git(root, ["config", "user.email", "fixture@example.com"])
  git(root, ["config", "user.name", "Fixture"])
  git(root, ["add", "-A"])
  git(root, ["commit", "-qm", "fixture"])

  return root
}

function git(root, args) {
  execFileSync("git", args, { cwd: root, stdio: "ignore" })
}

function runCli(root, args) {
  try {
    const stdout = execFileSync("node", [advanceCli, ...args], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, USER: "fixture-user" },
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

const GATES = [
  "npm run lint",
  "npm run typecheck",
  "npm run governance:check",
  "npm run test",
  "npm run test:coverage",
]

function specSource({
  status = "draft",
  gates = GATES,
  headings = true,
  body = null,
  relatedTests = ["tests/micro-specs/example.test.mjs"],
  lastReviewed = "2020-01-01",
  blastRadius = ["micro-specs/**", "tests/micro-specs/**"],
  surfaces = ["micro-specs/governance/example.md"],
} = {}) {
  const defaultBody = headings
    ? [
        "## 1. Exact Goal and User-Visible Outcomes",
        "",
        "Goal.",
        "",
        "## 2. Blast Radius",
        "",
        "Scope.",
        "",
        "## 3. Strict Constraints and Assumptions",
        "",
        "Constraints.",
        "",
        "## 4. Decisions Already Made",
        "",
        "Decisions.",
        "",
        "## 5. Behavioral Requirements (EARS)",
        "",
        "- THE system SHALL work.",
        "",
        "## 6. Verification Criteria and Task Breakdown",
        "",
        "Criteria.",
      ]
    : ["Body without the required numbered headings."]

  return [
    "---",
    "spec_id: MS-test-advance",
    `status: ${status}`,
    "risk_class: docs-tooling",
    "owner: fixture",
    `last_reviewed: ${lastReviewed}`,
    "allowed_blast_radius:",
    ...blastRadius.map((entry) => `  - ${entry}`),
    "implementation_surfaces:",
    ...surfaces.map((entry) => `  - ${entry}`),
    "related_tests:",
    ...relatedTests.map((entry) => `  - ${entry}`),
    "verification_gates:",
    ...gates.map((gate) => `  - ${gate}`),
    "required_playwright_projects: []",
    "evidence_required:",
    "  - Command output for the declared verification gates.",
    "approved_exceptions: []",
    "---",
    "",
    "# MS-test-advance — fixture",
    "",
    ...(body ?? defaultBody),
    "",
  ].join("\n")
}

test("Given sequential specs on a feature branch When lifecycle gates run Then preflight and the real checker share attribution", (t) => {
  const governanceRulesUrl = pathToFileURL(
    path.join(scriptsDir, "governance-rules.mjs")
  ).href
  const scripts = {
    ...FIXTURE_SCRIPTS,
    "governance:check": "node scripts/check-governance.mjs",
  }
  const root = makeRepo(t, {
    scripts,
    spec: specSource({
      status: "active",
      lastReviewed: TODAY,
      blastRadius: [
        "micro-specs/governance/example.md",
        "micro-specs/evidence/MS-test-advance.json",
      ],
    }),
  })
  mkdirSync(path.join(root, "scripts"), { recursive: true })
  writeFileSync(
    path.join(root, "scripts/check-governance.mjs"),
    [
      `import { validateGovernance } from ${JSON.stringify(governanceRulesUrl)}`,
      "const result = validateGovernance(process.cwd(), { evidenceAdoptionDate: null })",
      "if (!result.ok) {",
      "  for (const failure of result.failures) console.error(failure)",
      "  process.exit(1)",
      "}",
      "",
    ].join("\n")
  )
  git(root, ["add", "scripts/check-governance.mjs", "package.json"])
  git(root, ["commit", "--amend", "--no-edit", "-q"])
  git(root, ["switch", "-c", "feature", "-q"])

  const completedTest = "tests/micro-specs/completed.test.mjs"
  const completedSpec = [
    "---",
    "spec_id: MS-test-completed",
    "status: implemented",
    "risk_class: docs-tooling",
    "owner: fixture",
    `last_reviewed: ${TODAY}`,
    "allowed_blast_radius:",
    "  - micro-specs/governance/completed.md",
    "  - micro-specs/evidence/MS-test-completed.json",
    `  - ${completedTest}`,
    "implementation_surfaces:",
    `  - ${completedTest}`,
    "related_tests:",
    `  - ${completedTest}`,
    "verification_gates:",
    ...GATES.map((gate) => `  - ${gate}`),
    "required_playwright_projects: []",
    "evidence_required:",
    "  - Command output for the declared verification gates.",
    "approved_exceptions: []",
    "---",
    "",
    "# Completed fixture",
    "",
  ].join("\n")
  writeFileSync(
    path.join(root, "micro-specs/governance/completed.md"),
    completedSpec
  )
  mkdirSync(path.join(root, "micro-specs/evidence"), { recursive: true })
  writeFileSync(
    path.join(root, "micro-specs/evidence/MS-test-completed.json"),
    '{"spec_id":"MS-test-completed"}\n'
  )
  writeFileSync(path.join(root, completedTest), "// completed feature work\n")
  git(root, ["add", "-A"])
  git(root, ["commit", "-qm", "complete first governed slice"])

  const result = runCli(root, ["MS-test-advance", "--to", "implemented"])

  assert.equal(result.status, 0, result.stderr)
  assert.match(
    readFileSync(path.join(root, "micro-specs/governance/example.md"), "utf8"),
    /^status: implemented$/m
  )
})

// A body satisfying the closed-record contract, with dials for each defect the
// station must refuse.
function closedBody({ omitHeading = null, extraHeading = null, pointer = "tests/micro-specs/example.test.mjs" } = {}) {
  const sections = [
    ["## Why It Exists", "Pins the closed-record station in fixtures."],
    ["## Invariants", "- The status line is machine-written."],
    ["## Code Pointers", `- Fixture harness: \`${pointer}\` pins this behavior.`],
    ["## Dead Ends", "None."],
  ]
  const lines = []
  for (const [heading, content] of sections) {
    if (heading === omitHeading) continue
    lines.push(heading, "", content, "")
  }
  if (extraHeading) lines.push(extraHeading, "", "Leftover plan prose.", "")
  return lines
}

test("Given a draft with complete sections When advanced to active Then status is rewritten surgically", (t) => {
  const root = makeRepo(t, { spec: specSource() })
  const before = readFileSync(path.join(root, "micro-specs/governance/example.md"), "utf8")

  const result = runCli(root, ["MS-test-advance", "--to", "active"])
  assert.equal(result.status, 0, result.stderr)

  const after = readFileSync(path.join(root, "micro-specs/governance/example.md"), "utf8")
  assert.match(after, /^status: active$/m)
  assert.match(after, new RegExp(`^last_reviewed: ${TODAY}$`, "m"))

  // Everything except the two rewritten metadata lines is byte-identical.
  const normalize = (source) =>
    source
      .split("\n")
      .filter((line) => !line.startsWith("status:") && !line.startsWith("last_reviewed:"))
      .join("\n")
  assert.equal(normalize(after), normalize(before))

  const ledger = readLedger(root, "MS-test-advance")
  assert.equal(ledger.transitions.length, 1)
  assert.deepEqual(
    { from: ledger.transitions[0].from, to: ledger.transitions[0].to },
    { from: "draft", to: "active" }
  )
})

test("Given a draft missing numbered sections When activated Then the CLI refuses", (t) => {
  const root = makeRepo(t, { spec: specSource({ headings: false }) })
  const before = readFileSync(path.join(root, "micro-specs/governance/example.md"), "utf8")

  const result = runCli(root, ["MS-test-advance", "--to", "active"])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /activation requires the section heading/)
  assert.equal(readFileSync(path.join(root, "micro-specs/governance/example.md"), "utf8"), before)
})

test("Given a draft whose gates miss the floor When activated Then validation reverts the file", (t) => {
  const root = makeRepo(t, {
    spec: specSource({ gates: ["npm run lint", "npm run governance:check", "npm run test"] }),
  })
  const before = readFileSync(path.join(root, "micro-specs/governance/example.md"), "utf8")

  const result = runCli(root, ["MS-test-advance", "--to", "active"])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /activation validation failed/)
  assert.equal(
    readFileSync(path.join(root, "micro-specs/governance/example.md"), "utf8"),
    before,
    "a failed activation must leave the spec untouched"
  )
})

test("Given an active spec When advanced to implemented Then gates run fresh and evidence lands", (t) => {
  const root = makeRepo(t, { spec: specSource({ status: "active" }) })

  const result = runCli(root, ["MS-test-advance", "--to", "implemented"])
  assert.equal(result.status, 0, result.stderr)

  const source = readFileSync(path.join(root, "micro-specs/governance/example.md"), "utf8")
  assert.match(source, /^status: implemented$/m)

  const ledger = readLedger(root, "MS-test-advance")
  assert.equal(ledger.runs.length, 1)
  assert.equal(ledger.runs[0].all_passed, true)
  assert.equal(ledger.runs[0].gates.length, GATES.length)
  assert.equal(ledger.transitions.at(-1).to, "implemented")
  assert.equal(ledger.transitions.at(-1).dirty, false)

  // The full checker (ledger contract ON) accepts the machine transition.
  const validation = validateGovernance(root, {
    changedFiles: [],
    evidenceAdoptionDate: TODAY,
  })
  assert.deepEqual(
    validation.failures.filter((f) => f.includes("MS-test-advance")),
    []
  )
})

test("Given a failing gate When advancing Then the red run is recorded and status is unchanged", (t) => {
  const root = makeRepo(t, {
    scripts: { ...FIXTURE_SCRIPTS, test: "node -e process.exit(1)" },
    spec: specSource({ status: "active" }),
  })

  const result = runCli(root, ["MS-test-advance", "--to", "implemented"])
  assert.equal(result.status, 1)
  assert.match(result.stderr, /gate failed/)

  const source = readFileSync(path.join(root, "micro-specs/governance/example.md"), "utf8")
  assert.match(source, /^status: active$/m, "status must not change on a red run")

  const ledger = readLedger(root, "MS-test-advance")
  assert.equal(ledger.runs.length, 1)
  assert.equal(ledger.runs[0].all_passed, false, "the red run is honest history")
  assert.equal(ledger.transitions.length, 0)
})

test("Given a dirty tree When advancing Then it refuses unless --allow-dirty --note", (t) => {
  const root = makeRepo(t, { spec: specSource({ status: "active" }) })
  writeFileSync(path.join(root, "scratch.txt"), "uncommitted\n")

  const refused = runCli(root, ["MS-test-advance", "--to", "implemented"])
  assert.equal(refused.status, 1)
  assert.match(refused.stderr, /working tree is dirty/)

  const waivedButNoteless = runCli(root, ["MS-test-advance", "--to", "implemented", "--allow-dirty"])
  assert.equal(waivedButNoteless.status, 1)
  assert.match(waivedButNoteless.stderr, /--allow-dirty requires --note/)

  const waived = runCli(root, [
    "MS-test-advance",
    "--to",
    "implemented",
    "--allow-dirty",
    "--note",
    "fixture waiver",
  ])
  assert.equal(waived.status, 0, waived.stderr)

  const ledger = readLedger(root, "MS-test-advance")
  assert.equal(ledger.transitions.at(-1).dirty, true)
  assert.equal(ledger.transitions.at(-1).note, "fixture waiver")
})

test("Given invalid targets When advancing Then refusals are specific", (t) => {
  const root = makeRepo(t, { spec: specSource({ status: "draft" }) })

  const unknown = runCli(root, ["MS-test-missing", "--to", "active"])
  assert.equal(unknown.status, 1)
  assert.match(unknown.stderr, /no Micro-Spec found/)

  const disallowed = runCli(root, ["MS-test-advance", "--to", "verified"])
  assert.equal(disallowed.status, 1)
  assert.match(disallowed.stderr, /transition "draft->verified" is not allowed/)

  const badUsage = runCli(root, ["MS-test-advance", "--to", "shipped"])
  assert.equal(badUsage.status, 2)
  assert.match(badUsage.stderr, /--to must be one of: active, implemented, verified, closed, superseded/)
})

test("Given implemented -> verified When attestations or acks are missing Then it refuses, and passes with both", (t) => {
  const root = makeRepo(t, {
    spec: specSource({ status: "active", gates: [...GATES, "manual:security-review"] }),
  })
  assert.equal(runCli(root, ["MS-test-advance", "--to", "implemented"]).status, 0)
  // The factory workflow: commit the spec + ledger the advance just wrote,
  // otherwise the next advance correctly refuses the dirty tree.
  git(root, ["add", "-A"])
  git(root, ["commit", "-qm", "advance to implemented"])

  const noAttest = runCli(root, ["MS-test-advance", "--to", "verified"])
  assert.equal(noAttest.status, 1)
  assert.match(noAttest.stderr, /requires an attestation for manual gate "manual:security-review"/)

  const noAck = runCli(root, [
    "MS-test-advance",
    "--to",
    "verified",
    "--attest",
    "manual:security-review by fixture: reviewed the auth surface",
  ])
  assert.equal(noAck.status, 1)
  assert.match(noAck.stderr, /requires an acknowledgement for evidence item/)

  const complete = runCli(root, [
    "MS-test-advance",
    "--to",
    "verified",
    "--attest",
    "manual:security-review by fixture: reviewed the auth surface",
    "--ack",
    "Command output for the declared verification gates.",
  ])
  assert.equal(complete.status, 0, complete.stderr)

  const ledger = readLedger(root, "MS-test-advance")
  assert.equal(ledger.transitions.at(-1).to, "verified")
  assert.ok(ledger.manual_attestations.some((a) => a.gate === "manual:security-review"))
  assert.ok(ledger.manual_attestations.some((a) => a.gate === "evidence"))
})

test("Given supersession When advancing Then superseded-by XOR reason is enforced and the line is inserted", (t) => {
  const root = makeRepo(t, { spec: specSource({ status: "active" }) })

  const neither = runCli(root, ["MS-test-advance", "--to", "superseded"])
  assert.equal(neither.status, 1)
  assert.match(neither.stderr, /exactly one of --superseded-by/)

  const unknownSuccessor = runCli(root, [
    "MS-test-advance",
    "--to",
    "superseded",
    "--superseded-by",
    "MS-test-missing",
  ])
  assert.equal(unknownSuccessor.status, 1)
  assert.match(unknownSuccessor.stderr, /does not resolve to a checked-in spec/)

  const reasoned = runCli(root, [
    "MS-test-advance",
    "--to",
    "superseded",
    "--reason",
    "fixture retirement",
  ])
  assert.equal(reasoned.status, 0, reasoned.stderr)

  const source = readFileSync(path.join(root, "micro-specs/governance/example.md"), "utf8")
  assert.match(source, /^status: superseded$/m)
  const ledger = readLedger(root, "MS-test-advance")
  assert.equal(ledger.transitions.at(-1).reason, "fixture retirement")
})

test("Given a verified spec with a conforming closed record When advanced to closed Then gates run fresh and the ledger records it", (t) => {
  const root = makeRepo(t, { spec: specSource({ status: "verified", body: closedBody() }) })

  const result = runCli(root, ["MS-test-advance", "--to", "closed"])
  assert.equal(result.status, 0, result.stderr)

  const source = readFileSync(path.join(root, "micro-specs/governance/example.md"), "utf8")
  assert.match(source, /^status: closed$/m)

  const ledger = readLedger(root, "MS-test-advance")
  assert.equal(ledger.runs.length, 1, "closed runs the gates fresh like implemented/verified")
  assert.equal(ledger.runs[0].all_passed, true)
  assert.equal(ledger.transitions.at(-1).to, "closed")
  assert.equal(ledger.transitions.at(-1).dirty, false)
})

test("Given closed-record defects When advancing to closed Then each refusal names the defect and leaves the file untouched", (t) => {
  const cases = [
    {
      spec: specSource({ status: "verified", body: closedBody({ omitHeading: "## Dead Ends" }) }),
      message: /missing the required heading "## Dead Ends"/,
    },
    {
      spec: specSource({ status: "verified", body: closedBody({ extraHeading: "## 2. Blast Radius" }) }),
      message: /still contains the build-plan heading "## 2\. Blast Radius"/,
    },
    {
      spec: specSource({
        status: "verified",
        body: closedBody({ pointer: "tests/micro-specs/renamed-away.test.mjs" }),
      }),
      message: /"tests\/micro-specs\/renamed-away\.test\.mjs" does not resolve to an existing file or directory/,
    },
    {
      spec: specSource({ status: "verified", body: closedBody(), relatedTests: ["not-yet-created"] }),
      message: /cannot keep the "not-yet-created" related_tests sentinel/,
    },
  ]

  for (const { spec, message } of cases) {
    const root = makeRepo(t, { spec })
    const before = readFileSync(path.join(root, "micro-specs/governance/example.md"), "utf8")

    const result = runCli(root, ["MS-test-advance", "--to", "closed"])
    assert.equal(result.status, 1, `expected a refusal for ${message}`)
    assert.match(result.stderr, /does not satisfy the closed-record contract/)
    assert.match(result.stderr, message)
    assert.equal(
      readFileSync(path.join(root, "micro-specs/governance/example.md"), "utf8"),
      before,
      "a refused close must leave the spec untouched"
    )
    assert.equal(existsSync(path.join(root, "micro-specs/evidence/MS-test-advance.json")), false)
  }
})

test("Given a closed spec When superseded Then the terminal escape hatch still works", (t) => {
  const root = makeRepo(t, { spec: specSource({ status: "closed", body: closedBody() }) })

  const result = runCli(root, [
    "MS-test-advance",
    "--to",
    "superseded",
    "--reason",
    "fixture retirement",
  ])
  assert.equal(result.status, 0, result.stderr)
  assert.match(
    readFileSync(path.join(root, "micro-specs/governance/example.md"), "utf8"),
    /^status: superseded$/m
  )
})

test("Given a hand-flipped status When the checker runs with adoption on Then provenance fails", (t) => {
  const root = makeRepo(t, { spec: specSource({ status: "implemented" }) })

  const validation = validateGovernance(root, {
    changedFiles: [],
    evidenceAdoptionDate: TODAY,
  })

  assert.ok(
    validation.failures.some(
      (f) => f.includes("MS-test-advance") && f.includes("has no evidence ledger")
    ),
    `expected a ledger failure, got ${JSON.stringify(validation.failures)}`
  )
})

test("Given --dry-run When advancing Then nothing is written or executed", (t) => {
  const root = makeRepo(t, { spec: specSource({ status: "active" }) })
  const before = readFileSync(path.join(root, "micro-specs/governance/example.md"), "utf8")

  const result = runCli(root, ["MS-test-advance", "--to", "implemented", "--dry-run"])
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /dry-run: would advance MS-test-advance active -> implemented/)
  assert.equal(readFileSync(path.join(root, "micro-specs/governance/example.md"), "utf8"), before)
  assert.equal(existsSync(path.join(root, "micro-specs/evidence/MS-test-advance.json")), false)
})

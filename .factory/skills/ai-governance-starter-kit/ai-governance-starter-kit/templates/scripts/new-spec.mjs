#!/usr/bin/env node
// Intake station: scaffold a well-formed Micro-Spec whose verification gates
// already satisfy the risk-class floor resolved against THIS repo's real
// package.json scripts. The output is a draft — activate it with
// `governance:advance <spec-id> --to active` once the sections are filled in.
//
// usage:
//   node scripts/new-spec.mjs --id MS-<area>-<slug> --risk <class> --title "<text>"
//       [--owner <name>] [--out <path>] [--surface <path>]... [--gate "<cmd>"]...
//       [--dry-run]
//
// Exit codes: 0 success, 1 refusal (duplicate id, existing file), 2 usage.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"

import {
  detectPackageManager,
  floorGatesFor,
  isManualInspectionGate,
  parsePackageScriptGate,
} from "./governance-commands.mjs"
import { RISK_CLASSES, SCOPED_BROWSER_GATE_SCRIPTS } from "./governance-constants.mjs"
import { readSpecs } from "./governance-io.mjs"

const SPEC_ID_PATTERN = /^MS-[a-z0-9]+(-[a-z0-9]+)+$/

const root = process.cwd()
const options = parseArgs(process.argv.slice(2))

const id = options.id
if (!SPEC_ID_PATTERN.test(id ?? "")) {
  usage(`--id must match MS-<area>-<slug> (got "${id ?? ""}")`)
}
if (!RISK_CLASSES.includes(options.risk ?? "")) {
  usage(`--risk must be one of: ${RISK_CLASSES.join(", ")}`)
}
if (!options.title) usage("--title is required")

const duplicate = readSpecs(root, []).find((spec) => spec.metadata.spec_id === id)
if (duplicate) {
  console.error(`new-spec: duplicate spec_id "${id}" already declared by micro-specs/${duplicate.file}`)
  process.exit(1)
}

const segments = id.split("-")
const area = segments[1]
const slug = segments.slice(2).join("-")
const outPath = options.out ?? join("micro-specs", area, `${slug}.md`)
const specRelPath = outPath.replaceAll("\\", "/")

if (existsSync(join(root, outPath))) {
  console.error(`new-spec: ${outPath} already exists`)
  process.exit(1)
}

const packageJson = readPackageJson(root)
const manager = detectPackageManager(root, packageJson)
const floor = floorGatesFor(options.risk, packageJson.scripts ?? {}, manager)
const needsDurableProofException = floor.needsDurableProofException
// Browser floor gates are born scoped: once the spec is active the checker
// rejects a grep-less browser gate, so the scaffold emits a spec-owned tag
// placeholder instead of a whole-suite run.
const gates = floor.gates.map((gate) => scopeBrowserGate(gate, id))

for (const gate of options.gates) {
  if (!parsePackageScriptGate(gate) && !isManualInspectionGate(gate)) {
    usage(`--gate "${gate}" is neither a package-script command nor a manual:* token`)
  }
  if (!gates.includes(gate)) gates.push(gate)
}

const today = new Date().toISOString().slice(0, 10)
const expiry = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10)
const surfaces = options.surfaces.length > 0 ? options.surfaces : [specRelPath]
const radius = [...new Set([`micro-specs/${area}/**`, ...options.surfaces])]
const exceptions = needsDurableProofException
  ? [`durable-proof harness not present at scaffold time (expires: ${expiry})`]
  : []

const scopedTagNote = gates.some((gate) => gate.includes(`--grep "@${id}"`))
  ? [
      `Browser gates above are pre-scoped to the placeholder tag \`@${id}\`;`,
      "tag this spec's Playwright test titles with it (or swap in your own",
      "stable --grep value) before activation. A broad, whole-suite browser",
      "gate needs a dated `broad-browser-gate:` approved_exceptions entry.",
      "",
    ]
  : []

const source = [
  "---",
  `spec_id: ${id}`,
  "status: draft",
  `risk_class: ${options.risk}`,
  `owner: ${options.owner}`,
  `last_reviewed: ${today}`,
  field("allowed_blast_radius", radius),
  field("implementation_surfaces", surfaces),
  field("related_tests", ["not-yet-created"]),
  field("verification_gates", gates),
  "required_playwright_projects: []",
  field("evidence_required", ["Command output for the declared verification gates."]),
  field("approved_exceptions", exceptions),
  "---",
  "",
  `# ${id} — ${options.title}`,
  "",
  "## 1. Exact Goal and User-Visible Outcomes",
  "",
  "TODO: one unambiguous statement of the intended change, described from the",
  "user's perspective (what is true when this ships, not a feature label).",
  "",
  "## 2. Blast Radius",
  "",
  "TODO: what may be edited, and — explicitly — what is out of scope. Keep the",
  "frontmatter `allowed_blast_radius` / `implementation_surfaces` lists in",
  "agreement with this prose.",
  "",
  "## 3. Strict Constraints and Assumptions",
  "",
  "TODO: non-negotiables (libraries, schemas, security, error handling) and",
  "the assumptions this change rests on.",
  "",
  "## 4. Decisions Already Made",
  "",
  "TODO: settled decisions the implementer must not re-litigate or re-infer.",
  "",
  "## 5. Behavioral Requirements (EARS)",
  "",
  "TODO: one requirement per line; pick the simplest pattern that fits.",
  "- THE <system> SHALL <response>.                        (ubiquitous)",
  "- WHILE <state>, THE <system> SHALL <response>.         (state-driven)",
  "- WHEN <trigger>, THE <system> SHALL <response>.        (event-driven)",
  "- WHERE <feature>, THE <system> SHALL <response>.       (optional)",
  "- IF <condition>, THEN THE <system> SHALL <response>.   (unwanted behaviour)",
  "",
  "## 6. Verification Criteria and Task Breakdown",
  "",
  ...scopedTagNote,
  "TODO: observable behaviors to verify (not test file names), then small",
  "tasks to implement one at a time. Prove the work with",
  "`governance:run-gates --spec " + id + " --record` and advance the",
  "lifecycle with `governance:advance`.",
  "",
].join("\n")

if (options.dryRun) {
  process.stdout.write(source)
  process.exit(0)
}

mkdirSync(dirname(join(root, outPath)), { recursive: true })
writeFileSync(join(root, outPath), source)
console.log(`Scaffolded ${outPath} (${options.risk}, ${gates.length} floor gate(s)).`)
if (needsDurableProofException) {
  console.log(
    "Note: no durable-proof script exists in package.json; a dated approved_exceptions placeholder was added — resolve it before the expiry."
  )
}

function scopeBrowserGate(gate, specId) {
  const parsed = parsePackageScriptGate(gate)
  if (!parsed || parsed.args || !SCOPED_BROWSER_GATE_SCRIPTS.includes(parsed.scriptName)) {
    return gate
  }
  return `${gate} -- --grep "@${specId}"`
}

function field(key, values) {
  if (values.length === 0) return `${key}: []`
  return `${key}:\n${values.map((value) => `  - ${value}`).join("\n")}`
}

function readPackageJson(dir) {
  try {
    return JSON.parse(readFileSync(join(dir, "package.json"), "utf8"))
  } catch {
    return {}
  }
}

function parseArgs(argv) {
  const parsed = {
    id: null,
    risk: null,
    title: null,
    owner: process.env.USER ?? "unassigned",
    out: null,
    surfaces: [],
    gates: [],
    dryRun: false,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === "--dry-run") {
      parsed.dryRun = true
      continue
    }
    const take = () => {
      i += 1
      if (i >= argv.length) usage(`${arg} needs a value`)
      return argv[i]
    }
    if (arg === "--id") parsed.id = take()
    else if (arg === "--risk") parsed.risk = take()
    else if (arg === "--title") parsed.title = take()
    else if (arg === "--owner") parsed.owner = take()
    else if (arg === "--out") parsed.out = take()
    else if (arg === "--surface") parsed.surfaces.push(take())
    else if (arg === "--gate") parsed.gates.push(take())
    else usage(`unknown flag "${arg}"`)
  }

  return parsed
}

function usage(problem) {
  console.error(`new-spec: ${problem}`)
  console.error(
    'usage: node scripts/new-spec.mjs --id MS-<area>-<slug> --risk <class> --title "<text>" [--owner <name>] [--out <path>] [--surface <path>]... [--gate "<cmd>"]... [--dry-run]'
  )
  process.exit(2)
}

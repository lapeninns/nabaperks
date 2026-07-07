// Command helpers shared by the whole engine (rules, io, the gate runner,
// the installer, and the factory-station CLIs). Keeping the pure parsers here
// breaks the import cycle that would otherwise exist between
// governance-io.mjs and governance-rules.mjs.

import { execFileSync, spawnSync } from "node:child_process"
import { existsSync } from "node:fs"
import { join } from "node:path"

import {
  CI_COMMAND_INCLUDE_PATTERN,
  DURABLE_PROOF_SCRIPTS,
  KNOWN_MANUAL_INSPECTION_GATES,
  KNOWN_MANUAL_INSPECTION_GATE_PATTERNS,
  NON_GATE_SCRIPT_NAMES,
  RISK_REQUIRED_SCRIPTS,
} from "./governance-constants.mjs"

// Parse "<manager> [run] <script> [args]" for npm, pnpm, yarn, and bun.
// Returns null for anything else — which is exactly what makes arbitrary
// shell commands invalid as gates.
export function parsePackageScriptGate(command) {
  const trimmed = command.trim()
  const npm = trimmed.match(/^npm\s+run\s+([A-Za-z0-9:_-]+)(?:\s+(.+))?$/)
  if (npm) return { manager: "npm", scriptName: npm[1], args: npm[2] }

  const generic = trimmed.match(
    /^(pnpm|yarn|bun)(?:\s+run)?\s+([A-Za-z0-9:_-]+)(?:\s+(.+))?$/
  )
  if (generic) {
    return { manager: generic[1], scriptName: generic[2], args: generic[3] }
  }

  return null
}

export function isManualInspectionGate(command) {
  return (
    KNOWN_MANUAL_INSPECTION_GATE_PATTERNS.some((pattern) => pattern.test(command)) ||
    KNOWN_MANUAL_INSPECTION_GATES.includes(command)
  )
}

// The symmetric filter used on BOTH sides of the docs-drift comparison: a
// line (from a CI workflow or from the README gate list) counts as a gate
// command only when it parses as a package-script invocation, is not a
// setup/lifecycle script, and passes the repo's include pattern (when set).
// Applying the identical filter to both sides means a line excluded from one
// side can never produce a spurious mismatch against the other.
export function isGateCommandCandidate(command) {
  const parsed = parsePackageScriptGate(command)
  if (!parsed) return false
  if (NON_GATE_SCRIPT_NAMES.includes(parsed.scriptName)) return false
  if (CI_COMMAND_INCLUDE_PATTERN && !CI_COMMAND_INCLUDE_PATTERN.test(command.trim())) {
    return false
  }
  return true
}

// --- Package-manager awareness (shared with the installer) ------------------

export function detectPackageManager(root, packageJson = {}) {
  const declared = packageJson.packageManager?.split("@")[0]
  if (declared) return declared
  if (existsSync(join(root, "pnpm-lock.yaml"))) return "pnpm"
  if (existsSync(join(root, "yarn.lock"))) return "yarn"
  if (existsSync(join(root, "bun.lockb")) || existsSync(join(root, "bun.lock"))) return "bun"
  return "npm"
}

export function commandFor(packageManager, scripts, scriptName) {
  if (!scripts[scriptName] && scriptName === "test") {
    return commandFor(packageManager, { "test:micro-specs": true }, "test:micro-specs")
  }
  if (!scripts[scriptName]) return `echo "No ${scriptName} script configured"`
  if (packageManager === "npm") return `npm run ${scriptName}`
  if (packageManager === "bun") return `bun run ${scriptName}`
  return `${packageManager} ${scriptName}`
}

// Resolve the full gate floor for a risk class against the repo's REAL
// package scripts: every `always` script, each `whenPresent` script the repo
// defines, the first available durable-proof script when the class demands
// one, and the class's manual-review gate. Used by the intake scaffolder and
// the installer's bootstrap spec.
export function floorGatesFor(riskClass, packageScripts, packageManager) {
  const floor = RISK_REQUIRED_SCRIPTS[riskClass]
  if (!floor) return { gates: [], needsDurableProofException: false }

  const gates = []
  const push = (scriptName) => {
    const command = commandFor(packageManager, { ...packageScripts, "governance:check": true }, scriptName)
    if (!gates.includes(command)) gates.push(command)
  }

  for (const scriptName of floor.always ?? []) push(scriptName)
  for (const scriptName of floor.whenPresent ?? []) {
    if (packageScripts[scriptName]) push(scriptName)
  }

  let needsDurableProofException = false
  if (floor.durableProof) {
    const available = DURABLE_PROOF_SCRIPTS.find((name) => packageScripts[name])
    if (available) {
      push(available)
    } else {
      needsDurableProofException = true
    }
  }

  if (floor.manualReview && !gates.includes(floor.manualReview)) {
    gates.push(floor.manualReview)
  }

  return { gates, needsDurableProofException }
}

// --- Gate execution (shared by the gate runner and the lifecycle CLI) -------

// Execute runnable gates sequentially with shell:false, fail-fast. Returns
// one result per gate that actually ran — including the failing one — so the
// evidence ledger can record honest history. options.envForGate(parsed, gate)
// may supply a per-gate environment (the lifecycle CLI uses it to scope
// GOVERNANCE_CHANGED_FILES to the governance:check gate only — leaking it
// into test gates would pollute any hermetic sandbox those tests spawn).
export function executeGates(root, gates, options = {}) {
  const results = []

  for (const gate of gates) {
    const parsed = parsePackageScriptGate(gate)
    if (!parsed) {
      results.push({ command: gate, exit_code: null, duration_ms: 0, error: "unsupported gate command" })
      break
    }

    const started = Date.now()
    const child = spawnSync(parsed.manager, packageArgs(parsed), {
      cwd: root,
      env: options.envForGate ? options.envForGate(parsed, gate) : process.env,
      stdio: "inherit",
      shell: false,
    })
    const result = {
      command: gate,
      exit_code: child.error ? null : child.status ?? 1,
      duration_ms: Date.now() - started,
    }
    if (child.error) result.error = child.error.message
    results.push(result)
    if (result.exit_code !== 0) break
  }

  return results
}

export function packageArgs(gate) {
  const base = gate.manager === "npm" ? ["run", gate.scriptName] : [gate.scriptName]
  if (!gate.args) return base
  return [...base, ...splitArgs(gate.args)]
}

function splitArgs(source) {
  const args = []
  const pattern = /"([^"]*)"|'([^']*)'|(\S+)/g
  for (const match of source.matchAll(pattern)) {
    args.push(match[1] ?? match[2] ?? match[3])
  }
  return args
}

// --- Git state (shared by the evidence ledger and the lifecycle CLI) --------

// Committed drift since a recorded run: the files changed between `sha` and
// HEAD. Returns null when the answer is unknowable — no sha, git missing,
// the sha not resolving in this clone, or the sha not being an ancestor of
// HEAD (e.g. a squash-merged branch commit). Callers must treat null as
// "cannot know", never as "no changes".
export function changedFilesSince(root, sha) {
  if (!sha) return null
  if (!gitSucceeds(root, ["rev-parse", "--verify", "--quiet", `${sha}^{commit}`])) return null
  if (!gitSucceeds(root, ["merge-base", "--is-ancestor", sha, "HEAD"])) return null
  try {
    return execFileSync("git", ["diff", "--name-only", `${sha}..HEAD`], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
      .split(/\r?\n/)
      .filter(Boolean)
  } catch {
    return null
  }
}

function gitSucceeds(root, args) {
  try {
    execFileSync("git", args, { cwd: root, stdio: "ignore" })
    return true
  } catch {
    return false
  }
}

export function gitInfo(root) {
  const sha = gitOutput(root, ["rev-parse", "HEAD"])
  const branch = gitOutput(root, ["rev-parse", "--abbrev-ref", "HEAD"])
  const status = gitOutput(root, ["status", "--porcelain"])
  return {
    sha: sha || null,
    branch: branch || null,
    dirty: status === null ? null : status.length > 0,
  }
}

function gitOutput(root, args) {
  try {
    return execFileSync("git", args, {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim()
  } catch {
    return null
  }
}

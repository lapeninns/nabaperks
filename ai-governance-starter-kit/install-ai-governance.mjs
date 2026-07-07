#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs"
import { dirname, join, relative } from "node:path"
import { fileURLToPath } from "node:url"

// The installer shares the engine's package-manager and gate-floor logic so
// the bootstrap spec's gates are resolved by exactly the code that will later
// validate them.
import {
  commandFor,
  detectPackageManager,
  floorGatesFor,
} from "./templates/scripts/governance-commands.mjs"
import { ENGINE_FILES, KIT_VERSION } from "./templates/scripts/governance-version.mjs"

const kitRoot = dirname(fileURLToPath(import.meta.url))
const templatesRoot = join(kitRoot, "templates")
const args = process.argv.slice(2)
const targetRoot = args.find((arg) => !arg.startsWith("--")) ?? process.cwd()
const force = args.includes("--force")
const upgrade = args.includes("--upgrade")
const noSkills = args.includes("--no-skills")
const preview = args.includes("--preview") || args.includes("--dry-run")
const now = new Date().toISOString().replace(/[:.]/g, "-")

// Files the kit OWNS: safe to overwrite on --upgrade (with backups). Seed
// files a repo adapts (AGENTS.md, GLOBAL_CONTEXT.md, the governance README,
// specs, and governance-constants.mjs — the per-repo tuning point) are never
// overwritten by an upgrade.
const ENGINE_OWNED_PATHS = new Set([
  ...ENGINE_FILES.map((file) => `scripts/${file}`),
  "Instructions_MicroSpecsCreation.md",
  "Instructions_tdd.md",
  ".github/workflows/ai-governance.yml",
])

const plan = buildInstallPlan(targetRoot, { force, noSkills, upgrade })
printReport(plan, { preview })

if (plan.blockers.length > 0) {
  process.exitCode = 1
} else if (!preview) {
  applyInstallPlan(plan)
}

function buildInstallPlan(root, options = {}) {
  const packageResult = readPackageJson(join(root, "package.json"))
  const packageJson = packageResult.ok ? packageResult.value : {}
  const context = buildContext(root, packageJson)
  const blockers = packageResult.ok ? [] : [packageResult.error]
  const actions = []
  const warnings = []
  const ciStatus = detectCiStatus(root)
  const installedVersion = detectInstalledVersion(root)

  if (!existsSync(root)) {
    blockers.push(`Target directory does not exist: ${root}`)
  }

  if (!packageResult.exists) {
    warnings.push("No package.json found. Governance files can be copied, but package scripts cannot be merged.")
  }

  if (options.upgrade && !installedVersion) {
    warnings.push("--upgrade requested but no installed kit was detected; running as a fresh install.")
  }
  if (installedVersion && !options.upgrade && installedVersion !== KIT_VERSION) {
    warnings.push(
      `Installed kit version ${installedVersion} differs from this kit (${KIT_VERSION}); re-run with --upgrade to refresh engine-owned files.`
    )
  }

  planTemplateActions(templatesRoot, root, context.tokens, actions, {
    ciStatus,
    force: options.force,
    upgrade: options.upgrade,
  })

  if (!options.noSkills) {
    planSkillSuiteActions(root, actions, options)
  }

  if (packageResult.ok && packageResult.exists) {
    planPackageAction(root, packageJson, actions, options)
  }

  return {
    actions,
    blockers,
    ciStatus,
    context,
    force: options.force,
    upgrade: options.upgrade,
    installedVersion,
    root,
    warnings,
  }
}

function detectInstalledVersion(root) {
  const versionFile = join(root, "scripts/governance-version.mjs")
  if (!existsSync(versionFile)) return null
  const match = readFileSync(versionFile, "utf8").match(/KIT_VERSION\s*=\s*["']([^"']+)["']/)
  return match ? match[1] : "unknown"
}

function applyInstallPlan(plan) {
  const writes = []

  for (const action of plan.actions) {
    if (action.kind === "skip" || action.kind === "noop") continue
    if (action.kind === "write") {
      if (action.backup && existsSync(action.path)) {
        writeFileSync(`${action.path}.bak.${now}`, readFileSync(action.path))
      }
      mkdirSync(dirname(action.path), { recursive: true })
      writeFileSync(action.path, action.content)
      writes.push(action.relativePath)
    }
  }

  console.log(`\nAI Governance Starter Kit ${plan.upgrade ? "upgraded" : "installed"} in ${plan.root}`)
  for (const file of writes) console.log(`- ${file}`)

  if (plan.upgrade) {
    console.log("\nPost-upgrade review (never overwritten automatically):")
    console.log("- scripts/governance-constants.mjs — diff against the template for new keys; the constants-contract test enforces key parity")
    console.log("- micro-specs/README.md — reconcile the risk-gate matrix and gate list with the template")
    console.log("- AGENTS.md / micro-specs/GLOBAL_CONTEXT.md — adopt any new working rules that matter to this repo")
    console.log("- *.bak.<timestamp> backups — review the overwritten files, then delete the backups (the blast-radius check will flag them until you do)")
  }
}

function buildContext(root, packageJson = {}) {
  const projectName = packageJson.name ?? basename(root)
  const scripts = packageJson.scripts ?? {}
  const packageManager = detectPackageManager(root, packageJson)
  const stack = detectStack(root, packageJson)
  const foundScripts = ["lint", "typecheck", "test", "build"].filter(
    (scriptName) => scripts[scriptName]
  )
  const missingScripts = ["lint", "typecheck", "test", "build"].filter(
    (scriptName) => !scripts[scriptName]
  )

  // Gate list for the bootstrap docs-tooling Micro-Spec, resolved by the same
  // floorGatesFor the intake scaffolder uses, so it satisfies the risk floor
  // on first run by construction.
  const bootstrapGates = floorGatesFor("docs-tooling", scripts, packageManager).gates

  // `tokens` is the ONLY thing that may reach the template stamper: metadata
  // (packageManager, stack, …) lives beside it for plan display, and letting
  // those bare words into the replacement map once rewrote identifiers
  // inside installed engine code (packageJson.packageManager -> packageJson.pnpm).
  return {
    tokens: {
      "{{PROJECT_NAME}}": projectName,
      "{{TODAY}}": now.slice(0, 10),
      "{{GOVERNANCE_SPEC_GATES}}": bootstrapGates.map((gate) => `  - ${gate}`).join("\n"),
      "{{PACKAGE_MANAGER}}": packageManager,
      "{{INSTALL_COMMAND}}": installCommand(packageManager),
      "{{CI_INSTALL_COMMAND}}": ciInstallCommand(packageManager),
      "{{LINT_COMMAND}}": commandFor(packageManager, scripts, "lint"),
      "{{TYPECHECK_COMMAND}}": commandFor(packageManager, scripts, "typecheck"),
      "{{TEST_COMMAND}}": commandFor(packageManager, scripts, "test"),
      "{{BUILD_COMMAND}}": commandFor(packageManager, scripts, "build"),
      "{{GOVERNANCE_CHECK_COMMAND}}": commandFor(
        packageManager,
        { "governance:check": true },
        "governance:check"
      ),
      "{{GOVERNANCE_RUN_GATES_COMMAND}}": commandFor(
        packageManager,
        { "governance:run-gates": true },
        "governance:run-gates"
      ),
      "{{STACK_PROFILE}}": stack.profile,
      "{{STACK_SUMMARY}}": stack.summary,
      "{{CI_GOVERNANCE_CHECK_STEP}}": ciStep(
        commandFor(packageManager, { "governance:check": true }, "governance:check")
      ),
      "{{CI_LINT_STEP}}": scripts.lint ? ciStep(commandFor(packageManager, scripts, "lint")) : "",
      "{{CI_TYPECHECK_STEP}}": scripts.typecheck
        ? ciStep(commandFor(packageManager, scripts, "typecheck"))
        : "",
      "{{CI_TEST_STEP}}": ciStep(commandFor(packageManager, scripts, "test")),
      "{{CI_BUILD_STEP}}": scripts.build
        ? ciStep(commandFor(packageManager, scripts, "build"))
        : "",
    },
    foundScripts,
    missingScripts,
    packageManager,
    projectName,
    stack,
  }
}

function planTemplateActions(fromDir, toDir, replacements, actions, options) {
  for (const entry of readdirSync(fromDir, { withFileTypes: true })) {
    const source = join(fromDir, entry.name)
    const name = entry.name.endsWith(".template") ? entry.name.slice(0, -9) : entry.name
    const destination = join(toDir, name)

    if (entry.isDirectory()) {
      planTemplateActions(source, destination, replacements, actions, options)
      continue
    }

    const relativePath = relative(targetRoot, destination)
    const text = replaceAll(readFileSync(source, "utf8"), replacements)
    const isGovernanceWorkflow = relativePath === ".github/workflows/ai-governance.yml"
    if (isGovernanceWorkflow && options.ciStatus.alreadyWired && !options.force) {
      actions.push({
        kind: "skip",
        path: destination,
        reason: "existing CI already runs governance",
        relativePath,
      })
      continue
    }

    // --upgrade refreshes kit-owned files in place (with backups) while
    // leaving every seed file — including governance-constants.mjs, the
    // per-repo tuning point — untouched.
    const upgradeOwned = options.upgrade && ENGINE_OWNED_PATHS.has(relativePath)

    if (existsSync(destination) && !options.force && !upgradeOwned) {
      actions.push({
        kind: "skip",
        path: destination,
        reason: "file already exists",
        relativePath,
      })
      continue
    }

    if (upgradeOwned && existsSync(destination) && readFileSync(destination, "utf8") === text) {
      actions.push({
        kind: "noop",
        path: destination,
        reason: "already at kit version",
        relativePath,
      })
      continue
    }

    actions.push({
      backup: existsSync(destination) && (options.force || upgradeOwned),
      content: text,
      kind: "write",
      path: destination,
      relativePath,
    })
  }
}

// The station skills are planted into the TARGET's own .claude/skills/ so
// agents working in that repo discover them — verbatim copies (no template
// tokens), and never the kit-root router (targets reach the kit skill from
// wherever the operator's kit lives). These actions carry owned: true — the
// kit refreshes them on --upgrade (with backups) like ENGINE_OWNED_PATHS,
// while plain installs skip-if-exists so a repo's deliberate adaptations
// survive. --no-skills opts out entirely.
function planSkillSuiteActions(root, actions, options) {
  const suiteRoot = join(kitRoot, "skills")
  if (!existsSync(suiteRoot)) return

  const names = readdirSync(suiteRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()

  for (const name of names) {
    for (const file of listFiles(join(suiteRoot, name))) {
      const source = join(suiteRoot, name, file)
      const destination = join(root, ".claude/skills", name, file)
      const relativePath = relative(targetRoot, destination)
      const text = readFileSync(source, "utf8")
      const refresh = options.upgrade || options.force

      if (existsSync(destination)) {
        if (!refresh) {
          actions.push({
            kind: "skip",
            owned: true,
            path: destination,
            reason: "file already exists",
            relativePath,
          })
          continue
        }
        if (readFileSync(destination, "utf8") === text) {
          actions.push({
            kind: "noop",
            owned: true,
            path: destination,
            reason: "already at kit version",
            relativePath,
          })
          continue
        }
      }

      actions.push({
        backup: existsSync(destination),
        content: text,
        kind: "write",
        owned: true,
        path: destination,
        relativePath,
      })
    }
  }
}

function planPackageAction(root, packageJson, actions, options) {
  const path = join(root, "package.json")
  const before = JSON.stringify(packageJson, null, 2)

  packageJson.scripts ??= {}
  mergeScript(packageJson.scripts, "governance:check", "node scripts/check-governance.mjs", options)
  mergeScript(
    packageJson.scripts,
    "governance:run-gates",
    "node scripts/run-governance-gates.mjs",
    options
  )
  mergeScript(packageJson.scripts, "governance:new-spec", "node scripts/new-spec.mjs", options)
  mergeScript(packageJson.scripts, "governance:advance", "node scripts/advance-spec.mjs", options)
  mergeScript(
    packageJson.scripts,
    "test:micro-specs",
    "node --test tests/micro-specs/*.test.mjs",
    options
  )

  const content = `${JSON.stringify(packageJson, null, 2)}\n`
  if (`${before}\n` === content) {
    actions.push({
      kind: "noop",
      path,
      reason: "package scripts already present",
      relativePath: "package.json",
    })
    return
  }

  actions.push({
    backup: options.force,
    content,
    kind: "write",
    path,
    relativePath: "package.json",
  })
}

function detectStack(root, packageJson) {
  const deps = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
  }
  const markers = []

  if (deps.next || existsSync(join(root, "next.config.js")) || existsSync(join(root, "next.config.ts"))) {
    markers.push("Next.js")
  }
  if (deps.react) markers.push("React")
  if (deps.vite || existsSync(join(root, "vite.config.ts")) || existsSync(join(root, "vite.config.js"))) {
    markers.push("Vite")
  }
  if (deps["@supabase/supabase-js"] || existsSync(join(root, "supabase"))) markers.push("Supabase")
  if (deps.stripe) markers.push("Stripe")
  if (deps["@playwright/test"] || existsSync(join(root, "playwright.config.ts"))) markers.push("Playwright")
  if (deps.vitest) markers.push("Vitest")
  if (deps.jest) markers.push("Jest")
  if (existsSync(join(root, ".github/workflows"))) markers.push("GitHub Actions")

  const profile = markers.length > 0 ? markers.map(slug).join("-") : "generic"
  return {
    markers,
    profile,
    summary: markers.length > 0 ? markers.join(", ") : "Generic repository",
  }
}

function detectCiStatus(root) {
  const workflowsDir = join(root, ".github/workflows")
  if (!existsSync(workflowsDir)) {
    return {
      alreadyWired: false,
      status: "none",
      summary: "No GitHub Actions workflows detected; starter workflow will be added.",
    }
  }

  const workflowFiles = listFiles(workflowsDir).filter((file) => /\.(ya?ml)$/.test(file))
  const sources = workflowFiles.map((file) => readFileSync(join(workflowsDir, file), "utf8"))
  const alreadyWired = sources.some((source) => source.includes("governance:check"))
  return {
    alreadyWired,
    status: alreadyWired ? "already-wired" : "workflow-will-be-added",
    summary: alreadyWired
      ? "Existing CI already references governance:check."
      : "Existing CI found; a separate AI governance workflow will be added.",
  }
}

function mergeScript(scripts, scriptName, value, options) {
  if (!scripts[scriptName] || options.force) {
    scripts[scriptName] = value
  }
}

function installCommand(packageManager) {
  if (packageManager === "npm") return "npm install"
  if (packageManager === "yarn") return "yarn install"
  if (packageManager === "bun") return "bun install"
  return "pnpm install"
}

function ciInstallCommand(packageManager) {
  if (packageManager === "npm") return "npm ci"
  if (packageManager === "yarn") return "yarn install --immutable"
  if (packageManager === "bun") return "bun install --frozen-lockfile"
  return "pnpm install --frozen-lockfile"
}

function ciStep(command) {
  return `      - run: ${command}`
}

function readPackageJson(path) {
  if (!existsSync(path)) {
    return { exists: false, ok: true, value: {} }
  }

  try {
    return {
      exists: true,
      ok: true,
      value: JSON.parse(readFileSync(path, "utf8")),
    }
  } catch (error) {
    return {
      error: `package.json could not be parsed: ${errorMessage(error)}`,
      exists: true,
      ok: false,
      value: {},
    }
  }
}

// Defense-in-depth: even if a metadata key ever leaks back into the map,
// only {{UPPER_SNAKE}} tokens are eligible to stamp — bare words must never
// rewrite identifiers inside copied engine code.
function replaceAll(text, replacements) {
  return Object.entries(replacements)
    .filter(([token]) => /^\{\{[A-Z0-9_]+\}\}$/.test(token))
    .reduce((next, [token, value]) => next.replaceAll(token, value), text)
}

function basename(path) {
  return path.split(/[\\/]/).filter(Boolean).at(-1) ?? "project"
}

function listFiles(dir, base = dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = join(dir, entry.name)
    if (entry.isDirectory()) return listFiles(absolute, base)
    return [relative(base, absolute)]
  })
}

function printReport(plan, options) {
  const mode = options.preview ? "preview" : "install"
  console.log(`AI Governance Starter Kit ${mode} for ${plan.root}`)
  console.log(`Kit version: ${KIT_VERSION}${plan.installedVersion ? ` (installed: ${plan.installedVersion})` : ""}`)
  console.log(`Package manager: ${plan.context.packageManager}`)
  console.log(`Stack profile: ${plan.context.stack.profile}`)
  console.log(`Stack markers: ${plan.context.stack.summary}`)
  console.log(`CI: ${plan.ciStatus.summary}`)

  if (plan.context.missingScripts.length > 0) {
    console.log(`Missing validation scripts: ${plan.context.missingScripts.join(", ")}`)
  }
  if (plan.warnings.length > 0) {
    console.log("Warnings:")
    for (const warning of plan.warnings) console.log(`- ${warning}`)
  }
  if (plan.blockers.length > 0) {
    console.log("Blockers:")
    for (const blocker of plan.blockers) console.log(`- ${blocker}`)
    return
  }

  const counts = plan.actions.reduce(
    (acc, action) => {
      acc[action.kind] = (acc[action.kind] ?? 0) + 1
      return acc
    },
    {}
  )
  console.log(
    `Plan: ${counts.write ?? 0} write(s), ${counts.skip ?? 0} skip(s), ${counts.noop ?? 0} no-op(s)`
  )
  for (const action of plan.actions) {
    const suffix = action.reason ? ` (${action.reason})` : ""
    console.log(`- ${action.kind}: ${action.relativePath}${suffix}`)
  }
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

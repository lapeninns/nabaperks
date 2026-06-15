import { existsSync, readFileSync } from "node:fs"
import { relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

export const LIFECYCLE_STATUSES = [
  "draft",
  "active",
  "implemented",
  "verified",
  "superseded",
]

export const RISK_CLASSES = [
  "docs-tooling",
  "ui-only",
  "product-analytics",
  "customer-pii",
  "auth-session",
  "billing",
  "webhooks",
  "rls-rpc-ledger",
  "migrations",
]

const REQUIRED_HIERARCHY_PATHS = [
  "docs/PROJECT_SPEC.md",
  "docs/ARCHITECTURE.md",
  "micro-specs/GLOBAL_CONTEXT.md",
  "micro-specs/",
  "Instructions_MircroSpecsCreation.md",
  "Instructions_tdd.md",
  "AGENTS.md",
  "CLAUDE.md",
  "SKILL.md",
]

const REQUIRED_GOVERNANCE_HEADINGS = [
  "Governance Source-of-Truth Hierarchy",
  "Lifecycle Status Vocabulary",
  "Lifecycle Transition Policy",
  "Risk Rubric",
  "Risk-to-Gate Mapping",
  "CLI-first Validation Policy",
  "Micro-Spec Metadata Schema",
]

const REQUIRED_METADATA_FIELDS = [
  "spec_id",
  "status",
  "risk_class",
  "owner",
  "last_reviewed",
  "allowed_blast_radius",
  "related_docs",
  "related_tests",
  "verification_gates",
  "approved_exceptions",
]

const REQUIRED_COMMAND_GATES = [
  "pnpm lint",
  "pnpm typecheck",
  "pnpm test",
  "pnpm db:verify",
  "pnpm security:verify",
  "npx playwright test",
  "pnpm test:coverage",
  "pnpm build",
]

const REQUIRED_CHECKS = [
  "source hierarchy",
  "lifecycle vocabulary",
  "risk-to-gate matrix",
  "traceability JSON",
  "traceability Markdown",
  "handoff workflow",
  "package and CI wiring",
]

const REQUIRED_HANDOFF_STAGES = [
  "product",
  "engineering",
  "reviewer",
  "release",
]

const REVIEWER_DECISIONS = ["approved", "changes_requested", "override"]
const STALE_AFTER_DAYS = 180

const MINIMUM_GATES_BY_RISK = {
  "docs-tooling": [
    "pnpm governance",
    "pnpm lint",
    "pnpm typecheck",
    "pnpm test",
  ],
  "ui-only": [
    "pnpm lint",
    "pnpm typecheck",
    "pnpm test",
    "npx playwright test",
  ],
  "product-analytics": [
    "pnpm lint",
    "pnpm typecheck",
    "pnpm test",
    "pnpm test:coverage",
  ],
  "customer-pii": [
    "pnpm lint",
    "pnpm typecheck",
    "pnpm test",
    "pnpm security:verify",
  ],
  "auth-session": [
    "pnpm lint",
    "pnpm typecheck",
    "pnpm test",
    "pnpm security:verify",
    "pnpm build",
  ],
  billing: [
    "pnpm lint",
    "pnpm typecheck",
    "pnpm test",
    "pnpm security:verify",
    "pnpm build",
  ],
  webhooks: [
    "pnpm lint",
    "pnpm typecheck",
    "pnpm test",
    "pnpm security:verify",
    "pnpm db:verify",
  ],
  "rls-rpc-ledger": [
    "pnpm lint",
    "pnpm typecheck",
    "pnpm test",
    "pnpm db:verify",
    "pnpm security:verify",
  ],
  migrations: [
    "pnpm lint",
    "pnpm typecheck",
    "pnpm test",
    "pnpm db:verify",
    "pnpm security:verify",
  ],
}

const SOFT_FAIL_PATTERN = /\|\|\s*true|continue-on-error\s*:\s*true/i
const NON_PNPM_INSTALL_PATTERN = /\b(?:npm|yarn|bun)\s+(?:install|add|ci)\b/

export function validateGovernance({ rootDir = process.cwd() } = {}) {
  const root = resolve(rootDir)
  const diagnostics = []

  checkRequiredFiles(root, diagnostics)
  checkGovernanceDocs(root, diagnostics)
  checkPackageAndCi(root, diagnostics)
  checkTraceability(root, diagnostics)

  return {
    checks: REQUIRED_CHECKS,
    diagnostics: sortDiagnostics(diagnostics),
  }
}

export function formatDiagnostics(resultOrDiagnostics) {
  const diagnostics = Array.isArray(resultOrDiagnostics)
    ? resultOrDiagnostics
    : resultOrDiagnostics.diagnostics

  return sortDiagnostics(diagnostics).map(
    ({ path, id, message }) => `${path} [${id}] ${message}`
  )
}

function checkRequiredFiles(root, diagnostics) {
  for (const path of [
    "AGENTS.md",
    "CLAUDE.md",
    "SKILL.md",
    "Instructions_MircroSpecsCreation.md",
    "Instructions_tdd.md",
    "docs/PROJECT_SPEC.md",
    "docs/ARCHITECTURE.md",
    "micro-specs/GLOBAL_CONTEXT.md",
    "micro-specs/README.md",
    "micro-specs/TRACEABILITY.md",
    "micro-specs/traceability.json",
    "package.json",
    ".github/workflows/ci.yml",
    ".github/actions/setup/action.yml",
    ".github/pull_request_template.md",
    ".github/ISSUE_TEMPLATE/feature_request.yml",
    ".github/ISSUE_TEMPLATE/bug_report.yml",
  ]) {
    if (!existsSync(resolve(root, path))) {
      diagnostics.push({
        path,
        id: "required-file",
        message: "required governance artifact is missing.",
      })
    }
  }
}

function checkGovernanceDocs(root, diagnostics) {
  const contractPath = "micro-specs/README.md"
  const contract = readText(root, contractPath, diagnostics)
  if (!contract) return

  for (const heading of REQUIRED_GOVERNANCE_HEADINGS) {
    requireText(
      contract,
      contractPath,
      heading,
      "governance-contract",
      diagnostics
    )
  }
  for (const path of REQUIRED_HIERARCHY_PATHS) {
    requireText(contract, contractPath, path, "source-hierarchy", diagnostics)
  }
  for (const status of LIFECYCLE_STATUSES) {
    requireText(contract, contractPath, status, "lifecycle", diagnostics)
  }
  for (const risk of RISK_CLASSES) {
    requireText(contract, contractPath, risk, "risk-rubric", diagnostics)
  }
  for (const gate of REQUIRED_COMMAND_GATES) {
    requireText(contract, contractPath, gate, "risk-gates", diagnostics)
  }
  for (const field of REQUIRED_METADATA_FIELDS) {
    requireText(contract, contractPath, field, "metadata-schema", diagnostics)
  }
  for (const required of [
    "approved_exceptions",
    "browser evidence",
    "CLI-first",
  ]) {
    requireText(
      contract,
      contractPath,
      required,
      "workflow-policy",
      diagnostics
    )
  }

  const agentDocs = ["AGENTS.md", "CLAUDE.md", "SKILL.md"]
  for (const path of agentDocs) {
    const text = readText(root, path, diagnostics)
    if (!text) continue
    for (const required of [
      "micro-specs/README.md",
      "Instructions_MircroSpecsCreation.md",
      "Instructions_tdd.md",
      "micro-specs/GLOBAL_CONTEXT.md",
      "Red → Green → Refactor",
    ]) {
      requireText(text, path, required, "agent-workflow", diagnostics)
    }
  }

  const authoring = readText(
    root,
    "Instructions_MircroSpecsCreation.md",
    diagnostics
  )
  if (authoring) {
    for (const required of [
      "Micro-Spec Metadata Schema",
      "spec_id",
      "status",
      "risk_class",
      "verification_gates",
    ]) {
      requireText(
        authoring,
        "Instructions_MircroSpecsCreation.md",
        required,
        "authoring-schema",
        diagnostics
      )
    }
  }

  const tdd = readText(root, "Instructions_tdd.md", diagnostics)
  if (tdd) {
    for (const required of [
      "draft",
      "superseded",
      "approved_exceptions",
      "Red → Green → Refactor",
    ]) {
      requireText(
        tdd,
        "Instructions_tdd.md",
        required,
        "lifecycle-handoff",
        diagnostics
      )
    }
  }

  const globalContext = readText(
    root,
    "micro-specs/GLOBAL_CONTEXT.md",
    diagnostics
  )
  if (globalContext) {
    for (const required of [
      "micro-specs/README.md",
      "risk_class",
      "CLI-first",
    ]) {
      requireText(
        globalContext,
        "micro-specs/GLOBAL_CONTEXT.md",
        required,
        "global-governance",
        diagnostics
      )
    }
  }

  checkIntakeArtifacts(root, diagnostics)
}

function checkIntakeArtifacts(root, diagnostics) {
  const artifacts = [
    ".github/pull_request_template.md",
    ".github/ISSUE_TEMPLATE/feature_request.yml",
    ".github/ISSUE_TEMPLATE/bug_report.yml",
  ]

  for (const path of artifacts) {
    const text = readText(root, path, diagnostics)
    if (!text) continue
    for (const required of [
      "Micro-Spec",
      "risk class",
      "outcome",
      "scope",
      "verification",
    ]) {
      requireText(text, path, required, "governance-intake", diagnostics)
    }
  }

  const pr = readText(root, ".github/pull_request_template.md", diagnostics)
  if (!pr) return
  for (const required of [
    "Spec ID",
    "Requirement IDs",
    "Blast radius",
    "Red → Green → Refactor",
    "As-built reconciliation",
    "Reviewer decision",
    "Release reconciliation",
    "Risks",
    "Follow-ups",
    "browser evidence",
  ]) {
    requireText(
      pr,
      ".github/pull_request_template.md",
      required,
      "pr-handoff",
      diagnostics
    )
  }
}

function checkPackageAndCi(root, diagnostics) {
  const packagePath = "package.json"
  const packageText = readText(root, packagePath, diagnostics)
  if (packageText) {
    let pkg
    try {
      pkg = JSON.parse(packageText)
    } catch (error) {
      diagnostics.push({
        path: packagePath,
        id: "json",
        message: `invalid JSON: ${error.message}`,
      })
    }

    if (pkg) {
      if (pkg.packageManager !== "pnpm@10.28.0") {
        diagnostics.push({
          path: packagePath,
          id: "package-manager",
          message: "packageManager must be pnpm@10.28.0.",
        })
      }
      const governance = pkg.scripts?.governance
      if (governance !== "node scripts/check-governance.mjs") {
        diagnostics.push({
          path: packagePath,
          id: "governance",
          message:
            "governance script must be node scripts/check-governance.mjs.",
        })
      }
      if (SOFT_FAIL_PATTERN.test(governance ?? "")) {
        diagnostics.push({
          path: packagePath,
          id: "governance",
          message: "governance script must not use soft-fail wrappers.",
        })
      }
      const quality = pkg.scripts?.quality ?? ""
      if (
        !quality.includes("pnpm governance") ||
        SOFT_FAIL_PATTERN.test(quality)
      ) {
        diagnostics.push({
          path: packagePath,
          id: "quality",
          message:
            "quality script must run pnpm governance without soft-fail wrappers.",
        })
      }
      for (const [name, script] of Object.entries(pkg.scripts ?? {})) {
        if (NON_PNPM_INSTALL_PATTERN.test(String(script))) {
          diagnostics.push({
            path: packagePath,
            id: name,
            message:
              "package scripts must not use npm, yarn, or bun install paths.",
          })
        }
      }
    }
  }

  for (const path of [
    ".github/workflows/ci.yml",
    ".github/actions/setup/action.yml",
  ]) {
    const text = readText(root, path, diagnostics)
    if (!text) continue
    if (NON_PNPM_INSTALL_PATTERN.test(text)) {
      diagnostics.push({
        path,
        id: "package-manager",
        message: "CI must not use npm, yarn, or bun install paths.",
      })
    }
    if (
      !text.includes("pnpm install --frozen-lockfile") &&
      path.includes("setup")
    ) {
      diagnostics.push({
        path,
        id: "lockfile",
        message:
          "setup action must install with pnpm install --frozen-lockfile.",
      })
    }
    if (/governance/.test(text) && SOFT_FAIL_PATTERN.test(text)) {
      diagnostics.push({
        path,
        id: "governance",
        message: "CI governance wiring must not be soft-failed.",
      })
    }
  }

  const ci = readText(root, ".github/workflows/ci.yml", diagnostics)
  if (ci && !ci.includes("pnpm quality") && !ci.includes("pnpm governance")) {
    diagnostics.push({
      path: ".github/workflows/ci.yml",
      id: "governance",
      message:
        "CI must run pnpm quality or pnpm governance as a blocking gate.",
    })
  }
}

function checkTraceability(root, diagnostics) {
  const jsonPath = "micro-specs/traceability.json"
  const markdownPath = "micro-specs/TRACEABILITY.md"
  const markdown = readText(root, markdownPath, diagnostics)
  const text = readText(root, jsonPath, diagnostics)
  if (!text) return

  let traceability
  try {
    traceability = JSON.parse(text)
  } catch (error) {
    diagnostics.push({
      path: jsonPath,
      id: "json",
      message: `invalid JSON: ${error.message}`,
    })
    return
  }

  if (traceability.version !== 1) {
    diagnostics.push({
      path: jsonPath,
      id: "version",
      message: "version must be 1.",
    })
  }
  if (!Array.isArray(traceability.specs)) {
    diagnostics.push({
      path: jsonPath,
      id: "specs",
      message: "specs must be an array.",
    })
    return
  }

  const specIds = new Set()
  const requirementIds = new Set()

  for (const spec of traceability.specs) {
    const specId = stringField(spec, "spec_id")
    const specKey = specId || "unknown-spec"
    if (!specId) {
      diagnostics.push({
        path: jsonPath,
        id: specKey,
        message: "spec_id is required.",
      })
    } else if (specIds.has(specId)) {
      diagnostics.push({
        path: jsonPath,
        id: specId,
        message: "duplicate spec_id.",
      })
    } else {
      specIds.add(specId)
    }

    checkSpecMetadata(root, jsonPath, specKey, spec, diagnostics)
    checkStatus(jsonPath, specKey, spec.status, diagnostics)
    checkRisk(jsonPath, specKey, spec.risk_class, diagnostics)
    checkMarkdownEntry(markdownPath, markdown, specKey, diagnostics)

    const gates = Array.isArray(spec.verification_gates)
      ? spec.verification_gates
      : []
    checkMinimumGates(jsonPath, specKey, spec.risk_class, gates, diagnostics)

    if (!Array.isArray(spec.requirements)) {
      diagnostics.push({
        path: jsonPath,
        id: specKey,
        message: "requirements must be an array.",
      })
      continue
    }
    if (
      ["active", "implemented", "verified"].includes(spec.status) &&
      spec.requirements.length === 0
    ) {
      diagnostics.push({
        path: jsonPath,
        id: specKey,
        message:
          "active, implemented, and verified specs require at least one requirement.",
      })
    }

    for (const requirement of spec.requirements) {
      const requirementId = stringField(requirement, "requirement_id")
      const requirementKey = requirementId || `${specKey}:unknown-requirement`
      if (!requirementId) {
        diagnostics.push({
          path: jsonPath,
          id: requirementKey,
          message: "requirement_id is required.",
        })
      } else if (requirementIds.has(requirementId)) {
        diagnostics.push({
          path: jsonPath,
          id: requirementId,
          message: "duplicate requirement_id.",
        })
      } else {
        requirementIds.add(requirementId)
      }

      const requirementGates = Array.isArray(requirement.gates)
        ? requirement.gates
        : []
      if (requirementGates.length === 0) {
        diagnostics.push({
          path: jsonPath,
          id: requirementKey,
          message: "requirement must list at least one gate.",
        })
      }
      const evidence = Array.isArray(requirement.evidence)
        ? requirement.evidence
        : []
      if (evidence.length === 0) {
        diagnostics.push({
          path: jsonPath,
          id: requirementKey,
          message:
            "requirement must list evidence or an approved manual rationale.",
        })
      }
      for (const evidencePath of evidence) {
        if (typeof evidencePath !== "string") continue
        if (evidencePath.startsWith("manual:")) continue
        if (!existsSync(resolve(root, evidencePath))) {
          diagnostics.push({
            path: jsonPath,
            id: requirementKey,
            message: `references missing evidence path ${evidencePath}.`,
          })
        }
      }
      checkMarkdownEntry(markdownPath, markdown, requirementKey, diagnostics)
    }

    checkHandoffs(jsonPath, specKey, spec, diagnostics)
  }
}

function checkSpecMetadata(root, path, id, spec, diagnostics) {
  for (const field of REQUIRED_METADATA_FIELDS) {
    const value = spec?.[field]
    if (typeof value === "string" && value.trim() !== "") continue
    if (Array.isArray(value)) continue
    diagnostics.push({
      path,
      id,
      message: `${field} is required.`,
    })
  }

  for (const field of [
    "allowed_blast_radius",
    "related_docs",
    "related_tests",
    "verification_gates",
    "approved_exceptions",
  ]) {
    if (!Array.isArray(spec?.[field])) {
      diagnostics.push({
        path,
        id,
        message: `${field} must be an array.`,
      })
    }
  }

  for (const field of ["related_docs", "related_tests"]) {
    const references = Array.isArray(spec?.[field]) ? spec[field] : []
    for (const reference of references) {
      if (typeof reference !== "string") continue
      if (reference.startsWith("manual:")) continue
      if (!existsSync(resolve(root, reference))) {
        diagnostics.push({
          path,
          id,
          message: `${field} references missing path ${reference}.`,
        })
      }
    }
  }

  if (
    spec?.status === "superseded" &&
    !stringField(spec, "superseded_by") &&
    !stringField(spec, "supersession_rationale")
  ) {
    diagnostics.push({
      path,
      id,
      message:
        "superseded specs require superseded_by or supersession_rationale.",
    })
  }

  if (
    ["active", "implemented", "verified"].includes(spec?.status) &&
    isStaleReviewDate(spec?.last_reviewed)
  ) {
    diagnostics.push({
      path,
      id,
      message:
        "last_reviewed is stale for active, implemented, or verified work.",
    })
  }
}

function checkHandoffs(path, specKey, spec, diagnostics) {
  const handoffs = spec?.handoffs
  if (
    ["implemented", "verified"].includes(spec?.status) &&
    (!handoffs || typeof handoffs !== "object" || Array.isArray(handoffs))
  ) {
    diagnostics.push({
      path,
      id: specKey,
      message:
        "implemented and verified specs require Product, Engineering, Reviewer, and Release handoffs.",
    })
    return
  }
  if (!handoffs || typeof handoffs !== "object" || Array.isArray(handoffs)) {
    return
  }

  for (const stage of REQUIRED_HANDOFF_STAGES) {
    if (!handoffs[stage] || typeof handoffs[stage] !== "object") {
      diagnostics.push({
        path,
        id: `${specKey}:${stage}`,
        message: `${stage} handoff is required.`,
      })
    }
  }

  const requirementIds = new Set(
    Array.isArray(spec.requirements)
      ? spec.requirements
          .map((requirement) => stringField(requirement, "requirement_id"))
          .filter(Boolean)
      : []
  )
  const unknownRequirementIds = new Set()
  for (const stage of REQUIRED_HANDOFF_STAGES) {
    for (const requirementId of handoffRequirementIds(handoffs[stage])) {
      if (!requirementIds.has(requirementId))
        unknownRequirementIds.add(requirementId)
    }
  }
  for (const requirementId of [...unknownRequirementIds].sort()) {
    diagnostics.push({
      path,
      id: `${specKey}:handoff`,
      message: `handoff references unknown requirement_id ${requirementId}.`,
    })
  }

  checkProductHandoff(path, specKey, spec, handoffs.product, diagnostics)
  checkEngineeringHandoff(
    path,
    specKey,
    spec,
    handoffs.engineering,
    requirementIds,
    diagnostics
  )
  checkReviewerHandoff(path, specKey, spec, handoffs.reviewer, diagnostics)
  checkReleaseHandoff(path, specKey, spec, handoffs.release, diagnostics)
}

function checkProductHandoff(path, specKey, spec, handoff, diagnostics) {
  if (!handoff || typeof handoff !== "object") return
  const valid =
    handoff.spec_id === spec.spec_id &&
    Array.isArray(handoff.requirement_ids) &&
    handoff.requirement_ids.length > 0 &&
    handoff.status === spec.status &&
    handoff.risk_class === spec.risk_class &&
    nonEmptyString(handoff.owner) &&
    nonEmptyString(handoff.date) &&
    nonEmptyString(handoff.scope_confirmation)
  if (!valid) {
    diagnostics.push({
      path,
      id: `${specKey}:product`,
      message:
        "product handoff must cite spec_id, requirement_ids, lifecycle status, risk_class, owner/date, and scope_confirmation.",
    })
  }
  if (!nonEmptyString(handoff.bounded_intent)) {
    diagnostics.push({
      path,
      id: `${specKey}:product`,
      message: "handoff bounded_intent is required.",
    })
  }
}

function checkEngineeringHandoff(
  path,
  specKey,
  spec,
  handoff,
  requirementIds,
  diagnostics
) {
  if (!handoff || typeof handoff !== "object") return
  if (
    handoff.spec_id !== spec.spec_id ||
    !Array.isArray(handoff.requirement_ids) ||
    handoff.requirement_ids.length === 0 ||
    handoff.risk_class !== spec.risk_class
  ) {
    diagnostics.push({
      path,
      id: `${specKey}:engineering`,
      message:
        "engineering handoff must cite spec_id, requirement_ids, and risk_class.",
    })
  }

  const evidence = Array.isArray(handoff.tdd_evidence)
    ? handoff.tdd_evidence
    : []
  const hasTddEvidence = handoffRequirementIds(handoff).every((requirementId) =>
    evidence.some(
      (entry) =>
        entry?.requirement_id === requirementId &&
        nonEmptyString(entry.red) &&
        nonEmptyString(entry.green) &&
        nonEmptyString(entry.refactor)
    )
  )
  if (!hasTddEvidence) {
    diagnostics.push({
      path,
      id: `${specKey}:engineering`,
      message:
        "engineering handoff requires Red, Green, and Refactor evidence for each in-scope requirement.",
    })
  }

  const reconciliation = handoff.as_built_reconciliation
  const reconciliationValues = [
    ...(Array.isArray(reconciliation?.already_satisfied)
      ? reconciliation.already_satisfied
      : []),
    ...(Array.isArray(reconciliation?.implemented)
      ? reconciliation.implemented
      : []),
    ...(Array.isArray(reconciliation?.intentionally_untouched)
      ? reconciliation.intentionally_untouched
      : []),
  ]
  const hasReconciliation =
    reconciliation &&
    Array.isArray(reconciliation.already_satisfied) &&
    Array.isArray(reconciliation.implemented) &&
    Array.isArray(reconciliation.intentionally_untouched) &&
    reconciliationValues.some((requirementId) =>
      requirementIds.has(requirementId)
    )
  if (!hasReconciliation) {
    diagnostics.push({
      path,
      id: `${specKey}:engineering`,
      message: "as-built reconciliation must list requirement outcomes.",
    })
  }

  const filesTouched = Array.isArray(handoff.actual_files_touched)
    ? handoff.actual_files_touched
    : []
  if (
    filesTouched.length === 0 ||
    filesTouched.some(
      (filePath) =>
        typeof filePath !== "string" ||
        !isInsideBlastRadius(filePath, spec.allowed_blast_radius)
    )
  ) {
    diagnostics.push({
      path,
      id: `${specKey}:engineering`,
      message:
        "actual files touched must remain inside the allowed blast radius.",
    })
  }
  if (!nonEmptyString(handoff.blast_radius_confirmation)) {
    diagnostics.push({
      path,
      id: `${specKey}:engineering`,
      message: "blast-radius confirmation is required.",
    })
  }
}

function checkReviewerHandoff(path, specKey, spec, handoff, diagnostics) {
  if (!handoff || typeof handoff !== "object") return
  const valid =
    REVIEWER_DECISIONS.includes(handoff.decision) &&
    handoff.spec_id === spec.spec_id &&
    handoff.risk_class === spec.risk_class &&
    Array.isArray(handoff.requirement_ids) &&
    handoff.requirement_ids.length > 0 &&
    hasVerificationOutput(handoff.verification_output)
  if (!valid) {
    diagnostics.push({
      path,
      id: `${specKey}:reviewer`,
      message:
        "reviewer decision must cite spec_id, requirement_ids, risk_class, and verification_output.",
    })
  }
}

function checkReleaseHandoff(path, specKey, spec, handoff, diagnostics) {
  if (!handoff || typeof handoff !== "object") return
  const valid =
    handoff.spec_id === spec.spec_id &&
    handoff.risk_class === spec.risk_class &&
    Array.isArray(handoff.requirement_ids) &&
    handoff.requirement_ids.length > 0 &&
    nonEmptyString(handoff.release_reconciliation) &&
    hasVerificationOutput(handoff.verification_output) &&
    Array.isArray(handoff.risks) &&
    Array.isArray(handoff.follow_ups)
  if (!valid) {
    diagnostics.push({
      path,
      id: `${specKey}:release`,
      message:
        "release handoff must include release_reconciliation, risks, follow_ups, and verification_output.",
    })
  }
}

function checkStatus(path, id, status, diagnostics) {
  if (!LIFECYCLE_STATUSES.includes(status)) {
    diagnostics.push({
      path,
      id,
      message: `invalid status ${String(status)}.`,
    })
  }
}

function checkRisk(path, id, risk, diagnostics) {
  if (!RISK_CLASSES.includes(risk)) {
    diagnostics.push({
      path,
      id,
      message: `invalid risk_class ${String(risk)}.`,
    })
  }
}

function checkMinimumGates(path, id, risk, gates, diagnostics) {
  const minimum = MINIMUM_GATES_BY_RISK[risk]
  if (!minimum) return
  const missing = minimum.filter((gate) => !gates.includes(gate))
  if (missing.length > 0) {
    diagnostics.push({
      path,
      id,
      message: `missing minimum gate(s): ${missing.join(", ")}.`,
    })
  }
}

function checkMarkdownEntry(path, markdown, id, diagnostics) {
  if (!markdown) return
  if (!markdown.includes(id)) {
    diagnostics.push({
      path,
      id,
      message: "missing Markdown traceability entry.",
    })
  }
}

function requireText(text, path, token, id, diagnostics) {
  if (!text.toLowerCase().includes(token.toLowerCase())) {
    diagnostics.push({
      path,
      id,
      message: `missing required governance text: ${token}`,
    })
  }
}

function readText(root, path, diagnostics) {
  try {
    return readFileSync(resolve(root, path), "utf8")
  } catch {
    if (!diagnostics.some((diagnostic) => diagnostic.path === path)) {
      diagnostics.push({
        path,
        id: "read",
        message: "could not read required governance artifact.",
      })
    }
    return ""
  }
}

function stringField(value, field) {
  return typeof value?.[field] === "string" ? value[field] : ""
}

function nonEmptyString(value) {
  return typeof value === "string" && value.trim() !== ""
}

function handoffRequirementIds(handoff) {
  return Array.isArray(handoff?.requirement_ids)
    ? handoff.requirement_ids.filter((id) => typeof id === "string")
    : []
}

function hasVerificationOutput(value) {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every(
      (entry) =>
        nonEmptyString(entry?.command) &&
        (nonEmptyString(entry?.outcome) || nonEmptyString(entry?.observation))
    )
  )
}

function isInsideBlastRadius(filePath, allowedBlastRadius) {
  if (!Array.isArray(allowedBlastRadius)) return false
  return allowedBlastRadius.some((entry) => {
    if (typeof entry !== "string") return false
    if (entry === filePath) return true
    if (entry.endsWith("/**")) return filePath.startsWith(entry.slice(0, -3))
    if (entry.endsWith("*")) return filePath.startsWith(entry.slice(0, -1))
    return false
  })
}

function isStaleReviewDate(value) {
  if (!nonEmptyString(value)) return false
  const reviewedAt = new Date(`${value}T00:00:00.000Z`)
  if (Number.isNaN(reviewedAt.getTime())) return true
  const ageMs = Date.now() - reviewedAt.getTime()
  return ageMs > STALE_AFTER_DAYS * 24 * 60 * 60 * 1000
}

function sortDiagnostics(diagnostics) {
  return [...diagnostics].sort(
    (a, b) =>
      a.path.localeCompare(b.path) ||
      a.id.localeCompare(b.id) ||
      a.message.localeCompare(b.message)
  )
}

function printResult(result) {
  if (result.diagnostics.length === 0) {
    console.log(
      `Governance validation passed (${result.checks.length} checks: ${result.checks.join(", ")}).`
    )
    return
  }

  console.error("Governance validation failed:")
  for (const line of formatDiagnostics(result)) {
    console.error(`  - ${line}`)
  }
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : ""
const currentPath = resolve(fileURLToPath(import.meta.url))

if (invokedPath === currentPath) {
  const result = validateGovernance()
  printResult(result)
  process.exit(result.diagnostics.length > 0 ? 1 : 0)
}

export function relativeToRoot(rootDir, path) {
  return relative(resolve(rootDir), resolve(rootDir, path))
}

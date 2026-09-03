import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

import { evaluateGitHubGovernance } from "../../scripts/github-governance/checks.mjs"

const CONTRACT = JSON.parse(
  readFileSync("config/github-governance-contract.json", "utf8")
)

function ruleset() {
  return {
    name: CONTRACT.ruleset.name,
    enforcement: "active",
    bypass_actors: [],
    rules: [
      { type: "deletion" },
      { type: "non_fast_forward" },
      { type: "required_linear_history" },
      {
        type: "pull_request",
        parameters: {
          required_approving_review_count: 1,
          dismiss_stale_reviews_on_push: true,
          require_code_owner_review: true,
          require_last_push_approval: true,
          required_review_thread_resolution: true,
        },
      },
      {
        type: "required_status_checks",
        parameters: {
          strict_required_status_checks_policy: true,
          required_status_checks: CONTRACT.ruleset.requiredChecks.map(
            (context) => ({ context })
          ),
        },
      },
    ],
  }
}

function environment(name, reviewer = "release-owner") {
  const target = CONTRACT.environments[name]
  return {
    configuration: {
      deployment_branch_policy: {
        protected_branches: true,
        custom_branch_policies: false,
      },
      protection_rules: target.independentReview
        ? [
            {
              type: "required_reviewers",
              prevent_self_review: true,
              reviewers: [
                {
                  type: "User",
                  reviewer: { login: reviewer },
                },
              ],
            },
          ]
        : [],
    },
    secretNames: [...target.requiredSecrets],
    variables: Object.fromEntries(
      target.requiredVariables.map((name) => [name, `value-for-${name}`])
    ),
  }
}

function completeEvidence() {
  const environments = Object.fromEntries(
    Object.keys(CONTRACT.environments).map((name) => [name, environment(name)])
  )
  environments.Staging.variables.STAGING_SUPABASE_PROJECT_REF =
    "stagingprojectref0001"
  environments.Production.variables.SUPABASE_PROJECT_REF =
    "productionproject0001"

  return {
    collaborators: [
      {
        login: CONTRACT.routineAuthor,
        permissions: { admin: true },
      },
      {
        login: "release-owner",
        permissions: { push: true },
      },
    ],
    codeowners: "* @lapeninns @release-owner\n",
    environments,
    repositorySecretNames: [],
    ruleset: ruleset(),
  }
}

test("complete governance evidence satisfies every target control", () => {
  const findings = evaluateGitHubGovernance(CONTRACT, completeEvidence())

  assert.ok(findings.length > 20)
  assert.deepEqual(
    findings.filter(({ status }) => status === "FAIL"),
    []
  )
})

test("GitHub production does not require optional Sentry credentials", () => {
  const production = CONTRACT.environments.Production

  assert.deepEqual(
    [...production.requiredSecrets, ...production.requiredVariables].filter(
      (name) => name.includes("SENTRY")
    ),
    []
  )
})

test("the Auth hook secret is required only in the protected Production environment", () => {
  const secret = "SUPABASE_SEND_EMAIL_HOOK_SECRET"

  assert.ok(CONTRACT.environments.Production.requiredSecrets.includes(secret))
  for (const [name, environment] of Object.entries(CONTRACT.environments)) {
    if (name !== "Production") {
      assert.equal(environment.requiredSecrets.includes(secret), false)
    }
  }
  assert.ok(CONTRACT.forbiddenRepositorySecrets.includes(secret))
})

test("governance evidence fails closed on self-review, broad secrets and shared staging", () => {
  const evidence = completeEvidence()
  evidence.collaborators = evidence.collaborators.slice(0, 1)
  evidence.codeowners = "* @lapeninns\n"
  evidence.repositorySecretNames = ["PRODUCTION_MONITOR_SECRET"]
  evidence.environments.Staging.configuration.protection_rules[0].prevent_self_review = false
  evidence.environments.Staging.variables.STAGING_SUPABASE_PROJECT_REF =
    evidence.environments.Production.variables.SUPABASE_PROJECT_REF

  const failures = evaluateGitHubGovernance(CONTRACT, evidence)
    .filter(({ status }) => status === "FAIL")
    .map(({ control }) => control)

  assert.ok(failures.includes("github:independent-code-owner"))
  assert.ok(failures.includes("environment:Staging:self-review"))
  assert.ok(failures.includes("environment:Staging:independent-reviewer"))
  assert.ok(failures.includes("github:repository-secret-scope"))
  assert.ok(failures.includes("github:isolated-staging-project"))
})

test("governance evidence reports missing release checks and environment material", () => {
  const evidence = completeEvidence()
  evidence.ruleset.rules = evidence.ruleset.rules.filter(
    ({ type }) => type !== "required_status_checks"
  )
  evidence.environments.Production.secretNames = []
  evidence.environments.Production.variables = {}

  const failures = evaluateGitHubGovernance(CONTRACT, evidence).filter(
    ({ status }) => status === "FAIL"
  )
  const byControl = new Map(
    failures.map(({ control, detail }) => [control, detail])
  )

  assert.match(byControl.get("github:ruleset-status-checks"), /Release gate/)
  assert.match(byControl.get("environment:Production:secrets"), /VERCEL_TOKEN/)
  assert.match(
    byControl.get("environment:Production:variables"),
    /SUPABASE_PROJECT_REF/
  )
})

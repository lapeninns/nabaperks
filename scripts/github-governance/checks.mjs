function finding(control, passed, detail) {
  return {
    control,
    status: passed ? "PASS" : "FAIL",
    detail,
  }
}

function hasWriteAccess(collaborator) {
  const permissions = collaborator?.permissions ?? {}
  return Boolean(permissions.push || permissions.maintain || permissions.admin)
}

function reviewerLogins(rule) {
  return (rule?.reviewers ?? [])
    .filter(({ type }) => type === "User")
    .map(({ reviewer }) => reviewer?.login)
    .filter(Boolean)
}

function requiredReviewerRule(environment) {
  return environment?.configuration?.protection_rules?.find(
    ({ type }) => type === "required_reviewers"
  )
}

function nameSet(values) {
  return new Set(Array.isArray(values) ? values : [])
}

function missingNames(required, actual) {
  const names = nameSet(actual)
  return required.filter((name) => !names.has(name))
}

function findRule(ruleset, type) {
  return ruleset?.rules?.find((rule) => rule.type === type)
}

function environmentFindings({ name, target, environment, independentLogins }) {
  const findings = []
  const exists = Boolean(environment?.configuration)
  findings.push(
    finding(
      `environment:${name}:exists`,
      exists,
      exists ? "environment exists" : "environment is missing"
    )
  )
  if (!exists) return findings

  const branchPolicy = environment.configuration.deployment_branch_policy
  findings.push(
    finding(
      `environment:${name}:protected-branches`,
      branchPolicy?.protected_branches === true &&
        branchPolicy?.custom_branch_policies === false,
      branchPolicy?.protected_branches === true
        ? "only protected branches may deploy"
        : "protected-branch restriction is missing"
    )
  )

  if (target.independentReview) {
    const rule = requiredReviewerRule(environment)
    const reviewers = reviewerLogins(rule)
    const independentReviewer = reviewers.find((login) =>
      independentLogins.has(login)
    )
    findings.push(
      finding(
        `environment:${name}:self-review`,
        rule?.prevent_self_review === true,
        rule?.prevent_self_review === true
          ? "self-review is prohibited"
          : "self-review is still permitted"
      )
    )
    findings.push(
      finding(
        `environment:${name}:independent-reviewer`,
        Boolean(independentReviewer),
        independentReviewer
          ? `independent reviewer @${independentReviewer} is configured`
          : "no independent write-authorised reviewer is configured"
      )
    )
  }

  const missingSecrets = missingNames(
    target.requiredSecrets,
    environment.secretNames
  )
  findings.push(
    finding(
      `environment:${name}:secrets`,
      missingSecrets.length === 0,
      missingSecrets.length === 0
        ? `${target.requiredSecrets.length} required secret names are scoped here`
        : `missing secret names: ${missingSecrets.join(", ")}`
    )
  )

  const missingVariables = missingNames(
    target.requiredVariables,
    Object.keys(environment.variables ?? {})
  )
  findings.push(
    finding(
      `environment:${name}:variables`,
      missingVariables.length === 0,
      missingVariables.length === 0
        ? `${target.requiredVariables.length} required variables are configured`
        : `missing variables: ${missingVariables.join(", ")}`
    )
  )

  return findings
}

export function evaluateGitHubGovernance(contract, evidence) {
  const findings = []
  const independentCollaborators = (evidence.collaborators ?? []).filter(
    (collaborator) =>
      collaborator.login !== contract.routineAuthor &&
      hasWriteAccess(collaborator)
  )
  const independentLogins = new Set(
    independentCollaborators.map(({ login }) => login)
  )
  const independentOwner = independentCollaborators.find(({ login }) =>
    new RegExp(`(^|\\s)@${login}(?=\\s|$)`, "m").test(evidence.codeowners ?? "")
  )

  findings.push(
    finding(
      "github:independent-code-owner",
      Boolean(independentOwner),
      independentOwner
        ? `@${independentOwner.login} has write access and owns code`
        : "no independent write-authorised collaborator appears in CODEOWNERS"
    )
  )

  const ruleset = evidence.ruleset
  findings.push(
    finding(
      "github:ruleset-active",
      ruleset?.name === contract.ruleset.name &&
        ruleset?.enforcement === "active",
      ruleset?.enforcement === "active"
        ? `${ruleset.name} is active`
        : `${contract.ruleset.name} is not active`
    )
  )
  findings.push(
    finding(
      "github:ruleset-no-bypass",
      Array.isArray(ruleset?.bypass_actors) &&
        ruleset.bypass_actors.length === 0,
      ruleset?.bypass_actors?.length
        ? `${ruleset.bypass_actors.length} bypass actor(s) remain`
        : "no bypass actors"
    )
  )

  const ruleTypes = nameSet((ruleset?.rules ?? []).map(({ type }) => type))
  const missingRuleTypes = contract.ruleset.requiredRuleTypes.filter(
    (type) => !ruleTypes.has(type)
  )
  findings.push(
    finding(
      "github:ruleset-controls",
      missingRuleTypes.length === 0,
      missingRuleTypes.length === 0
        ? "deletion, force-push, linear-history, PR and status controls are present"
        : `missing rule types: ${missingRuleTypes.join(", ")}`
    )
  )

  const pullRequest = findRule(ruleset, "pull_request")?.parameters
  const strongReview =
    pullRequest?.required_approving_review_count >= 1 &&
    pullRequest?.dismiss_stale_reviews_on_push === true &&
    pullRequest?.require_code_owner_review === true &&
    pullRequest?.require_last_push_approval === true &&
    pullRequest?.required_review_thread_resolution === true
  findings.push(
    finding(
      "github:ruleset-review",
      strongReview,
      strongReview
        ? "fresh code-owner approval and resolved threads are required"
        : "pull-request review controls are incomplete"
    )
  )

  const statusRule = findRule(ruleset, "required_status_checks")?.parameters
  const statusChecks = (statusRule?.required_status_checks ?? []).map(
    ({ context }) => context
  )
  const missingChecks = missingNames(
    contract.ruleset.requiredChecks,
    statusChecks
  )
  const strictChecks =
    statusRule?.strict_required_status_checks_policy === true &&
    missingChecks.length === 0
  findings.push(
    finding(
      "github:ruleset-status-checks",
      strictChecks,
      strictChecks
        ? `${contract.ruleset.requiredChecks.length} strict release checks are required`
        : `missing or non-strict checks: ${missingChecks.join(", ") || "strict mode"}`
    )
  )
  const unexpectedChecks = missingNames(
    statusChecks,
    contract.ruleset.requiredChecks
  )
  const exactChecks = strictChecks && unexpectedChecks.length === 0
  findings.push(
    finding(
      "github:ruleset-status-checks-exact",
      exactChecks,
      exactChecks
        ? "strict required check names exactly match the governance contract"
        : `required check mismatch: missing [${missingChecks.join(", ")}]; unexpected [${unexpectedChecks.join(", ")}]; strict ${statusRule?.strict_required_status_checks_policy === true}`
    )
  )

  for (const [name, target] of Object.entries(contract.environments)) {
    findings.push(
      ...environmentFindings({
        name,
        target,
        environment: evidence.environments?.[name],
        independentLogins,
      })
    )
  }

  const repositorySecretNames = nameSet(evidence.repositorySecretNames)
  const broadSecrets = contract.forbiddenRepositorySecrets.filter((name) =>
    repositorySecretNames.has(name)
  )
  findings.push(
    finding(
      "github:repository-secret-scope",
      broadSecrets.length === 0,
      broadSecrets.length === 0
        ? "release and monitoring secrets are environment-scoped"
        : `repository-scoped secrets must move to environments: ${broadSecrets.join(", ")}`
    )
  )

  const stagingRef =
    evidence.environments?.Staging?.variables?.STAGING_SUPABASE_PROJECT_REF
  const productionRef =
    evidence.environments?.Production?.variables?.SUPABASE_PROJECT_REF
  findings.push(
    finding(
      "github:isolated-staging-project",
      Boolean(stagingRef && productionRef && stagingRef !== productionRef),
      stagingRef && productionRef && stagingRef !== productionRef
        ? "staging and production Supabase refs are distinct"
        : "a distinct staging Supabase project ref is not configured"
    )
  )

  return findings
}

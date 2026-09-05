/**
 * The fork boundary.
 *
 * A pull request from a fork carries attacker-controlled code. On the hosted
 * plane that is contained by GitHub's own fork restrictions; on this plane the
 * code would execute on hardware inside the operator's home network, one
 * process boundary away from a GitHub App private key. So the local plane runs
 * exactly one repository's code and refuses everything else, by exact match.
 *
 * "Exact" is load-bearing. `startsWith`, `includes` and a trailing-slash
 * comparison all accept `lapeninns/nabaperks-fork`; a path-segment comparison
 * accepts `evil/lapeninns/nabaperks`. Only `===` refuses both, so only `===`
 * is used, and the lookalikes are named in the unit tests.
 *
 * This module deliberately says nothing about commit SHAs: shape-checking a
 * SHA is queue.mjs's job, and mixing the two would make the fork refusal
 * conditional on an unrelated field being well-formed.
 */

import { LocalCiError, describeValue } from "./contract.mjs"

/** Classification values returned by `classifyRequest`. */
export const REQUEST_CLASSIFICATIONS = Object.freeze([
  "local",
  "hosted-fork",
  "refused",
])

/** Events this plane knows how to classify. */
export const SUPPORTED_EVENTS = Object.freeze([
  "push",
  "pull_request",
  "schedule",
  "workflow_dispatch",
])

/** Stable refusal codes, so callers branch on a value rather than a message. */
export const ALLOWLIST_REFUSAL_CODES = Object.freeze({
  INVALID_REQUEST: "INVALID_REQUEST",
  INVALID_EVENT: "INVALID_EVENT",
  MISSING_HEAD_REPOSITORY: "MISSING_HEAD_REPOSITORY",
  MISSING_BASE_REPOSITORY: "MISSING_BASE_REPOSITORY",
  FORK_HEAD_REPOSITORY: "FORK_HEAD_REPOSITORY",
  FORK_PULL_REQUEST: "FORK_PULL_REQUEST",
})

/** Typed refusal. Carries the classification so callers need not re-derive it. */
export class AllowlistRefusal extends LocalCiError {
  constructor(code, message, classification = "refused") {
    super(code, message)
    this.classification = classification
    this.reason = message
  }
}

function allowedRepository(contract) {
  if (
    typeof contract !== "object" ||
    contract === null ||
    typeof contract.allowedHeadRepository !== "string" ||
    contract.allowedHeadRepository === ""
  ) {
    throw new AllowlistRefusal(
      ALLOWLIST_REFUSAL_CODES.INVALID_REQUEST,
      `contract.allowedHeadRepository must be a non-empty string (received ${describeValue(contract?.allowedHeadRepository)})`
    )
  }
  return contract.allowedHeadRepository
}

/**
 * Exact, case-sensitive full-name match against contract.allowedHeadRepository.
 *
 * GitHub full names are case-insensitive when you navigate to them but are
 * returned canonically by the API, so a case difference means the value did
 * not come from the API and is not trusted.
 */
export function isAllowedHeadRepository(headRepoFullName, contract) {
  const allowed = allowedRepository(contract)
  if (typeof headRepoFullName !== "string") return false
  return headRepoFullName === allowed
}

function normaliseRequest(request) {
  if (typeof request !== "object" || request === null) {
    throw new AllowlistRefusal(
      ALLOWLIST_REFUSAL_CODES.INVALID_REQUEST,
      `job request must be an object (received ${describeValue(request)})`
    )
  }
  const event = request.event ?? "push"
  if (typeof event !== "string" || event === "") {
    throw new AllowlistRefusal(
      ALLOWLIST_REFUSAL_CODES.INVALID_EVENT,
      `job request event must be a non-empty string (received ${describeValue(request.event)})`
    )
  }
  if (!SUPPORTED_EVENTS.includes(event)) {
    throw new AllowlistRefusal(
      ALLOWLIST_REFUSAL_CODES.INVALID_EVENT,
      `job request event ${JSON.stringify(event)} is not one of ${SUPPORTED_EVENTS.join(", ")}`
    )
  }
  return { ...request, event }
}

/**
 * Classify a job request without throwing.
 *
 *   "local"       - the local plane owns this SHA and may run it.
 *   "hosted-fork" - a fork pull request. The GitHub-hosted plane still covers
 *                   it in full; the local plane produces no result at all.
 *   "refused"     - malformed, or a repository this plane has no business
 *                   executing.
 *
 * Returns `{ classification, reason, code, headRepository, baseRepository }`.
 * `code` is null for "local" and one of ALLOWLIST_REFUSAL_CODES otherwise.
 */
export function classifyRequest(request, contract) {
  const allowed = allowedRepository(contract)
  let normalised
  try {
    normalised = normaliseRequest(request)
  } catch (error) {
    if (error instanceof AllowlistRefusal) {
      return Object.freeze({
        classification: "refused",
        reason: error.reason,
        code: error.code,
        headRepository: null,
        baseRepository: null,
      })
    }
    throw error
  }

  const { event } = normalised
  const headRepository = normalised.headRepository ?? null
  const baseRepository = normalised.baseRepository ?? null

  if (typeof headRepository !== "string" || headRepository === "") {
    return Object.freeze({
      classification: "refused",
      reason: `job request has no head repository (received ${describeValue(normalised.headRepository)}); the local plane cannot establish who wrote the code it would run`,
      code: ALLOWLIST_REFUSAL_CODES.MISSING_HEAD_REPOSITORY,
      headRepository: null,
      baseRepository,
    })
  }

  if (event === "pull_request") {
    if (typeof baseRepository !== "string" || baseRepository === "") {
      return Object.freeze({
        classification: "refused",
        reason: `pull_request job request has no base repository (received ${describeValue(normalised.baseRepository)}); a fork cannot be distinguished from a branch without one`,
        code: ALLOWLIST_REFUSAL_CODES.MISSING_BASE_REPOSITORY,
        headRepository,
        baseRepository: null,
      })
    }
    if (headRepository !== baseRepository) {
      // A fork pull request. If it targets the repository this plane serves,
      // it is not a refusal condition - it is simply hosted-only work, and
      // saying so is what lets the caller prove the code still runs somewhere.
      const classification =
        baseRepository === allowed ? "hosted-fork" : "refused"
      return Object.freeze({
        classification,
        reason: `pull request head repository ${JSON.stringify(headRepository)} differs from base repository ${JSON.stringify(baseRepository)}; fork pull requests stay on the GitHub-hosted plane`,
        code: ALLOWLIST_REFUSAL_CODES.FORK_PULL_REQUEST,
        headRepository,
        baseRepository,
      })
    }
  }

  if (!isAllowedHeadRepository(headRepository, contract)) {
    return Object.freeze({
      classification: "refused",
      reason: `head repository ${JSON.stringify(headRepository)} is not exactly ${JSON.stringify(allowed)}; the local plane executes one repository's code and matches its full name exactly`,
      code: ALLOWLIST_REFUSAL_CODES.FORK_HEAD_REPOSITORY,
      headRepository,
      baseRepository,
    })
  }

  return Object.freeze({
    classification: "local",
    reason: `head repository ${JSON.stringify(headRepository)} matches the allowlist exactly`,
    code: null,
    headRepository,
    baseRepository,
  })
}

/**
 * Throwing form of `classifyRequest`, for the call sites that must not proceed.
 *
 * Anything that is not "local" throws an `AllowlistRefusal` carrying the
 * classification, so a fork pull request and a malformed request are
 * distinguishable at the catch site without re-classifying.
 *
 * Returns the classification record on success.
 */
export function assertAllowedJobRequest(request, contract) {
  const verdict = classifyRequest(request, contract)
  if (verdict.classification !== "local") {
    throw new AllowlistRefusal(
      verdict.code ?? ALLOWLIST_REFUSAL_CODES.FORK_HEAD_REPOSITORY,
      verdict.reason,
      verdict.classification
    )
  }
  return verdict
}

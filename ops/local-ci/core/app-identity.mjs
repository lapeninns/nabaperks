/**
 * Who published this check run?
 *
 * The bridge job trusts a check run that the local plane is supposed to have
 * created. Everything downstream - eventually, a merge decision - rests on
 * that check run being ours. Anyone with write access to the repository can
 * create a check run with any name they like through their own App or through
 * `github-actions` itself, so matching the name alone is not identification.
 *
 * Three things are checked, and all three must hold:
 *
 *   1. the check run's name is the one the contract names;
 *   2. it was created by the Nabaperks Local CI GitHub App - by app id when
 *      the contract has been provisioned with one, and by app slug always;
 *   3. its head SHA is the SHA the caller asked about.
 *
 * A check run with no `app` object at all is refused outright. That is the
 * shape a status or a check written by something other than a GitHub App
 * presents, and it is exactly the case that must not slip through.
 */

import { LocalCiError, describeValue } from "./contract.mjs"

export class IdentityError extends LocalCiError {}

export const IDENTITY_CODES = Object.freeze({
  INVALID_CHECK_RUN: "INVALID_CHECK_RUN",
  MISSING_EXPECTATION: "MISSING_EXPECTATION",
  NAME_MISMATCH: "NAME_MISMATCH",
  MISSING_APP: "MISSING_APP",
  APP_SLUG_MISMATCH: "APP_SLUG_MISMATCH",
  APP_ID_MISMATCH: "APP_ID_MISMATCH",
  HEAD_SHA_MISMATCH: "HEAD_SHA_MISMATCH",
})

const COMMIT_SHA = /^[0-9a-fA-F]{40}$/

/**
 * GitHub's own App-name to slug transformation: lowercase, non-alphanumerics
 * to hyphens, collapsed and trimmed. "Nabaperks Local CI" becomes
 * "nabaperks-local-ci".
 */
export function slugifyAppName(name) {
  if (typeof name !== "string" || name.trim() === "") {
    throw new IdentityError(
      IDENTITY_CODES.MISSING_EXPECTATION,
      `githubApp.name must be a non-empty string to derive an App slug (received ${describeValue(name)})`
    )
  }
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

/**
 * The slug a check run from this plane must carry. Taken from the contract's
 * `githubApp.slug` when it is set, and derived from the App name otherwise -
 * which is the case at cutover step 1, when the App has not been created and
 * `appId` is still a null sentinel.
 */
export function expectedAppSlug(contract) {
  if (typeof contract !== "object" || contract === null) {
    throw new IdentityError(
      IDENTITY_CODES.MISSING_EXPECTATION,
      `expectedAppSlug requires the validated contract (received ${describeValue(contract)})`
    )
  }
  const app = contract.githubApp
  if (typeof app !== "object" || app === null) {
    throw new IdentityError(
      IDENTITY_CODES.MISSING_EXPECTATION,
      "contract.githubApp is missing; validate the contract first"
    )
  }
  if (typeof app.slug === "string" && app.slug.trim() !== "") return app.slug
  return slugifyAppName(app.name)
}

function requestedShaOf(expected) {
  if (typeof expected !== "object" || expected === null) {
    throw new IdentityError(
      IDENTITY_CODES.MISSING_EXPECTATION,
      `check-run identity requires an expectation object carrying requestedSha (received ${describeValue(expected)})`
    )
  }
  const { requestedSha } = expected
  if (typeof requestedSha !== "string" || !COMMIT_SHA.test(requestedSha)) {
    throw new IdentityError(
      IDENTITY_CODES.MISSING_EXPECTATION,
      `expected.requestedSha must be a 40-character hexadecimal commit SHA (received ${describeValue(requestedSha)}); without it the head-SHA check cannot be made and the identity check would be incomplete`
    )
  }
  return requestedSha.toLowerCase()
}

function collectViolations(checkRun, contract, expected) {
  const requestedSha = requestedShaOf(expected)
  const expectedName =
    typeof expected.checkName === "string" && expected.checkName.trim() !== ""
      ? expected.checkName
      : contract.checkName
  const violations = []
  const add = (code, message) => violations.push({ code, message })

  if (typeof checkRun !== "object" || checkRun === null) {
    add(
      IDENTITY_CODES.INVALID_CHECK_RUN,
      `check run must be an object (received ${describeValue(checkRun)})`
    )
    return violations
  }

  if (checkRun.name !== expectedName) {
    add(
      IDENTITY_CODES.NAME_MISMATCH,
      `check run name is ${describeValue(checkRun.name)}, expected ${JSON.stringify(expectedName)}`
    )
  }

  const app = checkRun.app
  if (typeof app !== "object" || app === null) {
    add(
      IDENTITY_CODES.MISSING_APP,
      "check run carries no `app` object; only a GitHub App can publish a proof for this plane, and a check without one is not from this plane"
    )
  } else {
    const slug = expectedAppSlug(contract)
    if (app.slug !== slug) {
      add(
        IDENTITY_CODES.APP_SLUG_MISMATCH,
        `check run was created by the App ${describeValue(app.slug)}, expected ${JSON.stringify(slug)}`
      )
    }
    const configuredId = contract.githubApp?.appId
    if (
      configuredId !== null &&
      configuredId !== undefined &&
      String(app.id) !== String(configuredId)
    ) {
      add(
        IDENTITY_CODES.APP_ID_MISMATCH,
        `check run app id is ${describeValue(app.id)}, expected ${JSON.stringify(String(configuredId))}`
      )
    }
  }

  const headSha = checkRun.head_sha
  if (typeof headSha !== "string" || !COMMIT_SHA.test(headSha)) {
    add(
      IDENTITY_CODES.HEAD_SHA_MISMATCH,
      `check run head_sha must be a 40-character hexadecimal commit SHA (received ${describeValue(headSha)})`
    )
  } else if (headSha.toLowerCase() !== requestedSha) {
    add(
      IDENTITY_CODES.HEAD_SHA_MISMATCH,
      `check run head_sha is ${headSha.toLowerCase()}, expected ${requestedSha}`
    )
  }

  return violations
}

/**
 * Every way `checkRun` fails to be a check run this plane published for
 * `expected.requestedSha`, as human-readable strings. An empty array means it
 * passes.
 *
 * Non-throwing so bridge.mjs can fold the reasons into a decision without a
 * try/catch, and so a diagnostic can print all of them at once rather than
 * revealing them one re-run at a time.
 *
 * `expected` is `{ requestedSha, checkName? }`; `checkName` defaults to
 * `contract.checkName`.
 */
export function checkRunIdentityViolations(checkRun, contract, expected) {
  return Object.freeze(
    collectViolations(checkRun, contract, expected).map(
      (violation) => violation.message
    )
  )
}

/**
 * True when the only thing wrong with `checkRun` is that its head SHA is not
 * the requested one.
 *
 * The bridge needs this distinction: a wrong-App or wrong-name check is an
 * impostor and waiting cannot fix it, whereas a head-SHA mismatch on an
 * otherwise valid check is the ordinary "the local plane has not published
 * this commit yet" state.
 */
export function isOnlyHeadShaMismatch(checkRun, contract, expected) {
  const violations = collectViolations(checkRun, contract, expected)
  return (
    violations.length > 0 &&
    violations.every(
      (violation) => violation.code === IDENTITY_CODES.HEAD_SHA_MISMATCH
    )
  )
}

/**
 * Throwing form. Returns the check run unchanged when it belongs to this
 * plane; throws an `IdentityError` listing every violation otherwise.
 *
 * `expected` is required and must carry `requestedSha`: the check run cannot
 * tell you which SHA you asked about, and an identity check that skipped the
 * head-SHA comparison would accept last week's green run for today's commit.
 */
export function assertCheckRunIdentity(checkRun, contract, expected) {
  if (typeof contract !== "object" || contract === null) {
    throw new IdentityError(
      IDENTITY_CODES.MISSING_EXPECTATION,
      `assertCheckRunIdentity requires the validated contract (received ${describeValue(contract)})`
    )
  }
  const violations = collectViolations(checkRun, contract, expected)
  if (violations.length === 0) return checkRun

  // The first violation supplies the code, in the order they are collected:
  // name, then App, then head SHA. That ordering is intentional - the most
  // structural refusal is the one worth branching on at the catch site.
  throw new IdentityError(
    violations[0].code,
    `local-ci check-run identity: ${violations.map((violation) => violation.message).join("; ")}`
  )
}

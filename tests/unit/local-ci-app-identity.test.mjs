import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import {
  loadContract,
  validateContract,
} from "../../ops/local-ci/core/contract.mjs"
import {
  IDENTITY_CODES,
  IdentityError,
  assertCheckRunIdentity,
  checkRunIdentityViolations,
  expectedAppSlug,
  isOnlyHeadShaMismatch,
  slugifyAppName,
} from "../../ops/local-ci/core/app-identity.mjs"

/**
 * local CI — who published this check run?
 *
 * Anyone with write access can create a check run with any name they like,
 * through their own App or through `github-actions` itself, so matching the
 * name alone is not identification. The name, the publishing App and the head
 * SHA all have to hold, and a check run with no `app` object at all - the
 * shape a personal-token status presents - is refused outright.
 */

const CONTRACT_TEXT = readFileSync(
  fileURLToPath(
    new URL("../../config/local-ci-contract.json", import.meta.url)
  ),
  "utf8"
)

const contract = loadContract(() => CONTRACT_TEXT)

/** The contract after the App has been created and installed by hand. */
const provisioned = validateContract({
  ...JSON.parse(CONTRACT_TEXT),
  githubApp: {
    ...JSON.parse(CONTRACT_TEXT).githubApp,
    appId: 1234567,
    installationId: 89012345,
    repositoryId: 998877,
  },
})

const REQUESTED_SHA = "a".repeat(40)
const OTHER_SHA = "c".repeat(40)

const checkRun = (overrides = {}) => ({
  id: 55,
  name: contract.checkName,
  head_sha: REQUESTED_SHA,
  status: "completed",
  conclusion: "success",
  app: { id: 1234567, slug: "nabaperks-local-ci", name: "Nabaperks Local CI" },
  ...overrides,
})

const expected = { requestedSha: REQUESTED_SHA }

test("the App slug is derived from the App name the way GitHub derives it", () => {
  assert.equal(slugifyAppName("Nabaperks Local CI"), "nabaperks-local-ci")
  assert.equal(
    slugifyAppName("  Nabaperks   Local CI!  "),
    "nabaperks-local-ci"
  )
  assert.equal(expectedAppSlug(contract), "nabaperks-local-ci")
})

test("App identity: a check run this plane published is accepted", () => {
  assert.deepEqual(
    checkRunIdentityViolations(checkRun(), contract, expected),
    []
  )
  assert.equal(assertCheckRunIdentity(checkRun(), contract, expected).id, 55)
  // Case is not provenance: GitHub returns SHAs lowercase, but an uppercase
  // spelling of the same commit is the same commit.
  assert.equal(
    assertCheckRunIdentity(
      checkRun({ head_sha: REQUESTED_SHA.toUpperCase() }),
      contract,
      expected
    ).id,
    55
  )
})

test("App identity: a check run from another App is rejected", () => {
  for (const app of [
    { id: 15368, slug: "github-actions", name: "GitHub Actions" },
    { id: 9999, slug: "nabaperks-local-ci-staging", name: "Impostor" },
    { id: 9999, slug: "dependabot", name: "Dependabot" },
  ]) {
    assert.throws(
      () => assertCheckRunIdentity(checkRun({ app }), contract, expected),
      (error) => {
        assert.ok(error instanceof IdentityError)
        assert.equal(error.code, IDENTITY_CODES.APP_SLUG_MISMATCH)
        return true
      }
    )
  }
})

test("App identity: a check run with no App at all - a personal token - is rejected", () => {
  for (const app of [null, undefined, "nabaperks-local-ci"]) {
    assert.throws(
      () => assertCheckRunIdentity(checkRun({ app }), contract, expected),
      (error) => error.code === IDENTITY_CODES.MISSING_APP
    )
  }
  const violations = checkRunIdentityViolations(
    checkRun({ app: null }),
    contract,
    expected
  )
  assert.equal(violations.length, 1)
  assert.match(violations[0], /only a GitHub App can publish a proof/)
})

test("App identity: the wrong check name is rejected", () => {
  assert.throws(
    () =>
      assertCheckRunIdentity(
        checkRun({ name: "Local CI proof" }),
        contract,
        expected
      ),
    (error) => error.code === IDENTITY_CODES.NAME_MISMATCH
  )
  // The nightly proof is a different check name, and asking for it explicitly
  // is how the nightly verifier identifies its own run.
  assert.equal(
    assertCheckRunIdentity(
      checkRun({ name: contract.nightlyCheckName }),
      contract,
      { requestedSha: REQUESTED_SHA, checkName: contract.nightlyCheckName }
    ).id,
    55
  )
})

test("App identity: a mismatched head SHA is rejected", () => {
  assert.throws(
    () =>
      assertCheckRunIdentity(
        checkRun({ head_sha: OTHER_SHA }),
        contract,
        expected
      ),
    (error) => {
      assert.equal(error.code, IDENTITY_CODES.HEAD_SHA_MISMATCH)
      assert.match(error.message, new RegExp(REQUESTED_SHA))
      return true
    }
  )
  for (const headSha of [undefined, null, "", "deadbeef", 12345]) {
    assert.throws(
      () =>
        assertCheckRunIdentity(
          checkRun({ head_sha: headSha }),
          contract,
          expected
        ),
      (error) => error.code === IDENTITY_CODES.HEAD_SHA_MISMATCH
    )
  }
})

test("App identity: once the App id is pinned, a matching slug with the wrong id is rejected", () => {
  // Before provisioning the id is a null sentinel and cannot be compared.
  assert.deepEqual(
    checkRunIdentityViolations(
      checkRun({ app: { id: 42, slug: "nabaperks-local-ci" } }),
      contract,
      expected
    ),
    []
  )
  assert.throws(
    () =>
      assertCheckRunIdentity(
        checkRun({ app: { id: 42, slug: "nabaperks-local-ci" } }),
        provisioned,
        expected
      ),
    (error) => error.code === IDENTITY_CODES.APP_ID_MISMATCH
  )
  assert.equal(assertCheckRunIdentity(checkRun(), provisioned, expected).id, 55)
})

test("App identity refuses to run without a requested SHA to compare against", () => {
  for (const badExpectation of [undefined, null, {}, { requestedSha: "abc" }]) {
    assert.throws(
      () => assertCheckRunIdentity(checkRun(), contract, badExpectation),
      (error) => error.code === IDENTITY_CODES.MISSING_EXPECTATION
    )
  }
})

test("isOnlyHeadShaMismatch separates an older run of this plane from an impostor", () => {
  assert.equal(
    isOnlyHeadShaMismatch(
      checkRun({ head_sha: OTHER_SHA }),
      contract,
      expected
    ),
    true
  )
  assert.equal(isOnlyHeadShaMismatch(checkRun(), contract, expected), false)
  assert.equal(
    isOnlyHeadShaMismatch(
      checkRun({ head_sha: OTHER_SHA, app: { slug: "github-actions" } }),
      contract,
      expected
    ),
    false
  )
  assert.equal(
    isOnlyHeadShaMismatch(
      checkRun({ head_sha: OTHER_SHA, name: "something else" }),
      contract,
      expected
    ),
    false
  )
})

test("every violation is reported at once, not one re-run at a time", () => {
  const violations = checkRunIdentityViolations(
    checkRun({
      name: "Local CI proof",
      head_sha: OTHER_SHA,
      app: { id: 1, slug: "github-actions" },
    }),
    contract,
    expected
  )
  assert.equal(violations.length, 3)
  assert.ok(violations.some((entry) => entry.includes("check run name is")))
  assert.ok(violations.some((entry) => entry.includes("github-actions")))
  assert.ok(violations.some((entry) => entry.includes("head_sha")))
})

test("a check run that is not an object is refused rather than treated as absent", () => {
  for (const value of [null, undefined, "check", 7]) {
    assert.throws(
      () => assertCheckRunIdentity(value, contract, expected),
      (error) => error.code === IDENTITY_CODES.INVALID_CHECK_RUN
    )
  }
})

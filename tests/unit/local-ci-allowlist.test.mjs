import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

import { loadContract } from "../../ops/local-ci/core/contract.mjs"
import {
  ALLOWLIST_REFUSAL_CODES,
  AllowlistRefusal,
  assertAllowedJobRequest,
  classifyRequest,
  isAllowedHeadRepository,
} from "../../ops/local-ci/core/allowlist.mjs"

/**
 * local CI — the fork boundary. A pull request from a fork carries
 * attacker-controlled code, and on this plane that code would execute on
 * hardware one process boundary away from a GitHub App private key. The
 * allowlist is therefore an exact full-name match, and these tests name the
 * lookalikes that a `startsWith`, an `includes` or a path-segment comparison
 * would each let through.
 */

const CONTRACT_PATH = fileURLToPath(
  new URL("../../config/local-ci-contract.json", import.meta.url)
)

const contract = loadContract(
  (path) => readFileSync(path, "utf8"),
  CONTRACT_PATH
)

const ALLOWED = contract.allowedHeadRepository

test("fork refusal: only the exact allowlisted full name is accepted", () => {
  assert.equal(ALLOWED, "lapeninns/nabaperks")
  assert.equal(isAllowedHeadRepository(ALLOWED, contract), true)

  // Each of these is accepted by exactly one of the comparisons that are not
  // `===`, which is why none of them is used.
  const lookalikes = [
    "lapeninns/nabaperks-fork", // startsWith
    "lapeninns/nabaperks.git", // startsWith
    "lapeninns/nabaperks/", // trailing slash
    "evil/lapeninns/nabaperks", // endsWith, path-segment split
    "xlapeninns/nabaperks", // includes
    "Lapeninns/Nabaperks", // case
    "LAPENINNS/NABAPERKS",
    " lapeninns/nabaperks",
    "lapeninns/nabaperks ",
    "",
  ]
  for (const candidate of lookalikes) {
    assert.equal(
      isAllowedHeadRepository(candidate, contract),
      false,
      `${JSON.stringify(candidate)} must not match the allowlist`
    )
  }

  for (const candidate of [null, undefined, 42, {}, ["lapeninns/nabaperks"]]) {
    assert.equal(isAllowedHeadRepository(candidate, contract), false)
  }
})

test("fork refusal: a push from a lookalike repository is refused, never run", () => {
  for (const headRepository of [
    "lapeninns/nabaperks-fork",
    "evil/lapeninns/nabaperks",
    "Lapeninns/Nabaperks",
  ]) {
    const verdict = classifyRequest({ event: "push", headRepository }, contract)
    assert.equal(verdict.classification, "refused")
    assert.equal(verdict.code, ALLOWLIST_REFUSAL_CODES.FORK_HEAD_REPOSITORY)
    assert.match(verdict.reason, /exactly/)
  }
})

test("fork refusal: an empty or missing head repository is refused", () => {
  for (const headRepository of [undefined, null, ""]) {
    const verdict = classifyRequest({ event: "push", headRepository }, contract)
    assert.equal(verdict.classification, "refused")
    assert.equal(verdict.code, ALLOWLIST_REFUSAL_CODES.MISSING_HEAD_REPOSITORY)
  }
  const empty = classifyRequest({ event: "push" }, contract)
  assert.equal(empty.classification, "refused")
  assert.equal(empty.headRepository, null)
})

test("routing: a same-repository pull request classifies local", () => {
  const verdict = classifyRequest(
    {
      event: "pull_request",
      headRepository: ALLOWED,
      baseRepository: ALLOWED,
    },
    contract
  )
  assert.equal(verdict.classification, "local")
  assert.equal(verdict.code, null)
  assert.equal(verdict.headRepository, ALLOWED)
})

test("routing: a push to the allowlisted repository classifies local", () => {
  const verdict = classifyRequest({ headRepository: ALLOWED }, contract)
  assert.equal(verdict.classification, "local")
  assert.equal(verdict.code, null)
})

test("routing: a fork pull request classifies hosted-fork and never local", () => {
  const verdict = classifyRequest(
    {
      event: "pull_request",
      headRepository: "contributor/nabaperks",
      baseRepository: ALLOWED,
    },
    contract
  )
  assert.equal(verdict.classification, "hosted-fork")
  assert.notEqual(verdict.classification, "local")
  assert.equal(verdict.code, ALLOWLIST_REFUSAL_CODES.FORK_PULL_REQUEST)
  // The hosted plane still covers it in full; saying so is what lets a caller
  // prove the absence of a local result is not an absence of coverage.
  assert.match(verdict.reason, /GitHub-hosted plane/)
})

test("routing: a fork pull request against another repository is refused outright", () => {
  const verdict = classifyRequest(
    {
      event: "pull_request",
      headRepository: "contributor/nabaperks",
      baseRepository: "someone-else/nabaperks",
    },
    contract
  )
  assert.equal(verdict.classification, "refused")
})

test("routing: a pull request with no base repository cannot be classified and is refused", () => {
  const verdict = classifyRequest(
    { event: "pull_request", headRepository: ALLOWED },
    contract
  )
  assert.equal(verdict.classification, "refused")
  assert.equal(verdict.code, ALLOWLIST_REFUSAL_CODES.MISSING_BASE_REPOSITORY)
})

test("routing: an unsupported event is refused rather than defaulted", () => {
  const verdict = classifyRequest(
    { event: "issue_comment", headRepository: ALLOWED },
    contract
  )
  assert.equal(verdict.classification, "refused")
  assert.equal(verdict.code, ALLOWLIST_REFUSAL_CODES.INVALID_EVENT)
})

test("assertAllowedJobRequest throws for anything but local and carries the classification", () => {
  assert.deepEqual(
    assertAllowedJobRequest(
      { event: "push", headRepository: ALLOWED },
      contract
    ).classification,
    "local"
  )

  assert.throws(
    () =>
      assertAllowedJobRequest(
        {
          event: "pull_request",
          headRepository: "contributor/nabaperks",
          baseRepository: ALLOWED,
        },
        contract
      ),
    (error) => {
      assert.ok(error instanceof AllowlistRefusal)
      assert.equal(error.classification, "hosted-fork")
      assert.equal(error.code, ALLOWLIST_REFUSAL_CODES.FORK_PULL_REQUEST)
      return true
    }
  )

  assert.throws(
    () =>
      assertAllowedJobRequest(
        { event: "push", headRepository: "lapeninns/nabaperks-fork" },
        contract
      ),
    (error) => {
      assert.equal(error.classification, "refused")
      assert.equal(error.code, ALLOWLIST_REFUSAL_CODES.FORK_HEAD_REPOSITORY)
      return true
    }
  )
})

test("the allowlist says nothing about commit SHAs", () => {
  // Shape-checking a SHA belongs to the queue. Mixing the two would make the
  // fork refusal conditional on an unrelated field being well-formed.
  const verdict = classifyRequest(
    { event: "push", headRepository: ALLOWED, sha: "not-a-sha" },
    contract
  )
  assert.equal(verdict.classification, "local")
})

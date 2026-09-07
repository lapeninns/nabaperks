import assert from "node:assert/strict"
import { test } from "node:test"
import {
  REQUIRED_HOSTED_JOBS,
  runRequiredEvidenceCheck,
  verifyRequiredEvidence,
} from "../../scripts/ci/verify-required-evidence.mjs"

const complete = () =>
  Object.fromEntries(
    REQUIRED_HOSTED_JOBS.map((job) => [job, { result: "success", outputs: {} }])
  )

test("complete hosted proof accepts all required workloads", () => {
  assert.match(verifyRequiredEvidence(complete()), /db: success/)
})

test("each workload fails closed for every absent or non-success outcome", () => {
  for (const job of REQUIRED_HOSTED_JOBS) {
    for (const result of [
      "failure",
      "cancelled",
      "skipped",
      "",
      "neutral",
      "timed_out",
      "SUCCESS",
      undefined,
      null,
    ]) {
      const evidence = complete()
      evidence[job] = { result }
      assert.throws(
        () => verifyRequiredEvidence(evidence),
        /Incomplete hosted proof/,
        `${job}: ${result}`
      )
    }
    const evidence = complete()
    delete evidence[job]
    assert.throws(() => verifyRequiredEvidence(evidence), /missing/)
    evidence[job] = null
    assert.throws(() => verifyRequiredEvidence(evidence), /missing/)
  }
})

test("unexpected dependencies cannot silently change the gate policy", () => {
  assert.throws(
    () =>
      verifyRequiredEvidence({
        ...complete(),
        "local-proof": { result: "success" },
      }),
    /unexpected dependencies \[local-proof\]/
  )
})

test("missing or malformed workflow environment never grants success", () => {
  for (const input of [
    undefined,
    "null",
    "[]",
    "{}",
    "not json",
    '"success"',
  ]) {
    assert.throws(() =>
      runRequiredEvidenceCheck({ CI_REQUIRED_EVIDENCE: input })
    )
  }
  assert.match(
    runRequiredEvidenceCheck({
      CI_REQUIRED_EVIDENCE: JSON.stringify(complete()),
    }),
    /fast: success/
  )
})

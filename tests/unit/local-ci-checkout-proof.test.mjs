import assert from "node:assert/strict"
import { test } from "node:test"
import {
  CHECKOUT_ACTION,
  checkoutShaFromStepLog,
  collectCheckoutProof,
  requireSameCheckoutTree,
} from "../../ops/local-ci/core/checkout-proof.mjs"
import { withCheckoutProof } from "../helpers/checkout-proof.mjs"

const head = "a".repeat(40)
const merge = "c".repeat(40)
const tree = "b".repeat(40)
const step = `Run ${CHECKOUT_ACTION}`
const job = {
  id: 101,
  name: "E2E (chromium, pack 1)",
  steps: [{ name: step, conclusion: "success" }],
}
const stamp = "2026-09-10T07:56:21.1240712Z "
const line = (text, stepName = step) =>
  `${job.name}\t${stepName}\t${stamp}${text}`
const log = [
  line("[command]/usr/bin/git log -1 --format=%H"),
  line(merge),
].join("\n")
const run = { id: 42, run_attempt: 1, head_sha: head }
const input = () =>
  withCheckoutProof({
    headSha: head,
    provider: { runId: 42, runAttempt: 1 },
    lanes: [{ shards: [{ jobId: 101 }, { jobId: 102 }] }],
  })

test("checkout identity comes only from the successful pinned provider step", () => {
  assert.equal(checkoutShaFromStepLog(log, job), merge)
  assert.equal(
    checkoutShaFromStepLog(log.replaceAll(step, "UNKNOWN STEP"), job),
    null
  )
  const forged = [
    line("[command]/usr/bin/git log -1 --format=%H", "Run candidate setup"),
    line(head, "Run candidate setup"),
  ].join("\n")
  assert.equal(checkoutShaFromStepLog(forged, job), null)
  assert.equal(checkoutShaFromStepLog(`${log}\n${forged}`, job), merge)
  assert.equal(checkoutShaFromStepLog(`${log}\n${log}`, job), null)
  assert.equal(
    checkoutShaFromStepLog(log, {
      ...job,
      steps: [...job.steps, ...job.steps],
    }),
    null
  )
  assert.equal(
    checkoutShaFromStepLog(log, {
      ...job,
      steps: [{ name: step, conclusion: "failure" }],
    }),
    null
  )
  assert.equal(
    checkoutShaFromStepLog(log.replace(merge, "short-sha"), job),
    null
  )
})

test("collector retains the synthetic merge commit and looks up both Git trees", async () => {
  const reads = []
  const reader = {
    stepLog: async (repository, id) => {
      assert.equal(id, job.id)
      assert.equal(repository, "lapeninns/nabaperks")
      return log
    },
    json: async (path) => {
      reads.push(path)
      const sha = path.split("/").at(-1)
      return { sha, tree: { sha: tree } }
    },
  }
  const proof = await collectCheckoutProof({
    reader,
    repository: "lapeninns/nabaperks",
    run,
    jobs: [job],
  })
  assert.deepEqual(proof.checkouts, [
    { jobId: 101, checkoutSha: merge, treeSha: tree },
  ])
  assert.equal(proof.headTreeSha, tree)
  assert.equal(reads.length, 2)
  const document = input()
  document.lanes = [{ shards: [{ jobId: 101 }] }]
  document.provider.checkoutProof = proof
  assert.doesNotThrow(() => requireSameCheckoutTree(document, head))
})

test("different merge tree is incomplete even with the same run head and test counts", () => {
  const document = input()
  document.provider.checkoutProof.checkouts[1].treeSha = "d".repeat(40)
  assert.throws(
    () => requireSameCheckoutTree(document, head),
    /differs from the local head tree/
  )
})

test("every mapped job and the exact run attempt need checkout proof", () => {
  for (const change of [
    (x) => {
      delete x.provider.checkoutProof
    },
    (x) => x.provider.checkoutProof.checkouts.pop(),
    (x) => {
      x.provider.checkoutProof.checkouts[1] =
        x.provider.checkoutProof.checkouts[0]
    },
    (x) => {
      x.provider.checkoutProof.runAttempt = 2
    },
    (x) => {
      x.provider.checkoutProof.runId = 123
    },
    (x) => {
      x.provider.checkoutProof.headSha = merge
    },
    (x) => {
      x.provider.checkoutProof.checkouts[0].checkoutSha = "bad"
    },
  ]) {
    const document = input()
    change(document)
    assert.throws(
      () => requireSameCheckoutTree(document, head),
      /Missing complete/
    )
  }
})

test("unavailable logs or Git objects cannot fall back to the event head SHA", async () => {
  for (const reader of [
    {
      json: async () => {
        throw new Error("unavailable")
      },
    },
    {
      json: async () => ({ sha: head, tree: { sha: tree } }),
      stepLog: async () => "",
    },
    {
      json: async () => ({ sha: merge, tree: { sha: tree } }),
      stepLog: async () => log,
    },
  ])
    assert.equal(
      await collectCheckoutProof({
        reader,
        repository: "lapeninns/nabaperks",
        run,
        jobs: [job],
      }),
      null
    )
})

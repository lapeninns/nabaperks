/** Initial checkout identity for advisory comparison, not runtime attestation. */
export const CHECKOUT_ACTION =
  "actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1"
const SHA = /^[a-f0-9]{40}$/
const KIND = "github-checkout-logs-and-git-trees-v1"

/** gh prefixes each archive log line with its provider job and step names. */
export function checkoutShaFromStepLog(text, job) {
  const name = `Run ${CHECKOUT_ACTION}`
  const steps = job.steps?.filter((step) => step.name === name) ?? []
  if (steps.length !== 1 || steps[0].conclusion !== "success") return null
  const lines = String(text)
    .split(/\r?\n/)
    .map((line) => line.split("\t"))
    .filter(([jobName, step]) => jobName === job.name && step === name)
    .map((parts) =>
      parts
        .slice(2)
        .join("\t")
        .replace(/^\uFEFF?\d{4}-\d{2}-\d{2}T\S+Z /, "")
    )
  const revisions = []
  for (let i = 0; i < lines.length - 1; i += 1) {
    if (/^\[command\].*\/git log -1 --format=%H$/.test(lines[i])) {
      if (!SHA.test(lines[i + 1])) return null
      revisions.push(lines[i + 1])
    }
  }
  return revisions.length === 1 ? revisions[0] : null
}

/** Missing provider logs or Git objects remain unavailable, never head-SHA proof. */
export async function collectCheckoutProof({ reader, repository, run, jobs }) {
  try {
    const trees = new Map()
    const treeOf = async (sha) => {
      if (!trees.has(sha)) {
        const commit = await reader.json(
          `repos/${repository}/git/commits/${sha}`
        )
        if (commit.sha !== sha || !SHA.test(commit.tree?.sha ?? ""))
          throw new Error("Missing Git commit/tree identity")
        trees.set(sha, commit.tree.sha)
      }
      return trees.get(sha)
    }
    const headTreeSha = await treeOf(run.head_sha)
    const checkouts = []
    for (const job of jobs) {
      const log = await reader.stepLog(repository, job.id)
      const checkoutSha = checkoutShaFromStepLog(log, job)
      if (!checkoutSha)
        throw new Error(`Missing checkout proof for job ${job.id}`)
      checkouts.push({
        jobId: job.id,
        checkoutSha,
        treeSha: await treeOf(checkoutSha),
      })
    }
    return {
      kind: KIND,
      headSha: run.head_sha,
      headTreeSha,
      runId: run.id,
      runAttempt: run.run_attempt,
      checkouts,
    }
  } catch {
    return null
  }
}

/** Saved evidence is authenticated by its collector/operator before this call. */
export function requireSameCheckoutTree(hosted, headSha) {
  const proof = hosted.provider?.checkoutProof
  const jobIds = new Set(
    hosted.lanes?.flatMap(
      (lane) => lane.shards?.map((shard) => shard.jobId) ?? []
    )
  )
  if (
    proof?.kind !== KIND ||
    proof.headSha !== headSha ||
    !SHA.test(proof.headTreeSha ?? "") ||
    proof.runId !== hosted.provider.runId ||
    proof.runAttempt !== hosted.provider.runAttempt ||
    !Number.isSafeInteger(proof.runId) ||
    !Number.isSafeInteger(proof.runAttempt) ||
    !jobIds.size ||
    !Array.isArray(proof.checkouts) ||
    proof.checkouts.length !== jobIds.size ||
    new Set(proof.checkouts.map((entry) => entry.jobId)).size !== jobIds.size ||
    proof.checkouts.some(
      (entry) =>
        !jobIds.has(entry.jobId) ||
        !SHA.test(entry.checkoutSha ?? "") ||
        !SHA.test(entry.treeSha ?? "")
    )
  )
    throw new Error(
      "Missing complete hosted checkout/tree proof for the local head SHA"
    )
  if (proof.checkouts.some((entry) => entry.treeSha !== proof.headTreeSha))
    throw new Error(
      "Hosted checkout tree differs from the local head tree; same PR head is not same-source evidence"
    )
}

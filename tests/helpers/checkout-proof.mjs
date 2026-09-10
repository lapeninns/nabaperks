/** Fabricated provider proof for offline comparator tests only. */
export function withCheckoutProof(document) {
  document.provider.runId ??= 42
  document.provider.runAttempt ??= 1
  document.lanes.forEach((lane, index) => {
    lane.shards ??= [{ jobId: index + 100 }]
  })
  document.provider.checkoutProof = {
    kind: "github-checkout-logs-and-git-trees-v1",
    headSha: document.headSha,
    headTreeSha: "b".repeat(40),
    runId: document.provider.runId,
    runAttempt: document.provider.runAttempt,
    checkouts: [
      ...new Set(
        document.lanes.flatMap((lane) =>
          lane.shards.map((shard) => shard.jobId)
        )
      ),
    ].map((jobId) => ({
      jobId,
      checkoutSha: "c".repeat(40),
      treeSha: "b".repeat(40),
    })),
  }
  return document
}

// Codex can finish a clean review with a reaction and its bot-owned summary,
// without creating a PullRequestReview. Resolve its abbreviated commit through
// GitHub before accepting coverage; never infer a full SHA from a prefix match.
export function reviewSummaryCommit(comment, reviewer) {
  if (
    comment.user?.id !== reviewer.userId ||
    comment.user?.login !== reviewer.login ||
    comment.user?.type !== "Bot"
  )
    return null
  if (!comment.body?.includes("<!-- codex-pull-request-review-summary -->"))
    return null
  const rows = comment.body
    .split("\n")
    .filter((line) => /^\|.*\*\*Code Review\*\*\s*\|/.test(line))
  if (rows.length !== 1) return null
  const columns = rows[0].split("|")
  if (!/✅\s*\*\*Completed\*\*/.test(columns[2] ?? "")) return null
  const match = /^\s*`([a-f0-9]{7,40})`\s*$/.exec(columns[3] ?? "")
  return match?.[1] ?? null
}

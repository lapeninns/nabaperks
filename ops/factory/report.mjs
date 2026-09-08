const safe = (value) => String(value ?? "").replace(/[\r\n|<>`]/g, " ")

export function renderFactoryReport(snapshot) {
  const lines = [
    "# Nabaperks delivery decisions",
    "",
    `Checked ${safe(snapshot.checkedAt)}. Advisory evidence only; GitHub merge and release rules remain authoritative.`,
    "",
    "| Work | State | Next owner | Action |",
    "| --- | --- | --- | --- |",
  ]
  for (const item of snapshot.items) {
    const label =
      item.kind === "pull-request"
        ? `PR #${item.number}`
        : `Release ${item.runId}`
    // URLs are reconstructed from validated provider IDs, never PR prose.
    const path =
      item.kind === "pull-request"
        ? `pull/${item.number}`
        : `actions/runs/${item.runId}`
    lines.push(
      `| [${label}](https://github.com/lapeninns/nabaperks/${path}) | ${safe(item.state)} | ${safe(item.owner)} | ${safe(item.action)} |`
    )
  }
  for (const item of snapshot.items)
    lines.push(
      "",
      `- **${item.kind === "pull-request" ? `PR #${item.number}` : `Release ${item.runId}`}** (${safe(item.sha?.slice(0, 12))}): ${safe(item.reason)}`
    )
  if (!snapshot.items.length)
    lines.push(
      "",
      "No open PRs or release runs were returned. This does not establish production health."
    )
  return lines.join("\n") + "\n"
}

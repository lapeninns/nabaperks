import assert from "node:assert/strict"
import { test } from "node:test"
import { reviewSummaryCommit } from "../../ops/factory/review-summary.mjs"
const reviewer = { userId: 199175422, login: "chatgpt-codex-connector[bot]" }
const comment = {
  user: { id: reviewer.userId, login: reviewer.login, type: "Bot" },
  body: '<!-- codex-pull-request-review-summary -->\n| 📝 **Code Review** | ✅ **Completed** <relative-time datetime="2026-09-08T10:56:55Z">done</relative-time> | `ce2a6e7` | PR opened |',
}
test("completed bot summary exposes only a commit requiring provider resolution", () => {
  assert.equal(reviewSummaryCommit(comment, reviewer), "ce2a6e7")
  assert.equal(
    reviewSummaryCommit(
      { ...comment, user: { ...comment.user, id: 1 } },
      reviewer
    ),
    null
  )
  assert.equal(
    reviewSummaryCommit(
      { ...comment, user: { ...comment.user, type: "User" } },
      reviewer
    ),
    null
  )
  assert.equal(
    reviewSummaryCommit(
      { ...comment, body: comment.body.replace("Completed", "Running") },
      reviewer
    ),
    null
  )
  assert.equal(
    reviewSummaryCommit(
      { ...comment, body: comment.body.replace("ce2a6e7", "abcdef") },
      reviewer
    ),
    null
  )
  assert.equal(
    reviewSummaryCommit(
      { ...comment, body: comment.body + "\n" + comment.body.split("\n")[1] },
      reviewer
    ),
    null
  )
})

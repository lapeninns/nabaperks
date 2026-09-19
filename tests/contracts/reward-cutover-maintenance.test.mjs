import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { test } from "node:test"

const runbook = await readFile(
  new URL("../../docs/operations/reward-logic-cutover-rehearsal.md", import.meta.url),
  "utf8"
)

test("Stage B traffic fencing preserves the baseline alias and covers public legal surfaces", () => {
  assert.match(runbook, /project-wide Vercel WAF fence/)
  assert.match(runbook, /custom rules take effect immediately without a redeploy/)
  assert.match(runbook, /reward-logic-release-probes/)
  assert.match(runbook, /reward-logic-customer-fence/)
  assert.match(
    runbook,
    /\/api\/health.*\/api\/readiness.*\/api\/auth\/hooks\/send-email/s
  )
  assert.match(runbook, /Place it before the deny rule/)
  assert.match(runbook, /Request Path Starts with \/.*action `Deny`/s)
  assert.match(runbook, /`\/`, `\/terms`, `\/privacy` and `\/sw\.js` are denied/)
  assert.match(runbook, /same alias,\s*deployment ID and full revision/s)
  assert.match(runbook, /before-promotion.*must still equal Stage A/s)
  assert.match(runbook, /post-promotion.*must equal the exact Stage B\s*candidate/s)
  assert.match(runbook, /remove both temporary rules in\s*one reviewed WAF publication/s)
  assert.match(runbook, /does not authorise a\s*live WAF change/s)
})

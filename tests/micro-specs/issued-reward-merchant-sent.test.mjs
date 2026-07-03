import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

/**
 * MS-rewards-merchant-sent — source-contract tier. Proves the send seams are
 * wired without a browser/DB: the pure validation, the action (rate limit +
 * uniform response + RPC), the sent-list loader, and the entry points.
 */
const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)
const read = (...segments) =>
  readFileSync(path.join(projectRoot, ...segments), "utf8")

test("R-5: the pure validator + uniform success are exported", () => {
  const fields = read("lib", "merchant", "send-reward-fields.ts")
  assert.match(fields, /export function validateSendRewardFields/)
  assert.match(fields, /export const SEND_REWARD_SUCCESS/)
  assert.match(fields, /waiting when they join/)
})

test("R-1/R-4/R-6: the send action rate-limits, calls the RPC, and stays uniform", () => {
  const action = read("app", "app", "customers", "send-reward", "actions.ts")
  assert.match(action, /export async function sendMerchantRewardAction/)
  assert.match(action, /enforceRateLimit/)
  assert.match(action, /issue_merchant_direct_reward/)
  assert.match(action, /SEND_REWARD_SUCCESS/)
  // Unmatched contact returns the uniform success with nothing recorded.
  assert.match(action, /matchMerchantMembershipForContact/)
})

test("R-7: the sent-list loader reads masked merchant_direct rewards", () => {
  const loader = read("lib", "merchant", "sent-rewards.ts")
  assert.match(loader, /export async function getMerchantSentRewards/)
  assert.match(loader, /'merchant_direct'|"merchant_direct"/)
  assert.match(loader, /customers_masked/)
})

test("the members page and rows link to the send flow", () => {
  const page = read("app", "app", "customers", "page.tsx")
  assert.match(page, /\/app\/customers\/send-reward/)
  assert.match(page, /Send a reward/)

  const table = read("components", "merchant", "customer-readback-table.tsx")
  assert.match(table, /\/app\/customers\/send-reward\?member=/)
})

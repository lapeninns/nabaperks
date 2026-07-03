import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

/**
 * MS-rewards-issued-source-rails — source-contract tier. Proves the app seams
 * are wired for issued rewards without a browser or DB: the loader selects
 * `source` (R-1), the wallet cards render the source badge + expiry (R-9), the
 * reward-ready producer is scoped to earned rewards (R-8), and the new
 * product-event names are registered in analytics + activity (R-10).
 */

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function readProjectFile(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

test("R-1: the rewards loader selects and types the reward source", () => {
  const loader = readProjectFile("lib", "customer", "rewards.ts")
  assert.match(loader, /select\([\s\S]*?\bsource\b[\s\S]*?\)/)
  assert.match(loader, /source:\s*RewardSource/)
})

test("R-9: the display helpers expose the source badge and expiry note", () => {
  const display = readProjectFile("lib", "customer", "issued-reward-display.ts")
  assert.match(display, /export type RewardSource/)
  assert.match(display, /export function rewardSourceBadge/)
  assert.match(display, /export function rewardExpiryNote/)
})

test("R-9: the wallet cards render the badge and expiry and the page mounts them", () => {
  const cards = readProjectFile("components", "customer", "reward-list-cards.tsx")
  assert.match(cards, /export function RedeemableReward/)
  assert.match(cards, /export function QuietReward/)
  assert.match(cards, /rewardSourceBadge/)
  assert.match(cards, /rewardExpiryNote/)

  const page = readProjectFile("app", "home", "(authed)", "rewards", "page.tsx")
  assert.match(page, /components\/customer\/reward-list-cards/)
  assert.match(page, /const \{ redeemable, upcoming, redeemed, expired \}/)
})

test("R-8: the reward-ready push producer only enqueues stamp_cycle rewards", () => {
  const worker = readProjectFile("lib", "notifications", "delivery-worker.ts")
  const start = worker.indexOf("async function enqueueRewardReady")
  assert.ok(start >= 0, "enqueueRewardReady exists")
  const after = worker.indexOf("async function", start + 1)
  const body = worker.slice(start, after === -1 ? undefined : after)
  assert.match(body, /\.eq\("source", "stamp_cycle"\)/)
})

test("R-10: the issued-reward product events are registered in analytics", () => {
  const events = readProjectFile("lib", "analytics", "events.ts")
  assert.match(events, /"reward_issued"/)
  assert.match(events, /"reward_sent"/)
  assert.match(events, /"reward_invite_sent"/)
})

test("R-10: the merchant activity feed knows the issued-reward events", () => {
  const activity = readProjectFile("lib", "merchant", "activity.ts")
  // Registered in the queryable event set and the reward category.
  assert.match(activity, /"reward_issued"/)
  assert.match(activity, /"reward_sent"/)
  assert.match(activity, /"reward_invite_sent"/)
  assert.match(activity, /reward:\s*\[[\s\S]*?"reward_issued"[\s\S]*?\]/)
  // Source-aware headlines.
  assert.match(activity, /Birthday treat issued/)
  assert.match(activity, /Reward sent/)
  assert.match(activity, /Reward invite sent/)
})

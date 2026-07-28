import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import { fileURLToPath } from "node:url"

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../.."
)

function readProjectFile(...segments) {
  return readFileSync(path.join(projectRoot, ...segments), "utf8")
}

test("Given customer rewards grow over time When the wallet loads Then current rewards stay visible and terminal history is paginated", () => {
  const rewardsLoader = readProjectFile("lib", "customer", "rewards.ts")
  const pagination = readProjectFile(
    "lib",
    "customer",
    "reward-history-pagination.ts"
  )
  const rewardsPage = readProjectFile(
    "app",
    "home",
    "(authed)",
    "rewards",
    "page.tsx"
  )

  assert.match(rewardsLoader, /expired: CustomerRewardItem\[\]/)
  assert.match(rewardsLoader, /\.eq\("status", "unlocked"\)/)
  assert.match(rewardsLoader, /\.in\("status", \["redeemed", "expired"\]\)/)
  assert.match(rewardsLoader, /\.range\(historyRange\.from, historyRange\.to\)/)
  assert.match(rewardsLoader, /\{ count: "exact" \}/)
  assert.match(pagination, /CUSTOMER_REWARD_HISTORY_PAGE_SIZE = 20/)
  assert.match(rewardsPage, /normalizeRewardHistoryPage/)
  assert.match(
    rewardsPage,
    /redeemable\.length \+ upcoming\.length \+ redeemed\.length \+ expired\.length/
  )
  assert.match(rewardsPage, /title="Expired"/)
  assert.match(rewardsPage, /Rewards that are no longer available to scan/)
  assert.match(rewardsPage, /Expired \$\{formatDate\(reward\.expiredAt\)\}/)
  assert.match(rewardsPage, /aria-label="Reward history pages"/)
})

test("Given customer stamp history is lifetime data When home loads Then only active-cycle labels and today's status are queried", () => {
  const stamps = readProjectFile("lib", "customer", "card-stamps.ts")

  assert.match(stamps, /activeCycleFilters/)
  assert.match(stamps, /\.or\(activeCycleFilters\.join\(","\)\)/)
  assert.match(stamps, /\.eq\("earned_business_date", today\)/)
  assert.doesNotMatch(
    stamps,
    /const \{ data, error \} = await query\.order\("created_at"/
  )
})

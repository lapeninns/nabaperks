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

test("Given a reward detail route is loaded When source is inspected Then reward ownership and unavailable state come from the server loader", () => {
  const loader = readProjectFile("lib", "customer", "experience", "load-reward.ts")

  assert.match(loader, /getCustomerRewardState\(rewardId\)/)
  assert.match(loader, /if \(rewardState\.status !== "ready"\)/)
  assert.match(loader, /customerLoginHref\(`\/reward\/\$\{rewardId\}`\)/)
  assert.match(loader, /const location = await getLocationRequirement\(loyaltyCard\.location_id\)/)
  assert.match(loader, /redeemedAt: reward\.redeemed_at/)
  assert.match(loader, /unavailableReason: rewardState\.unavailableReason/)
  assert.doesNotMatch(loader, /searchParams|request|customerId:\s*string/)
})

test("Given a reward might be waiting, blocked, or ready When the loader computes redeemability Then every gate is server-derived", () => {
  const loader = readProjectFile("lib", "customer", "experience", "load-reward.ts")
  const redeemableBlock = loader.slice(
    loader.indexOf("const redeemable ="),
    loader.indexOf("const profileGate =")
  )

  assert.match(redeemableBlock, /reward\.status === "unlocked"/)
  assert.match(redeemableBlock, /!rewardState\.unavailableReason/)
  assert.match(redeemableBlock, /rewardStampThresholdMet\(/)
  assert.match(redeemableBlock, /isRedeemableFrom\(reward\.redeemable_from\)/)
})

test("Given profile completion is only needed for collection When the reward is not redeemable Then the profile gate is skipped", () => {
  const loader = readProjectFile("lib", "customer", "experience", "load-reward.ts")

  assert.match(
    loader,
    /const profileGate = redeemable \? await loadProfileGate\(\) : undefined/
  )
  assert.match(loader, /profileGate,?/)
})

test("Given the reward state uses service-role reads When source is inspected Then another customer's reward cannot become a detail page", () => {
  const reward = readProjectFile("lib", "customer", "reward.ts")
  const stateLoader = reward.slice(
    reward.indexOf("export async function getCustomerRewardState"),
    reward.indexOf("function first<T>")
  )

  assert.match(stateLoader, /getCurrentCustomer\(\)/)
  assert.match(stateLoader, /createSupabaseServiceRoleClient\(\)/)
  assert.match(stateLoader, /\.from\("reward_events"\)/)
  assert.match(stateLoader, /customer_id/)
  assert.match(stateLoader, /\.eq\("id", rewardId\)/)
  assert.match(
    stateLoader,
    /if \(reward\.customer_id !== currentCustomer\.id\) \{[\s\S]*status: "unauthorized"/
  )
  assert.ok(
    stateLoader.indexOf("reward.customer_id !== currentCustomer.id") <
      stateLoader.indexOf("loyaltyAvailability"),
    "reward ownership must be checked before availability facts are returned"
  )
})

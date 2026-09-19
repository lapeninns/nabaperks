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
  const loader = readProjectFile(
    "lib",
    "customer",
    "experience",
    "load-reward.ts"
  )

  assert.match(loader, /getCustomerRewardState\(rewardId\)/)
  assert.match(loader, /if \(rewardState\.status !== "ready"\)/)
  assert.match(loader, /customerLoginHref\(`\/reward\/\$\{rewardId\}`\)/)
  assert.match(
    loader,
    /const location = await getLocationRequirement\(loyaltyCard\.location_id\)/
  )
  assert.match(loader, /redeemedAt: reward\.redeemed_at/)
  assert.match(loader, /availability\.status === "blocked"/)
  assert.doesNotMatch(loader, /searchParams|request|customerId:\s*string/)
})

test("Given a reward might be waiting, blocked, or ready When the loader computes redeemability Then every gate is server-derived", () => {
  const loader = readProjectFile(
    "lib",
    "customer",
    "experience",
    "load-reward.ts"
  )
  const redeemableBlock = loader.slice(
    loader.indexOf("const availability ="),
    loader.indexOf("const profileGate =")
  )

  assert.match(redeemableBlock, /rewardQrAvailability\(/)
  assert.match(redeemableBlock, /collectionState: collection\.state/)
  assert.match(redeemableBlock, /collectionReason: collection\.reason/)
  assert.match(redeemableBlock, /availableFrom: collection\.availableFrom/)
})

test("Given collection requirements govern a collectable or waiting reward When the reward is blocked Then the profile gate is skipped", () => {
  const loader = readProjectFile(
    "lib",
    "customer",
    "experience",
    "load-reward.ts"
  )

  // The waiting screen offers the same requirements as an optional early step,
  // so the gate is read whenever collection is still ahead — and never for a
  // reward the server has already blocked or expired.
  assert.match(loader, /const gateApplies = availability\.status !== "blocked"/)
  assert.match(
    loader,
    /const profileGate = gateApplies \? await loadProfileGate\(\) : undefined/
  )
  assert.match(loader, /profileGate,?/)
})

test("Given early preparation is opt-in When the reward route is loaded Then the prepare flag only reaches the profile gate", () => {
  const loader = readProjectFile(
    "lib",
    "customer",
    "experience",
    "load-reward.ts"
  )
  const derive = readProjectFile("lib", "customer", "experience", "derive.ts")

  assert.match(loader, /prepare: flags\.prepare === true/)
  // Nothing about redeemability may be computed from the flag.
  assert.doesNotMatch(loader, /availableForReview =[^\n]*prepare/)
  assert.doesNotMatch(derive, /availableForReview[^\n]*prepare/)
  assert.match(derive, /preparing:\s*\n?\s*context\.prepare === true/)
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
      stateLoader.indexOf("await getRewardCollectionState"),
    "reward ownership must be checked before availability facts are returned"
  )
})

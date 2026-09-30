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

test("Given expired rewards are returned by the data layer When the rewards page renders Then expired history is visible", () => {
  const rewardsLoader = readProjectFile("lib", "customer", "rewards.ts")
  const rewardsPage = readProjectFile(
    "app",
    "home",
    "(authed)",
    "rewards",
    "page.tsx"
  )

  assert.match(rewardsLoader, /expired: CustomerRewardItem\[\]/)
  assert.match(
    rewardsLoader,
    /\.in\("status", \["unlocked", "redeemed", "expired"\]\)/
  )
  const rewardSections = readProjectFile(
    "components",
    "customer",
    "reward-list-cards.tsx"
  )
  assert.match(
    rewardsPage,
    /const \{ redeemable, needsSetup, upcoming, redeemed, expired \}/
  )
  assert.match(rewardsPage, /<RewardListSections/)
  assert.match(
    rewardSections,
    /redeemable\.length \+\s+needsSetup\.length \+\s+upcoming\.length \+\s+redeemed\.length \+\s+expired\.length/
  )
  // Expired history keeps its own group, in guest words.
  assert.match(rewardSections, /title="No longer available"/)
  assert.match(rewardSections, /Expired \$\{formatDate\(reward\.expiredAt\)\}/)
  // A setup-blocked reward has its own group and is never listed as ready.
  assert.match(rewardSections, /title="Needs setting up"/)
  assert.match(rewardSections, /title="Ready to collect"/)
  assert.doesNotMatch(rewardSections, /Ready for scan|merchant scan/)
})

test("Given a reward held only by setup When the card renders Then it uses the home setup wording, not a code", () => {
  const loader = readProjectFile(
    "lib",
    "customer",
    "experience",
    "load-card.ts"
  )
  const card = readProjectFile(
    "components",
    "customer",
    "customer-card-experience.tsx"
  )

  // Both the stamp-cycle reward and the gift are classified by the shared helper.
  assert.equal(
    loader.match(/rewardCollectability\([\s\S]*?\) === "needs_setup"/g)?.length,
    2
  )
  assert.match(card, /exp\.rewardNeedsSetup\s+\? REWARD_NEEDS_SETUP_LINE/)
  assert.match(
    card,
    /gift\.needsSetup \? REWARD_NEEDS_SETUP_ACTION : "Open gift QR"/
  )
})

test("every reward list and card loader resolves the photo-ID reason with the stated date of birth", () => {
  const rewards = readProjectFile("lib", "customer", "rewards.ts")
  const home = readProjectFile("lib", "customer", "home.ts")
  const card = readProjectFile("lib", "customer", "card.ts")

  assert.match(
    rewards,
    /groupRewardsForList\(items, \{\s*statedDateOfBirthIsAdult: isAdultDateOfBirth\(customer\.dateOfBirth\)/
  )
  assert.match(
    home,
    /buildRewardCountsByMembership\([\s\S]*?statedDateOfBirthIsAdult: isAdultDateOfBirth\(customer\.dateOfBirth\)/
  )
  assert.match(card, /isAdultDateOfBirth\(\s*currentCustomer\.dateOfBirth\s*\)/)
  assert.match(
    card,
    /resolveAgeCheckReason\(\s*reward\.collection_reason,\s*statedDateOfBirthIsAdult\s*\)/
  )
  assert.match(card, /pickStampBlockingUnlockedReward\(rewards\)/)
  assert.match(card, /pickIssuedUnlockedReward\(rewards\)/)
})

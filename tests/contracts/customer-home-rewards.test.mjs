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
  assert.match(rewardsLoader, /\.in\("status", \["unlocked", "redeemed", "expired"\]\)/)
  assert.match(rewardsPage, /const \{ redeemable, upcoming, redeemed, expired \}/)
  assert.match(
    rewardsPage,
    /redeemable\.length \+ upcoming\.length \+ redeemed\.length \+ expired\.length/
  )
  assert.match(rewardsPage, /title="Expired"/)
  assert.match(rewardsPage, /Rewards that are no longer available to scan/)
  assert.match(rewardsPage, /Expired \$\{formatDate\(reward\.expiredAt\)\}/)
})

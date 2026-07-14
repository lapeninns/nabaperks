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

test("Given the customer reward status route is polled When source is inspected Then responses are private and non-enumerating", () => {
  const route = readProjectFile(
    "app",
    "reward",
    "[rewardId]",
    "status",
    "route.ts"
  )

  assert.match(route, /export const dynamic = "force-dynamic"/)
  assert.match(route, /const NO_STORE = "no-store, max-age=0"/)
  assert.match(route, /headers: \{ "cache-control": NO_STORE \}/)
  assert.match(route, /const \{ rewardId \} = await context\.params/)
  assert.match(route, /getCustomerRewardStatus\(rewardId\)/)
  assert.match(route, /json\(\{ error: "unauthenticated" \}, 401\)/)
  assert.match(route, /rewardState\.status !== "ready"[\s\S]*json\(\{ error: "not_found" \}, 404\)/)
  assert.match(route, /redeemed: reward\.status === "redeemed"/)
  assert.doesNotMatch(route, /searchParams|nextUrl|request\.url|customerId/)
})

test("Given reward status uses service-role reads When the loader runs Then ownership comes only from the current customer session", () => {
  const reward = readProjectFile("lib", "customer", "reward.ts")
  const statusLoader = reward.slice(
    reward.indexOf("export async function getCustomerRewardStatus"),
    reward.indexOf("export async function getCustomerRewardState")
  )

  assert.match(statusLoader, /getCurrentCustomer\(\)/)
  assert.match(statusLoader, /createSupabaseServiceRoleClient\(\)/)
  assert.match(statusLoader, /\.select\("status, redeemed_at, customer_id"\)/)
  assert.match(statusLoader, /\.eq\("id", rewardId\)/)
  assert.match(statusLoader, /\.maybeSingle\(\)/)
  assert.match(
    statusLoader,
    /if \(reward\.customer_id !== currentCustomer\.id\) \{[\s\S]*status: "unauthorized"/
  )
  assert.doesNotMatch(statusLoader, /searchParams|request/)
  assert.doesNotMatch(statusLoader, /customerId:\s*string/)
})

test("Given the reward page waits for merchant collection When the client polls Then it stays single-flight and pauses while hidden", () => {
  const live = readProjectFile(
    "components",
    "customer",
    "reward-collection-live.tsx"
  )

  assert.match(live, /const POLL_INTERVAL_MS = 1500/)
  assert.match(live, /setTimeout\(check, POLL_INTERVAL_MS\)/)
  assert.doesNotMatch(live, /setInterval\(/)
  assert.match(live, /let polling = false/)
  assert.match(live, /if \(!active \|\| polling\) return/)
  assert.match(live, /document\.visibilityState === "hidden"[\s\S]*return/)
  assert.match(live, /document\.visibilityState === "visible"[\s\S]*check\(\)/)
  assert.match(live, /fetch\(`\/reward\/\$\{rewardId\}\/status`, \{[\s\S]*cache: "no-store"/)
  assert.match(live, /controller = new AbortController\(\)/)
  assert.match(live, /controller\?\.abort\(\)/)
  assert.match(live, /window\.addEventListener\("focus", resume\)/)
  assert.match(live, /window\.removeEventListener\("focus", resume\)/)
})

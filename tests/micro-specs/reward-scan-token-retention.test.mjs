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

test("Given reward QR refreshes can happen repeatedly When tokens are minted Then expired rows are purged and reusable tokens are preferred", () => {
  const migration = readProjectFile(
    "supabase",
    "migrations",
    "20260630123000_cleanup_reward_scan_tokens.sql"
  )
  const tokenModule = readProjectFile("lib", "customer", "reward-scan-token.ts")
  const qrHelper = readProjectFile("lib", "customer", "reward-qr.ts")

  assert.match(
    migration,
    /create or replace function public\.purge_expired_reward_scan_tokens/
  )
  assert.match(migration, /delete from public\.reward_scan_tokens[\s\S]*expires_at <= p_now/)
  assert.match(
    migration,
    /perform public\.purge_expired_reward_scan_tokens\(now\(\)\)/
  )
  assert.match(
    migration,
    /reward_scan_tokens\.consumed_at is null[\s\S]*reward_scan_tokens\.expires_at > now\(\) \+ interval '5 minutes'/
  )
  assert.match(migration, /return next;[\s\S]*return;[\s\S]*insert into public\.reward_scan_tokens/)
  assert.match(tokenModule, /rpc\("create_reward_scan_token"/)
  assert.match(qrHelper, /server may reuse a token/)
  assert.doesNotMatch(qrHelper, /each fetch mints a new token/)
})

test("Given a reward QR image is requested When source is inspected Then token minting is gated and private", () => {
  const route = readProjectFile(
    "app",
    "reward",
    "[rewardId]",
    "qr.png",
    "route.ts"
  )
  const stateGateIndex = route.indexOf('rewardState.status !== "ready"')
  const redeemableIndex = route.indexOf("const redeemable =")
  const tokenIndex = route.indexOf("await createRewardScanToken")
  const renderIndex = route.indexOf("await renderQrCodePng")

  assert.match(route, /getCustomerRewardState\(rewardId\)/)
  assert.match(route, /if \(rewardState\.status !== "ready"\)/)
  assert.match(route, /return new NextResponse\("Reward QR not found", \{ status: 404 \}\)/)
  assert.match(route, /rewardState\.reward\.status === "unlocked"/)
  assert.match(route, /!rewardState\.unavailableReason/)
  assert.match(
    route,
    /rewardState\.membership\.current_stamp_count >=\s*rewardState\.loyaltyCard\.stamps_required/
  )
  assert.match(route, /isRedeemableFrom\(rewardState\.reward\.redeemable_from\)/)
  assert.match(route, /return new NextResponse\("Reward QR not ready", \{ status: 404 \}\)/)
  assert.match(route, /rewardId,\s*customerId: rewardState\.customerId/)
  assert.match(route, /\$\{serverEnv\.NEXT_PUBLIC_APP_URL\}\/r\/\$\{token\.scanToken\}/)
  assert.match(route, /"Content-Type": "image\/png"/)
  assert.match(route, /"Cache-Control": "private, no-store"/)
  assert.doesNotMatch(route, /searchParams|request\.url|customerId:\s*string/)
  assert.ok(
    stateGateIndex > -1 &&
      redeemableIndex > stateGateIndex &&
      tokenIndex > redeemableIndex &&
      renderIndex > tokenIndex,
    "the route must prove state before minting or rendering a scan token"
  )
})

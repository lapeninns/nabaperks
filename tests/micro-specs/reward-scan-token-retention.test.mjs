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

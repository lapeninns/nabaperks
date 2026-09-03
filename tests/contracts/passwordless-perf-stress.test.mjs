import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"

const source = readFileSync(
  new URL("../../scripts/perf-stress.mjs", import.meta.url),
  "utf8"
)

test("performance stress installs a generated passwordless session before app navigation", () => {
  const addCookiesAt = source.indexOf("context.addCookies(")
  const appNavigationAt = source.indexOf("page.goto(`${APP_URL}/app`")

  assert.match(source, /createServerClient/)
  assert.match(source, /auth\.admin\.generateLink/)
  assert.match(source, /auth\.verifyOtp/)
  assert.ok(addCookiesAt > 0 && appNavigationAt > addCookiesAt)
  assert.match(source, /Passwordless benchmark session was not accepted/)
  assert.doesNotMatch(
    source,
    /MERCHANT_PASSWORD|#password|signInWithPassword|name="password"/
  )
})

test("performance stress refuses non-local database, Auth and browser targets", () => {
  assert.match(source, /assertLocalTarget\(dbUrl, "SUPABASE_DB_URL"/)
  assert.match(
    source,
    /assertLocalTarget\(supabaseUrl, "NEXT_PUBLIC_SUPABASE_URL"/
  )
  assert.match(source, /assertLocalTarget\(APP_URL, "PERF_STRESS_APP_URL"/)
  assert.match(source, /must target a local disposable service/)
})

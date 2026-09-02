import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const actions = readFileSync(
  new URL("../../app/(auth)/actions.ts", import.meta.url),
  "utf8"
)
const core = readFileSync(
  new URL("../../lib/auth/merchant-auth-rate-limit-core.ts", import.meta.url),
  "utf8"
)

test("merchant password auth charges source and account budgets before the sink", () => {
  assert.match(core, /merchant-signin:\$\{normalizedEmail\}:account-window/)
  assert.match(core, /if \(scope !== "merchant-signin"\) return \[source\]/)

  const limiterAt = actions.indexOf(
    'enforceAuthRateLimit("merchant-signin", email)'
  )
  const passwordSinkAt = actions.indexOf("supabase.auth.signInWithPassword")
  assert.ok(limiterAt > 0)
  assert.ok(passwordSinkAt > limiterAt)
  assert.match(
    actions,
    /for \(const config of configs\) \{\s*await enforceRateLimit\(config\)/
  )
})

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"

const root = process.cwd()

function read(...parts) {
  return readFileSync(join(root, ...parts), "utf8")
}

test("Supabase-host classification rejects suffix lookalikes", async () => {
  const { shouldRequireSsl } = await import(
    "../../scripts/provider-readiness/runtime.mjs"
  )

  assert.equal(shouldRequireSsl("https://example.supabase.com/path"), true)
  assert.equal(shouldRequireSsl("https://supabase.com/path"), true)
  assert.equal(shouldRequireSsl("https://evilsupabase.com/path"), false)
  assert.equal(shouldRequireSsl("https://supabase.com.evil.example/path"), false)
  assert.equal(
    shouldRequireSsl("https://evil.example/supabase.com?next=supabase.com"),
    false
  )
})

test("production dependency policy pins a patched PostCSS", () => {
  const packageJson = JSON.parse(read("package.json"))
  const pinnedPostcss = packageJson.pnpm?.overrides?.postcss

  assert.match(pinnedPostcss ?? "", /^8\.(?:[6-9]|[1-9]\d)\.|^8\.5\.(?:1\d|[2-9]\d)$/)
})

test("build tooling transitive dependencies are pinned past active advisories", () => {
  const packageJson = JSON.parse(read("package.json"))
  const overrides = packageJson.pnpm?.overrides ?? {}

  assert.equal(packageJson.scripts?.["security:audit"], "pnpm audit")
  assert.equal(overrides.tmp, "0.2.7")
  assert.equal(overrides.uuid, "11.1.1")
  assert.equal(overrides.qs, "6.15.2")
})

test("auth callback success remains conditional on Supabase verification", () => {
  const source = read("app", "auth", "confirm", "route.ts")

  assert.match(source, /exchangeCodeForSession\(code\)/)
  assert.match(source, /verifyOtp\(\{[\s\S]*token_hash: tokenHash/)
  assert.equal((source.match(/if \(!error\) \{/g) ?? []).length, 2)
  assert.match(source, /url\.origin !== origin/)
  assert.match(source, /merchantLoginHref\(\{ error: "verification", next \}\)/)
})

test("checked-in harness values are not shaped like provider credentials", () => {
  const sources = [
    read("scripts", "supabase-local.mjs"),
    read("scripts", "supabase-linked.mjs"),
    read("scripts", "check-supabase-migrations.mjs"),
    read("tests", "contracts", "production-release-controls.test.mjs"),
    read(".github", "workflows", "ci.yml"),
  ].join("\n")

  assert.equal(/whsec_[A-Za-z0-9+/=_-]{6,}/.test(sources), false)
})

import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"

const root = process.cwd()

function read(...parts) {
  return readFileSync(join(root, ...parts), "utf8")
}

function workspaceOverride(name) {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return read("pnpm-workspace.yaml")
    .match(new RegExp(`^  ${escapedName}: (.+)$`, "m"))?.[1]
    ?.replace(/^["']|["']$/g, "")
}

test("Supabase-host classification rejects suffix lookalikes", async () => {
  const { shouldRequireSsl } =
    await import("../../scripts/provider-readiness/runtime.mjs")

  assert.equal(shouldRequireSsl("https://example.supabase.com/path"), true)
  assert.equal(shouldRequireSsl("https://supabase.com/path"), true)
  assert.equal(shouldRequireSsl("postgres://db.project.supabase.co/db"), true)
  assert.equal(shouldRequireSsl("https://evilsupabase.com/path"), false)
  assert.equal(
    shouldRequireSsl("https://supabase.com.evil.example/path"),
    false
  )
  assert.equal(
    shouldRequireSsl("https://evil.example/supabase.com?next=supabase.com"),
    false
  )
})

test("production dependency policy pins a patched PostCSS", () => {
  const pinnedPostcss = workspaceOverride("postcss")

  assert.match(
    pinnedPostcss ?? "",
    /^8\.(?:[6-9]|[1-9]\d)\.|^8\.5\.(?:1\d|[2-9]\d)$/
  )
})

test("build tooling transitive dependencies are pinned past active advisories", () => {
  const packageJson = JSON.parse(read("package.json"))

  assert.equal(packageJson.scripts?.["security:audit"], "pnpm audit")
  assert.equal(workspaceOverride("tmp"), "0.2.7")
  assert.equal(workspaceOverride("uuid"), "11.1.1")
  assert.equal(workspaceOverride("qs"), "6.15.2")
  assert.equal(workspaceOverride("brace-expansion"), "5.0.8")
  assert.match(
    read("pnpm-workspace.yaml"),
    /^patchedDependencies:\n  minimatch@3\.1\.5: patches\/minimatch@3\.1\.5\.patch$/m
  )
})

test("auth callback installs a session only from a browser-bound PKCE exchange", () => {
  const source = read("app", "auth", "confirm", "route.ts")

  assert.match(source, /exchangeCodeForSession\(code\)/)

  // A bare email token hash is a bearer proof with no browser binding, so
  // redeeming it here let anyone holding one sign an unrelated browser into
  // that account. The pin is inverted: this branch must never come back.
  assert.doesNotMatch(source, /auth\.verifyOtp\(/)
  assert.doesNotMatch(source, /searchParams\.get\("token_hash"\)/)
  assert.equal((source.match(/if \(!error\) \{/g) ?? []).length, 1)

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

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
  // Each of these is a floor, not a preference: the version below it carries a
  // live advisory. brace-expansion moved 5.0.8 -> 5.0.9 (GHSA-rgw5-rvv9-x895),
  // fast-uri 3.1.4 -> 3.1.5 (GHSA-7p8r-x3mc-p8w7), hono 4.12.27 -> 4.12.34
  // (GHSA-8j4g-w8fx-2239) and vercel's undici 6.27.0 -> 6.28.0, alongside new
  // pins for ip-address and the 7.x undici under @vercel/sandbox. Lowering any
  // of them reintroduces the advisory, so `pnpm security:audit` is the thing
  // that decides these numbers — not convenience.
  assert.equal(workspaceOverride("brace-expansion"), "5.0.9")
  assert.equal(workspaceOverride("fast-uri"), "^3.1.5")
  assert.equal(workspaceOverride("ip-address"), "^10.3.1")
  assert.equal(workspaceOverride("vercel>undici"), "6.28.0")
  assert.equal(workspaceOverride('"@vercel/sandbox>undici"'), "^7.29.0")
  assert.equal(workspaceOverride("hono@4.12.25"), "4.12.34")
  assert.match(
    read("pnpm-workspace.yaml"),
    /^patchedDependencies:\n  minimatch@3\.1\.5: patches\/minimatch@3\.1\.5\.patch$/m
  )
})

test("dependency graph excludes the Task 18 vulnerable versions", () => {
  // Given the committed resolver policy and lockfile,
  const workspace = read("pnpm-workspace.yaml")
  const lockfile = read("pnpm-lock.yaml")

  // When pnpm resolves the build and audit toolchains, then neither vulnerable
  // version may be selected or hidden behind an audit exception.
  assert.doesNotMatch(lockfile, /^  extract-zip@2\.0\.1:/m)
  assert.doesNotMatch(lockfile, /^  nanoid@3\.3\.17:/m)
  assert.doesNotMatch(workspace, /^  extract-zip:/m)
  assert.doesNotMatch(workspace, /(?:ignoreCves|ignoreGhsas|audit-level)/)
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

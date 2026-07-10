import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { test } from "node:test"

const readProjectFile = (...segments) =>
  readFileSync(new URL(`../../${segments.join("/")}`, import.meta.url), "utf8")

test("active browser proof retains its declared matrices and required launch snapshots", () => {
  const governance = readProjectFile(
    "micro-specs",
    "governance",
    "ai-delivery-framework.md"
  )
  const pwa = readProjectFile("micro-specs", "platform", "pwa.md")
  const launchSnapshotDirectory = new URL(
    "../e2e/merchant-launch-follow-through.desktop.spec.ts-snapshots/",
    import.meta.url
  )
  const requiredSnapshots = [
    "dashboard-incomplete-follow-through-desktop-firefox.png",
    "dashboard-incomplete-follow-through-desktop-safari.png",
    "launch-qr-follow-through-desktop-firefox.png",
    "launch-qr-follow-through-desktop-safari.png",
  ]

  assert.match(
    governance,
    /required_playwright_projects:\n  - chromium\n  - mobile-safari\n  - desktop-firefox\n  - desktop-safari/
  )
  assert.match(
    pwa,
    /required_playwright_projects:\n  - chromium\n  - mobile-safari/
  )
  assert.ok(
    pwa.includes(
      'pnpm test:e2e -- --project=chromium --grep "PWA offline fallback"'
    )
  )
  assert.ok(
    pwa.includes(
      "pnpm test:a11y -- --project=chromium --project=mobile-safari"
    )
  )
  assert.ok(
    pwa.includes(
      "pnpm test:visual -- --project=chromium --project=mobile-safari"
    )
  )
  for (const snapshot of requiredSnapshots) {
    assert.equal(existsSync(new URL(snapshot, launchSnapshotDirectory)), true)
  }
})

test("password candidates stay separate from generated rate-limit fixture emails", () => {
  const source = readProjectFile(
    "tests",
    "e2e",
    "helpers",
    "auth-password-policy-live-db.ts"
  )

  assert.match(source, /const rejectedEmails = \[/)
  assert.match(source, /REJECTED_PASSWORDS\.entries\(\)/)
  assert.doesNotMatch(source, /REJECTED_PASSWORDS\.map\(\(candidate, index\)/)
})

test("auth hook URL contracts use literal containment rather than URL regexes", () => {
  const source = readProjectFile(
    "tests",
    "micro-specs",
    "auth-recovery-ux.test.mjs"
  )

  assert.ok(
    source.includes(`linkedWrapper.includes(
      "https://nabaperks.com/api/auth/hooks/send-email"
    )`)
  )
  assert.ok(
    source.includes(`migrationCheck.includes(
      "https://nabaperks.com/api/auth/hooks/send-email"
    )`)
  )
  assert.equal(source.includes("/https:\\\/\\\/nabaperks\\.com"), false)
})

test("environment file writes avoid check-then-use races", () => {
  const source = readProjectFile("scripts", "env-keys.mjs")
  const writeLocalSource = source.slice(
    source.indexOf("function writeLocalEnv()"),
    source.indexOf("function pullSupabase()")
  )
  const mergeSource = source.slice(
    source.indexOf("function mergeLocalEnv(updates)"),
    source.indexOf("function isRequiredContractEntry")
  )

  assert.doesNotMatch(writeLocalSource, /existsSync\(target\)/)
  assert.match(writeLocalSource, /flag:\s*force\s*\?\s*"w"\s*:\s*"wx"/)
  assert.doesNotMatch(mergeSource, /existsSync\(target\)/)
  assert.match(mergeSource, /readEnvFileIfPresent\(target\)/)
  assert.match(source, /error\?\.code === "ENOENT"/)
})

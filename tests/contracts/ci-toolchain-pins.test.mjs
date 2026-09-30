import assert from "node:assert/strict"
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"
import { test } from "node:test"
import { BROWSER_IMAGE_VERSION } from "../../scripts/ci/check-browser-image.mjs"

const read = (path) => readFileSync(path, "utf8")

function yamlFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name)
    if (statSync(path).isDirectory()) return yamlFiles(path)
    return /\.ya?ml$/.test(name) ? [path] : []
  })
}

test("the locked Playwright packages match the prepared browser image", () => {
  // The hosted browser jobs run in mcr.microsoft.com/playwright:v<version>,
  // checked against BROWSER_IMAGE_VERSION (tests/unit/ci-browser-performance).
  // A lockfile bump alone used to surface only inside those containers, after
  // every other lane had run. Fail in the fast lane instead, naming the fix.
  const lock = read("pnpm-lock.yaml")
  for (const name of ["@playwright/test", "playwright", "playwright-core"]) {
    const pattern = new RegExp(
      `^  '?${name.replace("/", "\\/")}@([0-9][^':\\s]*)'?:`,
      "gm"
    )
    const versions = new Set([...lock.matchAll(pattern)].map((m) => m[1]))
    assert.deepEqual(
      [...versions],
      [BROWSER_IMAGE_VERSION],
      `${name} must resolve only to ${BROWSER_IMAGE_VERSION}. Bump it together with ` +
        "the image tag and digest in .github/workflows/ci.yml and " +
        "BROWSER_IMAGE_VERSION (docs/operations/ci-toolchain-updates.md)."
    )
  }
})

test("each third-party action has one pinned commit and one version label", () => {
  const uses = new Map()
  for (const path of yamlFiles(".github")) {
    for (const match of read(path).matchAll(
      /uses: ([A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+)@(\S+)(?: # (\S+))?/g
    )) {
      const [, action, ref, label] = match
      assert.match(ref, /^[0-9a-f]{40}$/, `${path}: ${action} must pin a SHA`)
      assert.ok(label, `${path}: ${action}@${ref} needs a version comment`)
      const entry = uses.get(action) ?? { refs: new Set(), labels: new Set() }
      entry.refs.add(ref)
      entry.labels.add(label)
      uses.set(action, entry)
    }
  }
  assert.ok(uses.size > 10, "expected to discover the pinned actions")
  for (const [action, { refs, labels }] of uses) {
    assert.equal(refs.size, 1, `${action} is pinned to ${[...refs]}`)
    assert.equal(labels.size, 1, `${action} is labelled ${[...labels]}`)
  }
})

test("Dependabot covers composite actions and never splits the Playwright pin", () => {
  const config = read(".github/dependabot.yml")
  // `directory: "/"` scans only .github/workflows; composite actions under
  // .github/actions/* were unmanaged, which let two pnpm/action-setup pins
  // drift apart.
  assert.match(
    config,
    /package-ecosystem: github-actions\n(?: {4}#.*\n)* {4}directories:\n {6}- "\/"\n {6}- "\/\.github\/actions\/\*"\n/
  )
  for (const name of ["@playwright/test", "playwright"])
    assert.ok(
      config.includes(`- dependency-name: "${name}"`),
      `${name} is bumped with its browser image, not by a lockfile-only PR`
    )
})

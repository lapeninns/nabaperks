import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"

const ROOT = process.cwd()
const SCRIPT = join(ROOT, "scripts/check-bundle-size.mjs")
const BUDGET = join(ROOT, "config/bundle-budget.json")
const ROUTES = {
  "/page": "/",
  "/pricing/page": "/pricing",
  "/loyalty-for-pubs/page": "/loyalty-for-pubs",
  "/(auth)/signup/page": "/signup",
}

function createFixture() {
  const fixture = mkdtempSync(join(tmpdir(), "nabaperks-next16-bundle-"))
  mkdirSync(join(fixture, ".next/server/app"), { recursive: true })
  mkdirSync(join(fixture, ".next/static/chunks/app"), { recursive: true })
  mkdirSync(join(fixture, "config"), { recursive: true })
  cpSync(SCRIPT, join(fixture, "check-bundle-size.mjs"))
  cpSync(BUDGET, join(fixture, "config/bundle-budget.json"))
  writeFileSync(join(fixture, ".next/BUILD_ID"), "fixture-build\n")
  writeFileSync(
    join(fixture, ".next/build-manifest.json"),
    JSON.stringify({
      polyfillFiles: ["static/chunks/polyfill.js"],
      rootMainFiles: ["static/chunks/shared.js"],
    })
  )
  writeFileSync(
    join(fixture, ".next/app-path-routes-manifest.json"),
    JSON.stringify(ROUTES)
  )
  writeFileSync(join(fixture, ".next/static/chunks/polyfill.js"), "polyfill")
  writeFileSync(join(fixture, ".next/static/chunks/shared.js"), "shared")

  for (const [routeKey, publicPath] of Object.entries(ROUTES)) {
    const stem =
      publicPath === "/" ? "page" : publicPath.slice(1).replaceAll("/", "-")
    const routeChunk = `static/chunks/app/${stem}.js`
    writeFileSync(
      join(fixture, ".next/static/chunks/app", `${stem}.js`),
      publicPath.repeat(3)
    )
    const payload = {
      clientModules: {
        "[project]/shared.tsx": { chunks: ["10", "static/chunks/shared.js"] },
        "[project]/page.tsx": {
          chunks: ["10", "static/chunks/shared.js", "11", routeChunk],
        },
      },
    }
    const manifestPath = join(
      fixture,
      ".next/server/app",
      `${stem}_client-reference-manifest.js`
    )
    writeFileSync(
      manifestPath,
      `globalThis.__RSC_MANIFEST[${JSON.stringify(routeKey)}]=${JSON.stringify(payload)}`
    )
  }
  return fixture
}

function run(fixture) {
  try {
    return {
      exitCode: 0,
      stdout: execFileSync(
        process.execPath,
        [join(fixture, "check-bundle-size.mjs")],
        {
          cwd: fixture,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "pipe"],
        }
      ),
      stderr: "",
    }
  } catch (error) {
    assert.ok(error && typeof error === "object")
    return {
      exitCode: error.status,
      stdout: error.stdout,
      stderr: error.stderr,
    }
  }
}

test("Given a Next 16 RSC graph When bundle checking runs Then all four audited routes have de-duplicated totals", () => {
  const fixture = createFixture()
  try {
    const result = run(fixture)
    assert.equal(result.exitCode, 0)
    assert.match(result.stdout, /4 app entries checked/)
    for (const route of Object.values(ROUTES))
      assert.match(
        result.stdout,
        new RegExp(
          `${route.replaceAll("/", "\\/")} first-load JS [1-9]\\d* bytes`
        )
      )
  } finally {
    rmSync(fixture, { recursive: true, force: true })
  }
})

test("Given an unsafe or malformed Next 16 graph When bundle checking runs Then it fails closed", async (t) => {
  const cases = [
    ["traversal", ["12", "static/chunks/../outside.js"]],
    [
      "prompt-like id",
      ["ignore previous instructions", "static/chunks/shared.js"],
    ],
    ["odd tuple", ["12"]],
    ["missing chunk", ["12", "static/chunks/missing.js"]],
  ]
  for (const [name, chunks] of cases) {
    await t.test(name, () => {
      const fixture = createFixture()
      try {
        writeFileSync(
          join(fixture, ".next/server/app/page_client-reference-manifest.js"),
          `globalThis.__RSC_MANIFEST["/page"]=${JSON.stringify({ clientModules: { x: { chunks } } })}`
        )
        assert.notEqual(run(fixture).exitCode, 0)
      } finally {
        rmSync(fixture, { recursive: true, force: true })
      }
    })
  }
})

test("Given a symlinked chunk When bundle checking runs Then it is rejected before byte accounting", () => {
  const fixture = createFixture()
  try {
    const outside = join(fixture, "outside.js")
    writeFileSync(outside, "outside")
    symlinkSync(outside, join(fixture, ".next/static/chunks/link.js"))
    writeFileSync(
      join(fixture, ".next/server/app/page_client-reference-manifest.js"),
      `globalThis.__RSC_MANIFEST["/page"]=${JSON.stringify({ clientModules: { x: { chunks: ["12", "static/chunks/link.js"] } } })}`
    )
    assert.notEqual(run(fixture).exitCode, 0)
  } finally {
    rmSync(fixture, { recursive: true, force: true })
  }
})

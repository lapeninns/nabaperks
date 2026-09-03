import assert from "node:assert/strict"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { test } from "node:test"

import { buildAdminMfaBootstrap } from "../../scripts/build-admin-mfa-bootstrap.mjs"

const PROJECT_REF = "abcdefghijklmnopqrst"
const BROWSER_KEY = "browser-key-for-bootstrap-build-test"

test("bootstrap builder emits only the fixed route as a preview-ready Vercel output", async () => {
  const temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), "nabaperks-bootstrap-")
  )
  try {
    await buildAdminMfaBootstrap({
      outputDirectory: temporaryDirectory,
      projectRef: PROJECT_REF,
      supabaseAnonKey: BROWSER_KEY,
    })

    const [config, page, browserConfig, bundle] = await Promise.all([
      readFile(path.join(temporaryDirectory, "config.json"), "utf8"),
      readFile(
        path.join(
          temporaryDirectory,
          "static",
          "admin-mfa-bootstrap",
          "index.html"
        ),
        "utf8"
      ),
      readFile(path.join(temporaryDirectory, "static", "config.js"), "utf8"),
      readFile(
        path.join(temporaryDirectory, "static", "assets", "bootstrap.js"),
        "utf8"
      ),
    ])

    assert.match(config, /admin-mfa-bootstrap/)
    assert.match(page, /frame-ancestors 'none'/)
    assert.match(browserConfig, new RegExp(`${PROJECT_REF}\\.supabase\\.co`))
    assert.ok(bundle.length > 1_000)
    assert.doesNotMatch(page, /service.role|SUPABASE_SERVICE_ROLE/i)
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
})

test("bootstrap builder rejects an invalid project boundary", async () => {
  const temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), "nabaperks-invalid-bootstrap-")
  )
  try {
    await assert.rejects(
      () =>
        buildAdminMfaBootstrap({
          outputDirectory: temporaryDirectory,
          projectRef: "not-a-project",
          supabaseAnonKey: BROWSER_KEY,
        }),
      /valid Supabase project reference/
    )
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
})

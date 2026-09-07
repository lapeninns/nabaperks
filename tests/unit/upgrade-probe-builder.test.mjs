import test from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, rmSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import {
  assertCompilerEnvironment,
  assertCleanRevision,
  compileProbe,
} from "../fixtures/release-upgrade/build-probe.mjs"
import {
  validateProbeDatabase,
  createSupabaseServiceRoleClient,
} from "../fixtures/release-upgrade/probe/database-adapter.mjs"

test("builder refuses dirty source and revision mismatch before building", () => {
  const revision = "a".repeat(40)
  const fakeGit =
    (status, head = revision) =>
    (_command, args) => ({
      status: 0,
      stdout: args[0] === "status" ? status : head,
    })
  assert.throws(
    () =>
      assertCleanRevision(
        process.cwd(),
        revision,
        fakeGit(" M lib/stripe/billing.ts")
      ),
    /clean/
  )
  assert.throws(
    () =>
      assertCleanRevision(process.cwd(), revision, fakeGit("", "b".repeat(40))),
    /expected full revision/
  )
})
test("probe adapter does not fall back to ordinary DB helper environment", () => {
  const target = {
    UPGRADE_DATABASE_URL:
      "postgres://postgres:fixture@127.0.0.1:54322/codex_upgrade_test",
    UPGRADE_TARGET_MARKER: "ee000000-0000-4000-8000-000000000001",
  }
  assert.equal(validateProbeDatabase(target).hostname, "127.0.0.1")
  assert.throws(() =>
    validateProbeDatabase({ SUPABASE_DB_URL: target.UPGRADE_DATABASE_URL })
  )
  assert.throws(() =>
    validateProbeDatabase({
      ...target,
      UPGRADE_DATABASE_URL: target.UPGRADE_DATABASE_URL.replace(
        "127.0.0.1",
        "production.example"
      ),
    })
  )
  assert.throws(
    () => createSupabaseServiceRoleClient(),
    /verified disposable transaction/
  )
})
test("probe compiler bundles the real application domain functions and DB transport", async () => {
  const dir = mkdtempSync(join(tmpdir(), "upgrade-build-unit-"))
  try {
    const output = join(dir, "probe.mjs")
    const build = await compileProbe(process.cwd(), "a".repeat(40), output)
    const inputs = Object.keys(build.metafile.inputs).join("\n")
    for (const source of [
      "lib/stripe/billing.ts",
      "lib/stripe/webhook-events.ts",
      "lib/customer/reward-scan-token.ts",
      "lib/customer/availability.ts",
      "probe/database-adapter.mjs",
    ]) {
      assert.ok(inputs.includes(source), source)
    }
    assert.ok(!inputs.includes("tests/db/helpers/db.mjs"))
    assert.ok(!inputs.includes("lib/supabase/server.ts"))
    const bundle = readFileSync(output, "utf8")
    assert.match(bundle, /apply_current_stripe_subscription/)
    assert.match(bundle, /claim_stripe_webhook_event/)
    assert.match(bundle, /create_reward_scan_token/)
    assert.match(bundle, /successful-probe-rollback/)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("compiler refuses ambient binary and Node resolution injection even when empty", () => {
  assertCompilerEnvironment({ PATH: "/usr/bin" })
  for (const key of ["ESBUILD_BINARY_PATH", "NODE_OPTIONS", "NODE_PATH"]) {
    assert.throws(
      () => assertCompilerEnvironment({ [key]: "/tmp/untrusted" }),
      /Ambient compiler override/
    )
    assert.throws(
      () => assertCompilerEnvironment({ [key]: "" }),
      /Ambient compiler override/
    )
  }
})
